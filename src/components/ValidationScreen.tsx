// =============================================
// Validation Screen Component
// =============================================

import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  ArrowRight, Settings, UserCheck, UserX, AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';

export default function ValidationScreen() {
  const { language, parsedData, setActiveView, setValidationAccepted } = useApp();
  const t = translations[language];
  const [showWarnings, setShowWarnings] = useState(true);

  if (!parsedData) return null;

  const { parseStats, warnings, includedStudents, excludedStudents } = parsedData;

  const stats = [
    { label: t.totalRows, value: parseStats.totalRows, color: 'text-slate-700', bg: 'bg-slate-50' },
    { label: t.validRecords, value: parseStats.validRecords, color: 'text-slate-800', bg: 'bg-slate-100' },
    { label: t.includedStudents, value: includedStudents.length, color: 'text-emerald-700 font-extrabold', bg: 'bg-emerald-50 border border-emerald-200' },
    { label: t.excludedStudents, value: excludedStudents.length, color: excludedStudents.length > 0 ? 'text-rose-700 font-extrabold' : 'text-slate-500', bg: excludedStudents.length > 0 ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50' },
    { label: t.countMismatches, value: parseStats.countMismatches, color: parseStats.countMismatches > 0 ? 'text-amber-700 font-extrabold' : 'text-slate-500', bg: parseStats.countMismatches > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50' },
    { label: t.distinctSubjects, value: parseStats.distinctSubjects, color: 'text-blue-700 font-bold', bg: 'bg-blue-50' },
  ];

  const warningsByType: Record<string, typeof warnings> = {};
  warnings.forEach(w => {
    if (!warningsByType[w.type]) warningsByType[w.type] = [];
    warningsByType[w.type].push(w);
  });

  const hasMismatches = parseStats.countMismatches > 0;
  const hasExclusions = excludedStudents.length > 0;
  const hasWarnings = warnings.length > 0;

  const proceed = () => {
    setValidationAccepted(true);
    setActiveView('dashboard');
  };

  const isRTL = language === 'ar';

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <div className="card p-3.5 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 mb-5 sm:mb-6">
          <div className={`stat-icon ${hasExclusions || hasMismatches ? 'bg-amber-50' : 'bg-green-50'}`}>
            {hasMismatches || hasExclusions ? (
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            ) : (
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate">{t.validationTitle}</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {includedStudents.length} {t.studentsCount} {t.includedBadge} • {parseStats.distinctSubjects} {t.subjectsCount}
            </p>
          </div>
        </div>

        {/* Inclusion Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 sm:mb-6">
          <div className="flex items-center gap-3 p-3 sm:p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
            <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 flex-shrink-0" />
            <div className="text-sm min-w-0">
              <span className="font-bold text-emerald-900">{t.includedStudents}: </span>
              <span className="font-extrabold text-emerald-700 text-sm sm:text-base">{includedStudents.length} {t.studentsCount}</span>
              <p className="text-xs text-emerald-700 mt-0.5">
                ({parseStats.oneCarryoverStudents} {t.oneSubjectStudents} • {parseStats.twoCarryoverStudents} {t.twoSubjectStudents} • {parseStats.zeroCarryoverStudents} {t.zeroSubjectStudents})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 sm:p-3.5 rounded-xl bg-rose-50/80 border border-rose-200">
            <UserX className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600 flex-shrink-0" />
            <div className="text-sm min-w-0">
              <span className="font-bold text-rose-900">{t.excludedStudents}: </span>
              <span className="font-extrabold text-rose-700 text-sm sm:text-base">{excludedStudents.length} {t.studentsCount}</span>
              <p className="text-xs text-rose-600 mt-0.5">
                {isRTL ? 'محمّلون بأكثر من مادتين (> 2 مواد) وتم استبعادهم من التحليل الرئيسي' : 'Carrying > 2 subjects, excluded from main carryover roster'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-5 sm:mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className={`rounded-xl p-3 sm:p-3.5 ${stat.bg}`}>
              <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Discrepancy & Exclusion Inspection */}
        {hasWarnings && (
          <div className="mb-5 sm:mb-6">
            <button
              className="flex items-center justify-between w-full p-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 transition-colors"
              onClick={() => setShowWarnings(v => !v)}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>{t.warnings} ({warnings.length})</span>
              </div>
              {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showWarnings && (
              <div className="mt-3 space-y-3 max-h-80 overflow-y-auto pr-1 pl-1">
                {/* Count mismatches warnings */}
                {warningsByType['count_mismatch'] && (
                  <div className="alert alert-warning border border-amber-300">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-amber-900 mb-1">
                        {t.warnCountMismatch} ({warningsByType['count_mismatch'].length})
                      </p>
                      <ul className="text-xs space-y-1 text-amber-900/90">
                        {warningsByType['count_mismatch'].map((w, i) => (
                          <li key={i} className="bg-amber-100/60 p-1.5 rounded">
                            {w.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Exceeded max carryover warnings */}
                {warningsByType['exceeded_max_carryover'] && (
                  <div className="alert alert-error border border-rose-300">
                    <UserX className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-rose-900 mb-1">
                        {t.warnExceededMax} ({warningsByType['exceeded_max_carryover'].length})
                      </p>
                      <ul className="text-xs space-y-1 text-rose-900/90">
                        {warningsByType['exceeded_max_carryover'].map((w, i) => (
                          <li key={i} className="bg-rose-100/60 p-1.5 rounded">
                            {w.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Other warnings */}
                {Object.entries(warningsByType)
                  .filter(([type]) => type !== 'count_mismatch' && type !== 'exceeded_max_carryover')
                  .map(([type, items]) => (
                    <div key={type} className="alert alert-warning">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-800 mb-1">
                          {t[`warn${type.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as keyof typeof t] || type}
                          {' '}({items.length})
                        </p>
                        <ul className="text-xs space-y-0.5">
                          {items.slice(0, 5).map((w, i) => (
                            <li key={i} className="truncate">{w.message}</li>
                          ))}
                          {items.length > 5 && (
                            <li className="text-amber-700 font-medium">... و {items.length - 5} أخرى</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {!hasWarnings && (
          <div className="alert alert-success mb-5 sm:mb-6">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs sm:text-sm">{t.noWarnings}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="btn btn-primary w-full sm:w-auto justify-center min-h-[42px]" onClick={proceed}>
            <span>{t.proceedToAnalysis}</span>
            <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <button
            className="btn btn-secondary w-full sm:w-auto justify-center min-h-[42px]"
            onClick={() => setActiveView('dashboard')}
          >
            <Settings className="w-4 h-4" />
            <span>{t.fixSettings}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
