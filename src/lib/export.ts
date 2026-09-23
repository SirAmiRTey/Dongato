import type { Expense, Settlement, Member, ExpenseCategory } from '../types';

const CATEGORY_NAMES: Record<ExpenseCategory, string> = {
  groceries: 'سوپرمارکت',
  food: 'غذا و رستوران',
  cleaning: 'نظافت و بهداشت',
  utilities: 'اینترنت و قبوض',
  entertainment: 'تفریح و بازی',
  transport: 'رفت‌وآمد',
  other: 'متفرقه',
};

const SETTLEMENT_STATUS_NAMES: Record<string, string> = {
  pending: 'در انتظار تأیید',
  confirmed: 'تأیید شده',
  rejected: 'رد شده',
};

/**
 * Escapes a cell value for standard CSV format.
 * Quotes strings containing commas, quotes, or newlines.
 */
function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const stringValue = String(value);
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Triggers a client-side file download for CSV with UTF-8 BOM.
 */
function triggerCsvDownload(csvString: string, filename: string): void {
  // Prepend \uFEFF BOM for correct Persian / UTF-8 rendering in MS Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats ISO date into human-readable Persian/Gregorian date.
 */
function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Exports room expenses list to a structured CSV file.
 * Filename: expenses-export.csv
 */
export function exportExpensesToCSV(
  expenses: Expense[],
  members: Member[],
  roomName: string = 'dongato'
): void {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const headers = [
    'تاریخ ثبت',
    'عنوان هزینه',
    'دسته‌بندی',
    'پرداخت‌کننده',
    'مبلغ کل (تومان)',
    'تعداد افراد سهیم',
    'تفکیک سهم‌ها',
    'یادداشت',
    'لینک فاکتور/رسید',
  ];

  const rows = expenses.map((expense) => {
    const payerName = memberMap.get(expense.paidById) || 'نامشخص';
    const categoryName = CATEGORY_NAMES[expense.category] || expense.category;

    // Build breakdown summary: "علی: ۵۰,۰۰۰ | رضا: ۵۰,۰۰۰"
    const splitSummary = expense.splits
      .map((s) => {
        const name = memberMap.get(s.memberId) || 'عضو';
        const formattedShare = new Intl.NumberFormat('fa-IR').format(s.amount);
        return `${name}: ${formattedShare} تومان`;
      })
      .join(' | ');

    return [
      escapeCsvCell(formatDate(expense.createdAt)),
      escapeCsvCell(expense.title),
      escapeCsvCell(categoryName),
      escapeCsvCell(payerName),
      escapeCsvCell(expense.totalAmount),
      escapeCsvCell(expense.splits.length),
      escapeCsvCell(splitSummary),
      escapeCsvCell(expense.notes || ''),
      escapeCsvCell(expense.receiptUrl || ''),
    ].join(',');
  });

  const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const sanitizedRoom = roomName.trim().replace(/[^a-zA-Z0-9آ-ی]/g, '_');
  const filename = `expenses-export-${sanitizedRoom || 'dongato'}.csv`;

  triggerCsvDownload(csvContent, filename);
}

/**
 * Exports room settlements history to a structured CSV file.
 * Filename: settlements-export.csv
 */
export function exportSettlementsToCSV(
  settlements: Settlement[],
  members: Member[],
  roomName: string = 'dongato'
): void {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const headers = [
    'تاریخ ثبت درخواست',
    'پرداخت‌کننده (بدهکار)',
    'دریافت‌کننده (طلبکار)',
    'مبلغ تسویه (تومان)',
    'وضعیت تسویه',
    'تاریخ تأیید نهایی',
    'توضیحات و شماره پیگیری',
  ];

  const rows = settlements.map((settlement) => {
    const payerName = memberMap.get(settlement.payerId) || 'نامشخص';
    const receiverName = memberMap.get(settlement.receiverId) || 'نامشخص';
    const statusText = SETTLEMENT_STATUS_NAMES[settlement.status] || settlement.status;
    const confirmedDate = settlement.confirmedAt ? formatDate(settlement.confirmedAt) : '-';

    return [
      escapeCsvCell(formatDate(settlement.createdAt)),
      escapeCsvCell(payerName),
      escapeCsvCell(receiverName),
      escapeCsvCell(settlement.amount),
      escapeCsvCell(statusText),
      escapeCsvCell(confirmedDate),
      escapeCsvCell(settlement.notes || ''),
    ].join(',');
  });

  const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const sanitizedRoom = roomName.trim().replace(/[^a-zA-Z0-9آ-ی]/g, '_');
  const filename = `settlements-export-${sanitizedRoom || 'dongato'}.csv`;

  triggerCsvDownload(csvContent, filename);
}
