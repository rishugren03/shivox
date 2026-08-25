import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

import { prisma } from './config/prisma';
import { pollAllActiveCompanies } from './services/aggregator/poller';
import { parseResumeWithOpenAI, generateMatchReason, tailorResumeForJob } from './services/ai/openai';
import { calculateMatchScore, generateOpenAIEmbedding, computeCosineSimilarity } from './services/ai/embeddings';
import { submitApplicationToATS } from './services/automation/submitter';
import { authenticateJWT, generateToken, AuthenticatedRequest } from './middleware/auth';
import { applicationQueue, getQueueStatus } from './queues/applicationQueue';

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

// PDF Text Extraction Helper
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

// Helper to extract or fallback user profile
async function getOrInitUser(req: AuthenticatedRequest) {
  if (req.user) return req.user;
  let user = await prisma.userProfile.findFirst();
  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    user = await prisma.userProfile.create({
      data: {
        fullName: 'Alex Candidate',
        email: 'alex@candidate.ai',
        passwordHash,
        phone: '555-019-2831',
        isOnboardingComplete: false,
        autoApplyEnabled: true,
      },
    });
  }
  return user;
}

// SSE Clients List for real-time status pushing
let sseClients: Response[] = [];

export function broadcastSSEUpdate(data: any) {
  sseClients.forEach((client) => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// 1. Healthcheck & Queue Status
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.get('/api/queue/status', async (req, res) => {
  try {
    const metrics = await getQueueStatus();
    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. SSE Real-Time Updates Endpoint
app.get('/api/applications/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sseClients.push(res);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// 3. Auth Routes (Register, Login, Me)
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

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.userProfile.create({
      data: {
        email,
        passwordHash,
        fullName: fullName || email.split('@')[0],
        isOnboardingComplete: false,
        targetJobTitles: JSON.stringify(['Software Engineer', 'Voice AI Specialist', 'Fullstack Engineer']),
        preferredLocations: JSON.stringify(['Remote', 'San Francisco, CA']),
        remotePreference: 'any',
        experienceLevel: 'Mid-Senior',
        minSalary: 120000,
        preferredSkills: JSON.stringify(['Python', 'PyTorch', 'TypeScript', 'Voice AI']),
        autoApplyEnabled: true,
      },
    });

    const token = generateToken(newUser);
    res.json({ success: true, user: newUser, token });
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
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({ success: true, user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Complete Onboarding
app.post('/api/user/onboarding/complete', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const updated = await prisma.userProfile.update({
      where: { id: user.id },
      data: { isOnboardingComplete: true },
    });
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Poll job boards on-demand
app.post('/api/jobs/poll', authenticateJWT, async (req, res) => {
  try {
    const stats = await pollAllActiveCompanies();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get Swipe Deck Jobs (Sorted by Percent Matches for User Profile)
app.get('/api/jobs/deck', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const category = (req.query.category as string) || 'fulltime';

    const existingApps = await prisma.application.findMany({
      where: { userId: user.id },
      select: { jobId: true },
    });
    const swipedJobIds = new Set(existingApps.map((a) => a.jobId));

    // Fetch all active/unclosed jobs across all companies for requested category
    const jobs = await prisma.job.findMany({
      where: { closed: false, category },
      include: { company: true },
    });

    const unswiped = jobs.filter((j) => !swipedJobIds.has(j.id));
    const userResumeText = JSON.stringify(user.resumeJson || user.resumeText || '');
    const userTargetTitles: string[] = user.targetJobTitles ? JSON.parse(user.targetJobTitles) : [];
    const userSkills: string[] = user.preferredSkills ? JSON.parse(user.preferredSkills) : [];
    const userLocations: string[] = user.preferredLocations ? JSON.parse(user.preferredLocations) : [];
    const now = new Date().getTime();

    const deck = unswiped.map((job) => {
      const matchResult = calculateMatchScore(userResumeText, `${job.title} ${job.description}`, {
        jobTitle: job.title,
        targetTitles: userTargetTitles,
        userSkills,
      });

      const ageHours = (now - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60);
      let freshnessBonus = 0;
      if (!matchResult.isRoleMismatch) {
        if (ageHours <= 24) freshnessBonus = 10;
        else if (ageHours <= 48) freshnessBonus = 5;
      }

      let locationBonus = 0;
      if (!matchResult.isRoleMismatch && userLocations.length > 0 && userLocations.some((loc) => (job.location || 'Remote').toLowerCase().includes(loc.toLowerCase()))) {
        locationBonus = 5;
      }

      const finalScore = matchResult.isRoleMismatch
        ? matchResult.score
        : Math.min(Math.round(matchResult.score + freshnessBonus + locationBonus), 99);

      return {
        ...job,
        matchScore: finalScore,
        isFresh: ageHours <= 24,
        whyFit: matchResult.whyFit,
      };
    });

    // Sort ALL available jobs strictly descending by percent match score (Highest match first)
    deck.sort((a, b) => b.matchScore - a.matchScore);
    res.json({ jobs: deck });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Upload & Version Resume
app.post('/api/resume/upload', authenticateJWT, upload.single('resume'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
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
      parsedJson = await parseResumeWithOpenAI(textContent);
    } else {
      parsedJson = {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        skills: ['Python', 'TypeScript', 'Voice AI', 'React', 'Node.js'],
        experience: [],
      };
    }

    // Generate real OpenAI vector embedding
    const embeddingVector = await generateOpenAIEmbedding(textContent || JSON.stringify(parsedJson));

    // Deactivate previous resume versions
    await prisma.resumeVersion.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : user.resumeFileUrl || '';

    // Create new active ResumeVersion
    const resumeVersion = await prisma.resumeVersion.create({
      data: {
        userId: user.id,
        fileUrl,
        fileName: req.file ? req.file.originalname : 'Resume.pdf',
        resumeText: textContent,
        resumeJson: JSON.stringify(parsedJson),
        embedding: JSON.stringify(embeddingVector),
        isActive: true,
      },
    });

    // Update UserProfile active resume metadata (preserve account email)
    const updatedUser = await prisma.userProfile.update({
      where: { id: user.id },
      data: {
        fullName: user.fullName || parsedJson.fullName,
        phone: parsedJson.phone || user.phone,
        location: parsedJson.location || user.location,
        resumeText: textContent || user.resumeText,
        resumeJson: JSON.stringify(parsedJson),
        resumeFileUrl: fileUrl,
        embedding: JSON.stringify(embeddingVector),
      },
    });

    res.json({ success: true, profile: updatedUser, resumeVersion });
  } catch (err: any) {
    console.error('[ResumeUpload] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get User Resume Versions
app.get('/api/resume/versions', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const versions = await prisma.resumeVersion.findMany({
      where: { userId: user.id },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json({ versions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Activate a Resume Version
app.post('/api/resume/versions/:id/activate', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const { id } = req.params;

    await prisma.resumeVersion.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    const targetVersion = await prisma.resumeVersion.update({
      where: { id: id as string },
      data: { isActive: true },
    });

    await prisma.userProfile.update({
      where: { id: user.id },
      data: {
        resumeText: targetVersion.resumeText,
        resumeJson: targetVersion.resumeJson,
        resumeFileUrl: targetVersion.fileUrl,
        embedding: targetVersion.embedding,
      },
    });

    res.json({ success: true, activeVersion: targetVersion });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get User Profile & Preferences
app.get('/api/user/profile', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    res.json({ profile: user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/profile', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const payload = { ...req.body };
    if (Array.isArray(payload.targetJobTitles)) payload.targetJobTitles = JSON.stringify(payload.targetJobTitles);
    if (Array.isArray(payload.preferredLocations)) payload.preferredLocations = JSON.stringify(payload.preferredLocations);
    if (Array.isArray(payload.preferredSkills)) payload.preferredSkills = JSON.stringify(payload.preferredSkills);
    if (payload.minSalary !== undefined) payload.minSalary = parseInt(payload.minSalary, 10) || 0;

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

// 8. ASYNC Swipe Right Handler (Non-Blocking BullMQ Job Enqueue)
app.post('/api/applications/swipe', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { jobId, action } = req.body;
    const user = await getOrInitUser(req);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (action === 'left') {
      const appRecord = await prisma.application.upsert({
        where: { userId_jobId: { userId: user.id, jobId } },
        create: { userId: user.id, jobId, status: 'passed' },
        update: { status: 'passed' },
      });
      return res.json({ success: true, application: appRecord });
    }

    // GAP 2 ENFORCEMENT: Block swipe right if candidate has no active resume
    if (!user.resumeText && !user.resumeJson && !user.resumeFileUrl) {
      return res.status(400).json({
        error: 'Master resume required. Please upload your resume in Profile before applying to jobs.',
      });
    }

    // Create record in 'queued' status
    const appRecord = await prisma.application.upsert({
      where: { userId_jobId: { userId: user.id, jobId } },
      create: {
        userId: user.id,
        jobId,
        status: 'queued',
      },
      update: {
        status: 'queued',
      },
    });

    // Enqueue BullMQ background tailoring job
    await applicationQueue.add('tailor-application', {
      applicationId: appRecord.id,
      autoSubmit: user.autoApplyEnabled,
    });

    broadcastSSEUpdate({ type: 'application_queued', applicationId: appRecord.id, jobId });

    // Respond immediately to unblock UI thread
    res.json({
      success: true,
      application: appRecord,
      message: '⚡ Application queued for background tailoring & submission.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8b. OTP Verification Code Submission Handler
app.post('/api/applications/:id/verify-otp', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Security verification code is required.' });
    }

    const { submitOtpCode, hasPendingOtpSession } = await import('./services/automation/otpResolver');

    if (!hasPendingOtpSession(id as string)) {
      await prisma.application.update({
        where: { id: id as string },
        data: {
          status: 'failed',
          errorMessage: 'OTP verification session expired. Please click Retry to submit again.',
        },
      });
      broadcastSSEUpdate({ type: 'application_updated', applicationId: id });
      return res.status(400).json({
        error: 'OTP session has expired. Application marked as failed—please click Retry to resubmit.',
        isExpired: true,
      });
    }

    console.log(`[Server] Received OTP verification request for application ${id}`);
    const result = await submitOtpCode(id as string, code.trim());

    if (result.success && result.isConfirmed) {
      await prisma.application.update({
        where: { id: id as string },
        data: {
          status: 'submitted',
          submittedAt: new Date(),
          screenshotUrl: result.screenshotUrl,
          errorMessage: null,
        },
      });

      broadcastSSEUpdate({ type: 'application_submitted', applicationId: id });

      return res.json({
        success: true,
        message: '🎉 Security OTP verified! Application submitted successfully.',
        result,
      });
    } else {
      return res.status(400).json({
        error: result.error || 'Failed to verify OTP security code. Please check the code and try again.',
        result,
      });
    }
  } catch (err: any) {
    console.error(`[Server] Error verifying OTP:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// 8c. Retry Failed Application Handler
app.post('/api/applications/:id/retry', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const { id } = req.params;

    if (!user.resumeText && !user.resumeJson && !user.resumeFileUrl) {
      return res.status(400).json({
        error: 'Master resume required. Please upload your resume in Profile before submitting applications.',
      });
    }

    const appRecord = await prisma.application.findFirst({
      where: { id: id as string, userId: user.id },
    });

    if (!appRecord) {
      return res.status(404).json({ error: 'Application record not found.' });
    }

    const updatedApp = await prisma.application.update({
      where: { id: appRecord.id },
      data: {
        status: 'queued',
        errorMessage: null,
      },
      include: { job: { include: { company: true } } },
    });

    // Enqueue BullMQ background job for re-attempt
    await applicationQueue.add('tailor-application', {
      applicationId: updatedApp.id,
      autoSubmit: user.autoApplyEnabled !== false,
    });

    broadcastSSEUpdate({ type: 'application_queued', applicationId: updatedApp.id, jobId: updatedApp.jobId });

    res.json({
      success: true,
      application: updatedApp,
      message: '⚡ Failed application re-queued for background submission.',
    });
  } catch (err: any) {
    console.error(`[Server] Error retrying application ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// 9. Paginated Applications List (Tracker - excludes passed/skipped)
app.get('/api/applications', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const skip = (page - 1) * limit;

    const { hasPendingOtpSession } = await import('./services/automation/otpResolver');

    const [apps, total] = await Promise.all([
      prisma.application.findMany({
        where: { userId: user.id, status: { not: 'passed' } },
        include: { job: { include: { company: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.application.count({ where: { userId: user.id, status: { not: 'passed' } } }),
    ]);

    // Check for expired OTP sessions and mark them as failed
    for (const app of apps) {
      if (app.status === 'requires_otp' && !hasPendingOtpSession(app.id)) {
        console.warn(`[Server] Marking application ${app.id} as failed due to expired OTP session.`);
        await prisma.application.update({
          where: { id: app.id },
          data: {
            status: 'failed',
            errorMessage: 'OTP session expired (5 min timeout). Please click Retry to submit again.',
          },
        });
        app.status = 'failed';
        app.errorMessage = 'OTP session expired (5 min timeout). Please click Retry to submit again.';
      }
    }

    res.json({
      applications: apps,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9b. Skipped Postings List
app.get('/api/applications/skipped', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const skippedApps = await prisma.application.findMany({
      where: { userId: user.id, status: 'passed' },
      include: { job: { include: { company: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const userResumeText = JSON.stringify(user.resumeJson || user.resumeText || '');
    const userTargetTitles: string[] = user.targetJobTitles ? JSON.parse(user.targetJobTitles) : [];
    const userSkills: string[] = user.preferredSkills ? JSON.parse(user.preferredSkills) : [];

    const enriched = skippedApps.map((app) => {
      const job = app.job;
      const matchResult = calculateMatchScore(userResumeText, `${job.title} ${job.description}`, {
        jobTitle: job.title,
        targetTitles: userTargetTitles,
        userSkills,
      });

      return {
        ...app,
        matchScore: app.matchScore || matchResult.score,
        whyFit: matchResult.whyFit,
      };
    });

    res.json({ skipped: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9c. Restore / Unskip Posting (Removes 'passed' record so it reappears in deck)
app.post('/api/applications/:id/unskip', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const { id } = req.params;

    const existing = await prisma.application.findFirst({
      where: { id: id as string, userId: user.id, status: 'passed' },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Skipped application record not found' });
    }

    await prisma.application.delete({
      where: { id: existing.id },
    });

    res.json({ success: true, message: 'Posting restored to Swipe Deck' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9d. Apply to Skipped Posting (Moves from 'passed' to 'queued' and triggers AI pipeline)
app.post('/api/applications/:id/apply-skipped', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrInitUser(req);
    const { id } = req.params;

    if (!user.resumeText && !user.resumeJson && !user.resumeFileUrl) {
      return res.status(400).json({
        error: 'Master resume required. Please upload your resume in Profile before applying to jobs.',
      });
    }

    const appRecord = await prisma.application.update({
      where: { id: id as string },
      data: { status: 'queued' },
      include: { job: { include: { company: true } } },
    });

    await applicationQueue.add('tailor-application', {
      applicationId: appRecord.id,
      autoSubmit: user.autoApplyEnabled,
    });

    broadcastSSEUpdate({ type: 'application_queued', applicationId: appRecord.id, jobId: appRecord.jobId });

    res.json({
      success: true,
      application: appRecord,
      message: '⚡ Application queued for background tailoring & submission.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Seed Companies & Poll
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
  console.log(`[Server] Tsenta AI Job Application API running on port ${PORT}`);
});
