'use client';

import { Zap } from 'lucide-react';

interface Props {
  briefSummary: string; // JSON-encoded string[]
}

export function BriefSummary({ briefSummary }: Props) {
  let bullets: string[] = [];
  try {
    const parsed = JSON.parse(briefSummary);
    if (Array.isArray(parsed)) bullets = parsed.filter((b): b is string => typeof b === 'string');
  } catch {
    return null;
  }

  if (bullets.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/15 bg-primary/8">
        <Zap className="h-3.5 w-3.5 text-primary-light shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-primary-light">
          This week in 30 seconds
        </span>
      </div>
      <ul className="px-4 py-3 space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
            <span className="text-primary-light font-bold shrink-0 mt-0.5">{i + 1}.</span>
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
