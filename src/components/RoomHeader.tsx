import React, { useState } from 'react';
import {
  Copy,
  Check,
  LogOut,
  Cloud,
  Database,
  Shield,
  Download,
  DoorOpen,
} from 'lucide-react';
import type { Room, Member, AuthUser } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

interface RoomHeaderProps {
  room: Room;
  members: Member[];
  currentUser: Member;
  authUser: AuthUser | null;
  onOpenMyRooms: () => void;
  onOpenAdminSettings?: () => void;
  onExportCSV?: () => void;
  onSignOut: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  currentUser,
  authUser,
  onOpenMyRooms,
  onOpenAdminSettings,
  onExportCSV,
  onSignOut,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const isAdmin = Boolean(currentUser?.isAdmin);

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(room.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const displayName = authUser?.displayName || currentUser?.name || 'کاربر دنگاتو';
  const initialLetter = displayName.slice(0, 1) || '؟';

  return (
    <header className="bg-[#141d38]/90 backdrop-blur-md border-b border-slate-700/60 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left: Logo & Room Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
              <span className="text-xl">د</span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  دنگاتو
                </h1>
                {isSupabaseConfigured ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Cloud className="w-3 h-3 text-emerald-400" />
                    ابری (Supabase)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Database className="w-3 h-3 text-amber-400" />
                    حالت پیش‌نمایش محلی
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                <span className="font-semibold text-slate-300">{room.name}</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-[11px]"
                  title="کپی کد دعوت اتاق"
                >
                  <span>کد: {room.inviteCode}</span>
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Actions, Authenticated User Pill & Logout */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* CSV Financial Export CTA */}
            {onExportCSV && (
              <button
                type="button"
                onClick={onExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors shadow-sm"
                title="دانلود گزارش مالی اتاق (CSV)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">گزارش مالی</span>
              </button>
            )}

            {/* Admin Controls CTA */}
            {isAdmin && onOpenAdminSettings && (
              <button
                type="button"
                onClick={onOpenAdminSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors"
                title="پنل مدیریت اتاق"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">مدیریت</span>
              </button>
            )}

            {/* "My Rooms" Switcher Button */}
            <button
              type="button"
              onClick={onOpenMyRooms}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-bold transition-colors"
              title="مشاهده و تغییر اتاق‌ها"
            >
              <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>اتاق‌های من</span>
            </button>

            {/* Authenticated User Identity Pill (Strict - No Dropdown Switcher) */}
            <div className="flex items-center gap-2 bg-[#0b132b] px-2.5 py-1 rounded-xl border border-slate-700/80">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-gradient-to-tr ${
                  currentUser?.color || 'from-emerald-500 to-teal-600'
                }`}
              >
                {initialLetter}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white max-w-[90px] sm:max-w-[120px] truncate">
                  {displayName}
                </span>
                {isAdmin && (
                  <span className="text-[10px]" title="مدیر اتاق">
                    👑
                  </span>
                )}
              </div>
            </div>

            {/* Sign Out CTA */}
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-1 p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/80 transition-colors"
              title="خروج از حساب کاربری"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
