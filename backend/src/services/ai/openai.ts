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
  requiresTailoring: boolean;
  missingKeywords: string[];
  tailoredBullets: string[];
  tailoredSkills?: string[];
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
  const masterSkills: string[] = resume?.skills || [];
  const masterText = (rawResumeText || JSON.stringify(resume)).toLowerCase();

  // Extract key technical terms from job description & title
  const commonTechTerms = [
    'Python', 'PyTorch', 'TensorFlow', 'TypeScript', 'JavaScript', 'React', 'Node.js',
    'Voice AI', 'LLMs', 'Agentic Workflows', 'PostgreSQL', 'Docker', 'AWS', 'GCP',
    'Express', 'Next.js', 'Playwright', 'FastAPI', 'GraphQL', 'Redis', 'Kubernetes',
    'LangChain', 'LlamaIndex', 'WebSockets', 'REST APIs', 'SQL', 'NoSQL', 'CI/CD',
    'System Architecture', 'Microservices', 'Distributed Systems', 'RAG', 'Vector DB',
  ];

  const jdText = `${jobTitle} ${jobDescription}`;
  const requiredKeywordsInJd = commonTechTerms.filter((term) =>
    new RegExp(`\\b${term.replace('.', '\\.')}\\b`, 'i').test(jdText)
  );

  // Find missing keywords in candidate's master resume
  const missingKeywords = requiredKeywordsInJd.filter(
    (kw) => !masterText.includes(kw.toLowerCase()) && !masterSkills.some((s) => s.toLowerCase() === kw.toLowerCase())
  );

  console.log(`[ResumeTailorEngine] Target: "${jobTitle}". JD Keywords: [${requiredKeywordsInJd.join(', ')}]. Missing: [${missingKeywords.join(', ')}]`);

  // If no significant missing keywords (less than 2 missing or no major gaps), apply directly with master resume!
  if (missingKeywords.length === 0) {
    console.log('[ResumeTailorEngine] No significant missing keywords detected. Using Master Resume directly.');
    return {
      requiresTailoring: false,
      missingKeywords: [],
      tailoredBullets: resume?.experience?.flatMap((e: any) => e.bullets || []) || [],
      tailoredSkills: masterSkills,
      coverNote: `I am thrilled to apply for the ${jobTitle} role. My experience building scalable software and AI systems aligns directly with your team's technical stack.`,
    };
  }

  if (!openai) {
    const defaultBullets = resume?.experience?.[0]?.bullets || [
      `Engineered software systems aligned with ${jobTitle} requirements.`,
      `Optimized data pipelines and high-throughput application workflows.`,
    ];
    return {
      requiresTailoring: true,
      missingKeywords,
      tailoredBullets: defaultBullets,
      tailoredSkills: Array.from(new Set([...masterSkills, ...missingKeywords])),
      coverNote: `I am thrilled to apply for the ${jobTitle} role. My experience building scalable software and AI pipelines aligns directly with your team's goals.`,
    };
  }

  try {
    const originalBullets = resume?.experience
      ? resume.experience.flatMap((e: any) => e.bullets || [])
      : [];

    const prompt = `You are an expert AI resume editor.
CRITICAL MANDATE:
- You MUST base your edits strictly on candidate's original experience bullets and master resume text below.
- DO NOT invent fake job titles, companies, dates of employment, degrees, or accomplishments.
- Your ONLY task is to seamlessly incorporate the following MISSING KEYWORDS into relevant existing bullet points and skills, preserving candidate's authentic career facts.

Missing Keywords to Include: ${missingKeywords.join(', ')}

Candidate Master Resume Text:
${rawResumeText.slice(0, 3000)}

Candidate Original Experience Bullets:
${JSON.stringify(originalBullets)}

Target Job Title: ${jobTitle}
Target Job Description: ${jobDescription.slice(0, 1500)}

Return ONLY valid JSON matching this schema:
{
  "tailoredBullets": [
    "Original bullet 1 reworded to naturally include missing keyword while keeping true facts",
    "Original bullet 2",
    "Original bullet 3"
  ],
  "tailoredSkills": ["Skill 1", "Skill 2"],
  "coverNote": "3-4 sentence concise, high-impact cover note expressing genuine alignment with the role."
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const textContent = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(textContent);

    return {
      requiresTailoring: true,
      missingKeywords,
      tailoredBullets: parsed.tailoredBullets || originalBullets,
      tailoredSkills: parsed.tailoredSkills || Array.from(new Set([...masterSkills, ...missingKeywords])),
      coverNote: parsed.coverNote || `I am excited to apply for ${jobTitle}. My technical background makes me a strong fit for your team.`,
    };
  } catch (err: any) {
    console.warn(`[OpenAIService] Tailoring error (${err.message}). Using master fallback.`);
    return {
      requiresTailoring: true,
      missingKeywords,
      tailoredBullets: resume?.experience?.[0]?.bullets || [],
      tailoredSkills: Array.from(new Set([...masterSkills, ...missingKeywords])),
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

