// Voice AI Engineering keywords
export const VOICE_AI_KEYWORDS = [
  'voice',
  'speech',
  'audio',
  'tts',
  'stt',
  'asr',
  'vapi',
  'livekit',
  'realtime voice',
  'voice ai',
  'voice agent',
  'audio ai',
  'conversational voice',
];

// Software & Full Stack Engineer keywords
export const SOFTWARE_FULLSTACK_KEYWORDS = [
  'software engineer',
  'full stack',
  'fullstack',
  'software developer',
  'backend engineer',
  'frontend engineer',
  'full-stack',
  'web engineer',
  'software',
  'swe',
];

// Explicit exclusions to filter out generic AI/ML research, data science, non-engineering roles
export const EXCLUDED_ROLES = [
  'machine learning engineer',
  'data scientist',
  'research scientist',
  'ai researcher',
  'ml engineer',
  'mlops engineer',
  'data analyst',
  'recruiter',
  'account executive',
  'sales',
  'legal',
  'finance',
  'human resources',
];

export function isAIMLJob(title: string, description: string): boolean {
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  // Ensure non-engineering roles (Sales, Recruiter, Account Executive, Legal, HR) are excluded
  const isExcluded = EXCLUDED_ROLES.some((ex) => titleLower.includes(ex));
  if (isExcluded) {
    return false;
  }

  // Priority 1: Check Voice AI Engineering roles (Included if engineering/technical)
  const isVoiceRole = VOICE_AI_KEYWORDS.some((kw) => {
    const safeKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${safeKw}\\b`, 'i');
    return regex.test(combined);
  });

  if (isVoiceRole) {
    return true;
  }

  // Priority 2: Check Software / Fullstack Engineer roles
  const isSoftwareOrFullstack = SOFTWARE_FULLSTACK_KEYWORDS.some((kw) => {
    const safeKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${safeKw}\\b`, 'i');
    return regex.test(titleLower);
  });

  if (isSoftwareOrFullstack) {
    return true;
  }

  return false;
}
