import React, { useState, useMemo } from 'react';
import {
  Users, BookOpen, Download, Eye,
  UserCheck, Layers, UserX, BookmarkCheck, Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';
import { STAGE_ORDER, STAGE_EN, COURSE_EN } from '../types';
import type { AcademicStage, AcademicCourse } from '../types';
import { exportStageReport, exportCompleteReport } from '../services/excelExporter';

const STAGE_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-600', icon: 'bg-blue-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', accent: 'bg-indigo-600', icon: 'bg-indigo-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-600', icon: 'bg-emerald-100' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: 'bg-amber-600', icon: 'bg-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-600', icon: 'bg-rose-100' },
];

export default function Dashboard() {
  const {
    language, parsedData, setActiveView, setSelectedStage,
    subjectStageMap, subjectCourseMap, parseOptions,
    getStudentsCarryingStage, getSubjectAssignedCourse
  } = useApp();
  const t = translations[language];
  const isAr = language === 'ar';

  // Course Filter on Dashboard: All Courses / First Course / Second Course / Unassigned
  const [courseFilter, setCourseFilter] = useState<AcademicCourse | 'all'>('all');

  if (!parsedData) return null;

  const { includedStudents, excludedStudents, allSubjects, stageGroups, parseStats } = parsedData;

  // Filtered subjects based on course filter
  const filteredSubjects = useMemo(() => {
    if (courseFilter === 'all') return allSubjects;
    return allSubjects.filter(s => {
      const assignedStage = subjectStageMap[s.name] ?? s.defaultStage;
      const assignedCourse = getSubjectAssignedCourse(s.name, assignedStage);
      return assignedCourse === courseFilter;
    });
  }, [allSubjects, courseFilter, subjectStageMap, getSubjectAssignedCourse]);

  // Overall unique students carrying subjects in current course filter
  const overallCarryingStudentsCount = useMemo(() => {
    if (courseFilter === 'all') return includedStudents.length;
    return includedStudents.filter(student =>
      student.carryoverSubjects.some(cs => {
        const clean = cs.trim();
        const stage = student.subjectStages?.[clean] ?? subjectStageMap[clean] ?? student.stage;
        const course = getSubjectAssignedCourse(clean, stage);
        return course === courseFilter;
      })
    ).length;
  }, [includedStudents, courseFilter, subjectStageMap, getSubjectAssignedCourse]);

  const summaryCards = [
    {
      label: courseFilter === 'all' ? t.totalStudents : `${t.totalStudents} (${isAr ? courseFilter : COURSE_EN[courseFilter]})`,
      value: overallCarryingStudentsCount,
      icon: <Users className="w-6 h-6" />,
      bg: 'bg-blue-50/80',
      iconBg: 'bg-blue-100',
      text: 'text-blue-700',
    },
    {
      label: t.oneSubjectStudents,
      value: parseStats.oneCarryoverStudents,
      icon: <UserCheck className="w-6 h-6" />,
      bg: 'bg-emerald-50/80',
      iconBg: 'bg-emerald-100',
      text: 'text-emerald-700',
    },
    {
      label: t.twoSubjectStudents,
      value: parseStats.twoCarryoverStudents,
      icon: <Layers className="w-6 h-6" />,
      bg: 'bg-amber-50/80',
      iconBg: 'bg-amber-100',
      text: 'text-amber-700',
    },
    {
      label: courseFilter === 'all' ? t.totalCarryoverSubjects : `${t.totalCarryoverSubjects} (${filteredSubjects.length})`,
      value: filteredSubjects.length,
      icon: <BookOpen className="w-6 h-6" />,
      bg: 'bg-purple-50/80',
      iconBg: 'bg-purple-100',
      text: 'text-purple-700',
    },
  ];

  const viewStage = (stage: AcademicStage) => {
    setSelectedStage(stage);
    setActiveView('stage');
  };

  const exportStage = (e: React.MouseEvent, stage: AcademicStage) => {
    e.stopPropagation();
    exportStageReport(
      parsedData,
      stage,
      language,
      parseOptions?.columnFields,
      subjectStageMap,
      subjectCourseMap,
      courseFilter === 'الكورس الأول' ? 'first' : courseFilter === 'الكورس الثاني' ? 'second' : 'both'
    );
  };

  const topSubjects = filteredSubjects.slice(0, 8);

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Exclusion Banner if any */}
      {excludedStudents.length > 0 && (
        <div className="alert alert-warning mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 flex-shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">{t.excludedAlertTitle}</p>
              <p className="text-xs text-amber-800 mt-0.5">
                {isAr
                  ? `يوجد ${excludedStudents.length} طلاب مسجل لهم أكثر من مادتين (> 2) تم استبعادهم تلقائياً حسب الشرط الأكاديمي للتحميل.`
                  : `There are ${excludedStudents.length} students with > 2 carryover subjects, automatically excluded per criteria.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveView('stage')}
            className="btn btn-secondary text-xs py-1.5 px-3 bg-white hover:bg-amber-50 text-amber-900 border-amber-300 w-full sm:w-auto justify-center"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isAr ? 'عرض الطلبة المستبعدين' : 'View Excluded Roster'}</span>
          </button>
        </div>
      )}

      {/* Course Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 p-3 sm:p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span>{t.filterByCourse}:</span>
          </div>
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-md font-bold transition-all min-h-[34px] ${
                courseFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setCourseFilter('all')}
            >
              {t.allCourses}
            </button>
            <button
              type="button"
              className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-md font-bold transition-all min-h-[34px] ${
                courseFilter === 'الكورس الأول'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setCourseFilter('الكورس الأول')}
            >
              {t.firstCourse}
            </button>
            <button
              type="button"
              className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-md font-bold transition-all min-h-[34px] ${
                courseFilter === 'الكورس الثاني'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setCourseFilter('الكورس الثاني')}
            >
              {t.secondCourse}
            </button>
            <button
              type="button"
              className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-md font-bold transition-all min-h-[34px] ${
                courseFilter === 'غير محدد'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setCourseFilter('غير محدد')}
            >
              {t.unassignedCourse}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm text-xs font-semibold border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 flex-1 sm:flex-none justify-center min-h-[36px]"
            onClick={() => setActiveView('assign-courses')}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.subjectCourseAssignment}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 flex-1 sm:flex-none justify-center min-h-[36px]"
            onClick={() => setActiveView('assign-stages')}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>{t.assignSubjectStages}</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {summaryCards.map((card) => (
          <div key={card.label} className={`stat-card ${card.bg} border border-slate-100`}>
            <div className={`stat-icon ${card.iconBg}`}>
              <span className={card.text}>{card.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-2xl sm:text-3xl font-extrabold ${card.text} leading-tight`}>{card.value}</p>
              <p className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5 leading-snug">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
        {/* Stage cards (Prioritizing Carryover Stage over enrolled stage) */}
        <div className="xl:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                {isAr ? 'تصنيف الطلبة حسب المرحلة الدراسية لمواد التحميل (المرحلة المحمّل بها)' : 'Student Roster Grouped by Assigned Subject Stage'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isAr
                  ? 'مرحلة التحميل هي التصنيف الأساسي، مع بيان مرحلة الطالب الحالية كمعلومة ثانوية'
                  : 'Carryover stage is primary; current student stage is secondary'}
              </p>
            </div>
            <span className="self-start sm:self-auto text-xs text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full whitespace-nowrap">
              {courseFilter === 'all' ? t.allCourses : isAr ? courseFilter : COURSE_EN[courseFilter]}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {STAGE_ORDER.map((stage, idx) => {
              // Primary: Distinct students carrying subjects assigned to this stage (matching courseFilter)
              const carryingStudents = getStudentsCarryingStage(stage, courseFilter);
              // Secondary: Students currently enrolled in this stage (from Excel raw stage)
              const enrolledStudents = stageGroups[stage] ?? [];

              const colors = STAGE_COLORS[idx];
              const oneSubj = carryingStudents.filter(s => s.carryoverCount === 1).length;
              const twoSubj = carryingStudents.filter(s => s.carryoverCount === 2).length;
              const pct = includedStudents.length > 0
                ? Math.round((carryingStudents.length / includedStudents.length) * 100)
                : 0;

              return (
                <div
                  key={stage}
                  className={`stage-card border ${colors.border} relative hover:shadow-md transition-shadow`}
                  onClick={() => viewStage(stage)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && viewStage(stage)}
                >
                  {/* Top bar */}
                  <div className={`absolute top-0 start-0 end-0 h-1.5 rounded-t-xl ${colors.accent}`} />

                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3 pt-1">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {isAr ? 'مرحلة التحميل' : 'Carryover Stage'}
                      </span>
                      <h4 className={`font-bold text-base ${colors.text}`}>
                        {isAr ? stage : STAGE_EN[stage]}
                      </h4>
                    </div>

                    {/* Primary Badge: Carrying students count */}
                    <div className="text-start sm:text-end">
                      <span className={`badge ${colors.bg} ${colors.text} border ${colors.border} font-extrabold text-xs px-2.5 py-1`}>
                        {carryingStudents.length} {t.carryingStudentsInStage}
                      </span>
                      <span className="block text-[11px] text-slate-400 mt-1 font-medium">
                        {isAr ? `(المقيدون حالياً: ${enrolledStudents.length})` : `(Enrolled: ${enrolledStudents.length})`}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="progress-bar mb-2">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>{pct}% {isAr ? 'من إجمالي الطلبة المحملين' : 'of total carryover'}</span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {isAr ? 'تصنيف أساسي: مادة التحميل' : 'Primary: Subject Stage'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs font-medium text-slate-600 mb-4 bg-slate-50/80 p-2 rounded-lg">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      {oneSubj} {t.oneSubjectBadge}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      {twoSubj} {t.twoSubjectBadge}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="btn btn-secondary btn-sm flex-1 font-medium"
                      onClick={() => viewStage(stage)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t.viewStudents}</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => exportStage(e, stage)}
                      title={t.exportStage}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top subjects with course & stage badges */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">{t.subjectSummary}</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {filteredSubjects.length} {t.subjectsCount}
            </span>
          </div>

          <div className="card overflow-hidden border border-slate-200/80">
            {topSubjects.length === 0 ? (
              <div className="empty-state py-8 text-center">
                <p className="text-slate-500 text-sm">
                  {courseFilter === 'all'
                    ? (isAr ? 'لا توجد مواد تحميل' : 'No carryover subjects')
                    : (isAr ? `لا توجد مواد معينة في ${courseFilter}` : `No subjects assigned to ${COURSE_EN[courseFilter]}`)}
                </p>
                {courseFilter !== 'all' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-xs mt-2 text-indigo-600"
                    onClick={() => setActiveView('assign-courses')}
                  >
                    {t.subjectCourseAssignment}
                  </button>
                )}
              </div>
            ) : (
              <div>
                {topSubjects.map((subj, i) => {
                  const assignedStage = subjectStageMap[subj.name] ?? subj.defaultStage;
                  const assignedCourse = getSubjectAssignedCourse(subj.name, assignedStage);

                  return (
                    <div
                      key={subj.name}
                      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => setActiveView('subject-explorer')}
                    >
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{subj.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                            {isAr ? assignedStage : STAGE_EN[assignedStage]}
                          </span>
                          {assignedCourse !== 'غير محدد' ? (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                              assignedCourse === 'الكورس الأول'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {isAr ? assignedCourse : COURSE_EN[assignedCourse]}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                              {t.unassignedCourse}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-base font-extrabold text-blue-700">{subj.studentCount}</span>
                        <span className="text-xs text-slate-400 ms-1">{t.studentsCount}</span>
                      </div>
                    </div>
                  );
                })}
                {filteredSubjects.length > 8 && (
                  <button
                    className="w-full text-center py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-100"
                    onClick={() => setActiveView('subject-explorer')}
                  >
                    {isAr ? `عرض جميع مواد التحميل (${filteredSubjects.length})` : `View all (${filteredSubjects.length})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick export & actions */}
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="btn btn-secondary w-full shadow-xs text-xs flex items-center justify-center gap-1.5 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 min-h-[42px]"
              onClick={() => setActiveView('assign-courses')}
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>{t.subjectCourseAssignment}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary w-full shadow-xs text-xs flex items-center justify-center gap-1.5 border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100/60 min-h-[42px]"
              onClick={() => setActiveView('assign-stages')}
            >
              <BookmarkCheck className="w-4 h-4 text-blue-600" />
              <span>{t.carryoverSubjectStageControl}</span>
            </button>
            <button
              className="btn btn-primary w-full shadow-sm bg-blue-600 hover:bg-blue-700 min-h-[42px]"
              onClick={() => exportCompleteReport(parsedData, language, parseOptions?.columnFields, subjectStageMap, subjectCourseMap)}
            >
              <Download className="w-4 h-4" />
              <span>{t.exportComplete}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

