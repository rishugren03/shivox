import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fillApplicationAgentically, AgenticFillOptions } from '../services/automation/agenticFiller';
import { ApplicantInfo } from '../services/automation/types';

/**
 * E2E Dry-Run Test Harness for All 3 ATS Providers
 * 
 * Runs headless Playwright form fills against live job URLs
 * WITHOUT actually submitting. Captures structured logs & screenshots.
 * 
 * Calls fillApplicationAgentically directly to pass masterResumeJson
 * (the submitter.ts router doesn't forward it, which is itself an issue).
 */

interface TestCase {
  name: string;
  atsType: string;
  url: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
}

interface TestResult {
  testCase: string;
  atsType: string;
  url: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
  isConfirmed: boolean;
  failureReason?: string;
  screenshotUrl?: string;
  error?: string;
  validationMessages?: string[];
  preSubmitGateFailure?: string;
}

const applicant: ApplicantInfo = {
  fullName: 'Rishu Kumar',
  firstName: 'Rishu',
  lastName: 'Kumar',
  email: 'rishugren03@gmail.com',
  phone: '555-019-2831',
  location: 'San Francisco, CA',
  linkedinUrl: 'https://linkedin.com/in/rishu-kumar',
  githubUrl: 'https://github.com/rishugren03',
  portfolioUrl: 'https://github.com/rishugren03',
  coverNote: 'I am eager to bring my expertise in AI engineering, LLM agent workflows, and high-performance systems to this role. My experience building production LLM pipelines and real-time streaming applications directly aligns with your engineering needs.',
  legallyAuthorized: true,
  requiresSponsorship: false,
  openToRelocation: true,
  openToInPerson: true,
  gender: 'Male',
  race: 'Asian',
  veteranStatus: 'I am not a protected veteran',
  disabilityStatus: 'No, I do not have a disability',
};

// Mock master resume JSON (minimal but sufficient to pass the guard)
const mockMasterResumeJson = {
  name: 'Rishu Kumar',
  email: 'rishugren03@gmail.com',
  phone: '555-019-2831',
  location: 'San Francisco, CA',
  summary: 'AI Engineer with expertise in LLM agent workflows, real-time streaming, and high-performance distributed systems. Built production multi-agent application pipelines using Playwright, Claude, and GPT-4.',
  experience: [
    {
      title: 'AI Engineer',
      company: 'Stealth Startup',
      dates: '2025 - Present',
      bullets: [
        'Built autonomous multi-agent application system with Playwright and Claude 3.5 Sonnet for ATS form automation.',
        'Designed real-time voice AI streaming pipeline using WebRTC and WebSocket protocols.',
        'Implemented role-aware job matching algorithms using vector embeddings and cosine similarity.',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'Tech Company',
      dates: '2023 - 2025',
      bullets: [
        'Developed distributed microservices handling 10k+ requests/second with Node.js and PostgreSQL.',
        'Built CI/CD pipelines and containerized applications using Docker and Kubernetes.',
      ],
    },
  ],
  education: [
    {
      school: 'University of California',
      degree: 'B.S. Computer Science',
      graduationDate: '2023',
    },
  ],
  skills: ['TypeScript', 'Python', 'Node.js', 'React', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'OpenAI API', 'Playwright', 'LLM Agents', 'WebRTC'],
};

// Active job URLs for each ATS
const testCases: TestCase[] = [
  {
    name: 'Ashby – ElevenLabs',
    atsType: 'ashby',
    url: 'https://jobs.ashbyhq.com/elevenlabs/687394d7-fbf8-49ed-822e-c0690191330c',
    jobTitle: 'Infrastructure Security Engineer',
    jobCompany: 'ElevenLabs',
    jobDescription: 'Security infrastructure, cloud platforms, containerized microservices, voice AI APIs and developer toolchains.',
  },
  {
    name: 'Greenhouse – Warp',
    atsType: 'greenhouse',
    url: 'https://job-boards.greenhouse.io/warp/jobs/4015694005',
    jobTitle: 'Software Engineer',
    jobCompany: 'Warp',
    jobDescription: 'Building high-performance terminal applications, Rust systems core, reactive UI frameworks, and cloud developer tools.',
  },
  {
    name: 'Lever – Verkada',
    atsType: 'lever',
    url: 'https://jobs.lever.co/verkada/8be7dfe3-06e5-465e-9bb6-80c6a2e1e4d1',
    jobTitle: 'Software Engineer, Backend',
    jobCompany: 'Verkada',
    jobDescription: 'Building cloud infrastructure for physical security cameras, access control, AI-based video analytics.',
  },
];

async function runSingleTest(tc: TestCase): Promise<TestResult> {
  const startedAt = new Date();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[TEST] Starting: ${tc.name}`);
  console.log(`[TEST] ATS: ${tc.atsType} | URL: ${tc.url}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const opts: AgenticFillOptions = {
      url: tc.url,
      applicant,
      jobTitle: tc.jobTitle,
      jobCompany: tc.jobCompany,
      jobDescription: tc.jobDescription,
      dryRun: true,
      masterResumeJson: mockMasterResumeJson,
      masterResumeText: `${mockMasterResumeJson.name}\n${mockMasterResumeJson.summary}\n\nExperience:\n${mockMasterResumeJson.experience.map(e => `${e.title} at ${e.company}\n${e.bullets.join('\n')}`).join('\n\n')}\n\nSkills: ${mockMasterResumeJson.skills.join(', ')}`,
    };

    const result = await fillApplicationAgentically(opts);

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    const testResult: TestResult = {
      testCase: tc.name,
      atsType: tc.atsType,
      url: tc.url,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      success: result.success,
      isConfirmed: result.isConfirmed || false,
      failureReason: result.failureReason,
      screenshotUrl: result.screenshotUrl,
      error: result.error,
      validationMessages: result.validationMessages,
      preSubmitGateFailure: result.preSubmitGateFailure,
    };

    const statusEmoji = result.success ? '✅' : '❌';
    console.log(`\n[TEST] ${statusEmoji} ${tc.name} completed in ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`[TEST] Success: ${result.success} | Confirmed: ${result.isConfirmed}`);
    if (result.failureReason) console.log(`[TEST] Failure Reason: ${result.failureReason}`);
    if (result.error) console.log(`[TEST] Error: ${result.error}`);
    if (result.screenshotUrl) console.log(`[TEST] Screenshot: ${result.screenshotUrl}`);
    if (result.preSubmitGateFailure) console.log(`[TEST] PreSubmit Gate: ${result.preSubmitGateFailure}`);

    return testResult;
  } catch (err: any) {
    const completedAt = new Date();
    console.error(`\n[TEST] ❌ ${tc.name} CRASHED: ${err.message}`);
    return {
      testCase: tc.name,
      atsType: tc.atsType,
      url: tc.url,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      success: false,
      isConfirmed: false,
      failureReason: 'CRASH',
      error: err.message,
    };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        ATS E2E DRY-RUN TEST HARNESS (all 3 providers)          ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Time: ${new Date().toISOString().padEnd(55)}║`);
  console.log(`║  Mode: DRY RUN (no actual submissions)${' '.repeat(25)}║`);
  console.log(`║  Tests: ${testCases.length} ATS providers${' '.repeat(39)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const results: TestResult[] = [];

  // Run tests SEQUENTIALLY to avoid resource contention
  for (const tc of testCases) {
    const result = await runSingleTest(tc);
    results.push(result);
  }

  // Save structured JSON log
  const logsDir = path.join(__dirname, '../../uploads/test-logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFileName = `ats_e2e_${Date.now()}.json`;
  const logPath = path.join(logsDir, logFileName);
  const logData = {
    testRunAt: new Date().toISOString(),
    mode: 'dry_run',
    applicant: { fullName: applicant.fullName, email: applicant.email },
    totalTests: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };

  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));

  // Print Summary
  console.log(`\n${'═'.repeat(80)}`);
  console.log('                         TEST RUN SUMMARY');
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Total: ${results.length} | Passed: ${logData.passed} | Failed: ${logData.failed}`);
  console.log(`  Log saved: ${logPath}\n`);

  for (const r of results) {
    const emoji = r.success ? '✅' : '❌';
    console.log(`  ${emoji} ${r.testCase.padEnd(30)} ${(r.durationMs / 1000).toFixed(1)}s  ${r.failureReason || 'OK'}`);
  }

  console.log(`\n${'═'.repeat(80)}\n`);

  // Exit with non-zero if any test failed
  if (logData.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[TestAllATS] Fatal error:', err);
  process.exit(2);
});
