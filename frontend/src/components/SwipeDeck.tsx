import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import type { Job } from '../types';
import {
  Sparkles,
  MapPin,
  ExternalLink,
  X,
  Heart,
  Building2,
  ChevronDown,
  Keyboard,
  CheckCircle2,
  Flame,
  Layers,
  Briefcase,
} from 'lucide-react';


interface SwipeDeckProps {
  jobs: Job[];
  onSwipe: (jobId: string, action: 'right' | 'left') => void;
  onRefreshDeck: () => void;
  selectedCategory: 'fulltime' | 'internship';
  onSelectCategory: (cat: 'fulltime' | 'internship') => void;
}

export const SwipeDeck: React.FC<SwipeDeckProps> = ({
  jobs,
  onSwipe,
  onRefreshDeck,
  selectedCategory,
  onSelectCategory,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedJob, setExpandedJob] = useState<Job | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reset index when category or jobs count changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedCategory, jobs.length]);

  // Ensure index is within valid bounds
  const validIndex = currentIndex >= jobs.length ? 0 : currentIndex;
  const currentJob = jobs[validIndex];

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const opacityLeft = useTransform(x, [-150, -20], [1, 0]);
  const opacityRight = useTransform(x, [20, 150], [0, 1]);

  const handleSwipe = (action: 'right' | 'left') => {
    if (!currentJob) return;
    onSwipe(currentJob.id, action);
    
    if (action === 'right') {
      setToastMessage(`⚡ Queued application for ${currentJob.company.name}`);
      setTimeout(() => setToastMessage(null), 3000);
    }

    setCurrentIndex((prev) => prev + 1);
    x.set(0);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      handleSwipe('right');
    } else if (info.offset.x < -100) {
      handleSwipe('left');
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipe('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipe('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentJob]);

  if (currentIndex >= jobs.length || !currentJob) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65svh] px-6 text-center">
        {/* Category Selector Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-neutral-200/80 rounded-2xl mb-8">
          <button
            onClick={() => onSelectCategory('fulltime')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === 'fulltime'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            💼 Full-Time Roles
          </button>
          <button
            onClick={() => onSelectCategory('internship')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === 'internship'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            🎓 Internships & Early Career
          </button>
        </div>

        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4 shadow-sm">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">
          {selectedCategory === 'fulltime' ? 'Full-Time Deck Reviewed!' : 'Internships Deck Reviewed!'}
        </h2>
        <p className="text-sm text-neutral-600 max-w-xs mb-6">
          You've reviewed all available {selectedCategory} postings. Click below to re-poll job boards for new openings.
        </p>
        <button
          onClick={onRefreshDeck}
          className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white shadow-lg shadow-red-600/30 transition-all"
        >
          Check New Postings
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-7xl mx-auto min-h-[calc(100svh-120px)] flex flex-col justify-center px-1 sm:px-4 py-2">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-neutral-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-neutral-700 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Deck Header: Category Tabs & Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-neutral-200 rounded-2xl px-5 py-3 mb-4 shadow-sm">
        {/* Category Tabs Switcher (Gap 10) */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
          <button
            onClick={() => onSelectCategory('fulltime')}
            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              selectedCategory === 'fulltime'
                ? 'bg-white text-red-600 shadow-xs border border-neutral-200'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Full-Time
          </button>
          <button
            onClick={() => onSelectCategory('internship')}
            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              selectedCategory === 'internship'
                ? 'bg-white text-red-600 shadow-xs border border-neutral-200'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Internships & Co-op
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-black flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-red-600 animate-pulse" />
            Sorted by Match %
          </span>
          <span className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">
            Job {currentIndex + 1} of {jobs.length}
          </span>
          <span className="hidden md:inline text-neutral-300">|</span>
          <span className="hidden md:flex text-xs font-semibold text-neutral-500 items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-red-600" />
            Keyboard Navigation (← Pass | Apply →)
          </span>
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Interactive Swipe Deck Card */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-md lg:max-w-none h-[clamp(460px,65svh,620px)] flex items-center justify-center">
            <AnimatePresence>
              <motion.div
                key={currentJob.id}
                style={{ x, rotate }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                className="absolute w-full h-full bg-white rounded-3xl p-5 sm:p-6 lg:p-7 flex flex-col justify-between cursor-grab active:cursor-grabbing border border-neutral-200 shadow-xl select-none"
                dragElastic={0.9}
                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
              >
                {/* Visual Drag Overlays */}
                <motion.div
                  style={{ opacity: opacityRight }}
                  className="absolute top-5 sm:top-6 right-5 sm:right-6 z-30 px-3.5 sm:px-5 py-2.5 rounded-2xl bg-white border-2 border-neutral-900 text-neutral-900 font-black text-sm sm:text-xl tracking-wider uppercase backdrop-blur-md shadow-lg"
                >
                  TAILOR & APPLY
                </motion.div>

                <motion.div
                  style={{ opacity: opacityLeft }}
                  className="absolute top-5 sm:top-6 left-5 sm:left-6 z-30 px-3.5 sm:px-5 py-2.5 rounded-2xl bg-white border-2 border-red-600 text-red-600 font-black text-sm sm:text-xl tracking-wider uppercase backdrop-blur-md shadow-lg"
                >
                  PASS
                </motion.div>

                {/* Top Badges Header */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase bg-neutral-100 text-neutral-800 border border-neutral-200">
                        {currentJob.atsType}
                      </span>
                      {currentJob.isFresh && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-600 fill-orange-500" />
                          🔥 Fresh Role
                        </span>
                      )}
                    </div>

                    {/* Match Score Badge */}
                    <div className="px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs sm:text-sm font-black flex shrink-0 items-center gap-1.5 shadow-xs">
                      <Sparkles className="w-4 h-4 text-red-600" />
                      {currentJob.matchScore}% MATCH
                    </div>
                  </div>

                  {/* Company & Title */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="w-13 h-13 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-red-600 font-black text-xl shrink-0">
                      {currentJob.company.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-extrabold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-4 h-4 text-red-600" />
                        {currentJob.company.name}
                      </h3>
                      <h2 className="text-2xl sm:text-3xl lg:text-3xl font-black text-neutral-900 leading-tight line-clamp-2 mt-1 mb-1 tracking-tight">
                        {currentJob.title}
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold text-neutral-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4 text-neutral-400" />
                        {currentJob.location || 'Remote'}
                      </p>
                    </div>
                  </div>

                  {/* "Why You Fit" AI Rationale Card */}
                  <div className="bg-red-50/60 border border-red-100 rounded-2xl p-4 mb-3">
                    <div className="flex items-center gap-1.5 text-red-600 text-xs sm:text-sm font-extrabold uppercase tracking-wider mb-1">
                      <Sparkles className="w-4 h-4" />
                      Why You Fit
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed">
                      {currentJob.whyFit}
                    </p>
                  </div>

                  <div className="relative">
                    <p className="text-xs sm:text-sm text-neutral-600 line-clamp-4 leading-relaxed font-normal">
                      {currentJob.description.replace(/<[^>]*>?/gm, '')}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <button
                    onClick={() => setExpandedJob(currentJob)}
                    className="lg:hidden text-xs sm:text-sm font-extrabold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                  >
                    Read Full Role <ChevronDown className="w-4 h-4" />
                  </button>
                  <span className="hidden lg:inline-block text-xs font-extrabold text-neutral-400 uppercase tracking-wider">
                    Full Description Loaded Right →
                  </span>

                  <a
                    href={currentJob.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs sm:text-sm font-extrabold text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
                  >
                    Original Board <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center justify-center gap-6 w-full">
              <button
                onClick={() => handleSwipe('left')}
                className="w-16 h-16 rounded-full bg-white border border-neutral-300 text-neutral-700 hover:border-red-600 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shadow-md transition-all transform hover:scale-105 active:scale-95 group relative"
                title="Pass (Left Arrow)"
              >
                <X className="w-8 h-8" />
                <span className="hidden lg:flex absolute -bottom-3 bg-neutral-900 text-white text-xs font-mono px-2 py-0.5 rounded shadow-xs font-bold">
                  ← PASS
                </span>
              </button>

              <button
                onClick={() => handleSwipe('right')}
                className="w-16 h-16 rounded-full bg-red-600 border border-red-500 text-white hover:bg-red-500 flex items-center justify-center shadow-xl shadow-red-600/30 transition-all transform hover:scale-105 active:scale-95 group relative"
                title="Tailor & Apply (Right Arrow)"
              >
                <Heart className="w-8 h-8 fill-white" />
                <span className="hidden lg:flex absolute -bottom-3 bg-red-900 text-white text-xs font-mono px-2 py-0.5 rounded shadow-xs font-bold">
                  APPLY →
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: Live Desktop Job Description Inspector Panel */}
        <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 bg-white rounded-3xl p-6 xl:p-8 border border-neutral-200 shadow-xl flex-col max-h-[calc(100vh-170px)] min-h-[500px]">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-200 shrink-0">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-red-600 font-black text-2xl shrink-0">
                {currentJob.company.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-red-600 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {currentJob.company.name} • {currentJob.atsType}
                </span>
                <h2 className="text-2xl xl:text-3xl font-black text-neutral-900 leading-tight mt-0.5 truncate">
                  {currentJob.title}
                </h2>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-neutral-500 font-semibold mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-neutral-400" />
                    {currentJob.location || 'Remote'}
                  </span>
                  <span>•</span>
                  <span>Posted {currentJob.postedAt ? new Date(currentJob.postedAt).toLocaleDateString() : 'Recently'}</span>
                </div>
              </div>
            </div>

            <a
              href={currentJob.url}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 border border-neutral-200 transition-colors shrink-0"
            >
              Original Job Board <ExternalLink className="w-4 h-4 text-neutral-500" />
            </a>
          </div>

          <div className="py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-black flex items-center gap-1.5 shadow-xs shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
                {currentJob.matchScore}% Match
              </div>
              <span className="text-xs text-neutral-700 font-semibold truncate flex-1 min-w-0" title={currentJob.whyFit}>
                {currentJob.whyFit}
              </span>
            </div>
            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ready for AI Tailoring
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pt-4 pr-3 text-sm leading-relaxed text-neutral-800 space-y-3 prose prose-neutral max-w-none">
            <h4 className="text-xs sm:text-sm font-black text-neutral-900 uppercase tracking-wider mb-2">
              Full Role Requirements & Details
            </h4>
            <div
              className="space-y-3 font-normal text-neutral-800 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentJob.description }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Job Description Drawer Modal */}
      {expandedJob && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 lg:hidden">
          <div className="w-full max-w-2xl bg-white rounded-3xl max-h-[88svh] overflow-y-auto p-5 sm:p-6 relative border border-neutral-200 text-neutral-900 shadow-2xl">
            <button
              onClick={() => setExpandedJob(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
              {expandedJob.company.name}
            </h3>
            <h2 className="text-xl font-extrabold text-neutral-900 mb-4">{expandedJob.title}</h2>
            <div
              className="text-xs text-neutral-700 space-y-2 leading-relaxed prose prose-neutral max-w-none"
              dangerouslySetInnerHTML={{ __html: expandedJob.description }}
            />
          </div>
        </div>
      )}
    </div>
  );
};


