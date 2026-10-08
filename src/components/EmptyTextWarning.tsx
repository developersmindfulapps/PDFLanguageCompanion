import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface EmptyTextWarningProps {
  className?: string;
}

export const EmptyTextWarning: React.FC<EmptyTextWarningProps> = ({ className = '' }) => {
  return (
    <div
      role="alert"
      className={`flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg shadow-xs text-xs font-medium ${className}`}
    >
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
      <span>This PDF does not contain selectable text. Scanned PDFs are not supported yet.</span>
    </div>
  );
};
