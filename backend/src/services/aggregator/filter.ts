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
  'webrtc',
  'telephony',
];

// Software & Full Stack & FDE Engineer keywords
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
  'forward deployed engineer',
  'forward deployed',
  'fde',
  'solutions engineer',
  'ai engineer',
  'llm engineer',
];

// Internship & Early Career Keywords
export const INTERN_KEYWORDS = [
  'intern',
  'internship',
  'co-op',
  'coop',
  'university grad',
  'new grad',
  'fellowship',
  'apprentice',
];

// Explicit exclusions to filter out non-engineering roles
export const EXCLUDED_ROLES = [
  'recruiter',
  'account executive',
  'sales representative',
  'legal counsel',
  'payroll specialist',
  'human resources',
  'hr manager',
];

export function categorizeJob(title: string, description: string): 'fulltime' | 'internship' {
  const combined = `${title} ${description}`.toLowerCase();
  const isIntern = INTERN_KEYWORDS.some((kw) => {
    const safeKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${safeKw}\\b`, 'i');
    return regex.test(combined);
  });
  return isIntern ? 'internship' : 'fulltime';
}

export function isAIMLJob(title: string, description: string): boolean {
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  // Ensure non-engineering roles are excluded
  const isExcluded = EXCLUDED_ROLES.some((ex) => titleLower.includes(ex));
  if (isExcluded) {
    return false;
  }

  // Allow Internships if they are engineering related
  const isIntern = INTERN_KEYWORDS.some((kw) => combined.includes(kw));
  if (isIntern) {
    return true;
  }

  // Priority 1: Check Voice AI Engineering roles
  const isVoiceRole = VOICE_AI_KEYWORDS.some((kw) => {
    const safeKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${safeKw}\\b`, 'i');
    return regex.test(combined);
  });

  if (isVoiceRole) {
    return true;
  }

  // Priority 2: Check Software / Fullstack / FDE / AI Engineer roles
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

