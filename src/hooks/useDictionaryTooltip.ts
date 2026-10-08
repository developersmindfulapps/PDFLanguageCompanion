import { useState, useCallback, useEffect, useRef } from 'react';
import type { WordSelection } from '../types/selection.ts';
import type { DictionaryResult } from '../types/dictionary.ts';
import { localDictionaryProvider } from '../services/dictionary/index.ts';

export function useDictionaryTooltip() {
  const [activeSelection, setActiveSelection] = useState<WordSelection | null>(null);
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const lookupIdRef = useRef<number>(0);

  const handleWordSelected = useCallback(async (selection: WordSelection | null) => {
    setActiveSelection(selection);

    if (!selection) {
      setDictionaryResult(null);
      setIsLoading(false);
      return;
    }

    const currentId = ++lookupIdRef.current;
    setIsLoading(true);

    try {
      const result = await localDictionaryProvider.lookup(selection.word, 'de', 'en');
      // Prevent stale async response race conditions
      if (lookupIdRef.current === currentId) {
        setDictionaryResult(result);
      }
    } catch (err) {
      if (lookupIdRef.current === currentId) {
        console.error('Dictionary lookup error:', err);
        setDictionaryResult(null);
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
    handleWordSelected,
    closeTooltip,
  };
}
