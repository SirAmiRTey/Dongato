export type ExpenseCategory =
  | 'food'
  | 'groceries'
  | 'cleaning'
  | 'utilities'
  | 'entertainment'
  | 'transport'
  | 'other';

export interface Room {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string; // admin member ID
  createdAt: string;
  currency: string;
  description?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface BankCard {
  id: string;
  userId: string;
  bankName: string;
  cardNumber: string; // 16 digits
  shabaNumber?: string; // Optional IBAN starting with IR
  cardHolderName: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface UpdateProfileParams {
  userId?: string;
  displayName: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}


export interface Member {
  id: string;
  roomId: string;
  name: string;
  avatarUrl?: string;
  color?: string;
  isAdmin: boolean;
  isActive: boolean; // Soft-delete rule: inactive members retain past history
  joinedAt: string;
  cardNumber?: string;
  bankName?: string;
  userId?: string; // Foreign key / link to auth user ID
}

export interface Split {
  memberId: string;
  amount: number;
  percentage?: number;
  isFixed?: boolean;
}

export interface Expense {
  id: string;
  roomId: string;
  title: string;
  totalAmount: number;
  paidById: string;
  category: ExpenseCategory;
  splits: Split[];
  createdAt: string;
  notes?: string;
  receiptUrl?: string;
}

export type SettlementStatus = 'pending' | 'confirmed' | 'rejected';

export interface Settlement {
  id: string;
  roomId: string;
  payerId: string;
  receiverId: string;
  amount: number;
  status: SettlementStatus;
  createdAt: string;
  confirmedAt?: string;
  notes?: string;
}

export type ActivityType =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_requested'
  | 'settlement_confirmed'
  | 'settlement_rejected'
  | 'member_joined'
  | 'member_left'
  | 'room_updated';

export interface ActivityLog {
  id: string;
  roomId: string;
  type: ActivityType;
  userId: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PairwiseBalance {
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  memberColor?: string;
  memberIsActive: boolean;
  cardNumber?: string;
  bankName?: string;
  amount: number; // > 0: member owes current user, < 0: current user owes member, 0: settled
  status: 'owes_you' | 'you_owe' | 'settled';
}

export interface UserBalanceSummary {
  totalLent: number;  // طلب کل (مجموع مبالغی که دیگران به کاربر بدهکارند)
  totalOwed: number;  // بدهی کل (مجموع مبالغی که کاربر به دیگران بدهکار است)
  netBalance: number; // تراز کلی (طلب کل منهای بدهی کل)
}

export interface SimplifiedDebt {
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
}

