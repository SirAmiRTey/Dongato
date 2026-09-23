import React, { useState, useEffect, useId } from 'react';
import {
  DoorOpen,
  PlusCircle,
  Hash,
  User,
  Home,
  ArrowRight,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import { createRoom, joinRoom } from '../services/api';
import type { Room, Member } from '../types';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
  initialInviteCode?: string;
  userId?: string;
  defaultDisplayName?: string;
  onSuccess: (room: Room, member: Member) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  canClose = false,
  initialInviteCode = '',
  userId,
  defaultDisplayName = '',
  onSuccess,
}) => {
  const modalTitleId = useId();
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultDisplayName && !displayName) {
      setDisplayName(defaultDisplayName);
    }
  }, [defaultDisplayName]);

  useEffect(() => {
    if (initialInviteCode) {
      setInviteCode(initialInviteCode);
      setTab('join');
    }
  }, [initialInviteCode]);

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('لطفاً نام یا نام مستعار خود را وارد کنید');
      return;
    }
    if (!inviteCode.trim()) {
      setError('لطفاً کد دعوت ۶ رقمی اتاق را وارد کنید');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { room, member } = await joinRoom(inviteCode, displayName.trim(), userId);
      onSuccess(room, member);
    } catch (err: any) {
      setError(err?.message || 'خطا در ورود به اتاق');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setError('لطفاً نام اتاق یا خوابگاه را وارد کنید');
      return;
    }
    if (!displayName.trim()) {
      setError('لطفاً نام خود (به عنوان مدیر اتاق) را وارد کنید');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { room, member } = await createRoom(roomName.trim(), displayName.trim(), userId);
      onSuccess(room, member);
    } catch (err: any) {
      setError(err?.message || 'خطا در ایجاد اتاق');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#141d38] border border-slate-700/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800/80 bg-[#172242]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
                <span className="text-xl">د</span>
              </div>
              <div>
                <h2 id={modalTitleId} className="text-base font-extrabold text-white">دنگاتو | شروع به کار</h2>
                <p className="text-xs text-slate-400">اتصال به اتاق یا ساخت اتاق جدید هم‌اتاقی‌ها</p>
              </div>
            </div>

            {canClose && onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 bg-[#0b132b] rounded-2xl border border-slate-700/60 mt-4">
            <button
              type="button"
              onClick={() => {
                setTab('join');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === 'join'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <DoorOpen className="w-4 h-4" />
              <span>ورود با کد دعوت</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('create');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === 'create'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>ساخت اتاق جدید</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}

          {/* Form: Join Room */}
          {tab === 'join' ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  نام یا نام مستعار شما <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: سجاد محمدی"
                  className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  کد دعوت اتاق <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="مثال: CHAMRAN-204 یا DNG-784"
                  className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 uppercase tracking-widest font-mono focus:outline-none focus:border-emerald-500 transition-all text-sm"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  کد دعوت را از مدیر یا هم‌اتاقی‌های خود بگیرید.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال اتصال...</span>
                  </>
                ) : (
                  <>
                    <span>ورود به اتاق</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Form: Create Room */
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  نام اتاق یا خوابگاه <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="مثال: خوابگاه چمران - اتاق ۲۰۴"
                  className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  نام شما (مدیر اتاق) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: علی رضایی"
                  className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  شما به عنوان مدیر این اتاق تعیین می‌شوید و یک کد دعوت ۶ رقمی یکتا برای ارسال به هم‌اتاقی‌ها دریافت خواهید کرد.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال ایجاد اتاق...</span>
                  </>
                ) : (
                  <>
                    <span>ایجاد اتاق و دریافت کد دعوت</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
