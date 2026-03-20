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
        err?.message?.includes("UNAVAILABLE") ||
        err?.message?.includes("fetch failed") ||
        err?.message?.includes("NetworkError") ||
        err?.message?.includes("Failed to fetch");

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

export const withTimeout = async <T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  errorMessage: string = "Operation timed out"
): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export async function* streamWithTimeout<T>(
  stream: AsyncIterable<T>, 
  timeoutMs: number, 
  errorMessage: string = "Stream timed out"
): AsyncGenerator<T> {
  const iterator = stream[Symbol.asyncIterator]();
  while (true) {
    let timeoutId: any;
    const timeoutPromise = new Promise<IteratorResult<T>>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    
    try {
      const result = await Promise.race([iterator.next(), timeoutPromise]);
      clearTimeout(timeoutId);
      if (result.done) break;
      yield result.value;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}
