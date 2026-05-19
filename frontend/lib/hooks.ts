'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { api } from './api';
import {
  fetchProfile,
  fetchBriefs,
  fetchLatestBrief,
  fetchBrief,
  fetchPortfolio,
  fetchLivePortfolio,
  fetchWatchlist,
  fetchAlerts,
  fetchPriceAlerts,
  fetchEarningsCalendar,
  fetchReferralStats,
  triggerBriefGeneration,
} from './api';

// Sets up a single request interceptor that injects the Clerk token.
// useEffect + eject ensures only one interceptor exists at a time.
export function useApiAuth() {
  const { getToken } = useAuth();
  const interceptorRef = useRef<number | null>(null);

  useEffect(() => {
    interceptorRef.current = api.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    return () => {
      if (interceptorRef.current !== null) {
        api.interceptors.request.eject(interceptorRef.current);
      }
    };
  }, [getToken]);
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useReferralStats() {
  return useQuery({
    queryKey: ['referral', 'stats'],
    queryFn: fetchReferralStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useBriefs(page = 1) {
  return useQuery({
    queryKey: ['briefs', page],
    queryFn: () => fetchBriefs(page),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // Poll every 15 s while any brief is pending/generating so the list
    // updates automatically without requiring a manual refresh.
    refetchInterval: (query) => {
      const briefs = (query.state.data as { data?: { status?: string }[] } | undefined)?.data ?? [];
      const hasPending = briefs.some((b) => b.status === 'pending' || b.status === 'generating');
      return hasPending ? 15_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

export function useLatestBrief() {
  return useQuery({
    queryKey: ['briefs', 'latest'],
    queryFn: fetchLatestBrief,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useBrief(id: string) {
  return useQuery({
    queryKey: ['brief', id],
    queryFn: () => fetchBrief(id),
    enabled: !!id,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: fetchPortfolio,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLivePortfolio() {
  return useQuery({
    queryKey: ['portfolio', 'live'],
    queryFn: fetchLivePortfolio,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false, // stop polling when tab is not visible
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePriceAlerts() {
  return useQuery({
    queryKey: ['price-alerts'],
    queryFn: fetchPriceAlerts,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useEarningsCalendar() {
  return useQuery({
    queryKey: ['earnings'],
    queryFn: fetchEarningsCalendar,
    staleTime: 3_600_000, // 1 hour — earnings dates don't change often
  });
}

export function useTriggerBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerBriefGeneration,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['briefs'] });
    },
  });
}
