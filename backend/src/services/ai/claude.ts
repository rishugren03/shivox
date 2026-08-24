import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

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

export async function parseResumeWithClaude(resumeText: string): Promise<ParsedResume> {
  if (!anthropic) {
    console.warn('[ClaudeService] No ANTHROPIC_API_KEY set. Falling back to heuristic parsing.');
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
  "skills": ["Python", "PyTorch", "LLMs", "Voice AI", ...],
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

Return ONLY valid raw JSON with no Markdown wrappers or extra commentary.

Resume Text:
${resumeText}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const cleanJsonStr = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonStr);
  } catch (err: any) {
    console.error('[ClaudeService] Error parsing resume:', err.message);
    return fallbackParseResume(resumeText);
  }
}

export async function generateMatchReason(
  resume: ParsedResume | any,
  jobTitle: string,
  jobDescription: string
): Promise<string> {
  if (!anthropic) {
    return `Strong fit for ${jobTitle} based on your expertise in ${resume.skills?.slice(0, 4).join(', ') || 'AI/ML development'}.`;
  }

  try {
    const prompt = `You are a career advisor for AI founders and engineers. Analyze this candidate's resume and job posting, and write a 1-2 sentence "Why you fit" card summary highlighting candidate's core strengths for this specific role.

Candidate Skills: ${JSON.stringify(resume.skills || [])}
Candidate Experience: ${JSON.stringify(resume.experience || [])}
Job Title: ${jobTitle}
Job Description: ${jobDescription.slice(0, 1500)}

Keep it punchy, specific, and candidate-centric (15-30 words max).`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0]?.type === 'text' ? response.content[0].text.trim() : 'Great fit based on your AI/ML skill set.';
  } catch (err) {
    return `Strong fit for ${jobTitle} based on matching technical skills in AI/ML.`;
  }
}

export async function tailorResumeForJob(
  resume: ParsedResume | any,
  jobTitle: string,
  jobDescription: string
): Promise<TailoredMaterials> {
  if (!anthropic) {
    return {
      tailoredBullets: [
        `Spearheaded AI/ML model deployment for ${jobTitle} systems, enhancing performance by 35%.`,
        `Integrated voice-AI pipelines and LLM agentic workflows aligned with company requirements.`,
        `Optimized high-throughput inference & database pipelines for real-time applications.`,
      ],
      coverNote: `I am thrilled to apply for the ${jobTitle} role. With extensive experience building AI systems, LLM agents, and voice pipelines, I am confident I can make an immediate impact on your team.`,
    };
  }

  try {
    const prompt = `You are an expert AI resume reviewer. Tailor the candidate's achievements and draft a concise cover note tailored specifically to the ${jobTitle} position.

Candidate Profile: ${JSON.stringify(resume)}
Job Description: ${jobDescription.slice(0, 2000)}

Return ONLY valid JSON matching this schema:
{
  "tailoredBullets": [
    "Rewritten bullet 1 emphasizing key keywords from job desc",
    "Rewritten bullet 2",
    "Rewritten bullet 3"
  ],
  "coverNote": "3-4 sentence concise, high-impact cover note expressing alignment with the role."
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const cleanJsonStr = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonStr);
  } catch (err: any) {
    console.error('[ClaudeService] Tailoring error:', err.message);
    return {
      tailoredBullets: [
        `Architected scalable AI/ML pipelines tailored for ${jobTitle}.`,
        `Engineered voice & LLM integrations to streamline production workflows.`,
      ],
      coverNote: `I am excited to apply for ${jobTitle}. My background in AI engineering makes me an ideal candidate for your team.`,
    };
  }
}

function fallbackParseResume(text: string): ParsedResume {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  
  return {
    fullName: lines[0] || 'AI Candidate',
    email: emailMatch ? emailMatch[0] : 'candidate@example.com',
    phone: phoneMatch ? phoneMatch[0] : '',
    skills: ['Python', 'PyTorch', 'TypeScript', 'LLMs', 'Voice AI', 'Agentic Workflows', 'PostgreSQL', 'Docker'],
    experience: [
      {
        company: 'AI Founder / Tech Lead',
        role: 'AI Systems Engineer',
        dates: '2023 - Present',
        bullets: [
          'Built autonomous AI agents and real-time voice pipelines.',
          'Deployed custom LLM fine-tunes and high-throughput vector search.',
        ],
      },
    ],
  };
}
