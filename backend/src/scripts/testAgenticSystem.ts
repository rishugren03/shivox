import 'dotenv/config';
import { submitApplicationToATS } from '../services/automation/submitter';
import { ApplicantInfo } from '../services/automation/types';

async function main() {
  const applicant: ApplicantInfo = {
    fullName: 'Rishu Kumar',
    email: 'rishugren03@gmail.com',
    phone: '555-019-2831',
    location: 'San Francisco, CA',
    linkedinUrl: 'https://linkedin.com/in/rishu-kumar',
    githubUrl: 'https://github.com/rishugren03',
    portfolioUrl: 'https://github.com/rishugren03',
    legallyAuthorized: true,
    requiresSponsorship: false,
    openToRelocation: true,
    openToInPerson: true,
    gender: 'Male',
    race: 'Asian',
    veteranStatus: 'No',
    disabilityStatus: 'No',
  };

  // Active Ashby job link for ElevenLabs Infrastructure Security Engineer
  const url = 'https://jobs.ashbyhq.com/elevenlabs/687394d7-fbf8-49ed-822e-c0690191330c';
  console.log('[TestAgenticSystem] Executing multi-agent dry-run test...');
  
  const result = await submitApplicationToATS(
    'ashby',
    url,
    applicant,
    true, // dryRun = true
    'Infrastructure Security Engineer',
    'ElevenLabs',
    'Secure cloud infrastructure, containerized microservices, voice AI APIs, and developer toolchains at ElevenLabs.'
  );

  console.log('[TestAgenticSystem] Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
