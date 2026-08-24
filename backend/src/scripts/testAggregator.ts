import { fetchGreenhouseJobs } from '../services/aggregator/greenhouse';
import { fetchLeverJobs } from '../services/aggregator/lever';
import { fetchAshbyJobs } from '../services/aggregator/ashby';
import { isAIMLJob } from '../services/aggregator/filter';

async function test() {
  console.log('--- Testing Live ATS Fetching ---');
  
  console.log('\n[1] Fetching Anthropic (Greenhouse)...');
  const ghJobs = await fetchGreenhouseJobs('anthropic');
  console.log(`Fetched ${ghJobs.length} total jobs from Anthropic.`);
  const ghFiltered = ghJobs.filter(j => isAIMLJob(j.title, j.description));
  console.log(`Filtered ${ghFiltered.length} AI/ML/Voice jobs.`);
  if (ghFiltered.length > 0) {
    console.log(`Sample match: "${ghFiltered[0].title}" (${ghFiltered[0].location}) -> ${ghFiltered[0].url}`);
  }

  console.log('\n[2] Fetching Palantir (Lever)...');
  const leverJobs = await fetchLeverJobs('palantir');
  console.log(`Fetched ${leverJobs.length} total jobs from Palantir.`);
  const leverFiltered = leverJobs.filter(j => isAIMLJob(j.title, j.description));
  console.log(`Filtered ${leverFiltered.length} AI/ML/Voice jobs.`);
  if (leverFiltered.length > 0) {
    console.log(`Sample match: "${leverFiltered[0].title}" (${leverFiltered[0].location}) -> ${leverFiltered[0].url}`);
  }

  console.log('\n[3] Fetching Vapi (Ashby)...');
  const ashbyJobs = await fetchAshbyJobs('vapi');
  console.log(`Fetched ${ashbyJobs.length} total jobs from Vapi.`);
  const ashbyFiltered = ashbyJobs.filter(j => isAIMLJob(j.title, j.description));
  console.log(`Filtered ${ashbyFiltered.length} AI/ML/Voice jobs.`);
  if (ashbyFiltered.length > 0) {
    console.log(`Sample match: "${ashbyFiltered[0].title}" (${ashbyFiltered[0].location}) -> ${ashbyFiltered[0].url}`);
  }
}

test().catch(console.error);
