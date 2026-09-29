import React, { useState, useEffect, useId } from 'react';
import {
  X,
  User,
  CreditCard,
  Lock,
  Mail,
  ShieldCheck,
  Star,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  Wifi,
} from 'lucide-react';
import type { AuthUser, BankCard } from '../types';
import { updateProfileApi } from '../services/auth';
import {
  fetchUserBankCards,
  addBankCard,
  deleteBankCard,
  setDefaultBankCard,
} from '../services/api';
import {
  detectBank,
  formatCardNumber,
  isValidCardNumber,
  formatShaba,
  isValidShaba,
  normalizeCardDigits,
} from '../lib/bankUtils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  onProfileUpdated: (updatedUser: AuthUser) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error') => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  authUser,
  onProfileUpdated,
  onShowToast,
}) => {
  const modalTitleId = useId();
  const [activeTab, setActiveTab] = useState<'profile' | 'cards'>('profile');

  // --- Profile State ---
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // --- Bank Cards State ---
  const [cards, setCards] = useState<BankCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newHolderName, setNewHolderName] = useState('');
  const [newShaba, setNewShaba] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);

  // Sync profile inputs when modal opens or authUser changes
  useEffect(() => {
    if (isOpen && authUser) {
      setDisplayName(authUser.displayName || '');
      setEmail(authUser.email || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      setProfileError(null);
      setCardError(null);
      loadCards();
    }
  }, [isOpen, authUser]);

  const loadCards = async () => {
    if (!authUser?.id) return;
    setIsLoadingCards(true);
    try {
      const userCards = await fetchUserBankCards(authUser.id);
      setCards(userCards);
    } catch (err: any) {
      console.warn('Failed to load user bank cards:', err);
    } finally {
      setIsLoadingCards(false);
    }
  };

  // --- Profile Submission ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setProfileError('لطفاً نام یا نام مستعار خود را وارد کنید.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setProfileError('لطفاً یک آدرس ایمیل معتبر وارد کنید.');
      return;
    }

    if (showPasswordChange && newPassword) {
      if (!currentPassword) {
        setProfileError('برای تغییر رمز عبور، وارد کردن رمز عبور فعلی الزامی است.');
        return;
      }
      if (newPassword.length < 6) {
        setProfileError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileError('تکرار رمز عبور جدید با رمز وارد شده همخوانی ندارد.');
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const updatedUser = await updateProfileApi({
        userId: authUser?.id,
        displayName: cleanName,
        email: cleanEmail,
        currentPassword: showPasswordChange && currentPassword ? currentPassword : undefined,
        newPassword: showPasswordChange && newPassword ? newPassword : undefined,
      });

      onProfileUpdated(updatedUser);
      onShowToast('مشخصات کاربری با موفقیت به‌روزرسانی شد.', 'success');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setProfileError(err.message || 'خطا در ویرایش اطلاعات کاربری.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Bank Card Form Handling ---
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeCardDigits(e.target.value).slice(0, 16);
    setNewCardNumber(raw);

    // Auto-detect bank
    if (raw.length >= 6) {
      const bank = detectBank(raw);
      if (bank.name !== 'بانک شتاب' || !newBankName) {
        setNewBankName(bank.name);
      }
    }
  };

  const handleAddCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError(null);

    const cleanCard = normalizeCardDigits(newCardNumber);
    if (cleanCard.length !== 16) {
      setCardError('شماره کارت باید دقیقاً ۱۶ رقم باشد.');
      return;
    }

    if (!isValidCardNumber(cleanCard)) {
      setCardError('شماره کارت وارد شده طبق الگوریتم شتاب نامعتبر است.');
      return;
    }

    const cleanHolder = newHolderName.trim() || displayName || 'کاربر دنگاتو';
    const cleanBank = newBankName.trim() || detectBank(cleanCard).name;

    let cleanShaba: string | undefined = undefined;
    if (newShaba.trim()) {
      const s = newShaba.trim().toUpperCase().replace(/\s/g, '');
      const fullShaba = s.startsWith('IR') ? s : `IR${s}`;
      if (!isValidShaba(fullShaba)) {
        setCardError('شماره شبا وارد شده نامعتبر است.');
        return;
      }
      cleanShaba = fullShaba;
    }

    if (!authUser?.id) {
      setCardError('شناسه کاربر یافت نشد. لطفاً مجدداً وارد شوید.');
      return;
    }

    setIsSavingCard(true);
    try {
      const added = await addBankCard({
        userId: authUser.id,
        bankName: cleanBank,
        cardNumber: cleanCard,
        shabaNumber: cleanShaba,
        cardHolderName: cleanHolder,
        isDefault: cards.length === 0 ? true : newIsDefault,
      });

      setCards((prev) => {
        if (added.isDefault) {
          return [added, ...prev.map((c) => ({ ...c, isDefault: false }))];
        }
        return [added, ...prev];
      });

      onShowToast('کارت بانکی با موفقیت ثبت شد.', 'success');
      setIsAddingCard(false);
      setNewCardNumber('');
      setNewBankName('');
      setNewShaba('');
      setNewIsDefault(false);
    } catch (err: any) {
      setCardError(err.message || 'خطا در ثبت کارت بانکی.');
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!authUser?.id) return;
    try {
      await deleteBankCard(cardId, authUser.id);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      onShowToast('کارت بانکی حذف شد.', 'info');
    } catch (err: any) {
      onShowToast('خطا در حذف کارت بانکی.', 'error');
    }
  };

  const handleSetDefault = async (cardId: string) => {
    if (!authUser?.id) return;
    try {
      await setDefaultBankCard(cardId, authUser.id);
      setCards((prev) =>
        prev.map((c) => ({
          ...c,
          isDefault: c.id === cardId,
        }))
      );
      onShowToast('کارت پیش‌فرض با موفقیت تغییر کرد.', 'success');
    } catch (err: any) {
      onShowToast('خطا در تغییر کارت پیش‌فرض.', 'error');
    }
  };

  const handleCopyCard = (card: BankCard) => {
    navigator.clipboard.writeText(card.cardNumber);
    setCopiedCardId(card.id);
    setTimeout(() => setCopiedCardId(null), 2000);
  };

  if (!isOpen) return null;

  // Active detected bank for preview card
  const previewBank = detectBank(newCardNumber || '603799');
  const isInputValidCard = newCardNumber.length === 16 && isValidCardNumber(newCardNumber);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-[#141d38] border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#172242]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
              <User className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 id={modalTitleId} className="text-base sm:text-lg font-bold text-white">
                پروفایل و مدیریت کارت‌ها
              </h2>
              <p className="text-xs text-slate-400">اطلاعات کاربری، امنیت و کارت‌های بانکی جهت تسویه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700/60 bg-[#0f172a]/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-bold transition-all ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>مشخصات و امنیت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-bold transition-all ${
              activeTab === 'cards'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>کارت‌های بانکی ({cards.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: Profile & Security */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {profileError && (
                <div className="p-3 text-xs sm:text-sm rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* User Avatar Summary */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0b132b] border border-slate-700/70">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-md">
                  {displayName.slice(0, 1) || 'د'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{displayName || 'کاربر دنگاتو'}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{email}</p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  نام و نام خانوادگی / نام مستعار <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="مثال: امیر رضایی"
                    className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  آدرس ایمیل <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-2.5 bg-[#0b132b] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm font-mono text-left"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  اعلان‌های دنگ و تسویه حساب به این ایمیل ارسال می‌شود.
                </p>
              </div>

              {/* Password Section Toggle */}
              <div className="pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className="flex items-center justify-between w-full py-2 text-xs font-bold text-slate-300 hover:text-emerald-400 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تغییر رمز عبور ورود</span>
                  </span>
                  <span className="text-[11px] text-emerald-400/80">
                    {showPasswordChange ? 'انصراف از تغییر' : 'ویرایش رمز'}
                  </span>
                </button>

                {showPasswordChange && (
                  <div className="mt-3 p-4 rounded-2xl bg-[#0b132b] border border-slate-700 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        رمز عبور فعلی <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        dir="ltr"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-[#141d38] border border-slate-700 rounded-lg text-white text-xs font-mono text-left focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          رمز عبور جدید (حداقل ۶ کاراکتر) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-[#141d38] border border-slate-700 rounded-lg text-white text-xs font-mono text-left focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          تکرار رمز عبور جدید <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-[#141d38] border border-slate-700 rounded-lg text-white text-xs font-mono text-left focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <span>ذخیره تغییرات</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all"
                >
                  بستن
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Bank Cards */}
          {activeTab === 'cards' && (
            <div className="space-y-6">
              {/* Add Card Toggle Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">شماره کارت‌های متصل به حساب</h3>
                  <p className="text-xs text-slate-400">کارت پیش‌فرض در هنگام تسویه به هم‌اتاقی‌ها نمایش داده می‌شود.</p>
                </div>
                {!isAddingCard && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCard(true);
                      setNewHolderName(displayName);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>افزودن کارت</span>
                  </button>
                )}
              </div>

              {/* Add Card Form with Live Card Preview */}
              {isAddingCard && (
                <div className="p-4 rounded-3xl bg-[#0b132b] border border-slate-700/80 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" />
                      <span>مشخصات کارت بانکی جدید</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCard(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      انصراف
                    </button>
                  </div>

                  {/* Live Visual Card Preview */}
                  <div className="flex justify-center">
                    <div
                      className={`relative w-full max-w-sm h-48 rounded-2xl p-5 shadow-2xl border border-white/10 flex flex-col justify-between overflow-hidden bg-gradient-to-tr ${previewBank.gradient} ${previewBank.textColor} transition-all duration-300`}
                    >
                      {/* Decorative Gloss Glow */}
                      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />

                      {/* Card Top: Chip & Wifi & Bank Name */}
                      <div className="flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                          {/* Realistic Metallic Chip Graphic */}
                          <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-200 border border-amber-500/40 shadow-inner flex items-center justify-center p-1">
                            <div className="w-full h-full border border-amber-700/40 rounded-sm grid grid-cols-2 gap-0.5 opacity-60" />
                          </div>
                          <Wifi className="w-4 h-4 opacity-70 rotate-90" />
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-black/25 backdrop-blur-sm border border-white/10">
                          {previewBank.name}
                        </span>
                      </div>

                      {/* Card Middle: 16-Digit Number */}
                      <div className="z-10 text-center my-auto">
                        <div
                          dir="ltr"
                          className="font-mono text-lg sm:text-xl font-bold tracking-widest text-shadow drop-shadow-md"
                        >
                          {newCardNumber
                            ? formatCardNumber(newCardNumber, false, ' ')
                            : '•••• •••• •••• ••••'}
                        </div>
                        {newCardNumber.length === 16 && (
                          <div className="text-[10px] mt-1 font-semibold flex items-center justify-center gap-1">
                            {isInputValidCard ? (
                              <span className="text-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3" /> کارت معتبر
                              </span>
                            ) : (
                              <span className="text-rose-300">شماره کارت نامعتبر است</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Bottom: Holder Name & Shaba */}
                      <div className="flex items-end justify-between z-10 text-xs">
                        <div>
                          <span className="text-[9px] opacity-70 block">صاحب کارت:</span>
                          <span className="font-bold truncate max-w-[170px] block">
                            {newHolderName || displayName || 'نام صاحب کارت'}
                          </span>
                        </div>
                        {newShaba && (
                          <div className="text-left font-mono text-[10px] opacity-80" dir="ltr">
                            {formatShaba(newShaba)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {cardError && (
                    <div className="p-3 text-xs rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cardError}</span>
                    </div>
                  )}

                  {/* Form Fields */}
                  <form onSubmit={handleAddCardSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        شماره ۱۶ رقمی کارت <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        required
                        inputMode="numeric"
                        maxLength={19}
                        value={formatCardNumber(newCardNumber, false, '-')}
                        onChange={handleCardNumberChange}
                        placeholder="6037-9975-1234-5678"
                        className="w-full px-4 py-2.5 bg-[#141d38] border border-slate-700 rounded-xl text-white font-mono text-center tracking-wider focus:outline-none focus:border-emerald-500 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          نام بانک <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newBankName}
                          onChange={(e) => setNewBankName(e.target.value)}
                          placeholder="مثال: بانک ملت"
                          className="w-full px-3 py-2 bg-[#141d38] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          نام صاحب کارت <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newHolderName}
                          onChange={(e) => setNewHolderName(e.target.value)}
                          placeholder="مثال: امیر رضایی"
                          className="w-full px-3 py-2 bg-[#141d38] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        شماره شبا (اختیاری)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newShaba}
                        onChange={(e) => setNewShaba(e.target.value.toUpperCase())}
                        placeholder="IR000000000000000000000000"
                        maxLength={26}
                        className="w-full px-3 py-2 bg-[#141d38] border border-slate-700 rounded-xl text-white text-xs font-mono text-left focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="isDefaultCard"
                        checked={newIsDefault}
                        onChange={(e) => setNewIsDefault(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-emerald-500"
                      />
                      <label htmlFor="isDefaultCard" className="text-xs text-slate-300 cursor-pointer">
                        تنظیم به عنوان کارت بانکی پیش‌فرض
                      </label>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isSavingCard}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSavingCard ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>در حال ذخیره...</span>
                          </>
                        ) : (
                          <span>ثبت و ذخیره کارت</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingCard(false)}
                        className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                      >
                        انصراف
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Cards List */}
              {isLoadingCards ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs">در حال بارگذاری کارت‌های بانکی...</span>
                </div>
              ) : cards.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border border-dashed border-slate-700/80 p-6 space-y-3">
                  <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">هنوز کارت بانکی ثبت نکرده‌اید</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    با افزودن کارت بانکی، هم‌اتاقی‌های شما در هنگام تسویه حساب مستقیم، شماره کارت شما را به آسانی کپی می‌کنند.
                  </p>
                  {!isAddingCard && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCard(true);
                        setNewHolderName(displayName);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-md hover:bg-emerald-400 transition-all"
                    >
                      افزودن اولین کارت
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {cards.map((card) => {
                    const bank = detectBank(card.cardNumber);
                    return (
                      <div
                        key={card.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          card.isDefault
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                            : 'bg-[#0b132b] border-slate-700/70 hover:border-slate-600'
                        }`}
                      >
                        {/* Card Info */}
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-md bg-gradient-to-tr ${bank.gradient} ${bank.textColor}`}
                          >
                            <CreditCard className="w-5 h-5" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">{card.bankName}</span>
                              {card.isDefault && (
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <Star className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" />
                                  پیش‌فرض
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-sm font-bold text-slate-200 tracking-wider">
                                {formatCardNumber(card.cardNumber, true)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyCard(card)}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                                title="کپی شماره کارت"
                              >
                                {copiedCardId === card.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="text-[11px] text-slate-400 mt-0.5">
                              <span>صاحب کارت: {card.cardHolderName}</span>
                              {card.shabaNumber && (
                                <span className="mr-3 font-mono text-[10px] text-slate-500" dir="ltr">
                                  {formatShaba(card.shabaNumber)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {!card.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(card.id)}
                              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            >
                              انتخاب پیش‌فرض
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="حذف کارت"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
