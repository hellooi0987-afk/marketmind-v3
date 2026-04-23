// pages/api/macro.ts - Fetch macro economic indicators

import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchMacroData } from '@/lib/macro-data';
import { Asset } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { asset } = req.query;

    if (!asset) {
      return res.status(400).json({ error: 'Asset parameter required' });
    }

    const validAssets = ['BTCUSD', 'ETHUSD', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'SPX500', 'CRUDE'];
    if (!validAssets.includes(asset as string)) {
      return res.status(400).json({ error: 'Invalid asset' });
    }

    console.log(`Fetching macro data for: ${asset}`);

    const macroData = await fetchMacroData(asset as Asset);

    return res.status(200).json({
      asset,
      macro: macroData,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/macro:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch macro data',
      details: error.message 
    });
  }
}
