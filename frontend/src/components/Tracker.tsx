import { useState, useMemo } from 'react';
import type { Application } from '../types';
import { CheckCircle2, Clock, AlertTriangle, ExternalLink, Play, Eye, FileText, Building2, Search, Filter, Sparkles, Copy, Check, RefreshCw } from 'lucide-react';

interface TrackerProps {
  applications: Application[];
  onSubmitNow: (appId: string) => void;
  submittingId: string | null;
}

export const Tracker: React.FC<TrackerProps> = ({ applications, onSubmitNow, submittingId }) => {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'failed'>('all');
  const [copiedNote, setCopiedNote] = useState(false);

  // Compute metrics overview
  const metrics = useMemo(() => {
    const total = applications.length;
    const submitted = applications.filter((a) => a.status === 'submitted').length;
    const pending = applications.filter((a) => a.status === 'pending_review' || a.status === 'approved').length;
    const failed = applications.filter((a) => a.status === 'failed').length;
    const avgMatch = total > 0
      ? Math.round(applications.reduce((acc, a) => acc + (a.job?.matchScore || 85), 0) / total)
      : 0;
    return { total, submitted, pending, failed, avgMatch };
  }, [applications]);

  // Filtered applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        (app.job?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.job?.company?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'submitted') return app.status === 'submitted';
      if (statusFilter === 'pending') return app.status === 'pending_review' || app.status === 'approved';
      if (statusFilter === 'failed') return app.status === 'failed';
      return true;
    });
  }, [applications, searchQuery, statusFilter]);

  // Default active app for desktop split view
  const activeDesktopApp = selectedApp || (filteredApps.length > 0 ? filteredApps[0] : null);

  if (!applications || applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60svh] px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-3 shadow-sm">
          <Clock className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-base font-bold text-neutral-900 mb-1">No Applications Yet</h3>
        <p className="text-xs text-neutral-600 max-w-xs">
          Swipe right on job roles in the deck to trigger AI tailoring & auto-submission!
        </p>
      </div>
    );
  }

  const handleCopyNote = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="px-3 py-1.5 rounded-full bg-neutral-900 text-white border border-neutral-900 text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            SUBMITTED
          </span>
        );
      case 'approved':
      case 'pending_review':
        return (
          <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-red-600" />
            READY / PENDING
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-extrabold border border-neutral-200">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 space-y-4">
      
      {/* Desktop Analytics Overview Header Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200 shadow-sm">
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-col justify-between">
          <span className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Total Tracked</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-neutral-900">{metrics.total}</span>
            <span className="text-xs font-extrabold text-neutral-500 uppercase">roles</span>
          </div>
        </div>

        <div className="p-4 bg-neutral-900 text-white rounded-2xl border border-neutral-900 flex flex-col justify-between shadow-md">
          <span className="text-xs font-extrabold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Auto-Submitted
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-white">{metrics.submitted}</span>
            <span className="text-xs font-extrabold text-emerald-400">
              {metrics.total > 0 ? Math.round((metrics.submitted / metrics.total) * 100) : 0}% success
            </span>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex flex-col justify-between">
          <span className="text-xs font-extrabold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-red-600" />
            Pending / Ready
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-red-600">{metrics.pending}</span>
            <span className="text-xs font-extrabold text-red-600">awaiting queue</span>
          </div>
        </div>

        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-col justify-between">
          <span className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-red-600" />
            Avg AI Match
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-neutral-900">{metrics.avgMatch}%</span>
            <span className="text-xs font-extrabold text-neutral-500">fit index</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4.5 h-4.5 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Filter by company or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:border-red-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs sm:text-sm font-extrabold text-neutral-600 flex items-center gap-1 mr-1">
            <Filter className="w-4 h-4 text-red-600" /> Status:
          </span>
          {(['all', 'submitted', 'pending', 'failed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold capitalize transition-all border ${
                statusFilter === st
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Layout: Responsive Grid on Mobile, Side-by-Side Inspector on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Application List (Full width mobile, 5 cols desktop) */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-3">
          {filteredApps.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-neutral-200 text-xs sm:text-sm text-neutral-500">
              No applications match your filter criteria.
            </div>
          ) : (
            filteredApps.map((app) => {
              const isSelected = activeDesktopApp?.id === app.id;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`bg-white rounded-2xl p-4.5 border transition-all duration-200 cursor-pointer shadow-xs flex flex-col justify-between gap-3.5 ${
                    isSelected
                      ? 'border-red-600 ring-2 ring-red-600/10 shadow-md bg-red-50/20'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building2 className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-extrabold text-neutral-700 uppercase tracking-wider truncate">
                          {app.job?.company?.name}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-neutral-900 leading-snug truncate">
                        {app.job?.title}
                      </h3>
                    </div>
                    <div className="shrink-0">{statusBadge(app.status)}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 text-xs sm:text-sm text-neutral-500">
                    <span className="font-semibold text-xs text-neutral-600">
                      {app.job?.atsType?.toUpperCase()} • {((app as any).createdAt) ? new Date((app as any).createdAt).toLocaleDateString() : 'Active Application'}
                    </span>

                    {app.status !== 'submitted' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubmitNow(app.id);
                        }}
                        disabled={submittingId === app.id}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        {submittingId === app.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white" />
                        )}
                        Submit
                      </button>
                    ) : (
                      <span className="text-xs font-extrabold text-neutral-900 flex items-center gap-1">
                        <Eye className="w-4 h-4 text-red-600" /> Inspected
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Desktop Inspector Panel (Hidden on mobile) */}
        <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 bg-white rounded-3xl p-6 xl:p-8 border border-neutral-200 shadow-xl flex-col max-h-[calc(100vh-170px)] min-h-[500px] overflow-y-auto">
          {activeDesktopApp ? (
            <div className="space-y-5">
              {/* Header Inspector */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-200">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs sm:text-sm font-extrabold text-red-600 uppercase tracking-wider">
                      {activeDesktopApp.job?.company?.name}
                    </span>
                    <span className="text-neutral-300">•</span>
                    <span className="text-xs sm:text-sm font-extrabold text-neutral-500 uppercase">
                      {activeDesktopApp.job?.atsType} ATS
                    </span>
                  </div>
                  <h2 className="text-2xl xl:text-3xl font-black text-neutral-900 leading-tight">
                    {activeDesktopApp.job?.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(activeDesktopApp.status)}
                  <a
                    href={activeDesktopApp.job?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors border border-neutral-200"
                    title="Open Original Job Board"
                  >
                    <ExternalLink className="w-4.5 h-4.5" />
                  </a>
                </div>
              </div>

              {/* Playwright Confirmation Proof Screenshot (If Available) */}
              {activeDesktopApp.screenshotUrl ? (
                <div className="bg-neutral-900 text-white rounded-2xl p-4 sm:p-5 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                      Verified Playwright Form Submission Proof
                    </h4>
                    <button
                      onClick={() => onSubmitNow(activeDesktopApp.id)}
                      disabled={submittingId === activeDesktopApp.id}
                      className="text-xs font-mono font-bold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg border border-neutral-700 transition-colors flex items-center gap-1.5"
                      title="Re-run Playwright to re-capture proof screenshot"
                    >
                      {submittingId === activeDesktopApp.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Re-capture Proof
                    </button>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950 min-h-[200px] flex items-center justify-center">
                    <img
                      src={`http://localhost:5001${activeDesktopApp.screenshotUrl}`}
                      alt="Submission Confirmation Proof"
                      className="w-full max-h-[360px] object-contain hover:object-cover transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-red-50/70 rounded-2xl p-4 sm:p-5 border border-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-red-700">
                    <Clock className="w-4.5 h-4.5 text-red-600" />
                    <span>Submission Pending or Draft Stage</span>
                  </div>
                  {activeDesktopApp.status !== 'submitted' && (
                    <button
                      onClick={() => onSubmitNow(activeDesktopApp.id)}
                      disabled={submittingId === activeDesktopApp.id}
                      className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md shadow-red-600/30"
                    >
                      {submittingId === activeDesktopApp.id ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 fill-white" />
                      )}
                      Run Playwright Auto-Submit Now
                    </button>
                  )}
                </div>
              )}

              {/* Tailored Cover Note Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4.5 h-4.5 text-red-600" />
                    Tailored Cover Note Draft
                  </h4>
                  <button
                    onClick={() => handleCopyNote(activeDesktopApp.coverNote || '')}
                    className="text-xs sm:text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-1.5 font-extrabold"
                  >
                    {copiedNote ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copiedNote ? 'Copied!' : 'Copy Note'}
                  </button>
                </div>
                <div className="bg-neutral-50 p-4 sm:p-5 rounded-2xl border border-neutral-200 font-mono text-xs sm:text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                  {activeDesktopApp.coverNote || 'Standard tailored cover note attached.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center text-neutral-400">
              <Eye className="w-12 h-12 mb-3 opacity-50 text-neutral-400" />
              <p className="text-xs sm:text-sm font-bold text-neutral-600">Select an application on the left to inspect proof and cover notes</p>
            </div>
          )}
        </div>

      </div>

      {/* Details & Proof Screenshot Modal (Mobile fallback) */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 lg:hidden">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-6 relative border border-neutral-200 max-h-[88svh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-200 mb-4">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-neutral-900">
                  {selectedApp.job?.title}
                </h3>
                <p className="text-xs text-neutral-600">
                  {selectedApp.job?.company?.name} • Submitted Proof
                </p>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-600 hover:text-neutral-900 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Proof Screenshot if present */}
            {selectedApp.screenshotUrl && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-neutral-700 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Playwright Submission Confirmation Screenshot
                </h4>
                <img
                  src={`http://localhost:5001${selectedApp.screenshotUrl}`}
                  alt="Submission Confirmation Proof"
                  className="w-full rounded-2xl border border-neutral-200 shadow-md object-cover"
                />
              </div>
            )}

            {/* Tailored Cover Note */}
            <div className="mb-4">
              <h4 className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Submitted Cover Note
              </h4>
              <p className="text-xs text-neutral-800 bg-neutral-50 p-3 rounded-xl border border-neutral-200 leading-relaxed font-mono">
                {selectedApp.coverNote || 'Default tailored cover note attached.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

