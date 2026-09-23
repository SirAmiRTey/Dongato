import type { Member, Expense, Settlement, PairwiseBalance, UserBalanceSummary, Split } from '../types';

/**
 * Converts English digits to Persian numerals
 */
export function toPersianDigits(input: string | number): string {
  if (input === null || input === undefined) return '';
  const str = input.toString();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (char) => persianDigits[parseInt(char, 10)]);
}

/**
 * Formats a numeric amount with thousands separator and Persian digits
 */
export function formatAmount(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('en-US').format(Math.abs(rounded));
  return toPersianDigits(formatted);
}

/**
 * Formats currency in Toman with Persian digits
 */
export function formatToman(amount: number, includeCurrency = true): string {
  const formatted = formatAmount(amount);
  return includeCurrency ? `${formatted} تومان` : formatted;
}

/**
 * Formats relative time in natural Persian
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'همین الان';
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${toPersianDigits(diffInMinutes)} دقیقه پیش`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${toPersianDigits(diffInHours)} ساعت پیش`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return 'دیروز';
  }
  if (diffInDays < 7) {
    return `${toPersianDigits(diffInDays)} روز پیش`;
  }
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${toPersianDigits(diffInWeeks)} هفته پیش`;
  }
  
  // Format as readable localized Persian date
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return `${toPersianDigits(diffInDays)} روز پیش`;
  }
}

/**
 * Computes direct bilateral pairwise balances between a given user and all other members.
 * 
 * Business Rules:
 * 1. Strict Direct P2P: No graph debt simplification.
 * 2. Only confirmed settlements affect balance. Pending settlements do not.
 * 
 * @param currentUserId - The user whose perspective we are calculating from
 * @param members - All room members
 * @param expenses - All room expenses
 * @param settlements - All room settlements
 */
export function computePairwiseBalances(
  currentUserId: string,
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[]
): PairwiseBalance[] {
  // Exclude current user from pairwise list
  const otherMembers = members.filter((m) => m.id !== currentUserId);

  return otherMembers.map((member) => {
    let balance = 0;

    // 1. Process all expenses
    for (const expense of expenses) {
      // Case A: Current user paid for the expense
      if (expense.paidById === currentUserId) {
        const splitForMember = expense.splits.find((s) => s.memberId === member.id);
        if (splitForMember) {
          // Member owes current user their split amount
          balance += splitForMember.amount;
        }
      }
      // Case B: This other member paid for the expense
      else if (expense.paidById === member.id) {
        const splitForCurrentUser = expense.splits.find((s) => s.memberId === currentUserId);
        if (splitForCurrentUser) {
          // Current user owes this member their split amount
          balance -= splitForCurrentUser.amount;
        }
      }
    }

    // 2. Process confirmed settlements only
    for (const settlement of settlements) {
      if (settlement.status !== 'confirmed') {
        continue;
      }

      // Case A: Current user paid this member (settling debt owed to member)
      if (settlement.payerId === currentUserId && settlement.receiverId === member.id) {
        balance += settlement.amount;
      }
      // Case B: Member paid current user (settling debt owed to current user)
      else if (settlement.payerId === member.id && settlement.receiverId === currentUserId) {
        balance -= settlement.amount;
      }
    }

    // Round to avoid float precision issues
    const roundedBalance = Math.round(balance);

    let status: 'owes_you' | 'you_owe' | 'settled' = 'settled';
    if (roundedBalance > 0) {
      status = 'owes_you';
    } else if (roundedBalance < 0) {
      status = 'you_owe';
    }

    return {
      memberId: member.id,
      memberName: member.name,
      memberAvatar: member.avatarUrl,
      memberColor: member.color,
      memberIsActive: member.isActive,
      cardNumber: member.cardNumber,
      bankName: member.bankName,
      amount: roundedBalance,
      status,
    };
  });
}

/**
 * Computes high-level balance overview (Total lent, Total owed, Net balance)
 * for a user based on their pairwise balances.
 */
export function computeUserSummary(pairwiseBalances: PairwiseBalance[]): UserBalanceSummary {
  let totalLent = 0;
  let totalOwed = 0;

  for (const pb of pairwiseBalances) {
    if (pb.amount > 0) {
      totalLent += pb.amount;
    } else if (pb.amount < 0) {
      totalOwed += Math.abs(pb.amount);
    }
  }

  return {
    totalLent,
    totalOwed,
    netBalance: totalLent - totalOwed,
  };
}

/**
 * Splits an expense equally among selected members, ensuring the exact total
 * is matched without loss due to rounding.
 */
export function calculateSplitShares(
  totalAmount: number,
  selectedMemberIds: string[]
): Split[] {
  if (!selectedMemberIds.length || totalAmount <= 0) {
    return [];
  }

  const count = selectedMemberIds.length;
  const baseShare = Math.floor(totalAmount / count);
  let remainder = totalAmount - baseShare * count;

  return selectedMemberIds.map((memberId) => {
    // Distribute the 1-toman remainder across the first few members
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;

    const amount = baseShare + extra;
    const percentage = Number(((amount / totalAmount) * 100).toFixed(1));

    return {
      memberId,
      amount,
      percentage,
    };
  });
}
