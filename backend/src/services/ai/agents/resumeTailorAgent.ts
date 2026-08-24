import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { ApplicantInfo } from '../../automation/types';
import { generateLLMCompletion, isLLMAvailable, getActiveLLMProvider } from '../llm';

chromium.use(stealthPlugin());

export interface ResumeTailorParams {
  applicant: ApplicantInfo;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  masterExperience?: Array<{
    company: string;
    role: string;
    dates: string;
    bullets: string[];
  }>;
}

export interface TailoredResumeResult {
  pdfPath: string;
  tailoredBullets: string[];
  tailoredSummary: string;
}

export async function generateTailoredResume(params: ResumeTailorParams): Promise<TailoredResumeResult> {
  const { applicant, jobTitle, jobCompany, jobDescription } = params;

  let tailoredBullets: string[] = [
    `Architected high-performance AI backend services and voice pipelines matching ${jobTitle} requirements.`,
    `Engineered agentic LLM workflows, automated form processing, and REST APIs using TypeScript and Node.js.`,
    `Optimized vector search indexing and SQL query performance for real-time AI workloads.`,
  ];
  let tailoredSummary = `Results-driven AI Engineer with expertise in building scalable agentic LLM workflows, voice AI systems, and full-stack web applications. Seeking to leverage technical skills in ${jobTitle} at ${jobCompany}.`;
  let tailoredSkills = ['TypeScript', 'Node.js', 'Python', 'PyTorch', 'LLM Agents', 'Voice AI', 'PostgreSQL', 'Docker', 'REST APIs', 'Playwright'];

  if (isLLMAvailable()) {
    try {
      console.log(`[ResumeTailorAgent] Tailoring resume via ${getActiveLLMProvider().toUpperCase()}...`);
      const prompt = `You are an elite ATS Resume Optimization Agent. Tailor the candidate's resume for the following job opportunity.

Job Title: ${jobTitle}
Company: ${jobCompany}
Job Description:
${jobDescription.slice(0, 2000)}

Candidate Name: ${applicant.fullName}
Candidate Location: ${applicant.location || 'San Francisco, CA'}
Base Skills: TypeScript, React, Node.js, Python, PyTorch, LLMs, Voice AI, Express, Prisma, PostgreSQL, Docker, Playwright

Instructions:
1. Generate a tailored 2-sentence Professional Summary targeted directly at ${jobTitle} at ${jobCompany}.
2. Provide 4 impact-driven experience bullet points incorporating key technical skills and keywords from the job description.
3. Select 10 highly relevant skills matching the job description.

Return ONLY valid JSON with no markdown wrapping:
{
  "summary": "Tailored 2-sentence summary...",
  "bullets": [
    "Bullet 1 with metrics/keywords...",
    "Bullet 2...",
    "Bullet 3...",
    "Bullet 4..."
  ],
  "skills": ["Skill1", "Skill2", ...]
}`;

      const textContent = await generateLLMCompletion({
        prompt,
        maxTokens: 1000,
      });

      const cleanJsonStr = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      if (parsed.summary) tailoredSummary = parsed.summary;
      if (Array.isArray(parsed.bullets) && parsed.bullets.length > 0) tailoredBullets = parsed.bullets;
      if (Array.isArray(parsed.skills) && parsed.skills.length > 0) tailoredSkills = parsed.skills;
    } catch (err: any) {
      console.warn('[ResumeTailorAgent] LLM tailoring fallback:', err.message);
    }
  }

  // Generate ATS HTML document
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      color: #1a1a1a;
      line-height: 1.5;
      margin: 0;
      padding: 32px 40px;
      font-size: 11pt;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 4px 0;
      font-size: 22pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .contact-info {
      font-size: 9.5pt;
      color: #475569;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .contact-info span { display: inline-block; }
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    p { margin: 0 0 8px 0; font-size: 10pt; color: #334155; }
    ul { margin: 0 0 12px 0; padding-left: 18px; }
    li { margin-bottom: 4px; font-size: 10pt; color: #1e293b; }
    .job-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      font-size: 10.5pt;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .job-title { font-style: italic; color: #475569; font-size: 10pt; margin-bottom: 6px; }
    .skills-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .skill-tag {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8.5pt;
      border: 1px solid #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${applicant.fullName}</h1>
    <div class="contact-info">
      <span>${applicant.email}</span> •
      <span>${applicant.phone || '555-019-2831'}</span> •
      <span>${applicant.location || 'San Francisco, CA'}</span> •
      <span>${applicant.linkedinUrl || 'linkedin.com/in/rishu-kumar'}</span> •
      <span>${applicant.githubUrl || 'github.com/rishugren03'}</span>
    </div>
  </div>

  <div class="section-title">Professional Summary</div>
  <p>${tailoredSummary}</p>

  <div class="section-title">Core Skills & Expertise</div>
  <div class="skills-list">
    ${tailoredSkills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
  </div>

  <div class="section-title">Relevant Experience</div>
  <div class="job-header">
    <span>Tsenta AI / Founding Engineer</span>
    <span>2024 - Present</span>
  </div>
  <div class="job-title">${jobTitle} Focus • San Francisco, CA</div>
  <ul>
    ${tailoredBullets.map(b => `<li>${b}</li>`).join('')}
  </ul>

  <div class="job-header">
    <span>AI Voice Systems & Agentic Engineering</span>
    <span>2023 - 2024</span>
  </div>
  <div class="job-title">Software Engineer</div>
  <ul>
    <li>Engineered autonomous multi-agent pipelines for parsing dynamic DOM inputs and executing automated submissions with 99%+ field completion.</li>
    <li>Integrated real-time streaming LLM endpoints and custom TTS/STT models using WebSockets and low-latency audio processing.</li>
  </ul>

  <div class="section-title">Education</div>
  <div class="job-header">
    <span>B.S. in Computer Science & Artificial Intelligence</span>
    <span>Graduated 2023</span>
  </div>
</body>
</html>`;

  // Render to PDF using Playwright
  const resumesDir = path.join(__dirname, '../../../../uploads/resumes');
  if (!fs.existsSync(resumesDir)) {
    fs.mkdirSync(resumesDir, { recursive: true });
  }

  const fileName = `tailored_${Date.now()}_${applicant.fullName.replace(/\s+/g, '_')}.pdf`;
  const pdfPath = path.join(resumesDir, fileName);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setContent(htmlContent, { waitUntil: 'load' });
  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
    printBackground: true,
  });

  await browser.close();
  console.log(`[ResumeTailorAgent] Generated ATS-tailored resume PDF: ${pdfPath}`);

  return {
    pdfPath,
    tailoredBullets,
    tailoredSummary,
  };
}
