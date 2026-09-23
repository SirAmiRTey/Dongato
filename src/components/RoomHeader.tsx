import React, { useState } from 'react';
import {
  Copy,
  Check,
  UserCheck,
  LogOut,
  Cloud,
  Database,
  Shield,
  Download,
} from 'lucide-react';
import type { Room, Member } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

interface RoomHeaderProps {
  room: Room;
  members: Member[];
  currentUserId: string;
  onSelectUser: (userId: string) => void;
  onSwitchRoom: () => void;
  onOpenAdminSettings?: () => void;
  onExportCSV?: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  members,
  currentUserId,
  onSelectUser,
  onSwitchRoom,
  onOpenAdminSettings,
  onExportCSV,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const currentUser = members.find((m) => m.id === currentUserId);
  const isAdmin = Boolean(currentUser?.isAdmin);

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(room.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <header className="bg-[#141d38]/90 backdrop-blur-md border-b border-slate-700/60 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Logo & Room Title */}
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

          {/* Right: Admin Button, User Switcher & Room Exit */}
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
                <span className="hidden sm:inline">گزارش مالی (CSV)</span>
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
                <span>مدیریت اتاق</span>
              </button>
            )}

            {/* User Switcher Dropdown */}
            <div className="flex items-center gap-2 bg-[#0b132b] p-1.5 rounded-xl border border-slate-700/70">
              <div className="flex items-center gap-1.5 px-1.5 text-xs text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">دیدگاه:</span>
              </div>

              <select
                value={currentUserId}
                onChange={(e) => onSelectUser(e.target.value)}
                className="bg-[#141d38] border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#141d38]">
                    {m.name} {m.isAdmin ? '👑' : ''} {!m.isActive ? '❌' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Switch / Exit Room Button */}
            <button
              type="button"
              onClick={onSwitchRoom}
              className="flex items-center gap-1 px-2.5 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="تغییر یا ورود به اتاق دیگر"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">تغییر اتاق</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
