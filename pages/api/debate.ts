// pages/api/debate.ts - Multi-round agent debate and communication

import type { NextApiRequest, NextApiResponse } from 'next';
import { AGENTS } from '@/lib/agents';
import { buildDebatePrompt } from '@/lib/prompt-builder';
import { callAgent, parseDebateResponse } from '@/lib/ai-models';
import { AgentVerdict, DebateResponse } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { asset, verdicts, rounds = 1 } = req.body;

    if (!asset || !verdicts || !Array.isArray(verdicts)) {
      return res.status(400).json({ 
        error: 'Missing required fields: asset, verdicts' 
      });
    }

    console.log(`Starting debate for ${asset} with ${rounds} round(s)`);

    let currentVerdicts = [...verdicts];
    const debateHistory: any[] = [];

    // Run multiple debate rounds if requested
    for (let round = 1; round <= rounds; round++) {
      console.log(`━━━ Debate Round ${round} ━━━`);

      const roundResults = await runDebateRound(currentVerdicts, round);
      
      debateHistory.push({
        round,
        responses: roundResults.responses,
        positionChanges: roundResults.positionChanges,
        consensusShift: roundResults.consensusShift,
      });

      // Update verdicts with debate outcomes
      currentVerdicts = updateVerdictsAfterDebate(currentVerdicts, roundResults.responses);

      console.log(`Round ${round} complete. Position changes: ${roundResults.positionChanges}`);
    }

    // Calculate final consensus
    const finalConsensus = calculateFinalConsensus(currentVerdicts);

    // Identify key turning points
    const turningPoints = identifyTurningPoints(verdicts, currentVerdicts, debateHistory);

    return res.status(200).json({
      asset,
      initialVerdicts: verdicts,
      finalVerdicts: currentVerdicts,
      debateHistory,
      finalConsensus,
      turningPoints,
      totalRounds: rounds,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/debate:', error);
    return res.status(500).json({ 
      error: 'Debate failed',
      details: error.message 
    });
  }
}

async function runDebateRound(
  verdicts: any[],
  roundNumber: number
): Promise<{
  responses: DebateResponse[];
  positionChanges: number;
  consensusShift: string;
}> {
  const initialConsensus = calculateActionBreakdown(verdicts);

  // Each agent reviews all other agents' positions
  const debatePromises = AGENTS.map(async (agent) => {
    const agentVerdict = verdicts.find(v => v.agent === agent.name);
    
    if (!agentVerdict) {
      throw new Error(`Missing verdict for agent ${agent.name}`);
    }

    try {
      console.log(`  ${agent.name} reviewing positions...`);

      // Build debate prompt with all other agents' verdicts
      const { systemPrompt, userPrompt } = buildDebatePrompt(
        agent,
        agentVerdict,
        verdicts
      );

      // Call AI model for debate response
      const response = await callAgent(agent.model, userPrompt, systemPrompt);

      // Parse debate response
      const debateResponse = parseDebateResponse(response);

      console.log(`  ✓ ${agent.name}: ${debateResponse.positionChanged ? 'CHANGED' : 'HELD'} (${agentVerdict.action} → ${debateResponse.finalAction})`);

      return debateResponse;
    } catch (error: any) {
      console.error(`  ✗ ${agent.name} debate error:`, error);
      
      // Return fallback - agent holds position on error
      return {
        agent: agent.name,
        finalAction: agentVerdict.action,
        finalConfidence: agentVerdict.confidence,
        positionChanged: false,
        debateResponse: `Unable to participate in round ${roundNumber} due to error.`,
      };
    }
  });

  const responses = await Promise.all(debatePromises);

  // Count position changes
  const positionChanges = responses.filter(r => r.positionChanged).length;

  // Calculate consensus shift
  const finalConsensus = calculateActionBreakdown(
    responses.map(r => ({ action: r.finalAction }))
  );

  const consensusShift = describeConsensusShift(initialConsensus, finalConsensus);

  return {
    responses,
    positionChanges,
    consensusShift,
  };
}

function updateVerdictsAfterDebate(
  verdicts: any[],
  debateResponses: DebateResponse[]
): any[] {
  return verdicts.map(verdict => {
    const debateResponse = debateResponses.find(r => r.agent === verdict.agent);
    
    if (!debateResponse) return verdict;

    return {
      ...verdict,
      action: debateResponse.finalAction,
      confidence: debateResponse.finalConfidence,
      positionChanged: debateResponse.positionChanged,
      debateResponse: debateResponse.debateResponse,
    };
  });
}

function calculateActionBreakdown(items: any[]): { buy: number; sell: number; hold: number } {
  return {
    buy: items.filter(v => v.action === 'BUY').length,
    sell: items.filter(v => v.action === 'SELL').length,
    hold: items.filter(v => v.action === 'HOLD').length,
  };
}

function describeConsensusShift(
  before: { buy: number; sell: number; hold: number },
  after: { buy: number; sell: number; hold: number }
): string {
  const buyDiff = after.buy - before.buy;
  const sellDiff = after.sell - before.sell;
  const holdDiff = after.hold - before.hold;

  if (buyDiff === 0 && sellDiff === 0 && holdDiff === 0) {
    return 'No consensus shift';
  }

  const shifts: string[] = [];
  if (buyDiff > 0) shifts.push(`+${buyDiff} to BUY`);
  if (buyDiff < 0) shifts.push(`${buyDiff} from BUY`);
  if (sellDiff > 0) shifts.push(`+${sellDiff} to SELL`);
  if (sellDiff < 0) shifts.push(`${sellDiff} from SELL`);
  if (holdDiff > 0) shifts.push(`+${holdDiff} to HOLD`);
  if (holdDiff < 0) shifts.push(`${holdDiff} from HOLD`);

  return shifts.join(', ');
}

function calculateFinalConsensus(verdicts: any[]): {
  signal: string;
  strength: number;
  breakdown: { buy: number; sell: number; hold: number };
  highConfidenceCount: number;
  averageConfidence: number;
} {
  const breakdown = calculateActionBreakdown(verdicts);

  let signal = 'HOLD';
  if (breakdown.buy > breakdown.sell && breakdown.buy > breakdown.hold) {
    signal = 'BUY';
  } else if (breakdown.sell > breakdown.buy && breakdown.sell > breakdown.hold) {
    signal = 'SELL';
  }

  const maxVotes = Math.max(breakdown.buy, breakdown.sell, breakdown.hold);
  const strength = (maxVotes / verdicts.length) * 100;

  const highConfidenceCount = verdicts.filter(v => v.confidence >= 7).length;
  const averageConfidence = verdicts.reduce((sum, v) => sum + v.confidence, 0) / verdicts.length;

  return {
    signal,
    strength,
    breakdown,
    highConfidenceCount,
    averageConfidence,
  };
}

function identifyTurningPoints(
  initialVerdicts: any[],
  finalVerdicts: any[],
  debateHistory: any[]
): Array<{
  agent: string;
  round: number;
  change: string;
  reasoning: string;
}> {
  const turningPoints: Array<{
    agent: string;
    round: number;
    change: string;
    reasoning: string;
  }> = [];

  finalVerdicts.forEach(finalVerdict => {
    const initialVerdict = initialVerdicts.find(v => v.agent === finalVerdict.agent);
    
    if (initialVerdict && initialVerdict.action !== finalVerdict.action) {
      // Find which round the change happened
      for (let i = 0; i < debateHistory.length; i++) {
        const roundResponse = debateHistory[i].responses.find(
          (r: DebateResponse) => r.agent === finalVerdict.agent
        );
        
        if (roundResponse && roundResponse.positionChanged) {
          turningPoints.push({
            agent: finalVerdict.agent,
            round: i + 1,
            change: `${initialVerdict.action} → ${roundResponse.finalAction}`,
            reasoning: roundResponse.debateResponse,
          });
          break;
        }
      }
    }
  });

  return turningPoints;
}
