import { prisma } from '../../config/prisma';
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs } from './lever';
import { fetchAshbyJobs } from './ashby';
import { isAIMLJob } from './filter';
import { RawFetchedJob } from './types';

export async function pollCompanyJobs(companyId: string): Promise<{ added: number; updated: number; closed: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company || !company.active) {
    return { added: 0, updated: 0, closed: 0 };
  }

  let rawJobs: RawFetchedJob[] = [];
  if (company.atsType === 'greenhouse') {
    rawJobs = await fetchGreenhouseJobs(company.boardTokenOrSlug);
  } else if (company.atsType === 'lever') {
    rawJobs = await fetchLeverJobs(company.boardTokenOrSlug);
  } else if (company.atsType === 'ashby') {
    rawJobs = await fetchAshbyJobs(company.boardTokenOrSlug);
  }

  // Filter for AI/ML relevant postings
  const filteredJobs = rawJobs.filter((job) => isAIMLJob(job.title, job.description));
  const fetchedExternalIds = new Set(filteredJobs.map((j) => j.externalId));

  let added = 0;
  let updated = 0;

  for (const jobData of filteredJobs) {
    const existing = await prisma.job.findUnique({
      where: {
        companyId_externalId: {
          companyId: company.id,
          externalId: jobData.externalId,
        },
      },
    });

    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          title: jobData.title,
          description: jobData.description,
          location: jobData.location,
          url: jobData.url,
          closed: false,
          rawJson: JSON.stringify(jobData.rawJson),
        },
      });
      updated++;
    } else {
      await prisma.job.create({
        data: {
          companyId: company.id,
          externalId: jobData.externalId,
          title: jobData.title,
          description: jobData.description,
          location: jobData.location,
          url: jobData.url,
          atsType: company.atsType,
          postedAt: jobData.postedAt,
          rawJson: JSON.stringify(jobData.rawJson),
          embedding: '[]',
        },
      });
      added++;
    }
  }

  // Mark jobs no longer in the API response as closed
  const existingJobs = await prisma.job.findMany({
    where: { companyId: company.id, closed: false },
    select: { id: true, externalId: true },
  });

  let closedCount = 0;
  for (const job of existingJobs) {
    if (!fetchedExternalIds.has(job.externalId)) {
      await prisma.job.update({
        where: { id: job.id },
        data: { closed: true },
      });
      closedCount++;
    }
  }

  return { added, updated, closed: closedCount };
}

export async function pollAllActiveCompanies(): Promise<{ totalAdded: number; totalUpdated: number; totalClosed: number }> {
  const companies = await prisma.company.findMany({
    where: { active: true },
  });

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalClosed = 0;

  for (const company of companies) {
    try {
      const res = await pollCompanyJobs(company.id);
      totalAdded += res.added;
      totalUpdated += res.updated;
      totalClosed += res.closed;
    } catch (err: any) {
      console.error(`Error polling ${company.name} (${company.atsType}):`, err.message);
    }
  }

  return { totalAdded, totalUpdated, totalClosed };
}
