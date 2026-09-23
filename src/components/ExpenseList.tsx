import React, { useState } from 'react';
import {
  ShoppingBag,
  Utensils,
  Sparkles,
  Wifi,
  Film,
  Car,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
  Receipt,
  User,
  Clock,
  FileText,
  Edit2,
  Trash2,
  AlertTriangle,
  Eye,
  ExternalLink,
  X,
} from 'lucide-react';
import type { Expense, Member, ExpenseCategory } from '../types';
import { formatRelativeTime, formatToman, toPersianDigits } from '../lib/calculations';

interface ExpenseListProps {
  expenses: Expense[];
  members: Member[];
  currentUserId: string;
  isAdmin: boolean;
  onOpenAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
}

const CATEGORY_MAP: Record<
  ExpenseCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; color: string }
> = {
  groceries: {
    label: 'سوپرمارکت',
    icon: ShoppingBag,
    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    color: 'text-emerald-400',
  },
  food: {
    label: 'غذا و رستوران',
    icon: Utensils,
    bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    color: 'text-orange-400',
  },
  cleaning: {
    label: 'نظافت و بهداشت',
    icon: Sparkles,
    bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    color: 'text-cyan-400',
  },
  utilities: {
    label: 'اینترنت و قبوض',
    icon: Wifi,
    bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    color: 'text-indigo-400',
  },
  entertainment: {
    label: 'تفریح',
    icon: Film,
    bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    color: 'text-purple-400',
  },
  transport: {
    label: 'رفت‌وآمد',
    icon: Car,
    bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    color: 'text-blue-400',
  },
  other: {
    label: 'متفرقه',
    icon: CircleDollarSign,
    bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
    color: 'text-slate-400',
  },
};

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  members,
  currentUserId,
  isAdmin,
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expensePendingDelete, setExpensePendingDelete] = useState<Expense | null>(null);
  const [selectedReceiptExpense, setSelectedReceiptExpense] = useState<Expense | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getMember = (id: string) => members.find((m) => m.id === id);

  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredExpenses =
    filterCategory === 'all'
      ? sortedExpenses
      : sortedExpenses.filter((e) => e.category === filterCategory);

  if (expenses.length === 0) {
    return (
      <div className="bg-[#141d38] border border-slate-700/60 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-400 mb-3">
          <Receipt className="w-7 h-7" />
        </div>
        <h4 className="text-base font-bold text-white mb-1">هنوز هزینه‌ای ثبت نشده است</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
          اولین هزینه اتاق (مثل خرید سوپرمارکت یا شام) را ثبت کنید تا سهم هر هم‌اتاقی محاسبه شود.
        </p>
        <button
          onClick={onOpenAddExpense}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
        >
          ثبت اولین هزینه
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-xl shrink-0 font-medium transition-all ${
            filterCategory === 'all'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50'
          }`}
        >
          همه هزینه‌ها ({toPersianDigits(expenses.length)})
        </button>
        {Object.entries(CATEGORY_MAP).map(([catKey, catMeta]) => {
          const count = expenses.filter((e) => e.category === catKey).length;
          if (count === 0) return null;
          return (
            <button
              key={catKey}
              onClick={() => setFilterCategory(catKey)}
              className={`px-3 py-1.5 rounded-xl shrink-0 font-medium transition-all flex items-center gap-1.5 ${
                filterCategory === catKey
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}
            >
              <span>{catMeta.label}</span>
              <span className="text-[11px] opacity-75">({toPersianDigits(count)})</span>
            </button>
          );
        })}
      </div>

      {/* Expenses Cards */}
      <div className="space-y-3">
        {filteredExpenses.map((expense) => {
          const isExpanded = expandedId === expense.id;
          const payer = getMember(expense.paidById);
          const isPayer = expense.paidById === currentUserId;
          const canManage = isPayer || isAdmin;
          const userSplit = expense.splits.find((s) => s.memberId === currentUserId);
          const catMeta = CATEGORY_MAP[expense.category] || CATEGORY_MAP.other;
          const CategoryIcon = catMeta.icon;

          return (
            <div
              key={expense.id}
              className="bg-[#141d38] border border-slate-700/60 rounded-2xl overflow-hidden hover:border-slate-600 transition-all shadow-sm"
            >
              {/* Main Card Row */}
              <div
                onClick={() => toggleExpand(expense.id)}
                className="p-4 cursor-pointer flex items-start sm:items-center justify-between gap-3 select-none"
              >
                {/* Left: Category Icon & Details */}
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${catMeta.bg}`}
                  >
                    <CategoryIcon className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white hover:text-emerald-400 transition-colors">
                        {expense.title}
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400">
                        {catMeta.label}
                      </span>
                      {expense.receiptUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReceiptExpense(expense);
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold transition-colors"
                          title="مشاهده فاکتور"
                        >
                          <Receipt className="w-3 h-3 text-emerald-400" />
                          <span>فاکتور</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        پرداخت‌کننده:{' '}
                        <strong className="text-slate-300 font-semibold">
                          {payer?.name} {isPayer && '(شما)'}
                        </strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formatRelativeTime(expense.createdAt)}
                      </span>
                      <span>•</span>
                      <span>{toPersianDigits(expense.splits.length)} نفر سهیم</span>
                    </div>
                  </div>
                </div>

                {/* Right: Total Amount & Your Impact */}
                <div className="text-left shrink-0 flex flex-col items-end">
                  <div className="text-base font-extrabold text-white">
                    {formatToman(expense.totalAmount)}
                  </div>

                  {/* Contextual Your Share Badge */}
                  {isPayer ? (
                    <span className="text-[11px] font-medium text-emerald-400 mt-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      شما پرداخت کردید
                    </span>
                  ) : userSplit ? (
                    <span className="text-[11px] font-medium text-rose-400 mt-0.5 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      سهم شما: {formatToman(userSplit.amount)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 mt-0.5">بدون سهم</span>
                  )}

                  <button
                    type="button"
                    className="mt-1 text-slate-400 hover:text-white transition-colors"
                    aria-label="مشاهده جزئیات دنگ"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable Split Details Section */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-700/40 bg-[#0d1633]/60 space-y-3">
                  {expense.notes && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-300">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{expense.notes}</span>
                    </div>
                  )}

                  {expense.receiptUrl && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={expense.receiptUrl}
                          alt="تصویر فاکتور"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-700 bg-slate-900 cursor-pointer hover:opacity-85 transition-opacity shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReceiptExpense(expense);
                          }}
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">فاکتور یا رسید خرید</span>
                          <span className="text-[10px] text-slate-400">برای بزرگ‌نمایی کلیک کنید</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReceiptExpense(expense);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>مشاهده رسید</span>
                      </button>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-2">
                      تفکیک سهم هر یک از اعضا:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {expense.splits.map((split) => {
                        const member = getMember(split.memberId);
                        const isThisUser = split.memberId === currentUserId;

                        return (
                          <div
                            key={split.memberId}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                              isThisUser
                                ? 'bg-indigo-950/20 border-indigo-500/30'
                                : 'bg-[#141d38] border-slate-700/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${
                                  member?.color || 'from-slate-600 to-slate-700'
                                }`}
                              >
                                {member?.name.slice(0, 1)}
                              </div>
                              <span className="font-medium text-slate-200">
                                {member?.name} {isThisUser && '(شما)'}
                              </span>
                            </div>

                            <div className="text-left">
                              <span className="font-bold text-slate-100">
                                {formatToman(split.amount)}
                              </span>
                              {split.percentage && (
                                <span className="text-[10px] text-slate-400 mr-1.5">
                                  ({toPersianDigits(split.percentage)}٪)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions for Payer or Room Admin */}
                  {canManage && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditExpense(expense);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpensePendingDelete(expense);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {expensePendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#141d38] border border-rose-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-white">حذف هزینه</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از حذف هزینه «<strong className="text-white">{expensePendingDelete.title}</strong>» به مبلغ{' '}
              <strong className="text-rose-400">{formatToman(expensePendingDelete.totalAmount)}</strong> اطمینان دارید؟
            </p>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
              با حذف این هزینه، سهم‌های محاسبه‌شده لغو گردیده و این رخداد در دفتر وقایع اتاق ثبت خواهد شد.
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onDeleteExpense(expensePendingDelete);
                  setExpensePendingDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md transition-colors"
              >
                بله، حذف کن
              </button>
              <button
                type="button"
                onClick={() => setExpensePendingDelete(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewer Lightbox Modal */}
      {selectedReceiptExpense && selectedReceiptExpense.receiptUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedReceiptExpense(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#141d38] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#172242]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    رسید: {selectedReceiptExpense.title}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    مبلغ: {formatToman(selectedReceiptExpense.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={selectedReceiptExpense.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center gap-1 text-xs"
                  title="باز کردن در اندازه اصلی"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">اندازه اصلی</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptExpense(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                  aria-label="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className="p-4 flex items-center justify-center bg-[#090e1f] overflow-auto max-h-[70vh]">
              <img
                src={selectedReceiptExpense.receiptUrl}
                alt={`رسید هزینه ${selectedReceiptExpense.title}`}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-[#172242] flex items-center justify-between text-xs text-slate-400">
              <span>
                {getMember(selectedReceiptExpense.paidById)?.name
                  ? `پرداخت‌شده توسط: ${getMember(selectedReceiptExpense.paidById)?.name}`
                  : ''}
              </span>
              <button
                type="button"
                onClick={() => setSelectedReceiptExpense(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
