// Live market session state — replaces raw UTC cron times in the UI with a
// readable "US opens in 2h 14m" / "NSE closes in 1h" indicator.
//
// Hours are encoded as UTC minutes (e.g. 14h 30m → 870) for arithmetic. We
// don't model exchange-specific holidays — Yahoo's data simply returns the
// last close on those days, which is good enough for a status chip.

export type MarketName = 'US' | 'INDIA' | 'CRYPTO';

export interface MarketSession {
  market: MarketName;
  label: string;            // "US Markets" / "Indian Markets" / "Crypto"
  state: 'open' | 'closed' | 'pre' | 'after' | 'always-open';
  message: string;          // "Opens in 2h 14m" / "Closes in 32m" / "Closed for the weekend"
  msUntilNext: number | null; // null = always-open
}

function minutesUTC(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// US regular session: 09:30–16:00 ET = 14:30–21:00 UTC during EST (Nov–Mar);
// 13:30–20:00 UTC during EDT (Mar–Nov). We use a single 14:30–21:00 window
// — close enough for a status chip; for an exact handle we'd track DST.
const US_OPEN_MIN = 14 * 60 + 30;
const US_CLOSE_MIN = 21 * 60;
// Indian session: 09:15–15:30 IST = 03:45–10:00 UTC.
const INDIA_OPEN_MIN = 3 * 60 + 45;
const INDIA_CLOSE_MIN = 10 * 60;

function dayOfWeekUTC(d: Date): number {
  return d.getUTCDay();
}

function isWeekday(d: Date): boolean {
  const dow = dayOfWeekUTC(d);
  return dow >= 1 && dow <= 5;
}

// Returns the next Monday open in UTC milliseconds, given a current Date.
function nextMondayOpen(now: Date, openMin: number): number {
  const next = new Date(now);
  next.setUTCHours(Math.floor(openMin / 60), openMin % 60, 0, 0);
  const dow = next.getUTCDay();
  // dow 0=Sun, 6=Sat — advance until we hit Monday
  const daysToMon = (8 - dow) % 7 || 7;
  // ...but if we're ALREADY at Monday and the open hasn't happened, daysToMon
  // should be 0 — covered by the same-day branch in formatSession.
  next.setUTCDate(next.getUTCDate() + daysToMon);
  return next.getTime();
}

function nextOpenSameWeek(now: Date, openMin: number): number {
  // Today's open already passed? Try tomorrow if tomorrow is still a weekday.
  const candidate = new Date(now);
  candidate.setUTCHours(Math.floor(openMin / 60), openMin % 60, 0, 0);
  if (candidate.getTime() > now.getTime() && isWeekday(candidate)) {
    return candidate.getTime();
  }
  // Walk forward 1 day at a time looking for the next weekday open
  for (let i = 1; i <= 7; i++) {
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + i);
    next.setUTCHours(Math.floor(openMin / 60), openMin % 60, 0, 0);
    if (isWeekday(next)) return next.getTime();
  }
  return nextMondayOpen(now, openMin);
}

function buildSession(
  market: MarketName,
  label: string,
  openMin: number,
  closeMin: number,
  now: Date
): MarketSession {
  const min = minutesUTC(now);
  const todayIsWeekday = isWeekday(now);

  if (todayIsWeekday && min >= openMin && min < closeMin) {
    const closeTs = new Date(now);
    closeTs.setUTCHours(Math.floor(closeMin / 60), closeMin % 60, 0, 0);
    return {
      market,
      label,
      state: 'open',
      message: `Closes in ${formatDuration(closeTs.getTime() - now.getTime())}`,
      msUntilNext: closeTs.getTime() - now.getTime(),
    };
  }

  const openTs = nextOpenSameWeek(now, openMin);
  return {
    market,
    label,
    state: 'closed',
    message: `Opens in ${formatDuration(openTs - now.getTime())}`,
    msUntilNext: openTs - now.getTime(),
  };
}

function formatDuration(ms: number): string {
  if (ms < 0) return 'soon';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function getMarketSession(market: MarketName, now: Date = new Date()): MarketSession {
  if (market === 'CRYPTO') {
    return {
      market: 'CRYPTO',
      label: 'Crypto',
      state: 'always-open',
      message: 'Open 24/7',
      msUntilNext: null,
    };
  }
  if (market === 'US') {
    return buildSession('US', 'US Markets', US_OPEN_MIN, US_CLOSE_MIN, now);
  }
  return buildSession('INDIA', 'Indian Markets', INDIA_OPEN_MIN, INDIA_CLOSE_MIN, now);
}

// Returns all three sessions, sorted so the most-imminently-changing one comes
// first. Useful for the header chip — show the market that's about to open or
// close, not always US.
export function getAllSessions(now: Date = new Date()): MarketSession[] {
  return [getMarketSession('US', now), getMarketSession('INDIA', now), getMarketSession('CRYPTO', now)];
}
