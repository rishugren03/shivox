import React from 'react';
import { Flame, CheckCircle2, User, RefreshCw, Bot } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  activeTab: 'deck' | 'tracker' | 'profile';
  setActiveTab: (tab: 'deck' | 'tracker' | 'profile') => void;
  onPoll: () => void;
  polling: boolean;
  appCount: number;
  onOpenAuth: () => void;
  userEmail?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onPoll,
  polling,
  appCount,
  onOpenAuth,
  userEmail,
}) => {
  const tabs = [
    { id: 'deck' as const, label: 'Deck', icon: Flame },
    { id: 'tracker' as const, label: 'Tracker', icon: CheckCircle2, badge: appCount },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  return (
    <header className="sticky top-0 sm:top-3 z-50 px-2 sm:px-4 lg:px-8 w-full max-w-7xl mx-auto pt-2 pb-2 sm:pb-3">
      <div className="bg-white/95 backdrop-blur rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-2 border border-neutral-200 shadow-md">
        
        {/* Brand Logo & Auth Status */}
        <div className="flex items-center gap-2.5 pl-1 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-200 shadow-xs shrink-0">
            <Bot className="w-5.5 h-5.5 text-red-600" />
          </div>
          <button
            onClick={onOpenAuth}
            className="flex flex-col text-left hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-neutral-900 leading-tight">Tsenta AI</span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-[10px] sm:text-xs font-mono font-bold text-neutral-600">
                Studio
              </span>
            </div>
            <span className="text-xs font-bold text-red-600 truncate max-w-[110px] sm:max-w-[160px]">
              {userEmail ? userEmail : 'Sign In'}
            </span>
          </button>
        </div>

        {/* Floating Tab Navigation */}
        <nav className="flex min-w-0 flex-1 sm:flex-none items-center justify-center gap-1 bg-neutral-100 p-1 sm:p-1.5 rounded-xl border border-neutral-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-extrabold transition-colors ${
                  isActive ? 'text-white' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="header-active-tab"
                    className="absolute inset-0 bg-red-600 rounded-lg shadow-sm"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  <span className="inline-block">{tab.label}</span>
                  {tab.badge ? (
                    <span className={`px-1.5 py-0.2 rounded-full flex items-center justify-center text-xs font-black ml-0.5 ${
                      isActive ? 'bg-white text-red-600' : 'bg-red-600 text-white'
                    }`}>
                      {tab.badge}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Poll Action */}
        <button
          onClick={onPoll}
          disabled={polling}
          className="w-10 h-10 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 hover:border-red-500 flex items-center justify-center text-neutral-600 hover:text-red-600 transition-all disabled:opacity-50 shadow-sm shrink-0"
          title="Poll latest job postings"
        >
          <RefreshCw className={`w-4.5 h-4.5 ${polling ? 'animate-spin text-red-600' : ''}`} />
        </button>
      </div>
    </header>
  );
};
