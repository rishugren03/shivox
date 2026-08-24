import axios from 'axios';
import { RawFetchedJob } from './types';

export async function fetchGreenhouseJobs(boardToken: string): Promise<RawFetchedJob[]> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs`;
    const response = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    
    if (!response.data || !Array.isArray(response.data.jobs)) {
      return [];
    }

    return response.data.jobs.map((job: any) => {
      const locationName = job.location?.name || 'Remote / Unspecified';
      const departments = Array.isArray(job.departments) ? job.departments.map((d: any) => d.name).join(', ') : '';
      const descriptionText = job.content || `${job.title} - ${locationName}${departments ? ` (${departments})` : ''}`;

      return {
        externalId: String(job.id),
        title: job.title || '',
        description: descriptionText,
        location: locationName,
        url: job.absolute_url || `https://boards.greenhouse.io/${boardToken}/jobs/${job.id}`,
        postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
        rawJson: job,
      };
    });
  } catch (error: any) {
    console.error(`[Greenhouse] Error fetching jobs for ${boardToken}:`, error.message);
    return [];
  }
}
