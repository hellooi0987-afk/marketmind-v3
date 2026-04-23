// types/index.ts - Core type definitions for MarketMind v3
// Additions vs original:
//   • LiquidityZone, LiquidityTier, LiquidityLabel, LiquidityMap
//   • VolumeDeltaSummary
//   • EnrichedAgentContext  ← what /api/ingest now builds and returns;
//     keeps AgentContext untouched so debate.ts / simulate.ts etc. still compile

export type Asset = 'BTCUSD' | 'ETHUSD' | 'XAUUSD' | 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'SPX500' | 'CRUDE';

export type AgentAction = 'BUY' | 'SELL' | 'HOLD';

export type AgentModel = 'claude-3-5-sonnet-20241022' | 'gpt-4o' | 'gemini-1.5-pro';

export interface OHLCData {
  timestamp: number;
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
}

export interface TechnicalIndicators {
  rsi: number[];
  macd: {
    histogram: number;
    signal:    number;
    macd:      number;
  };
  atr:    number;
  atrPct: number;
  bollinger: {
    upper:    number;
    mid:      number;
    lower:    number;
    position: string;
  };
  ema: {
    ema20:  number;
    ema50:  number;
    ema200: number;
    trend:  string;
  };
  volume: {
    current: number;
    avg20:   number;
    pct:     number;
  };
  pivots: {
    r3: number;
    r2: number;
    r1: number;
    s1: number;
    s2: number;
    s3: number;
  };
  swings: {
    highs: Array<{ price: number; date: string }>;
    lows:  Array<{ price: number; date: string }>;
  };
}

export interface MacroData {
  fedRate:            number;
  fedDirection:       string;
  cpi:                number;
  cpiTrend:           string;
  gdp:                number;
  unemployment:       number;
  yieldSpread:        number;
  yieldInterpretation:string;
  dxy:                number;
  dxyImpact:          string;
  vix:                number;
  vixRegime:          string;
}

export interface AssetSpecificContext {
  btcDominance?:   number;
  fearGreedIndex?: number;
  exchangeFlows?:  string;
  cotPositioning?: string;
  rateDifferential?: number;
  realYield?:      number;
}

export interface HistoricalPattern {
  similarPeriod: string;
  outcome:       string;
  winRate:       number;
  sampleSize:    number;
}

// ── Original AgentContext — unchanged so existing callers keep compiling ──────
export interface AgentContext {
  asset:         Asset;
  timeframe:     string;
  analysisDate:  string;
  currentPrice:  number;
  change24h:     number;
  source:        string;
  indicators:    TechnicalIndicators;
  macro:         MacroData;
  assetSpecific: AssetSpecificContext;
  historicalPattern: HistoricalPattern;
  recentNews:    string[];
  pastPerformance: {
    winLossRecord:    string;
    edgeDescription:  string;
    calibrationNote:  string;
  };
}

// ── Liquidity types (new) ─────────────────────────────────────────────────────
export type LiquidityTier  = 'HIGH' | 'MEDIUM' | 'LOW';
export type LiquidityLabel = 'STOP CLUSTER' | 'ORDER BLOCK' | 'FVG';

export interface LiquidityZone {
  price:       number;
  strength:    number;   // 0–1
  tier:        LiquidityTier;
  label:       LiquidityLabel;
  distancePct: number;   // positive = above current price
}

export interface LiquidityMap {
  asset:        Asset;
  currentPrice: number;
  atr:          number;
  zonesAbove:   LiquidityZone[];
  zonesBelow:   LiquidityZone[];
  summary:      string;
}

// ── Volume delta (new) ────────────────────────────────────────────────────────
export interface VolumeDeltaSummary {
  cumulativeDelta: number;
  lastBarDelta:    number;
  barsUsed:        number;
  trend:           'BULLISH' | 'BEARISH' | 'NEUTRAL';
  summary:         string;
}

// ── EnrichedAgentContext — what /api/ingest builds, and what prompt-builder
//    and /api/debate receive.  Extends AgentContext so the spread operator
//    in ingest.ts is the only change needed there. ────────────────────────────
export interface EnrichedAgentContext extends AgentContext {
  liquidityMap:  LiquidityMap;
  volumeDelta:   VolumeDeltaSummary;
}

// ── Unchanged from original below this line ───────────────────────────────────

export interface AgentVerdict {
  agent:            string;
  model:            AgentModel;
  action:           AgentAction;
  confidence:       number;
  priceTarget:      string;
  stopLoss:         string;
  timeframe:        string;
  reasoning:        string;
  keyRisk:          string;
  historicalAnalogy:string;
  macroAlignment:   string;
}

export interface DebateResponse {
  agent:           string;
  finalAction:     AgentAction;
  finalConfidence: number;
  positionChanged: boolean;
  debateResponse:  string;
}

export interface AgentDefinition {
  name:        string;
  model:       AgentModel;
  role:        string;
  psychology:  string;
  focusAreas:  string[];
}

export interface BacktestResult {
  agent:        string;
  winRate:      number;
  avgWin:       number;
  avgLoss:      number;
  sharpeRatio:  number;
  maxDrawdown:  number;
  totalTrades:  number;
  bestRegime:   string;
  worstRegime:  string;
  tradeLog: Array<{
    date:   string;
    action: AgentAction;
    entry:  number;
    exit:   number;
    pnl:    number;
    regime: string;
  }>;
}

export interface ConsensusSignal {
  signal:      AgentAction;
  strength:    number;   // 0-100
  agreement:   number;   // number of agents agreeing
  totalAgents: number;
  breakdown: {
    buy:  number;
    sell: number;
    hold: number;
  };
}
