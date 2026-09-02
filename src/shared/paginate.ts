import { StatusCodes } from 'http-status-codes';
import { ApiError } from './ApiError';
import { PAGINATION } from '../constants/pagination';

export type PaginationQuery = {
  page?: string | number | undefined;
  limit?: string | number | undefined;
  sortBy?: string | undefined;
  sortOrder?: string | undefined;
};

export type PaginateResult = {
  page: number;
  limit: number;
  skip: number;
  take: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  orderBy: Record<string, 'asc' | 'desc'>;
};

const toPositiveInt = (value: string | number | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
};

export const paginate = (query: PaginationQuery, allowedSortFields: readonly string[]): PaginateResult => {
  const page = toPositiveInt(query.page, PAGINATION.DEFAULT_PAGE);
  const requestedLimit = toPositiveInt(query.limit, PAGINATION.DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, PAGINATION.MAX_LIMIT);

  const sortBy =
    query.sortBy !== undefined && query.sortBy.length > 0 ? query.sortBy : PAGINATION.DEFAULT_SORT_BY;

  if (!allowedSortFields.includes(sortBy)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `sortBy must be one of: ${allowedSortFields.join(', ')}`,
    );
  }

  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : PAGINATION.DEFAULT_SORT_ORDER;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    sortBy,
    sortOrder,
    orderBy: { [sortBy]: sortOrder },
  };
};

export const paginationMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPage: total === 0 ? 0 : Math.ceil(total / limit),
});
