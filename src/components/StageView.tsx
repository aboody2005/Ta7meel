// =============================================
// Stage View Component - Student Carryover Table
// =============================================

import { useState, useMemo } from 'react';
import {
  Search, Download, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, AlertTriangle, AlertCircle,
  X, CheckCircle2, UserX, Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';
import { STAGE_ORDER, STAGE_EN } from '../types';
import type { AcademicStage, AcademicCourse, CourseExportChoice } from '../types';
import { exportStageReport } from '../services/excelExporter';

const PAGE_SIZES = [25, 50, 100];

type SortField = 'original' | 'name' | 'carryoverCount' | 'stage';
type SortDir = 'asc' | 'desc';
type CountFilter = 'all-included' | '1' | '2' | '0' | 'excluded' | 'mismatch' | 'all';

interface Props {
  stage?: AcademicStage;
}

function SubjectBadgeList({
  subjects,
  subjectStageMap,
  isRTL,
  getSubjectAssignedCourse,
}: {
  subjects: string[];
  subjectStageMap: Record<string, AcademicStage>;
  isRTL: boolean;
  getSubjectAssignedCourse: (subj: string, stage?: AcademicStage) => AcademicCourse;
}) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 4;

  if (!subjects || subjects.length === 0) {
    return <span className="text-slate-400 text-xs italic">— لا توجد مواد مسجلة —</span>;
  }

  const shown = expanded ? subjects : subjects.slice(0, MAX);

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {shown.map((s, i) => {
        const cleanName = s.trim();
        const assignedStage = subjectStageMap[cleanName] ?? 'المرحلة الأولى';
        const assignedCourse = getSubjectAssignedCourse(cleanName, assignedStage);

        let courseColor = 'bg-slate-200 text-slate-700';
        if (assignedCourse === 'الكورس الأول') courseColor = 'bg-blue-200/80 text-blue-800';
        if (assignedCourse === 'الكورس الثاني') courseColor = 'bg-purple-200/80 text-purple-800';

        return (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-900 border border-blue-200"
          >
            <span className="font-semibold">{s}</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-blue-200/70 text-blue-800 font-bold">
              {isRTL ? assignedStage : STAGE_EN[assignedStage]}
            </span>
            {assignedCourse !== 'غير محدد' && (
              <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${courseColor}`}>
                {isRTL ? (assignedCourse === 'الكورس الأول' ? 'ك1' : 'ك2') : (assignedCourse === 'الكورس الأول' ? 'C1' : 'C2')}
              </span>
            )}
          </span>
        );
      })}
      {subjects.length > MAX && (
        <button
          type="button"
          className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <X className="w-3 h-3" /> : `+${subjects.length - MAX}`}
        </button>
      )}
    </div>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-blue-600" />
    : <ChevronDown className="w-3 h-3 text-blue-600" />;
}

export default function StageView({ stage: stageProp }: Props) {
  const {
    language,
    parsedData,
    selectedStage,
    setActiveView,
    subjectStageMap,
    subjectCourseMap,
    parseOptions,
    getSubjectAssignedCourse,
  } = useApp();

  const t = translations[language];
  const isAr = language === 'ar';
  const isRTL = isAr;

  const stage = stageProp ?? selectedStage;

  const [search, setSearch] = useState('');
  const [countFilter, setCountFilter] = useState<CountFilter>('all-included');
  const [courseFilter, setCourseFilter] = useState<AcademicCourse | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('original');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [stageFilter, setStageFilter] = useState<AcademicStage | 'all'>('all');
  const [classificationMode, setClassificationMode] = useState<'by-subject-stage' | 'by-student-stage'>('by-subject-stage');
  const [showExportModal, setShowExportModal] = useState(false);

  // Base list of all student records
  const allStudents = useMemo(() => parsedData?.students ?? [], [parsedData?.students]);

  // Filter students
  const filtered = useMemo(() => {
    if (!parsedData) return [];
    let result = [...allStudents];

    const targetStage = stage || (stageFilter !== 'all' ? stageFilter : null);

    // Stage filter
    if (targetStage) {
      if (classificationMode === 'by-subject-stage') {
        result = result.filter(s =>
          s.carryoverSubjects.some(cs => {
            const clean = cs.trim();
            const subjStage = s.subjectStages?.[clean] ?? subjectStageMap[clean] ?? s.stage;
            if (subjStage !== targetStage) return false;

            if (courseFilter !== 'all') {
              const subjCourse = getSubjectAssignedCourse(clean, subjStage);
              if (subjCourse !== courseFilter) return false;
            }

            return true;
          })
        );
      } else {
        result = result.filter(s => s.stage === targetStage);
        if (courseFilter !== 'all') {
          result = result.filter(s =>
            s.carryoverSubjects.some(cs => {
              const clean = cs.trim();
              const subjStage = s.subjectStages?.[clean] ?? subjectStageMap[clean] ?? s.stage;
              return getSubjectAssignedCourse(clean, subjStage) === courseFilter;
            })
          );
        }
      }
    } else if (courseFilter !== 'all') {
      result = result.filter(s =>
        s.carryoverSubjects.some(cs => {
          const clean = cs.trim();
          const subjStage = s.subjectStages?.[clean] ?? subjectStageMap[clean] ?? s.stage;
          return getSubjectAssignedCourse(clean, subjStage) === courseFilter;
        })
      );
    }

    // Inclusion / Count filter
    if (countFilter === 'all-included') {
      result = result.filter(s => !s.isExcluded);
    } else if (countFilter === '1') {
      result = result.filter(s => s.carryoverCount === 1);
    } else if (countFilter === '2') {
      result = result.filter(s => s.carryoverCount === 2);
    } else if (countFilter === '0') {
      result = result.filter(s => s.carryoverCount === 0);
    } else if (countFilter === 'excluded') {
      result = result.filter(s => s.isExcluded);
    } else if (countFilter === 'mismatch') {
      result = result.filter(s => s.hasCountMismatch);
    }

    // Search query (Student Name or Subject Name)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.carryoverSubjects.some(subj => subj.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortField !== 'original') {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') cmp = a.name.localeCompare(b.name, isAr ? 'ar' : 'en');
        if (sortField === 'carryoverCount') cmp = a.carryoverCount - b.carryoverCount;
        if (sortField === 'stage') cmp = a.stage.localeCompare(b.stage, isAr ? 'ar' : 'en');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [allStudents, stage, stageFilter, classificationMode, subjectStageMap, courseFilter, countFilter, search, sortField, sortDir, isAr, parsedData, getSubjectAssignedCourse]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const stageTitle = stage
    ? (isAr
        ? `${classificationMode === 'by-subject-stage' ? 'مواد ' : ''}${stage}`
        : `${STAGE_EN[stage]} ${classificationMode === 'by-subject-stage' ? 'Subjects' : ''}`)
    : (isAr ? 'سجل طلبة مواد التحميل' : 'Carryover Students Roster');

  const handleExportChoice = (choice: CourseExportChoice) => {
    if (!stage || !parsedData) return;
    exportStageReport(
      parsedData,
      stage,
      language,
      parseOptions?.columnFields,
      subjectStageMap,
      subjectCourseMap,
      choice
    );
    setShowExportModal(false);
  };

  if (!parsedData) return null;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-slate-600 hover:text-slate-900"
            onClick={() => setActiveView('dashboard')}
          >
            {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {t.dashboard}
          </button>
          <span className="text-slate-300">/</span>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800">{stageTitle}</h2>
          <span className="badge badge-blue font-bold text-xs py-1 px-2.5">
            {filtered.length} {t.studentsCount}
          </span>
        </div>

        {stage && (
          <div className="relative w-full sm:w-auto">
            <button
              className="btn btn-success btn-sm font-bold flex items-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto justify-center min-h-[36px]"
              onClick={() => setShowExportModal(true)}
            >
              <Download className="w-4 h-4" />
              <span>{t.exportStage}</span>
            </button>

            {/* Export Choice Modal / Dropdown */}
            {showExportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl max-w-md w-full p-4 sm:p-6 border border-slate-200 animate-fadeIn max-h-[92vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2 min-w-0">
                      <Download className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate">{t.exportStyledStageReport}</span>
                    </h3>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600 p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                      onClick={() => setShowExportModal(false)}
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mb-4">
                    {t.exportStyledStageReportDesc}
                  </p>

                  <div className="space-y-2.5 mb-5 sm:mb-6">
                    <button
                      type="button"
                      className="w-full text-start p-3 sm:p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 transition-colors flex items-center justify-between gap-2"
                      onClick={() => handleExportChoice('both')}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-indigo-900">{t.bothCourses}</p>
                        <p className="text-[11px] text-indigo-700 mt-0.5 line-clamp-2">{t.bothCoursesDesc}</p>
                      </div>
                      <span className="badge badge-blue text-[11px] sm:text-xs font-bold flex-shrink-0">{isAr ? 'النموذج الكامل' : 'Full'}</span>
                    </button>

                    <button
                      type="button"
                      className="w-full text-start p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                      onClick={() => handleExportChoice('first')}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-slate-800">{t.firstCourseOnly}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{isAr ? 'تصدير جدول الكورس الأول فقط في أعلى الورقة' : 'Export First Course table only'}</p>
                      </div>
                      <span className="badge bg-blue-100 text-blue-700 text-[11px] sm:text-xs font-bold flex-shrink-0">{t.firstCourse}</span>
                    </button>

                    <button
                      type="button"
                      className="w-full text-start p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                      onClick={() => handleExportChoice('second')}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-slate-800">{t.secondCourseOnly}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{isAr ? 'تصدير جدول الكورس الثاني فقط في أعلى الورقة' : 'Export Second Course table only'}</p>
                      </div>
                      <span className="badge bg-purple-100 text-purple-700 text-[11px] sm:text-xs font-bold flex-shrink-0">{t.secondCourse}</span>
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm min-h-[38px] w-full sm:w-auto justify-center"
                      onClick={() => setShowExportModal(false)}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Classification Mode Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4 p-3 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-bold text-slate-700">{isRTL ? 'أساس التصنيف:' : 'Classification basis:'}</span>
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            <button
              type="button"
              className={`text-xs px-2.5 py-1.5 rounded-md font-semibold transition-all min-h-[32px] ${
                classificationMode === 'by-subject-stage'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setClassificationMode('by-subject-stage')}
            >
              {isRTL ? 'حسب المرحلة الدراسية للمادة (المعتمدة)' : 'By Assigned Subject Stage'}
            </button>
            <button
              type="button"
              className={`text-xs px-2.5 py-1.5 rounded-md font-semibold transition-all min-h-[32px] ${
                classificationMode === 'by-student-stage'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setClassificationMode('by-student-stage')}
            >
              {isRTL ? 'حسب المرحلة الحالية للطالب' : 'By Student Current Stage'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-xs text-indigo-700 hover:bg-indigo-50 flex-1 sm:flex-none justify-center min-h-[32px]"
            onClick={() => setActiveView('assign-courses')}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.subjectCourseAssignment}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-xs text-blue-700 hover:bg-blue-50 flex-1 sm:flex-none justify-center min-h-[32px]"
            onClick={() => setActiveView('assign-stages')}
          >
            <span>{t.carryoverSubjectStageControl}</span>
            {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-3 sm:p-4 mb-4 sm:mb-5 border border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input input-sm ps-9 w-full text-xs"
            />
          </div>

          {/* Stage filter if no stage prop */}
          {!stage && (
            <div>
              <select
                className="select select-sm w-full text-xs"
                value={stageFilter}
                onChange={e => { setStageFilter(e.target.value as AcademicStage | 'all'); setPage(1); }}
              >
                <option value="all">{t.allStages}</option>
                {STAGE_ORDER.map(s => (
                  <option key={s} value={s}>{isAr ? s : STAGE_EN[s]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Course filter */}
          <div>
            <select
              className="select select-sm w-full text-xs font-semibold"
              value={courseFilter}
              onChange={e => { setCourseFilter(e.target.value as AcademicCourse | 'all'); setPage(1); }}
            >
              <option value="all">{t.allCourses}</option>
              <option value="الكورس الأول">{t.firstCourse}</option>
              <option value="الكورس الثاني">{t.secondCourse}</option>
              <option value="غير محدد">{t.unassignedCourse}</option>
            </select>
          </div>

          {/* Count filter */}
          <div>
            <select
              className="select select-sm w-full text-xs"
              value={countFilter}
              onChange={e => { setCountFilter(e.target.value as CountFilter); setPage(1); }}
            >
              <option value="all-included">{t.allIncluded}</option>
              <option value="1">{t.onlyOne}</option>
              <option value="2">{t.onlyTwo}</option>
              <option value="0">{t.onlyZero}</option>
              <option value="excluded">{t.showExcluded}</option>
              <option value="mismatch">{t.showMismatches}</option>
              <option value="all">{isAr ? 'عرض كل السجلات (بلا استثناء)' : 'All records'}</option>
            </select>
          </div>
        </div>

        {/* Sort shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-semibold">{t.sortBy}:</span>
          {[
            { field: 'original' as const, label: t.defaultOrder },
            { field: 'name' as const, label: t.sortByName },
            { field: 'carryoverCount' as const, label: t.sortByCount },
            { field: 'stage' as const, label: t.sortByStage },
          ].map(opt => (
            <button
              key={opt.field}
              type="button"
              className={`btn btn-sm text-xs ${sortField === opt.field ? 'btn-primary' : 'btn-secondary'} min-h-[30px]`}
              onClick={() => toggleSort(opt.field)}
            >
              <span>{opt.label}</span>
              {sortField === opt.field && <SortIcon field={opt.field} sortField={sortField} sortDir={sortDir} />}
            </button>
          ))}
        </div>
      </div>

      {/* Table - Columns aligned with Reference Template */}
      <div className="table-wrapper mb-4 border border-slate-200/80 shadow-sm rounded-xl overflow-x-auto w-full bg-white">
        <table className="table w-full min-w-[760px]">
          <thead>
            <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-200">
              <th style={{ width: '3.5rem' }} className="text-center">{t.rowNum}</th>
              <th
                className="cursor-pointer select-none hover:text-slate-900"
                onClick={() => toggleSort('name')}
              >
                <span className="flex items-center gap-1 font-bold">
                  {t.studentName}
                  <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="cursor-pointer select-none hover:text-slate-900"
                onClick={() => toggleSort('stage')}
              >
                <span className="flex items-center gap-1 font-bold">
                  {isRTL ? 'المرحلة الحالية للطالب' : 'Student Current Stage'}
                  <SortIcon field="stage" sortField={sortField} sortDir={sortDir} />
                </span>
              </th>
              <th>
                <span className="font-bold">{t.carryoverSubjectsCol}</span>
              </th>
              <th className="text-center">
                <span className="font-bold">{isRTL ? 'المرحلة الدراسية المحمّل بها' : 'Assigned Subject Stage'}</span>
              </th>
              <th
                className="cursor-pointer select-none hover:text-slate-900 text-center"
                style={{ width: '9rem' }}
                onClick={() => toggleSort('carryoverCount')}
              >
                <span className="inline-flex items-center gap-1 font-bold">
                  {t.carryoverCountCol}
                  <SortIcon field="carryoverCount" sortField={sortField} sortDir={sortDir} />
                </span>
              </th>
              <th style={{ width: '10rem' }} className="text-center">
                <span className="font-bold">{t.statusCol}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state py-12 text-center">
                    <div className="empty-state-icon mx-auto mb-2">
                      <Search className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="font-bold text-slate-700">{t.noResults}</p>
                    <p className="text-sm text-slate-400 mt-1">{t.noResultsDesc}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((student, i) => {
                const isOver = student.isExcluded;
                const isMismatch = student.hasCountMismatch;

                // Carryover stages assigned to student's subjects
                const assignedStages = student.carryoverSubjects.map(cs => {
                  const clean = cs.trim();
                  return student.subjectStages?.[clean] ?? subjectStageMap[clean] ?? student.stage;
                });
                const primaryAssignedStage = assignedStages[0] || stage || student.stage;

                return (
                  <tr
                    key={student.id}
                    className={`transition-colors ${
                      isOver
                        ? 'bg-rose-50/40 hover:bg-rose-50/70'
                        : isMismatch
                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="text-slate-400 text-xs font-mono font-medium text-center">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                        {student.isDuplicate && (
                          <span title={t.warnDuplicate}>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-blue text-xs font-bold">
                        {isRTL ? student.stage : STAGE_EN[student.stage]}
                      </span>
                    </td>
                    <td>
                      <SubjectBadgeList
                        subjects={student.carryoverSubjects}
                        subjectStageMap={subjectStageMap}
                        isRTL={isRTL}
                        getSubjectAssignedCourse={getSubjectAssignedCourse}
                      />
                    </td>
                    <td className="text-center font-bold text-slate-700 text-xs">
                      {isRTL ? primaryAssignedStage : STAGE_EN[primaryAssignedStage]}
                    </td>
                    <td className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold ${
                          isOver
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : student.carryoverCount === 2
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : student.carryoverCount === 1
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {student.carryoverCount}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {isOver ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <UserX className="w-3 h-3 text-rose-600 flex-shrink-0" />
                            <span>{t.excludedBadge}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            <span>{t.countMatchBadge}</span>
                          </span>
                        )}

                        {isMismatch && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200"
                            title={`العدد بالملف: ${student.carryoverCount}، عدد المواد المستخرجة: ${student.carryoverSubjects.length}`}
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                            <span>{t.countMismatchBadge}</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="text-center sm:text-start">
          {t.showingOf
            .replace('{from}', String(Math.min((page - 1) * pageSize + 1, filtered.length)))
            .replace('{to}', String(Math.min(page * pageSize, filtered.length)))
            .replace('{total}', String(filtered.length))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">{t.perPage}:</span>
            <select
              className="select select-sm text-xs py-1"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex gap-1">
            <button
              className="btn btn-secondary btn-sm min-h-[34px]"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              <span>{t.previous}</span>
            </button>
            <span className="px-2 py-1 font-bold text-slate-700 flex items-center">
              {page} / {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm min-h-[34px]"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <span>{t.next}</span>
              {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
