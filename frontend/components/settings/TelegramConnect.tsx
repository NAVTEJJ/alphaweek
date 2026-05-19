'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startTelegramConnect, disconnectTelegram } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { trackEvent, Events } from '@/lib/analytics';
import { Send, CheckCircle2, ExternalLink, Loader2, XCircle, Copy, Check } from 'lucide-react';

interface TelegramConnectProps {
  connected: boolean;
  chatId?: string | null;
  disabled?: boolean;
  onStatusChange: () => void;
}

export function TelegramConnect({ connected, chatId, disabled, onStatusChange }: TelegramConnectProps) {
  const [deeplink, setDeeplink] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const { mutate: startConnect, isPending: starting } = useMutation({
    mutationFn: startTelegramConnect,
    onSuccess: ({ deeplink }) => {
      setDeeplink(deeplink);
      setConnecting(true);
      // Poll for connection every 3 seconds for up to 10 minutes
      pollRef.current = setInterval(async () => {
        qc.invalidateQueries({ queryKey: ['profile'] });
        onStatusChange();
      }, 3000);
    },
    onError: () => toast.error('Failed to generate Telegram link. Try again.'),
  });

  const { mutate: doDisconnect, isPending: disconnecting } = useMutation({
    mutationFn: disconnectTelegram,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      onStatusChange();
      toast.success('Telegram disconnected.');
      trackEvent(Events.TELEGRAM_CONNECTED, { action: 'disconnect' });
    },
  });

  // When connected status changes from false to true, stop polling
  useEffect(() => {
    if (connected && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setConnecting(false);
      setDeeplink('');
      toast.success('Telegram connected successfully!');
      trackEvent(Events.TELEGRAM_CONNECTED, { action: 'connect' });
    }
  }, [connected]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(deeplink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-profit/10 border border-profit/20">
          <CheckCircle2 className="h-5 w-5 text-profit shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Telegram connected</p>
            {chatId && <p className="text-xs text-muted font-mono">Chat ID: {chatId}</p>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={disconnecting}
          onClick={() => doDisconnect()}
          className="text-loss hover:text-loss"
        >
          <XCircle className="h-4 w-4" /> Disconnect Telegram
        </Button>
      </div>
    );
  }

  if (connecting && deeplink) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3">
          <div className="flex items-center gap-2 text-primary-light">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Waiting for Telegram connection…</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Click the button below to open Telegram and start the bot. Once connected, this page will update automatically.
          </p>
          <div className="flex gap-2">
            <a
              href={deeplink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Send className="h-4 w-4" /> Open Telegram
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={copyLink}
              className="px-3 py-2.5 border border-border rounded-lg text-muted hover:text-white transition-colors"
              title="Copy link"
            >
              {copiedLink ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted">
            On mobile? Copy the link and open it in Telegram directly.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setConnecting(false);
            setDeeplink('');
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted leading-relaxed">
        Connect Telegram to receive your weekly brief as a message — plus instant price alert notifications.
        One click, no manual setup required.
      </p>
      <Button
        variant="primary"
        size="sm"
        loading={starting}
        disabled={disabled}
        onClick={() => startConnect()}
      >
        <Send className="h-4 w-4" /> Connect Telegram
      </Button>
    </div>
  );
}
