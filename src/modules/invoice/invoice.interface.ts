import type { InvoiceStatus, InvoiceType } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';

export type IInvoiceCreate = {
  studentId: string;
  semesterId: string;
  type: InvoiceType;
  totalAmount: string;
  dueDate: string;
  notes?: string | undefined;
};

export type IInvoiceGenerate = {
  semesterId: string;
};

export type IInvoiceWaive = {
  reason: string;
};

export type IInvoiceListQuery = PaginationQuery & {
  status?: InvoiceStatus | undefined;
  semesterId?: string | undefined;
  studentId?: string | undefined;
  type?: InvoiceType | undefined;
  search?: string | undefined;
};

export type IMyInvoiceQuery = PaginationQuery & {
  status?: InvoiceStatus | undefined;
  semesterId?: string | undefined;
};
