import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Room,
  Member,
  Expense,
  Settlement,
  ActivityLog,
  ExpenseCategory,
  BankCard,
  SimplifiedDebt,
} from '../types';
import {
  initialRoom,
  initialMembers,
  initialExpenses,
  initialSettlements,
  initialActivityLogs,
} from '../data/mockData';
import { formatToman, computeSimplifiedDebts } from '../lib/calculations';


export const STORAGE_KEYS = {
  ROOM_ID: 'dongato_active_room_id',
  MEMBER_ID: 'dongato_active_member_id',
} as const;

/**
 * Generates a unique 6-character alphanumeric invite code (e.g. 7K9MX2)
 */
export function generateInviteCode(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rand;
}

export interface RoomBundle {
  room: Room;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  activityLogs: ActivityLog[];
}

// In-memory / LocalStorage cache for fallback mock state
function getLocalFallbackState(): RoomBundle {
  const saved = localStorage.getItem('dongato_fallback_bundle');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore parse error and reset
    }
  }
  const initialBundle: RoomBundle = {
    room: initialRoom,
    members: initialMembers,
    expenses: initialExpenses,
    settlements: initialSettlements,
    activityLogs: initialActivityLogs,
  };
  localStorage.setItem('dongato_fallback_bundle', JSON.stringify(initialBundle));
  return initialBundle;
}

function saveLocalFallbackState(bundle: RoomBundle): void {
  localStorage.setItem('dongato_fallback_bundle', JSON.stringify(bundle));
}

// ==============================================================================
// 1. Room Creation
// ==============================================================================
export async function createRoom(
  roomName: string,
  creatorName: string,
  userId?: string
): Promise<{ room: Room; member: Member }> {
  const inviteCode = generateInviteCode();

  let effectiveUserId = userId;
  if (!effectiveUserId) {
    try {
      const savedAuth = localStorage.getItem('dongato_auth_user');
      if (savedAuth) {
        effectiveUserId = JSON.parse(savedAuth).id;
      }
    } catch {
      // ignore parse error
    }
  }

  if (isSupabaseConfigured && supabase) {
    // A. Insert Room
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .insert({
        name: roomName,
        invite_code: inviteCode,
        currency: 'تومان',
      })
      .select()
      .single();

    if (roomError || !roomData) {
      throw new Error(`خطا در ایجاد اتاق: ${roomError?.message || 'مشکل سرور'}`);
    }

    // B. Insert Creator Member
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .insert({
        room_id: roomData.id,
        name: creatorName,
        is_admin: true,
        is_active: true,
        color: 'from-blue-500 to-indigo-600',
        user_id: effectiveUserId || null,
      })
      .select()
      .single();

    if (memberError || !memberData) {
      throw new Error(`خطا در ثبت کاربر مدیر: ${memberError?.message || 'مشکل سرور'}`);
    }

    // C. Update rooms.created_by
    await supabase.from('rooms').update({ created_by: memberData.id }).eq('id', roomData.id);

    // D. Persist active room ID & member ID to localStorage
    localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomData.id);
    localStorage.setItem(STORAGE_KEYS.MEMBER_ID, memberData.id);

    // E. Log activity
    await supabase.from('activity_logs').insert({
      room_id: roomData.id,
      actor_id: memberData.id,
      action_type: 'member_joined',
      description: `${creatorName} اتاق «${roomName}» را ایجاد کرد.`,
    });

    const room: Room = {
      id: roomData.id,
      name: roomData.name,
      inviteCode: roomData.invite_code,
      createdBy: memberData.id,
      createdAt: roomData.created_at,
      currency: roomData.currency,
      description: roomData.description,
    };

    const member: Member = {
      id: memberData.id,
      roomId: memberData.room_id,
      name: memberData.name,
      avatarUrl: memberData.avatar_url,
      color: memberData.color,
      isAdmin: memberData.is_admin,
      isActive: memberData.is_active,
      cardNumber: memberData.card_number,
      bankName: memberData.bank_name,
      userId: memberData.user_id || effectiveUserId,
      joinedAt: memberData.joined_at,
    };

    return { room, member };
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  const roomId = `room-${Date.now()}`;
  const memberId = `m-${Date.now()}`;

  const newRoom: Room = {
    id: roomId,
    name: roomName,
    inviteCode,
    createdBy: memberId,
    createdAt: new Date().toISOString(),
    currency: 'تومان',
    description: 'اتاق جدید',
  };

  const newMember: Member = {
    id: memberId,
    roomId,
    name: creatorName,
    isAdmin: true,
    isActive: true,
    color: 'from-blue-500 to-indigo-600',
    userId: effectiveUserId,
    joinedAt: new Date().toISOString(),
  };

  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'member_joined',
    userId: memberId,
    description: `${creatorName} اتاق «${roomName}» را ایجاد کرد.`,
    timestamp: new Date().toISOString(),
  };

  bundle.room = newRoom;
  bundle.members = [newMember];
  bundle.expenses = [];
  bundle.settlements = [];
  bundle.activityLogs = [newLog];

  saveLocalFallbackState(bundle);
  localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomId);
  localStorage.setItem(STORAGE_KEYS.MEMBER_ID, memberId);

  return { room: newRoom, member: newMember };
}

// ==============================================================================
// 2. Join Room via Invite Code
// ==============================================================================
export async function joinRoom(
  inviteCode: string,
  memberName: string,
  userId?: string
): Promise<{ room: Room; member: Member }> {
  const normalizedCode = inviteCode.trim().toUpperCase();

  let effectiveUserId = userId;
  if (!effectiveUserId) {
    try {
      const savedAuth = localStorage.getItem('dongato_auth_user');
      if (savedAuth) {
        effectiveUserId = JSON.parse(savedAuth).id;
      }
    } catch {
      // ignore parse error
    }
  }

  if (isSupabaseConfigured && supabase) {
    // Query rooms case-insensitively using .ilike('invite_code', inviteCode.trim())
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .ilike('invite_code', inviteCode.trim())
      .maybeSingle();

    if (roomError || !roomData) {
      throw new Error('کد دعوت وارد شده یافت نشد یا معتبر نیست.');
    }

    // Insert new member
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .insert({
        room_id: roomData.id,
        name: memberName,
        is_admin: false,
        is_active: true,
        color: 'from-emerald-500 to-teal-600',
        user_id: effectiveUserId || null,
      })
      .select()
      .single();

    if (memberError || !memberData) {
      throw new Error(`خطا در ورود به اتاق: ${memberError?.message}`);
    }

    // Persist active room ID and member ID to localStorage
    localStorage.setItem(STORAGE_KEYS.ROOM_ID, roomData.id);
    localStorage.setItem(STORAGE_KEYS.MEMBER_ID, memberData.id);

    await supabase.from('activity_logs').insert({
      room_id: roomData.id,
      actor_id: memberData.id,
      action_type: 'member_joined',
      description: `${memberName} با کد دعوت به اتاق پیوست.`,
    });

    const room: Room = {
      id: roomData.id,
      name: roomData.name,
      inviteCode: roomData.invite_code,
      createdBy: roomData.created_by,
      createdAt: roomData.created_at,
      currency: roomData.currency,
      description: roomData.description,
    };

    const member: Member = {
      id: memberData.id,
      roomId: memberData.room_id,
      name: memberData.name,
      avatarUrl: memberData.avatar_url,
      color: memberData.color,
      isAdmin: memberData.is_admin,
      isActive: memberData.is_active,
      cardNumber: memberData.card_number,
      bankName: memberData.bank_name,
      userId: memberData.user_id || effectiveUserId,
      joinedAt: memberData.joined_at,
    };

    return { room, member };
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  if (bundle.room.inviteCode.trim().toUpperCase() !== normalizedCode) {
    throw new Error(`کد دعوت یافت نشد. (کد نمونه موجود: ${bundle.room.inviteCode})`);
  }

  const memberId = `m-${Date.now()}`;
  const newMember: Member = {
    id: memberId,
    roomId: bundle.room.id,
    name: memberName,
    isAdmin: false,
    isActive: true,
    color: 'from-emerald-500 to-teal-600',
    userId: effectiveUserId,
    joinedAt: new Date().toISOString(),
  };

  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId: bundle.room.id,
    type: 'member_joined',
    userId: memberId,
    description: `${memberName} با کد دعوت به اتاق پیوست.`,
    timestamp: new Date().toISOString(),
  };

  bundle.members.push(newMember);
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);

  localStorage.setItem(STORAGE_KEYS.ROOM_ID, bundle.room.id);
  localStorage.setItem(STORAGE_KEYS.MEMBER_ID, memberId);

  return { room: bundle.room, member: newMember };
}

// ==============================================================================
// 3. Fetch Full Room Bundle
// ==============================================================================
export async function fetchRoomBundle(roomId: string): Promise<RoomBundle> {
  if (isSupabaseConfigured && supabase) {
    const { data: rData, error: rErr } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (rErr || !rData) throw new Error('اتاق مورد نظر یافت نشد.');

    const { data: mData, error: mErr } = await supabase.from('members').select('*').eq('room_id', roomId).order('joined_at', { ascending: true });
    if (mErr) throw new Error('خطا در دریافت لیست اعضا');

    const { data: eData, error: eErr } = await supabase
      .from('expenses')
      .select('*, splits(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (eErr) throw new Error('خطا در دریافت هزینه‌ها');

    const { data: sData, error: sErr } = await supabase
      .from('settlements')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (sErr) throw new Error('خطا در دریافت تسویه‌ها');

    const { data: aData, error: aErr } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (aErr) throw new Error('خطا در دریافت وقایع');

    const room: Room = {
      id: rData.id,
      name: rData.name,
      inviteCode: rData.invite_code,
      createdBy: rData.created_by,
      createdAt: rData.created_at,
      currency: rData.currency,
      description: rData.description,
    };

    const members: Member[] = (mData || []).map((m: any) => ({
      id: m.id,
      roomId: m.room_id,
      name: m.name,
      avatarUrl: m.avatar_url,
      color: m.color,
      isAdmin: m.is_admin,
      isActive: m.is_active,
      cardNumber: m.card_number,
      bankName: m.bank_name,
      userId: m.user_id || undefined,
      joinedAt: m.joined_at,
    }));

    const expenses: Expense[] = (eData || []).map((e: any) => ({
      id: e.id,
      roomId: e.room_id,
      title: e.title,
      totalAmount: Number(e.total_amount),
      paidById: e.paid_by_id,
      category: e.category as ExpenseCategory,
      splits: (e.splits || []).map((s: any) => ({
        memberId: s.member_id,
        amount: Number(s.amount),
        percentage: s.percentage ? Number(s.percentage) : undefined,
      })),
      createdAt: e.created_at,
      notes: e.notes,
      receiptUrl: e.receipt_url || undefined,
    }));

    const settlements: Settlement[] = (sData || []).map((s: any) => ({
      id: s.id,
      roomId: s.room_id,
      payerId: s.payer_id,
      receiverId: s.receiver_id,
      amount: Number(s.amount),
      status: s.status,
      createdAt: s.created_at,
      confirmedAt: s.confirmed_at,
      notes: s.notes,
    }));

    const activityLogs: ActivityLog[] = (aData || []).map((a: any) => ({
      id: a.id,
      roomId: a.room_id,
      userId: a.actor_id,
      type: a.action_type,
      description: a.description,
      timestamp: a.created_at,
    }));

    return { room, members, expenses, settlements, activityLogs };
  }

  // Fallback Mock State
  return getLocalFallbackState();
}

// ==============================================================================
// 4. Receipt Storage & Upload
// ==============================================================================
export async function uploadReceiptImage(file: File, roomId: string): Promise<string> {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit
  if (file.size > MAX_SIZE) {
    throw new Error('حداکثر حجم مجاز تصویر ۵ مگابایت است.');
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${roomId}/${Date.now()}_${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (!uploadError) {
        const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      } else {
        console.warn('Supabase storage upload failed, falling back to local data URL:', uploadError.message);
      }
    } catch (err: any) {
      console.warn('Storage upload exception, using fallback:', err?.message);
    }
  }

  // Fallback for offline / demo mode: Base64 data URL if <= 2MB, otherwise Object URL
  return new Promise((resolve) => {
    if (file.size > 2.5 * 1024 * 1024) {
      resolve(URL.createObjectURL(file));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      resolve(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  });
}

// ==============================================================================
// 5. Log Expense
// ==============================================================================
export async function createExpenseApi(
  roomId: string,
  expenseData: {
    title: string;
    totalAmount: number;
    paidById: string;
    category: ExpenseCategory;
    splits: { memberId: string; amount: number; percentage?: number }[];
    notes?: string;
    receiptUrl?: string;
  },
  payerName: string
): Promise<Expense> {
  if (isSupabaseConfigured && supabase) {
    const { data: exp, error: expErr } = await supabase
      .from('expenses')
      .insert({
        room_id: roomId,
        title: expenseData.title,
        total_amount: expenseData.totalAmount,
        paid_by_id: expenseData.paidById,
        category: expenseData.category,
        notes: expenseData.notes,
        receipt_url: expenseData.receiptUrl || null,
      })
      .select()
      .single();

    if (expErr || !exp) throw new Error(`خطا در ثبت هزینه: ${expErr?.message}`);

    const splitsPayload = expenseData.splits.map((s) => ({
      expense_id: exp.id,
      member_id: s.memberId,
      amount: s.amount,
      percentage: s.percentage,
    }));

    const { error: splitErr } = await supabase.from('splits').insert(splitsPayload);
    if (splitErr) throw new Error(`خطا در ثبت دنگ‌ها: ${splitErr.message}`);

    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: expenseData.paidById,
      action_type: 'expense_added',
      description: `${payerName} هزینه «${expenseData.title}» (${formatToman(expenseData.totalAmount)}) را ثبت کرد.`,
    });

    return {
      id: exp.id,
      roomId: exp.room_id,
      title: exp.title,
      totalAmount: Number(exp.total_amount),
      paidById: exp.paid_by_id,
      category: exp.category as ExpenseCategory,
      splits: expenseData.splits,
      createdAt: exp.created_at,
      notes: exp.notes,
      receiptUrl: exp.receipt_url || expenseData.receiptUrl,
    };
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  const newExpense: Expense = {
    id: `exp-${Date.now()}`,
    roomId,
    title: expenseData.title,
    totalAmount: expenseData.totalAmount,
    paidById: expenseData.paidById,
    category: expenseData.category,
    splits: expenseData.splits,
    createdAt: new Date().toISOString(),
    notes: expenseData.notes,
    receiptUrl: expenseData.receiptUrl,
  };

  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'expense_added',
    userId: expenseData.paidById,
    description: `${payerName} هزینه «${expenseData.title}» (${formatToman(expenseData.totalAmount)}) را ثبت کرد.`,
    timestamp: new Date().toISOString(),
  };

  bundle.expenses.unshift(newExpense);
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);

  return newExpense;
}

// ==============================================================================
// 6. Update Expense (Audit Trail Enforced)
// ==============================================================================
export async function updateExpenseApi(
  roomId: string,
  expenseId: string,
  oldExpense: Expense,
  updatedData: {
    title: string;
    totalAmount: number;
    paidById: string;
    category: ExpenseCategory;
    splits: { memberId: string; amount: number; percentage?: number }[];
    notes?: string;
    receiptUrl?: string;
  },
  actorName: string,
  actorId: string
): Promise<Expense> {
  let logDescription: string;
  if (oldExpense.totalAmount !== updatedData.totalAmount) {
    logDescription = `${actorName} هزینه «${updatedData.title}» را از ${formatToman(oldExpense.totalAmount)} به ${formatToman(updatedData.totalAmount)} تغییر داد.`;
  } else {
    logDescription = `${actorName} مشخصات و سهم‌های هزینه «${updatedData.title}» را ویرایش کرد.`;
  }

  if (isSupabaseConfigured && supabase) {
    const { error: expErr } = await supabase
      .from('expenses')
      .update({
        title: updatedData.title,
        total_amount: updatedData.totalAmount,
        paid_by_id: updatedData.paidById,
        category: updatedData.category,
        notes: updatedData.notes,
        receipt_url: updatedData.receiptUrl !== undefined ? (updatedData.receiptUrl || null) : (oldExpense.receiptUrl || null),
      })
      .eq('id', expenseId);

    if (expErr) throw new Error(`خطا در ویرایش هزینه: ${expErr.message}`);

    // Replace splits
    await supabase.from('splits').delete().eq('expense_id', expenseId);
    const splitsPayload = updatedData.splits.map((s) => ({
      expense_id: expenseId,
      member_id: s.memberId,
      amount: s.amount,
      percentage: s.percentage,
    }));
    await supabase.from('splits').insert(splitsPayload);

    // Audit log
    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: actorId,
      action_type: 'expense_updated',
      description: logDescription,
    });

    return {
      id: expenseId,
      roomId,
      title: updatedData.title,
      totalAmount: updatedData.totalAmount,
      paidById: updatedData.paidById,
      category: updatedData.category,
      splits: updatedData.splits,
      createdAt: oldExpense.createdAt,
      notes: updatedData.notes,
      receiptUrl: updatedData.receiptUrl !== undefined ? updatedData.receiptUrl : oldExpense.receiptUrl,
    };
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  const updatedExpense: Expense = {
    ...oldExpense,
    title: updatedData.title,
    totalAmount: updatedData.totalAmount,
    paidById: updatedData.paidById,
    category: updatedData.category,
    splits: updatedData.splits,
    notes: updatedData.notes,
    receiptUrl: updatedData.receiptUrl !== undefined ? updatedData.receiptUrl : oldExpense.receiptUrl,
  };

  bundle.expenses = bundle.expenses.map((e) => (e.id === expenseId ? updatedExpense : e));
  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'expense_updated',
    userId: actorId,
    description: logDescription,
    timestamp: new Date().toISOString(),
  };
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);

  return updatedExpense;
}

// ==============================================================================
// 6. Delete Expense (Audit Trail Enforced)
// ==============================================================================
export async function deleteExpenseApi(
  roomId: string,
  expenseId: string,
  expenseTitle: string,
  expenseAmount: number,
  actorName: string,
  actorId: string
): Promise<void> {
  const logDescription = `${actorName} هزینه «${expenseTitle}» (${formatToman(expenseAmount)}) را حذف کرد.`;

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) throw new Error(`خطا در حذف هزینه: ${error.message}`);

    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: actorId,
      action_type: 'expense_deleted',
      description: logDescription,
    });
    return;
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  bundle.expenses = bundle.expenses.filter((e) => e.id !== expenseId);
  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'expense_deleted',
    userId: actorId,
    description: logDescription,
    timestamp: new Date().toISOString(),
  };
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);
}

// ==============================================================================
// 7. Request Settlement (P2P)
// ==============================================================================
export async function requestSettlementApi(
  roomId: string,
  payerId: string,
  receiverId: string,
  amount: number,
  payerName: string,
  receiverName: string,
  notes?: string
): Promise<Settlement> {
  if (isSupabaseConfigured && supabase) {
    const { data: set, error: setErr } = await supabase
      .from('settlements')
      .insert({
        room_id: roomId,
        payer_id: payerId,
        receiver_id: receiverId,
        amount,
        status: 'pending',
        notes,
      })
      .select()
      .single();

    if (setErr || !set) throw new Error(`خطا در ثبت تسویه: ${setErr?.message}`);

    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: payerId,
      action_type: 'settlement_requested',
      description: `${payerName} درخواست تسویه ${formatToman(amount)} با ${receiverName} را ثبت کرد.`,
    });

    return {
      id: set.id,
      roomId: set.room_id,
      payerId: set.payer_id,
      receiverId: set.receiver_id,
      amount: Number(set.amount),
      status: set.status,
      createdAt: set.created_at,
      notes: set.notes,
    };
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  const newSettlement: Settlement = {
    id: `set-${Date.now()}`,
    roomId,
    payerId,
    receiverId,
    amount,
    status: 'pending',
    createdAt: new Date().toISOString(),
    notes,
  };

  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'settlement_requested',
    userId: payerId,
    description: `${payerName} درخواست تسویه ${formatToman(amount)} با ${receiverName} را ثبت کرد.`,
    timestamp: new Date().toISOString(),
  };

  bundle.settlements.unshift(newSettlement);
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);

  return newSettlement;
}

// ==============================================================================
// 8. Confirm Settlement (Rule 2)
// ==============================================================================
export async function confirmSettlementApi(
  roomId: string,
  settlementId: string,
  receiverId: string,
  receiverName: string,
  payerName: string,
  amount: number
): Promise<void> {
  const confirmedAt = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    const { error: updErr } = await supabase
      .from('settlements')
      .update({ status: 'confirmed', confirmed_at: confirmedAt })
      .eq('id', settlementId);

    if (updErr) throw new Error(`خطا در تأیید تسویه: ${updErr.message}`);

    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: receiverId,
      action_type: 'settlement_confirmed',
      description: `${receiverName} دریافت مبلغ ${formatToman(amount)} از ${payerName} را تأیید کرد.`,
    });
    return;
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  bundle.settlements = bundle.settlements.map((s) =>
    s.id === settlementId ? { ...s, status: 'confirmed', confirmedAt } : s
  );

  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'settlement_confirmed',
    userId: receiverId,
    description: `${receiverName} دریافت مبلغ ${formatToman(amount)} از ${payerName} را تأیید کرد.`,
    timestamp: confirmedAt,
  };
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);
}

// ==============================================================================
// 9. Reject Settlement
// ==============================================================================
export async function rejectSettlementApi(
  roomId: string,
  settlementId: string,
  receiverId: string,
  receiverName: string,
  payerName: string,
  amount: number
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error: updErr } = await supabase
      .from('settlements')
      .update({ status: 'rejected' })
      .eq('id', settlementId);

    if (updErr) throw new Error(`خطا در رد تسویه: ${updErr.message}`);

    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: receiverId,
      action_type: 'settlement_rejected',
      description: `${receiverName} درخواست تسویه ${formatToman(amount)} از سوی ${payerName} را رد کرد.`,
    });
    return;
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  bundle.settlements = bundle.settlements.map((s) =>
    s.id === settlementId ? { ...s, status: 'rejected' } : s
  );

  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'settlement_rejected',
    userId: receiverId,
    description: `${receiverName} درخواست تسویه ${formatToman(amount)} از سوی ${payerName} را رد کرد.`,
    timestamp: new Date().toISOString(),
  };
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);
}

// ==============================================================================
// 10. Admin: Update Room Name
// ==============================================================================
export async function updateRoomNameApi(
  roomId: string,
  newName: string,
  actorName: string,
  actorId: string
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('rooms').update({ name: newName }).eq('id', roomId);
    if (error) throw new Error(`خطا در ویرایش نام اتاق: ${error.message}`);

    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: actorId,
      action_type: 'room_updated',
      description: `${actorName} نام اتاق را به «${newName}» تغییر داد.`,
    });
    return;
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  bundle.room.name = newName;
  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'room_updated' as any,
    userId: actorId,
    description: `${actorName} نام اتاق را به «${newName}» تغییر داد.`,
    timestamp: new Date().toISOString(),
  };
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);
}

// ==============================================================================
// 11. Admin: Deactivate / Kick Member (Soft-Delete)
// ==============================================================================
export async function deactivateMemberApi(
  roomId: string,
  memberId: string,
  memberName: string,
  actorName: string,
  actorId: string
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('members').update({ is_active: false }).eq('id', memberId);
    if (error) throw new Error(`خطا در غیرفعال‌سازی کاربر: ${error.message}`);

    await supabase.from('activity_logs').insert({
      room_id: roomId,
      actor_id: actorId,
      action_type: 'member_left',
      description: `${actorName} هم‌اتاقی «${memberName}» را از اتاق خارج و بایگانی کرد.`,
    });
    return;
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  bundle.members = bundle.members.map((m) => (m.id === memberId ? { ...m, isActive: false } : m));
  const newLog: ActivityLog = {
    id: `act-${Date.now()}`,
    roomId,
    type: 'member_left',
    userId: actorId,
    description: `${actorName} هم‌اتاقی «${memberName}» را از اتاق خارج و بایگانی کرد.`,
    timestamp: new Date().toISOString(),
  };
  bundle.activityLogs.unshift(newLog);
  saveLocalFallbackState(bundle);
}

// ==============================================================================
// 12. Fetch User Rooms
// ==============================================================================
export async function fetchUserRooms(
  userId: string,
  userDisplayName?: string
): Promise<{ room: Room; member: Member }[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      // Step 1: Query members table for active memberships without ambiguous embedded joins
      const { data: directMembers, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (membersError) {
        console.warn('Error querying members by user_id:', membersError.message);
      }

      let membersData = directMembers;

      // Fallback: If no records match userId, try querying by displayName if provided
      if ((!membersData || membersData.length === 0) && userDisplayName) {
        const { data: nameMembersData } = await supabase
          .from('members')
          .select('*')
          .ilike('name', userDisplayName.trim())
          .eq('is_active', true)
          .order('joined_at', { ascending: false });

        if (nameMembersData && nameMembersData.length > 0) {
          membersData = nameMembersData;
          // Backfill user_id on unlinked member records
          const unlinkedIds = nameMembersData.filter((m: any) => !m.user_id).map((m: any) => m.id);
          if (unlinkedIds.length > 0) {
            await supabase.from('members').update({ user_id: userId }).in('id', unlinkedIds);
          }
        }
      }

      if (!membersData || membersData.length === 0) {
        return [];
      }

      // Step 2: Query rooms table for those room IDs
      const roomIds = Array.from(new Set(membersData.map((m: any) => m.room_id).filter(Boolean)));
      if (roomIds.length === 0) {
        return [];
      }

      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds);

      if (roomsError || !roomsData || roomsData.length === 0) {
        return [];
      }

      const roomsMap = new Map<string, any>(roomsData.map((r: any) => [r.id, r]));

      const result: { room: Room; member: Member }[] = [];
      for (const m of membersData) {
        const r = roomsMap.get(m.room_id);
        if (!r) continue;

        result.push({
          room: {
            id: r.id,
            name: r.name,
            inviteCode: r.invite_code,
            createdBy: r.created_by,
            createdAt: r.created_at,
            currency: r.currency,
            description: r.description,
          },
          member: {
            id: m.id,
            roomId: m.room_id,
            name: m.name,
            avatarUrl: m.avatar_url,
            color: m.color,
            isAdmin: Boolean(m.is_admin),
            isActive: Boolean(m.is_active),
            cardNumber: m.card_number,
            bankName: m.bank_name,
            userId: m.user_id || userId,
            joinedAt: m.joined_at,
          },
        });
      }

      return result;
    } catch (err) {
      console.warn('Error fetching user rooms from supabase:', err);
    }
    return [];
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  const matchedMember =
    bundle.members.find(
      (m) =>
        (m.userId && m.userId === userId) ||
        (userDisplayName && m.name.toLowerCase() === userDisplayName.toLowerCase())
    ) || bundle.members[0];

  if (matchedMember) {
    return [{ room: bundle.room, member: matchedMember }];
  }
  return [{ room: bundle.room, member: bundle.members[0] }];
}

// ==============================================================================
// 12. User Bank Card Management (PostgreSQL bank_cards / Local Fallback)
// ==============================================================================

function getLocalFallbackCards(userId: string): BankCard[] {
  const key = `dongato_cards_${userId}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }
  return [];
}

function saveLocalFallbackCards(userId: string, cards: BankCard[]): void {
  const key = `dongato_cards_${userId}`;
  localStorage.setItem(key, JSON.stringify(cards));
}

/**
 * Fetches all bank cards belonging to a user
 */
export async function fetchUserBankCards(userId: string): Promise<BankCard[]> {
  if (!userId) return [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('bank_cards')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        bankName: row.bank_name,
        cardNumber: row.card_number,
        shabaNumber: row.shaba_number || undefined,
        cardHolderName: row.card_holder_name,
        isDefault: Boolean(row.is_default),
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.warn('[Bank Cards] Failed to fetch cards from Supabase, checking fallback:', err);
    }
  }

  return getLocalFallbackCards(userId);
}

/**
 * Adds a new bank card for a user
 */
export async function addBankCard(
  card: Omit<BankCard, 'id' | 'createdAt'>
): Promise<BankCard> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('bank_cards')
        .insert({
          user_id: card.userId,
          bank_name: card.bankName,
          card_number: card.cardNumber,
          shaba_number: card.shabaNumber || null,
          card_holder_name: card.cardHolderName,
          is_default: Boolean(card.isDefault),
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        bankName: data.bank_name,
        cardNumber: data.card_number,
        shabaNumber: data.shaba_number || undefined,
        cardHolderName: data.card_holder_name,
        isDefault: Boolean(data.is_default),
        createdAt: data.created_at,
      };
    } catch (err) {
      console.warn('[Bank Cards] Failed to insert card in Supabase, falling back to local storage:', err);
    }
  }

  // Local fallback
  const cards = getLocalFallbackCards(card.userId);
  const isFirstCard = cards.length === 0;
  const isDefault = isFirstCard || Boolean(card.isDefault);

  if (isDefault) {
    cards.forEach((c) => {
      c.isDefault = false;
    });
  }

  const newCard: BankCard = {
    ...card,
    id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    isDefault,
    createdAt: new Date().toISOString(),
  };

  cards.unshift(newCard);
  saveLocalFallbackCards(card.userId, cards);
  return newCard;
}

/**
 * Updates an existing bank card
 */
export async function updateBankCard(
  id: string,
  card: Partial<BankCard>,
  userId?: string
): Promise<BankCard> {
  if (isSupabaseConfigured && supabase) {
    try {
      const updatePayload: Record<string, unknown> = {};
      if (card.bankName !== undefined) updatePayload.bank_name = card.bankName;
      if (card.cardNumber !== undefined) updatePayload.card_number = card.cardNumber;
      if (card.shabaNumber !== undefined) updatePayload.shaba_number = card.shabaNumber || null;
      if (card.cardHolderName !== undefined) updatePayload.card_holder_name = card.cardHolderName;
      if (card.isDefault !== undefined) updatePayload.is_default = card.isDefault;

      const { data, error } = await supabase
        .from('bank_cards')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        bankName: data.bank_name,
        cardNumber: data.card_number,
        shabaNumber: data.shaba_number || undefined,
        cardHolderName: data.card_holder_name,
        isDefault: Boolean(data.is_default),
        createdAt: data.created_at,
      };
    } catch (err) {
      console.warn('[Bank Cards] Failed to update card in Supabase, falling back to local storage:', err);
    }
  }

  // Local fallback
  const effectiveUserId = userId || card.userId || '';
  const cards = getLocalFallbackCards(effectiveUserId);
  const targetIndex = cards.findIndex((c) => c.id === id);

  if (targetIndex >= 0) {
    if (card.isDefault) {
      cards.forEach((c) => {
        c.isDefault = false;
      });
    }
    cards[targetIndex] = {
      ...cards[targetIndex],
      ...card,
    };
    saveLocalFallbackCards(effectiveUserId, cards);
    return cards[targetIndex];
  }

  throw new Error('کارت بانکی مورد نظر یافت نشد.');
}

/**
 * Deletes a bank card
 */
export async function deleteBankCard(id: string, userId?: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('bank_cards').delete().eq('id', id);
      if (error) throw error;
      return;
    } catch (err) {
      console.warn('[Bank Cards] Failed to delete card in Supabase, falling back to local storage:', err);
    }
  }

  // Local fallback
  if (userId) {
    const cards = getLocalFallbackCards(userId).filter((c) => c.id !== id);
    if (cards.length > 0 && !cards.some((c) => c.isDefault)) {
      cards[0].isDefault = true;
    }
    saveLocalFallbackCards(userId, cards);
  }
}

/**
 * Sets a specific bank card as the user's default card
 */
export async function setDefaultBankCard(id: string, userId?: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      // Call dedicated RPC
      const { error: rpcError } = await supabase.rpc('set_default_bank_card', {
        p_card_id: id,
        p_user_id: userId || null,
      });

      if (!rpcError) return;

      // Fallback query if RPC isn't loaded
      if (userId) {
        await supabase.from('bank_cards').update({ is_default: false }).eq('user_id', userId);
      }
      await supabase.from('bank_cards').update({ is_default: true }).eq('id', id);
      return;
    } catch (err) {
      console.warn('[Bank Cards] Failed to set default card in Supabase:', err);
    }
  }

  // Local fallback
  if (userId) {
    const cards = getLocalFallbackCards(userId);
    cards.forEach((c) => {
      c.isDefault = c.id === id;
    });
    saveLocalFallbackCards(userId, cards);
  }
}

/**
 * Fetches simplified room debts via RPC get_simplified_debts,
 * falling back to local computation if RPC is unavailable.
 */
export async function getSimplifiedDebtsApi(roomId: string): Promise<SimplifiedDebt[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_simplified_debts', {
        p_room_id: roomId,
      });

      if (!error && Array.isArray(data)) {
        interface RpcSimplifiedDebtRow {
          debtor_id: string;
          debtor_name: string;
          creditor_id: string;
          creditor_name: string;
          amount: number | string;
        }
        return (data as RpcSimplifiedDebtRow[]).map((d) => ({
          debtorId: d.debtor_id,
          debtorName: d.debtor_name,
          creditorId: d.creditor_id,
          creditorName: d.creditor_name,
          amount: Number(d.amount),
        }));
      }
    } catch (err) {
      console.warn('[API] get_simplified_debts RPC error, using local fallback:', err);
    }
  }

  // Local fallback
  const bundle = getLocalFallbackState();
  return computeSimplifiedDebts(bundle.members, bundle.expenses, bundle.settlements);
}



