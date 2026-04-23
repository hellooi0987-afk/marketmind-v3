// lib/vector.ts - Upstash Vector DB for agent memory

import { Index } from '@upstash/vector';

let vectorIndex: Index | null = null;

export function getVectorIndex(): Index {
  if (!vectorIndex) {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    
    if (!url || !token) {
      throw new Error('Missing Upstash Vector credentials');
    }
    
    vectorIndex = new Index({
      url,
      token,
    });
  }
  
  return vectorIndex;
}

export interface AgentMemoryEntry {
  id: string;
  agent: string;
  asset: string;
  timestamp: number;
  prediction: {
    action: string;
    confidence: number;
    priceTarget: string;
    reasoning: string;
  };
  outcome?: {
    actual: string;
    correct: boolean;
    pnl?: number;
  };
  context: {
    price: number;
    indicators: any;
    macroRegime: string;
  };
}

export interface AgentMemoryDict {
  [key: string]: string | number | boolean | null | undefined | Record<string, any>;
}

export async function saveAgentMemory(
  entry: AgentMemoryEntry,
  embedding: number[]
): Promise<void> {
  const index = getVectorIndex();
  
  const metadata: AgentMemoryDict = {
    id: entry.id,
    agent: entry.agent,
    asset: entry.asset,
    timestamp: entry.timestamp,
    predictionAction: entry.prediction.action,
    predictionConfidence: entry.prediction.confidence,
    predictionPriceTarget: entry.prediction.priceTarget,
    predictionReasoning: entry.prediction.reasoning,
    contextPrice: entry.context.price,
    contextMacroRegime: entry.context.macroRegime,
    outcomeActual: entry.outcome?.actual,
    outcomeCorrect: entry.outcome?.correct,
    outcomePnl: entry.outcome?.pnl,
  };

  await index.upsert({
    id: entry.id,
    vector: embedding,
    metadata,
  });
}

export async function queryAgentMemory(
  agent: string,
  asset: string,
  embedding: number[],
  topK: number = 10
): Promise<AgentMemoryEntry[]> {
  const index = getVectorIndex();
  
  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter: `agent = '${agent}' AND asset = '${asset}'`,
  });
  
  return results.map((r: any) => r.metadata as AgentMemoryEntry);
}

export async function getAgentPerformance(
  agent: string,
  asset: string
): Promise<{
  totalPredictions: number;
  correctPredictions: number;
  winRate: number;
  avgConfidence: number;
  calibration: string;
}> {
  const index = getVectorIndex();
  
  const results = await index.query({
    vector: Array(1536).fill(0),
    topK: 100,
    includeMetadata: true,
    filter: `agent = '${agent}' AND asset = '${asset}'`,
  });
  
  const memories = results.map((r: any) => r.metadata as AgentMemoryEntry);
  const completedPredictions = memories.filter(m => m.outcome);
  
  const totalPredictions = completedPredictions.length;
  const correctPredictions = completedPredictions.filter(m => m.outcome?.correct).length;
  const winRate = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
  
  const avgConfidence = completedPredictions.reduce((sum, m) => 
    sum + m.prediction.confidence, 0
  ) / (totalPredictions || 1);
  
  let calibration = 'Insufficient data';
  if (totalPredictions >= 10) {
    const diff = Math.abs(avgConfidence * 10 - winRate);
    if (diff < 10) calibration = 'Well calibrated';
    else if (avgConfidence * 10 > winRate) calibration = 'Overconfident';
    else calibration = 'Underconfident';
  }
  
  return {
    totalPredictions,
    correctPredictions,
    winRate,
    avgConfidence,
    calibration,
  };
}
