'use client';

import { useState, useEffect } from 'react';
import { useProfile, useReferralStats } from '@/lib/hooks';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api, updateProfile, applyReferralCode, getTelegramStatus, fetchEmailSubscription, updateEmailSubscription } from '@/lib/api';
import { useClerk } from '@clerk/nextjs';
import { ensurePushSubscribed, removePushSubscription } from '@/lib/push';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TelegramConnect } from '@/components/settings/TelegramConnect';
import {
  User, Send, Copy, CheckCheck,
  Gift, Users, Shield, Trash2, AlertTriangle, Bell, ExternalLink,
} from 'lucide-react';
import { trackEvent, Events } from '@/lib/analytics';
import { useToast } from '@/components/ui/toast';

export default function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const { data: referralStats } = useReferralStats();
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useClerk();

  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [formInit, setFormInit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) { setPushPermission('unsupported'); return; }
    setPushPermission(Notification.permission);
  }, []);

  async function handleEnablePush() {
    setPushLoading(true);
    const subscribed = await ensurePushSubscribed().catch(() => false);
    setPushPermission(subscribed ? 'granted' : Notification.permission ?? 'denied');
    setPushLoading(false);
  }

  async function handleDisablePush() {
    setPushLoading(true);
    await removePushSubscription().catch(() => null);
    setPushPermission('denied');
    setPushLoading(false);
  }

  // Populate form once loaded (avoid overwriting on re-render)
  if (!isLoading && profile && !formInit) {
    setName(profile.name ?? '');
    setFormInit(true);
  }

  // Telegram status — polled separately so TelegramConnect can trigger refresh
  const { data: telegramStatus, refetch: refetchTelegram } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: getTelegramStatus,
    staleTime: 5000,
  });

  const { mutate: saveProfile, isPending: saving } = useMutation({
    mutationFn: () => updateProfile({ name: name || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile saved');
      trackEvent(Events.PROFILE_SAVED);
    },
  });

  const { mutate: submitReferral, isPending: applyingReferral } = useMutation({
    mutationFn: () => applyReferralCode(referralInput.trim().toUpperCase()),
    onSuccess: (data) => {
      toast.success(data.message);
      trackEvent(Events.REFERRAL_CODE_APPLIED, { code: referralInput.trim().toUpperCase() });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['referral', 'stats'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setReferralInput('');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? 'Invalid referral code. Please check and try again.');
    },
  });

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.delete('/user/account');
      await signOut({ redirectUrl: '/' });
    } catch {
      toast.error('Failed to delete account. Please contact support.');
      setDeleting(false);
    }
  }

  function copyReferralCode() {
    navigator.clipboard.writeText(profile?.referralCode ?? '');
    setCopied(true);
    trackEvent(Events.REFERRAL_CODE_COPIED, { code: profile?.referralCode });
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-white">Settings</h1>
        <p className="text-muted text-sm mt-1">Manage your profile, delivery, and billing</p>
      </div>

      {/* ─── Profile ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary-light" />
            <CardTitle>Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <div>
            <p className="text-sm font-medium text-slate-300 mb-1.5">Email</p>
            <p className="text-sm text-muted font-mono">{profile?.email}</p>
            <p className="text-xs text-muted mt-1">Managed by Clerk — change via account settings</p>
          </div>
          <Button variant="primary" size="sm" loading={saving} onClick={() => saveProfile()}>
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* ─── Telegram ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-accent" />
              <CardTitle>Telegram Delivery</CardTitle>
            </div>
            {telegramStatus?.connected && (
              <Badge className="bg-profit/20 text-profit border-profit/20">Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <TelegramConnect
            connected={telegramStatus?.connected ?? false}
            chatId={telegramStatus?.chatId}
            disabled={false}
            onStatusChange={() => refetchTelegram()}
          />
        </CardContent>
      </Card>

      {/* ─── Push Notifications ──────────────────────────────────── */}
      {pushPermission !== 'unsupported' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary-light" />
                <CardTitle>Push Notifications</CardTitle>
              </div>
              {pushPermission === 'granted' && (
                <Badge className="bg-profit/20 text-profit border-profit/20">Enabled</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              Get an instant browser notification the moment your weekly brief is ready.
            </p>
            {pushPermission === 'denied' ? (
              <p className="text-xs text-amber-400">
                Push notifications are blocked in your browser. Reset the permission in your browser site settings, then refresh.
              </p>
            ) : pushPermission === 'granted' ? (
              <Button
                variant="outline"
                size="sm"
                loading={pushLoading}
                onClick={handleDisablePush}
                className="border-border text-muted hover:text-white"
              >
                Disable push notifications
              </Button>
            ) : (
              <Button variant="outline" size="sm" loading={pushLoading} onClick={handleEnablePush}>
                Enable push notifications
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Email subscription ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Email Delivery</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <EmailSubscriptionToggle />
        </CardContent>
      </Card>

      {/* ─── Security ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-400" />
            <CardTitle>Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border">
            <div>
              <p className="text-sm text-slate-200">Password & Authentication</p>
              <p className="text-xs text-muted mt-0.5">Managed securely by Clerk</p>
            </div>
            <a
              href="https://accounts.clerk.dev/user"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary-light hover:underline"
            >
              Manage <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs text-muted">
            AlphaWeek uses Clerk for authentication. Your password and 2FA settings are managed in your Clerk account.
          </p>
        </CardContent>
      </Card>

      {/* ─── Referral — share code ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-light" />
              <CardTitle>Your Referral Code</CardTitle>
            </div>
            {referralStats !== undefined && (
              <Badge variant="muted">
                {referralStats.referralCount} friend{referralStats.referralCount === 1 ? '' : 's'} joined
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Share your code with friends — every time someone signs up, you both get notified and we keep track for future perks.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-2 rounded-lg bg-surface-2 border border-border font-mono text-sm text-accent tracking-widest">
              {profile?.referralCode ?? '—'}
            </code>
            <Button variant="ghost" size="sm" onClick={copyReferralCode}>
              {copied ? <CheckCheck className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Share link:{' '}
            <span className="text-primary-light font-mono text-xs">
              {typeof window !== 'undefined' ? `${window.location.origin}/sign-up?ref=${profile?.referralCode}` : ''}
            </span>
          </p>

          {referralStats && referralStats.recentReferrals.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Recent referrals</p>
              <ul className="space-y-1.5">
                {referralStats.recentReferrals.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">{r.displayName}</span>
                    <span className="text-xs text-muted">
                      {new Date(r.joinedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Referral — apply code ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-accent" />
            <CardTitle>Apply a Referral Code</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile?.referredBy ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-profit/10 border border-profit/20">
              <CheckCheck className="h-4 w-4 text-profit shrink-0" />
              <p className="text-sm text-emerald-300">Referral code already applied to this account.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                Have a friend&apos;s referral code? Apply it — they&apos;ll get a notification that you joined.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                  placeholder="e.g. DEVPRO001"
                  className="font-mono tracking-widest"
                />
                <Button
                  variant="accent"
                  size="sm"
                  loading={applyingReferral}
                  disabled={referralInput.trim().length < 3}
                  onClick={() => submitReferral()}
                >
                  Apply
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Danger Zone ──────────────────────────────────────────── */}
      <Card className="border-loss/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-loss" />
            <CardTitle className="text-loss">Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Permanently delete your account, all your briefs, portfolio data, and cancel any active subscription.
            This action cannot be undone.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-loss/40 text-loss hover:bg-loss/10"
            onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); }}
          >
            Delete my account
          </Button>
        </CardContent>
      </Card>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-loss/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-loss" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Delete account</h3>
                <p className="text-xs text-muted">This is permanent and cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              All your briefs, portfolio data, price alerts, and subscription will be permanently deleted.
              Your Stripe subscription will be cancelled immediately.
            </p>

            <div>
              <p className="text-xs text-muted mb-2">
                Type <span className="font-mono text-loss">DELETE</span> to confirm:
              </p>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-loss/40 text-loss hover:bg-loss/10 disabled:opacity-40"
                disabled={deleteConfirm !== 'DELETE' || deleting}
                loading={deleting}
                onClick={handleDeleteAccount}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailSubscriptionToggle() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['email-subscription'],
    queryFn: fetchEmailSubscription,
    staleTime: 60_000,
  });
  const { mutate: toggle, isPending } = useMutation({
    mutationFn: (subscribed: boolean) => updateEmailSubscription(subscribed),
    onSuccess: ({ subscribed }) => {
      qc.setQueryData(['email-subscription'], { subscribed });
      toast.success(subscribed ? 'Brief emails re-enabled.' : 'Brief emails turned off.');
    },
    onError: () => toast.error('Could not update preference. Try again.'),
  });

  const subscribed = data?.subscribed ?? true;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border">
      <div className="pr-4">
        <p className="text-sm font-medium text-slate-200">Brief delivery emails</p>
        <p className="text-xs text-muted mt-0.5">
          {subscribed
            ? 'You receive weekly and daily briefs via email.'
            : "You won't receive brief emails. You can still read briefs in the app."}
        </p>
      </div>
      <Button
        size="sm"
        variant={subscribed ? 'outline' : 'primary'}
        loading={isLoading || isPending}
        onClick={() => toggle(!subscribed)}
      >
        {subscribed ? 'Turn off' : 'Re-enable'}
      </Button>
    </div>
  );
}
