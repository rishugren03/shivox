import React, { useState, useEffect } from 'react';
import type { UserProfile, ResumeVersion } from '../types';
import { Upload, FileText, User, Mail, Sparkles, Sliders, Briefcase, MapPin, DollarSign, CheckCircle2, ShieldCheck, Check, ExternalLink } from 'lucide-react';
import axios from 'axios';

interface ProfileOnboardingProps {
  profile: UserProfile | null;
  onProfileUpdated: (updated: UserProfile) => void;
}

const AVAILABLE_TITLES = [
  'AI Engineer',
  'Voice AI Specialist',
  'Fullstack AI Engineer',
  'ML Infrastructure Engineer',
  'LLM Systems Architect',
  'Applied AI Researcher',
];

const AVAILABLE_LOCATIONS = [
  'Remote',
  'San Francisco, CA',
  'New York, NY',
  'Seattle, WA',
  'Austin, TX',
  'Boston, MA',
];

const SUGGESTED_SKILLS = [
  'Python', 'PyTorch', 'LLMs', 'Voice AI', 'Vapi', 'LiveKit', 'TypeScript', 'Node.js', 'PostgreSQL', 'LangChain', 'Playwright', 'FastAPI'
];

export const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({ profile, onProfileUpdated }) => {
  const [activeSubTab, setActiveSubTab] = useState<'preferences' | 'details' | 'eligibility' | 'resume'>('preferences');
  const [uploading, setUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);

  const fetchResumeVersions = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/resume/versions', {
        headers: getHeaders(),
      });
      if (res.data.versions) {
        setResumeVersions(res.data.versions);
      }
    } catch (err) {
      console.error('Error fetching resume versions:', err);
    }
  };

  useEffect(() => {
    fetchResumeVersions();
  }, []);

  const handleActivateVersion = async (versionId: string) => {
    try {
      const res = await axios.post(`http://localhost:5001/api/resume/versions/${versionId}/activate`, {}, {
        headers: getHeaders(),
      });
      if (res.data.success) {
        fetchResumeVersions();
        if (profile) {
          onProfileUpdated({
            ...profile,
            resumeFileUrl: res.data.activeVersion.fileUrl,
            resumeText: res.data.activeVersion.resumeText,
            resumeJson: JSON.parse(res.data.activeVersion.resumeJson || '{}'),
          });
        }
      }
    } catch (err) {
      console.error('Error activating resume version:', err);
    }
  };

  // Helper to parse arrays from JSON strings or arrays
  const parseArr = (val: any, fallback: string[]) => {
    if (!val) return fallback;
    if (Array.isArray(val)) return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    linkedinUrl: profile?.linkedinUrl || '',
    githubUrl: profile?.githubUrl || '',
    portfolioUrl: profile?.portfolioUrl || '',
    // Job Preferences
    targetJobTitles: parseArr(profile?.targetJobTitles, ['AI Engineer', 'Voice AI Specialist']),
    preferredLocations: parseArr(profile?.preferredLocations, ['Remote', 'San Francisco, CA']),
    remotePreference: profile?.remotePreference || 'any',
    experienceLevel: profile?.experienceLevel || 'Mid-Senior',
    minSalary: profile?.minSalary || 140000,
    preferredSkills: parseArr(profile?.preferredSkills, ['PyTorch', 'LLMs', 'Voice AI', 'TypeScript']),
    autoApplyEnabled: profile?.autoApplyEnabled ?? true,
    // Work Eligibility & EEO Questions
    legallyAuthorized: profile?.legallyAuthorized ?? true,
    requiresSponsorship: profile?.requiresSponsorship ?? false,
    openToRelocation: profile?.openToRelocation ?? true,
    openToInPerson: profile?.openToInPerson ?? true,
    gender: profile?.gender || 'Decline to self-identify',
    race: profile?.race || 'Decline to self-identify',
    veteranStatus: profile?.veteranStatus || 'Decline to self-identify',
    disabilityStatus: profile?.disabilityStatus || 'Decline to self-identify',
  });

  const getHeaders = () => {
    const userEmail = localStorage.getItem('tsenta_user_email') || profile?.email;
    const userId = localStorage.getItem('tsenta_user_id') || profile?.id;
    return {
      'x-user-email': userEmail || '',
      'x-user-id': userId || '',
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = new FormData();
      data.append('resume', file);

      const res = await axios.post('http://localhost:5001/api/resume/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getHeaders(),
        },
      });

      if (res.data.profile) {
        onProfileUpdated(res.data.profile);
        const updated = res.data.profile;
        setFormData((prev) => ({
          ...prev,
          fullName: updated.fullName || prev.fullName,
          email: updated.email || prev.email,
          phone: updated.phone || prev.phone,
          location: updated.location || prev.location,
          linkedinUrl: updated.linkedinUrl || prev.linkedinUrl,
          githubUrl: updated.githubUrl || prev.githubUrl,
          portfolioUrl: updated.portfolioUrl || prev.portfolioUrl,
        }));
      }
    } catch (err) {
      console.error('Error uploading resume:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const res = await axios.put('http://localhost:5001/api/user/profile', formData, {
        headers: getHeaders(),
      });
      if (res.data.profile) {
        onProfileUpdated(res.data.profile);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const toggleTitle = (title: string) => {
    const current = formData.targetJobTitles;
    const next = current.includes(title) ? current.filter((t: string) => t !== title) : [...current, title];
    setFormData({ ...formData, targetJobTitles: next });
  };

  const toggleLocation = (loc: string) => {
    const current = formData.preferredLocations;
    const next = current.includes(loc) ? current.filter((l: string) => l !== loc) : [...current, loc];
    setFormData({ ...formData, preferredLocations: next });
  };

  const toggleSkill = (skill: string) => {
    const current = formData.preferredSkills;
    const next = current.includes(skill) ? current.filter((s: string) => s !== skill) : [...current, skill];
    setFormData({ ...formData, preferredSkills: next });
  };

  const extractedSkills: string[] = profile?.resumeJson?.skills || [
    'Python', 'PyTorch', 'LLMs', 'Voice AI', 'TypeScript', 'PostgreSQL', 'Playwright'
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 pb-8 px-1 sm:px-4">
      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Profile & Job Preferences successfully saved to Tsenta AI!</span>
        </div>
      )}

      {/* Main Responsive Layout: Top Bar on Mobile, 2-Column Sidebar Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column Sidebar (Sticky on Desktop) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          
          {/* Desktop Candidate Card */}
          <div className="bg-white rounded-3xl p-5 border border-neutral-200 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center font-black text-2xl mb-3 shadow-xs">
              {formData.fullName ? formData.fullName.charAt(0) : 'U'}
            </div>
            <h2 className="text-base font-extrabold text-neutral-900 leading-tight">
              {formData.fullName || 'Tsenta Candidate'}
            </h2>
            <p className="text-xs text-neutral-500 font-medium truncate max-w-full mb-3">
              {formData.email || 'Configure Profile'}
            </p>
            <div className="w-full pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-medium">Auto-Apply</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                formData.autoApplyEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {formData.autoApplyEnabled ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
          </div>

          {/* Navigation Sub-tabs (Mobile Horizontal, Desktop Vertical List) */}
          <div className="bg-white rounded-3xl p-2 sm:p-2.5 border border-neutral-200 shadow-sm flex lg:flex-col gap-1.5">
            <button
              onClick={() => setActiveSubTab('preferences')}
              className={`flex-1 lg:w-full py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-start gap-2.5 ${
                activeSubTab === 'preferences'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              <Sliders className="w-4.5 h-4.5" />
              <span>Job Preferences</span>
            </button>

            <button
              onClick={() => setActiveSubTab('details')}
              className={`flex-1 lg:w-full py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-start gap-2.5 ${
                activeSubTab === 'details'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              <User className="w-4.5 h-4.5" />
              <span>Contact & Links</span>
            </button>

            <button
              onClick={() => setActiveSubTab('eligibility')}
              className={`flex-1 lg:w-full py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-start gap-2.5 ${
                activeSubTab === 'eligibility'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              <ShieldCheck className="w-4.5 h-4.5" />
              <span>Work Eligibility & EEO</span>
            </button>

            <button
              onClick={() => setActiveSubTab('resume')}
              className={`flex-1 lg:w-full py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-start gap-2.5 ${
                activeSubTab === 'resume'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              <FileText className="w-4.5 h-4.5" />
              <span>Resume PDF</span>
            </button>
          </div>
        </div>

        {/* Right Main Configuration Column */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          
          {/* TAB 1: JOB PREFERENCES */}
          {activeSubTab === 'preferences' && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200 shadow-sm space-y-4">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                    <Briefcase className="w-4.5 h-4.5 text-red-600" />
                    Target Job Titles
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-500 font-medium">Select roles you want Tsenta to match & auto-apply for</p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {AVAILABLE_TITLES.map((title) => {
                    const selected = formData.targetJobTitles.includes(title);
                    return (
                      <button
                        key={title}
                        type="button"
                        onClick={() => toggleTitle(title)}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all border ${
                          selected
                            ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                            : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '} {title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200 shadow-sm space-y-4">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                    <MapPin className="w-4.5 h-4.5 text-red-600" />
                    Work Arrangement & Locations
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-500 font-medium">Choose location preferences and remote flexibility</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-2">
                      Remote Preference
                    </label>
                    <select
                      value={formData.remotePreference}
                      onChange={(e) => setFormData({ ...formData, remotePreference: e.target.value as any })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                    >
                      <option value="remote_only">Remote Only</option>
                      <option value="hybrid">Hybrid Allowed</option>
                      <option value="onsite">On-Site Only</option>
                      <option value="any">Any (Remote & On-Site)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-2">
                      Experience Level
                    </label>
                    <select
                      value={formData.experienceLevel}
                      onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as any })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                    >
                      <option value="Entry">Entry Level (0-2 yrs)</option>
                      <option value="Mid-Senior">Mid-Senior Level (3-6 yrs)</option>
                      <option value="Lead / Staff">Lead / Staff Specialist (7+ yrs)</option>
                      <option value="Founder">Founder / Principal Engineer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-2">
                    Target Cities / Hubs
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {AVAILABLE_LOCATIONS.map((loc) => {
                      const selected = formData.preferredLocations.includes(loc);
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => toggleLocation(loc)}
                          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all border ${
                            selected
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '} {loc}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200 shadow-sm space-y-4">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                    <DollarSign className="w-4.5 h-4.5 text-red-600" />
                    Compensation & Preferred Tech Stack
                  </h3>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-extrabold text-neutral-600 uppercase tracking-wider">
                      Minimum Expected Base Salary
                    </label>
                    <span className="text-xs sm:text-sm font-extrabold text-red-600 bg-red-50 px-3.5 py-1.5 rounded-xl border border-red-200">
                      ${formData.minSalary.toLocaleString()} / year
                    </span>
                  </div>
                  <input
                    type="range"
                    min="80000"
                    max="300000"
                    step="10000"
                    value={formData.minSalary}
                    onChange={(e) => setFormData({ ...formData, minSalary: parseInt(e.target.value, 10) })}
                    className="w-full accent-red-600 cursor-pointer h-2 bg-neutral-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-2">
                    Core Preferred Tech Stack & Frameworks
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {SUGGESTED_SKILLS.map((skill) => {
                      const selected = formData.preferredSkills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all border ${
                            selected
                              ? 'bg-red-50 text-red-700 border-red-200 font-extrabold'
                              : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                          }`}
                        >
                          {selected ? '✓ ' : ''}{skill}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-extrabold text-neutral-900 block">Auto-Apply Automation Engine</span>
                    <span className="text-xs sm:text-sm text-neutral-500 font-medium block">Automatically draft tailored cover notes and submit via Playwright</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoApplyEnabled}
                    onChange={(e) => setFormData({ ...formData, autoApplyEnabled: e.target.checked })}
                    className="w-5.5 h-5.5 accent-red-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2"
              >
                Save Job Preferences
              </button>
            </div>
          )}

          {/* TAB 2: CONTACT & PROFILE DETAILS */}
          {activeSubTab === 'details' && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200 space-y-4 shadow-sm">
              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-900 uppercase tracking-wider mb-2 border-b border-neutral-100 pb-3">
                Applicant Contact & Online Presence
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 pl-10 p-3.5 focus:outline-none focus:border-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 pl-10 p-3.5 focus:outline-none focus:border-red-600"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Current Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">LinkedIn Profile</label>
                  <input
                    type="text"
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                    className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">GitHub Profile</label>
                  <input
                    type="text"
                    value={formData.githubUrl}
                    onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                    className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Portfolio Website</label>
                  <input
                    type="text"
                    value={formData.portfolioUrl}
                    onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                    className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition-all mt-2"
              >
                Save Contact Details
              </button>
            </div>
          )}

          {/* TAB 3: WORK ELIGIBILITY & EEO QUESTIONS */}
          {activeSubTab === 'eligibility' && (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200 space-y-5 shadow-sm">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-red-600" />
                  Work Eligibility & Voluntary Demographics
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 font-medium">
                  Configure candidate answers to avoid getting flagged or blocked on ATS application forms (Ashby, Greenhouse, Lever).
                </p>
              </div>

              {/* Work Eligibility Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <span className="text-xs font-extrabold text-neutral-800 block uppercase tracking-wider">
                    Legally Authorized to Work
                  </span>
                  <p className="text-[11px] text-neutral-500 font-medium">Are you legally authorized to work in the country of employment?</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, legallyAuthorized: true })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        formData.legallyAuthorized ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      Yes (Authorized)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, legallyAuthorized: false })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        !formData.legallyAuthorized ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <span className="text-xs font-extrabold text-neutral-800 block uppercase tracking-wider">
                    Visa Sponsorship Required
                  </span>
                  <p className="text-[11px] text-neutral-500 font-medium">Will you now or in the future require visa sponsorship?</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, requiresSponsorship: true })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        formData.requiresSponsorship ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      Yes (Need Sponsorship)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, requiresSponsorship: false })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        !formData.requiresSponsorship ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      No (No Sponsorship)
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <span className="text-xs font-extrabold text-neutral-800 block uppercase tracking-wider">
                    Open to Relocation
                  </span>
                  <p className="text-[11px] text-neutral-500 font-medium">Are you open to relocating if required for the position?</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, openToRelocation: true })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        formData.openToRelocation ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      Yes (Relocate)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, openToRelocation: false })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        !formData.openToRelocation ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <span className="text-xs font-extrabold text-neutral-800 block uppercase tracking-wider">
                    Open to In-Person / On-Site Work
                  </span>
                  <p className="text-[11px] text-neutral-500 font-medium">Are you open to working in-person or hybrid in office?</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, openToInPerson: true })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        formData.openToInPerson ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      Yes (In-Person / Hybrid)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, openToInPerson: false })}
                      className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                        !formData.openToInPerson ? 'bg-red-600 text-white border-red-600' : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      No (Remote Only)
                    </button>
                  </div>
                </div>
              </div>

              {/* EEO Demographic Dropdowns */}
              <div className="border-t border-neutral-100 pt-4 space-y-4">
                <h4 className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">
                  Voluntary Equal Employment Opportunity (EEO) Choices
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-Binary">Non-Binary</option>
                      <option value="Decline to self-identify">Decline to self-identify</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Race / Ethnicity</label>
                    <select
                      value={formData.race}
                      onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                    >
                      <option value="Hispanic or Latino">Hispanic or Latino</option>
                      <option value="White">White (Not Hispanic or Latino)</option>
                      <option value="Black or African American">Black or African American</option>
                      <option value="Asian">Asian</option>
                      <option value="Two or More Races">Two or More Races</option>
                      <option value="Decline to self-identify">Decline to self-identify</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Veteran Status</label>
                    <select
                      value={formData.veteranStatus}
                      onChange={(e) => setFormData({ ...formData, veteranStatus: e.target.value })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                    >
                      <option value="I am a protected veteran">I am a protected veteran</option>
                      <option value="I am not a protected veteran">I am not a protected veteran</option>
                      <option value="Decline to self-identify">Decline to self-identify</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-neutral-600 uppercase tracking-wider mb-1.5">Disability Status</label>
                    <select
                      value={formData.disabilityStatus}
                      onChange={(e) => setFormData({ ...formData, disabilityStatus: e.target.value })}
                      className="w-full rounded-xl bg-neutral-50 border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 p-3.5 focus:outline-none focus:border-red-600"
                    >
                      <option value="Yes, I have a disability">Yes, I have a disability</option>
                      <option value="No, I don't have a disability">No, I don't have a disability</option>
                      <option value="Decline to self-identify">Decline to self-identify</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition-all mt-3"
              >
                Save Work Eligibility & EEO Preferences
              </button>
            </div>
          )}

          {/* TAB 3: RESUME UPLOAD & AI PARSING */}
          {activeSubTab === 'resume' && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-8 border border-neutral-200 text-center relative overflow-hidden shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8" />
                </div>

                <h2 className="text-lg font-black text-neutral-900 mb-1">
                  {profile?.resumeFileUrl ? 'Update Candidate Resume PDF' : 'Upload Candidate Resume'}
                </h2>
                <p className="text-xs text-neutral-600 max-w-md mx-auto mb-5 leading-relaxed">
                  Upload your PDF resume to automatically extract technical skills, work history, and generate personalized applications for each ATS role.
                </p>

                <label className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 font-extrabold text-xs text-white shadow-lg shadow-red-600/30 cursor-pointer transition-all">
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Parsing PDF with Claude AI...
                    </span>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Choose PDF File
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm">
                <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-red-600" />
                  Extracted Resume Skills ({extractedSkills.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {extractedSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold shadow-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* MASTER RESUMES MANAGEMENT (LinkedIn style) */}
              <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
                <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-red-600" />
                      Uploaded Master Resumes ({resumeVersions.length})
                    </h3>
                    <p className="text-xs text-neutral-500 font-medium">Select which master resume Tsenta uses as your active base profile</p>
                  </div>
                </div>

                {resumeVersions.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium py-2">No uploaded master resumes found yet. Upload one above!</p>
                ) : (
                  <div className="space-y-3">
                    {resumeVersions.map((version) => (
                      <div
                        key={version.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          version.isActive
                            ? 'bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-500/10 shadow-sm'
                            : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            version.isActive ? 'bg-emerald-600 text-white font-bold' : 'bg-neutral-200 text-neutral-600'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-extrabold text-neutral-900 truncate">
                                {version.fileName || 'Master Resume.pdf'}
                              </h4>
                              {version.isActive && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Active Master
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                              Uploaded on {new Date(version.uploadedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <a
                            href={`http://localhost:5001${version.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-700 text-xs font-extrabold transition-all flex items-center gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View
                          </a>
                          {!version.isActive && (
                            <button
                              type="button"
                              onClick={() => handleActivateVersion(version.id)}
                              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-extrabold shadow-sm transition-all"
                            >
                              Set as Active
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
