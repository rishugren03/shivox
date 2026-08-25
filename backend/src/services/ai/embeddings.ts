import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;

const openai = apiKey
  ? new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      timeout: 10000,
      maxRetries: 1,
    })
  : null;

export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function generateSimpleEmbedding(text: string, vocabulary: string[]): number[] {
  const words = text.toLowerCase().match(/\b[a-z0-9+#.-]+\b/g) || [];
  const freqMap: Record<string, number> = {};

  for (const word of words) {
    freqMap[word] = (freqMap[word] || 0) + 1;
  }

  return vocabulary.map((token) => freqMap[token] || 0);
}

export const CORE_VOCABULARY = [
  'ai', 'ml', 'llm', 'voice', 'speech', 'audio', 'nlp', 'agent', 'agentic',
  'python', 'pytorch', 'tensorflow', 'typescript', 'javascript', 'node', 'react', 'postgres',
  'redis', 'docker', 'aws', 'gcp', 'vapi', 'livekit', 'elevenlabs', 'langchain',
  'llamaindex', 'rag', 'embeddings', 'vector', 'playwright', 'scraping',
  'architecture', 'fullstack', 'backend', 'frontend', 'deep learning', 'express',
  'fastapi', 'graphql', 'kubernetes', 'sql',
];

export async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) return [];
  if (!openai) {
    return generateSimpleEmbedding(text, CORE_VOCABULARY);
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    });
    return response.data[0]?.embedding || [];
  } catch (err: any) {
    console.warn(`[EmbeddingService] OpenAI embedding error (${err.message}). Using local vocabulary vector fallback.`);
    return generateSimpleEmbedding(text, CORE_VOCABULARY);
  }
}

export function calculateMatchScore(resumeTextOrSkills: string, jobText: string): number {
  const resumeVec = generateSimpleEmbedding(resumeTextOrSkills, CORE_VOCABULARY);
  const jobVec = generateSimpleEmbedding(jobText, CORE_VOCABULARY);

  const similarity = computeCosineSimilarity(resumeVec, jobVec);
  
  // Normalize similarity score to 60% - 98% range for UI presentation
  const baseScore = Math.min(Math.max(similarity * 1.5, 0.45), 0.98);
  return Math.round(baseScore * 100);
}


