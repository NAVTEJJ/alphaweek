'use client';

import { useProfile, useLatestBrief, useAlerts, useTriggerBrief, useLivePortfolio } from '@/lib/hooks';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Badge kept for the alerts panel below
import { Button } from '@/components/ui/button';
import { BriefCard } from '@/components/briefs/BriefCard';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Bell,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils';
import { trackEvent, Events } from '@/lib/analytics';
import { EarningsCalendar } from '@/components/dashboard/EarningsCalendar';
import { MarketClock } from '@/components/market/MarketClock';
import { InstantPreview } from '@/components/briefs/InstantPreview';
import Link from 'next/link';

function extractLeadParagraph(content: string): string {
  // Find the first proper paragraph after a heading (the narrative opening)
  const afterHeading = content.match(/^##[^\n]*\n+([\s\S]+?)(?=\n##|\n---)/m);
  const raw = afterHeading ? afterHeading[1].trim() : content;
  // Strip markdown syntax for clean plain-text preview
  return raw
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
    .slice(0, 480);
}

function timeAwareGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Up late';
}

export default function DashboardPage() {
  const { data: profile } = useProfile();
  const { data: latestBrief } = useLatestBrief();
  const { data: alerts } = useAlerts();
  const { data: live } = useLivePortfolio();
  const { mutate: triggerBrief, isPending: triggering } = useTriggerBrief();
  const toast = useToast();
  const alertList = Array.isArray(alerts) ? alerts : [];
  const weekLabel = latestBrief ? `Week of ${formatDate(latestBrief.weekOf)}` : 'No brief yet';
  const greeting = timeAwareGreeting();

  function handleTriggerBrief() {
    triggerBrief(undefined, {
      onSuccess: () => {
        toast.success('Brief queued! Track progress on the Briefs page.');
        trackEvent(Events.BRIEF_GENERATED);
      },
      onError: (err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg ?? 'Failed to queue brief. Try again.');
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl text-white">
            {greeting}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <MarketClock />
      </div>

      {/* Stats row — live portfolio + alerts + latest brief */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Portfolio Value"
          value={live ? formatCurrency(live.totalValue) : '—'}
          icon={<Briefcase className="h-4 w-4 text-primary-light" />}
          sub={live ? `Cost basis ${formatCurrency(live.totalCost)}` : 'Add holdings to track P&L'}
        />
        <StatCard
          label="Today"
          value={live && live.dayChangePercent !== 0 ? formatPercent(live.dayChangePercent) : '—'}
          icon={live && live.dayChangePercent < 0
            ? <TrendingDown className="h-4 w-4 text-loss" />
            : <TrendingUp className="h-4 w-4 text-profit" />}
          sub={live && live.benchmarkDayChangePercent !== null
            ? `Benchmark ${formatPercent(live.benchmarkDayChangePercent)}`
            : 'Live P&L'}
          valueClass={live && live.dayChangePercent < 0 ? 'text-loss' : 'text-profit'}
        />
        <StatCard
          label="Total P&L"
          value={live ? formatCurrency(live.totalPnL) : '—'}
          icon={<TrendingUp className="h-4 w-4 text-accent" />}
          sub={live ? formatPercent(live.totalPnLPercent) : 'Since purchase'}
          valueClass={live && live.totalPnL < 0 ? 'text-loss' : 'text-profit'}
        />
        <StatCard
          label="Latest Brief"
          value={latestBrief ? 'Ready' : 'Pending'}
          icon={<FileText className="h-4 w-4 text-accent" />}
          sub={weekLabel}
          valueClass={latestBrief ? 'text-profit' : 'text-muted'}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest brief — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Latest Brief</h2>
            <Link href="/briefs" className="text-xs text-primary-light hover:underline flex items-center gap-1">
              All briefs <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {latestBrief ? (
            <BriefCard brief={latestBrief} />
          ) : (
            <InstantPreview />
          )}

          {/* Brief preview / teaser */}
          {latestBrief?.content && (
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="text-sm">This Week&apos;s Top Story</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300 leading-relaxed line-clamp-5">
                  {extractLeadParagraph(latestBrief.content)}
                </p>
                <Link href={`/briefs/${latestBrief.id}`}>
                  <Button variant="ghost" size="sm" className="mt-4">
                    Read Full Brief <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel — 1/3 width */}
        <div className="space-y-4">
          {/* Alerts */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Notifications</CardTitle>
                <div className="flex items-center gap-2">
                  {alertList.length > 0 && (
                    <Badge variant="warning">{alertList.length} new</Badge>
                  )}
                  <Link href="/alerts" className="text-[10px] text-muted hover:text-primary-light transition-colors">
                    View all
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-3">
              {alertList.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-profit mb-2" />
                  <p className="text-xs text-muted">All caught up!</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {(alertList as { id: string; type: string; message: string; createdAt: string }[]).slice(0, 5).map((alert) => (
                    <li key={alert.id} className="flex gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-300 line-clamp-2">{alert.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Earnings Calendar */}
          <EarningsCalendar />

          {/* Quick actions */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-2">
              <Link href="/portfolio">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <TrendingUp className="h-4 w-4" /> Manage Portfolio
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                loading={triggering}
                onClick={handleTriggerBrief}
              >
                <RefreshCw className="h-4 w-4" />
                Generate Brief Now
              </Button>
              <Link href="/alerts">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Bell className="h-4 w-4" /> Price Alerts
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Bell className="h-4 w-4" /> Configure Delivery
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between mb-2">
          <p className="data-label">{label}</p>
          {icon}
        </div>
        <p className={`text-xl font-bold font-mono text-slate-100 ${valueClass ?? ''}`}>{value}</p>
        <p className="text-xs text-muted mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
