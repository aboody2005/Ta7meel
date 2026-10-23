// =============================================
// Column Mapping Modal - Customizable Column Configuration
// =============================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Eye, RotateCcw, CheckCircle2, AlertTriangle, ChevronDown, Columns,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildColumnMappingFromFields } from '../context/AppContext';
import { getColumnPreview, colIndexToLetter, parseExcelFile } from '../services/excelParser';
import type { ColumnFieldConfig, ColumnFieldKey } from '../types';
import { DEFAULT_FIELD_NAMES } from '../types';

// ------- Helpers -------

function buildDefaultFields(): ColumnFieldConfig[] {
  const order: Array<{ key: ColumnFieldKey; colIndex: number }> = [
    { key: 'nameCol',              colIndex: 1 },
    { key: 'stageCol',             colIndex: 2 },
    { key: 'carryoverCountCol',    colIndex: 3 },
    { key: 'carryoverSubjectsCol', colIndex: 4 },
  ];
  return order.map(({ key, colIndex }) => ({
    key,
    colIndex,
    enabled: true,
    displayNameAr: DEFAULT_FIELD_NAMES[key].ar,
    displayNameEn: DEFAULT_FIELD_NAMES[key].en,
  }));
}

// Label describing what this field is for (fixed context, not editable by user)
const FIELD_ROLE_LABEL: Record<ColumnFieldKey, { ar: string; en: string; required: boolean }> = {
  nameCol:              { ar: 'اسم الطالب',             en: 'Student Name',        required: true },
  stageCol:             { ar: 'المرحلة الدراسية',        en: 'Academic Stage',      required: true },
  carryoverCountCol:    { ar: 'عدد مواد التحميل (رقمي)',  en: 'Carryover Count (numeric)', required: true },
  carryoverSubjectsCol: { ar: 'أسماء مواد التحميل',      en: 'Carryover Subject Names',   required: true },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ColumnMappingModal({ isOpen, onClose }: Props) {
  const {
    language, parseOptions, setParseOptions,
    rawBuffer, setParsedData,
    setSheetNames, setValidationAccepted, setActiveView,
    parsedData,
  } = useApp();
  const isRTL = language === 'ar';

  // Local editable copy of fields
  const [fields, setFields] = useState<ColumnFieldConfig[]>(
    parseOptions?.columnFields ?? buildDefaultFields()
  );
  const [applying, setApplying] = useState(false);
  const [previewField, setPreviewField] = useState<ColumnFieldKey | null>(null);

  // Sync when modal opens
  useEffect(() => {
    if (isOpen) {
      setFields(parseOptions?.columnFields ?? buildDefaultFields());
      setPreviewField(null);
    }
  }, [isOpen, parseOptions]);

  // Detected headers from the parsed file (or fallback letters)
  const detectedHeaders = useMemo((): string[] => {
    if (parsedData?.detectedHeaders && parsedData.detectedHeaders.length > 0) {
      return parsedData.detectedHeaders;
    }
    // Fallback: generate A-Z labels
    return Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}`);
  }, [parsedData]);

  // Column options for dropdown
  const colOptions = useMemo(() =>
    detectedHeaders.map((header, idx) => ({
      index: idx,
      label: `${colIndexToLetter(idx)} – ${header}`,
      header,
    })),
    [detectedHeaders]
  );

  // Preview data for a given field's current column
  const getPreview = useCallback((field: ColumnFieldConfig): string[] => {
    if (!rawBuffer) return [];
    return getColumnPreview(
      rawBuffer,
      parseOptions?.sheetIndex ?? 0,
      field.colIndex,
      parseOptions?.startRow ?? 1,
      5
    );
  }, [rawBuffer, parseOptions]);

  const updateField = (key: ColumnFieldKey, patch: Partial<ColumnFieldConfig>) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f));
  };

  const resetToDefaults = () => {
    setFields(buildDefaultFields());
  };

  const handleApply = () => {
    if (!rawBuffer) return;
    setApplying(true);
    const newMapping = buildColumnMappingFromFields(fields);
    const newOpts = {
      ...parseOptions!,
      columnFields: fields,
      columnMapping: newMapping,
    };
    setTimeout(() => {
      try {
        const { data, sheetNames: names } = parseExcelFile(rawBuffer, newOpts);
        setParseOptions(newOpts);
        setSheetNames(names);
        setParsedData(data);
        setValidationAccepted(false);
        setActiveView('validation');
        onClose();
      } catch (e) {
        console.error(e);
      } finally {
        setApplying(false);
      }
    }, 50);
  };

  if (!isOpen) return null;

  const fieldOrder: ColumnFieldKey[] = ['nameCol', 'stageCol', 'carryoverCountCol', 'carryoverSubjectsCol'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[94vh] sm:max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="stat-icon bg-blue-50 w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
              <Columns className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                {isRTL ? 'تخصيص تعيين الأعمدة' : 'Customize Column Mapping'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                {isRTL
                  ? 'اختر الأعمدة المناسبة من ملف Excel وعدّل أسماء العرض'
                  : 'Choose the correct columns from the Excel file and edit display names'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              className="btn btn-secondary btn-sm text-xs flex items-center gap-1 px-2 sm:px-3 min-h-[36px]"
              onClick={resetToDefaults}
              title={isRTL ? 'إعادة تعيين الافتراضي' : 'Reset to defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{isRTL ? 'إعادة التعيين' : 'Reset'}</span>
            </button>
            <button
              className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Info banner */}
        {!rawBuffer && (
          <div className="mx-6 mt-4 alert alert-warning text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p>{isRTL ? 'يرجى رفع ملف Excel أولاً لاكتشاف رؤوس الأعمدة.' : 'Please upload an Excel file first to detect column headers.'}</p>
          </div>
        )}

        {/* Fields */}
        <div className="p-3.5 sm:p-6 space-y-3 sm:space-y-4">
          {fieldOrder.map(key => {
            const field = fields.find(f => f.key === key);
            if (!field) return null;
            const role = FIELD_ROLE_LABEL[key];
            const preview = previewField === key ? getPreview(field) : null;
            const selectedHeader = colOptions[field.colIndex]?.header ?? '';

            return (
              <div
                key={key}
                className="rounded-xl border border-slate-200 overflow-hidden"
                style={{ background: field.enabled ? '#f8fafc' : '#f1f5f9', opacity: field.enabled ? 1 : 0.7 }}
              >
                {/* Field header row */}
                <div className="flex items-center gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/70">
                  {/* Enable / Disable checkbox — required fields are always locked */}
                  <label className="flex items-center gap-2 cursor-pointer" title={role.required ? (isRTL ? 'هذا الحقل مطلوب ولا يمكن تعطيله' : 'Required field') : ''}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                      checked={field.enabled}
                      disabled={role.required}
                      onChange={e => updateField(key, { enabled: e.target.checked })}
                    />
                  </label>

                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {isRTL ? role.ar : role.en}
                    </span>
                    {role.required && (
                      <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                        {isRTL ? 'مطلوب' : 'Required'}
                      </span>
                    )}
                  </div>

                  {/* Preview toggle */}
                  <button
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors min-h-[32px] ${
                      previewField === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    onClick={() => setPreviewField(previewField === key ? null : key)}
                    disabled={!rawBuffer}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {isRTL ? 'معاينة' : 'Preview'}
                  </button>
                </div>

                {/* Field body */}
                <div className="px-3.5 sm:px-4 py-3 space-y-3">
                  {/* Column selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {isRTL ? 'العمود في ملف Excel' : 'Excel Column'}
                      </label>
                      <div className="relative">
                        <select
                          className="select w-full text-sm pe-8"
                          value={field.colIndex}
                          onChange={e => updateField(key, { colIndex: Number(e.target.value) })}
                          disabled={!field.enabled}
                        >
                          {colOptions.map(opt => (
                            <option key={opt.index} value={opt.index}>{opt.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-2.5 w-4 h-4 text-slate-400" />
                      </div>
                      {selectedHeader && (
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {isRTL ? `رأس العمود: ` : `Header: `}
                          <span className="font-semibold text-slate-700">{selectedHeader}</span>
                        </p>
                      )}
                    </div>

                    {/* Editable display names */}
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          {isRTL ? 'اسم العرض (عربي)' : 'Display Name (Arabic)'}
                        </label>
                        <input
                          type="text"
                          className="input w-full text-sm"
                          value={field.displayNameAr}
                          onChange={e => updateField(key, { displayNameAr: e.target.value })}
                          disabled={!field.enabled}
                          placeholder={DEFAULT_FIELD_NAMES[key].ar}
                          dir="rtl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          {isRTL ? 'اسم العرض (إنجليزي)' : 'Display Name (English)'}
                        </label>
                        <input
                          type="text"
                          className="input w-full text-sm"
                          value={field.displayNameEn}
                          onChange={e => updateField(key, { displayNameEn: e.target.value })}
                          disabled={!field.enabled}
                          placeholder={DEFAULT_FIELD_NAMES[key].en}
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Data preview */}
                  {previewField === key && preview !== null && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-2">
                        {isRTL ? `معاينة أول ${preview.length} صفوف من العمود ${colIndexToLetter(field.colIndex)}` : `Preview: first ${preview.length} rows from column ${colIndexToLetter(field.colIndex)}`}
                      </p>
                      {preview.length === 0 ? (
                        <p className="text-xs text-blue-600 italic">{isRTL ? 'لا توجد بيانات في هذا العمود' : 'No data in this column'}</p>
                      ) : (
                        <ul className="space-y-1">
                          {preview.map((val, i) => (
                            <li key={i} className="text-xs text-slate-700 bg-white rounded px-2 py-1 border border-blue-100 truncate">
                              {val}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-3.5 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span className="leading-tight">
              {isRTL
                ? 'أسماء العرض ستُستخدم في جميع أرجاء التطبيق وتقارير Excel'
                : 'Display names will be used throughout the app and in Excel reports'}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            <button className="btn btn-secondary btn-sm min-h-[38px] flex-1 sm:flex-initial justify-center" onClick={onClose}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              className="btn btn-primary btn-sm min-h-[38px] flex-1 sm:flex-initial justify-center"
              onClick={handleApply}
              disabled={applying || !rawBuffer}
            >
              {applying
                ? <><span className="spinner" />{isRTL ? 'جارٍ التطبيق...' : 'Applying...'}</>
                : <>{isRTL ? 'تطبيق وإعادة المعالجة' : 'Apply & Re-parse'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
