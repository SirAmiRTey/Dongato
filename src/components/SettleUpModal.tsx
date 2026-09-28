import React, { useState, useId } from 'react';
import {
  X,
  Copy,
  Check,
  ArrowLeftRight,
  AlertCircle,
} from 'lucide-react';
import type { Member, PairwiseBalance } from '../types';
import {
  formatToman,
  parseNumericInput,
  formatAmount,
} from '../lib/calculations';

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  members: Member[];
  pairwiseBalances: PairwiseBalance[];
  initialTargetMemberId?: string;
  onRequestSettlement: (settlementData: {
    receiverId: string;
    amount: number;
    notes?: string;
  }) => void;
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  members,
  pairwiseBalances,
  initialTargetMemberId,
  onRequestSettlement,
}) => {
  const modalTitleId = useId();
  // Filter available members (must be active and not current user)
  const activeOtherMembers = members.filter(
    (m) => m.id !== currentUserId && m.isActive
  );

  // Default selected member: initial target if provided, otherwise first member we owe, otherwise first other member
  const defaultMemberId =
    initialTargetMemberId ||
    pairwiseBalances.find((b) => b.amount < 0)?.memberId ||
    activeOtherMembers[0]?.id ||
    '';

  const [receiverId, setReceiverId] = useState(defaultMemberId);
  const [rawAmount, setRawAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep receiverId and amount in sync when modal opens or initialTargetMemberId changes
  React.useEffect(() => {
    if (!isOpen) return;

    if (initialTargetMemberId) {
      setReceiverId(initialTargetMemberId);
      const targetBalance = pairwiseBalances.find((b) => b.memberId === initialTargetMemberId);
      if (targetBalance && targetBalance.amount < 0) {
        setRawAmount(Math.abs(targetBalance.amount).toString());
      } else {
        setRawAmount('');
      }
      setError(null);
    }
  }, [isOpen, initialTargetMemberId, pairwiseBalances]);

  const numericAmount = parseNumericInput(rawAmount);
  const selectedMember = members.find((m) => m.id === receiverId);
  const selectedBalance = pairwiseBalances.find((b) => b.memberId === receiverId);
  const debtAmount = selectedBalance && selectedBalance.amount < 0 ? Math.abs(selectedBalance.amount) : 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawVal = input.value;
    const cursorPosition = input.selectionStart || 0;

    // Count how many numeric digits were before the cursor
    const textBeforeCursor = rawVal.slice(0, cursorPosition);
    const digitsBeforeCursor = (textBeforeCursor.match(/[0-9۰-۹٠-٩]/g) || []).length;

    const num = parseNumericInput(rawVal);
    const nextRaw = num === 0 && !rawVal.match(/[0-9۰-۹٠-٩]/) ? '' : num.toString();
    setRawAmount(nextRaw);

    // Restore cursor position seamlessly in the formatted value
    requestAnimationFrame(() => {
      if (!input) return;
      const formatted = num > 0 ? formatAmount(num) : '';
      let targetCursor = 0;
      let count = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9۰-۹٠-٩]/.test(formatted[i])) {
          count++;
          if (count === digitsBeforeCursor) {
            targetCursor = i + 1;
            break;
          }
        }
      }
      if (digitsBeforeCursor === 0) {
        targetCursor = 0;
      } else if (count < digitsBeforeCursor) {
        targetCursor = formatted.length;
      }
      try {
        input.setSelectionRange(targetCursor, targetCursor);
      } catch {
        // ignore
      }
    });
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const { selectionStart, selectionEnd, value } = input;
      if (selectionStart === selectionEnd && selectionStart !== null && selectionStart > 0) {
        const prevChar = value[selectionStart - 1];
        if (prevChar === ',' || prevChar === '،' || prevChar === ' ') {
          e.preventDefault();
          const newValue = value.slice(0, selectionStart - 2) + value.slice(selectionStart);
          const num = parseNumericInput(newValue);
          setRawAmount(num === 0 && !newValue.match(/[0-9۰-۹٠-٩]/) ? '' : num.toString());
        }
      }
    }
  };

  const handleCopyCard = (cardNumber?: string) => {
    if (!cardNumber) return;
    navigator.clipboard.writeText(cardNumber.replace(/[^0-9]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectFullDebt = () => {
    if (debtAmount > 0) {
      setRawAmount(debtAmount.toString());
      setError(null);
    }
  };

  const handleSelectHalfDebt = () => {
    if (debtAmount > 0) {
      setRawAmount(Math.round(debtAmount / 2).toString());
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId) {
      setError('لطفاً دریافت‌کننده وجه را انتخاب کنید');
      return;
    }
    if (numericAmount <= 0) {
      setError('لطفاً مبلغ تسویه معتبری وارد کنید');
      return;
    }

    onRequestSettlement({
      receiverId,
      amount: numericAmount,
      notes: notes.trim() || undefined,
    });

    setRawAmount('');
    setNotes('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-[#141d38] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#172242]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 id={modalTitleId} className="text-lg font-bold text-white">تسویه حساب مستقیم (P2P)</h2>
              <p className="text-xs text-slate-400">پرداخت به هم‌اتاقی و ثبت جهت تأیید دریافت</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 text-sm rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}

          {/* Rule Reminder Alert */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-300">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">قانون دنگاتو: </span>
              تسویه به‌صورت مستقیم بین شما و دریافت‌کننده است. تراز حساب پس از «تأیید دریافت» توسط طرف مقابل به‌روزرسانی خواهد شد.
            </div>
          </div>

          {/* Receiver Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              تسویه با چه کسی انجام می‌شود؟ (دریافت‌کننده) <span className="text-rose-400">*</span>
            </label>
            <select
              value={receiverId}
              onChange={(e) => {
                const newId = e.target.value;
                setReceiverId(newId);
                const b = pairwiseBalances.find((item) => item.memberId === newId);
                if (b && b.amount < 0) {
                  setRawAmount(Math.abs(b.amount).toString());
                }
              }}
              className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-all text-sm"
            >
              {activeOtherMembers.map((member) => {
                const b = pairwiseBalances.find((item) => item.memberId === member.id);
                let balanceText = 'بی‌حساب';
                if (b && b.amount < 0) {
                  balanceText = `شما بدهکارید: ${formatToman(Math.abs(b.amount))}`;
                } else if (b && b.amount > 0) {
                  balanceText = `او به شما بدهکار است: ${formatToman(b.amount)}`;
                }

                return (
                  <option key={member.id} value={member.id} className="bg-[#141d38] text-white">
                    {member.name} ({balanceText})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selected Member Debt Info & Card Number Details */}
          {selectedMember && (
            <div className="p-4 rounded-xl bg-[#0b132b] border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">وضعیت حساب شما با {selectedMember.name}:</span>
                {debtAmount > 0 ? (
                  <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                    بدهکارید: {formatToman(debtAmount)}
                  </span>
                ) : selectedBalance && selectedBalance.amount > 0 ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    طلبکارید: {formatToman(selectedBalance.amount)}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                    بی‌حساب هستید
                  </span>
                )}
              </div>

              {/* Bank Card Info */}
              {selectedMember.cardNumber && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">
                      شماره کارت {selectedMember.bankName ? `(${selectedMember.bankName})` : ''}:
                    </span>
                    <span className="text-sm font-mono tracking-wider font-semibold text-slate-200">
                      {selectedMember.cardNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCard(selectedMember.cardNumber)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی کارت</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Settlement Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                مبلغ تسویه (تومان) <span className="text-rose-400">*</span>
              </label>
              {numericAmount > 0 && (
                <span className="text-xs font-semibold text-indigo-400">
                  {formatToman(numericAmount)}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                value={numericAmount > 0 ? formatAmount(numericAmount) : ''}
                onChange={handleAmountChange}
                onKeyDown={handleAmountKeyDown}
                placeholder="مبلغ مورد نظر برای واریز..."
                className="w-full px-4 py-3 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-base font-semibold"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                تومان
              </span>
            </div>

            {/* Shortcuts: Full settlement, Half settlement */}
            {debtAmount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="text-[11px] text-slate-400">میانبرهای تسویه:</span>
                <button
                  type="button"
                  onClick={handleSelectFullDebt}
                  className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors font-medium"
                >
                  تسویه کامل ({formatToman(debtAmount)})
                </button>
                <button
                  type="button"
                  onClick={handleSelectHalfDebt}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  ۵۰٪ بدهی ({formatToman(Math.round(debtAmount / 2))})
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              توضیحات یا کد پیگیری انتقال (اختیاری)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: واریز به شماره کارت پاسارگاد با کد پیگیری..."
              className="w-full px-4 py-2 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
            >
              ثبت و ارسال جهت تأیید دریافت
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
