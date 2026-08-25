import React, { useState } from 'react';
import axios from 'axios';
import { Upload, ArrowRight, ShieldCheck, Briefcase, Sparkles } from 'lucide-react';
import type { UserProfile } from '../types';

interface OnboardingWizardProps {
  profile: UserProfile | null;
  onComplete: (updatedProfile: UserProfile) => void;
  apiBase: string;
  getHeaders: () => Record<string, string>;
}

export function OnboardingWizard({ profile, onComplete, apiBase, getHeaders }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [targetTitles, setTargetTitles] = useState<string>(
    Array.isArray(profile?.targetJobTitles)
      ? profile.targetJobTitles.join(', ')
      : 'Software Engineer, Voice AI Specialist, Fullstack AI Engineer'
  );
  const [skills, setSkills] = useState<string>(
    Array.isArray(profile?.preferredSkills)
      ? profile.preferredSkills.join(', ')
      : 'TypeScript, Python, PyTorch, Voice AI, Node.js, PostgreSQL'
  );
  const [minSalary, setMinSalary] = useState<number>(profile?.minSalary || 130000);

  // Eligibility
  const [legallyAuthorized, setLegallyAuthorized] = useState(profile?.legallyAuthorized ?? true);
  const [requiresSponsorship, setRequiresSponsorship] = useState(profile?.requiresSponsorship ?? false);
  const [openToRelocation, setOpenToRelocation] = useState(profile?.openToRelocation ?? true);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);

      const res = await axios.post(`${apiBase}/resume/upload`, formData, {
        headers: {
          ...getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        setStep(2);
      }
    } catch (err: any) {
      console.error('Resume upload error during onboarding:', err);
      alert(err.response?.data?.error || 'Failed to parse resume');
    } finally {
      setUploading(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      const targetArray = targetTitles.split(',').map((s) => s.trim()).filter(Boolean);
      const skillsArray = skills.split(',').map((s) => s.trim()).filter(Boolean);

      await axios.put(
        `${apiBase}/user/profile`,
        {
          fullName,
          phone,
          targetJobTitles: JSON.stringify(targetArray),
          preferredSkills: JSON.stringify(skillsArray),
          minSalary,
          legallyAuthorized,
          requiresSponsorship,
          openToRelocation,
        },
        { headers: getHeaders() }
      );

      setStep(3);
    } catch (err) {
      console.error('Preferences save error:', err);
    }
  };

  const handleFinishOnboarding = async () => {
    try {
      const res = await axios.post(
        `${apiBase}/user/onboarding/complete`,
        {},
        { headers: getHeaders() }
      );
      if (res.data.profile) {
        onComplete(res.data.profile);
      }
    } catch (err) {
      console.error('Complete onboarding error:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
          <span className={step >= 1 ? 'text-red-600 font-bold' : ''}>1. Upload Resume</span>
          <span className={step >= 2 ? 'text-red-600 font-bold' : ''}>2. Preferences</span>
          <span className={step >= 3 ? 'text-red-600 font-bold' : ''}>3. Work Eligibility</span>
          <span className={step >= 4 ? 'text-red-600 font-bold' : ''}>4. Activate Agent</span>
        </div>
        <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-red-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Upload Resume */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Upload Your Master Resume</h2>
            <p className="text-sm text-neutral-600 max-w-md mx-auto">
              Tsenta's AI agent parses your experience to intelligently tailor applications for target jobs while preserving your authentic work history.
            </p>
          </div>

          <form onSubmit={handleFileUpload} className="space-y-6">
            <div className="border-2 border-dashed border-neutral-300 hover:border-red-500 rounded-2xl p-8 text-center bg-neutral-50/50 transition-colors">
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="resume-upload-input"
              />
              <label htmlFor="resume-upload-input" className="cursor-pointer block space-y-2">
                <div className="text-sm font-semibold text-neutral-900">
                  {file ? file.name : 'Click to upload PDF or text resume'}
                </div>
                <div className="text-xs text-neutral-500">PDF, TXT up to 10MB</div>
              </label>
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                Skip for now (use default template)
              </button>

              <button
                type="submit"
                disabled={!file || uploading}
                className="flex items-center space-x-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-all"
              >
                {uploading ? (
                  <span>Parsing Resume...</span>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: Job Preferences */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Target Role & Skills</h2>
              <p className="text-xs text-neutral-500">Configure what jobs the AI agent prioritizes for you</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Target Job Titles (Comma Separated)
              </label>
              <input
                type="text"
                value={targetTitles}
                onChange={(e) => setTargetTitles(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Preferred Technical Skills
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Minimum Annual Salary ($ USD)
              </label>
              <input
                type="number"
                value={minSalary}
                onChange={(e) => setMinSalary(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSavePreferences}
              className="flex items-center space-x-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-all"
            >
              <span>Next: Eligibility</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Work Eligibility */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Work Authorization & EEO</h2>
              <p className="text-xs text-neutral-500">Auto-inject accurate answers during Playwright submission</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-50">
              <span className="text-sm font-medium text-neutral-900">Legally authorized to work in the target country?</span>
              <input
                type="checkbox"
                checked={legallyAuthorized}
                onChange={(e) => setLegallyAuthorized(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-neutral-300 focus:ring-red-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-50">
              <span className="text-sm font-medium text-neutral-900">Will require visa sponsorship now or in the future?</span>
              <input
                type="checkbox"
                checked={requiresSponsorship}
                onChange={(e) => setRequiresSponsorship(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-neutral-300 focus:ring-red-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-50">
              <span className="text-sm font-medium text-neutral-900">Open to relocation for onsite/hybrid roles?</span>
              <input
                type="checkbox"
                checked={openToRelocation}
                onChange={(e) => setOpenToRelocation(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-neutral-300 focus:ring-red-500"
              />
            </label>
          </div>

          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center space-x-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-all"
            >
              <span>Next: Confirmation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Agent Activation */}
      {step === 4 && (
        <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-neutral-900">Agent Ready to Activate</h2>
            <p className="text-sm text-neutral-600">
              Your profile, master resume, and background application queue are now configured. You can start swiping job postings!
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={handleFinishOnboarding}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base shadow-lg shadow-red-600/20 transition-all transform hover:-translate-y-0.5"
            >
              🚀 Launch Swipe Deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
