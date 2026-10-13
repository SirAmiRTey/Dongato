import type { Member, Expense, Settlement, PairwiseBalance, UserBalanceSummary, Split, SimplifiedDebt } from '../types';

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
 * Bulletproof numeric helper that parses English, Persian, and Arabic numerals into an integer.
 */
export function parseNumericInput(raw: string): number {
  if (!raw) return 0;
  // Convert Persian (۰-۹) and Arabic (٠-٩) digits to standard ASCII (0-9)
  const ascii = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[^0-9]/g, '');
  return parseInt(ascii, 10) || 0;
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
 * Computes net balance for each member in a room:
 * (Total Paid + Confirmed Settlements Paid) - (Total Share + Confirmed Settlements Received)
 * Positive balance = Creditor (owed money)
 * Negative balance = Debtor (owes money)
 */
export function computeMemberNetBalances(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[]
): Map<string, number> {
  const netBalances = new Map<string, number>();
  for (const m of members) {
    netBalances.set(m.id, 0);
  }

  // 1. Process expenses: payer is credited (+totalAmount), each split member is debited (-split.amount)
  for (const expense of expenses) {
    const currentPayerBal = netBalances.get(expense.paidById) ?? 0;
    netBalances.set(expense.paidById, currentPayerBal + expense.totalAmount);

    for (const split of expense.splits) {
      const currentSplitBal = netBalances.get(split.memberId) ?? 0;
      netBalances.set(split.memberId, currentSplitBal - split.amount);
    }
  }

  // 2. Process confirmed settlements: payer gets +amount, receiver gets -amount
  for (const settlement of settlements) {
    if (settlement.status !== 'confirmed') {
      continue;
    }

    const currentPayerBal = netBalances.get(settlement.payerId) ?? 0;
    netBalances.set(settlement.payerId, currentPayerBal + settlement.amount);

    const currentRecvBal = netBalances.get(settlement.receiverId) ?? 0;
    netBalances.set(settlement.receiverId, currentRecvBal - settlement.amount);
  }

  return netBalances;
}

/**
 * Computes strictly bilateral (pairwise) net debts for all distinct pairs in the room.
 * For each pair of members (User A, User B), calculates the direct net difference between them.
 * Debts are NEVER shifted, pooled, or transferred across other room members.
 */
export function computeBilateralDebts(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[]
): SimplifiedDebt[] {
  const bilateralDebts: SimplifiedDebt[] = [];

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const m1 = members[i];
      const m2 = members[j];

      let m1PaidForM2 = 0;
      let m2PaidForM1 = 0;

      for (const expense of expenses) {
        if (expense.paidById === m1.id) {
          const split = expense.splits.find((s) => s.memberId === m2.id);
          if (split) m1PaidForM2 += split.amount;
        } else if (expense.paidById === m2.id) {
          const split = expense.splits.find((s) => s.memberId === m1.id);
          if (split) m2PaidForM1 += split.amount;
        }
      }

      let m1SettledToM2 = 0;
      let m2SettledToM1 = 0;

      for (const settlement of settlements) {
        if (settlement.status !== 'confirmed') continue;
        if (settlement.payerId === m1.id && settlement.receiverId === m2.id) {
          m1SettledToM2 += settlement.amount;
        } else if (settlement.payerId === m2.id && settlement.receiverId === m1.id) {
          m2SettledToM1 += settlement.amount;
        }
      }

      const net = Math.round((m1PaidForM2 + m1SettledToM2) - (m2PaidForM1 + m2SettledToM1));

      if (net > 0) {
        // m2 owes m1
        bilateralDebts.push({
          debtorId: m2.id,
          debtorName: m2.name,
          creditorId: m1.id,
          creditorName: m1.name,
          amount: net,
        });
      } else if (net < 0) {
        // m1 owes m2
        bilateralDebts.push({
          debtorId: m1.id,
          debtorName: m1.name,
          creditorId: m2.id,
          creditorName: m2.name,
          amount: Math.abs(net),
        });
      }
    }
  }

  return bilateralDebts;
}

// Compatibility export
export const computeSimplifiedDebts = computeBilateralDebts;

/**
 * Computes strictly bilateral (pairwise) net balances between current user and all other room members.
 * 
 * Bilateral Netting Invariants:
 * 1. Strict Direct Pairwise Netting: Only expenses and confirmed settlements directly between
 *    User A and User B are factored in. Debts are NEVER pooled, merged, or transferred across other room members.
 * 2. If User A owes User B 208k, and User B owes User A 100k, the output must strictly be a single net debt:
 *    User A owes User B 108k (amount: -108000, status: 'you_owe').
 * 3. Only confirmed settlements affect balance.
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
    let currentPaidForMember = 0;
    let memberPaidForCurrent = 0;

    // 1. Process direct expenses between current user and this member
    for (const expense of expenses) {
      if (expense.paidById === currentUserId) {
        const split = expense.splits.find((s) => s.memberId === member.id);
        if (split) {
          currentPaidForMember += split.amount;
        }
      } else if (expense.paidById === member.id) {
        const split = expense.splits.find((s) => s.memberId === currentUserId);
        if (split) {
          memberPaidForCurrent += split.amount;
        }
      }
    }

    // 2. Process direct confirmed settlements between current user and this member
    let currentSettledToMember = 0;
    let memberSettledToCurrent = 0;

    for (const settlement of settlements) {
      if (settlement.status !== 'confirmed') {
        continue;
      }

      if (settlement.payerId === currentUserId && settlement.receiverId === member.id) {
        currentSettledToMember += settlement.amount;
      } else if (settlement.payerId === member.id && settlement.receiverId === currentUserId) {
        memberSettledToCurrent += settlement.amount;
      }
    }

    // Net bilateral balance between current user and this member:
    // > 0: Member owes current user
    // < 0: Current user owes member
    // = 0: Settled
    const netBalance = Math.round(
      (currentPaidForMember + currentSettledToMember) - (memberPaidForCurrent + memberSettledToCurrent)
    );

    let status: 'owes_you' | 'you_owe' | 'settled' = 'settled';
    if (netBalance > 0) {
      status = 'owes_you';
    } else if (netBalance < 0) {
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
      amount: netBalance,
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
