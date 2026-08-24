import { useState } from 'react';
import type { Application } from '../types';
import { X, Sparkles, Send, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewModalProps {
  application: Application | null;
  onClose: () => void;
  onApproveAndSubmit: (appId: string, coverNote: string, bullets: string[]) => void;
  submitting: boolean;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  application,
  onClose,
  onApproveAndSubmit,
  submitting,
}) => {
  const [coverNote, setCoverNote] = useState(application?.coverNote || '');

  if (!application) return null;

  let tailoredBullets: string[] = [];
  if (Array.isArray(application.tailoredJson)) {
    tailoredBullets = application.tailoredJson;
  } else if (typeof application.tailoredJson === 'string') {
    try {
      tailoredBullets = JSON.parse(application.tailoredJson);
    } catch {
      tailoredBullets = [application.tailoredJson];
    }
  }

  if (!Array.isArray(tailoredBullets) || tailoredBullets.length === 0) {
    tailoredBullets = [
      'Spearheaded voice AI and LLM agentic architecture.',
      'Optimized real-time inference latency by 40%.',
    ];
  }

  const handleApprove = () => {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    onApproveAndSubmit(application.id, coverNote, tailoredBullets);
  };

  return (
    <AnimatePresence>
      {application && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-6 relative border border-neutral-200 shadow-2xl max-h-[90svh] overflow-y-auto text-neutral-900"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-200">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Tailoring & Review
                </span>
                <h2 className="text-lg font-extrabold text-neutral-900">
                  {application.job?.title || 'Job Application'}
                </h2>
                <p className="text-xs text-neutral-600 font-medium">
                  {application.job?.company?.name} • {application.job?.atsType?.toUpperCase()}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 hover:text-neutral-900 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Diff Section: Original vs Tailored Bullets */}
            <div className="my-5 space-y-4">
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-red-600" />
                  Tailored Resume Bullets (Diff Preview)
                </h3>

                <div className="space-y-3">
                  {tailoredBullets.map((bullet, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-3 border border-neutral-200 shadow-sm">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 mb-1">
                        <span className="text-neutral-400 line-through">Standard Bullet #{idx + 1}</span>
                        <ArrowRight className="w-3 h-3 text-red-600" />
                        <span className="text-neutral-900 font-bold">Tailored for Role</span>
                      </div>
                      <p className="text-xs font-medium text-neutral-800 leading-relaxed font-mono">
                        {bullet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cover Note Draft */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Cover Note & Short Answer Draft
                </label>
                <textarea
                  rows={4}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-neutral-300 text-xs text-neutral-800 p-3.5 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all leading-relaxed font-mono"
                  placeholder="Edit your cover note..."
                />
              </div>
            </div>

        {/* Approval Footer */}
        <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-200 transition-colors"
          >
            Review Later
          </button>

          <button
            onClick={handleApprove}
            disabled={submitting}
            className="w-full sm:flex-1 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting via Playwright...
              </span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Approve & Auto-Submit
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
    )}
  </AnimatePresence>
  );
};
