// =============================================
// File Upload Component
// =============================================

import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Sparkles, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';
import { parseExcelFile } from '../services/excelParser';

export default function FileUpload() {
  const {
    language, setRawBuffer, setSheetNames, setParsedData,
    parseOptions, setIsProcessing, setParseError, setActiveView,
    setFileName, isProcessing, parseError, setValidationAccepted,
  } = useApp();
  const t = translations[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setParseError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      setRawBuffer(buffer);

      const opts = parseOptions!;
      const { data, sheetNames } = parseExcelFile(buffer, opts);
      setSheetNames(sheetNames);
      setParsedData(data);
      setValidationAccepted(false);
      setActiveView('validation');
    } catch (err) {
      console.error(err);
      setParseError(t.errorParsingDesc);
    } finally {
      setIsProcessing(false);
    }
  }, [parseOptions, setRawBuffer, setSheetNames, setParsedData, setIsProcessing,
      setParseError, setActiveView, setFileName, setValidationAccepted, t]);

  const handleLoadSample = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    setParseError(null);
    setFileName('sample_students.xlsx');

    try {
      const response = await fetch('/sample_students.xlsx');
      if (!response.ok) throw new Error('Failed to fetch sample file');
      const buffer = await response.arrayBuffer();
      setRawBuffer(buffer);

      const opts = parseOptions!;
      const { data, sheetNames } = parseExcelFile(buffer, opts);
      setSheetNames(sheetNames);
      setParsedData(data);
      setValidationAccepted(false);
      setActiveView('validation');
    } catch (err) {
      console.error(err);
      setParseError(t.errorParsingDesc);
    } finally {
      setIsProcessing(false);
    }
  }, [parseOptions, setRawBuffer, setSheetNames, setParsedData, setIsProcessing,
      setParseError, setActiveView, setFileName, setValidationAccepted, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-3 sm:px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-50 mb-3 sm:mb-4 shadow-sm border border-blue-100">
            <FileSpreadsheet className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">{t.uploadTitle}</h2>
          <p className="text-slate-500 text-xs sm:text-sm">{t.uploadFormats}</p>
        </div>

        {/* Drop zone */}
        <div
          className={`dropzone cursor-pointer ${dragOver ? 'drag-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleChange}
            id="file-upload"
          />
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="spinner w-8 h-8 sm:w-10 sm:h-10 border-4" />
              <p className="text-blue-600 font-semibold text-sm sm:text-base">{t.processing}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 text-center">
              <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400" />
              <p className="text-base sm:text-lg font-semibold text-slate-600">{t.uploadDesc}</p>
              <p className="text-xs sm:text-sm text-slate-400">{t.uploadFormats}</p>
              <button className="btn btn-primary mt-2 min-h-[42px] px-5 text-sm" type="button">
                <Upload className="w-4 h-4" />
                {t.uploadFile}
              </button>
            </div>
          )}
        </div>

        {/* Demo / Sample Options */}
        <div className="mt-5 sm:mt-6 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-center sm:text-start">
            <p className="text-sm font-medium text-slate-700">{t.orTryDemo}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'ar'
                ? '28 طالباً • 5 مراحل • كشف شامل لبيانات ومواد التحميل'
                : '28 students • 5 stages • Comprehensive carryover roster data'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={isProcessing}
              className="btn btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1.5 border-blue-200 text-blue-700 bg-white hover:bg-blue-50 min-h-[40px]"
            >
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>{t.loadSampleData}</span>
            </button>
            <a
              href="/sample_students.xlsx"
              download="sample_students.xlsx"
              onClick={e => e.stopPropagation()}
              className="btn btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1.5 bg-white text-slate-600 hover:bg-slate-100 min-h-[40px]"
            >
              <Download className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t.downloadSample}</span>
            </a>
          </div>
        </div>

        {/* Error */}
        {parseError && (
          <div className="alert alert-error mt-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">{t.errorParsing}</p>
              <p className="text-sm mt-0.5">{parseError}</p>
            </div>
          </div>
        )}

        {/* Privacy notice */}
        <div className="alert alert-info mt-6 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{t.privacyNotice}</p>
        </div>
      </div>
    </div>
  );
}

