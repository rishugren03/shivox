export interface Company {
  id: string;
  name: string;
  atsType: string;
  boardTokenOrSlug: string;
}

export interface Job {
  id: string;
  companyId: string;
  company: Company;
  externalId: string;
  title: string;
  description: string;
  location?: string;
  url: string;
  atsType: string;
  postedAt?: string;
  matchScore: number;
  whyFit: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  resumeText?: string;
  resumeJson?: any;
  resumeFileUrl?: string;
  // Job Preferences
  targetJobTitles?: string[] | string;
  preferredLocations?: string[] | string;
  remotePreference?: 'remote_only' | 'hybrid' | 'onsite' | 'any';
  experienceLevel?: 'Entry' | 'Mid-Senior' | 'Lead / Staff' | 'Founder';
  minSalary?: number;
  preferredSkills?: string[] | string;
  autoApplyEnabled?: boolean;
  // Work Eligibility & EEO Demographic Choices
  legallyAuthorized?: boolean;
  requiresSponsorship?: boolean;
  openToRelocation?: boolean;
  openToInPerson?: boolean;
  gender?: string;
  race?: string;
  veteranStatus?: string;
  disabilityStatus?: string;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  job: Job;
  status: 'matched' | 'passed' | 'tailoring' | 'pending_review' | 'approved' | 'submitted' | 'failed' | 'needs_manual_review';
  matchScore?: number;
  matchReason?: string;
  tailoredJson?: string[] | string;
  coverNote?: string;
  submittedAt?: string;
  screenshotUrl?: string;
  errorMessage?: string;
  updatedAt: string;
}
