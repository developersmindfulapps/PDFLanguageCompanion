import React from 'react';
import { BookOpen, FolderOpen, Info } from 'lucide-react';
import type { PDFDocumentInfo } from '../types/pdf';

interface NavbarProps {
  documentInfo: PDFDocumentInfo | null;
  onOpenNewFile: () => void;
  onOpenAbout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  documentInfo,
  onOpenNewFile,
  onOpenAbout,
}) => {
  return (
    <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between select-none shrink-0 z-10 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-bold text-slate-800 leading-tight">
            PDF Language Companion
          </h1>
          <span className="text-xs text-slate-500 font-medium">
            Reader
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {documentInfo && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md max-w-xs truncate">
            <span className="font-medium truncate">{documentInfo.fileName}</span>
            <span className="text-slate-400">|</span>
            <span className="shrink-0">{documentInfo.numPages} {documentInfo.numPages === 1 ? 'page' : 'pages'}</span>
          </div>
        )}

        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-md transition-colors"
            title="About & Licenses"
            aria-label="About PDF Language Companion and Licenses"
          >
            <Info className="w-4 h-4 text-slate-600" />
            <span className="hidden xs:inline">About</span>
          </button>
        )}

        <button
          onClick={onOpenNewFile}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-md transition-colors"
          title="Open a new PDF"
        >
          <FolderOpen className="w-4 h-4 text-slate-600" />
          <span>Open PDF</span>
        </button>
      </div>
    </header>
  );
};
