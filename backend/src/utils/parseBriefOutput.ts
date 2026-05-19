export interface BriefMetadata {
  mood: string | null;
  moodReason: string | null;
  briefSummary: string | null; // JSON array string: ["bullet1", "bullet2", "bullet3"]
  closingQuestion: string | null;
  cleanContent: string;        // markdown with all meta blocks stripped
}

// Extracts structured metadata blocks the LLM prepends/appends to the brief,
// strips them from the content, and returns clean markdown + parsed fields.
export function parseBriefOutput(raw: string): BriefMetadata {
  let working = raw.trim();
  let mood: string | null = null;
  let moodReason: string | null = null;
  let briefSummary: string | null = null;
  let closingQuestion: string | null = null;

  // ── META block at the top ────────────────────────────────────────────────
  const metaMatch = working.match(/<<<ALPHAWEEK_META>>>([\s\S]*?)<<<END_META>>>/);
  if (metaMatch) {
    const block = metaMatch[1];

    const moodLine = block.match(/^MOOD:\s*(.+)$/m);
    if (moodLine) mood = moodLine[1].trim();

    const reasonLine = block.match(/^MOOD_REASON:\s*(.+)$/m);
    if (reasonLine) moodReason = reasonLine[1].trim();

    const bullets: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const line = block.match(new RegExp(`^SUMMARY_${i}:\\s*(.+)$`, 'm'));
      if (line) bullets.push(line[1].trim());
    }
    if (bullets.length > 0) {
      briefSummary = JSON.stringify(bullets);
    }

    // Strip the entire META block from working content
    working = working.replace(/<<<ALPHAWEEK_META>>>[\s\S]*?<<<END_META>>>\n?/, '').trimStart();
  }

  // ── CLOSING block at the bottom ──────────────────────────────────────────
  const closingMatch = working.match(/<<<ALPHAWEEK_CLOSING>>>([\s\S]*?)<<<END_CLOSING>>>/);
  if (closingMatch) {
    const block = closingMatch[1];
    const qLine = block.match(/^CLOSING_QUESTION:\s*(.+)$/m);
    if (qLine) closingQuestion = qLine[1].trim();

    working = working.replace(/<<<ALPHAWEEK_CLOSING>>>[\s\S]*?<<<END_CLOSING>>>\n?/, '').trimEnd();
  }

  return { mood, moodReason, briefSummary, closingQuestion, cleanContent: working };
}
