'use client';

const MOOD_CONFIG = {
  BULLISH:  { bg: 'bg-profit/10',   border: 'border-profit/25',   dot: 'bg-profit',   text: 'text-profit',   label: 'Bullish' },
  CAUTIOUS: { bg: 'bg-amber-500/10', border: 'border-amber-500/25', dot: 'bg-amber-400', text: 'text-amber-300', label: 'Cautious' },
  BEARISH:  { bg: 'bg-loss/10',     border: 'border-loss/25',     dot: 'bg-loss',     text: 'text-loss',     label: 'Bearish' },
  VOLATILE: { bg: 'bg-purple-500/10',border: 'border-purple-500/25',dot: 'bg-purple-400',text: 'text-purple-300',label: 'Volatile' },
} as const;

type Mood = keyof typeof MOOD_CONFIG;

interface Props {
  mood: string;
  moodReason: string | null;
}

export function MarketMood({ mood, moodReason }: Props) {
  const config = MOOD_CONFIG[mood as Mood] ?? MOOD_CONFIG.CAUTIOUS;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${config.bg} ${config.border}`}>
      <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${config.dot}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${config.text}`}>
            Market Mood
          </span>
          <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
        </div>
        {moodReason && (
          <p className="text-xs text-muted mt-0.5 leading-relaxed">{moodReason}</p>
        )}
      </div>
    </div>
  );
}
