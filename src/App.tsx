import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  ArrowLeftRight,
  Receipt,
  Users,
  TrendingUp,
  TrendingDown,
  Scale,
  Shield,
  UserX,
  History,
  CheckCircle2,
  Info,
  Loader2,
  DoorOpen,
} from 'lucide-react';
import type {
  Room,
  Member,
  Expense,
  Settlement,
  ActivityLog,
  ExpenseCategory,
  AuthUser,
} from './types';
import {
  initialRoom,
  initialMembers,
  initialExpenses,
  initialSettlements,
  initialActivityLogs,
} from './data/mockData';
import {
  computePairwiseBalances,
  computeUserSummary,
  formatToman,
  toPersianDigits,
} from './lib/calculations';
import {
  fetchRoomBundle,
  fetchUserRooms,
  createExpenseApi,
  updateExpenseApi,
  deleteExpenseApi,
  requestSettlementApi,
  confirmSettlementApi,
  rejectSettlementApi,
  updateRoomNameApi,
  deactivateMemberApi,
  STORAGE_KEYS,
} from './services/api';
import { onAuthStateChange, signOut as authSignOut } from './services/auth';
import { useRoomSubscription } from './services/realtime';
import { RoomHeader } from './components/RoomHeader';
import { AddExpenseModal } from './components/AddExpenseModal';
import { EditExpenseModal } from './components/EditExpenseModal';
import { SettleUpModal } from './components/SettleUpModal';
import { PendingSettlements } from './components/PendingSettlements';
import { ExpenseList } from './components/ExpenseList';
import { PairwiseBreakdown } from './components/PairwiseBreakdown';
import { ActivityFeed } from './components/ActivityFeed';
import { JoinRoomModal } from './components/JoinRoomModal';
import { RoomSettingsModal } from './components/RoomSettingsModal';
import { MyRoomsModal } from './components/MyRoomsModal';
import { AuthModal } from './components/AuthModal';
import { exportExpensesToCSV } from './lib/export';

export function App() {
  // Session & Room State
  const [room, setRoom] = useState<Room>(() => initialRoom);
  const [members, setMembers] = useState<Member[]>(() => initialMembers);
  const [expenses, setExpenses] = useState<Expense[]>(() => initialExpenses);
  const [settlements, setSettlements] = useState<Settlement[]>(() => initialSettlements);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => initialActivityLogs);

  // Active view user perspective
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.MEMBER_ID) || 'm1';
  });

  // Auth User & Multi-room State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isMyRoomsOpen, setIsMyRoomsOpen] = useState<boolean>(false);
  const [userRooms, setUserRooms] = useState<{ room: Room; member: Member }[]>([]);
  const [isLoadingUserRooms, setIsLoadingUserRooms] = useState<boolean>(false);
  const [joinModalTab, setJoinModalTab] = useState<'join' | 'create'>('join');

  const [isLoadingBundle, setIsLoadingBundle] = useState<boolean>(true);

  // Modals state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [initialJoinCode, setInitialJoinCode] = useState<string>('');
  const [settleTargetMemberId, setSettleTargetMemberId] = useState<string | undefined>(undefined);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'expenses' | 'activity' | 'members'>('expenses');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Sync session changes to localStorage
  const handleSetCurrentUser = (userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem(STORAGE_KEYS.MEMBER_ID, userId);
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setAuthUser(user);
      if (!user) {
        setIsAuthModalOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Rooms for the authenticated user
  const refreshUserRooms = useCallback(
    async (targetUser: AuthUser): Promise<{ room: Room; member: Member }[]> => {
      setIsLoadingUserRooms(true);
      try {
        const list = await fetchUserRooms(targetUser.id, targetUser.displayName);
        setUserRooms(list);
        return list;
      } catch (err) {
        console.warn('Error loading user rooms:', err);
        return [];
      } finally {
        setIsLoadingUserRooms(false);
      }
    },
    []
  );

  // Check user rooms on auth state change
  useEffect(() => {
    if (authUser) {
      refreshUserRooms(authUser).then((rooms) => {
        if (rooms.length === 0) {
          setIsMyRoomsOpen(true);
        } else if (rooms.length > 1) {
          const savedRoomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
          if (!savedRoomId || !rooms.some((r) => r.room.id === savedRoomId)) {
            setIsMyRoomsOpen(true);
          }
        }
      });
    }
  }, [authUser, refreshUserRooms]);

  // Load Room Data
  const loadRoom = useCallback(async (roomIdToLoad: string) => {
    setIsLoadingBundle(true);
    try {
      const bundle = await fetchRoomBundle(roomIdToLoad);
      setRoom(bundle.room);
      setMembers(bundle.members);
      setExpenses(bundle.expenses);
      setSettlements(bundle.settlements);
      setActivityLogs(bundle.activityLogs);

      const exists = bundle.members.some((m) => m.id === currentUserId);
      if (!exists && bundle.members.length > 0) {
        handleSetCurrentUser(bundle.members[0].id);
      }
    } catch (err: any) {
      showToast(err?.message || 'خطا در بارگذاری اطلاعات اتاق', 'error');
    } finally {
      setIsLoadingBundle(false);
    }
  }, [currentUserId, showToast]);

  // URL ?join=CODE detection & Initial Room Loading
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const joinParam = searchParams.get('join');
    if (joinParam) {
      setInitialJoinCode(joinParam.trim().toUpperCase());
      setIsJoinRoomOpen(true);
    }

    const savedRoomId = localStorage.getItem(STORAGE_KEYS.ROOM_ID) || initialRoom.id;
    loadRoom(savedRoomId);
  }, [loadRoom]);

  // Realtime Subscription
  const handleRealtimeRefresh = useCallback(
    (notice?: { title: string; message: string }) => {
      loadRoom(room.id);
      if (notice) {
        showToast(notice.message, 'info');
      }
    },
    [loadRoom, room.id, showToast]
  );

  useRoomSubscription({
    roomId: room.id,
    currentUserId,
    onRefreshNeeded: handleRealtimeRefresh,
  });

  // Room Join / Creation Handler
  const handleRoomSuccess = (newRoom: Room, newMember: Member) => {
    setRoom(newRoom);
    setMembers([newMember]);
    setExpenses([]);
    setSettlements([]);
    setActivityLogs([]);
    handleSetCurrentUser(newMember.id);
    localStorage.setItem(STORAGE_KEYS.ROOM_ID, newRoom.id);
    setIsJoinRoomOpen(false);
    setIsMyRoomsOpen(false);
    showToast(`شما با موفقیت وارد اتاق «${newRoom.name}» شدید.`);
    loadRoom(newRoom.id);
    if (authUser) {
      refreshUserRooms(authUser);
    }
  };

  // Sign out handler
  const handleLogout = async () => {
    await authSignOut();
    setAuthUser(null);
    setIsAuthModalOpen(true);
    showToast('با موفقیت از حساب کاربری خارج شدید.', 'info');
  };

  // Strictly derive currentUser from authenticated session
  const currentUser = useMemo(() => {
    if (authUser) {
      const match = members.find(
        (m) =>
          (m.userId && m.userId === authUser.id) ||
          m.name.trim().toLowerCase() === authUser.displayName.trim().toLowerCase()
      );
      if (match) return match;
    }
    const byId = members.find((m) => m.id === currentUserId);
    if (byId) return byId;
    return members[0] || initialMembers[0];
  }, [members, currentUserId, authUser]);

  useEffect(() => {
    if (currentUser && currentUser.id !== currentUserId) {
      setCurrentUserId(currentUser.id);
      localStorage.setItem(STORAGE_KEYS.MEMBER_ID, currentUser.id);
    }
  }, [currentUser, currentUserId]);

  const isAdmin = Boolean(currentUser.isAdmin);

  // Derive Pairwise direct balances for the active user
  const pairwiseBalances = useMemo(() => {
    return computePairwiseBalances(currentUserId, members, expenses, settlements);
  }, [currentUserId, members, expenses, settlements]);

  // Derive High-level summary (Total Lent, Total Owed, Net Balance)
  const userSummary = useMemo(() => {
    return computeUserSummary(pairwiseBalances);
  }, [pairwiseBalances]);

  // Total room spending
  const totalRoomSpending = useMemo(() => {
    return expenses.reduce((acc, exp) => acc + exp.totalAmount, 0);
  }, [expenses]);

  // Handler: Add new expense
  const handleAddExpense = async (expenseData: {
    title: string;
    totalAmount: number;
    paidById: string;
    category: ExpenseCategory;
    splits: { memberId: string; amount: number; percentage?: number }[];
    notes?: string;
    receiptUrl?: string;
  }) => {
    try {
      const payer = members.find((m) => m.id === expenseData.paidById);
      const created = await createExpenseApi(room.id, expenseData, payer?.name || currentUser.name);

      setExpenses((prev) => [created, ...prev]);

      const newLog: ActivityLog = {
        id: `act-${Date.now()}`,
        roomId: room.id,
        type: 'expense_added',
        userId: expenseData.paidById,
        description: `${payer?.name || 'کاربر'} هزینه «${expenseData.title}» (${formatToman(
          expenseData.totalAmount
        )}) را ثبت کرد.`,
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);

      showToast(`هزینه «${expenseData.title}» ثبت و دنگ‌ها محاسبه شدند.`);
    } catch (err: any) {
      showToast(err?.message || 'خطا در ثبت هزینه', 'error');
    }
  };

  // Handler: Update expense (Audit Trail)
  const handleUpdateExpense = async (updatedData: {
    title: string;
    totalAmount: number;
    paidById: string;
    category: ExpenseCategory;
    splits: { memberId: string; amount: number; percentage?: number }[];
    notes?: string;
    receiptUrl?: string;
  }) => {
    if (!editingExpense) return;

    try {
      const updated = await updateExpenseApi(
        room.id,
        editingExpense.id,
        editingExpense,
        updatedData,
        currentUser.name,
        currentUserId
      );

      setExpenses((prev) => prev.map((e) => (e.id === editingExpense.id ? updated : e)));
      setEditingExpense(null);
      showToast(`تغییرات هزینه «${updated.title}» ثبت و سوابق به‌روزرسانی شد.`);
      loadRoom(room.id);
    } catch (err: any) {
      showToast(err?.message || 'خطا در ویرایش هزینه', 'error');
    }
  };

  // Handler: Delete expense (Audit Trail)
  const handleDeleteExpense = async (expense: Expense) => {
    try {
      await deleteExpenseApi(
        room.id,
        expense.id,
        expense.title,
        expense.totalAmount,
        currentUser.name,
        currentUserId
      );

      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      showToast(`هزینه «${expense.title}» حذف شد.`);
      loadRoom(room.id);
    } catch (err: any) {
      showToast(err?.message || 'خطا در حذف هزینه', 'error');
    }
  };

  // Handler: Request settlement (creates pending settlement)
  const handleRequestSettlement = async (data: {
    receiverId: string;
    amount: number;
    notes?: string;
  }) => {
    try {
      const receiver = members.find((m) => m.id === data.receiverId);
      const created = await requestSettlementApi(
        room.id,
        currentUserId,
        data.receiverId,
        data.amount,
        currentUser.name,
        receiver?.name || 'هم‌اتاقی',
        data.notes
      );

      setSettlements((prev) => [created, ...prev]);

      const newLog: ActivityLog = {
        id: `act-${Date.now()}`,
        roomId: room.id,
        type: 'settlement_requested',
        userId: currentUserId,
        description: `${currentUser.name} درخواست تسویه ${formatToman(data.amount)} با ${
          receiver?.name || 'هم‌اتاقی'
        } را ثبت کرد.`,
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);

      showToast(
        `درخواست تسویه ثبت شد. پس از تأیید توسط ${receiver?.name || 'طرف مقابل'}، بدهی کسر خواهد شد.`,
        'info'
      );
    } catch (err: any) {
      showToast(err?.message || 'خطا در ثبت درخواست تسویه', 'error');
    }
  };

  // Handler: Confirm settlement (receiver clicks "تأیید دریافت")
  const handleConfirmSettlement = async (settlementId: string) => {
    const settlement = settlements.find((s) => s.id === settlementId);
    if (!settlement) return;

    const payer = members.find((m) => m.id === settlement.payerId);

    try {
      await confirmSettlementApi(
        room.id,
        settlementId,
        currentUserId,
        currentUser.name,
        payer?.name || 'هم‌اتاقی',
        settlement.amount
      );

      setSettlements((prev) =>
        prev.map((s) =>
          s.id === settlementId
            ? { ...s, status: 'confirmed', confirmedAt: new Date().toISOString() }
            : s
        )
      );

      const newLog: ActivityLog = {
        id: `act-${Date.now()}`,
        roomId: room.id,
        type: 'settlement_confirmed',
        userId: currentUserId,
        description: `${currentUser.name} دریافت وجه به مبلغ ${formatToman(settlement.amount)} از ${
          payer?.name || 'هم‌اتاقی'
        } را تأیید کرد.`,
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);

      showToast(`دریافت مبلغ ${formatToman(settlement.amount)} تأیید شد و تراز بدهی به‌روز گردید.`);
    } catch (err: any) {
      showToast(err?.message || 'خطا در تأیید تسویه', 'error');
    }
  };

  // Handler: Reject settlement
  const handleRejectSettlement = async (settlementId: string) => {
    const settlement = settlements.find((s) => s.id === settlementId);
    if (!settlement) return;

    const payer = members.find((m) => m.id === settlement.payerId);

    try {
      await rejectSettlementApi(
        room.id,
        settlementId,
        currentUserId,
        currentUser.name,
        payer?.name || 'هم‌اتاقی',
        settlement.amount
      );

      setSettlements((prev) =>
        prev.map((s) => (s.id === settlementId ? { ...s, status: 'rejected' } : s))
      );

      const newLog: ActivityLog = {
        id: `act-${Date.now()}`,
        roomId: room.id,
        type: 'settlement_rejected',
        userId: currentUserId,
        description: `${currentUser.name} درخواست تسویه ${formatToman(settlement.amount)} از سوی ${
          payer?.name || 'هم‌اتاقی'
        } را رد کرد.`,
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);

      showToast(`درخواست تسویه رد شد.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'خطا در رد تسویه', 'error');
    }
  };

  // Handler: Admin Update Room Name
  const handleUpdateRoomName = async (newName: string) => {
    try {
      await updateRoomNameApi(room.id, newName, currentUser.name, currentUserId);
      setRoom((prev) => ({ ...prev, name: newName }));
      showToast(`نام اتاق با موفقیت به «${newName}» تغییر یافت.`);
    } catch (err: any) {
      showToast(err?.message || 'خطا در تغییر نام اتاق', 'error');
    }
  };

  // Handler: Admin Kick / Deactivate Member (Soft Delete Invariant)
  const handleDeactivateMember = async (memberId: string, memberName: string) => {
    try {
      await deactivateMemberApi(room.id, memberId, memberName, currentUser.name, currentUserId);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, isActive: false } : m)));
      showToast(`هم‌اتاقی «${memberName}» با موفقیت بایگانی شد.`);
      loadRoom(room.id);
    } catch (err: any) {
      showToast(err?.message || 'خطا در بایگانی هم‌اتاقی', 'error');
    }
  };

  const handleOpenSettleWithMember = (memberId: string) => {
    setSettleTargetMemberId(memberId);
    setIsSettleUpOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 flex flex-col font-sans pb-safe">
      {/* Top Header with User Profile, Room Title, My Rooms & Admin Controls */}
      <RoomHeader
        room={room}
        currentUser={currentUser}
        authUser={authUser}
        onOpenMyRooms={() => {
          if (authUser) refreshUserRooms(authUser);
          setIsMyRoomsOpen(true);
        }}
        onLogout={handleLogout}
        onOpenAdminSettings={() => setIsRoomSettingsOpen(true)}
        onExportCSV={() => exportExpensesToCSV(expenses, members, room.name)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`p-3.5 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-xl border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toastMessage.type === 'info' && <Info className="w-5 h-5 text-indigo-400 shrink-0" />}
            {toastMessage.type === 'error' && <Info className="w-5 h-5 text-rose-400 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Loading Spinner Indicator */}
        {isLoadingBundle ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">در حال دریافت داده‌های اتاق...</span>
          </div>
        ) : (
          <>
            {/* Hero Balance Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Net Balance Card */}
              <div className="bg-[#141d38] border border-slate-700/60 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-slate-400" />
                    تراز کلی حساب شما
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                    دیدگاه: {currentUser.name}
                  </span>
                </div>

                <div>
                  <div
                    className={`text-2xl sm:text-3xl font-black tracking-tight ${
                      userSummary.netBalance > 0
                        ? 'text-emerald-400'
                        : userSummary.netBalance < 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {userSummary.netBalance > 0 ? '+' : userSummary.netBalance < 0 ? '-' : ''}
                    {formatToman(Math.abs(userSummary.netBalance))}
                  </div>

                  <p className="text-xs text-slate-400 mt-1.5">
                    {userSummary.netBalance > 0
                      ? 'در مجموع از هم‌اتاقی‌ها طلبکار هستید.'
                      : userSummary.netBalance < 0
                      ? 'در مجموع به هم‌اتاقی‌ها بدهکار هستید.'
                      : 'تراز حساب شما کاملاً صفر و بی‌حساب است.'}
                  </p>
                </div>
              </div>

              {/* Total Lent (طلب کل) */}
              <div className="bg-[#141d38] border border-emerald-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" />
                    طلب کل شما (دیگران به شما)
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold">
                    +
                  </div>
                </div>

                <div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400">
                    {formatToman(userSummary.totalLent)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    مجموع مبالغی که برای سایر هم‌اتاقی‌ها پرداخته‌اید
                  </p>
                </div>
              </div>

              {/* Total Owed (بدهی کل) */}
              <div className="bg-[#141d38] border border-rose-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    بدهی کل شما (شما به دیگران)
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold">
                    -
                  </div>
                </div>

                <div>
                  <div className="text-2xl sm:text-3xl font-black text-rose-400">
                    {formatToman(userSummary.totalOwed)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    مجموع سهم‌هایی که دیگران برای شما پرداخت کرده‌اند
                  </p>
                </div>
              </div>
            </section>

            {/* Quick Actions Row */}
            <section className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(true)}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
              >
                <PlusCircle className="w-5 h-5 stroke-[2.5]" />
                <span>+ ثبت هزینه جدید</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettleTargetMemberId(undefined);
                  setIsSettleUpOpen(true);
                }}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-[#1c274c] hover:bg-[#233160] border border-indigo-500/40 text-indigo-200 font-bold text-sm shadow-lg shadow-black/20 flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
              >
                <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
                <span>تسویه حساب مستقیم (P2P)</span>
              </button>
            </section>

            {/* Pending Settlements (Rule 2: Direct P2P Confirmation) */}
            <PendingSettlements
              settlements={settlements}
              members={members}
              currentUserId={currentUserId}
              onConfirmSettlement={handleConfirmSettlement}
              onRejectSettlement={handleRejectSettlement}
            />

            {/* Pairwise Bilateral Balances */}
            <PairwiseBreakdown
              pairwiseBalances={pairwiseBalances}
              members={members}
              onSettleWithMember={handleOpenSettleWithMember}
            />

            {/* Tabs: Expenses vs Activity vs Members */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-700/60 pb-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('expenses')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'expenses'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>هزینه‌های اتاق ({toPersianDigits(expenses.length)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'activity'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>دفتر رویدادها ({toPersianDigits(activityLogs.length)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'members'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4 text-teal-400" />
                  <span>هم‌اتاقی‌ها ({toPersianDigits(members.length)})</span>
                </button>
              </div>

              {/* Tab 1: Expense List with Edit/Delete */}
              {activeTab === 'expenses' && (
                <ExpenseList
                  expenses={expenses}
                  members={members}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onOpenAddExpense={() => setIsAddExpenseOpen(true)}
                  onEditExpense={(exp) => setEditingExpense(exp)}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {/* Tab 2: Activity Log Feed */}
              {activeTab === 'activity' && (
                <ActivityFeed logs={activityLogs} members={members} />
              )}

              {/* Tab 3: Roommates Overview */}
              {activeTab === 'members' && (
                <div className="bg-[#141d38] border border-slate-700/60 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                    <div>
                      <h3 className="text-sm font-bold text-white">اعضای اتاق و خوابگاه</h3>
                      <p className="text-xs text-slate-400">
                        مدیر اتاق، هم‌اتاقی‌های فعال و سوابق اعضای پیشین
                      </p>
                    </div>
                    <div className="text-xs text-slate-400">
                      مجموع خرج‌های اتاق:{' '}
                      <strong className="text-slate-200 font-bold">
                        {formatToman(totalRoomSpending)}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between ${
                          member.isActive
                            ? 'bg-[#0b132b]/80 border-slate-700/70'
                            : 'bg-slate-900/40 border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white bg-gradient-to-br ${
                              member.color || 'from-blue-500 to-indigo-600'
                            }`}
                          >
                            {member.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-bold text-white">
                                {member.name}
                              </span>
                              {member.isAdmin && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                  <Shield className="w-2.5 h-2.5" /> مدیر
                                </span>
                              )}
                              {!member.isActive && (
                                <span className="flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                  <UserX className="w-2.5 h-2.5" /> خارج شده (بایگانی)
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {member.bankName || 'هم‌اتاقی'} {member.cardNumber ? `• کارت ${member.cardNumber}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Invite Code Share Banner */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-5 h-5 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-white block">افزودن هم‌اتاقی جدید</span>
                        <span className="text-[11px] text-slate-400">
                          کد دعوت <strong className="font-mono text-emerald-400">{room.inviteCode}</strong> را برای هم‌اتاقی‌های خود ارسال کنید.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        roomId={room.id}
        members={members}
        currentUserId={currentUserId}
        onAddExpense={handleAddExpense}
      />

      {/* Edit Expense Modal */}
      <EditExpenseModal
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        roomId={room.id}
        expense={editingExpense}
        members={members}
        currentUserId={currentUserId}
        onUpdateExpense={handleUpdateExpense}
      />

      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={isSettleUpOpen}
        onClose={() => setIsSettleUpOpen(false)}
        currentUserId={currentUserId}
        members={members}
        pairwiseBalances={pairwiseBalances}
        initialTargetMemberId={settleTargetMemberId}
        onRequestSettlement={handleRequestSettlement}
      />

      {/* Join / Create Room Modal */}
      <JoinRoomModal
        isOpen={isJoinRoomOpen}
        onClose={() => setIsJoinRoomOpen(false)}
        canClose={Boolean(room?.id)}
        initialInviteCode={initialJoinCode}
        defaultDisplayName={authUser?.displayName || ''}
        userId={authUser?.id}
        initialTab={joinModalTab}
        onSuccess={handleRoomSuccess}
      />

      {/* My Rooms Switcher Modal */}
      <MyRoomsModal
        isOpen={isMyRoomsOpen}
        onClose={() => setIsMyRoomsOpen(false)}
        canClose={Boolean(room?.id)}
        userRooms={userRooms}
        currentRoomId={room.id}
        onSelectRoom={(roomId) => {
          localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomId);
          loadRoom(roomId);
          showToast('اتاق تغییر یافت.');
        }}
        onOpenCreateRoom={() => {
          setJoinModalTab('create');
          setIsJoinRoomOpen(true);
        }}
        onOpenJoinRoom={() => {
          setJoinModalTab('join');
          setIsJoinRoomOpen(true);
        }}
        isLoading={isLoadingUserRooms}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        canClose={Boolean(authUser)}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setAuthUser(user);
          setIsAuthModalOpen(false);
          showToast(`خوش آمدید، ${user.displayName}`);
          refreshUserRooms(user).then((rooms) => {
            if (rooms.length === 0 || rooms.length > 1) {
              setIsMyRoomsOpen(true);
            }
          });
        }}
      />

      {/* Room Settings & Admin Modal */}
      <RoomSettingsModal
        isOpen={isRoomSettingsOpen}
        onClose={() => setIsRoomSettingsOpen(false)}
        room={room}
        members={members}
        expenses={expenses}
        settlements={settlements}
        pairwiseBalances={pairwiseBalances}
        currentUserId={currentUserId}
        onUpdateRoomName={handleUpdateRoomName}
        onDeactivateMember={handleDeactivateMember}
      />
    </div>
  );
}

export default App;
