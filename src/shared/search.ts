import { prisma } from './prisma';

const escapeIlike = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/** Uses `users_search_trgm_idx` — Prisma `contains` ILIKE cannot. */
export const findUserIdsByNameEmail = async (term: string): Promise<string[]> => {
  const trimmed = term.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const pattern = `%${escapeIlike(trimmed)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE deleted_at IS NULL
      AND (first_name || ' ' || last_name || ' ' || email) ILIKE ${pattern} ESCAPE '\\'
  `;

  return rows.map((row) => row.id);
};
