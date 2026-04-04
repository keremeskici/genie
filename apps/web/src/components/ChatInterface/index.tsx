'use client';

import { useState } from 'react';

export interface AiInsight {
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  insights?: AiInsight[];
}

export interface PortfolioInsight {
  sectionLabel: string;
  title: string;
  titleHighlight: string;
  body: string;
}

export interface NavItem {
  value: string;
  icon: string;
  label: string;
}

interface ChatInterfaceProps {
  userAvatarSrc?: string;
  mascotSrc?: string;
  messages?: ChatMessage[];
  isThinking?: boolean;
  portfolioInsight?: PortfolioInsight;
  navItems?: NavItem[];
  activeNav?: string;
  onSendMessage?: (message: string) => void;
  onNavChange?: (value: string) => void;
  onInsightsClick?: () => void;
}

const DEFAULT_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCEwhOXEQyj9mzNoPi-utIuMfSHd33uXlHE3V3gvuPI7i9nZKaCEy6yeBT35y9e-6EzzFxyL122wAaIQpdLxezs3Bxukv7gO64k81406FQmhyXSpuoyVbEgIPhZsXnyZIPx_6UqKMT2hd1KhQMd6PmhP9OGeo49t62_K-uKPUgwn0nmxsWdBMIRkuqP0WoS7h7JA7IB2oES40MCpXIx33Z7puvvt-ZBVaAZFmGBDHNVjfZYBsEJ395tKlsjTooN-d3-VkigWzuK';

const DEFAULT_MASCOT =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuADn3zuZOdfRkNdipv2LSKUJd8Jqy36G88WJd0kq7uFKa_S-_JVmCVlvBeP07TRU3FAt1mdOWsCW1wq4SJ5VxZ-SfVWqdg52fa8GCSLfXneE8f0pxs5t1pvPB3z4zacX3aK9y5g7iDt7Axp7BbXZWhRUAHL6_xVwoxoDnb2M8gEod7oFfk6YbjSQ9G2u11tdS5DjUE8nkUfN8BiHaEDwFBgAgGa9sFAnwwusXZABWMaH7W4QtBy9eEFjirPLqJNRwVRlifUCBIz';

const DEFAULT_PORTFOLIO_INSIGHT: PortfolioInsight = {
  sectionLabel: 'Portfolio Pulse',
  title: 'Your vault is breathing,',
  titleHighlight: 'Neon.',
  body: 'The curator has detected a 4.2% efficiency gap in your liquidity pool. Ready to re-balance?',
};

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    type: 'user',
    content: 'Explain why my gas fees were so high on the last transaction.',
  },
  {
    id: '2',
    type: 'ai',
    content:
      'The network congestion during your last "Flow" operation was peaked at <strong class="text-accent">342 Gwei</strong>. This was due to a high-volume NFT drop on the primary layer.',
    insights: [
      { label: 'Optimized Fee', value: '24 Gwei' },
      { label: 'Best Window', value: '02:00 AM' },
    ],
  },
];

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { value: 'vault', icon: 'account_balance_wallet', label: 'Vault' },
  { value: 'chat', icon: 'chat_bubble', label: 'AI Chat' },
  { value: 'flow', icon: 'swap_vert', label: 'Flow' },
  { value: 'curator', icon: 'auto_awesome', label: 'Curator' },
];

export const ChatInterface = ({
  userAvatarSrc = DEFAULT_AVATAR,
  mascotSrc = DEFAULT_MASCOT,
  messages = DEFAULT_MESSAGES,
  isThinking = true,
  portfolioInsight = DEFAULT_PORTFOLIO_INSIGHT,
  navItems = DEFAULT_NAV_ITEMS,
  activeNav = 'chat',
  onSendMessage,
  onNavChange,
  onInsightsClick,
}: ChatInterfaceProps) => {
  const [inputValue, setInputValue] = useState('');
  const [currentNav, setCurrentNav] = useState(activeNav);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSendMessage?.(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleNavClick = (value: string) => {
    setCurrentNav(value);
    onNavChange?.(value);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-white font-body">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-background flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            <img src={userAvatarSrc} alt="User Profile" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-headline text-xl font-extrabold tracking-tighter text-white">
            The Neon Ledger
          </h1>
        </div>
        <button
          onClick={onInsightsClick}
          className="text-accent flex items-center justify-center p-2 active:scale-95 transition-transform duration-200"
          aria-label="Insights"
        >
          <span className="material-symbols-outlined">insights</span>
        </button>
      </header>

      {/* Main Content Canvas */}
      <main className="min-h-screen pt-24 pb-40 px-6 flex flex-col gap-8 max-w-md mx-auto">
        {/* Portfolio Insight Card */}
        <section className="p-6 bg-surface">
          <p className="font-headline text-[10px] uppercase tracking-[0.2em] text-accent mb-2">
            {portfolioInsight.sectionLabel}
          </p>
          <h2 className="font-headline text-2xl font-bold leading-tight text-white">
            {portfolioInsight.title}{' '}
            <span className="text-accent">{portfolioInsight.titleHighlight}</span>
          </h2>
          <p className="mt-4 text-white/60 text-sm leading-relaxed">{portfolioInsight.body}</p>
        </section>

        {/* Chat Messages */}
        <div className="flex flex-col gap-10">
          {messages.map((message) =>
            message.type === 'user' ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AiMessage
                key={message.id}
                content={message.content}
                insights={message.insights}
                mascotSrc={mascotSrc}
              />
            ),
          )}

          {isThinking && <ThinkingIndicator />}
        </div>
      </main>

      {/* Sticky Chat Input */}
      <div className="fixed bottom-32 left-0 w-full px-6 pointer-events-none z-40">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-surface p-2 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Ledger..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 placeholder:text-white/30 text-white outline-none"
            />
            <button
              onClick={handleSend}
              className="w-10 h-10 bg-accent text-black flex items-center justify-center active:scale-90 transition-transform"
              aria-label="Send"
            >
              <span className="material-symbols-outlined">north</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-surface flex justify-around items-center px-4 pb-8 pt-4">
        {navItems.map((item) => {
          const isActive = currentNav === item.value;
          return (
            <button
              key={item.value}
              onClick={() => handleNavClick(item.value)}
              className={[
                'flex flex-col items-center justify-center px-5 py-2 active:scale-110 transition-transform',
                isActive ? 'text-accent' : 'text-white/40',
              ].join(' ')}
              aria-label={item.label}
            >
              <span className="material-symbols-outlined mb-1">{item.icon}</span>
              <span className="font-body text-[10px] font-bold uppercase tracking-widest">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end pl-12">
      <div className="bg-surface border border-white/10 p-4 rounded-t-2xl rounded-bl-2xl text-white">
        <p className="text-sm font-medium">{content}</p>
      </div>
    </div>
  );
}

function AiMessage({
  content,
  insights,
  mascotSrc,
}: {
  content: string;
  insights?: AiInsight[];
  mascotSrc: string;
}) {
  return (
    <div className="flex items-end gap-4">
      {/* Mascot placeholder — preserve structure */}
      <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
        <img
          src={mascotSrc}
          alt="AI Mascot"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      {/* Bubble */}
      <div className="relative flex-1 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white">
        <div className="chat-bubble-tail" />
        <div className="flex items-center gap-2 mb-3">
          <span
            className="material-symbols-outlined text-accent text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <span className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
            Curator AI
          </span>
        </div>
        <p className="text-sm leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: content }} />
        {insights && insights.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {insights.map((insight) => (
              <div key={insight.label} className="bg-background p-3 border-l-2 border-accent/50">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                  {insight.label}
                </p>
                <p className="text-md font-bold text-accent">{insight.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-4 animate-pulse opacity-50">
      <div className="w-10 h-10 bg-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-white/40 text-sm">chat_bubble</span>
      </div>
      <div className="flex gap-1.5">
        <div className="w-2 h-2 bg-accent" />
        <div className="w-2 h-2 bg-accent" />
        <div className="w-2 h-2 bg-accent" />
      </div>
    </div>
  );
}
