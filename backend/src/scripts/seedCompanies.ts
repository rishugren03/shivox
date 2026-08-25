  import { prisma } from '../config/prisma';

export interface SeedCompany {
  name: string;
  atsType: 'greenhouse' | 'lever' | 'ashby';
  boardTokenOrSlug: string;
  isVoiceAI?: boolean;
}

export const SEED_COMPANIES: SeedCompany[] = [
  // ── Voice AI & Conversational Audio Startups (Ashby / Greenhouse / Lever) ─────
  { name: 'Vapi',                 atsType: 'ashby',      boardTokenOrSlug: 'vapi',                 isVoiceAI: true },
  { name: 'LiveKit',              atsType: 'ashby',      boardTokenOrSlug: 'livekit',              isVoiceAI: true },
  { name: 'Cartesia',             atsType: 'ashby',      boardTokenOrSlug: 'cartesia',             isVoiceAI: true },
  { name: 'ElevenLabs',           atsType: 'ashby',      boardTokenOrSlug: 'elevenlabs',           isVoiceAI: true },
  { name: 'AssemblyAI',           atsType: 'ashby',      boardTokenOrSlug: 'assemblyai',           isVoiceAI: true },
  { name: 'Synthesia',            atsType: 'ashby',      boardTokenOrSlug: 'synthesia',            isVoiceAI: true },
  { name: 'Tavus',                atsType: 'ashby',      boardTokenOrSlug: 'tavus',                isVoiceAI: true },
  { name: 'Deepgram',             atsType: 'greenhouse', boardTokenOrSlug: 'deepgram',             isVoiceAI: true },
  { name: 'PlayHT',               atsType: 'ashby',      boardTokenOrSlug: 'playht',               isVoiceAI: true },
  { name: 'Resemble AI',          atsType: 'ashby',      boardTokenOrSlug: 'resembleai',           isVoiceAI: true },
  { name: 'Bland AI',             atsType: 'ashby',      boardTokenOrSlug: 'blandai',              isVoiceAI: true },
  { name: 'Retell AI',            atsType: 'ashby',      boardTokenOrSlug: 'retellai',             isVoiceAI: true },
  { name: 'Observe.AI',           atsType: 'greenhouse', boardTokenOrSlug: 'observeai',            isVoiceAI: true },
  { name: 'Cresta',               atsType: 'greenhouse', boardTokenOrSlug: 'cresta',               isVoiceAI: true },
  { name: 'Daily.co',             atsType: 'greenhouse', boardTokenOrSlug: 'daily',                isVoiceAI: true },

  // ── Emerging AI & LLM Infrastructure Startups (Ashby) ──────────────────────
  { name: 'OpenAI',               atsType: 'ashby',      boardTokenOrSlug: 'openai' },
  { name: 'Mistral AI',           atsType: 'ashby',      boardTokenOrSlug: 'mistral.ai' },
  { name: 'Perplexity AI',        atsType: 'ashby',      boardTokenOrSlug: 'perplexity.ai' },
  { name: 'Midjourney',           atsType: 'ashby',      boardTokenOrSlug: 'midjourney' },
  { name: 'Weights & Biases',     atsType: 'ashby',      boardTokenOrSlug: 'weightsandbiases' },
  { name: 'Modal',                atsType: 'ashby',      boardTokenOrSlug: 'modal' },
  { name: 'Runway',               atsType: 'ashby',      boardTokenOrSlug: 'runway' },
  { name: 'Replicate',            atsType: 'ashby',      boardTokenOrSlug: 'replicate' },
  { name: 'Cursor (Anysphere)',   atsType: 'ashby',      boardTokenOrSlug: 'anysphere' },
  { name: 'Fireworks AI',         atsType: 'ashby',      boardTokenOrSlug: 'fireworks' },
  { name: 'LangChain',            atsType: 'ashby',      boardTokenOrSlug: 'langchain' },
  { name: 'Braintrust',           atsType: 'ashby',      boardTokenOrSlug: 'braintrust' },
  { name: 'Cognition AI',         atsType: 'ashby',      boardTokenOrSlug: 'cognition' },
  { name: 'LlamaIndex',           atsType: 'ashby',      boardTokenOrSlug: 'llamaindex' },
  { name: 'Mercor',               atsType: 'ashby',      boardTokenOrSlug: 'mercor' },
  { name: 'Pinecone',             atsType: 'ashby',      boardTokenOrSlug: 'pinecone' },
  { name: 'Harvey',               atsType: 'ashby',      boardTokenOrSlug: 'harvey' },
  { name: 'Cohere',               atsType: 'ashby',      boardTokenOrSlug: 'cohere' },
  { name: 'Codeium',              atsType: 'ashby',      boardTokenOrSlug: 'codeium' },
  { name: 'Decagon',              atsType: 'ashby',      boardTokenOrSlug: 'decagon' },
  { name: 'Hebbia',               atsType: 'ashby',      boardTokenOrSlug: 'hebbia' },
  { name: 'Norm AI',              atsType: 'ashby',      boardTokenOrSlug: 'normai' },
  { name: 'Unstructured',         atsType: 'ashby',      boardTokenOrSlug: 'unstructured' },
  { name: 'Contextual AI',        atsType: 'ashby',      boardTokenOrSlug: 'contextualai' },
  { name: 'Lamini',               atsType: 'ashby',      boardTokenOrSlug: 'lamini' },
  { name: 'Sierra',               atsType: 'ashby',      boardTokenOrSlug: 'sierra' },
  { name: 'Poolside',             atsType: 'ashby',      boardTokenOrSlug: 'poolside' },
  { name: 'Magic',                atsType: 'ashby',      boardTokenOrSlug: 'magic' },

  // ── High Growth Enterprise & FDE Startups (Greenhouse) ─────────────────────
  { name: 'Anthropic',            atsType: 'greenhouse', boardTokenOrSlug: 'anthropic' },
  { name: 'Scale AI',             atsType: 'greenhouse', boardTokenOrSlug: 'scaleai' },
  { name: 'Together AI',          atsType: 'greenhouse', boardTokenOrSlug: 'togetherai' },
  { name: 'Glean',                atsType: 'greenhouse', boardTokenOrSlug: 'glean' },
  { name: 'Anduril',              atsType: 'greenhouse', boardTokenOrSlug: 'andurilindustries' },
  { name: 'Palantir',             atsType: 'greenhouse', boardTokenOrSlug: 'palantirtechnologies' },
  { name: 'Writer',               atsType: 'greenhouse', boardTokenOrSlug: 'writer' },
  { name: 'Applied Intuition',    atsType: 'greenhouse', boardTokenOrSlug: 'appliedintuition' },
  { name: 'Skydio',               atsType: 'greenhouse', boardTokenOrSlug: 'skydio' },
  { name: 'Shield AI',            atsType: 'greenhouse', boardTokenOrSlug: 'shieldai' },
  { name: 'Substack',             atsType: 'greenhouse', boardTokenOrSlug: 'substack' },
  { name: 'Linear',               atsType: 'greenhouse', boardTokenOrSlug: 'linear' },
  { name: 'Vercel',               atsType: 'greenhouse', boardTokenOrSlug: 'vercel' },
  { name: 'Supabase',             atsType: 'greenhouse', boardTokenOrSlug: 'supabase' },

  // ── High Growth Tech (Lever) ────────────────────────────────────────────────
  { name: 'Hugging Face',         atsType: 'lever',      boardTokenOrSlug: 'huggingface' },
  { name: 'Ramp',                 atsType: 'lever',      boardTokenOrSlug: 'ramp' },
  { name: 'Modern Treasury',     atsType: 'lever',      boardTokenOrSlug: 'moderntreasury' },
  { name: 'Mercury',              atsType: 'lever',      boardTokenOrSlug: 'mercury' },
  { name: 'Retool',               atsType: 'lever',      boardTokenOrSlug: 'retool' },
];

export async function seedCompanies() {
  console.log(`Seeding & updating ${SEED_COMPANIES.length} AI/ML companies...`);
  let count = 0;

  for (const c of SEED_COMPANIES) {
    const existing = await prisma.company.findFirst({
      where: { name: c.name },
    });

    if (existing) {
      await prisma.company.update({
        where: { id: existing.id },
        data: {
          atsType: c.atsType,
          boardTokenOrSlug: c.boardTokenOrSlug,
          active: true,
        },
      });
    } else {
      await prisma.company.create({
        data: {
          name: c.name,
          atsType: c.atsType,
          boardTokenOrSlug: c.boardTokenOrSlug,
          active: true,
        },
      });
      count++;
    }
  }

  console.log(`Seeding complete. Updated existing companies and added ${count} new companies.`);
}

if (require.main === module) {
  seedCompanies()
    .catch((err) => console.error('Seeding error:', err))
    .finally(() => prisma.$disconnect());
}

