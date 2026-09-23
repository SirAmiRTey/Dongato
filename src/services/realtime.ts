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

    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel(`room_sync_${roomId}`)
        // 1. Expenses changes
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'expenses', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const isOwnChange = payload.new && (payload.new as any).paid_by_id === currentUserId;
            if (!isOwnChange) {
              onRefreshNeeded({
                title: 'به‌روزرسانی هزینه‌ها',
                message: 'یکی از هم‌اتاقی‌ها هزینه‌ای را ثبت یا ویرایش کرد.',
              });
            } else {
              onRefreshNeeded();
            }
          }
        )
        // 2. Settlements changes
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settlements', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const isOwnPayer = payload.new && (payload.new as any).payer_id === currentUserId;
            if (!isOwnPayer) {
              onRefreshNeeded({
                title: 'تغییر وضعیت تسویه',
                message: 'وضعیت تسویه حسابی در اتاق تغییر یافت.',
              });
            } else {
              onRefreshNeeded();
            }
          }
        )
        // 3. Members changes
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${roomId}` },
          () => {
            onRefreshNeeded({
              title: 'تغییرات اعضا',
              message: 'لیست یا مشخصات هم‌اتاقی‌ها به‌روزرسانی شد.',
            });
          }
        )
        // 4. Activity Logs
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `room_id=eq.${roomId}` },
          () => {
            onRefreshNeeded();
          }
        )
        .subscribe();
    }

    // Cross-tab synchronization listener (for fallback and local multi-window testing)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dongato_fallback_bundle') {
        onRefreshNeeded();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [roomId, currentUserId, onRefreshNeeded]);
}
