'use client';

export const ThinkingIndicator = () => (
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
      <div className="flex items-center gap-2.5 h-5">
        <div className="flex gap-1.5 items-center">
          <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="genie-thinking-text text-sm font-medium">Genie is thinking</span>
      </div>
    </div>
  </div>
);
