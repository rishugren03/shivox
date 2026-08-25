import React, { useState, useMemo, useEffect } from 'react';
import type { Application } from '../types';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  Building2,
  Search,
  Sparkles,
  Kanban,
  List as ListIcon,
  Send,
  MessageSquare,
  Award,
  FileText,
  ExternalLink,
} from 'lucide-react';

interface TrackerProps {
  applications: Application[];
  apiBase: string;
  onRefresh: () => void;
}

export const Tracker: React.FC<TrackerProps> = ({
  applications,
  apiBase,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'queued' | 'tailoring' | 'submitted' | 'failed'>('all');

  // SSE Listener for Real-Time Application Updates
  useEffect(() => {
    try {
      const streamUrl = `${apiBase}/applications/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'application_queued' || data.type === 'application_updated') {
            onRefresh();
          }
        } catch (e) {
          console.error('[SSE] JSON parse error:', e);
        }
      };

      return () => eventSource.close();
    } catch (e) {
      console.warn('[SSE] EventSource connection failed:', e);
    }
  }, [apiBase, onRefresh]);

  // Filter active applications (exclude passed/skipped)
  const activeApplications = useMemo(() => {
    return applications.filter((a) => a.status !== 'passed');
  }, [applications]);

  // Compute metrics overview
  const metrics = useMemo(() => {
    const total = activeApplications.length;
    const submitted = activeApplications.filter((a) => a.status === 'submitted').length;
    const pending = activeApplications.filter(
      (a) => a.status === 'queued' || a.status === 'tailoring' || a.status === 'pending_review' || a.status === 'approved'
    ).length;
    const failed = activeApplications.filter((a) => a.status === 'failed').length;
    const avgMatch =
      total > 0
        ? Math.round(activeApplications.reduce((acc, a) => acc + (a.job?.matchScore || 85), 0) / total)
        : 0;
    return { total, submitted, pending, failed, avgMatch };
  }, [activeApplications]);

  // Filtered applications
  const filteredApps = useMemo(() => {
    return activeApplications.filter((app) => {
      const matchesSearch =
        (app.job?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.job?.company?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'submitted') return app.status === 'submitted';
      if (statusFilter === 'queued') return app.status === 'queued';
      if (statusFilter === 'tailoring') return app.status === 'tailoring' || app.status === 'pending_review' || app.status === 'approved';
      if (statusFilter === 'failed') return app.status === 'failed';
      return true;
    });
  }, [activeApplications, searchQuery, statusFilter]);

  const activeDesktopApp = selectedApp || (filteredApps.length > 0 ? filteredApps[0] : null);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-white text-[11px] font-extrabold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            SUBMITTED
          </span>
        );
      case 'queued':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-extrabold flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-600 animate-spin" />
            QUEUED
          </span>
        );
      case 'tailoring':
        return (
          <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-extrabold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
            TAILORING
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 text-[11px] font-extrabold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-700" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-[11px] font-extrabold border border-neutral-200">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  // Kanban Stage Groupings
  const kanbanStages = [
    { key: 'queued', title: 'Queued', color: 'border-blue-500', icon: Clock },
    { key: 'tailoring', title: 'AI Tailoring', color: 'border-purple-500', icon: Sparkles },
    { key: 'submitted', title: 'Submitted', color: 'border-emerald-500', icon: Send },
    { key: 'replied', title: 'Replied', color: 'border-amber-500', icon: MessageSquare },
    { key: 'interview', title: 'Interviewing', color: 'border-indigo-500', icon: Award },
    { key: 'failed', title: 'Failed / Error', color: 'border-red-500', icon: AlertTriangle },
  ];

  if (!activeApplications || activeApplications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60svh] px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-3 shadow-sm">
          <Clock className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-base font-bold text-neutral-900 mb-1">No Applications Tracked Yet</h3>
        <p className="text-xs text-neutral-600 max-w-xs">
          Swipe right on job roles in the deck to trigger background AI tailoring & submission!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 space-y-4">
      {/* Analytics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200 shadow-sm">
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-col justify-between">
          <span className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Total Applications</span>
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
            Active Queue
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-red-600">{metrics.pending}</span>
            <span className="text-xs font-extrabold text-red-600">in process</span>
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

      {/* Control Bar: View Switcher (Kanban vs List) & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle (Gap 4) */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                viewMode === 'kanban'
                  ? 'bg-white text-red-600 shadow-xs border border-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Kanban className="w-4 h-4" />
              Kanban Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-red-600 shadow-xs border border-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <ListIcon className="w-4 h-4" />
              List View
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search application..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-red-600"
            />
          </div>

          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-[11px] font-extrabold">
            {(['all', 'queued', 'tailoring', 'submitted', 'failed'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-lg transition-all capitalize ${
                  statusFilter === filter
                    ? 'bg-white text-red-600 shadow-xs border border-neutral-200'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KANBAN BOARD VIEW (Gap 4) */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-4">
          {kanbanStages.map((stage) => {
            const StageIcon = stage.icon;
            const stageApps = filteredApps.filter((a) => {
              if (stage.key === 'queued') return a.status === 'queued';
              if (stage.key === 'tailoring')
                return a.status === 'tailoring' || a.status === 'pending_review' || a.status === 'approved';
              if (stage.key === 'submitted') return a.status === 'submitted';
              if (stage.key === 'replied') return a.status === 'replied';
              if (stage.key === 'interview') return a.status === 'interview';
              if (stage.key === 'failed') return a.status === 'failed';
              return false;
            });

            return (
              <div
                key={stage.key}
                className="bg-neutral-50 rounded-2xl p-3 border border-neutral-200 min-h-[450px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-200">
                  <span className="text-xs font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                    <StageIcon className="w-3.5 h-3.5 text-neutral-600" />
                    {stage.title}
                  </span>
                  <span className="px-2 py-0.5 bg-neutral-200 text-neutral-700 font-extrabold text-[11px] rounded-full">
                    {stageApps.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {stageApps.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className={`bg-white rounded-xl p-3 border ${stage.color} shadow-xs cursor-pointer hover:shadow-md transition-all space-y-2`}
                    >
                      <div className="text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-red-600" />
                        {app.job?.company?.name}
                      </div>
                      <div className="text-xs font-black text-neutral-900 leading-snug line-clamp-2">
                        {app.job?.title}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[10px] font-semibold text-neutral-500">
                        <span>{app.job?.atsType?.toUpperCase()}</span>
                        <span className="font-mono">{app.matchScore || 85}% Match</span>
                      </div>
                      {app.submittedResumeUrl && (
                        <a
                          href={`${apiBase.replace('/api', '')}${app.submittedResumeUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-extrabold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition-all w-full justify-center"
                        >
                          <FileText className="w-3 h-3 text-red-600" />
                          View Submitted Resume
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            {filteredApps.map((app) => {
              const isSelected = activeDesktopApp?.id === app.id;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs flex flex-col justify-between gap-3 ${
                    isSelected ? 'border-red-600 ring-2 ring-red-600/10 shadow-md bg-red-50/20' : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building2 className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-xs font-extrabold text-neutral-700 uppercase tracking-wider truncate">
                          {app.job?.company?.name}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-neutral-900 leading-snug truncate">
                        {app.job?.title}
                      </h3>
                    </div>
                    <div className="shrink-0">{statusBadge(app.status)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden lg:flex lg:col-span-7 bg-white rounded-3xl p-6 border border-neutral-200 shadow-xl flex-col min-h-[450px]">
            {activeDesktopApp ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between pb-3 border-b border-neutral-200">
                  <div>
                    <span className="text-xs font-bold text-red-600 uppercase">{activeDesktopApp.job?.company?.name}</span>
                    <h2 className="text-xl font-black text-neutral-900">{activeDesktopApp.job?.title}</h2>
                  </div>
                  <div>{statusBadge(activeDesktopApp.status)}</div>
                </div>

                {activeDesktopApp.submittedResumeUrl && (
                  <div className="bg-red-50/60 p-4 rounded-2xl border border-red-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-neutral-900 block">Submitted Resume PDF</span>
                        <span className="text-[11px] font-medium text-neutral-600">Exact resume submitted to {activeDesktopApp.job?.company?.name}</span>
                      </div>
                    </div>
                    <a
                      href={`${apiBase.replace('/api', '')}${activeDesktopApp.submittedResumeUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Submitted PDF
                    </a>
                  </div>
                )}

                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 font-mono text-xs text-neutral-800 leading-relaxed">
                  {activeDesktopApp.coverNote || 'Standard tailored cover note attached.'}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-neutral-400">
                <Eye className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-xs font-bold text-neutral-600">Select an application to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Application Drawer for Detailed View */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 border border-neutral-200 shadow-2xl relative space-y-4 max-h-[85svh] overflow-y-auto">
            <button
              onClick={() => setSelectedApp(null)}
              className="absolute top-4 right-4 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-red-600 uppercase">{selectedApp.job?.company?.name}</span>
              {statusBadge(selectedApp.status)}
            </div>
            <h2 className="text-xl font-black text-neutral-900">{selectedApp.job?.title}</h2>

            {selectedApp.submittedResumeUrl && (
              <div className="bg-red-50/60 p-4 rounded-2xl border border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-red-600" />
                  <div>
                    <h4 className="text-xs font-extrabold text-neutral-900">Submitted Resume Document</h4>
                    <p className="text-[11px] text-neutral-500">View or download PDF used for this application</p>
                  </div>
                </div>
                <a
                  href={`${apiBase.replace('/api', '')}${selectedApp.submittedResumeUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View PDF
                </a>
              </div>
            )}

            {selectedApp.screenshotUrl && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-700">Playwright Submission Proof Screenshot</h4>
                <img
                  src={`${apiBase.replace('/api', '')}${selectedApp.screenshotUrl}`}
                  alt="Submission Proof"
                  className="w-full rounded-xl border border-neutral-200 shadow-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-neutral-700">Tailored Cover Note</h4>
              <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 font-mono text-xs leading-relaxed text-neutral-800">
                {selectedApp.coverNote || 'Standard cover note attached.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
