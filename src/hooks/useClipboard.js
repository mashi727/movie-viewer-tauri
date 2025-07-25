// src/hooks/useClipboard.js
import { readText, writeText } from '@tauri-apps/api/clipboard';
import { useCallback } from 'react';

export function useClipboard() {
  const read = useCallback(async () => {
    try {
      return await readText();
    } catch (e) {
      console.error('Clipboard read failed:', e);
      return '';
    }
  }, []);

  const write = useCallback(async (text) => {
    try {
      await writeText(text);
    } catch (e) {
      console.error('Clipboard write failed:', e);
    }
  }, []);

  return { read, write };
}
