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
  isConfirmed?: boolean;
  requiresOtp?: boolean;
  otpEmail?: string;
  failureReason?: 'SPAM_FLAGGED' | 'VALIDATION_ERRORS' | 'RESUME_MISSING' | 'FORM_NOT_SUBMITTED' | 'UNKNOWN';
  validationMessages?: string[];
  screenshotUrl?: string;
  error?: string;
  submittedAt?: Date;
}
