'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Settings,
  TrendingUp,
  Bell,
  MessageSquare,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav: { href: string; label: string; icon: React.ElementType }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/briefs', label: 'My Briefs', icon: FileText },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/screener', label: 'Screener', icon: SlidersHorizontal },
  { href: '/chat', label: 'AI Chat', icon: MessageSquare },
  { href: '/alerts', label: 'Price Alerts', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  unreadAlerts?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ unreadAlerts = 0, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop — only on mobile when the drawer is open */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-surface border-r border-border transition-transform duration-200',
          // Hidden off-screen on mobile unless explicitly opened; always visible from md up
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0'
        )}
      >
        {/* Logo + close on mobile */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onMobileClose}>
            <TrendingUp className="h-5 w-5 text-primary-light" />
            <span className="font-heading text-lg text-white">
              Alpha<span className="text-accent">Week</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="md:hidden text-muted hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-primary/15 text-primary-light border border-primary/20'
                    : 'text-muted hover:text-slate-200 hover:bg-surface-3/50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {label === 'Price Alerts' && unreadAlerts > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white font-mono">
                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border shrink-0">
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8' } }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">Account</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
