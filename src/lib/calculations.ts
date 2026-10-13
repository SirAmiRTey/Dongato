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
 * Generates simplified settlement transactions using greedy minimum-cash-flow algorithm.
 * Matches largest debtors with largest creditors so that mutual debts are reduced to net difference.
 */
export function computeSimplifiedDebts(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[]
): SimplifiedDebt[] {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const netBalances = computeMemberNetBalances(members, expenses, settlements);

  // Group into debtors (< 0) and creditors (> 0)
  const debtors: { memberId: string; amount: number }[] = [];
  const creditors: { memberId: string; amount: number }[] = [];

  for (const [memberId, balance] of netBalances.entries()) {
    const rounded = Math.round(balance);
    if (rounded < 0) {
      debtors.push({ memberId, amount: Math.abs(rounded) });
    } else if (rounded > 0) {
      creditors.push({ memberId, amount: rounded });
    }
  }

  // Sort descending by magnitude for optimal greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const simplified: SimplifiedDebt[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (debtor.amount <= 0) {
      dIdx++;
      continue;
    }
    if (creditor.amount <= 0) {
      cIdx++;
      continue;
    }

    const settleAmount = Math.min(debtor.amount, creditor.amount);
    if (settleAmount > 0) {
      const dMember = memberMap.get(debtor.memberId);
      const cMember = memberMap.get(creditor.memberId);

      simplified.push({
        debtorId: debtor.memberId,
        debtorName: dMember?.name || 'هم‌اتاقی',
        creditorId: creditor.memberId,
        creditorName: cMember?.name || 'هم‌اتاقی',
        amount: settleAmount,
      });

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount === 0) dIdx++;
      if (creditor.amount === 0) cIdx++;
    } else {
      break;
    }
  }

  return simplified;
}

/**
 * Computes optimized pairwise balances for a user in the room.
 * Resolves bidirectional debts so that if User 1 owes User 2 and User 2 owes User 1,
 * only the net difference is shown.
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
  const simplifiedDebts = computeSimplifiedDebts(members, expenses, settlements);

  return otherMembers.map((member) => {
    // Check if current user owes this member (simplified)
    const youOwe = simplifiedDebts.find(
      (d) => d.debtorId === currentUserId && d.creditorId === member.id
    );

    // Check if this member owes current user (simplified)
    const owesYou = simplifiedDebts.find(
      (d) => d.debtorId === member.id && d.creditorId === currentUserId
    );

    let amount = 0;
    let status: 'owes_you' | 'you_owe' | 'settled' = 'settled';

    if (owesYou && owesYou.amount > 0) {
      amount = owesYou.amount;
      status = 'owes_you';
    } else if (youOwe && youOwe.amount > 0) {
      amount = -youOwe.amount;
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
      amount,
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
