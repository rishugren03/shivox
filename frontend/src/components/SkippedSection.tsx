import React, { useState, useEffect } from 'react';
import axios from 'axios';
import type { Application } from '../types';
import {
  RotateCcw,
  Send,
  Building2,
  MapPin,
  Sparkles,
  ExternalLink,
  Search,
  ChevronDown,
  X,
  Flame,
  Archive,
} from 'lucide-react';

interface SkippedSectionProps {
  apiBase: string;
  getHeaders: () => Record<string, string>;
  onRefreshData: () => void;
  onNavigateToDeck: () => void;
}

export const SkippedSection: React.FC<SkippedSectionProps> = ({
  apiBase,
  getHeaders,
  onRefreshData,
  onNavigateToDeck,
}) => {
  const [skippedApps, setSkippedApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedApp, setExpandedApp] = useState<Application | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSkipped = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${apiBase}/applications/skipped`, {
        headers: getHeaders(),
      });
      setSkippedApps(res.data.skipped || []);
    } catch (err) {
      console.error('Error fetching skipped postings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkipped();
  }, [apiBase]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUnskip = async (appId: string, companyName: string) => {
    setActionLoadingId(appId);
    try {
      await axios.post(`${apiBase}/applications/${appId}/unskip`, {}, { headers: getHeaders() });
      showToast(`🔄 Restored ${companyName} posting to Swipe Deck`);
      await fetchSkipped();
      onRefreshData();
    } catch (err: any) {
      console.error('Error unskipping posting:', err);
      alert(err.response?.data?.error || 'Failed to restore posting');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApplySkipped = async (appId: string, companyName: string) => {
    setActionLoadingId(appId);
    try {
      await axios.post(`${apiBase}/applications/${appId}/apply-skipped`, {}, { headers: getHeaders() });
      showToast(`⚡ Queued application for ${companyName}`);
      await fetchSkipped();
      onRefreshData();
    } catch (err: any) {
      console.error('Error applying to skipped posting:', err);
      alert(err.response?.data?.error || 'Failed to queue application');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredApps = skippedApps.filter((app) => {
    const title = app.job?.title || '';
    const company = app.job?.company?.name || '';
    const query = searchQuery.toLowerCase();
    return title.toLowerCase().includes(query) || company.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-neutral-600">Loading Skipped Postings...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-neutral-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-neutral-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
          {toastMessage}
        </div>
      )}

      {/* Header & Metrics Overview */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100">
              <Archive className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Skipped Postings</h1>
          </div>
          <p className="text-xs text-neutral-600 max-w-md">
            Roles you've passed on during deck review. You can restore any role back to your deck or apply directly at any time.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-200 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="text-center sm:text-left">
            <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider block">Skipped Total</span>
            <span className="text-2xl font-black text-neutral-900">{skippedApps.length}</span>
          </div>
          <div className="h-8 w-px bg-neutral-200" />
          <button
            onClick={onNavigateToDeck}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Flame className="w-4 h-4 text-red-500" />
            Back to Swipe Deck
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      {skippedApps.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search skipped postings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-red-600"
            />
          </div>
          <span className="text-xs font-bold text-neutral-500 px-2">
            Showing {filteredApps.length} of {skippedApps.length}
          </span>
        </div>
      )}

      {/* Empty State */}
      {skippedApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-500 mb-4 shadow-sm">
            <Archive className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 mb-1">No Skipped Postings</h3>
          <p className="text-xs text-neutral-600 max-w-sm mb-6">
            When you swipe left on job cards in your deck, they will be archived safely in this separate section so your main tracker stays clean.
          </p>
          <button
            onClick={onNavigateToDeck}
            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white shadow-lg shadow-red-600/30 transition-all flex items-center gap-2"
          >
            <Flame className="w-4 h-4" />
            Explore Job Deck
          </button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] px-6 text-center bg-white rounded-3xl border border-neutral-200 p-6">
          <p className="text-sm font-bold text-neutral-700">No skipped postings match "{searchQuery}"</p>
        </div>
      ) : (
        /* Skipped Postings Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => {
            const job = app.job;
            if (!job) return null;
            const isLoadingThis = actionLoadingId === app.id;

            return (
              <div
                key={app.id}
                className="bg-white rounded-3xl p-5 border border-neutral-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
              >
                {/* Header Info */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase bg-neutral-100 text-neutral-700 border border-neutral-200">
                      {job.atsType}
                    </span>
                    <div className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-black flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {app.matchScore || job.matchScore || 85}% MATCH
                    </div>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-red-600 font-black text-lg shrink-0">
                      {job.company.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-red-600" />
                        {job.company.name}
                      </h4>
                      <h3 className="text-lg font-black text-neutral-900 leading-snug truncate mt-0.5" title={job.title}>
                        {job.title}
                      </h3>
                      <p className="text-xs font-semibold text-neutral-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        {job.location || 'Remote'}
                      </p>
                    </div>
                  </div>

                  {app.whyFit && (
                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 mb-3">
                      <p className="text-xs text-neutral-700 font-medium leading-relaxed line-clamp-2">
                        {app.whyFit}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed">
                    {job.description.replace(/<[^>]*>?/gm, '')}
                  </p>
                </div>

                {/* Actions Bar */}
                <div className="pt-3 border-t border-neutral-100 space-y-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <button
                      onClick={() => setExpandedApp(app)}
                      className="font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
                    >
                      Full Details <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-neutral-500 hover:text-neutral-800 flex items-center gap-1 text-[11px]"
                    >
                      Job Board <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleUnskip(app.id, job.company.name)}
                      disabled={isLoadingThis}
                      className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors border border-neutral-200 disabled:opacity-50"
                      title="Restore job to Swipe Deck"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-neutral-600" />
                      Restore
                    </button>

                    <button
                      onClick={() => handleApplySkipped(app.id, job.company.name)}
                      disabled={isLoadingThis}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-600/20 disabled:opacity-50"
                      title="Apply now and move to Tracker"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Apply Now
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Description Modal */}
      {expandedApp && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl max-h-[88svh] overflow-y-auto p-5 sm:p-6 relative border border-neutral-200 text-neutral-900 shadow-2xl space-y-4">
            <button
              onClick={() => setExpandedApp(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-red-600 uppercase">{expandedApp.job?.company?.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-[10px] font-bold">
                SKIPPED
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-neutral-900">{expandedApp.job?.title}</h2>
            <div
              className="text-xs text-neutral-700 space-y-2 leading-relaxed prose prose-neutral max-w-none"
              dangerouslySetInnerHTML={{ __html: expandedApp.job?.description || '' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
