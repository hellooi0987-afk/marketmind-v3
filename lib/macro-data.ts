// lib/macro-data.ts - Fetch macro economic data from FRED API

import axios from 'axios';
import { MacroData, Asset } from '@/types';
import { cacheGet, cacheSet, CacheKeys } from './redis';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export async function fetchMacroData(asset: Asset): Promise<MacroData> {
  // Check cache (refresh weekly)
  const cacheKey = CacheKeys.macro(asset);
  const cached = await cacheGet<MacroData>(cacheKey);
  
  if (cached) {
    console.log(`Cache hit for macro data: ${asset}`);
    return cached;
  }
  
  console.log(`Fetching fresh macro data for ${asset}`);
  
  const apiKey = process.env.FRED_API_KEY;
  
  if (!apiKey) {
    throw new Error('Missing FRED API key');
  }
  
  try {
    // Fetch all macro indicators in parallel
    const [
      fedRate,
      cpi,
      gdp,
      unemployment,
      yield10y,
      yield2y,
    ] = await Promise.all([
      fetchFredSeries('FEDFUNDS', apiKey),
      fetchFredSeries('CPIAUCSL', apiKey),
      fetchFredSeries('A191RL1Q225SBEA', apiKey),
      fetchFredSeries('UNRATE', apiKey),
      fetchFredSeries('DGS10', apiKey),
      fetchFredSeries('DGS2', apiKey),
    ]);
    
    // Calculate CPI YoY change
    const cpiCurrent = cpi[cpi.length - 1]?.value || 0;
    const cpiYearAgo = cpi[cpi.length - 12]?.value || cpiCurrent;
    const cpiYoY = ((cpiCurrent - cpiYearAgo) / cpiYearAgo) * 100;
    
    // Determine CPI trend
    const cpiPrevMonth = cpi[cpi.length - 2]?.value || cpiCurrent;
    const cpiTrend = cpiCurrent > cpiPrevMonth ? 'Rising' : 'Falling';
    
    // Fed rate direction
    const fedCurrent = fedRate[fedRate.length - 1]?.value || 0;
    const fedPrev = fedRate[fedRate.length - 2]?.value || fedCurrent;
    const fedDirection = fedCurrent > fedPrev ? 'Hiking' : fedCurrent < fedPrev ? 'Cutting' : 'Stable';
    
    // Yield curve
    const y10 = yield10y[yield10y.length - 1]?.value || 0;
    const y2 = yield2y[yield2y.length - 1]?.value || 0;
    const yieldSpread = (y10 - y2) * 100; // in basis points
    
    let yieldInterpretation = '';
    if (yieldSpread < -50) yieldInterpretation = 'Deeply inverted - recession signal';
    else if (yieldSpread < 0) yieldInterpretation = 'Inverted - caution';
    else if (yieldSpread < 50) yieldInterpretation = 'Flat - neutral';
    else yieldInterpretation = 'Steep - healthy growth signal';
    
    // DXY (approximate from forex rates)
    const dxy = await calculateDXYProxy();
    const dxyImpact = getDXYImpact(asset, dxy);
    
    // VIX (fetch from Twelve Data)
    const vix = await fetchVIX();
    const vixRegime = vix < 15 ? 'Low volatility' : vix < 25 ? 'Moderate volatility' : 'High volatility';
    
    const macroData: MacroData = {
      fedRate: fedCurrent,
      fedDirection,
      cpi: cpiYoY,
      cpiTrend,
      gdp: gdp[gdp.length - 1]?.value || 0,
      unemployment: unemployment[unemployment.length - 1]?.value || 0,
      yieldSpread,
      yieldInterpretation,
      dxy,
      dxyImpact,
      vix,
      vixRegime,
    };
    
    // Cache for 1 week
    await cacheSet(cacheKey, macroData, 604800);
    
    return macroData;
  } catch (error) {
    console.error('Error fetching macro data:', error);
    throw new Error('Failed to fetch macro data');
  }
}

async function fetchFredSeries(
  seriesId: string,
  apiKey: string
): Promise<Array<{ date: string; value: number }>> {
  try {
    const response = await axios.get(FRED_BASE, {
      params: {
        series_id: seriesId,
        api_key: apiKey,
        file_type: 'json',
        limit: 100,
        sort_order: 'desc',
      },
    });
    
    return response.data.observations
      .filter((obs: any) => obs.value !== '.')
      .map((obs: any) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }))
      .reverse();
  } catch (error) {
    console.error(`Error fetching FRED series ${seriesId}:`, error);
    return [];
  }
}

async function calculateDXYProxy(): Promise<number> {
  // DXY is a weighted basket: EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%
  // Simplified approximation using major pairs
  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    
    if (!apiKey) {
      return 100; // Default value
    }
    
    const eurusd = await axios.get('https://api.twelvedata.com/quote', {
      params: { symbol: 'EUR/USD', apikey: apiKey },
    });
    
    const usdjpy = await axios.get('https://api.twelvedata.com/quote', {
      params: { symbol: 'USD/JPY', apikey: apiKey },
    });
    
    const gbpusd = await axios.get('https://api.twelvedata.com/quote', {
      params: { symbol: 'GBP/USD', apikey: apiKey },
    });
    
    // Simplified DXY calculation
    const eurRate = parseFloat(eurusd.data.close);
    const jpyRate = parseFloat(usdjpy.data.close);
    const gbpRate = parseFloat(gbpusd.data.close);
    
    const dxy = 100 * (
      Math.pow(1 / eurRate, 0.576) *
      Math.pow(jpyRate / 100, 0.136) *
      Math.pow(1 / gbpRate, 0.119)
    );
    
    return Math.round(dxy * 100) / 100;
  } catch {
    return 100;
  }
}

function getDXYImpact(asset: Asset, dxy: number): string {
  const dxyTrend = dxy > 105 ? 'strong' : dxy > 95 ? 'neutral' : 'weak';
  
  if (asset === 'XAUUSD') {
    return dxyTrend === 'strong' ? 'Headwind for gold' : 'Tailwind for gold';
  } else if (asset === 'BTCUSD' || asset === 'ETHUSD') {
    return dxyTrend === 'strong' ? 'Negative for crypto' : 'Positive for crypto';
  } else if (asset === 'EURUSD' || asset === 'GBPUSD') {
    return dxyTrend === 'strong' ? 'Bearish pressure' : 'Bullish pressure';
  } else {
    return 'Mixed impact';
  }
}

async function fetchVIX(): Promise<number> {
  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    
    if (!apiKey) {
      return 20; // Default value
    }
    
    const response = await axios.get('https://api.twelvedata.com/quote', {
      params: {
        symbol: 'VIX',
        apikey: apiKey,
      },
    });
    
    return parseFloat(response.data.close);
  } catch {
    return 20;
  }
}
