import { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from './components/Header';
import { SwipeDeck } from './components/SwipeDeck';
import { ReviewModal } from './components/ReviewModal';
import { Tracker } from './components/Tracker';
import { ProfileOnboarding } from './components/ProfileOnboarding';
import { AuthModal } from './components/AuthModal';
import type { Job, UserProfile, Application } from './types';

const API_BASE = 'http://localhost:5001/api';

export function App() {
  const [activeTab, setActiveTab] = useState<'deck' | 'tracker' | 'profile'>('deck');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const getHeaders = () => {
    const userEmail = localStorage.getItem('tsenta_user_email') || profile?.email || '';
    const userId = localStorage.getItem('tsenta_user_id') || profile?.id || '';
    return {
      'x-user-email': userEmail,
      'x-user-id': userId,
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getHeaders();
      const [deckRes, appRes, profileRes] = await Promise.all([
        axios.get(`${API_BASE}/jobs/deck`, { headers }),
        axios.get(`${API_BASE}/applications`, { headers }),
        axios.get(`${API_BASE}/user/profile`, { headers }),
      ]);

      setJobs(deckRes.data.jobs || []);
      setApplications(appRes.data.applications || []);
      setProfile(profileRes.data.profile || null);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePollJobs = async () => {
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
    try {
      const res = await axios.post(
        `${API_BASE}/applications/swipe`,
        { jobId, action },
        { headers: getHeaders() }
      );
      if (action === 'right' && res.data.application) {
        setReviewApp(res.data.application);
      }
      fetchData();
    } catch (err) {
      console.error('Swipe error:', err);
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
      setActiveTab('tracker');
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitNow = async (appId: string) => {
    setSubmittingId(appId);
    try {
      await axios.post(`${API_BASE}/applications/${appId}/submit`, {}, { headers: getHeaders() });
      fetchData();
    } catch (err) {
      console.error('Direct submission error:', err);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col selection:bg-red-600 selection:text-white relative font-sans overflow-x-hidden">
      {/* Texture Layer */}
      <div className="noise-overlay" />

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onPoll={handlePollJobs}
          polling={polling}
          appCount={applications.length}
          onOpenAuth={() => setShowAuthModal(true)}
          userEmail={profile?.email || undefined}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto pb-10 sm:pb-12 pt-3 sm:pt-6 px-3 sm:px-5 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold text-neutral-600">Loading AI/ML Postings...</p>
          </div>
        ) : (
          <>
            {activeTab === 'deck' && (
              <SwipeDeck
                jobs={jobs}
                onSwipe={handleSwipe}
                onRefreshDeck={handlePollJobs}
              />
            )}

            {activeTab === 'tracker' && (
              <Tracker
                applications={applications}
                onSubmitNow={handleSubmitNow}
                submittingId={submittingId}
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
        onSuccess={(user) => {
          setProfile(user);
          fetchData();
        }}
      />
    </div>
  );
}

export default App;
