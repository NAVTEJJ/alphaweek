import puppeteer, { Browser } from 'puppeteer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retryHelper';

// ─── Browser pool ─────────────────────────────────────────────────────────────
// Previously we launched a brand-new Chromium per PDF (~200-500MB RAM each).
// At Monday's batch peak that meant hundreds of concurrent browsers and OOMs.
// Now we reuse a single Chromium across all PDF generations in this process
// and only spawn fresh pages (cheap). Crash recovery: if puppeteer disconnects,
// the next call re-launches.

let sharedBrowser: Browser | null = null;
let browserLaunching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.connected) return sharedBrowser;
  if (browserLaunching) return browserLaunching;

  browserLaunching = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  }).then((b) => {
    sharedBrowser = b;
    // Auto-clear on disconnect so the next call relaunches.
    b.on('disconnected', () => {
      logger.warn('PDF browser disconnected — will relaunch on next request');
      sharedBrowser = null;
    });
    return b;
  }).finally(() => {
    browserLaunching = null;
  });

  return browserLaunching;
}

// Called on process shutdown so we don't leak a Chromium. The brief worker
// hooks SIGTERM/SIGINT in index.ts; if we ever need finer-grained lifecycle
// management we can add explicit close() there.
export async function shutdownPdfBrowser(): Promise<void> {
  if (sharedBrowser) {
    try { await sharedBrowser.close(); } catch { /* ignore */ }
    sharedBrowser = null;
  }
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'alphaweek-briefs';

// Pre-signed URL TTL — long enough for an email client to follow the link,
// short enough that a leaked URL doesn't grant indefinite access.
const SIGNED_URL_TTL_S = 3600; // 1 hour

// Generates a time-limited URL for fetching a stored PDF. The bucket itself
// should NOT have public-read enabled — callers must come through this fn.
export async function getSignedPdfUrl(key: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: SIGNED_URL_TTL_S }
  );
}

// HTML-escape a single text node. Prevents brief content with stray < or & from
// breaking the rendered template.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convert AlphaWeek-flavoured markdown (headings, bold, italic, dash-lists,
// double-newline paragraphs) into PDF-ready HTML. Previously had a regex bug:
//   /^(?!<[h|u|l])/gm
// uses a character class which also matches the literal '|', so any line
// starting with `|` (rare in a brief but possible in tabular notes) was wrapped
// in a stray <p>. Fixed by anchoring on the actual opening-tag prefixes.
function markdownToHtml(markdown: string): string {
  // First, escape the raw input so AI-generated < and & survive the round trip.
  const escaped = escapeHtml(markdown);

  return escaped
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    // Wrap any line that doesn't start with a known block tag in a <p>. Using
    // an alternation list (not a char class) so '|' doesn't accidentally match.
    .replace(/^(?!<(?:h\d|ul|li|p|strong|em)\b)/gm, '<p>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>(<h\d|<ul|<li|<\/p>)/g, '$1');
}

function buildHtmlTemplate(content: string, weekOf: string): string {
  const htmlContent = markdownToHtml(content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlphaWeek Brief — Week of ${weekOf}</title>
  <style>
    /* Use platform-native fonts only — avoids a Google Fonts network race that
       could hang networkidle0 and time out PDF generation. */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1e293b;
      background: #ffffff;
      padding: 48px;
      max-width: 860px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 20px;
      margin-bottom: 36px;
    }

    .logo { font-size: 22px; font-weight: 700; color: #1e40af; letter-spacing: -0.5px; }
    .logo span { color: #d97706; }

    .week-label {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 12px;
      border-radius: 4px;
    }

    h2 {
      font-size: 18px; font-weight: 700; color: #1e40af;
      margin-top: 32px; margin-bottom: 12px;
      padding-bottom: 6px; border-bottom: 1px solid #e2e8f0;
    }

    h3 { font-size: 15px; font-weight: 600; color: #334155; margin-top: 20px; margin-bottom: 8px; }

    p { margin-bottom: 12px; color: #334155; }

    ul { margin: 12px 0; padding-left: 20px; }
    li { margin-bottom: 6px; color: #334155; }

    strong { color: #1e293b; font-weight: 600; }

    .footer {
      margin-top: 48px; padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px; color: #94a3b8;
      display: flex; justify-content: space-between;
    }

    .disclaimer {
      background: #fefce8; border: 1px solid #fde68a;
      border-radius: 6px; padding: 12px 16px;
      margin-top: 32px; font-size: 11px; color: #92400e; line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Alpha<span>Week</span></div>
    <div class="week-label">Week of ${weekOf}</div>
  </div>

  <div class="content">${htmlContent}</div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This brief is generated by AI for informational purposes only.
    It does not constitute financial advice. Past performance is not indicative of future results.
    Always conduct your own research before making investment decisions.
  </div>

  <div class="footer">
    <span>AlphaWeek — AI Investment Intelligence</span>
    <span>Generated ${new Date().toUTCString()}</span>
  </div>
</body>
</html>`;
}

export async function generateBriefPdf(
  briefId: string,
  content: string,
  userId: string,
  weekOf?: string
): Promise<string | null> {
  return withRetry(
    async () => {
      const week = weekOf ?? new Date().toISOString().split('T')[0];
      const html = buildHtmlTemplate(content, week);

      const browser = await getBrowser();
      // Each render gets its own page (cheap) but shares the Chromium process.
      const page = await browser.newPage();

      try {
        // `domcontentloaded` is enough — we have no remote assets to wait for
        // after removing the Google Fonts import.
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
          printBackground: true,
        });

        const key = `briefs/${userId}/${briefId}.pdf`;

        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }));

        // Store the R2 key, not a public URL. The /briefs/:id/pdf route
        // mints a signed URL on demand for the authenticated owner.
        logger.info('PDF generated and uploaded to R2', { briefId, key });
        return key;
      } finally {
        // Only close the page — keep the browser alive for the next request.
        await page.close().catch(() => undefined);
      }
    },
    'generateBriefPdf',
    { maxAttempts: 2, delayMs: 3000 }
  );
}
