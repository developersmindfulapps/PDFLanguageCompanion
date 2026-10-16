import { useState, useCallback, useEffect, useRef } from 'react';
import type { WordSelection } from '../types/selection.ts';
import type { DictionaryResult } from '../types/dictionary.ts';
import { localDictionaryProvider } from '../services/dictionary/index.ts';

export function useDictionaryTooltip() {
  const [activeSelection, setActiveSelection] = useState<WordSelection | null>(null);
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const lookupIdRef = useRef<number>(0);

  // Proactive background preload on mount (non-blocking, completely offline)
  useEffect(() => {
    localDictionaryProvider.ensureInitialized().catch((err) => {
      // Non-fatal background preload failure — lookup() will retry on demand
      console.warn('Background dictionary preload deferred:', err);
    });
  }, []);

  const handleWordSelected = useCallback(async (selection: WordSelection | null) => {
    setActiveSelection(selection);

    if (!selection) {
      setDictionaryResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const currentId = ++lookupIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await localDictionaryProvider.lookup(selection.word, 'de', 'en');
      // Prevent stale async response race conditions
      if (lookupIdRef.current === currentId) {
        setDictionaryResult(result);
        setError(null);
      }
    } catch (err) {
      if (lookupIdRef.current === currentId) {
        console.error('Dictionary lookup error:', err);
        setDictionaryResult(null);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (lookupIdRef.current === currentId) {
        setIsLoading(false);
      }
    }
  }, []);

  const closeTooltip = useCallback(() => {
    lookupIdRef.current++;
    setActiveSelection(null);
    setDictionaryResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // Dismiss tooltip during browser window resize to avoid stale coordinates
  useEffect(() => {
    const handleResize = () => {
      if (activeSelection) {
        closeTooltip();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSelection, closeTooltip]);

  return {
    activeSelection,
    dictionaryResult,
    isLoading,
    error,
    handleWordSelected,
    closeTooltip,
  };
}
