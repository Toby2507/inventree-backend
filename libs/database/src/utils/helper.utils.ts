export const isUniqueViolation = (error: unknown, constraint?: string): boolean => {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as Record<string, unknown>).code !== '23505'
  ) {
    return false;
  }
  if (!constraint) return true;
  return 'constraint' in error && (error as Record<string, unknown>).constraint === constraint;
};
