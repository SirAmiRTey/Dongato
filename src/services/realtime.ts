import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRoomSubscriptionOptions {
  roomId: string;
  currentUserId: string;
  onRefreshNeeded: (notice?: { title: string; message: string }) => void;
}

/**
 * Custom React hook for live multi-user collaboration via Supabase Realtime WebSockets.
 * Also subscribes to window storage events for immediate cross-tab synchronization in local preview mode.
 */
export function useRoomSubscription({
  roomId,
  currentUserId,
  onRefreshNeeded,
}: UseRoomSubscriptionOptions) {
  useEffect(() => {
    if (!roomId) return;

    let channel: RealtimeChannel | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingNotice: { title: string; message: string } | undefined = undefined;

    const triggerDebouncedRefresh = (notice?: { title: string; message: string }) => {
      if (notice) {
        pendingNotice = notice;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        const toSend = pendingNotice;
        pendingNotice = undefined;
        debounceTimer = null;
        onRefreshNeeded(toSend);
      }, 500);
    };

    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel(`room_sync_${roomId}`)
        // 1. Expenses changes
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const newRecord = payload.new as Record<string, unknown> | null;
            const oldRecord = payload.old as Record<string, unknown> | null;
            const isOwnChange =
              (newRecord && newRecord['paid_by_id'] === currentUserId) ||
              (oldRecord && oldRecord['paid_by_id'] === currentUserId);

            // Ignore own changes (handled cleanly by local mutation handlers)
            if (!isOwnChange) {
              triggerDebouncedRefresh({
                title: 'به‌روزرسانی هزینه‌ها',
                message: 'یکی از هم‌اتاقی‌ها هزینه‌ای را ثبت یا ویرایش کرد.',
              });
            }
          }
        )
        // 2. Settlements changes
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settlements', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const newRecord = payload.new as Record<string, unknown> | null;
            const isOwnPayer = newRecord && newRecord['payer_id'] === currentUserId;
            if (!isOwnPayer) {
              triggerDebouncedRefresh({
                title: 'تغییر وضعیت تسویه',
                message: 'وضعیت تسویه حسابی در اتاق تغییر یافت.',
              });
            }
          }
        )
        // 3. Members changes
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${roomId}` },
          () => {
            triggerDebouncedRefresh({
              title: 'تغییرات اعضا',
              message: 'لیست یا مشخصات هم‌اتاقی‌ها به‌روزرسانی شد.',
            });
          }
        )
        // 4. Activity Logs
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const newRecord = payload.new as Record<string, unknown> | null;
            const isOwnLog = newRecord && newRecord['actor_id'] === currentUserId;
            if (!isOwnLog) {
              triggerDebouncedRefresh();
            }
          }
        )
        .subscribe();
    }

    // Cross-tab synchronization listener (for fallback and local multi-window testing)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dongato_fallback_bundle') {
        triggerDebouncedRefresh();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [roomId, currentUserId, onRefreshNeeded]);
}
