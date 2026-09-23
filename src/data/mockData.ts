import type { Room, Member, Expense, Settlement, ActivityLog } from '../types';

export const initialRoom: Room = {
  id: 'room-1',
  name: 'خوابگاه چمران - اتاق ۲۰۴',
  inviteCode: 'CHAMRAN-204',
  createdBy: 'm1',
  createdAt: '2026-08-15T10:00:00Z',
  currency: 'تومان',
  description: 'مدیریت هزینه‌ها و دنگ‌های هم‌اتاقی‌های اتاق ۲۰۴',
};

export const initialMembers: Member[] = [
  {
    id: 'm1',
    roomId: 'room-1',
    name: 'علی رضایی',
    isAdmin: true,
    isActive: true,
    color: 'from-blue-500 to-indigo-600',
    joinedAt: '2026-08-15T10:00:00Z',
    cardNumber: '۶۰۳۷-۹۹۷۵-۱۲۳۴-۵۶۷۸',
    bankName: 'بانک ملی',
  },
  {
    id: 'm2',
    roomId: 'room-1',
    name: 'سجاد محمدی',
    isAdmin: false,
    isActive: true,
    color: 'from-emerald-500 to-teal-600',
    joinedAt: '2026-08-15T10:00:00Z',
    cardNumber: '۵۰۲۲-۲۹۱۰-۸۸۷۷-۶۶۵۵',
    bankName: 'بانک پاسارگاد',
  },
  {
    id: 'm3',
    roomId: 'room-1',
    name: 'محمد کمالی',
    isAdmin: false,
    isActive: true,
    color: 'from-amber-500 to-orange-600',
    joinedAt: '2026-08-16T12:00:00Z',
    cardNumber: '۶۱۰۴-۳۳۷۸-۹۰۱۲-۳۴۵۶',
    bankName: 'بانک ملت',
  },
  {
    id: 'm4',
    roomId: 'room-1',
    name: 'رضا صادقی',
    isAdmin: false,
    isActive: true,
    color: 'from-purple-500 to-pink-600',
    joinedAt: '2026-08-20T09:30:00Z',
    cardNumber: '۵۸۹۲-۱۰۱۲-۴۵۶۷-۸۹۰۱',
    bankName: 'بانک سپه',
  },
  {
    id: 'm5',
    roomId: 'room-1',
    name: 'مهدی طاهری (سابق)',
    isAdmin: false,
    isActive: false, // Soft-deleted member example
    color: 'from-slate-600 to-slate-700',
    joinedAt: '2026-08-01T10:00:00Z',
    cardNumber: '۶۲۷۳-۸۱۱۱-۲۲۳۳-۴۴۵۵',
    bankName: 'بانک مسکن',
  },
];

export const initialExpenses: Expense[] = [
  {
    id: 'exp-1',
    roomId: 'room-1',
    title: 'خرید برنج و روغن و حبوبات از هایپر',
    totalAmount: 480000,
    paidById: 'm1', // Ali
    category: 'groceries',
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    notes: 'خرید عمده مواد غذایی برای دو هفته',
    splits: [
      { memberId: 'm1', amount: 120000, percentage: 25 },
      { memberId: 'm2', amount: 120000, percentage: 25 },
      { memberId: 'm3', amount: 120000, percentage: 25 },
      { memberId: 'm4', amount: 120000, percentage: 25 },
    ],
  },
  {
    id: 'exp-2',
    roomId: 'room-1',
    title: 'پیتزا و ساندویچ بعد از امتحان میان‌ترم',
    totalAmount: 960000,
    paidById: 'm2', // Sajjad
    category: 'food',
    createdAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    notes: 'رضا خوابگاه نبود، بین ۳ نفر تقسیم شد',
    splits: [
      { memberId: 'm1', amount: 320000, percentage: 33.3 },
      { memberId: 'm2', amount: 320000, percentage: 33.3 },
      { memberId: 'm3', amount: 320000, percentage: 33.3 },
    ],
  },
  {
    id: 'exp-3',
    roomId: 'room-1',
    title: 'مایع ظرفشویی، جرم‌گیر و کیسه زباله',
    totalAmount: 160000,
    paidById: 'm3', // Mohammad
    category: 'cleaning',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    notes: 'نظافت هفتگی اتاق',
    splits: [
      { memberId: 'm1', amount: 40000, percentage: 25 },
      { memberId: 'm2', amount: 40000, percentage: 25 },
      { memberId: 'm3', amount: 40000, percentage: 25 },
      { memberId: 'm4', amount: 40000, percentage: 25 },
    ],
  },
  {
    id: 'exp-4',
    roomId: 'room-1',
    title: 'تمدید اشتراک اینترنت مودم اتاق',
    totalAmount: 240000,
    paidById: 'm4', // Reza
    category: 'utilities',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    notes: 'بسته نامحدود یک ماهه',
    splits: [
      { memberId: 'm1', amount: 60000, percentage: 25 },
      { memberId: 'm2', amount: 60000, percentage: 25 },
      { memberId: 'm3', amount: 60000, percentage: 25 },
      { memberId: 'm4', amount: 60000, percentage: 25 },
    ],
  },
  {
    id: 'exp-5',
    roomId: 'room-1',
    title: 'خرید میوه فصل و آبمیوه',
    totalAmount: 180000,
    paidById: 'm1', // Ali
    category: 'food',
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    notes: 'خرید دونفره با رضا',
    splits: [
      { memberId: 'm1', amount: 90000, percentage: 50 },
      { memberId: 'm4', amount: 90000, percentage: 50 },
    ],
  },
];

export const initialSettlements: Settlement[] = [
  {
    id: 'set-1',
    roomId: 'room-1',
    payerId: 'm2', // Sajjad
    receiverId: 'm1', // Ali
    amount: 150000,
    status: 'confirmed',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    confirmedAt: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
    notes: 'کارت به کارت به علی',
  },
  {
    id: 'set-2',
    roomId: 'room-1',
    payerId: 'm4', // Reza
    receiverId: 'm1', // Ali
    amount: 80000,
    status: 'pending',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
    notes: 'بابت هزینه برنج و میوه، کارت به کارت کردم داداش',
  },
];

export const initialActivityLogs: ActivityLog[] = [
  {
    id: 'act-1',
    roomId: 'room-1',
    type: 'settlement_requested',
    userId: 'm4',
    description: 'رضا صادقی درخواست تسویه ۸۰,۰۰۰ تومان با علی رضایی ثبت کرد.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-2',
    roomId: 'room-1',
    type: 'expense_added',
    userId: 'm1',
    description: 'علی رضایی هزینه «خرید میوه فصل و آبمیوه» (۱۸۰,۰۰۰ تومان) را ثبت کرد.',
    timestamp: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'act-3',
    roomId: 'room-1',
    type: 'expense_added',
    userId: 'm4',
    description: 'رضا صادقی هزینه «تمدید اشتراک اینترنت مودم اتاق» (۲۴۰,۰۰۰ تومان) را ثبت کرد.',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: 'act-4',
    roomId: 'room-1',
    type: 'expense_added',
    userId: 'm3',
    description: 'محمد کمالی هزینه «مایع ظرفشویی، جرم‌گیر و کیسه زباله» (۱۶۰,۰۰۰ تومان) را ثبت کرد.',
    timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: 'act-5',
    roomId: 'room-1',
    type: 'settlement_confirmed',
    userId: 'm1',
    description: 'علی رضایی دریافت مبلغ ۱۵۰,۰۰۰ تومان از سجاد محمدی را تأیید کرد.',
    timestamp: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
  },
];
