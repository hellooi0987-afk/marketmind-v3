// pages/api/memory.ts - Agent memory read/write

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAgentPerformance, saveAgentMemory, AgentMemoryEntry } from '@/lib/vector';
import { generateEmbedding } from '@/lib/ai-models';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    return handleGetMemory(req, res);
  } else if (req.method === 'POST') {
    return handleSaveMemory(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetMemory(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { agent, asset } = req.query;

    if (!agent || !asset) {
      return res.status(400).json({ 
        error: 'Missing required parameters: agent, asset' 
      });
    }

    console.log(`Fetching memory for ${agent} on ${asset}`);

    const performance = await getAgentPerformance(
      agent as string,
      asset as string
    );

    return res.status(200).json({
      agent,
      asset,
      performance,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching memory:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch memory',
      details: error.message 
    });
  }
}

async function handleSaveMemory(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { agent, asset, prediction, outcome, context } = req.body;

    if (!agent || !asset || !prediction) {
      return res.status(400).json({ 
        error: 'Missing required fields: agent, asset, prediction' 
      });
    }

    console.log(`Saving memory for ${agent} on ${asset}`);

    // Generate embedding from prediction reasoning
    const embeddingText = `${prediction.reasoning} ${prediction.priceTarget} ${prediction.keyRisk}`;
    const embedding = await generateEmbedding(embeddingText);

    // Create memory entry
    const memoryEntry: AgentMemoryEntry = {
      id: `${agent}-${asset}-${Date.now()}`,
      agent,
      asset,
      timestamp: Date.now(),
      prediction,
      outcome,
      context,
    };

    // Save to vector DB
    await saveAgentMemory(memoryEntry, embedding);

    return res.status(200).json({
      success: true,
      memoryId: memoryEntry.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error saving memory:', error);
    return res.status(500).json({ 
      error: 'Failed to save memory',
      details: error.message 
    });
  }
}
