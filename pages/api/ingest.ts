// pages/api/ingest.ts - Assemble complete context package for agents
//
// Changes vs original:
//   • Imports computeLiquidityZones + computeVolumeDelta from lib/liquidity
//   • After computeIndicators(), calls both (zero extra API fetches — ATR and
//     ohlcData are already in scope)
//   • Each agentContext is now EnrichedAgentContext (extends AgentContext with
//     liquidityMap + volumeDelta); all existing fields are unchanged
//   • Top-level response also exposes liquidityMap + volumeDelta for the UI

import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchHistoricalData, getCurrentPrice } from '@/lib/market-data';
import { computeIndicators } from '@/lib/indicators';
import { fetchMacroData } from '@/lib/macro-data';
import { fetchAssetSpecificContext } from '@/lib/asset-specific';
import { getAgentPerformance } from '@/lib/vector';
import { computeLiquidityZones, computeVolumeDelta } from '@/lib/liquidity';
import { Asset, EnrichedAgentContext } from '@/types';
import { AGENTS } from '@/lib/agents';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { asset, timeframe = '4h' } = req.query;

    if (!asset) {
      return res.status(400).json({ error: 'Asset parameter required' });
    }

    const validAssets = ['BTCUSD', 'ETHUSD', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'SPX500', 'CRUDE'];
    if (!validAssets.includes(asset as string)) {
      return res.status(400).json({ error: 'Invalid asset' });
    }

    console.log(`Assembling context package for: ${asset}`);

    // Fetch all data in parallel — unchanged from original
    const [
      ohlcData,
      priceData,
      macroData,
      assetSpecific,
    ] = await Promise.all([
      fetchHistoricalData(asset as Asset, '1y', timeframe as '1d' | '4h' | '1h'),
      getCurrentPrice(asset as Asset),
      fetchMacroData(asset as Asset),
      fetchAssetSpecificContext(asset as Asset),
    ]);

    const { price: currentPrice, change24h, source } = priceData;

    // Compute technical indicators — unchanged
    const indicators = computeIndicators(ohlcData, currentPrice);

    // ── NEW: liquidity zones ─────────────────────────────────────────────────
    // Uses currentPrice and indicators.atr — no extra fetch needed.
    const liquidityMap = computeLiquidityZones(currentPrice, indicators.atr, asset as Asset);
    console.log(
      `Liquidity: ${liquidityMap.zonesAbove.length} zones above, ` +
      `${liquidityMap.zonesBelow.length} below`,
    );

    // ── NEW: volume delta from OHLC ─────────────────────────────────────────
    // Bar-level approximation — no tick feed required.
    // Useful directly in Jake's prompt; included for all agents as context.
    const volumeDelta = computeVolumeDelta(ohlcData);
    console.log(`Volume delta: ${volumeDelta.summary}`);

    // Historical pattern matching — unchanged placeholder
    const historicalPattern = {
      similarPeriod: 'May 2023',
      outcome: 'Bullish continuation after consolidation',
      winRate: 65,
      sampleSize: 20,
    };

    // Recent news placeholder — unchanged
    const recentNews = [
      'Market consolidating after recent rally',
      'Institutional interest remains strong',
      'Key support levels holding',
    ];

    // ── Build per-agent context ──────────────────────────────────────────────
    const agentContexts: Record<string, EnrichedAgentContext> = {};

    for (const agent of AGENTS) {
      let pastPerformance = {
        winLossRecord:   'No prior predictions',
        edgeDescription: 'New agent - establishing baseline',
        calibrationNote: 'Insufficient data',
      };

      try {
        const performance = await getAgentPerformance(agent.name, asset as Asset);
        if (performance.totalPredictions > 0) {
          pastPerformance = {
            winLossRecord: `${performance.correctPredictions}W-${performance.totalPredictions - performance.correctPredictions}L (${performance.winRate.toFixed(1)}%)`,
            edgeDescription:
              performance.winRate > 55 ? `Outperforming on ${asset}` :
              performance.winRate < 45 ? `Underperforming on ${asset}` :
              `Average performance on ${asset}`,
            calibrationNote: performance.calibration,
          };
        }
      } catch (_) {
        console.log(`No past performance for ${agent.name} on ${asset}`);
      }

      // Spread the original AgentContext fields, then add the two new ones.
      // EnrichedAgentContext extends AgentContext, so this is type-safe.
      agentContexts[agent.name] = {
        // ── Original AgentContext fields (unchanged) ──
        asset:            asset as Asset,
        timeframe:        timeframe as string,
        analysisDate:     new Date().toISOString(),
        currentPrice,
        change24h,
        source,
        indicators,
        macro:            macroData,
        assetSpecific,
        historicalPattern,
        recentNews,
        pastPerformance,
        // ── New enrichment fields ──
        liquidityMap,
        volumeDelta,
      };
    }

    return res.status(200).json({
      asset,
      timeframe,
      currentPrice,
      change24h,
      agentContexts,
      // Expose at top level for the frontend / debug panel
      liquidityMap,
      volumeDelta,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error in /api/ingest:', error);
    return res.status(500).json({
      error:   'Failed to assemble context',
      details: error.message,
    });
  }
}
