'use client';

import { useEffect, useRef, useState } from 'react';

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

interface ChatInterfaceProps {
  userAvatarSrc?: string;
  onInsightsClick?: () => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    type: 'ai',
    content: 'Hi! How can I help you?',
  },
];

// Height of the fixed bottom nav bar (nav content + iOS safe-area padding)
const NAV_HEIGHT = 108;

export const ChatInterface = ({
  userAvatarSrc = '',
  onInsightsClick,
}: ChatInterfaceProps) => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputBottom, setInputBottom] = useState(NAV_HEIGHT);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep input just above the keyboard (or nav bar when keyboard is closed)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // Distance from the bottom of the visual viewport to the bottom of the layout viewport
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      setInputBottom(Math.max(NAV_HEIGHT, keyboardHeight + 8));
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type: 'user', content: trimmed },
    ]);
    setInputValue('');
    // API integration goes here
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="relative flex flex-col bg-background text-white font-body overflow-hidden touch-none" style={{ height: '100dvh', maxHeight: '100dvh' }}>
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-background flex justify-between items-center px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* User avatar */}
          <div className="w-9 h-9 rounded-full flex-shrink-0 bg-surface border border-white/10 flex items-center justify-center overflow-hidden">
            {userAvatarSrc ? (
              <img src={userAvatarSrc} alt="User Profile" className="w-full h-full object-cover" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" opacity={0.5}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>

          {/* Genie logo + app name */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex-shrink-0">
              <img
                src="/genie.png"
                alt="Genie"
                className="w-full h-full object-contain"
                style={{ mixBlendMode: 'screen' }}
              />
            </div>
            <h1 className="font-headline text-lg font-extrabold tracking-tighter text-white leading-none">
              Genie
            </h1>
          </div>
        </div>

        <button
          onClick={onInsightsClick}
          className="text-accent flex items-center justify-center p-2 active:scale-95 transition-transform duration-200"
          aria-label="Insights"
        >
          <span className="material-symbols-outlined">insights</span>
        </button>
      </header>

      {/* Scrollable messages — padded so content clears the fixed header and input */}
      <div className="flex-1 overflow-y-auto overscroll-contain pt-20 pb-6 px-6" style={{ touchAction: 'pan-y' }}>
        <div className="flex flex-col gap-10 max-w-md mx-auto">
          {messages.map((message) =>
            message.type === 'user' ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AiMessage key={message.id} content={message.content} insights={message.insights} />
            ),
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat input — tracks keyboard via visualViewport so it's never covered */}
      <div
        className="fixed left-0 w-full px-6 z-40 transition-[bottom] duration-75"
        style={{ bottom: inputBottom }}
      >
        <div className="max-w-md mx-auto">
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

function AiMessage({ content, insights }: { content: string; insights?: AiInsight[] }) {
  return (
    <div className="flex items-end gap-2">
      {/* Genie — blended against black, sits at the bottom-left of every AI bubble */}
      <div className="flex-shrink-0 w-20 h-24 self-end">
        <img
          src="/genie.png"
          alt="Genie"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      {/* Speech bubble — tail points left toward the genie */}
      <div className="relative flex-1 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white">
        <span
          className="absolute bottom-5 -left-[9px] w-0 h-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '10px solid #171717',
          }}
        />

        <div className="flex items-center gap-2 mb-3">
          <span
            className="material-symbols-outlined text-accent text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <span className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
            Genie
          </span>
        </div>

        <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />

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
