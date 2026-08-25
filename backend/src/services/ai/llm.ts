import 'dotenv/config';
import OpenAI from 'openai';

const openaiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;

const openai = openaiKey
  ? new OpenAI({
      apiKey: openaiKey,
      ...(baseURL ? { baseURL } : {}),
      timeout: 10000,
      maxRetries: 1,
    })
  : null;

export interface LLMCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export async function generateLLMCompletion(options: LLMCompletionOptions): Promise<string> {
  const { prompt, systemPrompt, maxTokens = 1000, temperature = 0.7, jsonMode = false } = options;

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
      console.warn('[LLM] OpenAI execution error:', err.message);
      throw new Error(`OpenAI completion failed (${err.message}).`);
    }
  }

  throw new Error('No OPENAI_API_KEY set in environment variables.');
}


export function isLLMAvailable(): boolean {
  return Boolean(openaiKey);
}

export function getActiveLLMProvider(): 'openai' | 'heuristic' {
  if (openaiKey) return 'openai';
  return 'heuristic';
}

