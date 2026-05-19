'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload, FileText, CheckCircle, AlertCircle, X, Eye } from 'lucide-react';

interface ImportMeta {
  imported: number;
  total: number;
  invalidRowCount?: number;
  mode: string;
}

interface PreviewHolding {
  ticker: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
}

interface PreviewMeta {
  imported: number;
  invalidRowCount: number;
  existingCount: number;
  overlapCount: number;
  finalCount: number;
  mode: string;
}

interface PreviewResponse {
  data: { holdings: PreviewHolding[]; parsed: PreviewHolding[] };
  meta: PreviewMeta;
}

interface CsvImportProps {
  onSuccess?: () => void;
}

const SAMPLE_CSV = `ticker,exchange,quantity,avgBuyPrice
AAPL,NASDAQ,10,150.00
MSFT,NASDAQ,5,280.00
GOOGL,NASDAQ,2,125.00
NVDA,NASDAQ,8,450.00`;

export function CsvImport({ onSuccess }: CsvImportProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate: fetchPreview, isPending: previewing } = useMutation({
    mutationFn: async (csv: string) => {
      const { data } = await api.post('/portfolio/import-csv/preview', { csv, mode });
      return data as PreviewResponse;
    },
    onSuccess: (res) => {
      setPreview(res);
      setError(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? 'Could not parse this CSV. Check the column names.');
      setPreview(null);
    },
  });

  const { mutate: commitImport, isPending: importing } = useMutation({
    mutationFn: async (csv: string) => {
      const { data } = await api.post('/portfolio/import-csv', { csv, mode });
      return data as { data: unknown; meta: ImportMeta };
    },
    onSuccess: (res) => {
      setResult(res.meta);
      setError(null);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['portfolio', 'live'] });
      onSuccess?.();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? 'Import failed. Please check your CSV format.');
      setResult(null);
    },
  });

  // Re-fetch the preview whenever the CSV text or the mode changes — the merge
  // summary depends on `mode`, so a stale preview would mislead the user.
  useEffect(() => {
    if (csvText) fetchPreview(csvText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvText, mode]);

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    setFileName(file.name);
    setError(null);
    setResult(null);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alphaweek_portfolio_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFile() {
    setCsvText('');
    setFileName('');
    setResult(null);
    setError(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div>
        <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Import Mode</p>
        <div className="flex gap-3">
          {(['merge', 'replace'] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="accent-primary"
              />
              <span className="text-sm text-slate-300">
                {m === 'merge' ? 'Merge with existing' : 'Replace all holdings'}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted mt-1">
          {mode === 'merge'
            ? 'Imported tickers override existing ones; tickers not in the CSV are kept.'
            : 'All current holdings are replaced with the imported data.'}
        </p>
      </div>

      {/* Drop zone */}
      {!csvText ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            dragOver ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-surface-2/50'
          )}
        >
          <Upload className="h-8 w-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-slate-300 mb-1">Drop your CSV here, or click to browse</p>
          <p className="text-xs text-muted">Required columns: ticker, quantity, avgBuyPrice</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface-2">
          <FileText className="h-5 w-5 text-primary-light shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{fileName}</p>
            <p className="text-xs text-muted">{previewing ? 'Reading…' : 'Ready to preview'}</p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove uploaded file"
            className="text-muted hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-loss bg-loss/10 border border-loss/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="flex items-start gap-2 text-sm text-profit bg-profit/10 border border-profit/20 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Imported {result.imported} holdings ({result.mode}). Portfolio now has {result.total} holdings.
          </span>
        </div>
      )}

      {/* Preview table */}
      {preview && !result && (
        <div className="border border-border rounded-xl bg-surface-2/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-2/60 flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary-light" />
            <p className="text-sm font-medium text-slate-200">Preview</p>
            <span className="text-xs text-muted ml-auto">
              {preview.meta.imported} valid · {preview.meta.invalidRowCount} skipped · final {preview.meta.finalCount} holdings
              {preview.meta.mode === 'merge' && preview.meta.overlapCount > 0 && ` · ${preview.meta.overlapCount} overrides`}
            </span>
          </div>

          {preview.meta.invalidRowCount > 0 && (
            <div className="px-4 py-2 text-xs text-amber-300 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {preview.meta.invalidRowCount} row{preview.meta.invalidRowCount > 1 ? 's were' : ' was'} skipped (missing ticker, quantity, or price).
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted uppercase tracking-wider">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium">Ticker</th>
                  <th className="text-left px-4 py-2 font-medium">Exchange</th>
                  <th className="text-right px-4 py-2 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 font-medium">Avg Buy</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.parsed.map((h, i) => (
                  <tr key={`${h.ticker}-${i}`} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2 font-mono text-slate-100">{h.ticker}</td>
                    <td className="px-4 py-2 text-muted text-xs">{h.exchange}</td>
                    <td className="px-4 py-2 text-right text-slate-200">{h.quantity}</td>
                    <td className="px-4 py-2 text-right text-slate-200">{h.avgBuyPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!preview || preview.meta.imported === 0 || importing}
          loading={importing}
          onClick={() => commitImport(csvText)}
        >
          <CheckCircle className="h-4 w-4" />
          {preview ? `Confirm import (${preview.meta.imported})` : 'Import'}
        </Button>
        <Button variant="ghost" size="sm" onClick={downloadSample}>
          Download sample CSV
        </Button>
      </div>
    </div>
  );
}
