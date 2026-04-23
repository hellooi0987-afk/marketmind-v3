// lib/indicators.ts - Compute technical indicators from OHLC data

import { 
  RSI, 
  MACD, 
  ATR, 
  BollingerBands, 
  EMA, 
  SMA 
} from 'technicalindicators';
import { OHLCData, TechnicalIndicators } from '@/types';

export function computeIndicators(
  ohlcData: OHLCData[],
  currentPrice: number
): TechnicalIndicators {
  const closes = ohlcData.map(d => d.close);
  const highs = ohlcData.map(d => d.high);
  const lows = ohlcData.map(d => d.low);
  const volumes = ohlcData.map(d => d.volume);
  
  // RSI(14)
  const rsiValues = RSI.calculate({ 
    values: closes, 
    period: 14 
  });
  const rsi = rsiValues.slice(-3);
  
  // MACD(12,26,9)
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const latestMacd = macdValues[macdValues.length - 1];
  
  // ATR(14)
  const atrValues = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
  });
  const atr = atrValues[atrValues.length - 1];
  const atrPct = (atr / currentPrice) * 100;
  
  // Bollinger Bands(20,2)
  const bbValues = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });
  const latestBB = bbValues[bbValues.length - 1];
  
  let bbPosition = 'mid';
  if (currentPrice > latestBB.upper) bbPosition = 'above upper';
  else if (currentPrice < latestBB.lower) bbPosition = 'below lower';
  else if (currentPrice > latestBB.middle) bbPosition = 'upper half';
  else bbPosition = 'lower half';
  
  // EMAs
  const ema20Values = EMA.calculate({ period: 20, values: closes });
  const ema50Values = EMA.calculate({ period: 50, values: closes });
  const ema200Values = EMA.calculate({ period: 200, values: closes });
  
  const ema20 = ema20Values[ema20Values.length - 1];
  const ema50 = ema50Values[ema50Values.length - 1];
  const ema200 = ema200Values[ema200Values.length - 1];
  
  let emaTrend = '';
  if (currentPrice > ema20 && ema20 > ema50 && ema50 > ema200) {
    emaTrend = 'Strong bullish - price above all EMAs';
  } else if (currentPrice < ema20 && ema20 < ema50 && ema50 < ema200) {
    emaTrend = 'Strong bearish - price below all EMAs';
  } else if (currentPrice > ema200) {
    emaTrend = 'Bullish - price above 200 EMA';
  } else {
    emaTrend = 'Bearish - price below 200 EMA';
  }
  
  // Volume
  const volSma = SMA.calculate({ period: 20, values: volumes });
  const volAvg = volSma[volSma.length - 1];
  const currentVol = volumes[volumes.length - 1];
  const volPct = (currentVol / volAvg) * 100;
  
  // Pivot Points (using yesterday's data)
  const yesterday = ohlcData[ohlcData.length - 2];
  const pivot = (yesterday.high + yesterday.low + yesterday.close) / 3;
  const r1 = 2 * pivot - yesterday.low;
  const r2 = pivot + (yesterday.high - yesterday.low);
  const r3 = r1 + (yesterday.high - yesterday.low);
  const s1 = 2 * pivot - yesterday.high;
  const s2 = pivot - (yesterday.high - yesterday.low);
  const s3 = s1 - (yesterday.high - yesterday.low);
  
  // Swing highs and lows (simplified - last 3 local extremes)
  const swings = findSwingPoints(ohlcData);
  
  return {
    rsi,
    macd: {
      histogram: latestMacd.histogram || 0,
      signal: latestMacd.signal || 0,
      macd: latestMacd.MACD || 0,
    },
    atr,
    atrPct,
    bollinger: {
      upper: latestBB.upper,
      mid: latestBB.middle,
      lower: latestBB.lower,
      position: bbPosition,
    },
    ema: {
      ema20,
      ema50,
      ema200,
      trend: emaTrend,
    },
    volume: {
      current: currentVol,
      avg20: volAvg,
      pct: volPct,
    },
    pivots: {
      r3,
      r2,
      r1,
      s1,
      s2,
      s3,
    },
    swings,
  };
}

function findSwingPoints(ohlcData: OHLCData[]): {
  highs: Array<{ price: number; date: string }>;
  lows: Array<{ price: number; date: string }>;
} {
  const highs: Array<{ price: number; date: string }> = [];
  const lows: Array<{ price: number; date: string }> = [];
  const window = 5;
  
  for (let i = window; i < ohlcData.length - window; i++) {
    const current = ohlcData[i];
    
    // Check if it's a swing high
    let isSwingHigh = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && ohlcData[j].high >= current.high) {
        isSwingHigh = false;
        break;
      }
    }
    
    if (isSwingHigh) {
      highs.push({
        price: current.high,
        date: new Date(current.timestamp).toISOString().split('T')[0],
      });
    }
    
    // Check if it's a swing low
    let isSwingLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && ohlcData[j].low <= current.low) {
        isSwingLow = false;
        break;
      }
    }
    
    if (isSwingLow) {
      lows.push({
        price: current.low,
        date: new Date(current.timestamp).toISOString().split('T')[0],
      });
    }
  }
  
  return {
    highs: highs.slice(-3),
    lows: lows.slice(-3),
  };
}
