// =============================================
// Column Mapping & Parse Settings Component
// =============================================

import { useState } from 'react';
import { Settings, RefreshCw, CheckCircle2, Columns } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildColumnMappingFromFields } from '../context/AppContext';
import { translations } from '../i18n/translations';
import { parseExcelFile } from '../services/excelParser';
import ColumnMappingModal from './ColumnMappingModal';
import type { ParseOptions, ColumnMapping } from '../types';

const SEPARATOR_OPTIONS = [
  { key: 'comma',       value: ',',  labelAr: 'فاصلة إنجليزية ( , )', labelEn: 'Comma ( , )' },
  { key: 'arabicComma', value: '،', labelAr: 'فاصلة عربية ( ، )',    labelEn: 'Arabic Comma ( ، )' },
  { key: 'semicolon',   value: ';',  labelAr: 'فاصلة منقوطة ( ; )',   labelEn: 'Semicolon ( ; )' },
  { key: 'newline',     value: '\n', labelAr: 'سطر جديد',             labelEn: 'New Line' },
  { key: 'dash',        value: ' - ', labelAr: 'شرطة ( - )',          labelEn: 'Dash ( - )' },
  { key: 'slash',       value: ' / ', labelAr: 'شرطة مائلة ( / )',    labelEn: 'Slash ( / )' },
];

export default function ParseSettings() {
  const {
    language, parseOptions, setParseOptions,
    rawBuffer, sheetNames, setParsedData,
    setSheetNames, setValidationAccepted, setActiveView,
  } = useApp();
  const t = translations[language];

  const [localOpts, setLocalOpts] = useState<ParseOptions>(
    parseOptions ?? {
      sheetIndex: 0,
      columnMapping: { nameCol: 1, stageCol: 2, carryoverCountCol: 3, carryoverSubjectsCol: 4 },
      columnFields: [],
      subjectSeparators: [',', '،', ';', '\n'],
      startRow: 1,
      includeZeroCarryover: true,
      maxAllowedCarryover: 2,
    }
  );

  const [applying, setApplying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const toggleSeparator = (val: string) => {
    setLocalOpts(prev => {
      const has = prev.subjectSeparators.includes(val);
      return {
        ...prev,
        subjectSeparators: has
          ? prev.subjectSeparators.filter(s => s !== val)
          : [...prev.subjectSeparators, val],
      };
    });
  };

  const applySettings = () => {
    if (!rawBuffer) return;
    setApplying(true);
    setTimeout(() => {
      try {
        // Rebuild columnMapping from columnFields if available
        const fields = localOpts.columnFields;
        const mapping: ColumnMapping = fields && fields.length > 0
          ? buildColumnMappingFromFields(fields)
          : localOpts.columnMapping;

        const optsToApply = { ...localOpts, columnMapping: mapping };
        const { data, sheetNames: names } = parseExcelFile(rawBuffer, optsToApply);
        setParseOptions(optsToApply);
        setSheetNames(names);
        setParsedData(data);
        setValidationAccepted(false);
        setActiveView('validation');
      } catch (e) {
        console.error(e);
      } finally {
        setApplying(false);
      }
    }, 50);
  };

  const isRTL = language === 'ar';

  return (
    <>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="stat-icon bg-blue-50">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t.columnMapping}</h2>
              <p className="text-sm text-slate-500">{t.columnMappingDesc}</p>
            </div>
          </div>

          {/* Academic Condition Banner */}
          <div className="alert alert-info mb-6 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-900">{isRTL ? 'معايير الشمول الأكاديمي للتحميل' : 'Academic Carryover Inclusion Criteria'}</p>
              <p className="text-xs text-blue-700 mt-0.5">{t.maxCarryoverCondition}</p>
            </div>
          </div>

          {/* Column Mapping Button */}
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-800 text-sm">{isRTL ? 'تعيين الأعمدة المخصص' : 'Custom Column Mapping'}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {isRTL
                    ? 'اختر الأعمدة من ملف Excel، وعدّل أسماء العرض في واجهة التطبيق وتقارير Excel'
                    : 'Choose columns from your Excel file and edit display names used throughout the app and reports'}
                </p>
                {parseOptions?.columnFields && parseOptions.columnFields.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {parseOptions.columnFields.map(f => (
                      <span key={f.key} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                        {isRTL ? f.displayNameAr : f.displayNameEn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary btn-sm whitespace-nowrap flex items-center gap-1.5"
                onClick={() => setModalOpen(true)}
              >
                <Columns className="w-4 h-4" />
                {isRTL ? 'تعديل تعيين الأعمدة' : 'Edit Column Mapping'}
              </button>
            </div>
          </div>

          {/* Worksheet selector */}
          {sheetNames.length > 1 && (
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.worksheet}</label>
              <select
                className="select"
                value={localOpts.sheetIndex}
                onChange={e => setLocalOpts(p => ({ ...p, sheetIndex: Number(e.target.value) }))}
              >
                {sheetNames.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Start row */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t.startRow}</label>
            <input
              type="number"
              min={1}
              max={100}
              className="input w-32"
              value={localOpts.startRow + 1}
              onChange={e => setLocalOpts(p => ({ ...p, startRow: Math.max(0, Number(e.target.value) - 1) }))}
            />
            <p className="text-xs text-slate-400 mt-1">
              {isRTL ? 'رقم الصف الأول الذي تبدأ منه بيانات الطلاب (الصف 2 افتراضياً بعد صف العناوين)' : 'First row containing student data (Row 2 by default after headers)'}
            </p>
          </div>

          {/* Zero Carryover Option */}
          <div className="mb-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                checked={localOpts.includeZeroCarryover}
                onChange={e => setLocalOpts(p => ({ ...p, includeZeroCarryover: e.target.checked }))}
              />
              <span className="text-sm font-semibold text-slate-700">{t.includeZeroCarryover}</span>
            </label>
            <p className="text-xs text-slate-500 mt-1 mr-6 ml-6">
              {isRTL
                ? 'عند التفعيل، سيتم إدراج الطلبة الذين عدد مواد تحميلهم 0 ضمن الإحصائيات والكشوف.'
                : 'When enabled, students with 0 carryover subjects are included in rosters and stats.'}
            </p>
          </div>

          {/* Separator checkboxes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">{t.subjectSeparators}</label>
            <div className="flex flex-wrap gap-3">
              {SEPARATOR_OPTIONS.map(sep => (
                <label key={sep.key} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localOpts.subjectSeparators.includes(sep.value)}
                    onChange={() => toggleSeparator(sep.value)}
                  />
                  <span>{isRTL ? sep.labelAr : sep.labelEn}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="btn btn-primary"
              onClick={applySettings}
              disabled={applying}
            >
              {applying ? (
                <><span className="spinner" />{isRTL ? 'جارٍ التطبيق...' : 'Applying...'}</>
              ) : (
                <><RefreshCw className="w-4 h-4" />{t.applySettings}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Column Mapping Modal */}
      <ColumnMappingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
