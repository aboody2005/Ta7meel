import { useState, useMemo, useCallback } from 'react';
import {
  Search, Download, Info, BookOpen, BookmarkCheck, Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';
import { STAGE_ORDER, STAGE_EN, COURSE_EN } from '../types';
import type { AcademicStage, AcademicCourse, StudentRecord } from '../types';
import { exportSubjectReport } from '../services/excelExporter';

export default function SubjectExplorer() {
  const {
    language, parsedData, subjectStageMap, subjectCourseMap,
    modifiedSubjects, setActiveView, getSubjectAssignedCourse
  } = useApp();
  const t = translations[language];
  const isAr = language === 'ar';

  const [subjectSearch, setSubjectSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<AcademicStage | 'all'>('all');
  const [courseFilter, setCourseFilter] = useState<AcademicCourse | 'all'>('all');
  const [exactMatch, setExactMatch] = useState(true);

  const allSubjects = useMemo(() => parsedData?.allSubjects ?? [], [parsedData?.allSubjects]);
  const includedStudents = useMemo(() => parsedData?.includedStudents ?? [], [parsedData?.includedStudents]);

  // Filtered subject list
  const filteredSubjects = useMemo(() => {
    if (!parsedData) return [];
    let list = allSubjects;

    if (subjectSearch.trim()) {
      const q = subjectSearch.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }

    if (courseFilter !== 'all') {
      list = list.filter(s => {
        const assignedStage = subjectStageMap[s.name] ?? s.defaultStage;
        const assignedCourse = getSubjectAssignedCourse(s.name, assignedStage);
        return assignedCourse === courseFilter;
      });
    }

    return list;
  }, [allSubjects, subjectSearch, courseFilter, subjectStageMap, getSubjectAssignedCourse, parsedData]);

  // Set default selected subject if none selected or if filtered out
  const activeSubject = useMemo(() => {
    if (selectedSubject && filteredSubjects.some(s => s.name === selectedSubject)) {
      return selectedSubject;
    }
    return filteredSubjects.length > 0 ? filteredSubjects[0].name : null;
  }, [selectedSubject, filteredSubjects]);

  // Find matching included students carrying this subject
  const matchingStudents = useMemo((): StudentRecord[] => {
    if (!parsedData || !activeSubject) return [];

    const matchesSubject = (subj: string, target: string): boolean => {
      if (exactMatch) return subj.trim().toLowerCase() === target.trim().toLowerCase();
      return subj.trim().toLowerCase().includes(target.trim().toLowerCase());
    };

    const stagePool = stageFilter === 'all'
      ? includedStudents
      : includedStudents.filter(s => s.stage === stageFilter);

    return stagePool.filter(student =>
      student.carryoverSubjects.some(s => matchesSubject(s, activeSubject))
    );
  }, [parsedData, activeSubject, includedStudents, stageFilter, exactMatch]);

  // Stage distribution for selected subject
  const stageDistribution = useMemo(() => {
    if (!parsedData || !activeSubject) return [];
    const dist: Record<AcademicStage, number> = {} as Record<AcademicStage, number>;
    matchingStudents.forEach(student => {
      dist[student.stage] = (dist[student.stage] ?? 0) + 1;
    });
    return STAGE_ORDER
      .map(stage => ({ stage, count: dist[stage] ?? 0 }))
      .filter(d => d.count > 0);
  }, [parsedData, matchingStudents, activeSubject]);

  // Retrieve the assigned course from Course Assignment data (never inferred from academic stage)
  const getSubjectAssignedCourseReal = useCallback((subjName: string, student?: StudentRecord): AcademicCourse => {
    const clean = subjName.trim();
    const cleanLower = clean.toLowerCase();

    // 1. Check direct student subjectCourses record
    if (student?.subjectCourses?.[clean] && student.subjectCourses[clean] !== 'غير محدد') {
      return student.subjectCourses[clean];
    }
    if (student?.subjectCourses?.[cleanLower] && student.subjectCourses[cleanLower] !== 'غير محدد') {
      return student.subjectCourses[cleanLower];
    }

    // 2. Check direct subjectCourseMap by subject name
    if (subjectCourseMap[clean] && subjectCourseMap[clean] !== 'غير محدد') {
      return subjectCourseMap[clean];
    }
    if (subjectCourseMap[cleanLower] && subjectCourseMap[cleanLower] !== 'غير محدد') {
      return subjectCourseMap[cleanLower];
    }

    // 3. Check any composite key in subjectCourseMap ending with ::${cleanLower}
    for (const [k, v] of Object.entries(subjectCourseMap)) {
      if ((k === clean || k.toLowerCase() === cleanLower || k.toLowerCase().endsWith(`::${cleanLower}`)) && v !== 'غير محدد') {
        return v;
      }
    }

    // 4. Check getSubjectAssignedCourse using the subject's assigned stage
    const assignedStage = subjectStageMap[clean] ?? 'المرحلة الأولى';
    const courseFromFn = getSubjectAssignedCourse(clean, assignedStage);
    if (courseFromFn && courseFromFn !== 'غير محدد') {
      return courseFromFn;
    }

    // 5. Check allSubjects array
    const foundSubj = allSubjects.find(s => s.name.trim().toLowerCase() === cleanLower);
    if (foundSubj?.course && foundSubj.course !== 'غير محدد') {
      return foundSubj.course;
    }

    return 'غير محدد';
  }, [subjectCourseMap, subjectStageMap, getSubjectAssignedCourse, allSubjects]);

  // Active subject assigned stage and course info
  const activeSubjectInfo = useMemo(() => {
    if (!activeSubject) {
      return {
        assignedStage: 'المرحلة الأولى' as AcademicStage,
        assignedCourse: 'غير محدد' as AcademicCourse,
        isModified: false,
      };
    }
    const currentSubj = allSubjects.find(s => s.name === activeSubject);
    const assignedStage = (subjectStageMap[activeSubject] ?? currentSubj?.defaultStage ?? 'المرحلة الأولى') as AcademicStage;
    const assignedCourse = getSubjectAssignedCourseReal(activeSubject);
    const isModified = Boolean(modifiedSubjects[activeSubject] || (currentSubj && assignedStage !== currentSubj.defaultStage));

    return {
      assignedStage,
      assignedCourse,
      isModified,
    };
  }, [activeSubject, allSubjects, subjectStageMap, getSubjectAssignedCourseReal, modifiedSubjects]);

  const getCourseDisplayText = (course: AcademicCourse) => {
    if (course === 'غير محدد') {
      return t.unassignedCourse;
    }
    return isAr ? course : COURSE_EN[course];
  };

  const getCourseBadgeClass = (course: AcademicCourse) => {
    if (course === 'الكورس الأول') {
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
    if (course === 'الكورس الثاني') {
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    }
    return 'bg-amber-100 text-amber-800 border border-amber-200';
  };

  if (!parsedData) return null;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span>{t.subjectExplorerTitle}</span>
          </h2>
          <span className="badge badge-blue font-bold text-xs py-1 px-2.5">
            {allSubjects.length} {t.subjectsCount}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 flex-1 sm:flex-none justify-center min-h-[36px]"
            onClick={() => setActiveView('assign-courses')}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>{t.subjectCourseAssignment}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5 border-slate-200 flex-1 sm:flex-none justify-center min-h-[36px]"
            onClick={() => setActiveView('assign-stages')}
          >
            <BookmarkCheck className="w-4 h-4 text-blue-600" />
            <span>{t.assignSubjectStages}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Subject list panel */}
        <div className="lg:col-span-4 xl:col-span-3 min-w-0">
          <div className="card overflow-hidden border border-slate-200/80">
            {/* Search and Course Filter */}
            <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.searchSubject}
                  className="input ps-9 text-xs w-full bg-white"
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                />
              </div>

              {/* Course filter select */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">{t.courseCol}:</span>
                <select
                  className="select select-sm text-xs w-full bg-white font-semibold"
                  value={courseFilter}
                  onChange={e => setCourseFilter(e.target.value as AcademicCourse | 'all')}
                >
                  <option value="all">{t.allCourses}</option>
                  <option value="الكورس الأول">{t.firstCourse}</option>
                  <option value="الكورس الثاني">{t.secondCourse}</option>
                  <option value="غير محدد">{t.unassignedCourse}</option>
                </select>
              </div>
            </div>

            {/* Subject list */}
            <div className="max-h-[42vh] sm:max-h-[50vh] lg:max-h-[62vh] overflow-y-auto">
              {filteredSubjects.length === 0 ? (
                <div className="empty-state py-8 text-center">
                  <p className="text-sm text-slate-500">{t.noResults}</p>
                </div>
              ) : (
                filteredSubjects.map(subj => {
                  const isSelected = activeSubject === subj.name;
                  const assignedStage = subjectStageMap[subj.name] ?? subj.defaultStage;
                  const assignedCourse = getSubjectAssignedCourse(subj.name, assignedStage);

                  return (
                    <button
                      key={subj.name}
                      type="button"
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 hover:bg-blue-50/50 transition-colors text-start cursor-pointer ${
                        isSelected ? 'bg-blue-50 border-s-4 border-s-blue-600' : ''
                      }`}
                      onClick={() => setSelectedSubject(subj.name)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className={`text-sm truncate ${isSelected ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`}>
                            {subj.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {isAr ? assignedStage : STAGE_EN[assignedStage]}
                            </span>
                            {assignedCourse !== 'غير محدد' && (
                              <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                assignedCourse === 'الكورس الأول' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {isAr ? assignedCourse : COURSE_EN[assignedCourse]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-blue font-bold text-xs py-0.5 px-2 flex-shrink-0">
                        {subj.studentCount} {t.studentsCount}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Subject detail panel */}
        <div className="lg:col-span-8 xl:col-span-9 min-w-0">

          {!activeSubject ? (
            <div className="card h-full flex items-center justify-center p-8">
              <div className="empty-state text-center">
                <div className="empty-state-icon mx-auto mb-2">
                  <Info className="w-6 h-6 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-700">{t.selectSubject}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Subject header */}
              <div className="card p-3.5 sm:p-4 border border-slate-200/80">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="break-words">{activeSubject}</span>
                      </h3>
                      {(() => {
                        const { assignedStage, assignedCourse, isModified } = activeSubjectInfo;

                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="badge badge-blue text-xs font-bold py-0.5 px-2.5">
                              {isAr ? `المرحلة المحمّل بها: ${assignedStage}` : `Assigned Stage: ${STAGE_EN[assignedStage]}`}
                            </span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${getCourseBadgeClass(assignedCourse)}`}>
                              {getCourseDisplayText(assignedCourse)}
                            </span>
                            {isModified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <span>{t.manuallyChangedBadge}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span>{t.defaultAssignmentBadge}</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {matchingStudents.length} {t.matchingStudents}
                    </p>
                  </div>
                  <button
                    className="btn btn-success btn-sm font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto justify-center min-h-[36px]"
                    onClick={() => {
                      exportSubjectReport(
                        activeSubject,
                        matchingStudents,
                        language,
                        activeSubjectInfo.assignedStage,
                        activeSubjectInfo.assignedCourse
                      );
                    }}
                    disabled={matchingStudents.length === 0}
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.exportBtn}</span>
                  </button>
                </div>

                {/* Filters row */}
                <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-slate-100">
                  <select
                    className="select select-sm text-xs py-1"
                    style={{ width: 'auto' }}
                    value={stageFilter}
                    onChange={e => setStageFilter(e.target.value as AcademicStage | 'all')}
                  >
                    <option value="all">{t.allStages}</option>
                    {STAGE_ORDER.map(s => (
                      <option key={s} value={s}>{isAr ? s : STAGE_EN[s]}</option>
                    ))}
                  </select>

                  <label className="checkbox-label ms-auto text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exactMatch}
                      onChange={e => setExactMatch(e.target.checked)}
                    />
                    <span>{t.exactMatch}</span>
                  </label>
                </div>
              </div>

              {/* Stage distribution */}
              {stageDistribution.length > 0 && (
                <div className="card p-3.5 sm:p-4 border border-slate-200/80">
                  <p className="text-xs font-bold text-slate-700 mb-3">{t.stageDistribution}</p>
                  <div className="space-y-2.5">
                    {stageDistribution.map(({ stage, count }) => {
                      const pct = matchingStudents.length > 0 ? Math.round((count / matchingStudents.length) * 100) : 0;
                      return (
                        <div key={stage} className="flex items-center gap-2.5 sm:gap-3">
                          <span className="text-xs font-medium text-slate-600 w-24 sm:w-28 flex-shrink-0 truncate">
                            {isAr ? stage : STAGE_EN[stage]}
                          </span>
                          <div className="progress-bar flex-1 h-2">
                            <div className="progress-bar-fill bg-blue-600" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-blue-700 w-12 text-end flex-shrink-0">
                            {count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Matching students table */}
              <div className="card overflow-hidden border border-slate-200/80 shadow-sm">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{t.matchingStudents}</span>
                  <span className="badge badge-gray text-xs">{matchingStudents.length}</span>
                </div>

                {matchingStudents.length === 0 ? (
                  <div className="empty-state py-12">
                    <p className="font-medium text-slate-600 text-sm">{t.noStudentsForSubject}</p>
                  </div>
                ) : (
                  <div className="table-wrapper border-0 max-h-96 overflow-y-auto overflow-x-auto w-full">
                    <table className="table table-compact w-full min-w-[700px]">
                      <thead>
                        <tr>
                          <th className="text-center" style={{ width: '4%' }}>{t.rowNum}</th>
                          <th className="text-start" style={{ width: '22%' }}>{t.studentName}</th>
                          <th className="text-center" style={{ width: '15%' }}>{t.currentAcademicStage}</th>
                          <th className="text-center" style={{ width: '15%' }}>{t.carryoverAcademicStage}</th>
                          <th className="text-center" style={{ width: '12%' }}>{t.courseCol}</th>
                          <th className="text-center" style={{ width: '8%' }}>{t.carryoverCountCol}</th>
                          <th className="text-start" style={{ width: '24%' }}>{t.carryoverSubjectsCol}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchingStudents.map((student, i) => {
                          const carriedStage = (student.subjectStages && student.subjectStages[activeSubject]) || activeSubjectInfo.assignedStage;
                          const assignedCourse = getSubjectAssignedCourseReal(activeSubject, student);

                          return (
                            <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="text-slate-400 text-xs font-mono text-center">
                                {i + 1}
                              </td>
                              <td className="font-bold text-slate-800 text-xs sm:text-sm break-words leading-snug text-start">
                                {student.name}
                              </td>
                              <td className="text-center">
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                                  {isAr ? student.stage : STAGE_EN[student.stage]}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className="badge badge-blue text-[11px] font-bold py-0.5 px-1.5 whitespace-nowrap">
                                  {isAr ? carriedStage : STAGE_EN[carriedStage]}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${getCourseBadgeClass(assignedCourse)}`}>
                                  {getCourseDisplayText(assignedCourse)}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                                  student.carryoverCount === 2
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {student.carryoverCount}
                                </span>
                              </td>
                              <td className="text-start">
                                <div className="flex flex-wrap gap-1">
                                  {student.carryoverSubjects.map((subj, j) => {
                                    const isCurrent = subj.trim().toLowerCase() === activeSubject.trim().toLowerCase();
                                    return (
                                      <span
                                        key={j}
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] ${
                                          isCurrent
                                            ? 'font-bold bg-blue-600 text-white shadow-xs'
                                            : 'font-medium bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {subj}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
