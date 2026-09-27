import React, { useState, useEffect, useId } from 'react';
import {
  X,
  Shield,
  Home,
  Link,
  Copy,
  Check,
  UserX,
  AlertCircle,
  AlertTriangle,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import type { Room, Member, PairwiseBalance, Expense, Settlement } from '../types';
import { formatToman } from '../lib/calculations';
import { exportExpensesToCSV, exportSettlementsToCSV } from '../lib/export';

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  pairwiseBalances: PairwiseBalance[];
  currentUserId: string;
  onUpdateRoomName: (newName: string) => void;
  onDeactivateMember: (memberId: string, memberName: string) => void;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  room,
  members,
  expenses,
  settlements,
  pairwiseBalances,
  currentUserId,
  onUpdateRoomName,
  onDeactivateMember,
}) => {
  const modalTitleId = useId();
  const [roomNameInput, setRoomNameInput] = useState(room.name);
  const [copiedLink, setCopiedLink] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<Member | null>(null);

  // Sync local input state with room.name when the modal opens or when room changes
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoomNameInput(room.name);
    }
  }, [isOpen, room.name]);

  if (!isOpen) return null;

  const inviteUrl = `${window.location.origin}/?join=${room.inviteCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveRoomName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNameInput.trim()) return;
    onUpdateRoomName(roomNameInput.trim());
  };

  // Filter other active members
  const otherActiveMembers = members.filter((m) => m.id !== currentUserId && m.isActive);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-[#141d38] border border-slate-700/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#172242]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id={modalTitleId} className="text-base font-extrabold text-white">مدیریت و تنظیمات اتاق</h2>
              <p className="text-xs text-slate-400">پنل کنترل مدیر اتاق</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Edit Room Name */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Home className="w-4 h-4 text-emerald-400" />
              نام اتاق یا خوابگاه
            </label>
            <form onSubmit={handleSaveRoomName} className="flex gap-2">
              <input
                type="text"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="flex-1 px-4 py-2 bg-[#0b132b] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!roomNameInput.trim() || roomNameInput === room.name}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
              >
                ذخیره
              </button>
            </form>
          </div>

          {/* Section 2: Direct Invite Link */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Link className="w-4 h-4 text-indigo-400" />
              لینک دعوت مستقیم برای هم‌اتاقی‌ها
            </label>
            <div className="flex items-center gap-2 p-2 bg-[#0b132b] border border-slate-700 rounded-xl">
              <span className="text-xs text-slate-300 font-mono tracking-wide truncate flex-1 px-2 text-left" dir="ltr">
                {inviteUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-colors"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی لینک</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              با باز کردن این لینک، فرم ورود با کد دعوت <strong className="text-white font-mono">{room.inviteCode}</strong> به صورت خودکار پر می‌شود.
            </p>
          </div>

          {/* Section: Financial Export Engine (CSV) */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                دانلود گزارش مالی و سوابق (CSV)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                خروجی استاندارد با پشتیبانی کامل از نرم‌افزار اکسل (کدگذاری UTF-8 BOM) شامل ریز هزینه‌ها، سهم هر هم‌اتاقی و تاریخچه تسویه‌ها.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => exportExpensesToCSV(expenses, members, room.name)}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all shadow-sm group"
              >
                <Download className="w-4 h-4 text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
                <span>دانلود گزارش هزینه‌ها (CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => exportSettlementsToCSV(settlements, members, room.name)}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all shadow-sm group"
              >
                <Download className="w-4 h-4 text-blue-400 group-hover:translate-y-0.5 transition-transform" />
                <span>دانلود سوابق تسویه‌ها (CSV)</span>
              </button>
            </div>
          </div>

          {/* Section 3: Manage Members & Soft Delete Invariant */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserX className="w-4 h-4 text-rose-400" />
                مدیریت و خروج هم‌اتاقی‌ها (Soft-Delete)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                قانون بیزینس: تنها اعضایی که تراز حساب آن‌ها کاملاً صفر و بی‌حساب است، اجازه خروج دارند. سوابق دنگ‌های پیشین حفظ خواهد شد.
              </p>
            </div>

            <div className="space-y-2">
              {otherActiveMembers.map((member) => {
                const balanceObj = pairwiseBalances.find((b) => b.memberId === member.id);
                const hasUnsettledBalance = balanceObj && balanceObj.amount !== 0;

                return (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl bg-[#0b132b] border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] text-white bg-gradient-to-br ${
                          member.color || 'from-blue-500 to-indigo-600'
                        }`}
                      >
                        {member.name.slice(0, 1)}
                      </div>
                      <span className="font-semibold text-slate-200">{member.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasUnsettledBalance ? (
                        <div className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>تراز غیرصفر ({formatToman(Math.abs(balanceObj.amount))})</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMemberToDeactivate(member)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-medium transition-colors"
                        >
                          خروج از اتاق
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Kick/Deactivate */}
      {memberToDeactivate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#141d38] border border-rose-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-white">خروج هم‌اتاقی</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از خروج هم‌اتاقی «<strong className="text-white">{memberToDeactivate.name}</strong>» از این اتاق اطمینان دارید؟
            </p>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
              حساب این عضو بایگانی خواهد شد و در هزینه‌های جدید سهیم نمی‌گردد؛ اما سوابق هزینه‌های قبلی او در دفتر دنگاتو حفظ می‌ماند.
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onDeactivateMember(memberToDeactivate.id, memberToDeactivate.name);
                  setMemberToDeactivate(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md transition-colors"
              >
                تأیید خروج و بایگانی
              </button>
              <button
                type="button"
                onClick={() => setMemberToDeactivate(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
