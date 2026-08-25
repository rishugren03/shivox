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

export interface ParsedResume {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  skills: string[];
  experience: Array<{
    company: string;
    role: string;
    dates?: string;
    bullets: string[];
  }>;
  projects?: Array<{
    name: string;
    description: string;
    bullets?: string[];
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    year?: string;
  }>;
}

export interface TailoredMaterials {
  tailoredBullets: string[];
  coverNote: string;
  shortAnswers?: Record<string, string>;
}

export async function parseResumeWithOpenAI(resumeText: string): Promise<ParsedResume> {
  if (!openai) {
    console.warn('[OpenAIService] No OPENAI_API_KEY set. Falling back to heuristic parsing.');
    return fallbackParseResume(resumeText);
  }

  try {
    const prompt = `You are an expert resume parser for AI/ML roles. Parse the following resume plain text into a valid JSON object matching this structure:
{
  "fullName": "Name",
  "email": "email@example.com",
  "phone": "555-123-4567",
  "location": "City, State",
  "linkedinUrl": "https://linkedin.com/in/...",
  "githubUrl": "https://github.com/...",
  "portfolioUrl": "https://...",
  "skills": ["Python", "PyTorch", "LLMs", "Voice AI"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "dates": "2023 - Present",
      "bullets": ["Bullet point 1", "Bullet point 2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Description",
      "bullets": ["Bullet 1"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "B.S. Computer Science",
      "year": "2022"
    }
  ]
}

Return ONLY valid raw JSON with no extra commentary.

Resume Text:
${resumeText}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const textContent = response.choices[0]?.message?.content || '{}';
    return JSON.parse(textContent);
  } catch (err: any) {
    console.warn(`[OpenAIService] OpenAI error (${err.message}). Using local heuristic resume parser fallback.`);
    return fallbackParseResume(resumeText);
  }
}

// Alias for backward compatibility if referenced
export const parseResumeWithClaude = parseResumeWithOpenAI;

export async function generateMatchReason(
  resume: ParsedResume | any,
  jobTitle: string,
  jobDescription: string
): Promise<string> {
  if (!openai) {
    return `Strong fit for ${jobTitle} based on your expertise in ${resume.skills?.slice(0, 4).join(', ') || 'AI/ML development'}.`;
  }

  try {
    const prompt = `You are a career advisor for AI founders and engineers. Analyze this candidate's resume and job posting, and write a 1-2 sentence "Why you fit" card summary highlighting candidate's core strengths for this specific role.

Candidate Skills: ${JSON.stringify(resume.skills || [])}
Candidate Experience: ${JSON.stringify(resume.experience || [])}
Job Title: ${jobTitle}
Job Description: ${jobDescription.slice(0, 1500)}

Keep it punchy, specific, and candidate-centric (15-30 words max).`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() || 'Great fit based on your AI/ML skill set.';
  } catch (err: any) {
    console.warn(`[OpenAIService] Match reason fallback (${err.message})`);
    return `Strong fit for ${jobTitle} based on matching technical skills in AI/ML.`;
  }
}

export async function tailorResumeForJob(
  resume: ParsedResume | any,
  rawResumeText: string,
  jobTitle: string,
  jobDescription: string
): Promise<TailoredMaterials> {
  if (!openai) {
    const defaultBullets = resume?.experience?.[0]?.bullets || [
      `Engineered software systems aligned with ${jobTitle} requirements.`,
      `Optimized data pipelines and high-throughput application workflows.`,
    ];
    return {
      tailoredBullets: defaultBullets,
      coverNote: `I am thrilled to apply for the ${jobTitle} role. My experience building scalable software and AI pipelines aligns directly with your team's goals.`,
    };
  }

  try {
    const originalBullets = resume?.experience
      ? resume.experience.flatMap((e: any) => e.bullets || [])
      : [];

    const prompt = `You are an expert AI resume editor.
CRITICAL INSTRUCTION: You MUST base your rewrites directly on candidate's original experience bullets and raw resume text provided below. DO NOT invent fake roles, companies, or accomplishments. Preserve candidate's authentic background while rewriting bullets to emphasize relevant keywords from the Job Description.

Candidate Raw Resume Text:
${rawResumeText.slice(0, 3000)}

Candidate Original Experience Bullets:
${JSON.stringify(originalBullets)}

Target Job Title: ${jobTitle}
Target Job Description: ${jobDescription.slice(0, 2000)}

Return ONLY valid JSON matching this schema:
{
  "tailoredBullets": [
    "Rewritten original bullet 1 incorporating JD keywords while keeping true facts",
    "Rewritten original bullet 2",
    "Rewritten original bullet 3"
  ],
  "coverNote": "3-4 sentence concise, high-impact cover note expressing genuine alignment with the role."
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const textContent = response.choices[0]?.message?.content || '{}';
    return JSON.parse(textContent);
  } catch (err: any) {
    console.warn(`[OpenAIService] Tailoring error (${err.message}). Using local fallback.`);
    const fallbackBullets = resume?.experience?.[0]?.bullets || [
      `Architected scalable software and AI systems for ${jobTitle}.`,
      `Integrated production pipelines to streamline operational workflows.`,
    ];
    return {
      tailoredBullets: fallbackBullets,
      coverNote: `I am excited to apply for ${jobTitle}. My technical background makes me a strong fit for your team.`,
    };
  }
}

function fallbackParseResume(text: string): ParsedResume {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const linkedinMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  const githubMatch = text.match(/https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+/i);

  // Extract skills from text by matching common tech keywords
  const techKeywords = [
    'Python', 'PyTorch', 'TensorFlow', 'TypeScript', 'JavaScript', 'React', 'Node.js',
    'Voice AI', 'LLMs', 'Agentic Workflows', 'PostgreSQL', 'Docker', 'AWS', 'GCP',
    'Express', 'Next.js', 'Playwright', 'FastAPI', 'GraphQL', 'Redis', 'Kubernetes',
  ];
  const detectedSkills = techKeywords.filter((kw) =>
    new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i').test(text)
  );
  
  const finalSkills = detectedSkills.length > 0
    ? detectedSkills
    : ['Python', 'PyTorch', 'TypeScript', 'LLMs', 'Voice AI', 'Agentic Workflows', 'PostgreSQL', 'Docker'];

  // Collect bullet points from raw text lines starting with bullet symbols or hyphens
  const bulletLines = lines
    .filter((l) => /^[-•*]\s+/.test(l) || /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .slice(0, 5);

  return {
    fullName: lines[0] && !lines[0].includes('@') ? lines[0] : 'AI Candidate',
    email: emailMatch ? emailMatch[0] : 'candidate@example.com',
    phone: phoneMatch ? phoneMatch[0] : '',
    linkedinUrl: linkedinMatch ? linkedinMatch[0] : undefined,
    githubUrl: githubMatch ? githubMatch[0] : undefined,
    skills: finalSkills,
    experience: [
      {
        company: 'AI Founder / Tech Lead',
        role: 'AI Systems Engineer',
        dates: '2023 - Present',
        bullets: bulletLines.length > 0 ? bulletLines : [
          'Built autonomous AI agents and real-time voice pipelines.',
          'Deployed custom LLM fine-tunes and high-throughput vector search.',
        ],
      },
    ],
  };
}

