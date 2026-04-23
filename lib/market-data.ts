// lib/market-data.ts - Fetch OHLC data from various sources

import axios from 'axios';
import { OHLCData, Asset } from '@/types';
import { cacheGet, cacheSet, CacheKeys } from './redis';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

export async function fetchHistoricalData(
  asset: Asset,
  period: '5y' | '1y' | '1m',
  interval: '1d' | '4h' | '1h' = '1d'
): Promise<OHLCData[]> {
  // Check cache first
  const cacheKey = CacheKeys.ohlc(asset, `${period}-${interval}`);
  const cached = await cacheGet<OHLCData[]>(cacheKey);
  
  if (cached) {
    console.log(`Cache hit for ${asset} ${period} ${interval}`);
    return cached;
  }
  
  console.log(`Fetching fresh data for ${asset} ${period} ${interval}`);
  
  let data: OHLCData[];
  
  if (asset === 'BTCUSD' || asset === 'ETHUSD') {
    data = await fetchBinanceData(asset, period, interval);
  } else {
    data = await fetchTwelveData(asset, period, interval);
  }
  
  // Cache for 24 hours
  await cacheSet(cacheKey, data, 86400);
  
  return data;
}

async function fetchBinanceData(
  asset: Asset,
  period: string,
  interval: string
): Promise<OHLCData[]> {
  const symbol = asset === 'BTCUSD' ? 'BTCUSDT' : 'ETHUSDT';
  
  // Calculate time range
  const now = Date.now();
  const intervals: Record<string, number> = {
    '5y': 5 * 365 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
    '1m': 30 * 24 * 60 * 60 * 1000,
  };
  
  const startTime = now - intervals[period];
  
  // Binance interval format
  const binanceInterval = interval === '1d' ? '1d' : interval === '4h' ? '4h' : '1h';
  
  try {
    const response = await axios.get(`${BINANCE_BASE}/klines`, {
      params: {
        symbol,
        interval: binanceInterval,
        startTime,
        limit: 1000,
      },
    });
    
    return response.data.map((candle: any[]) => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  } catch (error) {
    console.error('Binance API error:', error);
    throw new Error('Failed to fetch Binance data');
  }
}

async function fetchTwelveData(
  asset: Asset,
  period: string,
  interval: string
): Promise<OHLCData[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  
  if (!apiKey) {
    throw new Error('Missing Twelve Data API key');
  }
  
  // Map asset to Twelve Data symbol
  const symbolMap: Record<string, string> = {
    XAUUSD: 'XAU/USD',
    EURUSD: 'EUR/USD',
    GBPUSD: 'GBP/USD',
    USDJPY: 'USD/JPY',
    SPX500: 'SPX',
    CRUDE: 'WTI/USD',
  };
  
  const symbol = symbolMap[asset] || asset;
  
  try {
    const response = await axios.get(`${TWELVE_DATA_BASE}/time_series`, {
      params: {
        symbol,
        interval,
        apikey: apiKey,
        outputsize: 5000,
      },
    });
    
    if (!response.data.values) {
      throw new Error('Invalid Twelve Data response');
    }
    
    return response.data.values.map((item: any) => ({
      timestamp: new Date(item.datetime).getTime(),
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume || 0),
    })).reverse(); // Twelve Data returns newest first
  } catch (error) {
    console.error('Twelve Data API error:', error);
    throw new Error('Failed to fetch Twelve Data');
  }
}

export async function getCurrentPrice(asset: Asset): Promise<{
  price: number;
  change24h: number;
  source: string;
}> {
  if (asset === 'BTCUSD' || asset === 'ETHUSD') {
    return fetchBinancePrice(asset);
  } else {
    return fetchTwelveDataPrice(asset);
  }
}

async function fetchBinancePrice(asset: Asset): Promise<{
  price: number;
  change24h: number;
  source: string;
}> {
  const symbol = asset === 'BTCUSD' ? 'BTCUSDT' : 'ETHUSDT';
  
  try {
    const response = await axios.get(`${BINANCE_BASE}/ticker/24hr`, {
      params: { symbol },
    });
    
    return {
      price: parseFloat(response.data.lastPrice),
      change24h: parseFloat(response.data.priceChangePercent),
      source: 'Binance',
    };
  } catch (error) {
    throw new Error('Failed to fetch Binance price');
  }
}

async function fetchTwelveDataPrice(asset: Asset): Promise<{
  price: number;
  change24h: number;
  source: string;
}> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  
  const symbolMap: Record<string, string> = {
    XAUUSD: 'XAU/USD',
    EURUSD: 'EUR/USD',
    GBPUSD: 'GBP/USD',
    USDJPY: 'USD/JPY',
    SPX500: 'SPX',
    CRUDE: 'WTI/USD',
  };
  
  const symbol = symbolMap[asset] || asset;
  
  try {
    const response = await axios.get(`${TWELVE_DATA_BASE}/quote`, {
      params: {
        symbol,
        apikey: apiKey,
      },
    });
    
    return {
      price: parseFloat(response.data.close),
      change24h: parseFloat(response.data.percent_change || 0),
      source: 'Twelve Data',
    };
  } catch (error) {
    throw new Error('Failed to fetch Twelve Data price');
  }
}
