import React, { useEffect, useRef } from 'react';
import { Info, X, ExternalLink, BookOpen, Layers, ShieldCheck } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Manage focus and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Focus close button on mount
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }

        // Focus trap inside modal
        if (e.key === 'Tab' && backdropRef.current) {
          const focusableElements = backdropRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements.length === 0) return;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown, true);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      aria-describedby="about-modal-description"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 font-sans select-text">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 id="about-modal-title" className="text-sm font-bold text-slate-800 leading-tight">
                About PDF Language Companion
              </h2>
              <span id="about-modal-description" className="text-xs text-slate-500 font-medium">
                Version 0.1.0 &bull; Pre-Release Audit
              </span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors"
            aria-label="Close dialog"
            title="Close (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-600 leading-relaxed">
          {/* Overview */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Offline &amp; Privacy-First Reader</span>
            </div>
            <p className="text-slate-600">
              PDF Language Companion operates entirely locally inside your browser. All PDF rendering,
              optical character recognition (OCR), text tokenization, and word translation lookups
              execute offline with zero external network requests, third-party APIs, or telemetry.
            </p>
          </div>

          {/* Dictionary Data & Attribution */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>German&ndash;English Dictionary Data</span>
            </div>
            <p>
              The bundled German&ndash;English lexical dataset is derived from lexical entries contributed
              by the English Wiktionary community, extracted via the Kaikki.org / Wiktextract project
              developed by Tatu Ylonen.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] font-medium text-indigo-600">
              <a
                href="https://en.wiktionary.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <span>English Wiktionary</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <a
                href="https://kaikki.org/dictionary/German/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <span>Kaikki.org German Extract</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5">
              Detailed source metadata, snapshot timestamps, transformation records, and data licensing
              terms are documented in the packaged <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">LICENSE_DICTIONARY.txt</code> file.
            </p>
          </div>

          {/* Bundled Third-Party Components */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
              <Layers className="w-4 h-4 text-slate-700" />
              <span>Bundled Third-Party Components</span>
            </div>
            <p>
              This extension incorporates open-source libraries and binary assets for offline operation:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-600">
              <li><strong className="text-slate-700">Mozilla PDF.js</strong> (v4.10.38) &mdash; Apache-2.0</li>
              <li><strong className="text-slate-700">Tesseract.js &amp; Core</strong> (v7.0.0) &mdash; Apache-2.0</li>
              <li><strong className="text-slate-700">Tesseract German Traineddata</strong> (v1.0.0) &mdash; Apache-2.0 / MIT</li>
              <li><strong className="text-slate-700">Adobe CMap Resources</strong> &mdash; 3-Clause BSD Adobe License</li>
              <li><strong className="text-slate-700">Liberation &amp; Foxit Standard Fonts</strong> &mdash; SIL OFL 1.1 / 3-Clause BSD</li>
            </ul>
            <p className="text-[11px] text-slate-500 pt-0.5">
              Full copyright notices and license texts for all bundled third-party assets are documented
              in <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">THIRD_PARTY_LICENSES.txt</code>.
            </p>
          </div>

          {/* Licensing Status Placeholder */}
          <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-1">
            <span className="font-semibold text-slate-700 text-xs block">Licensing Notice</span>
            <p>
              This application is in pre-release audit. Complete licensing terms and notices are packaged
              with the distribution and remain subject to final pre-release review.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-md transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
