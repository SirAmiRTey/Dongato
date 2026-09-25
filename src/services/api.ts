import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Room,
  Member,
  Expense,
  Settlement,
  ActivityLog,
  ExpenseCategory,
} from '../types';
import {
  initialRoom,
  initialMembers,
  initialExpenses,
  initialSettlements,
  initialActivityLogs,
} from '../data/mockData';
import { formatToman } from '../lib/calculations';

export const STORAGE_KEYS = {
  ROOM_ID: 'dongato_active_room_id',
  MEMBER_ID: 'dongato_active_member_id',
} as const;

/**
 * Generates a unique 6-character alphanumeric invite code (e.g. DNG-784)
 */
export function generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 3; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DNG-${rand}`;
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
        user_id: userId || null,
      })
      .select()
      .single();

    if (memberError || !memberData) {
      throw new Error(`خطا در ثبت کاربر مدیر: ${memberError?.message || 'مشکل سرور'}`);
    }

    // C. Update rooms.created_by
    await supabase.from('rooms').update({ created_by: memberData.id }).eq('id', roomData.id);

    // D. Log activity
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
      userId: memberData.user_id || userId,
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
    userId,
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

  if (isSupabaseConfigured && supabase) {
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('invite_code', normalizedCode)
      .single();

    if (roomError || !roomData) {
      throw new Error('کد دعوت وارد شده یافت نشد یا معتبر نیست.');
    }

    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .insert({
        room_id: roomData.id,
        name: memberName,
        is_admin: false,
        is_active: true,
        color: 'from-emerald-500 to-teal-600',
        user_id: userId || null,
      })
      .select()
      .single();

    if (memberError || !memberData) {
      throw new Error(`خطا در ورود به اتاق: ${memberError?.message}`);
    }

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
      userId: memberData.user_id || userId,
      joinedAt: memberData.joined_at,
    };

    return { room, member };
  }

  // Fallback Mock State
  const bundle = getLocalFallbackState();
  if (bundle.room.inviteCode !== normalizedCode) {
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
    userId,
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
      // 1. Try querying by user_id
      const { data, error } = await supabase
        .from('members')
        .select('*, rooms(*)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data
          .filter((m: any) => m.rooms)
          .map((m: any) => ({
            room: {
              id: m.rooms.id,
              name: m.rooms.name,
              inviteCode: m.rooms.invite_code,
              createdBy: m.rooms.created_by,
              createdAt: m.rooms.created_at,
              currency: m.rooms.currency,
              description: m.rooms.description,
            },
            member: {
              id: m.id,
              roomId: m.room_id,
              name: m.name,
              avatarUrl: m.avatar_url,
              color: m.color,
              isAdmin: m.is_admin,
              isActive: m.is_active,
              cardNumber: m.card_number,
              bankName: m.bank_name,
              userId: m.user_id || userId,
              joinedAt: m.joined_at,
            },
          }));
      }

      // 2. Fallback by displayName if user_id was not yet attached to earlier records
      if (userDisplayName) {
        const { data: nameData } = await supabase
          .from('members')
          .select('*, rooms(*)')
          .ilike('name', userDisplayName.trim())
          .order('joined_at', { ascending: false });

        if (nameData && nameData.length > 0) {
          return nameData
            .filter((m: any) => m.rooms)
            .map((m: any) => ({
              room: {
                id: m.rooms.id,
                name: m.rooms.name,
                inviteCode: m.rooms.invite_code,
                createdBy: m.rooms.created_by,
                createdAt: m.rooms.created_at,
                currency: m.rooms.currency,
                description: m.rooms.description,
              },
              member: {
                id: m.id,
                roomId: m.room_id,
                name: m.name,
                avatarUrl: m.avatar_url,
                color: m.color,
                isAdmin: m.is_admin,
                isActive: m.is_active,
                cardNumber: m.card_number,
                bankName: m.bank_name,
                userId: m.user_id || userId,
                joinedAt: m.joined_at,
              },
            }));
        }
      }
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

