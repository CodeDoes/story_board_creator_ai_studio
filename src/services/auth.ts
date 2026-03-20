/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const STORAGE_KEY = 'gemini_api_key';

export const getApiKey = (): string | null => {
  // Priority 1: User-provided key in localStorage
  const storedKey = localStorage.getItem(STORAGE_KEY);
  if (storedKey) return storedKey;

  // Priority 2: Platform-injected key from Settings -> Secrets
  return process.env.GEMINI_API_KEY || process.env.API_KEY || null;
};

export const setApiKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEY, key);
};

export const clearApiKey = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const hasApiKey = (): boolean => {
  return !!getApiKey();
};
