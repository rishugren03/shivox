import { prisma } from '../config/prisma';

export const SEED_COMPANIES = [
  // ── Greenhouse ──────────────────────────────────────────────────────
  { name: 'Anthropic',   atsType: 'greenhouse', boardTokenOrSlug: 'anthropic' },
  { name: 'Scale AI',    atsType: 'greenhouse', boardTokenOrSlug: 'scaleai' },
  { name: 'Together AI', atsType: 'greenhouse', boardTokenOrSlug: 'togetherai' },

  // ── Ashby ────────────────────────────────────────────────────────────
  // Slugs are the path segment from jobs.ashbyhq.com/<slug>
  { name: 'OpenAI',               atsType: 'ashby', boardTokenOrSlug: 'openai' },
  { name: 'Mistral AI',           atsType: 'ashby', boardTokenOrSlug: 'mistral.ai' },   // FIX: was 'mistral'
  { name: 'Perplexity AI',        atsType: 'ashby', boardTokenOrSlug: 'perplexity.ai' }, // FIX: was greenhouse/perplexity
  { name: 'Midjourney',           atsType: 'ashby', boardTokenOrSlug: 'midjourney' },    // FIX: was greenhouse/midjourney
  { name: 'Weights & Biases',     atsType: 'ashby', boardTokenOrSlug: 'weightsandbiases' }, // FIX: was greenhouse/wandb
  { name: 'Modal',                atsType: 'ashby', boardTokenOrSlug: 'modal' },         // FIX: was 'modal-labs'
  { name: 'Runway',               atsType: 'ashby', boardTokenOrSlug: 'runway' },        // FIX: was 'runwayml'
  { name: 'AssemblyAI',           atsType: 'ashby', boardTokenOrSlug: 'assemblyai' },
  { name: 'Replicate',            atsType: 'ashby', boardTokenOrSlug: 'replicate' },
  { name: 'Cursor (Anysphere)',   atsType: 'ashby', boardTokenOrSlug: 'anysphere' },
  { name: 'LiveKit',              atsType: 'ashby', boardTokenOrSlug: 'livekit' },
  { name: 'Fireworks AI',         atsType: 'ashby', boardTokenOrSlug: 'fireworks' },
  { name: 'LangChain',            atsType: 'ashby', boardTokenOrSlug: 'langchain' },
  { name: 'Braintrust',           atsType: 'ashby', boardTokenOrSlug: 'braintrust' },
  { name: 'Cognition',            atsType: 'ashby', boardTokenOrSlug: 'cognition' },
  { name: 'Vapi',                 atsType: 'ashby', boardTokenOrSlug: 'vapi' },
  { name: 'LlamaIndex',           atsType: 'ashby', boardTokenOrSlug: 'llamaindex' },
  { name: 'Cartesia',             atsType: 'ashby', boardTokenOrSlug: 'cartesia' },
  { name: 'ElevenLabs',           atsType: 'ashby', boardTokenOrSlug: 'elevenlabs' },
  { name: 'Synthesia',            atsType: 'ashby', boardTokenOrSlug: 'synthesia' },
  { name: 'Tavus',                atsType: 'ashby', boardTokenOrSlug: 'tavus' },
  { name: 'Mercor',               atsType: 'ashby', boardTokenOrSlug: 'mercor' },
  { name: 'Pinecone',             atsType: 'ashby', boardTokenOrSlug: 'pinecone' },
  { name: 'Harvey',               atsType: 'ashby', boardTokenOrSlug: 'harvey' },
  { name: 'Cohere',               atsType: 'ashby', boardTokenOrSlug: 'cohere' },   // FIX: was greenhouse/cohere

  // ── Lever ────────────────────────────────────────────────────────────
  { name: 'Hugging Face', atsType: 'lever', boardTokenOrSlug: 'huggingface' }, // HF uses Lever
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
