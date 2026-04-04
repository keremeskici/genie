'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  {
    value: 'home',
    route: '/home',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
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
  '/profile': 'profile',
};

export const Navigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = PATH_TO_TAB[pathname] ?? 'home';
  const activeIndex = TABS.findIndex((t) => t.value === activeTab);

  const indicatorLeftPct = ((activeIndex * 2 + 1) / (TABS.length * 2)) * 100;

  return (
    <nav className="relative flex items-center w-full py-3">
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
            className="flex flex-col items-center justify-center gap-1 w-1/3 py-1 transition-all duration-150 active:scale-95"
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
