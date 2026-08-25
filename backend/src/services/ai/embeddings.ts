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

export enum RoleCategory {
  ENGINEERING = 'ENGINEERING',
  SALES = 'SALES',
  MARKETING = 'MARKETING',
  RECRUITING = 'RECRUITING',
  FINANCE_LEGAL_OPS = 'FINANCE_LEGAL_OPS',
  DESIGN = 'DESIGN',
  PRODUCT = 'PRODUCT',
  OTHER = 'OTHER',
}

export function categorizeRole(text: string): RoleCategory {
  const t = text.toLowerCase();

  // Sales / Business Development / Account Exec keywords
  if (/\b(sales|sdr|bdr|account executive|account manager|business development|growth associate|commercial|revenue)\b/i.test(t)) {
    return RoleCategory.SALES;
  }

  // Marketing keywords
  if (/\b(marketing|content marketer|copywriter|seo|social media|growth marketer|brand manager)\b/i.test(t)) {
    return RoleCategory.MARKETING;
  }

  // Recruiting / HR keywords
  if (/\b(recruiter|talent acquisition|hr|people operations|human resources|sourcer)\b/i.test(t)) {
    return RoleCategory.RECRUITING;
  }

  // Finance / Legal / Ops
  if (/\b(finance|accounting|legal|counsel|paralegal|operations associate|office manager|payroll)\b/i.test(t)) {
    return RoleCategory.FINANCE_LEGAL_OPS;
  }

  // Design
  if (/\b(ui\/ux|ux designer|product designer|graphic designer|art director)\b/i.test(t)) {
    return RoleCategory.DESIGN;
  }

  // Product Management (when not explicitly engineering)
  if (/\b(product manager|product owner)\b/i.test(t) && !/\b(engineering|engineer|software)\b/i.test(t)) {
    return RoleCategory.PRODUCT;
  }

  // Engineering / Technical keywords
  if (/\b(engineer|developer|architect|fullstack|backend|frontend|software|ai|ml|voice|data scientist|devops|infrastructure|code|systems)\b/i.test(t)) {
    return RoleCategory.ENGINEERING;
  }

  return RoleCategory.OTHER;
}

export interface MatchScoreOptions {
  jobTitle?: string;
  targetTitles?: string[];
  userSkills?: string[];
}

export interface MatchResult {
  score: number;
  whyFit: string;
  isRoleMismatch: boolean;
}

export function calculateMatchScore(
  resumeTextOrSkills: string,
  jobText: string,
  options?: MatchScoreOptions
): MatchResult {
  const jobTitle = options?.jobTitle || '';
  const targetTitles = options?.targetTitles || [];
  const userSkills = options?.userSkills || [];

  // Determine candidate role preference (default to ENGINEERING if target titles include engineering terms)
  const candidateText = targetTitles.length > 0 ? targetTitles.join(' ') : resumeTextOrSkills;
  const candidateCategory = categorizeRole(candidateText);
  const jobCategory = categorizeRole(`${jobTitle} ${jobText.slice(0, 300)}`);

  // Check if candidate is Technical/Engineering while Job is Sales, Marketing, Recruiting, or Finance
  const isRoleMismatch =
    (candidateCategory === RoleCategory.ENGINEERING &&
      [RoleCategory.SALES, RoleCategory.MARKETING, RoleCategory.RECRUITING, RoleCategory.FINANCE_LEGAL_OPS].includes(jobCategory)) ||
    (candidateCategory === RoleCategory.SALES && jobCategory === RoleCategory.ENGINEERING);

  if (isRoleMismatch) {
    const formattedCategory = jobCategory === RoleCategory.SALES ? 'Sales' : jobCategory === RoleCategory.MARKETING ? 'Marketing' : 'Non-Technical';
    return {
      score: Math.floor(Math.random() * 5) + 12, // 12-16% low match score
      whyFit: `Role mismatch: ${formattedCategory} role does not align with your target Technical/Engineering preferences.`,
      isRoleMismatch: true,
    };
  }

  // Standard Similarity calculation
  const resumeVec = generateSimpleEmbedding(resumeTextOrSkills, CORE_VOCABULARY);
  const jobVec = generateSimpleEmbedding(jobText, CORE_VOCABULARY);
  const similarity = computeCosineSimilarity(resumeVec, jobVec);

  // Baseline score derived linearly from cosine similarity
  let rawScore = Math.round(similarity * 100);

  // Title match bonus
  if (targetTitles.length > 0 && targetTitles.some((t) => jobTitle.toLowerCase().includes(t.toLowerCase()))) {
    rawScore += 20;
  } else if (jobCategory === candidateCategory && candidateCategory !== RoleCategory.OTHER) {
    rawScore += 10;
  }

  // Skill match bonus
  const matchedSkills = userSkills.filter((s) =>
    jobText.toLowerCase().includes(s.toLowerCase())
  );
  rawScore += Math.min(matchedSkills.length * 4, 20);

  const finalScore = Math.min(Math.max(rawScore, 15), 98);

  const whyFit = matchedSkills.length > 0
    ? `Matches target preferences & skills in ${matchedSkills.slice(0, 3).join(', ')}.`
    : `Strong fit for your technical candidate profile.`;

  return { score: finalScore, whyFit, isRoleMismatch: false };
}



