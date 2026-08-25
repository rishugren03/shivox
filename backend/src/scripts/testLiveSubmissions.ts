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
    gender: 'Decline to self-identify',
    race: 'Decline to self-identify',
    veteranStatus: 'Decline to self-identify',
    disabilityStatus: 'Decline to self-identify',
  };

  const testJobs = [
    {
      atsType: 'greenhouse',
      url: 'https://job-boards.greenhouse.io/cresta/jobs/5106468008',
      jobTitle: 'Forward Deployed Engineering Intern (AI Agent)',
      jobCompany: 'Cresta',
    },
    {
      atsType: 'ashby',
      url: 'https://jobs.ashbyhq.com/elevenlabs/687394d7-fbf8-49ed-822e-c0690191330c',
      jobTitle: 'Infrastructure Security Engineer',
      jobCompany: 'ElevenLabs',
    },
  ];

  console.log('=== STARTING LIVE SUBMISSION VERIFICATION TEST ===\n');

  for (const job of testJobs) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Submitting [${job.atsType.toUpperCase()}] ${job.jobCompany} - ${job.jobTitle}`);
    console.log(`URL: ${job.url}`);
    
    const result = await submitApplicationToATS(
      job.atsType,
      job.url,
      applicant,
      false, // live attempt
      job.jobTitle,
      job.jobCompany,
      'Building state-of-the-art AI infrastructure and software systems.'
    );

    console.log(`\n[Result Outcome] for ${job.jobCompany}:`);
    console.log(`- Success: ${result.success}`);
    console.log(`- Is Confirmed: ${result.isConfirmed}`);
    console.log(`- Failure Reason: ${result.failureReason || 'N/A'}`);
    console.log(`- Validation Messages:`, result.validationMessages || []);
    console.log(`- Error Details: ${result.error || 'None'}`);
    console.log(`- Screenshot URL: ${result.screenshotUrl}`);
  }

  console.log('\n==================================================');
  console.log('LIVE SUBMISSION TEST COMPLETED');
}

main().catch(console.error);
