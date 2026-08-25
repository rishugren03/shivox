import React from 'react';
import { Sparkles, Zap, ShieldCheck, ArrowRight, Flame, Lock } from 'lucide-react';

interface UnauthenticatedHeroProps {
  onOpenAuth: () => void;
}

export const UnauthenticatedHero: React.FC<UnauthenticatedHeroProps> = ({ onOpenAuth }) => {
  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 space-y-12">
      {/* Main Hero Header */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-extrabold shadow-sm animate-bounce">
          <Sparkles className="w-4 h-4 text-red-600" />
          Tsenta AI v2.0 • Autonomous Job Application Agent
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-neutral-900 leading-[1.1] tracking-tight">
          Swipe Right to <span className="text-red-600 underline decoration-red-200 underline-offset-8">Land Your Next AI Role</span>
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 font-medium leading-relaxed">
          Tsenta automatically scours 100+ top startup job boards, tailors your resume bullets to every role without inventing facts, and submits application forms using autonomous Playwright agents.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm shadow-xl shadow-red-600/30 transition-all transform hover:scale-105 flex items-center justify-center gap-3 group"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-800 font-extrabold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4 text-neutral-500" />
            <span>Sign In to Your Deck</span>
          </button>
        </div>
      </div>

      {/* Feature Value Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-lg space-y-3 hover:border-red-600/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-neutral-900">Tinder-Style Job Deck</h3>
          <p className="text-xs text-neutral-600 font-medium leading-relaxed">
            Review curated AI/ML & Engineering roles matching your background. Swipe right to queue background application pipelines instantly.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-lg space-y-3 hover:border-red-600/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-neutral-900">Authentic AI Tailoring</h3>
          <p className="text-xs text-neutral-600 font-medium leading-relaxed">
            GPT-4o rewrites your master resume bullets using vector similarity, highlighting exact keywords while staying 100% truthful to your experience.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-lg space-y-3 hover:border-red-600/50 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-neutral-900">Playwright Submission Proof</h3>
          <p className="text-xs text-neutral-600 font-medium leading-relaxed">
            Autonomous browser bots submit Greenhouse, Lever & Ashby forms for you, capturing screenshot proof of every single confirmation.
          </p>
        </div>
      </div>

      {/* Demo Interactive Deck Teaser Card */}
      <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-10 border border-neutral-800 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-4 max-w-md">
          <span className="px-3 py-1 rounded-full bg-red-600/20 text-red-400 text-xs font-extrabold border border-red-500/30 uppercase tracking-wider">
            Live Preview
          </span>
          <h2 className="text-2xl sm:text-3xl font-black leading-tight">
            See how Tsenta automates your job hunt in real-time
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-medium">
            Sign up in 30 seconds to upload your base resume, set work eligibility preferences, and let BullMQ background workers handle ATS submissions for you.
          </p>
          <button
            onClick={onOpenAuth}
            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-2"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mock Job Card */}
        <div className="w-full max-w-sm bg-white text-neutral-900 rounded-3xl p-6 border border-neutral-200 shadow-2xl space-y-4 transform md:rotate-2">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-neutral-100 text-neutral-800 border border-neutral-200">
              GREENHOUSE ATS
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-red-600" />
              94% MATCH
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">ElevenLabs</h4>
            <h3 className="text-xl font-black text-neutral-900">Senior AI Research Engineer</h3>
            <p className="text-xs text-neutral-500 font-semibold mt-0.5">San Francisco, CA • Remote</p>
          </div>

          <div className="bg-red-50/60 p-3 rounded-xl border border-red-100 text-xs text-neutral-800 font-medium">
            <span className="text-red-600 font-bold block mb-1">Why You Fit:</span>
            Your experience building real-time audio inference pipelines matches 94% of ElevenLabs core requirements.
          </div>

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 font-semibold">
            <span>Swipe Right → Queue Application</span>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
