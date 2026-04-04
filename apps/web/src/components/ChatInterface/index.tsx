'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MiniKit } from '@worldcoin/minikit-js';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { triggerMiniKitPay, requestMiniKitPermissions } from '@/lib/minikit';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ContactList, parseContactList, type ContactData } from '../ContactCard';
import { ThinkingIndicator } from '../ThinkingIndicator';

export interface AiInsight {
  label: string;
  value: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const PLACEHOLDERS = [
  'Go off.',
  "What's the move?",
  'Hit me with it.',
  'Speak your truth.',
  "Let's cook.",
];

export const ChatInterface = () => {
  const { data: session } = useSession();
  const [input, setInput] = useState('');
  const [canScroll, setCanScroll] = useState(false);
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const permissionsRequested = useRef(false);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `${API_URL}/api/chat` }),
    [],
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
  });

  const isThinking = status === 'submitted';

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollHeight > el.clientHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [messages, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // Detect payment confirmation messages from agent and trigger MiniKit Pay (D-12)
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const textContent = lastMsg.parts
      ?.filter((p: { type: string }) => p.type === 'text')
      .map((p: { type: string; text?: string }) => p.text ?? '')
      .join('');

    if (!textContent) return;

    // Detect payment confirmation JSON fence from agent
    const jsonMatch = textContent.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!jsonMatch) return;

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.type === 'payment_confirmation' && parsed.to && parsed.amount) {
        triggerMiniKitPay({
          to: parsed.to,
          amountUsdc: parsed.amount,
          description: parsed.description ?? `Send ${parsed.amount} USDC`,
        }).then((result) => {
          if (result?.success) {
            console.log('[minikit] payment success:', result.transactionId);
          }
        });
      }
    } catch { /* not valid JSON — ignore */ }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || (status !== 'ready' && status !== 'error')) return;
    const text = input.trim();
    setInput('');

    // Request wallet address and user profile on first message (D-15)
    if (!permissionsRequested.current) {
      permissionsRequested.current = true;
      // Fire-and-forget — don't block the message send
      requestMiniKitPermissions().then((perms) => {
        if (perms) console.log('[minikit] permissions granted:', perms);
      });
    }

    // Haptic on send (D-14)
    if (MiniKit.isInstalled()) {
      await MiniKit.sendHapticFeedback({ hapticsType: 'impact', style: 'medium' });
    }
    sendMessage({ text }, { body: { userId: session?.user?.id } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="flex flex-col bg-background text-white font-body h-full">
      {/* Scrollable messages */}
      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 overscroll-contain pt-6 pb-4 px-6 ${canScroll ? 'overflow-y-auto' : 'overflow-y-hidden'}`}
        style={{ touchAction: canScroll ? 'pan-y' : 'none' }}
      >
        <div className="flex flex-col gap-10 max-w-md mx-auto">
          {messages.length === 0 && <EmptyState />}
          {messages.map((message) =>
            message.role === 'user' ? (
              <UserMessage key={message.id} parts={message.parts} />
            ) : (
              <AiMessageBubble key={message.id} parts={message.parts} />
            ),
          )}
          {isThinking && <ThinkingIndicator />}
          {error && status === 'error' && (
            <ErrorMessage error={error} onRetry={() => regenerate()} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat input — in-flow so it never scrolls with messages */}
      <div className="flex-shrink-0 px-6 py-3 bg-background touch-none" style={{ touchAction: 'none' }}>
        <div className="max-w-md mx-auto">
          <div className="bg-surface p-2 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
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

function EmptyState() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-shrink-0 w-20 h-24 self-end">
        <img
          src="/genie.png"
          alt="Genie"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>
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
        <p className="text-sm leading-relaxed">Hi! How can I help you?</p>
      </div>
    </div>
  );
}

function UserMessage({
  parts,
}: {
  parts: Array<{ type: string; text?: string }>;
}) {
  const text = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
  return (
    <div className="flex justify-end pl-12">
      <div className="relative bg-surface border border-white/10 p-4 rounded-t-2xl rounded-bl-2xl text-white">
        <span
          className="absolute bottom-4 -right-[9px] w-0 h-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: '10px solid #171717',
          }}
        />
        <p className="text-sm font-medium">{text}</p>
      </div>
    </div>
  );
}

function AiMessageBubble({
  parts,
}: {
  parts: Array<{ type: string; text?: string }>;
}) {
  const textContent = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');

  const contactData = parseContactList(textContent);

  const handleContactSelect = (contact: ContactData) => {
    // For hackathon: log selection. In production, this would feed back into sendMessage.
    console.log('[contact-select]', contact.name, contact.walletAddress);
  };

  // Strip the JSON fence from rendered markdown if contacts detected
  const markdownText = contactData
    ? textContent.replace(/```json\s*\n[\s\S]*?\n```/, '').trim()
    : textContent;

  return (
    <div className="flex items-end gap-2">
      <div className="flex-shrink-0 w-20 h-24 self-end">
        <img
          src="/genie.png"
          alt="Genie"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>
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
        <div className="text-sm leading-relaxed prose-invert">
          {markdownText && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="text-sm leading-relaxed mb-2 last:mb-0">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-white">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="bg-background px-1 text-accent text-xs font-mono">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-background p-3 text-xs font-mono overflow-x-auto text-white/80 my-2">
                    {children}
                  </pre>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-sm space-y-1 my-2">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-sm space-y-1 my-2">
                    {children}
                  </ol>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-accent underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {markdownText}
            </ReactMarkdown>
          )}
          {contactData && <ContactList data={contactData} onSelect={handleContactSelect} />}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ErrorMessage({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-shrink-0 w-20 h-24 self-end">
        <img
          src="/genie.png"
          alt="Genie"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>
      <div className="relative flex-1 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white border border-red-500/30">
        <span
          className="absolute bottom-5 -left-[9px] w-0 h-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '10px solid #171717',
          }}
        />
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-red-400 text-lg">
            error
          </span>
          <span className="font-headline text-[10px] uppercase tracking-widest text-red-400 font-bold">
            Error
          </span>
        </div>
        <p className="text-sm text-white/70 mb-3">
          Something went wrong. Please try again.
        </p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-accent text-black text-xs font-bold uppercase tracking-widest active:scale-95 transition-transform"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
