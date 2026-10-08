import React, { useState, useRef } from 'react';
import { FileUp, FileText, AlertCircle } from 'lucide-react';

interface FilePickerProps {
  onFileSelect: (file: File) => void;
}

export const FilePicker: React.FC<FilePickerProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setErrorMessage(null);
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Please select a valid PDF file (.pdf)');
      return;
    }
    onFileSelect(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelect(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-100">
      <div className="w-full max-w-xl">
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`relative cursor-pointer flex flex-col items-center justify-center p-10 sm:p-14 border-2 border-dashed rounded-2xl transition-all duration-200 bg-white ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01] shadow-md'
              : 'border-slate-300 hover:border-slate-400 hover:shadow-sm'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 transition-transform group-hover:scale-105">
            {isDragging ? (
              <FileUp className="w-8 h-8 animate-bounce text-indigo-600" />
            ) : (
              <FileText className="w-8 h-8 text-indigo-600" />
            )}
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">
            PDF Language Companion
          </h2>
          <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
            Open a PDF to get started reading with instant lookups
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileSelect();
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <FileUp className="w-4 h-4" />
              Choose PDF
            </button>
            <span className="text-xs font-medium text-slate-400">or Drag &amp; Drop here</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
