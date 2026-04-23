// lib/prompt-builder.ts - Build agent prompts with full context
//
// Changes vs original:
//   • buildAgentPrompt() now accepts an optional EnrichedAgentContext (which
//     carries liquidityMap + volumeDelta) in addition to the plain AgentContext.
//     Pass either — the function is fully backward-compatible.
//   • A new ━━ LIQUIDITY & ORDER FLOW ━━ section is injected between
//     "Swing Points" and "Macro Regime" in every agent's user-prompt.
//   • Jake Morrison and Aisha Okonkwo receive a richer, role-specific
//     rendering of the zone table; all other agents get the compact summary.
//   • buildDebatePrompt() and all helper functions are unchanged.

import {
  AgentContext,
  AgentDefinition,
  EnrichedAgentContext,
  LiquidityMap,
  LiquidityZone,
  VolumeDeltaSummary,
} from '@/types';

// ── Public entry points ───────────────────────────────────────────────────────

export function buildAgentPrompt(
  agent:   AgentDefinition,
  context: AgentContext | EnrichedAgentContext,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = buildSystemPrompt(agent);
  const userPrompt   = buildUserPrompt(context, agent);
  return { systemPrompt, userPrompt };
}

// ── System prompt — verbatim from original ────────────────────────────────────

function buildSystemPrompt(agent: AgentDefinition): string {
  return `You are ${agent.name}, a ${agent.role} in a multi-agent market analysis system.

YOUR PSYCHOLOGY & APPROACH:
${agent.psychology}

YOUR FOCUS AREAS:
${agent.focusAreas.map(area => `- ${area}`).join('\n')}

CRITICAL INSTRUCTIONS:
1. You MUST return ONLY valid JSON. No preamble, no explanation outside the JSON.
2. Base your analysis on the provided technical indicators and macro context.
3. Be specific about price targets and stop losses (use actual numbers).
4. Your reasoning must reference specific data points from the context.
5. Stay true to your trading psychology - don't deviate from your character.
6. Confidence scale: 1-10, where 10 = extremely high conviction.

You are competing with 5 other agents. Your goal is to provide the most accurate prediction.`;
}

// ── User prompt ───────────────────────────────────────────────────────────────

function buildUserPrompt(
  context: AgentContext | EnrichedAgentContext,
  agent:   AgentDefinition,
): string {
  const indicators = context.indicators;
  const macro      = context.macro;

  // Pull enrichment if present — undefined otherwise, handled gracefully below
  const enriched      = isEnriched(context) ? context : null;
  const liquidityMap  = enriched?.liquidityMap;
  const volumeDelta   = enriched?.volumeDelta;

  return `━━ ASSET & TIMEFRAME ━━
Asset: ${context.asset}
Timeframe: ${context.timeframe}
Analysis Date: ${context.analysisDate}

━━ CURRENT PRICE ━━
Price: $${context.currentPrice.toFixed(2)}
24h Change: ${context.change24h >= 0 ? '+' : ''}${context.change24h.toFixed(2)}%
Source: ${context.source}

━━ TECHNICAL INDICATORS ━━
RSI(14): ${indicators.rsi[indicators.rsi.length - 1].toFixed(2)}
  ${getRSIInterpretation(indicators.rsi[indicators.rsi.length - 1])}

MACD: 
  Histogram: ${indicators.macd.histogram.toFixed(4)}
  Signal: ${indicators.macd.signal.toFixed(4)}
  MACD: ${indicators.macd.macd.toFixed(4)}
  ${getMACDInterpretation(indicators.macd.histogram)}

ATR(14): ${indicators.atr.toFixed(2)} (${indicators.atrPct.toFixed(2)}% of price)
  ${getATRInterpretation(indicators.atrPct)}

Bollinger Bands:
  Upper: $${indicators.bollinger.upper.toFixed(2)}
  Mid: $${indicators.bollinger.mid.toFixed(2)}
  Lower: $${indicators.bollinger.lower.toFixed(2)}
  Position: ${indicators.bollinger.position}

EMA Stack:
  EMA20: $${indicators.ema.ema20.toFixed(2)}
  EMA50: $${indicators.ema.ema50.toFixed(2)}
  EMA200: $${indicators.ema.ema200.toFixed(2)}
  Trend: ${indicators.ema.trend}

Volume:
  Current: ${indicators.volume.current.toFixed(0)}
  20-day Avg: ${indicators.volume.avg20.toFixed(0)}
  ${indicators.volume.pct.toFixed(0)}% of average ${indicators.volume.pct > 120 ? '(HIGH VOLUME)' : indicators.volume.pct < 80 ? '(LOW VOLUME)' : ''}

Key Levels (Pivot Points):
  R3: $${indicators.pivots.r3.toFixed(2)}
  R2: $${indicators.pivots.r2.toFixed(2)}
  R1: $${indicators.pivots.r1.toFixed(2)}
  S1: $${indicators.pivots.s1.toFixed(2)}
  S2: $${indicators.pivots.s2.toFixed(2)}
  S3: $${indicators.pivots.s3.toFixed(2)}

Recent Swing Points:
  ${indicators.swings.highs.length > 0 ? `Swing Highs: ${indicators.swings.highs.map(h => `$${h.price.toFixed(2)} (${h.date})`).join(', ')}` : ''}
  ${indicators.swings.lows.length > 0 ? `Swing Lows: ${indicators.swings.lows.map(l => `$${l.price.toFixed(2)} (${l.date})`).join(', ')}` : ''}
${buildLiquiditySection(agent.name, context.currentPrice, liquidityMap, volumeDelta)}
━━ MACRO REGIME ━━
Fed Rate: ${macro.fedRate.toFixed(2)}% (${macro.fedDirection})
CPI YoY: ${macro.cpi.toFixed(2)}% (${macro.cpiTrend})
GDP Growth: ${macro.gdp.toFixed(2)}%
Unemployment: ${macro.unemployment.toFixed(1)}%
Yield Curve: 10Y-2Y spread = ${macro.yieldSpread.toFixed(0)}bp
  ${macro.yieldInterpretation}
DXY: ${macro.dxy.toFixed(2)}
  Impact on ${context.asset}: ${macro.dxyImpact}
VIX: ${macro.vix.toFixed(2)} (${macro.vixRegime})

━━ ASSET-SPECIFIC CONTEXT ━━
${formatAssetSpecific(context)}

━━ HISTORICAL PATTERN MATCHING ━━
Most Similar Period: ${context.historicalPattern.similarPeriod}
Outcome: ${context.historicalPattern.outcome}
Base Rate: ${context.historicalPattern.winRate}% bullish in ${context.historicalPattern.sampleSize} similar cases

━━ RECENT NEWS ━━
${context.recentNews.length > 0 ? context.recentNews.join('\n') : 'No significant recent news'}

━━ YOUR PAST PERFORMANCE ON ${context.asset} ━━
Record: ${context.pastPerformance.winLossRecord}
Your Edge: ${context.pastPerformance.edgeDescription}
Calibration: ${context.pastPerformance.calibrationNote}

━━ YOUR PREDICTION ━━
Based on all the above context and staying true to your trading psychology as ${agent.name} (${agent.role}), provide your market prediction.

Return ONLY this JSON structure (no other text):
{
  "agent": "${agent.name}",
  "model": "${agent.model}",
  "action": "BUY | SELL | HOLD",
  "confidence": 1-10,
  "priceTarget": "e.g. +2.3% to $67,500",
  "stopLoss": "e.g. -1.1% at $64,200",
  "timeframe": "e.g. 4-8 hours",
  "reasoning": "3-4 sentences explaining your decision. Reference specific indicators and macro factors.",
  "keyRisk": "The one thing that would invalidate this thesis",
  "historicalAnalogy": "Reference to a similar past setup and what happened",
  "macroAlignment": "How the macro regime supports or contradicts this trade"
}`;
}

// ── Liquidity section — the core of what's new ────────────────────────────────

/**
 * Builds the ━━ LIQUIDITY & ORDER FLOW ━━ block.
 *
 * • No liquidityMap → empty string (fully backward-compatible)
 * • Jake Morrison   → full zone table reframed in order-flow vocabulary
 *                     (stop clusters, absorption, delta divergence)  +  volume delta
 * • Aisha Okonkwo  → same zone data reframed in SMC vocabulary
 *                     (OBs, FVGs, liquidity sweeps, BOS implications)
 * • All other agents → compact 2-line summary (nearest 3 zones each side)
 *                      + one-line volume delta
 */
function buildLiquiditySection(
  agentName:    string,
  currentPrice: number,
  map:          LiquidityMap | undefined,
  delta:        VolumeDeltaSummary | undefined,
): string {
  if (!map) return '';  // no data — section is silently omitted

  if (agentName === 'Jake Morrison') {
    return buildJakeSection(currentPrice, map, delta);
  }
  if (agentName === 'Aisha Okonkwo') {
    return buildAishaSection(currentPrice, map, delta);
  }
  return buildCompactSection(map, delta);
}

// ── Jake Morrison (Order Flow Specialist) ─────────────────────────────────────
// Framing: institutional footprint, absorption, stop-hunt targets, delta

function buildJakeSection(
  price: number,
  map:   LiquidityMap,
  delta: VolumeDeltaSummary | undefined,
): string {
  const dec = precisionFor(price);

  const renderZone = (z: LiquidityZone): string => {
    const absorptionFlag =
      z.tier === 'HIGH'   && z.strength > 0.75 ? ' ← HIGH ABSORPTION RISK'  :
      z.tier === 'MEDIUM' && z.strength > 0.65 ? ' ← WATCH FOR DELTA DIV'   :
      '';
    return (
      `  $${z.price.toFixed(dec)}` +
      `  | ${z.tier.padEnd(6)}` +
      `  | ${z.label.padEnd(12)}` +
      `  | str=${pct(z.strength)}` +
      `  | dist=${sign(z.distancePct)}%` +
      absorptionFlag
    );
  };

  const aboveRows = map.zonesAbove.slice(0, 8).map(renderZone).join('\n') || '  (none in range)';
  const belowRows = map.zonesBelow.slice(0, 8).map(renderZone).join('\n') || '  (none in range)';

  // Stop-hunt targets — HIGH-tier zones that institutions love to sweep
  const stopHunts = map.zonesAbove.concat(map.zonesBelow)
    .filter(z => z.tier === 'HIGH')
    .map(z => `  $${z.price.toFixed(dec)} (${sign(z.distancePct)}%) — ${Math.abs(z.distancePct) < 1.5 ? 'NEAR-TERM TARGET' : 'extended'}`)
    .join('\n') || '  none flagged';

  const deltaLine = delta
    ? `  ${delta.summary}`
    : '  Volume delta: not available';

  return `
━━ LIQUIDITY & ORDER FLOW (Jake) ━━
ATR: ${map.atr.toFixed(dec)} | Zones: round-number sweeps + Fib order blocks + ATR fair-value gaps

RESISTANCE LIQUIDITY — ${map.zonesAbove.length} zones above $${price.toFixed(dec)}:
${aboveRows}

SUPPORT LIQUIDITY — ${map.zonesBelow.length} zones below $${price.toFixed(dec)}:
${belowRows}

STOP-HUNT TARGETS (HIGH-tier clusters — likely institutional sweep points):
${stopHunts}

VOLUME DELTA (OHLC proxy — no tick feed required):
${deltaLine}

LEGEND: HIGH=stop cluster/equal H-L  MEDIUM=Fib order block  LOW=fair value gap
`;
}

// ── Aisha Okonkwo (Smart Money Concepts) ─────────────────────────────────────
// Framing: liquidity sweeps, OBs, FVGs, BOS/CHoCH implications

function buildAishaSection(
  price: number,
  map:   LiquidityMap,
  delta: VolumeDeltaSummary | undefined,
): string {
  const dec = precisionFor(price);

  // Remap tiers to SMC terminology
  const smcLabel = (z: LiquidityZone): string => {
    if (z.tier === 'HIGH')   return 'LIQUIDITY POOL';
    if (z.tier === 'MEDIUM') return z.distancePct > 0 ? 'BEARISH OB' : 'BULLISH OB';
    return z.distancePct > 0 ? 'SELL-SIDE FVG' : 'BUY-SIDE FVG';
  };

  const renderZone = (z: LiquidityZone): string =>
    `  $${z.price.toFixed(dec)}` +
    `  | ${smcLabel(z).padEnd(14)}` +
    `  | str=${pct(z.strength)}` +
    `  | dist=${sign(z.distancePct)}%`;

  const sellSide = map.zonesAbove.slice(0, 8).map(renderZone).join('\n') || '  (none in range)';
  const buySide  = map.zonesBelow.slice(0, 8).map(renderZone).join('\n') || '  (none in range)';

  // Nearest FVGs — most actionable for Aisha's style
  const nearFVGAbove = map.zonesAbove.find(z => z.label === 'FVG');
  const nearFVGBelow = map.zonesBelow.find(z => z.label === 'FVG');
  const fvgNotes = [
    nearFVGAbove ? `  SELL-SIDE FVG at $${nearFVGAbove.price.toFixed(dec)} (+${Math.abs(nearFVGAbove.distancePct).toFixed(2)}%) — imbalance; price likely drawn here` : null,
    nearFVGBelow ? `  BUY-SIDE  FVG at $${nearFVGBelow.price.toFixed(dec)} (-${Math.abs(nearFVGBelow.distancePct).toFixed(2)}%) — confluence point for BOS/CHoCH watch` : null,
  ].filter(Boolean).join('\n') || '  none in immediate range';

  const deltaLine = delta
    ? `  ${delta.summary}`
    : '  Volume delta: not available';

  return `
━━ LIQUIDITY & SMART MONEY CONCEPTS (Aisha) ━━
ATR: ${map.atr.toFixed(dec)} | Zones: round-number sweeps + Fib OBs + ATR FVGs

SELL-SIDE LIQUIDITY (above price — ${map.zonesAbove.length} zones):
${sellSide}

BUY-SIDE LIQUIDITY (below price — ${map.zonesBelow.length} zones):
${buySide}

NEAREST FVG IMBALANCES:
${fvgNotes}

VOLUME DELTA:
${deltaLine}

LEGEND: LIQUIDITY POOL=equal H/L sweep target  BEARISH/BULLISH OB=Fib order block  FVG=imbalance
`;
}

// ── All other agents — compact summary ────────────────────────────────────────

function buildCompactSection(
  map:   LiquidityMap,
  delta: VolumeDeltaSummary | undefined,
): string {
  const dec = precisionFor(map.currentPrice);
  const fmt = (z: LiquidityZone) =>
    `$${z.price.toFixed(dec)} (${sign(z.distancePct)}%, ${z.tier})`;

  const above = map.zonesAbove.slice(0, 3).map(fmt).join(' | ') || 'none';
  const below = map.zonesBelow.slice(0, 3).map(fmt).join(' | ') || 'none';

  const deltaLine = delta ? delta.summary : 'Volume delta: not available';

  return `
━━ LIQUIDITY & ORDER FLOW ━━
Above (nearest 3): ${above}
Below (nearest 3): ${below}
${deltaLine}
`;
}

// ── Original helper functions — verbatim from original file ───────────────────

function getRSIInterpretation(rsi: number): string {
  if (rsi > 70) return 'OVERBOUGHT - potential reversal zone';
  if (rsi < 30) return 'OVERSOLD - potential bounce zone';
  if (rsi > 50) return 'Bullish momentum';
  return 'Bearish momentum';
}

function getMACDInterpretation(histogram: number): string {
  if (histogram > 0) return 'Bullish crossover - upward momentum';
  return 'Bearish crossover - downward momentum';
}

function getATRInterpretation(atrPct: number): string {
  if (atrPct > 3) return 'High volatility - expect larger price swings';
  if (atrPct < 1.5) return 'Low volatility - tight range';
  return 'Normal volatility';
}

function formatAssetSpecific(context: AgentContext): string {
  const specific = context.assetSpecific;
  const lines: string[] = [];

  if (specific.btcDominance !== undefined) {
    lines.push(`BTC Dominance: ${specific.btcDominance.toFixed(2)}%`);
  }
  if (specific.fearGreedIndex !== undefined) {
    const sentiment =
      specific.fearGreedIndex > 70 ? 'EXTREME GREED' :
      specific.fearGreedIndex < 30 ? 'EXTREME FEAR'  : 'NEUTRAL';
    lines.push(`Fear & Greed Index: ${specific.fearGreedIndex} (${sentiment})`);
  }
  if (specific.exchangeFlows) {
    lines.push(`Exchange Flows: ${specific.exchangeFlows}`);
  }
  if (specific.cotPositioning) {
    lines.push(`COT Positioning: ${specific.cotPositioning}`);
  }
  if (specific.rateDifferential !== undefined) {
    lines.push(`Rate Differential: ${specific.rateDifferential.toFixed(2)}%`);
  }
  if (specific.realYield !== undefined) {
    lines.push(
      `Real Yield: ${specific.realYield.toFixed(2)}% ` +
      `${specific.realYield < 0 ? '(Negative - bullish for gold)' : '(Positive - bearish for gold)'}`
    );
  }

  return lines.length > 0 ? lines.join('\n') : 'No specific context available';
}

// ── Debate prompt — verbatim from original file ───────────────────────────────

export function buildDebatePrompt(
  agent:          AgentDefinition,
  initialVerdict: any,
  allVerdicts:    any[],
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are ${agent.name}, a ${agent.role}.

You previously gave your market prediction. Now you will review what the other 5 agents concluded and decide whether to hold or update your position.

Return ONLY valid JSON. No preamble.`;

  const otherVerdicts = allVerdicts
    .filter(v => v.agent !== agent.name)
    .map(v =>
      `- ${v.agent} (${v.role}): ${v.action} with ${v.confidence}/10 confidence\n` +
      `  Reasoning: "${v.reasoning}"`
    )
    .join('\n\n');

  const userPrompt = `You gave your initial verdict:
Action: ${initialVerdict.action}
Confidence: ${initialVerdict.confidence}/10
Reasoning: "${initialVerdict.reasoning}"

Here is what the other 5 agents concluded:

${otherVerdicts}

━━ DEBATE ROUND ━━
Review their reasoning carefully. Consider:
1. Do they see risks you missed?
2. Are they overweighting factors you think are less important?
3. Is there consensus forming around a position different from yours?
4. Would your trading psychology naturally agree or disagree with their views?

You may:
- HOLD your position (explain why you still disagree)
- UPDATE your position (explain what changed your mind)
- MODERATE your confidence up or down

Return ONLY this JSON:
{
  "agent": "${agent.name}",
  "finalAction": "BUY | SELL | HOLD",
  "finalConfidence": 1-10,
  "positionChanged": true/false,
  "debateResponse": "2-3 sentences. Did anyone change your mind? Why or why not? Reference specific agents by name."
}`;

  return { systemPrompt, userPrompt };
}

// ── Micro-helpers ─────────────────────────────────────────────────────────────

function precisionFor(price: number): number {
  if (price > 50_000) return 0;
  if (price > 999)    return 1;
  if (price > 9)      return 2;
  return 5;
}

function isEnriched(ctx: AgentContext | EnrichedAgentContext): ctx is EnrichedAgentContext {
  return 'liquidityMap' in ctx && ctx.liquidityMap !== undefined;
}

function pct(v: number): string { return `${(v * 100).toFixed(0)}%`; }
function sign(v: number): string { return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2); }
