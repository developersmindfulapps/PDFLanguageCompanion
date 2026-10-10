import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import type { ZoomState } from '../types/pdf';

interface PDFControlsProps {
  currentPage: number;
  numPages: number;
  zoom: ZoomState;
  onPageChange: (newPage: number) => void;
  onZoomChange: (newZoom: ZoomState) => void;
  isLoadingPage: boolean;
}

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const PDFControls: React.FC<PDFControlsProps> = ({
  currentPage,
  numPages,
  zoom,
  onPageChange,
  onZoomChange,
  isLoadingPage,
}) => {
  const [pageInput, setPageInput] = useState<string>(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
      onPageChange(pageNum);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handlePageBlur = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
      if (pageNum !== currentPage) {
        onPageChange(pageNum);
      }
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleZoomIn = () => {
    const currentScale = zoom.scale;
    const nextScale = ZOOM_PRESETS.find((s) => s > currentScale + 0.05) ?? Math.min(3.0, currentScale + 0.25);
    onZoomChange({ scale: nextScale, mode: 'custom' });
  };

  const handleZoomOut = () => {
    const currentScale = zoom.scale;
    const prevScales = ZOOM_PRESETS.filter((s) => s < currentScale - 0.05);
    const prevScale = prevScales.length > 0 ? prevScales[prevScales.length - 1] : Math.max(0.25, currentScale - 0.25);
    onZoomChange({ scale: prevScale, mode: 'custom' });
  };

  const handleToggleFitWidth = () => {
    if (zoom.mode === 'fit-width') {
      // Exit Fit Width mode -> Reset to exactly 100%
      onZoomChange({ scale: 1.0, mode: 'custom' });
    } else {
      // Enter Fit Width mode
      onZoomChange({ scale: zoom.scale, mode: 'fit-width' });
    }
  };

  return (
    <div className="h-12 border-t border-slate-200 bg-white px-4 flex items-center justify-between select-none shrink-0 shadow-xs z-10">
      {/* Page Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoadingPage}
          className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <form onSubmit={handlePageSubmit} className="flex items-center gap-1.5 text-xs text-slate-700">
          <span className="font-medium hidden sm:inline">Page</span>
          <input
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageBlur}
            disabled={isLoadingPage}
            className="w-12 px-1.5 py-1 text-center font-semibold border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-xs"
          />
          <span className="text-slate-400">/</span>
          <span className="font-medium text-slate-600">{numPages}</span>
        </form>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= numPages || isLoadingPage}
          className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title="Next Page (Right Arrow)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom & Layout Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={handleZoomOut}
          disabled={zoom.scale <= 0.3}
          className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-xs font-semibold text-slate-700 min-w-[3.5rem] text-center">
          {Math.round(zoom.scale * 100)}%
        </span>

        <button
          onClick={handleZoomIn}
          disabled={zoom.scale >= 3.0}
          className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

        <button
          onClick={handleToggleFitWidth}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            zoom.mode === 'fit-width'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              : 'text-slate-700 hover:bg-slate-100 border border-transparent'
          }`}
          title={zoom.mode === 'fit-width' ? 'Reset zoom to 100%' : 'Fit to Width'}
        >
          {zoom.mode === 'fit-width' ? (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fit Width</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
