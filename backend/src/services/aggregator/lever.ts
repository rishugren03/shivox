import axios from 'axios';
import { RawFetchedJob } from './types';

export async function fetchLeverJobs(companySlug: string): Promise<RawFetchedJob[]> {
  try {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(companySlug)}?mode=json`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    if (!Array.isArray(response.data)) {
      return [];
    }

    return response.data.map((job: any) => {
      const descriptionHtml = job.content?.descriptionHtml || '';
      const listsHtml = Array.isArray(job.content?.lists)
        ? job.content.lists.map((l: any) => `<h3>${l.text}</h3>${l.content}`).join('')
        : '';
      const fullDesc = `${descriptionHtml} ${listsHtml}`.trim() || job.text || '';

      return {
        externalId: String(job.id),
        title: job.text || '',
        description: fullDesc,
        location: job.categories?.location || 'Remote / Unspecified',
        url: job.hostedUrl || `https://jobs.lever.co/${companySlug}/${job.id}`,
        postedAt: job.createdAt ? new Date(job.createdAt) : undefined,
        rawJson: job,
      };
    });
  } catch (error: any) {
    console.error(`[Lever] Error fetching jobs for ${companySlug}:`, error.message);
    return [];
  }
}
