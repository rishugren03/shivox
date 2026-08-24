import 'dotenv/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openaiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

export interface LLMCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export async function generateLLMCompletion(options: LLMCompletionOptions): Promise<string> {
  const { prompt, systemPrompt, maxTokens = 1000, temperature = 0.7, jsonMode = false } = options;

  // 1. Prioritize OpenAI if OPENAI_API_KEY is available
  if (openai) {
    console.log('[LLM] Invoking OpenAI API (gpt-4o-mini)...');
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: maxTokens,
        temperature,
        response_format: jsonMode ? { type: 'json_object' } : undefined,
      });

      return response.choices[0]?.message?.content || '';
    } catch (err: any) {
      console.error('[LLM] OpenAI execution error:', err.message);
    }
  }

  // 2. Fall back to Anthropic Claude if ANTHROPIC_API_KEY is available
  if (anthropic) {
    console.log('[LLM] Invoking Anthropic Claude API (claude-3-5-sonnet)...');
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return textContent;
    } catch (err: any) {
      console.error('[LLM] Anthropic execution error:', err.message);
    }
  }

  // 3. No LLM key available
  throw new Error('No OPENAI_API_KEY or ANTHROPIC_API_KEY found in environment variables.');
}

export function isLLMAvailable(): boolean {
  return Boolean(openaiKey || anthropicKey);
}

export function getActiveLLMProvider(): 'openai' | 'anthropic' | 'heuristic' {
  if (openaiKey) return 'openai';
  if (anthropicKey) return 'anthropic';
  return 'heuristic';
}
