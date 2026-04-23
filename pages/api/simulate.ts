// pages/api/simulate.ts - Run all 6 agents in parallel

import type { NextApiRequest, NextApiResponse } from 'next';
import { AGENTS } from '@/lib/agents';
import { buildAgentPrompt } from '@/lib/prompt-builder';
import { callAgent, parseAgentResponse, generateEmbedding } from '@/lib/ai-models';
import { saveAgentMemory } from '@/lib/vector';
import { AgentContext, AgentVerdict } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { asset, agentContexts } = req.body;

    if (!asset || !agentContexts) {
      return res.status(400).json({ 
        error: 'Missing required fields: asset, agentContexts' 
      });
    }

    console.log(`Running simulation for ${asset} with ${AGENTS.length} agents`);

    // Run all agents in parallel
    const agentPromises = AGENTS.map(async (agent) => {
      const context = agentContexts[agent.name] as AgentContext;
      
      if (!context) {
        throw new Error(`Missing context for agent ${agent.name}`);
      }

      console.log(`Starting ${agent.name} (${agent.model})...`);

      try {
        // Build prompts
        const { systemPrompt, userPrompt } = buildAgentPrompt(agent, context);

        // Call AI model
        const response = await callAgent(agent.model, userPrompt, systemPrompt);

        // Parse response
        const verdict = parseAgentResponse(response);

        // Add role info
        const verdictWithRole = {
          ...verdict,
          role: agent.role,
          focusAreas: agent.focusAreas,
        };

        console.log(`✓ ${agent.name} complete: ${verdict.action} (${verdict.confidence}/10)`);

        // Save to memory (async, don't block)
        saveAgentMemoryAsync(agent.name, asset, context, verdict);

        return verdictWithRole;
      } catch (error: any) {
        console.error(`Error with agent ${agent.name}:`, error);
        
        // Return fallback verdict on error
        return {
          agent: agent.name,
          model: agent.model,
          role: agent.role,
          action: 'HOLD' as const,
          confidence: 1,
          priceTarget: 'Error - no prediction',
          stopLoss: 'N/A',
          timeframe: 'N/A',
          reasoning: `Agent encountered an error: ${error.message}`,
          keyRisk: 'System error',
          historicalAnalogy: 'N/A',
          macroAlignment: 'N/A',
          focusAreas: agent.focusAreas,
          error: true,
        };
      }
    });

    // Wait for all agents to complete
    const verdicts = await Promise.all(agentPromises);

    // Calculate consensus
    const consensus = calculateConsensus(verdicts);

    // Calculate agreement metrics
    const agreement = calculateAgreement(verdicts);

    return res.status(200).json({
      asset,
      verdicts,
      consensus,
      agreement,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/simulate:', error);
    return res.status(500).json({ 
      error: 'Simulation failed',
      details: error.message 
    });
  }
}

function calculateConsensus(verdicts: any[]): {
  signal: string;
  strength: number;
  breakdown: { buy: number; sell: number; hold: number };
  averageConfidence: number;
} {
  const breakdown = {
    buy: verdicts.filter(v => v.action === 'BUY').length,
    sell: verdicts.filter(v => v.action === 'SELL').length,
    hold: verdicts.filter(v => v.action === 'HOLD').length,
  };

  let signal = 'HOLD';
  if (breakdown.buy > breakdown.sell && breakdown.buy > breakdown.hold) {
    signal = 'BUY';
  } else if (breakdown.sell > breakdown.buy && breakdown.sell > breakdown.hold) {
    signal = 'SELL';
  }

  const maxVotes = Math.max(breakdown.buy, breakdown.sell, breakdown.hold);
  const strength = (maxVotes / verdicts.length) * 100;

  const averageConfidence = verdicts.reduce((sum, v) => sum + v.confidence, 0) / verdicts.length;

  return {
    signal,
    strength,
    breakdown,
    averageConfidence,
  };
}

function calculateAgreement(verdicts: any[]): {
  highConsensus: boolean;
  dissenting: string[];
  unanimous: boolean;
} {
  const actions = verdicts.map(v => v.action);
  const uniqueActions = new Set(actions);
  
  const unanimous = uniqueActions.size === 1;
  const highConsensus = actions.filter(a => a === actions[0]).length >= 5;
  
  // Find dissenting agents
  const majorityAction = actions.sort((a, b) =>
    actions.filter(v => v === a).length - actions.filter(v => v === b).length
  ).pop();
  
  const dissenting = verdicts
    .filter(v => v.action !== majorityAction)
    .map(v => v.agent);

  return {
    highConsensus,
    dissenting,
    unanimous,
  };
}

// Async memory save (don't block response)
async function saveAgentMemoryAsync(
  agentName: string,
  asset: string,
  context: AgentContext,
  verdict: AgentVerdict
) {
  try {
    // Generate embedding from reasoning
    const embedding = await generateEmbedding(
      `${verdict.reasoning} ${verdict.macroAlignment} ${verdict.historicalAnalogy}`
    );

    // Save to vector DB
    await saveAgentMemory(
      {
        id: `${agentName}-${asset}-${Date.now()}`,
        agent: agentName,
        asset,
        timestamp: Date.now(),
        prediction: {
          action: verdict.action,
          confidence: verdict.confidence,
          priceTarget: verdict.priceTarget,
          reasoning: verdict.reasoning,
        },
        context: {
          price: context.currentPrice,
          indicators: context.indicators,
          macroRegime: `Fed ${context.macro.fedRate}%, CPI ${context.macro.cpi}%, VIX ${context.macro.vix}`,
        },
      },
      embedding
    );

    console.log(`Saved memory for ${agentName} on ${asset}`);
  } catch (error) {
    console.error(`Failed to save memory for ${agentName}:`, error);
  }
}
