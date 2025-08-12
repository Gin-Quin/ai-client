// Helper function to handle errors consistently
export function handleError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
