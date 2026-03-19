import { GoogleGenAI } from "@google/genai";

export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Check if it's a 503 or 429 error
      const isRetryable = 
        err?.message?.includes("503") || 
        err?.message?.includes("429") || 
        err?.message?.includes("Deadline expired") ||
        err?.message?.includes("UNAVAILABLE");

      if (isRetryable && i < retries - 1) {
        console.warn(`API call failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};
