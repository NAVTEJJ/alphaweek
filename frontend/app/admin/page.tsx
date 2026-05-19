'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Activity,
  Lock,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type PlanKey = 'free' | 'starter' | 'pro' | 'elite' | 'whitelabel';

interface AdminStats {
  users: { total: number; byPlan: Record<PlanKey, number>; paid: number };
  briefs: { total: number; last7Days: number; failed: number };
  queue: { active: number; waiting: number; completed: number; failed: number };
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: PlanKey;
  createdAt: string;
  subscription: { status: string; renewedAt: string | null } | null;
}

const PLAN_COLORS: Record<PlanKey, string> = {
  free: 'bg-slate-700 text-slate-300',
  starter: 'bg-primary/20 text-primary-light',
  pro: 'bg-accent/20 text-amber-400',
  elite: 'bg-purple-500/20 text-purple-300',
  whitelabel: 'bg-emerald-500/20 text-emerald-400',
};

function StatBox({ label, value, sub, icon: Icon, color = 'text-white' }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted uppercase tracking-wider font-mono">{label}</p>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'users' | 'queue'>('overview');

  const fetchData = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'x-admin-key': key };
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers }),
        fetch(`${API_URL}/admin/users?limit=100`, { headers }),
      ]);

      if (statsRes.status === 403) {
        setError('Invalid admin key');
        setAuthenticated(false);
        return;
      }

      const [statsJson, usersJson] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
      ]);

      setStats(statsJson.data);
      setUsers(usersJson.data ?? []);
      setAuthenticated(true);
    } catch {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleLogin() {
    if (!keyInput.trim()) return;
    setAdminKey(keyInput);
    fetchData(keyInput);
  }

  // Auth screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-7 w-7 text-primary-light" />
            </div>
            <h1 className="font-heading text-2xl text-white mb-1">Admin Dashboard</h1>
            <p className="text-sm text-muted">Enter your ADMIN_API_KEY to continue</p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <input
              type="password"
              placeholder="Admin API key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono mb-3"
            />
            {error && <p className="text-xs text-loss mb-3">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const planOrder: PlanKey[] = ['free', 'starter', 'pro', 'elite', 'whitelabel'];

  return (
    <div className="min-h-screen bg-surface-2 text-slate-100">
      {/* Header */}
      <header className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-heading text-xl text-white">AlphaWeek Admin</h1>
          <p className="text-xs text-muted">Platform Operations Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(adminKey)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-sm text-muted hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatBox
              label="Total Users"
              value={stats.users.total}
              sub={`${stats.users.paid} paid`}
              icon={Users}
              color="text-white"
            />
            <StatBox
              label="Total Briefs"
              value={stats.briefs.total}
              sub={`${stats.briefs.last7Days} last 7 days`}
              icon={FileText}
              color="text-primary-light"
            />
            <StatBox
              label="Queue Status"
              value={`${stats.queue.active}A / ${stats.queue.waiting}W`}
              sub="Active / Waiting"
              icon={Activity}
              color="text-accent"
            />
            <StatBox
              label="Failed Briefs"
              value={stats.briefs.failed}
              sub="All time"
              icon={AlertCircle}
              color={stats.briefs.failed > 0 ? 'text-loss' : 'text-profit'}
            />
          </div>
        )}

        {/* Plan breakdown */}
        {stats && (
          <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">Users by Plan</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {planOrder.map((plan) => (
                <div key={plan} className="text-center p-4 rounded-xl bg-surface-2 border border-border">
                  <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded mb-2 ${PLAN_COLORS[plan]}`}>
                    {plan.toUpperCase()}
                  </span>
                  <p className="text-xl font-bold font-mono text-white">
                    {stats.users.byPlan[plan] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6">
          {(['overview', 'users', 'queue'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-surface-2 text-white shadow' : 'text-muted hover:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="text-left px-5 py-3 text-xs font-mono text-muted uppercase tracking-wider">User</th>
                    <th className="text-left px-5 py-3 text-xs font-mono text-muted uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-center text-xs font-mono text-muted uppercase tracking-wider">Plan</th>
                    <th className="px-4 py-3 text-center text-xs font-mono text-muted uppercase tracking-wider">Sub Status</th>
                    <th className="text-right px-5 py-3 text-xs font-mono text-muted uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-3/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-100">{user.name ?? '—'}</p>
                        <p className="text-xs text-muted font-mono truncate max-w-[120px]">{user.id}</p>
                      </td>
                      <td className="px-5 py-3 text-muted text-xs">{user.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${PLAN_COLORS[user.plan]}`}>
                          {user.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.subscription ? (
                          <span className={`text-xs font-mono flex items-center justify-center gap-1 ${
                            user.subscription.status === 'active' || user.subscription.status === 'trialing'
                              ? 'text-profit'
                              : 'text-loss'
                          }`}>
                            {user.subscription.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> :
                             user.subscription.status === 'trialing' ? <Clock className="h-3 w-3" /> :
                             <XCircle className="h-3 w-3" />}
                            {user.subscription.status}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted">
                        {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Queue tab */}
        {tab === 'queue' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active', value: stats.queue.active, icon: Activity, color: 'text-primary-light' },
              { label: 'Waiting', value: stats.queue.waiting, icon: Clock, color: 'text-accent' },
              { label: 'Completed', value: stats.queue.completed, icon: CheckCircle2, color: 'text-profit' },
              { label: 'Failed', value: stats.queue.failed, icon: XCircle, color: 'text-loss' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-surface border border-border rounded-2xl p-6 text-center">
                <Icon className={`h-8 w-8 ${color} mx-auto mb-3`} />
                <p className={`text-4xl font-bold font-mono ${color}`}>{value}</p>
                <p className="text-sm text-muted mt-2">{label} Jobs</p>
              </div>
            ))}
          </div>
        )}

        {/* Overview tab */}
        {tab === 'overview' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary-light" /> Revenue Signals
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted">Paid users</span>
                  <span className="font-mono font-semibold text-white">{stats.users.paid}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted">Conversion rate</span>
                  <span className="font-mono font-semibold text-accent">
                    {stats.users.total > 0 ? ((stats.users.paid / stats.users.total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted">Pro + Elite</span>
                  <span className="font-mono font-semibold text-primary-light">
                    {(stats.users.byPlan.pro ?? 0) + (stats.users.byPlan.elite ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted">Est. MRR</span>
                  <span className="font-mono font-semibold text-profit">
                    ${(
                      (stats.users.byPlan.starter ?? 0) * 29 +
                      (stats.users.byPlan.pro ?? 0) * 79 +
                      (stats.users.byPlan.elite ?? 0) * 199
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" /> Brief Health
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted">Total briefs generated</span>
                  <span className="font-mono font-semibold text-white">{stats.briefs.total}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted">Last 7 days</span>
                  <span className="font-mono font-semibold text-primary-light">{stats.briefs.last7Days}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted">Failed (all time)</span>
                  <span className={`font-mono font-semibold ${stats.briefs.failed > 0 ? 'text-loss' : 'text-profit'}`}>
                    {stats.briefs.failed}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted">Success rate</span>
                  <span className="font-mono font-semibold text-profit">
                    {stats.briefs.total > 0
                      ? (((stats.briefs.total - stats.briefs.failed) / stats.briefs.total) * 100).toFixed(1)
                      : 100}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
