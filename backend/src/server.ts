import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pdfParse from 'pdf-parse';

import { prisma } from './config/prisma';
import { pollAllActiveCompanies } from './services/aggregator/poller';
import { parseResumeWithClaude, generateMatchReason, tailorResumeForJob } from './services/ai/claude';
import { calculateMatchScore } from './services/ai/embeddings';
import { submitApplicationToATS } from './services/automation/submitter';

import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static screenshots and uploads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer setup for resume PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `resume_${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

// Password hashing helper (Simple SHA-256 for local dev auth)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// PDF Text Extraction Helper (fixes pdf-parse v2 issues & prevents 500 errors)
async function extractTextFromPdf(dataBuffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();
    await parser.destroy().catch(() => {});
    if (textResult && textResult.text && textResult.text.trim()) {
      return textResult.text;
    }
  } catch (err: any) {
    console.warn('[PDFExtractor] PDFParse v2 error, trying fallback:', err.message);
  }

  try {
    const pdf = require('pdf-parse');
    if (typeof pdf === 'function') {
      const data = await pdf(dataBuffer);
      return data.text || '';
    } else if (pdf.PDFParse) {
      const parser = new pdf.PDFParse({ data: dataBuffer });
      const res = await parser.getText();
      await parser.destroy().catch(() => {});
      return res.text || '';
    }
  } catch (e: any) {
    console.error('[PDFExtractor] Fallback extraction error:', e.message);
  }
  return '';
}

// Helper to get or create default founder profile or fetch user from request headers
async function getUserFromReq(req: express.Request) {
  const userIdHeader = req.headers['x-user-id'] as string;
  const userEmailHeader = req.headers['x-user-email'] as string;

  if (userIdHeader) {
    const user = await prisma.userProfile.findUnique({ where: { id: userIdHeader } });
    if (user) return user;
  }
  if (userEmailHeader) {
    const user = await prisma.userProfile.findFirst({ where: { email: userEmailHeader } });
    if (user) return user;
  }

  // Fallback to default user profile
  let user = await prisma.userProfile.findFirst();
  if (!user) {
    user = await prisma.userProfile.create({
      data: {
        fullName: 'Alex Founder',
        email: 'alex@founder.ai',
        passwordHash: hashPassword('password123'),
        phone: '555-019-2831',
        linkedinUrl: 'https://linkedin.com/in/alex-founder',
        githubUrl: 'https://github.com/alex-founder',
        portfolioUrl: 'https://alexfounder.ai',
        location: 'San Francisco, CA',
        resumeText: 'AI Engineer & Founder with expertise in PyTorch, LLMs, Voice AI, LangChain, Vapi, and Playwright automation.',
        resumeJson: JSON.stringify({
          skills: ['Python', 'PyTorch', 'LLMs', 'Voice AI', 'TypeScript', 'Node.js', 'PostgreSQL', 'BullMQ'],
          experience: [
            {
              company: 'Voice AI Studio',
              role: 'Founder & AI Engineer',
              dates: '2024 - Present',
              bullets: [
                'Engineered low-latency voice AI agents with Vapi and LiveKit.',
                'Deployed fine-tuned models and high-throughput vector search.',
              ],
            },
          ],
        }),
        embedding: '[]',
        targetJobTitles: JSON.stringify(['AI Engineer', 'Voice AI Specialist', 'Fullstack AI Engineer']),
        preferredLocations: JSON.stringify(['Remote', 'San Francisco, CA']),
        remotePreference: 'any',
        experienceLevel: 'Mid-Senior',
        minSalary: 140000,
        preferredSkills: JSON.stringify(['PyTorch', 'LLMs', 'Voice AI', 'TypeScript', 'PostgreSQL']),
        autoApplyEnabled: true,
      },
    });
  }
  return user;
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// 1. Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// 2. Auth Routes (Register, Login, Me)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await prisma.userProfile.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const newUser = await prisma.userProfile.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        fullName: fullName || email.split('@')[0],
        targetJobTitles: JSON.stringify(['AI Engineer', 'Voice AI Specialist']),
        preferredLocations: JSON.stringify(['Remote', 'San Francisco, CA']),
        remotePreference: 'any',
        experienceLevel: 'Mid-Senior',
        minSalary: 120000,
        preferredSkills: JSON.stringify(['Python', 'PyTorch', 'LLMs', 'Voice AI']),
        autoApplyEnabled: true,
      },
    });

    res.json({ success: true, user: newUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.userProfile.findUnique({ where: { email } });
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getUserFromReq(req);
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Poll job boards on-demand
app.post('/api/jobs/poll', async (req, res) => {
  try {
    const stats = await pollAllActiveCompanies();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Swipe Deck Jobs (Ranked by Resume & Job Preferences)
app.get('/api/jobs/deck', async (req, res) => {
  try {
    const user = await getUserFromReq(req);

    // Fetch existing applications to exclude swiped jobs
    const existingApps = await prisma.application.findMany({
      where: { userId: user.id },
      select: { jobId: true },
    });
    const swipedJobIds = new Set(existingApps.map((a) => a.jobId));

    const jobs = await prisma.job.findMany({
      where: { closed: false },
      include: { company: true },
      orderBy: { firstSeenAt: 'desc' },
      take: 100,
    });

    const unswiped = jobs.filter((j) => !swipedJobIds.has(j.id));
    const userResumeText = JSON.stringify(user.resumeJson || user.resumeText || '');
    const userTargetTitles: string[] = user.targetJobTitles ? JSON.parse(user.targetJobTitles) : [];
    const userSkills: string[] = user.preferredSkills ? JSON.parse(user.preferredSkills) : [];

    // Calculate match scores using both resume content and target preferences
    const deck = unswiped.map((job) => {
      let score = calculateMatchScore(userResumeText, `${job.title} ${job.description}`);

      // Preference bonus: title match
      if (userTargetTitles.some((t) => job.title.toLowerCase().includes(t.toLowerCase()))) {
        score += 15;
      }
      // Preference bonus: skill match
      const matchedSkills = userSkills.filter((s) =>
        job.description.toLowerCase().includes(s.toLowerCase())
      );
      score += matchedSkills.length * 5;

      const finalScore = Math.min(Math.round(score), 99);

      return {
        ...job,
        matchScore: finalScore,
        whyFit: matchedSkills.length > 0
          ? `Matches target role preferences and skills in ${matchedSkills.slice(0, 3).join(', ')}.`
          : `Great fit for your AI/ML background and technical preferences.`,
      };
    });

    // Sort by highest match score
    deck.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ jobs: deck });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Upload & Parse Resume (FIXED: extractTextFromPdf prevents 500 errors)
app.post('/api/resume/upload', upload.single('resume'), async (req, res) => {
  try {
    const user = await getUserFromReq(req);
    let textContent = '';

    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(req.file.path);
        textContent = await extractTextFromPdf(dataBuffer);
      } else {
        textContent = fs.readFileSync(req.file.path, 'utf8');
      }
    } else if (req.body.resumeText) {
      textContent = req.body.resumeText;
    }

    let parsedJson: any = {};
    if (textContent.trim()) {
      parsedJson = await parseResumeWithClaude(textContent);
    } else {
      parsedJson = {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        skills: ['Python', 'PyTorch', 'LLMs', 'Voice AI', 'TypeScript', 'PostgreSQL'],
        experience: [],
      };
    }

    const updatedUser = await prisma.userProfile.update({
      where: { id: user.id },
      data: {
        fullName: parsedJson.fullName || user.fullName,
        email: parsedJson.email || user.email,
        phone: parsedJson.phone || user.phone,
        linkedinUrl: parsedJson.linkedinUrl || user.linkedinUrl,
        githubUrl: parsedJson.githubUrl || user.githubUrl,
        portfolioUrl: parsedJson.portfolioUrl || user.portfolioUrl,
        location: parsedJson.location || user.location,
        resumeText: textContent || user.resumeText,
        resumeJson: JSON.stringify(parsedJson),
        resumeFileUrl: req.file ? `/uploads/${req.file.filename}` : user.resumeFileUrl,
      },
    });

    res.json({ success: true, profile: updatedUser });
  } catch (err: any) {
    console.error('[ResumeUpload] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Get User Profile & Job Preferences
app.get('/api/user/profile', async (req, res) => {
  try {
    const user = await getUserFromReq(req);
    res.json({ profile: user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update User Profile & Job Preferences
app.put('/api/user/profile', async (req, res) => {
  try {
    const user = await getUserFromReq(req);

    // Format array/JSON fields if passed as arrays
    const payload = { ...req.body };
    if (Array.isArray(payload.targetJobTitles)) {
      payload.targetJobTitles = JSON.stringify(payload.targetJobTitles);
    }
    if (Array.isArray(payload.preferredLocations)) {
      payload.preferredLocations = JSON.stringify(payload.preferredLocations);
    }
    if (Array.isArray(payload.preferredSkills)) {
      payload.preferredSkills = JSON.stringify(payload.preferredSkills);
    }
    if (payload.minSalary !== undefined) {
      payload.minSalary = parseInt(payload.minSalary, 10) || 0;
    }

    // Remove immutable fields if present
    delete payload.id;
    delete payload.passwordHash;
    delete payload.createdAt;
    delete payload.updatedAt;

    const updated = await prisma.userProfile.update({
      where: { id: user.id },
      data: payload,
    });
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Swipe Action (Right = tailoring/pending_review; Left = passed)
app.post('/api/applications/swipe', async (req, res) => {
  try {
    const { jobId, action } = req.body; // action = 'right' | 'left'
    const user = await getUserFromReq(req);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (action === 'left') {
      const appRecord = await prisma.application.upsert({
        where: {
          userId_jobId: { userId: user.id, jobId },
        },
        create: {
          userId: user.id,
          jobId,
          status: 'passed',
        },
        update: {
          status: 'passed',
        },
      });
      return res.json({ success: true, application: appRecord });
    }

    // Swipe Right: Generate match reason & tailored materials
    const userResumeText = JSON.stringify(user.resumeJson || user.resumeText || '');
    const matchScore = calculateMatchScore(userResumeText, `${job.title} ${job.description}`);
    const matchReason = await generateMatchReason(user.resumeJson || {}, job.title, job.description);
    const tailored = await tailorResumeForJob(user.resumeJson || {}, job.title, job.description);

    const appRecord = await prisma.application.upsert({
      where: {
        userId_jobId: { userId: user.id, jobId },
      },
      create: {
        userId: user.id,
        jobId,
        status: 'pending_review',
        matchScore,
        matchReason,
        tailoredJson: JSON.stringify(tailored.tailoredBullets),
        coverNote: tailored.coverNote,
      },
      update: {
        status: 'pending_review',
        matchScore,
        matchReason,
        tailoredJson: JSON.stringify(tailored.tailoredBullets),
        coverNote: tailored.coverNote,
      },
    });

    res.json({ success: true, application: appRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Approve Application for submission
app.post('/api/applications/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { coverNote, tailoredBullets } = req.body;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'approved',
        coverNote: coverNote || undefined,
        tailoredJson: tailoredBullets ? JSON.stringify(tailoredBullets) : undefined,
      },
    });

    res.json({ success: true, application: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Auto-Submit Application via Playwright
app.post('/api/applications/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: { include: { company: true } }, user: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { job, user } = application;
    const applicantInfo = {
      fullName: user.fullName || 'Alex Founder',
      email: user.email || 'alex@founder.ai',
      phone: user.phone || '555-019-2831',
      linkedinUrl: user.linkedinUrl || '',
      githubUrl: user.githubUrl || '',
      portfolioUrl: user.portfolioUrl || '',
      location: user.location || 'San Francisco, CA',
      coverNote: application.coverNote || '',
      resumePath: user.resumeFileUrl ? path.join(__dirname, '..', user.resumeFileUrl) : undefined,
      legallyAuthorized: user.legallyAuthorized ?? true,
      requiresSponsorship: user.requiresSponsorship ?? false,
      openToRelocation: user.openToRelocation ?? true,
      openToInPerson: user.openToInPerson ?? true,
      gender: user.gender || 'Decline to self-identify',
      race: user.race || 'Decline to self-identify',
      veteranStatus: user.veteranStatus || 'Decline to self-identify',
      disabilityStatus: user.disabilityStatus || 'Decline to self-identify',
    };

    const isDryRun = req.body.dryRun === true;
    console.log(`[AutoSubmit] Submitting application ${id} for ${job.title} at ${job.company.name} (dryRun=${isDryRun})`);

    const submission = await submitApplicationToATS(
      job.atsType,
      job.url,
      applicantInfo,
      isDryRun
    );

    if (submission.success) {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          status: 'submitted',
          submittedAt: submission.submittedAt || new Date(),
          screenshotUrl: submission.screenshotUrl,
        },
      });
      return res.json({ success: true, application: updated, submission });
    } else {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          status: 'failed',
          errorMessage: submission.error,
        },
      });
      return res.status(400).json({ success: false, application: updated, error: submission.error });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Get Applications List (Tracker)
app.get('/api/applications', async (req, res) => {
  try {
    const user = await getUserFromReq(req);
    const apps = await prisma.application.findMany({
      where: { userId: user.id },
      include: {
        job: {
          include: { company: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications: apps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Seed Default Companies and Jobs on Startup
app.post('/api/seed', async (req, res) => {
  try {
    const { seedCompanies } = await import('./scripts/seedCompanies');
    await seedCompanies();
    const stats = await pollAllActiveCompanies();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] AI/ML Job Auto-Apply API running on port ${PORT}`);
});
