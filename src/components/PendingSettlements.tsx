import React from 'react';
import {
  Clock,
  CheckCircle2,
  ArrowLeft,
  XCircle,
} from 'lucide-react';
import type { Settlement, Member } from '../types';
import { formatRelativeTime, formatToman } from '../lib/calculations';

interface PendingSettlementsProps {
  settlements: Settlement[];
  members: Member[];
  currentUserId: string;
  onConfirmSettlement: (settlementId: string) => void;
  onRejectSettlement?: (settlementId: string) => void;
}

export const PendingSettlements: React.FC<PendingSettlementsProps> = ({
  settlements,
  members,
  currentUserId,
  onConfirmSettlement,
  onRejectSettlement,
}) => {
  const pendingList = settlements.filter((s) => s.status === 'pending');

  if (pendingList.length === 0) {
    return null;
  }

  const getMember = (id: string) => members.find((m) => m.id === id);

  return (
    <div className="bg-[#141d38] border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            تسویه‌های در انتظار تأیید ({pendingList.length})
          </h3>
        </div>
        <span className="text-xs text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
          نیازمند تأیید دریافت‌کننده
        </span>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {pendingList.map((settlement) => {
          const payer = getMember(settlement.payerId);
          const receiver = getMember(settlement.receiverId);
          const isReceiver = settlement.receiverId === currentUserId;
          const isPayer = settlement.payerId === currentUserId;

          return (
            <div
              key={settlement.id}
              className="bg-[#0b132b]/80 border border-slate-700/70 rounded-xl p-3.5 sm:p-4 transition-all hover:border-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Transfer Details */}
              <div className="flex items-center gap-3">
                {/* Payer Avatar */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${
                      payer?.color || 'from-blue-500 to-indigo-600'
                    }`}
                  >
                    {payer?.name.slice(0, 1) || '؟'}
                  </div>
                  <span className="text-[11px] font-medium text-slate-300 mt-1 max-w-[65px] truncate text-center">
                    {payer?.name}
                    {isPayer && ' (شما)'}
                  </span>
                </div>

                {/* Transfer Amount and Arrow */}
                <div className="flex flex-col items-center px-2">
                  <span className="text-xs sm:text-sm font-black text-amber-300 mb-1">
                    {formatToman(settlement.amount)}
                  </span>
                  <div className="flex items-center gap-1 text-slate-400">
                    <span className="w-6 h-[1.5px] bg-slate-600"></span>
                    <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    {formatRelativeTime(settlement.createdAt)}
                  </span>
                </div>

                {/* Receiver Avatar */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${
                      receiver?.color || 'from-emerald-500 to-teal-600'
                    }`}
                  >
                    {receiver?.name.slice(0, 1) || '؟'}
                  </div>
                  <span className="text-[11px] font-medium text-slate-300 mt-1 max-w-[65px] truncate text-center">
                    {receiver?.name}
                    {isReceiver && ' (شما)'}
                  </span>
                </div>
              </div>

              {/* Note (if present) */}
              {settlement.notes && (
                <div className="text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50 max-w-xs truncate">
                  <span className="text-slate-500 ml-1">یادداشت:</span>
                  {settlement.notes}
                </div>
              )}

              {/* Actions & Status */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {isReceiver ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onConfirmSettlement(settlement.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأیید دریافت</span>
                    </button>
                    {onRejectSettlement && (
                      <button
                        type="button"
                        onClick={() => onRejectSettlement(settlement.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                        title="رد یا عدم وصول"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300/90 border border-amber-500/20 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      در انتظار تأیید {receiver?.name || 'دریافت‌کننده'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
