// lib/liquidity.ts
// Ports the liquidity-zone algorithm from advanced-features.js (buildLiquidityHeatmap
// / runGenerate) into fully-typed TypeScript.
//
// Three zone sources — identical logic to the original JS:
//   1. Round-number price magnets   → tier:'HIGH',   label:'STOP CLUSTER'
//   2. Fibonacci retracement levels → tier:'MEDIUM'/'LOW', label:'ORDER BLOCK'/'FVG'
//   3. ATR-based swing-gap sweeps   → tier:'MEDIUM'/'LOW', label:'ORDER BLOCK'/'FVG'
//
// Key departure from the JS: Math.random() is replaced with a seeded
// pseudo-random function so zones are deterministic for a given price/ATR
// pair — identical inputs always produce identical output, which matters for
// reproducible agent reasoning and testability.
//
// Usage:
//   import { computeLiquidityZones } from '@/lib/liquidity';
//   const map = computeLiquidityZones(currentPrice, indicators.atr, asset);
//   // map.zonesAbove / map.zonesBelow / map.summary

import {
  Asset,
  LiquidityTier,
  LiquidityLabel,
  LiquidityZone,
  LiquidityMap,
  VolumeDeltaSummary,
} from '@/types';

// ── Algorithm constants (mirrors the JS) ─────────────────────────────────────

/** Price window around current price within which we emit zones (±3.8 %) */
const WINDOW_PCT = 0.038;

/** Fibonacci extension/retracement ratios from the original JS */
const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272] as const;

/** ATR-based gap candidates — same count as the JS loop */
const ATR_CANDIDATE_COUNT = 12;

/** Minimum price separation (as fraction of price) to treat two zones as distinct */
const DEDUP_WINDOW = 0.0015;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * computeLiquidityZones
 *
 * Called from /api/ingest after computeIndicators() so price and ATR are
 * already available — no additional fetches required.
 */
export function computeLiquidityZones(
  price: number,
  atr:   number,
  asset: Asset,
): LiquidityMap {
  const dec    = precisionFor(price);
  const zones: LiquidityZone[] = [];

  // ── 1. Round-number price magnets ─────────────────────────────────────────
  const step      = roundStepFor(price);
  const baseRound = Math.round(price / step) * step;

  for (let ri = -8; ri <= 8; ri++) {
    const zp   = baseRound + ri * step;
    if (zp <= 0) continue;

    const dist = Math.abs(zp - price) / price;
    if (dist < 0.001 || dist > WINDOW_PCT) continue;

    // Strength: proximity drives it; seeded noise adds ±4 % variance
    const proximity = 1 - dist / WINDOW_PCT;
    const strength  = clamp(0.55 + proximity * 0.35 + seed(zp, price) * 0.08);

    zones.push({
      price:       round(zp, dec),
      strength:    round(strength, 3),
      tier:        'HIGH',
      label:       'STOP CLUSTER',
      distancePct: round(((zp - price) / price) * 100, 3),
    });
  }

  // ── 2. Fibonacci retracement zones ────────────────────────────────────────
  const swHigh = price + atr * 2.8;
  const swLow  = price - atr * 2.8;

  for (const ratio of FIB_RATIOS) {
    const fp   = swHigh - (swHigh - swLow) * ratio;
    const dist = Math.abs(fp - price) / price;
    if (dist < 0.0015 || dist > WINDOW_PCT - 0.001) continue;

    // Strength range 0.35–0.80; seeded spread
    const s     = clamp(0.35 + seed(fp, price) * 0.45);
    const tier: LiquidityTier  = s > 0.60 ? 'MEDIUM' : 'LOW';
    const label: LiquidityLabel = tier === 'MEDIUM' ? 'ORDER BLOCK' : 'FVG';

    zones.push({
      price:       round(fp, dec),
      strength:    round(s, 3),
      tier,
      label,
      distancePct: round(((fp - price) / price) * 100, 3),
    });
  }

  // ── 3. ATR-based swing-gap sweeps ─────────────────────────────────────────
  for (let ai = 0; ai < ATR_CANDIDATE_COUNT; ai++) {
    // Deterministic direction & multiplier that spread across the window
    const dir  = ai % 2 === 0 ? 1 : -1;
    const mult = 0.3 + (ai / ATR_CANDIDATE_COUNT) * 2.2;
    const ap   = price + dir * atr * mult;
    const dist = Math.abs(ap - price) / price;
    if (dist < 0.002 || dist > WINDOW_PCT - 0.001) continue;

    const s     = clamp(0.15 + seed(ap, price) * 0.50);
    const tier: LiquidityTier  = s > 0.50 ? 'MEDIUM' : 'LOW';
    const label: LiquidityLabel = tier === 'MEDIUM' ? 'ORDER BLOCK' : 'FVG';

    zones.push({
      price:       round(ap, dec),
      strength:    round(s, 3),
      tier,
      label,
      distancePct: round(((ap - price) / price) * 100, 3),
    });
  }

  // ── 4. Deduplicate (keep stronger when two zones are within DEDUP_WINDOW) ──
  zones.sort((a, b) => a.price - b.price);

  const deduped: LiquidityZone[] = [];
  for (const zone of zones) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(zone.price - prev.price) / price < DEDUP_WINDOW) {
      if (zone.strength > prev.strength) deduped[deduped.length - 1] = zone;
    } else {
      deduped.push(zone);
    }
  }

  // ── 5. Split and sort ─────────────────────────────────────────────────────
  const zonesAbove = deduped
    .filter(z => z.price > price)
    .sort((a, b) => a.price - b.price);   // nearest-first

  const zonesBelow = deduped
    .filter(z => z.price < price)
    .sort((a, b) => b.price - a.price);   // nearest-first

  return {
    asset,
    currentPrice: price,
    atr,
    zonesAbove,
    zonesBelow,
    summary: buildSummary(asset, price, zonesAbove, zonesBelow, dec),
  };
}

// ── Volume delta (OHLC approximation) ────────────────────────────────────────
//
// Real volume delta requires tick-level data. This is the standard bar-level
// proxy used in footprint charting software when raw trades aren't available:
//
//   buyVol  ≈ volume × (close − low)  / (high − low)
//   sellVol ≈ volume × (high − close) / (high − low)
//   delta   = buyVol − sellVol
//
// Cumulated over the last 20 bars this gives a directional pressure reading
// that's genuinely useful for Jake (Order Flow) without any additional API.

const DELTA_LOOKBACK = 20;

export function computeVolumeDelta(ohlcData: {
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}[]): VolumeDeltaSummary {
  const bars = ohlcData.slice(-DELTA_LOOKBACK);

  if (bars.length === 0) {
    return {
      cumulativeDelta: 0,
      lastBarDelta:    0,
      barsUsed:        0,
      trend:           'NEUTRAL',
      summary:         'Volume delta: insufficient OHLC data',
    };
  }

  let cumulative   = 0;
  let lastBarDelta = 0;
  let totalVol     = 0;

  for (let i = 0; i < bars.length; i++) {
    const { high, low, close, volume } = bars[i];
    const range = high - low;
    totalVol += volume;
    if (range === 0) continue;   // skip flat / doji bars

    const buyVol  = volume * (close - low)  / range;
    const sellVol = volume * (high - close) / range;
    const delta   = buyVol - sellVol;

    cumulative += delta;
    if (i === bars.length - 1) lastBarDelta = delta;
  }

  const avgVol = totalVol / bars.length;
  const trend: VolumeDeltaSummary['trend'] =
    cumulative >  avgVol * 0.10 ? 'BULLISH' :
    cumulative < -avgVol * 0.10 ? 'BEARISH' :
    'NEUTRAL';

  const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(0)}` : n.toFixed(0));

  return {
    cumulativeDelta: Math.round(cumulative),
    lastBarDelta:    Math.round(lastBarDelta),
    barsUsed:        bars.length,
    trend,
    summary: `Vol-delta (OHLC proxy, ${bars.length} bars): cumulative=${fmt(cumulative)}, last bar=${fmt(lastBarDelta)}, trend=${trend}`,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Decimal places appropriate for the asset's price magnitude */
function precisionFor(price: number): number {
  if (price > 50_000) return 0;
  if (price > 999)    return 1;
  if (price > 9)      return 2;
  return 5;
}

/** Round-number grid step scaled to price magnitude — mirrors the JS exactly */
function roundStepFor(price: number): number {
  if (price > 50_000) return 1_000;
  if (price > 5_000)  return 500;
  if (price > 1_000)  return 50;
  if (price > 100)    return 10;
  if (price > 5)      return 0.5;
  return 0.005;
}

/**
 * Deterministic value in [0, 1) derived from two floats.
 * Replaces Math.random() so output is stable across identical inputs.
 * Uses the same sine-hash trick commonly seen in GLSL noise functions.
 */
function seed(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43_758.5453;
  return x - Math.floor(x);
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number, dec: number): number {
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
}

/** Short one-line summary for agents that don't need the full zone table */
function buildSummary(
  asset:      Asset,
  price:      number,
  above:      LiquidityZone[],
  below:      LiquidityZone[],
  dec:        number,
): string {
  const fmt = (z: LiquidityZone) =>
    `$${z.price.toFixed(dec)} (${z.distancePct > 0 ? '+' : ''}${z.distancePct.toFixed(2)}%, ${z.tier})`;

  const topAbove = above.slice(0, 3).map(fmt).join(' | ');
  const topBelow = below.slice(0, 3).map(fmt).join(' | ');

  return (
    `Liquidity — ${asset} @ $${price.toFixed(dec)} | ` +
    `Above: ${topAbove || 'none'} | ` +
    `Below: ${topBelow || 'none'} | ` +
    `HIGH=stop cluster, MEDIUM=order block, LOW=FVG`
  );
}
