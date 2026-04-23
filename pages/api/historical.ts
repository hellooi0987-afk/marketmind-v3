// pages/api/historical.ts - Fetch OHLC + computed indicators

import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchHistoricalData, getCurrentPrice } from '@/lib/market-data';
import { computeIndicators } from '@/lib/indicators';
import { Asset } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { asset, period = '5y', interval = '1d' } = req.query;

    if (!asset) {
      return res.status(400).json({ error: 'Asset parameter required' });
    }

    const validAssets = ['BTCUSD', 'ETHUSD', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'SPX500', 'CRUDE'];
    if (!validAssets.includes(asset as string)) {
      return res.status(400).json({ error: 'Invalid asset' });
    }

    const validPeriods = ['5y', '1y', '1m'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({ error: 'Invalid period' });
    }

    const validIntervals = ['1d', '4h', '1h'];
    if (!validIntervals.includes(interval as string)) {
      return res.status(400).json({ error: 'Invalid interval' });
    }

    console.log(`Fetching historical data: ${asset} ${period} ${interval}`);

    // Fetch OHLC data
    const ohlcData = await fetchHistoricalData(
      asset as Asset,
      period as '5y' | '1y' | '1m',
      interval as '1d' | '4h' | '1h'
    );

    // Get current price
    const { price: currentPrice } = await getCurrentPrice(asset as Asset);

    // Compute indicators
    const indicators = computeIndicators(ohlcData, currentPrice);

    return res.status(200).json({
      asset,
      period,
      interval,
      dataPoints: ohlcData.length,
      ohlc: ohlcData.slice(-100), // Return last 100 candles
      currentPrice,
      indicators,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/historical:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch historical data',
      details: error.message 
    });
  }
}
