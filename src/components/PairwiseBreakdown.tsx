import React from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  SendHorizontal,
  Shield,
  UserX,
} from 'lucide-react';
import type { PairwiseBalance, Member } from '../types';
import { formatToman } from '../lib/calculations';

interface PairwiseBreakdownProps {
  pairwiseBalances: PairwiseBalance[];
  members: Member[];
  onSettleWithMember: (memberId: string) => void;
}

export const PairwiseBreakdown: React.FC<PairwiseBreakdownProps> = ({
  pairwiseBalances,
  members,
  onSettleWithMember,
}) => {
  const getMember = (id: string) => members.find((m) => m.id === id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">تراز دنگ مستقیم (P2P) با هم‌اتاقی‌ها</h3>
        <span className="text-[11px] text-slate-400">محاسبه مستقیم و دوجانبه</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pairwiseBalances.map((pb) => {
          const member = getMember(pb.memberId);
          const isLent = pb.amount > 0;
          const isOwed = pb.amount < 0;
          const isSettled = pb.amount === 0;

          return (
            <div
              key={pb.memberId}
              className={`p-4 rounded-2xl border focus-within:ring-2 focus-within:ring-indigo-500/40 transition-all ${
                isLent
                  ? 'bg-[#141d38] border-emerald-500/30 hover:border-emerald-500/50'
                  : isOwed
                  ? 'bg-[#141d38] border-rose-500/30 hover:border-rose-500/50'
                  : 'bg-[#141d38] border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Member Info */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md bg-gradient-to-br ${
                        member?.color || 'from-blue-500 to-indigo-600'
                      }`}
                    >
                      {member?.name.slice(0, 1) || '؟'}
                    </div>
                    {member?.isAdmin && (
                      <span
                        title="مدیر اتاق"
                        className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-500 text-slate-950"
                      >
                        <Shield className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-white">{member?.name}</h4>
                      {!member?.isActive && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                          <UserX className="w-2.5 h-2.5" /> سابق
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {member?.bankName || 'هم‌اتاقی'}
                    </span>
                  </div>
                </div>

                {/* Balance Status */}
                <div className="text-left">
                  {isLent && (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        به شما بدهکار است:
                      </span>
                      <span className="text-sm font-black text-emerald-400 mt-0.5">
                        +{formatToman(pb.amount)}
                      </span>
                    </div>
                  )}

                  {isOwed && (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-rose-400 flex items-center gap-1 font-medium">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        به او بدهکارید:
                      </span>
                      <span className="text-sm font-black text-rose-400 mt-0.5">
                        -{formatToman(Math.abs(pb.amount))}
                      </span>
                    </div>
                  )}

                  {isSettled && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 font-medium bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                      <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>بی‌حساب</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Quick Action: Settle up */}
              {isOwed && (
                <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    تسویه کارت به کارت با {member?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSettleWithMember(pb.memberId)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs transition-colors"
                  >
                    <SendHorizontal className="w-3 h-3" />
                    <span>تسویه با او</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
