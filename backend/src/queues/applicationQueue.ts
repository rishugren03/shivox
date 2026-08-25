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

    // 3. Compute role-aware match score
    let matchScore = 80;
    try {
      const userTargetTitles: string[] = user.targetJobTitles ? JSON.parse(user.targetJobTitles) : [];
      const userSkills: string[] = user.preferredSkills ? JSON.parse(user.preferredSkills) : [];
      
      const matchResult = calculateMatchScore(userResumeText, `${jobPosting.title} ${jobPosting.description}`, {
        jobTitle: jobPosting.title,
        targetTitles: userTargetTitles,
        userSkills,
      });

      matchScore = matchResult.score;
    } catch (e) {
      console.warn('[BullMQ Worker] Error calculating match score, using fallback 80:', e);
      matchScore = 80;
    }

    // 4. Generate match reason and tailored bullets preserving candidate's authentic experience
    const matchReason = await generateMatchReason(userResumeJson, jobPosting.title, jobPosting.description);
    const tailored = await tailorResumeForJob(
      userResumeJson,
      userResumeText,
      jobPosting.title,
      jobPosting.description
    );

    let submittedResumeUrl = activeResumeVersion?.fileUrl || user.resumeFileUrl || '';

    // Generate tailored PDF if missing keywords need to be incorporated
    if (tailored.requiresTailoring) {
      try {
        const { generateTailoredResume } = await import('../services/ai/agents/resumeTailorAgent');
        const applicantInfo = {
          fullName: user.fullName || 'Candidate',
          email: user.email || '',
          phone: user.phone || '',
          linkedinUrl: user.linkedinUrl || '',
          githubUrl: user.githubUrl || '',
          portfolioUrl: user.portfolioUrl || '',
          location: user.location || '',
          coverNote: tailored.coverNote || '',
          legallyAuthorized: user.legallyAuthorized ?? true,
          requiresSponsorship: user.requiresSponsorship ?? false,
          openToRelocation: user.openToRelocation ?? true,
          openToInPerson: user.openToInPerson ?? true,
        };

        const tailoredResult = await generateTailoredResume({
          applicant: applicantInfo,
          jobTitle: jobPosting.title,
          jobCompany: jobPosting.company.name,
          jobDescription: jobPosting.description,
          masterResumeJson: userResumeJson,
          masterResumeText: userResumeText,
          tailoredBullets: tailored.tailoredBullets,
          tailoredSkills: tailored.tailoredSkills,
        });

        if (tailoredResult.pdfPath) {
          submittedResumeUrl = `/uploads/resumes/${path.basename(tailoredResult.pdfPath)}`;
        }
      } catch (err: any) {
        console.warn(`[BullMQ Worker] Tailored PDF generation warning (${err.message}). Falling back to master resume URL.`);
      }
    } else {
      console.log(`[BullMQ Worker] No missing keywords for "${jobPosting.title}". Submitted resume set to Master Resume: ${submittedResumeUrl}`);
    }

    const updatedStatus = autoSubmit || user.autoApplyEnabled ? 'approved' : 'pending_review';

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: updatedStatus,
        matchScore,
        matchReason,
        tailoredJson: JSON.stringify(tailored.tailoredBullets),
        submittedResumeUrl,
        coverNote: tailored.coverNote,
      },
    });

    // 5. If auto-apply enabled, submit to ATS via Playwright
    if (autoSubmit || user.autoApplyEnabled) {
      console.log(`[BullMQ Worker] Auto-submitting application ${applicationId} to ${jobPosting.company.name}`);
      
      const resumeLocalPath = submittedResumeUrl
        ? path.join(__dirname, '../../', submittedResumeUrl.replace(/^\//, ''))
        : user.resumeFileUrl
        ? path.join(__dirname, '../../uploads', path.basename(user.resumeFileUrl))
        : undefined;

      const applicantInfo = {
        fullName: user.fullName || 'Candidate',
        email: user.email || '',
        phone: user.phone || '',
        linkedinUrl: user.linkedinUrl || '',
        githubUrl: user.githubUrl || '',
        portfolioUrl: user.portfolioUrl || '',
        location: user.location || '',
        coverNote: tailored.coverNote || '',
        resumePath: resumeLocalPath,
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
        false,
        jobPosting.title,
        jobPosting.company?.name,
        jobPosting.description,
        applicationId
      );

      if (submission.success && submission.isConfirmed) {
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            status: 'submitted',
            submittedAt: submission.submittedAt || new Date(),
            screenshotUrl: submission.screenshotUrl,
          },
        });
      } else if (submission.requiresOtp) {
        console.log(`[BullMQ Worker] 🔑 Application ${applicationId} requires OTP verification for ${submission.otpEmail}`);
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            status: 'requires_otp',
            screenshotUrl: submission.screenshotUrl,
            errorMessage: `A security verification code was sent to ${submission.otpEmail || 'your email'}. Enter the 8-character code to complete submission.`,
          },
        });
        
        try {
          const { broadcastSSEUpdate } = await import('../server');
          broadcastSSEUpdate({ type: 'application_updated', applicationId });
        } catch (e) {
          // Ignore SSE import if running standalone
        }

        return { applicationId, status: 'requires_otp', otpEmail: submission.otpEmail };
      } else {
        const failureDetails =
          submission.error ||
          (submission.validationMessages && submission.validationMessages.length > 0
            ? `Form validation error: ${submission.validationMessages.join('; ')}`
            : submission.failureReason === 'SPAM_FLAGGED'
            ? 'Submission flagged as possible spam by ATS anti-bot check.'
            : 'Application submission could not be verified as completed.');

        await prisma.application.update({
          where: { id: applicationId },
          data: {
            status: 'failed',
            errorMessage: failureDetails,
            screenshotUrl: submission.screenshotUrl,
          },
        });
        throw new Error(`ATS submission failed: ${failureDetails}`);
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
