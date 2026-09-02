export const pick = <T extends object, const K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.hasOwn(obj, key) && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};
