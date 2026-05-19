import type { Metadata } from 'next';
import { Inter, Calistoga, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { PwaRegistration } from '@/components/PwaRegistration';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const calistoga = Calistoga({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-calistoga',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AlphaWeek — AI Investment Intelligence',
    template: '%s | AlphaWeek',
  },
  description:
    'Institutional-grade weekly investment briefs powered by AI. Covering US markets, Indian equities, and crypto — delivered every Monday.',
  keywords: ['investment', 'AI', 'weekly brief', 'stock market', 'India NSE', 'crypto', 'portfolio analysis'],
  openGraph: {
    title: 'AlphaWeek — AI Investment Intelligence',
    description: 'Your personal AI investment analyst. Every week.',
    type: 'website',
    url: 'https://alphaweek.io',
  },
  manifest: '/manifest.webmanifest',
  themeColor: '#6366f1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AlphaWeek',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${calistoga.variable} ${jetbrainsMono.variable}`}>
        <body>
          <AnalyticsProvider>{children}</AnalyticsProvider>
          <PwaRegistration />
        </body>
      </html>
    </ClerkProvider>
  );
}
