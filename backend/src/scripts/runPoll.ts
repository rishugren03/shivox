import { pollAllActiveCompanies } from '../services/aggregator/poller';
import { prisma } from '../config/prisma';

async function run() {
  console.log('--- Polling All 29 AI/ML Companies ---');
  const stats = await pollAllActiveCompanies();
  console.log(`Polling Complete! Added: ${stats.totalAdded}, Updated: ${stats.totalUpdated}, Closed: ${stats.totalClosed}`);

  const jobCount = await prisma.job.count();
  console.log(`Total AI/ML jobs in Database: ${jobCount}`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
