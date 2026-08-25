import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { pollAllActiveCompanies, pollCompanyJobs } from '../services/aggregator/poller';

export const JOB_AGGREGATION_QUEUE_NAME = 'job-aggregation';

export const jobAggregationQueue = new Queue(JOB_AGGREGATION_QUEUE_NAME, {
  connection: redisConnection,
});

export function setupJobAggregationWorker() {
  const worker = new Worker(
    JOB_AGGREGATION_QUEUE_NAME,
    async (job) => {
      console.log(`[JobQueue] Starting job: ${job.name} (id: ${job.id})`);
      if (job.name === 'poll-all-companies') {
        const stats = await pollAllActiveCompanies();
        console.log(`[JobQueue] Polling complete. Added: ${stats.totalAdded}, Updated: ${stats.totalUpdated}, Closed: ${stats.totalClosed}`);
        return stats;
      } else if (job.name === 'poll-single-company' && job.data.companyId) {
        const stats = await pollCompanyJobs(job.data.companyId);
        console.log(`[JobQueue] Polled company ${job.data.companyId}. Added: ${stats.added}, Updated: ${stats.updated}, Closed: ${stats.closed}`);
        return stats;
      }
    },
    { connection: redisConnection }
  );

  worker.on('failed', (job, err) => {
    console.error(`[JobQueue] Worker failed on job ${job?.id}:`, err);
  });

  return worker;
}

export async function scheduleRepeatingPolling() {
  // Repeat every 3 hours
  await jobAggregationQueue.add(
    'poll-all-companies',
    {},
    {
      repeat: {
        pattern: '0 */3 * * *',
      },
      jobId: 'repeat-poll-all-companies',
    } as any
  );
  console.log('[JobQueue] Scheduled repeating job aggregation every 3 hours.');
}
