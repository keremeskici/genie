'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  {
    value: 'home',
    route: '/home',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    value: 'chat',
    route: '/chat',
    label: 'Chat',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      </svg>
    ),
  },
  {
    value: 'wallet',
    route: '/wallet',
    label: 'Wallet',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 7.28V5c0-1.1-.9-2-2-2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2.28A2 2 0 0 0 22 15v-4a2 2 0 0 0-1-1.72zM20 15h-5v-4h5v4zm-5-6H4V5h16v2H15c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h1v2H4v-8h11V9z" />
      </svg>
    ),
  },
  {
    value: 'profile',
    route: '/profile',
    label: 'Profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
  },
];

const PATH_TO_TAB: Record<string, string> = {
  '/home': 'home',
  '/chat': 'chat',
  '/wallet': 'wallet',
  '/profile': 'profile',
};

export const Navigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = PATH_TO_TAB[pathname] ?? 'home';
  const activeIndex = TABS.findIndex((t) => t.value === activeTab);

  // With justify-around and N tabs, the center of tab i is at (2i+1)/(2N) * 100%
  const indicatorLeftPct = ((activeIndex * 2 + 1) / (TABS.length * 2)) * 100;

  return (
    <nav className="relative flex items-center w-full py-3">
      {/* Single sliding indicator — with equal-width buttons, centers are exactly at (2i+1)/(2N)*100% */}
      <span
        className="absolute top-0 h-[2px] w-6 bg-[#CCFF00] transition-all duration-300 ease-in-out"
        style={{ left: `${indicatorLeftPct}%`, transform: 'translateX(-50%)' }}
      />

      {TABS.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => router.push(tab.route)}
            className="flex flex-col items-center justify-center gap-1 w-1/4 py-1 transition-all duration-150 active:scale-95"
            aria-label={tab.label}
          >
            <span className={isActive ? 'text-[#CCFF00]' : 'text-white/40'}>
              {tab.icon}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-200 ${
                isActive ? 'text-[#CCFF00]' : 'text-white/40'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
