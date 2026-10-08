import React, { useMemo, useEffect } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import type { WordSelection } from '../../types/selection';
import type { DictionaryResult } from '../../types/dictionary';

interface DictionaryTooltipProps {
  wordSelection: WordSelection | null;
  result: DictionaryResult | null;
  onClose: () => void;
}

export const DictionaryTooltip: React.FC<DictionaryTooltipProps> = ({
  wordSelection,
  result,
  onClose,
}) => {
  // Virtual element based on the selected word's DOM bounding rect
  const virtualElement = useMemo(() => {
    if (!wordSelection?.rect) return null;
    return {
      getBoundingClientRect: () => wordSelection.rect,
    };
  }, [wordSelection]);

  const { refs, floatingStyles, context } = useFloating({
    open: Boolean(wordSelection),
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
    placement: 'top',
    middleware: [
      offset(8),
      flip({
        fallbackPlacements: ['bottom', 'top-start', 'bottom-start', 'right', 'left'],
        padding: 12,
      }),
      shift({ padding: 12 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (virtualElement) {
      refs.setReference(virtualElement);
    }
  }, [virtualElement, refs]);

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });

  const role = useRole(context, { role: 'tooltip' });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!wordSelection) {
    return null;
  }

  const queryWord = wordSelection.word;
  const hasLemma = Boolean(result?.lemma && result.lemma.toLowerCase() !== queryWord.toLowerCase());

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        className="z-50 max-w-xs sm:max-w-sm min-w-[180px] bg-white rounded-xl shadow-xl border border-slate-200/90 p-3.5 text-slate-800 animate-in fade-in zoom-in-95 duration-150 select-text font-sans"
        role="tooltip"
        aria-live="polite"
      >
        {/* Header: Query Word, Optional Lemma & Part of Speech Badge */}
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex flex-col">
            <span className="font-bold text-base text-slate-900 leading-tight">
              {queryWord}
            </span>
            {hasLemma && result?.lemma && (
              <span className="text-xs text-slate-500 font-medium mt-0.5">
                Base: <span className="font-semibold text-slate-700">{result.lemma}</span>
              </span>
            )}
          </div>

          {result?.partOfSpeech && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shrink-0">
              {result.partOfSpeech}
            </span>
          )}
        </div>

        {/* Body: Translation list or Not Found state */}
        <div className="pt-2">
          {result && result.translations.length > 0 ? (
            <div className="space-y-1">
              {result.translations.length === 1 ? (
                <p className="text-sm font-semibold text-slate-800 leading-snug">
                  {result.translations[0]}
                </p>
              ) : (
                <ul className="space-y-1">
                  {result.translations.map((translation, idx) => (
                    <li
                      key={idx}
                      className="text-xs sm:text-sm font-medium text-slate-700 flex items-start gap-1.5 leading-snug"
                    >
                      <span className="text-slate-400 text-xs mt-0.5 shrink-0">{idx + 1}.</span>
                      <span>{translation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="py-0.5">
              <p className="text-xs font-semibold text-slate-500 mb-0.5">Word not found</p>
              <p className="text-xs text-slate-400 italic">
                No local translation available for &ldquo;{queryWord}&rdquo;.
              </p>
            </div>
          )}
        </div>
      </div>
    </FloatingPortal>
  );
};
