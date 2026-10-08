import React from 'react';
import { AlertTriangle, Loader2, Sparkles, X, RotateCcw } from 'lucide-react';

export interface EmptyTextWarningProps {
  className?: string;
  isProcessing?: boolean;
  progress?: number; // 0.0 to 1.0
  statusText?: string;
  errorMessage?: string | null;
  onRunOCR?: () => void;
  onCancelOCR?: () => void;
  onRetryOCR?: () => void;
}

export const EmptyTextWarning: React.FC<EmptyTextWarningProps> = ({
  className = '',
  isProcessing = false,
  progress = 0,
  statusText,
  errorMessage,
  onRunOCR,
  onCancelOCR,
  onRetryOCR,
}) => {
  const percent = Math.round((progress || 0) * 100);

  // 1. Processing / Recognizing State
  if (isProcessing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg shadow-xs text-xs font-medium ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
          <span className="truncate">
            {statusText || 'Recognizing text...'} {percent > 0 ? `(${percent}%)` : ''}
          </span>
        </div>
        {onCancelOCR && (
          <button
            type="button"
            onClick={onCancelOCR}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-100/60 text-indigo-700 border border-indigo-300 rounded text-xs font-semibold cursor-pointer transition-colors shrink-0 shadow-2xs"
            aria-label="Cancel OCR"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        )}
      </div>
    );
  }

  // 2. Error State
  if (errorMessage) {
    return (
      <div
        role="alert"
        className={`flex items-center justify-between gap-3 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg shadow-xs text-xs font-medium ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="truncate">OCR failed: {errorMessage}</span>
        </div>
        {onRetryOCR && (
          <button
            type="button"
            onClick={onRetryOCR}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-rose-100/60 text-rose-700 border border-rose-300 rounded text-xs font-semibold cursor-pointer transition-colors shrink-0 shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry OCR</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Idle / Scanned Warning State
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg shadow-xs text-xs font-medium ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="truncate">This page appears to be scanned.</span>
      </div>
      {onRunOCR && (
        <button
          type="button"
          onClick={onRunOCR}
          className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-md text-xs cursor-pointer transition-colors shrink-0 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Run OCR</span>
        </button>
      )}
    </div>
  );
};
