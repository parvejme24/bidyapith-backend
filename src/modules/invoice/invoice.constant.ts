export const INVOICE_WRITE_CHUNK = 500;

export const INVOICE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'dueDate',
  'totalAmount',
  'paidAmount',
  'invoiceNumber',
  'status',
] as const;

export const MANUAL_INVOICE_TYPES = ['EXAM_FEE', 'LATE_FEE', 'LAB_FEE'] as const;

export const INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  studentId: true,
  semesterId: true,
  type: true,
  status: true,
  totalAmount: true,
  paidAmount: true,
  currency: true,
  dueDate: true,
  paidAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;
