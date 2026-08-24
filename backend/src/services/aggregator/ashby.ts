import axios from 'axios';
import { RawFetchedJob } from './types';

export async function fetchAshbyJobs(orgName: string): Promise<RawFetchedJob[]> {
  try {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(orgName)}?includeCompensation=true`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data || !Array.isArray(response.data.jobs)) {
      return [];
    }

    return response.data.jobs.map((job: any) => ({
      externalId: String(job.id),
      title: job.title || '',
      description: job.descriptionHtml || job.descriptionPlain || job.title || '',
      location: job.locationName || 'Remote / Unspecified',
      url: job.jobUrl || `https://jobs.ashbyhq.com/${orgName}/${job.id}`,
      postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
      rawJson: job,
    }));
  } catch (error: any) {
    console.error(`[Ashby] Error fetching jobs for ${orgName}:`, error.message);
    return [];
  }
}
