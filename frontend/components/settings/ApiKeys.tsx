'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { fetchApiKeys, createApiKey, deleteApiKey, ApiKeyRecord } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff } from 'lucide-react';

export function ApiKeys() {
  const qc = useQueryClient();
  const toast = useToast();
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: fetchApiKeys,
  });

  const { mutate: addKey, isPending: adding } = useMutation({
    mutationFn: () => createApiKey(newKeyName.trim()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setRevealedKey(data.key);
      setRevealedId(data.id);
      setNewKeyName('');
      toast.success('API key created. Copy it now — it won\'t be shown again.');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? 'Failed to create API key');
    },
  });

  const { mutate: revokeKey } = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
  });

  function copyKey(id: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted leading-relaxed">
        Use API keys to integrate AlphaWeek brief generation into your platform or client workflow.
        Keys grant access to the brief generation API on behalf of your account.
      </div>

      {/* Revealed key warning */}
      {revealedKey && revealedId && (
        <div className="p-4 rounded-xl border border-accent/40 bg-accent/5 space-y-2">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Copy this key now — it won't be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-slate-100 bg-surface-2 px-3 py-2 rounded border border-border break-all">
              {revealedKey}
            </code>
            <button
              onClick={() => copyKey(revealedId, revealedKey)}
              className="shrink-0 p-2 text-muted hover:text-white transition-colors"
            >
              {copiedId === revealedId ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={() => { setRevealedKey(null); setRevealedId(null); }}
            className="text-xs text-muted hover:text-slate-300 transition-colors"
          >
            I've copied this key →
          </button>
        </div>
      )}

      {/* Existing keys */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 bg-surface animate-pulse rounded-lg" />)}
        </div>
      ) : keys.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          {keys.map((key: ApiKeyRecord) => (
            <div key={key.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4 text-muted shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-200">{key.name}</p>
                  <p className="text-xs text-muted font-mono">{key.prefix}•••••••••••••</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {key.lastUsedAt && (
                  <span className="text-xs text-muted hidden sm:block">
                    Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => revokeKey(key.id)}
                  className="p-1.5 text-muted hover:text-loss transition-colors rounded"
                  title="Revoke key"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted py-2">No API keys yet. Create one below.</p>
      )}

      {/* Create new key */}
      <div className="flex gap-3">
        <Input
          placeholder="Key name (e.g. Production, Client Portal)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newKeyName.trim() && addKey()}
          className="flex-1"
        />
        <Button
          variant="primary"
          size="sm"
          loading={adding}
          disabled={!newKeyName.trim()}
          onClick={() => addKey()}
        >
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>
      <p className="text-xs text-muted">Max 10 active keys. Revoke unused keys to stay within the limit.</p>
    </div>
  );
}
