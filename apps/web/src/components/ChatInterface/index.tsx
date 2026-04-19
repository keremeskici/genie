'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { getPublicApiBaseUrl, getPublicApiUrl } from '@/lib/backend-url';
import { MiniKit } from '@worldcoin/minikit-js';
import { useUserOperationReceipt } from '@worldcoin/minikit-react';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  executeMiniKitTransactions,
  extractMiniKitTransactionHash,
  isWalletTransactionRequiredResponse,
  requestMiniKitPermissions,
  triggerMiniKitPay,
  type WalletTransactionRequiredResponse,
  worldChainReceiptClient,
} from '@/lib/minikit';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ContactList, parseContactList, type ContactData } from '../ContactCard';
import { ConfirmCard, parseConfirmCard } from '../ConfirmCard';
import { ThinkingIndicator } from '../ThinkingIndicator';

export interface AiInsight {
  label: string;
  value: string;
}

const API_URL = getPublicApiBaseUrl();
const SHOW_CHAT_DEBUG = process.env.NEXT_PUBLIC_SHOW_CHAT_DEBUG === 'true';

// Height of the bottom nav bar — input floats above it when keyboard is closed
const NAV_HEIGHT = 148;
const COMPOSER_GAP = 12;

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
  const [inputBottom, setInputBottom] = useState(NAV_HEIGHT + COMPOSER_GAP);
  const [composerHeight, setComposerHeight] = useState(72);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [lastSendDebug, setLastSendDebug] = useState<string>('idle');
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const permissionsRequested = useRef(false);
  const handledWalletTxIds = useRef<Set<string>>(new Set());
  const [walletExecutionState, setWalletExecutionState] = useState<Record<string, 'pending' | 'success' | 'error'>>({});
  const [walletExecutionError, setWalletExecutionError] = useState<Record<string, string>>({});

  const transport = useMemo(
    () => new TextStreamChatTransport({ api: `${API_URL}/api/chat` }),
    [],
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
    onError: (err) => {
      console.error('[chat] useChat error:', err);
    },
    onFinish: ({ message }) => {
      console.log('[chat] assistant message finished:', message);
    },
  });
  const { poll } = useUserOperationReceipt({ client: worldChainReceiptClient });

  const isThinking = status === 'submitted';

  const scrollChatToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  // Hide nav when keyboard is open
  useEffect(() => {
    if (keyboardOpen) {
      document.documentElement.classList.add('keyboard-open');
    } else {
      document.documentElement.classList.remove('keyboard-open');
    }
    return () => {
      document.documentElement.classList.remove('keyboard-open');
    };
  }, [keyboardOpen]);

  // Track keyboard height via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kbHeight = window.innerHeight - vv.height - vv.offsetTop;
      const isOpen = kbHeight > 50;
      setKeyboardOpen(isOpen);
      setInputBottom(isOpen ? kbHeight + COMPOSER_GAP : NAV_HEIGHT + COMPOSER_GAP);
      // When keyboard opens, keep the latest messages visible above the composer.
      if (isOpen) {
        requestAnimationFrame(() => scrollChatToBottom('auto'));
        setTimeout(() => scrollChatToBottom('auto'), 80);
        setTimeout(() => scrollChatToBottom('smooth'), 180);
      }
      if (!isOpen) {
        const reset = () => {
          window.scrollTo(0, 0);
          document.body.scrollTop = 0;
        };
        reset();
        setTimeout(reset, 100);
        setTimeout(reset, 300);
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // Only allow scroll when content overflows
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollHeight > el.clientHeight + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (content) {
      ro.observe(content);
    }
    window.addEventListener('resize', check);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;

    const updateComposerHeight = () => {
      setComposerHeight(composer.getBoundingClientRect().height);
    };

    updateComposerHeight();
    const ro = new ResizeObserver(updateComposerHeight);
    ro.observe(composer);
    window.addEventListener('resize', updateComposerHeight);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateComposerHeight);
    };
  }, []);

  useEffect(() => {
    scrollChatToBottom('smooth');
  }, [messages, status]);

  useEffect(() => {
    if (!keyboardOpen) return;
    scrollChatToBottom('smooth');
  }, [keyboardOpen, composerHeight]);

  // Detect payment confirmation messages from agent and trigger MiniKit Pay
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const textContent = lastMsg.parts
      ?.filter((p: { type: string }) => p.type === 'text')
      .map((p: { type: string; text?: string }) => p.text ?? '')
      .join('');

    if (!textContent) return;

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

  useEffect(() => {
    if (messages.length === 0 || !session?.user?.id) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const textContent = lastMsg.parts
      ?.filter((p: { type: string }) => p.type === 'text')
      .map((p: { type: string; text?: string }) => p.text ?? '')
      .join('');

    const walletTxData = parseWalletTransactionRequired(textContent);
    if (!walletTxData) return;
    if (walletTxData.requiresExplicitConfirmation) return;
    if (handledWalletTxIds.current.has(walletTxData.txId)) return;

    handledWalletTxIds.current.add(walletTxData.txId);
    setWalletExecutionState((current) => ({ ...current, [walletTxData.txId]: 'pending' }));

    executeMiniKitTransactions(walletTxData.txPlan)
      .then(async ({ userOpHash }) => {
        const receipt = await poll(userOpHash);
        const finalHash = extractMiniKitTransactionHash(receipt) ?? userOpHash;

        const finalizeRes = await fetch(getPublicApiUrl('/api/confirm'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txId: walletTxData.txId,
            userId: session.user.id,
            txHash: finalHash,
          }),
        });
        
        const finalizeJson = await finalizeRes.json();

        if (!finalizeRes.ok && finalizeRes.status !== 409) {
          throw new Error(finalizeJson.message ?? finalizeJson.error ?? 'Transfer failed');
        }

        setWalletExecutionState((current) => ({ ...current, [walletTxData.txId]: 'success' }));
      })
      .catch((err) => {
        console.error('[chat] wallet transaction failed', err);
        setWalletExecutionState((current) => ({ ...current, [walletTxData.txId]: 'error' }));
        setWalletExecutionError((current) => ({
          ...current,
          [walletTxData.txId]: err instanceof Error ? err.message : 'Transfer failed',
        }));
      });
  }, [messages, poll, session?.user?.id]);

  const handleSend = async () => {
    if (!input.trim() || (status !== 'ready' && status !== 'error')) return;
    const text = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (!permissionsRequested.current) {
      permissionsRequested.current = true;
      requestMiniKitPermissions().then((perms) => {
        if (perms) console.log('[minikit] permissions granted:', perms);
      }).catch((err) => {
        console.warn('[minikit] permission request failed:', err);
      });
    }

    setLastSendDebug(`sending "${text}" to ${API_URL || 'same-origin'}/api/chat`);
    sendMessage(
      { text },
      {
        body: {
          userId: session?.user?.id,
          walletAddress: session?.user?.walletAddress,
        },
      },
    );

    if (MiniKit.isInstalled()) {
      MiniKit.sendHapticFeedback({ hapticsType: 'impact', style: 'medium' }).catch((err) => {
        console.warn('[minikit] haptic feedback failed:', err);
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 104)}px`;
  };

  return (
    <div className="flex flex-col bg-background text-white font-body h-full overflow-hidden">
      {/* Scrollable messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overscroll-contain pt-6 px-6"
        style={{
          paddingBottom: `${inputBottom + composerHeight + 24}px`,
          overflowY: 'auto',
          touchAction: canScroll ? 'pan-y' : 'none',
        }}
      >
        <div ref={contentRef} className="flex flex-col gap-10 max-w-md mx-auto">
          {messages.length === 0 && <EmptyState />}
          {messages.map((message) =>
            message.role === 'user' ? (
              <UserMessage key={message.id} parts={message.parts} />
            ) : (
              <AiMessageBubble
                key={message.id}
                parts={message.parts}
                userId={session?.user?.id ?? ''}
                walletExecutionState={walletExecutionState}
                walletExecutionError={walletExecutionError}
                onContactSelect={(contact: ContactData) => {
                  if (status !== 'ready') return;
                  sendMessage(
                    { text: `Use contact ${contact.name} at wallet ${contact.walletAddress}` },
                    {
                      body: {
                        userId: session?.user?.id,
                        walletAddress: session?.user?.walletAddress,
                      },
                    },
                  );
                }}
              />
            ),
          )}
          {isThinking && <ThinkingIndicator />}
          {error && status === 'error' && (
            <ErrorMessage onRetry={() => regenerate()} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input — fixed so it floats above nav bar, then above keyboard when open */}
      <div
        ref={composerRef}
        className="fixed left-0 w-full px-6 z-50 transition-[bottom] duration-100"
        style={{
          bottom: inputBottom,
          touchAction: 'none',
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        }}
      >
        <div className="max-w-md mx-auto">
          {SHOW_CHAT_DEBUG && (
            <div className="mb-2 rounded-lg bg-black/80 px-3 py-2 text-[10px] leading-snug text-white/70 font-mono break-words">
              <div>chat status: {status}</div>
              <div>api: {API_URL || 'same-origin'}/api/chat</div>
              <div>session user: {session?.user?.id ?? 'none'}</div>
              <div>messages: {messages.length}</div>
              <div>
                last parts:{' '}
                {messages.at(-1)?.parts?.map((part) => part.type).join(', ') ?? 'none'}
              </div>
              <div>
                roles:{' '}
                {messages
                  .map((message) => {
                    const textLength = message.parts
                      ?.filter((part) => part.type === 'text')
                      .map((part) => part.text ?? '')
                      .join('').length ?? 0;
                    return `${message.role}:${textLength}`;
                  })
                  .join(' | ') || 'none'}
              </div>
              <div>last send: {lastSendDebug}</div>
              {error && <div>error: {error.message}</div>}
            </div>
          )}
          <div className="bg-surface p-2 flex items-end gap-2 rounded-2xl">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaInput}
              onFocus={() => {
                requestAnimationFrame(() => {
                  scrollChatToBottom('auto');
                });
                setTimeout(() => scrollChatToBottom('smooth'), 120);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 placeholder:text-white/30 text-white outline-none resize-none overflow-y-auto leading-relaxed"
              style={{ maxHeight: '104px', fontSize: '16px' }}
            />
            <button
              onClick={handleSend}
              className="w-10 h-10 bg-accent text-black flex items-center justify-center active:scale-90 transition-transform flex-shrink-0 rounded-xl"
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
      <div className="relative flex-1 min-w-0 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white break-words">
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
        <p className="text-sm leading-relaxed">Hi, I&apos;m Genie, your personal accountant.</p>
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
      <div className="relative bg-surface border border-white/10 p-4 rounded-t-2xl rounded-bl-2xl text-white break-words min-w-0">
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
  onContactSelect,
  userId,
  walletExecutionState,
  walletExecutionError,
}: {
  parts: Array<{ type: string; text?: string }>;
  onContactSelect: (contact: ContactData) => void;
  userId: string;
  walletExecutionState: Record<string, 'pending' | 'success' | 'error'>;
  walletExecutionError: Record<string, string>;
}) {
  const textContent = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');

  const contactData = parseContactList(textContent);
  const confirmData = parseConfirmCard(textContent);
  const walletTxData = parseWalletTransactionRequired(textContent);

  const markdownText = (contactData || confirmData || walletTxData)
    ? textContent.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim()
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
      <div className="relative flex-1 min-w-0 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white break-words">
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
                  <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-white">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="bg-background px-1 text-accent text-xs font-mono">{children}</code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-background p-3 text-xs font-mono overflow-x-auto text-white/80 my-2">{children}</pre>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-sm space-y-1 my-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-sm space-y-1 my-2">{children}</ol>
                ),
                a: ({ href, children }) => (
                  <a href={href} className="text-accent underline" target="_blank" rel="noopener noreferrer">{children}</a>
                ),
              }}
            >
              {markdownText}
            </ReactMarkdown>
          )}
          {contactData && <ContactList data={contactData} onSelect={onContactSelect} />}
          {walletTxData && !walletTxData.requiresExplicitConfirmation && (
            <WalletExecutionCard
              data={walletTxData}
              state={walletExecutionState[walletTxData.txId] ?? 'pending'}
              error={walletExecutionError[walletTxData.txId]}
            />
          )}
          {confirmData && (
            <ConfirmCard data={confirmData} userId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}

function parseWalletTransactionRequired(text: string): WalletTransactionRequiredResponse | null {
  const matches = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]);
      if (isWalletTransactionRequiredResponse(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function WalletExecutionCard({
  data,
  state,
  error,
}: {
  data: WalletTransactionRequiredResponse;
  state: 'pending' | 'success' | 'error';
  error?: string;
}) {
  if (state === 'success') {
    return (
      <div className="mt-3 bg-background border border-white/10 p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-accent text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-sm font-bold text-white">Sent ${data.amount} USDC</p>
        </div>
        <p className="text-xs text-white/45">Wallet transaction completed.</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mt-3 bg-background border border-red-500/20 p-4 rounded-xl">
        <p className="text-sm font-bold text-red-400 mb-1">Wallet transaction failed</p>
        <p className="text-xs text-white/60">{error ?? 'Transfer failed'}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-background border border-white/10 p-4 rounded-xl">
      <p className="text-sm font-bold text-white mb-1">Opening World App wallet...</p>
      <p className="text-xs text-white/50">
        Approve the bundled Permit2 approval and transfer for ${data.amount} USDC.
      </p>
    </div>
  );
}

function ErrorMessage({ onRetry }: { onRetry: () => void }) {
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
      <div className="relative flex-1 min-w-0 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white border border-red-500/30 break-words">
        <span
          className="absolute bottom-5 -left-[9px] w-0 h-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '10px solid #171717',
          }}
        />
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-red-400 text-lg">error</span>
          <span className="font-headline text-[10px] uppercase tracking-widest text-red-400 font-bold">Error</span>
        </div>
        <p className="text-sm text-white/70 mb-3">Something went wrong. Please try again.</p>
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
