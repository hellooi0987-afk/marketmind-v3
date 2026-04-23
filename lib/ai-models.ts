// lib/ai-models.ts - AI model clients for agent reasoning

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentModel, AgentVerdict, DebateResponse } from '@/types';

// Initialize AI clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export async function callAgent(
  model: AgentModel,
  prompt: string,
  systemPrompt: string
): Promise<string> {
  try {
    if (model === 'claude-3-5-sonnet-20241022') {
      return await callClaude(prompt, systemPrompt);
    } else if (model === 'gpt-4o') {
      return await callGPT4o(prompt, systemPrompt);
    } else if (model === 'gemini-1.5-pro') {
      return await callGemini(prompt, systemPrompt);
    } else {
      throw new Error(`Unsupported model: ${model}`);
    }
  } catch (error) {
    console.error(`Error calling ${model}:`, error);
    throw error;
  }
}

async function callClaude(prompt: string, systemPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  
  const content = message.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  
  throw new Error('Unexpected Claude response format');
}

async function callGPT4o(prompt: string, systemPrompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  });
  
  return completion.choices[0].message.content || '';
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-pro',
  });
  
  const fullPrompt = `${systemPrompt}\n\n${prompt}\n\nRespond with valid JSON only.`;
  
  const result = await model.generateContent(fullPrompt);
  const response = await result.response;
  return response.text();
}

export function parseAgentResponse(response: string): AgentVerdict {
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    return {
      agent: parsed.agent,
      model: parsed.model,
      action: parsed.action,
      confidence: parsed.confidence,
      priceTarget: parsed.priceTarget,
      stopLoss: parsed.stopLoss,
      timeframe: parsed.timeframe,
      reasoning: parsed.reasoning,
      keyRisk: parsed.keyRisk,
      historicalAnalogy: parsed.historicalAnalogy,
      macroAlignment: parsed.macroAlignment,
    };
  } catch (error) {
    console.error('Failed to parse agent response:', error);
    console.error('Raw response:', response);
    throw new Error('Invalid agent response format');
  }
}

export function parseDebateResponse(response: string): DebateResponse {
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    return {
      agent: parsed.agent || parsed.finalAction,
      finalAction: parsed.finalAction,
      finalConfidence: parsed.finalConfidence,
      positionChanged: parsed.positionChanged,
      debateResponse: parsed.debateResponse,
    };
  } catch (error) {
    console.error('Failed to parse debate response:', error);
    throw new Error('Invalid debate response format');
  }
}

// Generate embeddings for vector storage (using OpenAI)
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
