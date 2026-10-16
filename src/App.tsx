import React, { useState, useCallback } from 'react';
import type { PDFDocumentProxy, PDFDocumentInfo, ZoomState, PDFLoadError } from './types/pdf';
import { pdfService } from './services/pdfService';
import { useDictionaryTooltip } from './hooks/useDictionaryTooltip';
import { useOCR } from './hooks/useOCR';
import { DictionaryTooltip } from './components/DictionaryTooltip/DictionaryTooltip';
import { Navbar } from './components/Navbar';
import { FilePicker } from './components/FilePicker';
import { PDFViewer } from './components/PDFViewer';
import { PDFControls } from './components/PDFControls';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';
import { AboutModal } from './components/AboutModal';

export const App: React.FC = () => {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [docInfo, setDocInfo] = useState<PDFDocumentInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1.0, mode: 'custom' });
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(false);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);
  const [error, setError] = useState<PDFLoadError | null>(null);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);

  const {
    currentOCRResult,
    isProcessing: isOCRProcessing,
    progress: ocrProgress,
    error: ocrError,
    runOCR,
    cancelOCR,
    clearCache: clearOCRCache,
  } = useOCR({ currentPage });

  const {
    activeSelection,
    dictionaryResult,
    isLoading: isDictionaryLoading,
    error: dictionaryError,
    handleWordSelected,
    closeTooltip,
  } = useDictionaryTooltip();

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoadingDoc(true);
    setError(null);
    setLastSelectedFile(file);
    closeTooltip();
    await clearOCRCache();

    try {
      const loadedDoc = await pdfService.loadDocument(file);
      setDoc(loadedDoc);
      setDocInfo({
        fileName: file.name,
        numPages: loadedDoc.numPages,
        fileSize: file.size,
      });
      setCurrentPage(1);
      setZoom({ scale: 1.0, mode: 'custom' });
    } catch (err) {
      console.error('Document load error:', err);
      setDoc(null);
      setDocInfo(null);
      setError({
        title: 'Unable to open PDF',
        message:
          err instanceof Error
            ? err.message
            : 'The selected file could not be read. Please make sure it is a valid PDF.',
      });
    } finally {
      setIsLoadingDoc(false);
    }
  }, [closeTooltip, clearOCRCache]);

  const handleReset = useCallback(async () => {
    await clearOCRCache();
    await pdfService.cleanupCurrentDocument();
    setDoc(null);
    setDocInfo(null);
    setError(null);
    setLastSelectedFile(null);
    closeTooltip();
    setCurrentPage(1);
  }, [closeTooltip, clearOCRCache]);

  const handleRetry = useCallback(() => {
    if (lastSelectedFile) {
      handleFileSelect(lastSelectedFile);
    }
  }, [lastSelectedFile, handleFileSelect]);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    closeTooltip();
  }, [closeTooltip]);

  const handleZoomChange = useCallback((newZoom: ZoomState) => {
    setZoom(newZoom);
    closeTooltip();
  }, [closeTooltip]);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden font-sans">
      <Navbar
        documentInfo={docInfo}
        onOpenNewFile={handleReset}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {isLoadingDoc ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner message="Loading PDF document..." size="lg" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <ErrorMessage
              title={error.title}
              message={error.message}
              onRetry={lastSelectedFile ? handleRetry : undefined}
              onReset={handleReset}
            />
          </div>
        ) : !doc ? (
          <FilePicker onFileSelect={handleFileSelect} />
        ) : (
          <>
            <PDFViewer
              doc={doc}
              currentPage={currentPage}
              zoom={zoom}
              ocrResult={currentOCRResult}
              isOCRProcessing={isOCRProcessing}
              ocrProgress={ocrProgress?.progress}
              ocrStatusText={ocrProgress?.status}
              ocrError={ocrError}
              onRunOCR={(canvas) => runOCR(canvas, currentPage)}
              onCancelOCR={cancelOCR}
              onPageChange={handlePageChange}
              onZoomChange={handleZoomChange}
              onLoadingStateChange={setIsLoadingPage}
              onWordSelected={handleWordSelected}
            />
            <PDFControls
              currentPage={currentPage}
              numPages={doc.numPages}
              zoom={zoom}
              onPageChange={handlePageChange}
              onZoomChange={handleZoomChange}
              isLoadingPage={isLoadingPage}
            />

            {/* Phase 7 Floating Dictionary Tooltip */}
            <DictionaryTooltip
              wordSelection={activeSelection}
              result={dictionaryResult}
              isLoading={isDictionaryLoading}
              error={dictionaryError}
              onClose={closeTooltip}
            />
          </>
        )}
      </main>

      {/* Pre-release About & Licenses Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
};
