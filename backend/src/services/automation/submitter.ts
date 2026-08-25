import { fillApplicationAgentically } from './agenticFiller';
import { fillGreenhouseApplication } from './greenhouseFiller';
import { fillLeverApplication } from './leverFiller';
import { fillAshbyApplication } from './ashbyFiller';
import { ApplicantInfo, SubmissionResult } from './types';

export async function submitApplicationToATS(
  atsType: string,
  url: string,
  applicant: ApplicantInfo,
  dryRun = false,
  jobTitle?: string,
  jobCompany?: string,
  jobDescription?: string,
  applicationId?: string
): Promise<SubmissionResult> {
  const type = atsType.toLowerCase();
  
  // Route Ashby, Greenhouse, Lever applications through the agentic multi-agent filler pipeline
  if (type === 'ashby' || type === 'greenhouse' || type === 'lever') {
    console.log(`[Submitter] Routing ATS application (${atsType}) through Multi-Agent System...`);
    try {
      return await fillApplicationAgentically({
        url,
        applicant,
        jobTitle,
        jobCompany,
        jobDescription,
        dryRun,
        applicationId,
      });
    } catch (err: any) {
      console.warn(`[Submitter] Agentic filler warning, trying legacy fallback:`, err.message);
      if (type === 'greenhouse') return fillGreenhouseApplication(url, applicant, dryRun);
      if (type === 'lever') return fillLeverApplication(url, applicant, dryRun);
      if (type === 'ashby') return fillAshbyApplication(url, applicant, dryRun);
    }
  }

  return {
    success: false,
    error: `Unsupported ATS type: ${atsType}`,
  };
}
