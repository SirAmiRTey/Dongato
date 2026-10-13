import React, { useState, useEffect, useId, useRef, useMemo } from 'react';
import {
  X,
  PlusCircle,
  Users,
  Check,
  ShoppingBag,
  Utensils,
  Sparkles,
  Wifi,
  Film,
  Car,
  CircleDollarSign,
  Upload,
  Paperclip,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { Member, ExpenseCategory } from '../types';
import {
  calculateSplitShares,
  formatToman,
  toPersianDigits,
  parseNumericInput,
  formatAmount,
} from '../lib/calculations';
import { uploadReceiptImage } from '../services/api';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  members: Member[];
  currentUserId: string;
  onAddExpense: (expenseData: {
    title: string;
    totalAmount: number;
    paidById: string;
    category: ExpenseCategory;
    splits: { memberId: string; amount: number; percentage?: number }[];
    notes?: string;
    receiptUrl?: string;
  }) => void;
}

const CATEGORIES: { id: ExpenseCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'groceries', label: 'سوپرمارکت', icon: ShoppingBag },
  { id: 'food', label: 'غذا و رستوران', icon: Utensils },
  { id: 'cleaning', label: 'نظافت و شوینده', icon: Sparkles },
  { id: 'utilities', label: 'اینترنت و قبوض', icon: Wifi },
  { id: 'entertainment', label: 'تفریح و بازی', icon: Film },
  { id: 'transport', label: 'رفت‌وآمد', icon: Car },
  { id: 'other', label: 'متفرقه', icon: CircleDollarSign },
];

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  roomId,
  members,
  currentUserId,
  onAddExpense,
}) => {
  const modalTitleId = useId();
  // Filter active members for splitting (inactive members cannot be included in new expenses)
  const activeMembers = members.filter((m) => m.isActive);

  const [title, setTitle] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [paidById, setPaidById] = useState(currentUserId);
  const [category, setCategory] = useState<ExpenseCategory>('groceries');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string>('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const wasOpenRef = useRef(false);

  // Initialize selectedMemberIds and payer ONLY when transitioning from closed to open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const activeMemberIds = members.filter((m) => m.isActive).map((m) => m.id);
      setSelectedMemberIds(activeMemberIds);
      setPaidById(currentUserId);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, members, currentUserId]);

  const numericAmount = parseNumericInput(rawAmount);
  const splits = useMemo(
    () => calculateSplitShares(numericAmount, selectedMemberIds),
    [numericAmount, selectedMemberIds]
  );
  const perPersonAmount = splits.length > 0 ? splits[0].amount : 0;

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

  const handleToggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          setError('حداقل یک نفر باید در تقسیم دنگ سهیم باشد');
          return prev;
        }
        setError(null);
        return prev.filter((mId) => mId !== id);
      } else {
        setError(null);
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedMemberIds(activeMembers.map((m) => m.id));
    setError(null);
  };

  const handleAddPreset = (amount: number) => {
    const nextAmount = (numericAmount + amount).toString();
    setRawAmount(nextAmount);
  };

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setReceiptError('تنها فایل‌های تصویری (JPG, PNG, WebP) مجاز هستند.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptError('حداکثر حجم مجاز تصویر ۵ مگابایت است.');
      return;
    }

    setReceiptError(null);
    setIsUploadingReceipt(true);
    setReceiptName(file.name);

    try {
      const url = await uploadReceiptImage(file, roomId);
      setReceiptUrl(url);
    } catch (err: any) {
      setReceiptError(err?.message || 'خطا در بارگذاری تصویر فاکتور');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleResetAndClose = () => {
    setTitle('');
    setRawAmount('');
    setNotes('');
    setReceiptUrl(null);
    setReceiptName('');
    setReceiptError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('لطفاً عنوان هزینه را وارد کنید');
      return;
    }
    if (numericAmount <= 0) {
      setError('لطفاً مبلغ معتبری وارد کنید');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError('حداقل یک نفر را برای تقسیم دنگ انتخاب کنید');
      return;
    }

    onAddExpense({
      title: title.trim(),
      totalAmount: numericAmount,
      paidById,
      category,
      splits,
      notes: notes.trim() || undefined,
      receiptUrl: receiptUrl || undefined,
    });

    handleResetAndClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-[#141d38] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#172242]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id={modalTitleId} className="text-lg font-bold text-white">ثبت هزینه جدید</h2>
              <p className="text-xs text-slate-400">تقسیم خودکار و ثبت در دفتر دنگ اتاق</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
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

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              عنوان هزینه <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: خرید سوپرمارکت، پیتزا، شارژ وای‌فای..."
              className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-[#0b132b] transition-all text-sm"
            />
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                مبلغ کل (تومان) <span className="text-rose-400">*</span>
              </label>
              {numericAmount > 0 && (
                <span className="text-xs font-semibold text-emerald-400">
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
                placeholder="مثال: ۲۴۰,۰۰۰"
                className="w-full px-4 py-3 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-[#0b132b] transition-all text-base font-semibold"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                تومان
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => handleAddPreset(amt)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
                >
                  +{toPersianDigits(amt / 1000)} هزار
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">دسته‌بندی</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/10'
                        : 'bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payer Dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              پرداخت‌کننده <span className="text-rose-400">*</span>
            </label>
            <select
              value={paidById}
              onChange={(e) => setPaidById(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-[#0b132b] transition-all text-sm"
            >
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id} className="bg-[#141d38] text-white">
                  {member.name} {member.id === currentUserId ? '(شما)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Member Selection Chips & Live Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                تقسیم بین چه کسانی؟ ({toPersianDigits(selectedMemberIds.length)} نفر)
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
              >
                انتخاب همه
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {activeMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <button
                    type="button"
                    key={member.id}
                    onClick={() => handleToggleMember(member.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 bg-gradient-to-br ${
                          member.color || 'from-blue-500 to-indigo-600'
                        }`}
                      >
                        {member.name.slice(0, 1)}
                      </div>
                      <span className="text-xs font-medium truncate">
                        {member.name} {member.id === currentUserId ? '(شما)' : ''}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-900'
                          : 'border border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Share Preview Box */}
            {numericAmount > 0 && selectedMemberIds.length > 0 && (
              <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">سهم تقریبی هر فرد</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatToman(perPersonAmount)}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-xs text-slate-400 block">تعداد افراد سهیم</span>
                  <span className="text-xs font-medium text-slate-200">
                    {toPersianDigits(selectedMemberIds.length)} نفر
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              یادداشت یا توضیحات (اختیاری)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: فاکتور در کانال گذاشته شد"
              className="w-full px-4 py-2 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-[#0b132b] transition-all text-xs"
            />
          </div>

          {/* Receipt / Invoice Upload Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                تصویر رسید یا فاکتور خرید (اختیاری)
              </span>
              <span className="text-[10px] text-slate-500">حداکثر ۵ مگابایت</span>
            </label>

            {receiptUrl ? (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center gap-3">
                <img
                  src={receiptUrl}
                  alt="رسید خرید"
                  className="w-14 h-14 object-cover rounded-lg border border-slate-700 shrink-0 bg-slate-950 shadow-inner"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {receiptName || 'رسید ضمیمه‌شده'}
                  </p>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <Check className="w-3 h-3" /> تصویر فاکتور با موفقیت پیوست شد
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl(null);
                    setReceiptName('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  title="حذف رسید"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileProcess(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-[#0b132b]/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcess(file);
                  }}
                />
                {isUploadingReceipt ? (
                  <div className="flex items-center justify-center gap-2 py-1 text-xs text-emerald-400 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال آماده‌سازی تصویر رسید...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-1 text-xs text-slate-400">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>کلیک برای انتخاب عکس یا کشیدن و رها کردن فاکتور (Drag & Drop)</span>
                  </div>
                )}
              </div>
            )}

            {receiptError && (
              <p className="text-[11px] text-rose-400 mt-1">{receiptError}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isUploadingReceipt}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              ثبت هزینه و محاسبه دنگ
            </button>
            <button
              type="button"
              onClick={handleResetAndClose}
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
