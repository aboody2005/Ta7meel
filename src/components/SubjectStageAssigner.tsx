// =============================================
// Subject Stage Assigner - Carryover Subject Stage Control Panel
// لوحة تحكم مراحل مواد التحميل
// =============================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, CheckCircle2, BookOpen, AlertCircle, Download,
  Layers, ChevronRight, ChevronLeft, RotateCcw, Edit3,
  CheckSquare, Square, AlertTriangle, Sparkles, Filter, X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AcademicStage, SubjectStageMap, ModifiedSubjectsMap, StudentRecord } from '../types';
import { STAGE_ORDER, STAGE_EN } from '../types';
import { exportReportBySubjectStage, exportSingleSubjectStageReport } from '../services/excelExporter';
import { translations } from '../i18n/translations';

const STAGE_COLORS: Record<string, string> = {
  'المرحلة الأولى':  'bg-blue-100 text-blue-800 border-blue-200',
  'المرحلة الثانية': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'المرحلة الثالثة': 'bg-violet-100 text-violet-800 border-violet-200',
  'المرحلة الرابعة': 'bg-amber-100 text-amber-800 border-amber-200',
  'المرحلة الخامسة': 'bg-rose-100 text-rose-800 border-rose-200',
  'غير محدد':        'bg-slate-100 text-slate-600 border-slate-200',
};

export default function SubjectStageAssigner() {
  const {
    language,
    parsedData,
    subjectStageMap,
    modifiedSubjects,
    saveSubjectStageAssignments,
    restoreDefaultAssignments,
    setHasUnsavedChanges,
    parseOptions,
    setActiveView
  } = useApp();

  const t = translations[language];
  const isRTL = language === 'ar';

  // Local draft state for edits before saving
  const [draftMap, setDraftMap] = useState<SubjectStageMap>(() => ({ ...subjectStageMap }));
  const [draftModified, setDraftModified] = useState<ModifiedSubjectsMap>(() => ({ ...modifiedSubjects }));

  // Selection for bulk actions
  const [selectedSubjectNames, setSelectedSubjectNames] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<AcademicStage | ''>('');

  // Search and Filter states
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<AcademicStage | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'modified' | 'default'>('all');

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Preview stage for the live preview section
  const [previewStage, setPreviewStage] = useState<AcademicStage>('المرحلة الثالثة');

  // Confirmation modal for restore defaults
  const [confirmRestoreModal, setConfirmRestoreModal] = useState(false);

  const allSubjects = useMemo(() => parsedData?.allSubjects ?? [], [parsedData?.allSubjects]);
  const includedStudents = useMemo(() => parsedData?.includedStudents ?? [], [parsedData?.includedStudents]);
  const columnFields = parseOptions?.columnFields;

  // Sync draft whenever saved subjectStageMap or parsedData changes
  useEffect(() => {
    if (parsedData) {
      const initialMap: SubjectStageMap = {};
      const initialModified: ModifiedSubjectsMap = {};
      allSubjects.forEach(s => {
        initialMap[s.name] = subjectStageMap[s.name] ?? s.defaultStage;
        initialModified[s.name] = Boolean(modifiedSubjects[s.name] || (initialMap[s.name] !== s.defaultStage));
      });
      setDraftMap(initialMap);
      setDraftModified(initialModified);
    }
  }, [allSubjects, subjectStageMap, modifiedSubjects, parsedData]);

  // Check if draft has unsaved edits compared to saved subjectStageMap
  const unsavedCount = useMemo(() => {
    let count = 0;
    allSubjects.forEach(s => {
      const draftVal = draftMap[s.name] ?? s.defaultStage;
      const savedVal = subjectStageMap[s.name] ?? s.defaultStage;
      if (draftVal !== savedVal) {
        count++;
      }
    });
    return count;
  }, [allSubjects, draftMap, subjectStageMap]);

  const hasPendingEdits = unsavedCount > 0;

  // Notify context of unsaved changes status
  useEffect(() => {
    setHasUnsavedChanges(hasPendingEdits);
  }, [hasPendingEdits, setHasUnsavedChanges]);

  // Window beforeunload prompt for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingEdits) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingEdits]);

  // Filtered subjects based on search, assigned stage, and status
  const filteredSubjects = useMemo(() => {
    return allSubjects.filter(s => {
      // 1. Search filter
      const q = search.trim().toLowerCase();
      if (q && !s.name.toLowerCase().includes(q)) {
        return false;
      }

      // 2. Assigned stage filter
      const currentAssigned = draftMap[s.name] ?? s.defaultStage;
      if (stageFilter !== 'all' && currentAssigned !== stageFilter) {
        return false;
      }

      // 3. Modification status filter
      const isMod = draftModified[s.name] ?? (currentAssigned !== s.defaultStage);
      if (statusFilter === 'modified' && !isMod) return false;
      if (statusFilter === 'default' && isMod) return false;

      return true;
    });
  }, [allSubjects, search, stageFilter, statusFilter, draftMap, draftModified]);

  // Statistics
  const totalSubjectsCount = allSubjects.length;
  const modifiedCount = allSubjects.filter(s => {
    const currentAssigned = draftMap[s.name] ?? s.defaultStage;
    return draftModified[s.name] ?? (currentAssigned !== s.defaultStage);
  }).length;
  const defaultCount = totalSubjectsCount - modifiedCount;

  // Assign individual subject stage in draft
  const handleStageChange = useCallback((subjectName: string, newStage: AcademicStage) => {
    const subject = allSubjects.find(s => s.name === subjectName);
    const defaultStg = subject ? subject.defaultStage : 'المرحلة الأولى';
    const isNowModified = newStage !== defaultStg;

    setDraftMap(prev => ({
      ...prev,
      [subjectName]: newStage,
    }));

    setDraftModified(prev => ({
      ...prev,
      [subjectName]: isNowModified,
    }));
  }, [allSubjects]);

  // Bulk assignment on selected subjects
  const applyBulkAssign = useCallback(() => {
    if (!bulkStage || selectedSubjectNames.size === 0) return;

    setDraftMap(prev => {
      const next = { ...prev };
      selectedSubjectNames.forEach(name => {
        next[name] = bulkStage;
      });
      return next;
    });

    setDraftModified(prev => {
      const next = { ...prev };
      selectedSubjectNames.forEach(name => {
        const subject = allSubjects.find(s => s.name === name);
        const defaultStg = subject ? subject.defaultStage : 'المرحلة الأولى';
        next[name] = bulkStage !== defaultStg;
      });
      return next;
    });

    setSelectedSubjectNames(new Set());
    setBulkStage('');
  }, [bulkStage, selectedSubjectNames, allSubjects]);

  // Select / Deselect all currently filtered subjects
  const toggleSelectAllFiltered = useCallback(() => {
    if (selectedSubjectNames.size === filteredSubjects.length && filteredSubjects.length > 0) {
      setSelectedSubjectNames(new Set());
    } else {
      setSelectedSubjectNames(new Set(filteredSubjects.map(s => s.name)));
    }
  }, [selectedSubjectNames, filteredSubjects]);

  const toggleSelectRow = useCallback((name: string) => {
    setSelectedSubjectNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  // Save assignments
  const handleSaveAssignments = useCallback(() => {
    // 1. Validate all stage assignments
    const validatedMap: SubjectStageMap = {};
    const validatedModified: ModifiedSubjectsMap = {};

    allSubjects.forEach(s => {
      const assigned = draftMap[s.name] ?? s.defaultStage;
      // Ensure stage is valid
      const validStage = STAGE_ORDER.includes(assigned) ? assigned : s.defaultStage;
      validatedMap[s.name] = validStage;
      validatedModified[s.name] = Boolean(draftModified[s.name] || (validStage !== s.defaultStage));
    });

    // 2. Commit to AppContext
    saveSubjectStageAssignments(validatedMap, validatedModified);

    // 3. Confirmation feedback
    setSuccessMessage(t.assignmentsSavedSuccess);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
  }, [allSubjects, draftMap, draftModified, saveSubjectStageAssignments, t]);

  // Restore defaults
  const handleRestoreDefaults = useCallback(() => {
    restoreDefaultAssignments();

    // Reset draft state to defaults
    const resetMap: SubjectStageMap = {};
    const resetModified: ModifiedSubjectsMap = {};
    allSubjects.forEach(s => {
      resetMap[s.name] = s.defaultStage;
      resetModified[s.name] = false;
    });

    setDraftMap(resetMap);
    setDraftModified(resetModified);
    setSelectedSubjectNames(new Set());
    setConfirmRestoreModal(false);

    setSuccessMessage(t.defaultsRestoredSuccess);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
  }, [allSubjects, restoreDefaultAssignments, t]);

  // Live preview rows: students carrying subjects assigned to previewStage
  const previewRows = useMemo(() => {
    if (!parsedData) return [];
    const subjectsInPreviewStage = allSubjects.filter(s => {
      const assigned = draftMap[s.name] ?? s.defaultStage;
      return assigned === previewStage;
    });

    const rows: {
      student: StudentRecord;
      subjectName: string;
      assignedStage: AcademicStage;
    }[] = [];

    subjectsInPreviewStage.forEach(s => {
      const matching = includedStudents.filter(student =>
        student.carryoverSubjects.some(cs => cs.trim().toLowerCase() === s.name.trim().toLowerCase())
      );

      matching.forEach(student => {
        rows.push({
          student,
          subjectName: s.name,
          assignedStage: previewStage,
        });
      });
    });

    return rows;
  }, [allSubjects, includedStudents, draftMap, previewStage, parsedData]);

  if (!parsedData) return null;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-slate-500 hover:text-slate-800"
            onClick={() => setActiveView('dashboard')}
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span>{t.dashboard}</span>
          </button>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
                {t.carryoverSubjectStageControl}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.carryoverSubjectStageControlDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 text-slate-700 hover:text-red-700 hover:border-red-300 flex-1 sm:flex-none justify-center min-h-[36px]"
            onClick={() => setConfirmRestoreModal(true)}
            title={t.restoreDefaults}
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>{t.restoreDefaults}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm font-bold relative flex-1 sm:flex-none justify-center min-h-[36px]"
            onClick={handleSaveAssignments}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.saveAssignments}</span>
            {hasPendingEdits && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-amber-400 text-amber-950 ms-1">
                {unsavedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm flex items-center gap-1.5 font-medium flex-1 sm:flex-none justify-center min-h-[36px]"
            onClick={() => exportReportBySubjectStage(parsedData, draftMap, language, columnFields)}
            disabled={allSubjects.length === 0}
          >
            <Download className="w-4 h-4" />
            <span>{isRTL ? 'تصدير تقرير المراحل' : 'Export Stage Report'}</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="alert alert-success flex items-center justify-between p-3.5 rounded-xl border border-emerald-200 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-bold text-emerald-900">{successMessage}</p>
          </div>
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-900 p-1"
            onClick={() => setSuccessMessage(null)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Unsaved Changes Banner */}
      {hasPendingEdits && (
        <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/90 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                {t.pendingChangesNotice.replace('{count}', String(unsavedCount))}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {isRTL
                  ? 'التعديلات الحالية محفوظة محلياً كمسودة فقط. انقر "حفظ التعيينات" لتطبيقها على كافة كشوفات وسجلات الطلبة وملفات Excel.'
                  : 'Edits are kept as draft. Click "Save Assignments" to apply them across student rosters and Excel exports.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm text-xs font-bold shadow-xs flex items-center gap-1.5 w-full sm:w-auto justify-center"
            onClick={handleSaveAssignments}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t.saveAssignments}</span>
          </button>
        </div>
      )}

      {/* Statistics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="card p-3 sm:p-3.5 text-center border border-slate-200/80 bg-white">
          <p className="text-xl sm:text-2xl font-extrabold text-slate-800">{totalSubjectsCount}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {isRTL ? 'إجمالي مواد التحميل المكتشفة' : 'Total Detected Subjects'}
          </p>
        </div>

        <div className="card p-3 sm:p-3.5 text-center border border-blue-100 bg-blue-50/40">
          <p className="text-xl sm:text-2xl font-extrabold text-blue-700">{defaultCount}</p>
          <p className="text-xs text-blue-800 mt-1 font-medium">
            {isRTL ? 'مواد بالتعيين الافتراضي' : 'Default Assignment'}
          </p>
        </div>

        <div className="card p-3 sm:p-3.5 text-center border border-amber-100 bg-amber-50/40">
          <p className="text-xl sm:text-2xl font-extrabold text-amber-700">{modifiedCount}</p>
          <p className="text-xs text-amber-800 mt-1 font-medium">
            {isRTL ? 'مواد معدّلة يدوياً' : 'Manually Changed'}
          </p>
        </div>

        <div className="card p-3 sm:p-3.5 text-center border border-emerald-100 bg-emerald-50/40">
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700">{includedStudents.length}</p>
          <p className="text-xs text-emerald-800 mt-1 font-medium">
            {isRTL ? 'إجمالي الطلبة المحمّلين' : 'Total Carrying Students'}
          </p>
        </div>
      </div>

      {/* Professional Guidance Card */}
      <div className="p-3 sm:p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs flex items-start gap-2.5 shadow-2xs">
        <BookOpen className="w-4 h-4 flex-shrink-0 text-blue-700 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-blue-950">
            {isRTL ? 'استقلالية مرحلة الطالب الحالية عن مرحلة المادة المحمّل بها:' : 'Student Current Stage vs Assigned Subject Stage:'}{' '}
          </span>
          <span className="text-blue-900">
            {isRTL
              ? 'تحديد "المرحلة الدراسية المحمّل بها" لمادة التحميل (مثل مادة "علم الأدوية 1" للمرحلة الثالثة) لا يغيّر إطلاقاً المرحلة الحالية للطالب (مثل طالب في المرحلة الرابعة محمل بالمادة). يظل الطالب مسجلاً في مرحلته الحالية، بينما تُصنف المادة تحت مرحلتها المحددة في كافة الجداول والتقارير.'
              : 'Assigning a subject stage (e.g. Pharmacology I to Third Stage) does not alter the student\'s current academic stage. The student remains in their current stage (e.g. Fourth Stage) while the subject is classified under its assigned stage.'}
          </span>
        </div>
      </div>

      {/* Main Control Panel Card */}
      <div className="card border border-slate-200/90 shadow-sm overflow-hidden bg-white">
        {/* Filters and Search Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] w-full sm:max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                className="input ps-9 text-xs py-2 w-full bg-white shadow-2xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRTL ? 'بحث باسم مادة التحميل...' : 'Search subject name...'}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>

            {/* Filter by Assigned Stage */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-600 font-medium">{t.filterByAssignedStage}:</span>
              </div>
              <select
                className="select text-xs py-1.5 bg-white font-medium shadow-2xs flex-1 sm:flex-none"
                value={stageFilter}
                onChange={e => setStageFilter(e.target.value as typeof stageFilter)}
              >
                <option value="all">{isRTL ? 'جميع المراحل' : 'All Stages'}</option>
                {STAGE_ORDER.map(s => (
                  <option key={s} value={s}>{isRTL ? s : STAGE_EN[s]}</option>
                ))}
              </select>

              {/* Filter by Modification Status */}
              <select
                className="select text-xs py-1.5 bg-white font-medium shadow-2xs flex-1 sm:flex-none"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">{t.filterAllStatuses}</option>
                <option value="modified">{t.filterModifiedOnly}</option>
                <option value="default">{t.filterDefaultOnly}</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Bar (when subjects are selected) */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/70">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs flex items-center gap-1 text-slate-700 hover:bg-slate-200/60"
                onClick={toggleSelectAllFiltered}
              >
                {selectedSubjectNames.size === filteredSubjects.length && filteredSubjects.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {selectedSubjectNames.size === filteredSubjects.length && filteredSubjects.length > 0
                    ? t.deselectAll
                    : t.selectAll}
                </span>
              </button>

              {selectedSubjectNames.size > 0 && (
                <span className="badge badge-blue text-xs font-bold py-0.5 px-2">
                  {t.selectedSubjectsCount.replace('{count}', String(selectedSubjectNames.size))}
                </span>
              )}
            </div>

            {/* Bulk Assign Controls */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <select
                className="select text-xs py-1.5 bg-white font-medium flex-1 sm:flex-none sm:min-w-[180px]"
                value={bulkStage}
                onChange={e => setBulkStage(e.target.value as AcademicStage | '')}
              >
                <option value="">{t.bulkAssignPlaceholder}</option>
                {STAGE_ORDER.map(s => (
                  <option key={s} value={s}>{isRTL ? s : STAGE_EN[s]}</option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-secondary btn-sm text-xs font-semibold flex items-center gap-1 bg-white hover:bg-blue-50 text-blue-700 border-blue-200 flex-1 sm:flex-none justify-center"
                disabled={!bulkStage || selectedSubjectNames.size === 0}
                onClick={applyBulkAssign}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.bulkAssignToSelected}</span>
              </button>
            </div>
          </div>
        </div>

        {/* The Main Subject Stage Table */}
        <div className="table-wrapper border-0 max-h-[520px] overflow-y-auto overflow-x-auto w-full">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th style={{ width: '2.5rem' }} className="text-center">
                  <input
                    type="checkbox"
                    className="checkbox rounded text-blue-600 cursor-pointer"
                    checked={selectedSubjectNames.size === filteredSubjects.length && filteredSubjects.length > 0}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all"
                  />
                </th>
                <th style={{ width: '3rem' }}>#</th>
                <th className="font-bold">{t.subjectNameCol}</th>
                <th style={{ width: '15rem' }} className="font-bold">{t.defaultCurrentStageCol}</th>
                <th style={{ width: '16rem' }} className="font-bold">{t.assignedSubjectStageCol}</th>
                <th style={{ width: '9rem' }} className="text-center font-bold">{t.carryingStudentsCountCol}</th>
                <th style={{ width: '8rem' }} className="text-center font-bold">{t.assignmentStatusCol}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">{t.noResults}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.noResultsDesc}</p>
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((subject, idx) => {
                  const assigned = draftMap[subject.name] ?? subject.defaultStage;
                  const isMod = draftModified[subject.name] ?? (assigned !== subject.defaultStage);
                  const isChecked = selectedSubjectNames.has(subject.name);

                  // Detailed breakdown of student stages for this subject
                  const stageEntries = Object.entries(subject.stages) as [AcademicStage, number][];
                  const hasMixedStages = stageEntries.length > 1;

                  return (
                    <tr
                      key={subject.name}
                      className={`transition-colors ${
                        isChecked
                          ? 'bg-blue-50/60'
                          : isMod
                          ? 'bg-amber-50/20 hover:bg-amber-50/40'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="checkbox rounded text-blue-600 cursor-pointer"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(subject.name)}
                          aria-label={`Select ${subject.name}`}
                        />
                      </td>

                      {/* Row index */}
                      <td className="text-slate-400 text-xs font-mono font-medium">
                        {idx + 1}
                      </td>

                      {/* اسم مادة التحميل */}
                      <td>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="font-bold text-slate-800 text-sm">
                            {subject.name}
                          </span>
                        </div>
                      </td>

                      {/* المرحلة الحالية الافتراضية */}
                      <td>
                        <div className="space-y-1">
                          <span className="badge badge-gray text-xs font-semibold">
                            {isRTL ? subject.defaultStage : STAGE_EN[subject.defaultStage]}
                          </span>
                          {hasMixedStages && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {stageEntries.map(([stg, cnt]) => (
                                <span
                                  key={stg}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium"
                                  title={`${cnt} ${t.studentsCount}`}
                                >
                                  {isRTL ? stg.replace('المرحلة ', '') : STAGE_EN[stg].replace(' Stage', '')}: {cnt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* المرحلة الدراسية المحمّل بها (Editable dropdown) */}
                      <td>
                        <div className="flex items-center gap-2">
                          <select
                            className="select text-xs py-1.5 font-bold w-full bg-white shadow-2xs border-slate-300 focus:border-blue-500"
                            value={assigned}
                            onChange={e => handleStageChange(subject.name, e.target.value as AcademicStage)}
                            aria-label={`${t.assignedSubjectStageCol} for ${subject.name}`}
                          >
                            {STAGE_ORDER.map(s => (
                              <option key={s} value={s}>
                                {isRTL ? s : STAGE_EN[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* عدد الطلاب المحمّلين */}
                      <td className="text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                          {subject.studentCount}
                        </span>
                      </td>

                      {/* حالة التعيين (Default vs Modified) */}
                      <td className="text-center">
                        {isMod ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                            <Edit3 className="w-3 h-3 text-amber-600 flex-shrink-0" />
                            <span>{t.manuallyChangedBadge}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span>{t.defaultAssignmentBadge}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Controls */}
        <div className="p-4 bg-slate-50/90 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {isRTL
              ? `عرض ${filteredSubjects.length} من إجمالي ${allSubjects.length} مواد تحميل مسجلة`
              : `Showing ${filteredSubjects.length} of ${allSubjects.length} total carryover subjects`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm text-xs font-semibold"
              onClick={() => setConfirmRestoreModal(true)}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.restoreDefaults}</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm text-xs font-bold shadow-sm flex items-center gap-1.5"
              onClick={handleSaveAssignments}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.saveAssignments}</span>
              {hasPendingEdits && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 font-extrabold text-[10px]">
                  {unsavedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Section: Grouping by Assigned Subject Stage */}
      <div className="card p-5 border border-slate-200/80 shadow-sm space-y-4 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>{t.livePreviewTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.livePreviewDesc}
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm text-xs flex items-center gap-1 border-slate-200 font-semibold"
            onClick={() => exportSingleSubjectStageReport(parsedData, previewStage, draftMap, language, columnFields)}
            disabled={previewRows.length === 0}
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isRTL ? `تصدير تقرير ${previewStage}` : `Export ${STAGE_EN[previewStage]}`}</span>
          </button>
        </div>

        {/* Stage selection tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {STAGE_ORDER.map(stg => {
            const count = allSubjects.filter(s => (draftMap[s.name] ?? s.defaultStage) === stg).length;
            const isSelected = previewStage === stg;
            return (
              <button
                key={stg}
                type="button"
                className={`btn btn-sm text-xs font-semibold ${isSelected ? 'btn-primary' : 'btn-secondary'} flex items-center gap-1.5 shadow-2xs`}
                onClick={() => setPreviewStage(stg)}
              >
                <span>{isRTL ? stg : STAGE_EN[stg]}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview Table */}
        <div className="table-wrapper border border-slate-200 rounded-xl overflow-hidden mt-3 max-h-80 overflow-y-auto overflow-x-auto w-full">
          <table className="table min-w-[650px]">
            <thead>
              <tr>
                <th style={{ width: '3.5rem' }}>#</th>
                <th>{t.studentName}</th>
                <th>{t.studentCurrentStageCol}</th>
                <th>{t.carryoverSubjectsCol}</th>
                <th>{t.assignedSubjectStageCol}</th>
                <th style={{ width: '8rem' }} className="text-center">{t.carryoverCountCol}</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    {isRTL
                      ? `لا توجد مواد تحميل معينة للمرحلة (${previewStage}) حالياً.`
                      : `No carryover subjects currently assigned to (${STAGE_EN[previewStage]}).`}
                  </td>
                </tr>
              ) : (
                previewRows.map((row, idx) => (
                  <tr key={`${row.student.id}-${row.subjectName}-${idx}`} className="hover:bg-slate-50/70">
                    <td className="text-slate-400 text-xs font-mono font-medium">{idx + 1}</td>
                    <td className="font-bold text-slate-800 text-xs">{row.student.name}</td>
                    <td>
                      <span className="badge badge-blue text-xs font-bold">
                        {isRTL ? row.student.stage : STAGE_EN[row.student.stage]}
                      </span>
                    </td>
                    <td className="font-semibold text-slate-800 text-xs">{row.subjectName}</td>
                    <td>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${STAGE_COLORS[row.assignedStage] ?? STAGE_COLORS['غير محدد']}`}>
                        {isRTL ? row.assignedStage : STAGE_EN[row.assignedStage]}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge badge-gray text-xs font-bold">
                        {row.student.carryoverCount}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Restore Defaults */}
      {confirmRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 rounded-xl bg-amber-50">
                <RotateCcw className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.restoreDefaults}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isRTL
                ? 'هل أنت متأكد من رغبتك في استعادة التعيينات الافتراضية المقترحة تلقائياً لجميع مواد التحميل؟ سيتم إلغاء أية تعديلات يدوية وتطبيق التعيين الافتراضي.'
                : 'Are you sure you want to restore the automatically suggested default stages for all carryover subjects? Any manual customizations will be reset.'}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs text-slate-600"
                onClick={() => setConfirmRestoreModal(false)}
              >
                {t.cancel}
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm text-xs font-bold bg-amber-600 hover:bg-amber-700 border-amber-600"
                onClick={handleRestoreDefaults}
              >
                {isRTL ? 'نعم، استعادة الافتراضي' : 'Yes, Restore Defaults'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
