export interface ApplicantInfo {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  resumePath?: string;
  coverNote?: string;
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

export interface SubmissionResult {
  success: boolean;
  screenshotUrl?: string;
  error?: string;
  submittedAt?: Date;
}
