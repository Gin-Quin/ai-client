/**
 * Helper function to handle errors consistently across all AI clients
 * @param error - The error to handle, can be of any type
 * @returns A proper Error instance
 */
export function handleError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
