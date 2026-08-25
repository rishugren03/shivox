import { calculateMatchScore, categorizeRole, RoleCategory } from '../services/ai/embeddings';

async function testMatchScoring() {
  console.log('=== TESTING ROLE CATEGORIZATION & MATCH SCORING ===\n');

  const engineeringCandidate = {
    resumeText: 'Experienced Senior Fullstack & Voice AI Engineer proficient in Python, PyTorch, TypeScript, React, Node.js, and WebSockets. Built real-time speech AI agents and distributed systems.',
    targetTitles: ['Software Engineer', 'Voice AI Specialist', 'Fullstack Engineer'],
    skills: ['Python', 'TypeScript', 'Voice AI', 'PyTorch', 'React'],
  };

  const jobs = [
    {
      title: 'Sales Development Representative',
      company: 'LiveKit',
      description: 'About LiveKit: LiveKit is the default infrastructure layer for real-time AI, powering voice applications for millions of users. We are hiring an Enterprise SDR to drive top-of-funnel pipeline for enterprise sales. You will build relationships with engineering leaders.',
    },
    {
      title: 'Senior Voice AI Infrastructure Engineer',
      company: 'LiveKit',
      description: 'We are seeking a Senior Voice AI Engineer to build low-latency real-time audio transport and WebSockets infrastructure. Requirements: Python, PyTorch, C++, Voice AI, WebRTC.',
    },
    {
      title: 'Technical Recruiter',
      company: 'LiveKit',
      description: 'Looking for a Technical Recruiter to source top AI and infrastructure software engineering talent.',
    },
    {
      title: 'Fullstack Engineer',
      company: 'OpenAI',
      description: 'Building modern user interfaces and high throughput backend APIs using TypeScript, React, Node.js, and Python.',
    },
    {
      title: 'Account Executive - Enterprise Sales',
      company: 'Vapi AI',
      description: 'Close deals for enterprise voice AI deployment. Drive revenue growth and partner with customer success teams.',
    },
  ];

  console.log(`Candidate Target Titles: [${engineeringCandidate.targetTitles.join(', ')}]`);
  console.log(`Candidate Skills: [${engineeringCandidate.skills.join(', ')}]\n`);

  for (const job of jobs) {
    const roleCat = categorizeRole(`${job.title} ${job.description}`);
    const result = calculateMatchScore(engineeringCandidate.resumeText, `${job.title} ${job.description}`, {
      jobTitle: job.title,
      targetTitles: engineeringCandidate.targetTitles,
      userSkills: engineeringCandidate.skills,
    });

    console.log(`--------------------------------------------------`);
    console.log(`Job Title:   "${job.title}" (${job.company})`);
    console.log(`Detected Cat: ${roleCat}`);
    console.log(`Match Score:  ${result.score}%`);
    console.log(`Mismatch?:    ${result.isRoleMismatch}`);
    console.log(`Why Fit:      "${result.whyFit}"`);
  }
}

testMatchScoring().catch(console.error);
