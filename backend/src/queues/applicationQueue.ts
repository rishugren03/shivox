import { Queue, Worker, Job as BullJob } from 'bullmq';
import { redisConnection } from '../config/redis';
import { prisma } from '../config/prisma';
import { generateMatchReason, tailorResumeForJob } from '../services/ai/openai';
import { calculateMatchScore, generateOpenAIEmbedding, computeCosineSimilarity } from '../services/ai/embeddings';
import { submitApplicationToATS } from '../services/automation/submitter';
import path from 'path';

export const APPLICATION_QUEUE_NAME = 'tsenta-application-queue';

export interface ApplicationJobData {
  applicationId: string;
  autoSubmit?: boolean;
}

export const applicationQueue = new Queue<ApplicationJobData>(APPLICATION_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const applicationWorker = new Worker<ApplicationJobData>(
  APPLICATION_QUEUE_NAME,
  async (job: BullJob<ApplicationJobData>) => {
    const { applicationId, autoSubmit } = job.data;
    console.log(`[BullMQ Worker] Processing job ${job.id} for application ${applicationId}`);

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: { include: { company: true } },
        user: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    const { job: jobPosting, user } = application;

    // 1. Update status to 'tailoring'
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'tailoring' },
    });

    // 2. Fetch active resume version or fallback user resume
    const activeResumeVersion = await prisma.resumeVersion.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { uploadedAt: 'desc' },
    });

    const userResumeText = activeResumeVersion?.resumeText || user.resumeText || '';
    const userResumeJson = activeResumeVersion?.resumeJson
      ? JSON.parse(activeResumeVersion.resumeJson)
      : user.resumeJson
      ? JSON.parse(user.resumeJson)
      : {};

    // 3. Compute real embedding match score if available, or fallback similarity
    let matchScore = 80;
    try {
      let userEmbedding: number[] = [];
      if (activeResumeVersion?.embedding) {
        userEmbedding = JSON.parse(activeResumeVersion.embedding);
      } else if (user.embedding) {
        userEmbedding = JSON.parse(user.embedding);
      } else if (userResumeText) {
        userEmbedding = await generateOpenAIEmbedding(userResumeText);
      }

      let jobEmbedding: number[] = [];
      if (jobPosting.embedding) {
        jobEmbedding = JSON.parse(jobPosting.embedding);
      } else {
        jobEmbedding = await generateOpenAIEmbedding(`${jobPosting.title} ${jobPosting.description}`);
      }

      if (userEmbedding.length > 0 && jobEmbedding.length > 0) {
        const sim = computeCosineSimilarity(userEmbedding, jobEmbedding);
        matchScore = Math.min(Math.max(Math.round(sim * 100), 50), 99);
      } else {
        matchScore = calculateMatchScore(userResumeText, `${jobPosting.title} ${jobPosting.description}`);
      }
    } catch (e) {
      matchScore = calculateMatchScore(userResumeText, `${jobPosting.title} ${jobPosting.description}`);
    }

    // 4. Generate match reason and tailored bullets preserving candidate's authentic experience
    const matchReason = await generateMatchReason(userResumeJson, jobPosting.title, jobPosting.description);
    const tailored = await tailorResumeForJob(
      userResumeJson,
      userResumeText,
      jobPosting.title,
      jobPosting.description
    );

    const updatedStatus = autoSubmit || user.autoApplyEnabled ? 'approved' : 'pending_review';

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: updatedStatus,
        matchScore,
        matchReason,
        tailoredJson: JSON.stringify(tailored.tailoredBullets),
        coverNote: tailored.coverNote,
      },
    });

    // 5. If auto-apply enabled, submit to ATS via Playwright
    if (autoSubmit || user.autoApplyEnabled) {
      console.log(`[BullMQ Worker] Auto-submitting application ${applicationId} to ${jobPosting.company.name}`);
      
      const applicantInfo = {
        fullName: user.fullName || 'Candidate',
        email: user.email || '',
        phone: user.phone || '',
        linkedinUrl: user.linkedinUrl || '',
        githubUrl: user.githubUrl || '',
        portfolioUrl: user.portfolioUrl || '',
        location: user.location || '',
        coverNote: tailored.coverNote || '',
        resumePath: user.resumeFileUrl ? path.join(__dirname, '../../uploads', path.basename(user.resumeFileUrl)) : undefined,
        legallyAuthorized: user.legallyAuthorized ?? true,
        requiresSponsorship: user.requiresSponsorship ?? false,
        openToRelocation: user.openToRelocation ?? true,
        openToInPerson: user.openToInPerson ?? true,
        gender: user.gender || 'Decline to self-identify',
        race: user.race || 'Decline to self-identify',
        veteranStatus: user.veteranStatus || 'Decline to self-identify',
        disabilityStatus: user.disabilityStatus || 'Decline to self-identify',
      };

      const submission = await submitApplicationToATS(
        jobPosting.atsType,
        jobPosting.url,
        applicantInfo,
        false
      );

      if (submission.success) {
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            status: 'submitted',
            submittedAt: submission.submittedAt || new Date(),
            screenshotUrl: submission.screenshotUrl,
          },
        });
      } else {
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            status: 'failed',
            errorMessage: submission.error,
          },
        });
        throw new Error(`ATS submission failed: ${submission.error}`);
      }
    }

    return { applicationId, status: 'success' };
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

applicationWorker.on('failed', (job, err) => {
  console.error(`[BullMQ Worker] Job ${job?.id} failed with error:`, err.message);
});

export async function getQueueStatus() {
  const [active, waiting, completed, failed] = await Promise.all([
    applicationQueue.getActiveCount(),
    applicationQueue.getWaitingCount(),
    applicationQueue.getCompletedCount(),
    applicationQueue.getFailedCount(),
  ]);
  return { active, waiting, completed, failed };
}
