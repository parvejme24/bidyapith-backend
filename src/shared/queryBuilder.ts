type QueryBuilderInput = {
  search?: string | undefined;
  searchFields: readonly string[];
  filters?: Record<string, string | number | boolean | undefined>;
  extra?: object[];
};

export const buildWhere = ({
  search,
  searchFields,
  filters = {},
  extra = [],
}: QueryBuilderInput): Record<string, unknown> => {
  const AND: object[] = [{ deletedAt: null }];

  const trimmed = search?.trim();
  if (trimmed !== undefined && trimmed.length > 0 && searchFields.length > 0) {
    AND.push({
      OR: searchFields.map((field) => ({
        [field]: { contains: trimmed, mode: 'insensitive' },
      })),
    });
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      AND.push({ [key]: value });
    }
  }

  for (const clause of extra) {
    AND.push(clause);
  }

  return { AND };
};
