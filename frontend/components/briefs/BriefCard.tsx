'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Download, Clock, CheckCircle2, AlertCircle, Loader2, Share2, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { trackEvent, Events } from '@/lib/analytics';
import { fetchSignedBriefPdfUrl } from '@/lib/api';

type BriefStatus = 'pending' | 'generating' | 'completed' | 'failed';
type BriefType = 'weekly' | 'daily';

interface Brief {
  id: string;
  briefType?: BriefType;
  weekOf: string;
  status: BriefStatus;
  planAtGeneration: string;
  pdfUrl?: string | null;
  generatedAt?: string | null;
  createdAt: string;
  readMinutes?: number;
  wordCount?: number;
}

const StatusIcon = ({ status }: { status: BriefStatus }) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-profit" />;
    case 'failed': return <AlertCircle className="h-4 w-4 text-loss" />;
    case 'generating': return <Loader2 className="h-4 w-4 text-accent animate-spin" />;
    default: return <Clock className="h-4 w-4 text-muted" />;
  }
};

const STATUS_LABEL: Record<BriefStatus, string> = {
  pending: 'Queued',
  generating: 'Generating…',
  completed: 'Ready',
  failed: 'Failed',
};

export function BriefCard({ brief }: { brief: Brief }) {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}/preview/${brief.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      trackEvent(Events.BRIEF_SHARED, { briefId: brief.id, weekOf: brief.weekOf });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handlePdfDownload() {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const { url } = await fetchSignedBriefPdfUrl(brief.id);
      trackEvent(Events.PDF_DOWNLOADED, { briefId: brief.id, weekOf: brief.weekOf });
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Card className="hover:border-border-light transition-colors">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary-light" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-100">
                  {brief.briefType === 'daily'
                    ? formatDate(brief.weekOf)
                    : `Week of ${formatDate(brief.weekOf)}`}
                </p>
                {brief.briefType === 'daily' && (
                  <Badge className="text-xs bg-accent/15 text-accent border-accent/20">Daily</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusIcon status={brief.status} />
                <span className="text-xs text-muted">{STATUS_LABEL[brief.status]}</span>
                {brief.status === 'completed' && brief.readMinutes && brief.readMinutes > 0 && (
                  <>
                    <span className="text-muted">·</span>
                    <span className="text-xs text-muted font-mono">{brief.readMinutes} min read</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {brief.status === 'completed' && (
              <>
                <Link href={`/briefs/${brief.id}`}>
                  <Button size="sm" variant="outline">
                    Read
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={handleShare} title="Copy shareable link">
                  {copied ? <Check className="h-4 w-4 text-profit" /> : <Share2 className="h-4 w-4" />}
                </Button>
                {brief.pdfUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePdfDownload}
                    loading={pdfLoading}
                    title={`Download PDF for week of ${formatDate(brief.weekOf)}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {brief.status === 'failed' && (
              <span className="text-xs text-loss">Generation failed</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
