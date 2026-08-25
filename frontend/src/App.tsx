import { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from './components/Header';
import { SwipeDeck } from './components/SwipeDeck';
import { ReviewModal } from './components/ReviewModal';
import { Tracker } from './components/Tracker';
import { SkippedSection } from './components/SkippedSection';
import { ProfileOnboarding } from './components/ProfileOnboarding';
import { AuthModal } from './components/AuthModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { UnauthenticatedHero } from './components/UnauthenticatedHero';
import type { Job, UserProfile, Application } from './types';

type TabType = 'deck' | 'tracker' | 'skipped' | 'profile';

function getTabFromPath(path: string): TabType {
  const cleanPath = path.trim().replace(/\/+$/, '').toLowerCase();
  if (cleanPath === '/tracker') return 'tracker';
  if (cleanPath === '/skipped') return 'skipped';
  if (cleanPath === '/profile') return 'profile';
  return 'deck';
}

const API_BASE = 'http://localhost:5001/api';

export function App() {
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    return getTabFromPath(window.location.pathname);
  });

  const navigateToTab = (tab: TabType, replace = false) => {
    setActiveTabState(tab);
    const targetPath = `/${tab}`;
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState(null, '', targetPath);
      } else {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const currentTab = getTabFromPath(window.location.pathname);
    const expectedPath = `/${currentTab}`;
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(null, '', expectedPath);
    }

    const handlePopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      setActiveTabState(tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<'fulltime' | 'internship'>('fulltime');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(localStorage.getItem('tsenta_token'))
  );

  const getHeaders = () => {
    const token = localStorage.getItem('tsenta_token') || '';
    const userEmail = localStorage.getItem('tsenta_user_email') || profile?.email || '';
    const userId = localStorage.getItem('tsenta_user_id') || profile?.id || '';
    return {
      Authorization: `Bearer ${token}`,
      'x-user-email': userEmail,
      'x-user-id': userId,
    };
  };

  const fetchData = async (showLoading = true) => {
    const token = localStorage.getItem('tsenta_token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      const headers = getHeaders();
      const [deckRes, appRes, skippedRes, profileRes] = await Promise.all([
        axios.get(`${API_BASE}/jobs/deck?category=${selectedCategory}`, { headers }),
        axios.get(`${API_BASE}/applications`, { headers }),
        axios.get(`${API_BASE}/applications/skipped`, { headers }),
        axios.get(`${API_BASE}/user/profile`, { headers }),
      ]);

      setJobs(deckRes.data.jobs || []);
      setApplications(appRes.data.applications || []);
      setSkippedCount(skippedRes.data.skipped?.length || 0);
      setProfile(profileRes.data.profile || null);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (err.response?.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('tsenta_token');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [selectedCategory, isAuthenticated]);

  const handlePollJobs = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setPolling(true);
    try {
      await axios.post(`${API_BASE}/jobs/poll`, {}, { headers: getHeaders() });
      await fetchData();
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      setPolling(false);
    }
  };

  const handleSwipe = async (jobId: string, action: 'right' | 'left') => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/applications/swipe`,
        { jobId, action },
        { headers: getHeaders() }
      );
      // Background update of tracker and skipped counts without mutating current active jobs deck
      const headers = getHeaders();
      const [appRes, skippedRes] = await Promise.all([
        axios.get(`${API_BASE}/applications`, { headers }),
        axios.get(`${API_BASE}/applications/skipped`, { headers }),
      ]);
      setApplications(appRes.data.applications || []);
      setSkippedCount(skippedRes.data.skipped?.length || 0);
    } catch (err: any) {
      console.error('Swipe error:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
    }
  };

  const handleApproveAndSubmit = async (appId: string, coverNote: string, tailoredBullets: string[]) => {
    setSubmitting(true);
    try {
      await axios.post(
        `${API_BASE}/applications/${appId}/approve`,
        { coverNote, tailoredBullets },
        { headers: getHeaders() }
      );

      await axios.post(`${API_BASE}/applications/${appId}/submit`, {}, { headers: getHeaders() });
      setReviewApp(null);
      fetchData();
      navigateToTab('tracker');
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const needsOnboarding = isAuthenticated && profile && profile.isOnboardingComplete === false;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col selection:bg-red-600 selection:text-white relative font-sans overflow-x-hidden">
      {/* Texture Layer */}
      <div className="noise-overlay" />

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
        <Header
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (!isAuthenticated && tab !== 'deck') {
              setShowAuthModal(true);
            } else {
              navigateToTab(tab);
            }
          }}
          onPoll={handlePollJobs}
          polling={polling}
          appCount={applications.length}
          skippedCount={skippedCount}
          onOpenAuth={() => setShowAuthModal(true)}
          userEmail={isAuthenticated && profile?.email ? profile.email : undefined}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto pb-10 sm:pb-12 pt-3 sm:pt-6 px-3 sm:px-5 lg:px-8">
          {!isAuthenticated ? (
            <UnauthenticatedHero onOpenAuth={() => setShowAuthModal(true)} />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-neutral-600">Loading Tsenta AI Platform...</p>
            </div>
          ) : needsOnboarding ? (
            <OnboardingWizard
              profile={profile}
              apiBase={API_BASE}
              getHeaders={getHeaders}
              onComplete={(updated) => {
                setProfile(updated);
                fetchData();
              }}
            />
          ) : (
            <>
              {activeTab === 'deck' && (
                <SwipeDeck
                  jobs={jobs}
                  onSwipe={handleSwipe}
                  onRefreshDeck={handlePollJobs}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(cat) => setSelectedCategory(cat)}
                />
              )}

              {activeTab === 'tracker' && (
                <Tracker
                  applications={applications}
                  apiBase={API_BASE}
                  onRefresh={fetchData}
                />
              )}

              {activeTab === 'skipped' && (
                <SkippedSection
                  apiBase={API_BASE}
                  getHeaders={getHeaders}
                  onRefreshData={fetchData}
                  onNavigateToDeck={() => navigateToTab('deck')}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileOnboarding
                  profile={profile}
                  onProfileUpdated={(updated) => {
                    setProfile(updated);
                    fetchData();
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      <ReviewModal
        application={reviewApp}
        onClose={() => setReviewApp(null)}
        onApproveAndSubmit={handleApproveAndSubmit}
        submitting={submitting}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(user, token) => {
          if (token) localStorage.setItem('tsenta_token', token);
          if (user?.email) localStorage.setItem('tsenta_user_email', user.email);
          if (user?.id) localStorage.setItem('tsenta_user_id', user.id);
          setIsAuthenticated(true);
          setProfile(user);
          fetchData();
        }}
      />
    </div>
  );
}

export default App;
