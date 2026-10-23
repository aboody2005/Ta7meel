// =============================================
// Subject Course Assigner Component (First / Second Course)
// =============================================

import { useState, useMemo, useEffect } from 'react';
import {
  BookOpen, Save, Search, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';
import { STAGE_ORDER, STAGE_EN, getSubjectCourseKey } from '../types';
import type { AcademicStage, AcademicCourse, SubjectCourseMap } from '../types';

export default function SubjectCourseAssigner() {
  const {
    language,
    parsedData,
    subjectStageMap,
    subjectCourseMap,
    saveSubjectCourseAssignments,
    hasUnsavedCourseChanges,
    setHasUnsavedCourseChanges,
  } = useApp();

  const t = translations[language];
  const isAr = language === 'ar';

  // Selected stage in this control panel (defaults to first stage with subjects, or First Stage)
  const [activeStage, setActiveStage] = useState<AcademicStage>('المرحلة الثالثة');

  // Search and Course filters
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<AcademicCourse | 'all'>('all');

  // Local draft mapping for pending edits before clicking "Save Course Assignments"
  const [draftMap, setDraftMap] = useState<SubjectCourseMap>({});
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

  // Sync draft map whenever global subjectCourseMap changes
  useEffect(() => {
    setDraftMap({ ...subjectCourseMap });
    setHasUnsavedCourseChanges(false);
  }, [subjectCourseMap, setHasUnsavedCourseChanges]);

  // Set default active stage if currently selected stage has no subjects
  useEffect(() => {
    if (!parsedData) return;
    const hasSubjects = parsedData.allSubjects.some(
      s => (subjectStageMap[s.name] ?? s.defaultStage) === activeStage
    );
    if (!hasSubjects) {
      const firstWithSubjs = STAGE_ORDER.find(stage =>
        parsedData.allSubjects.some(s => (subjectStageMap[s.name] ?? s.defaultStage) === stage)
      );
      if (firstWithSubjs) {
        setActiveStage(firstWithSubjs);
      }
    }
  }, [parsedData, subjectStageMap, activeStage]);

  if (!parsedData) return null;

  // Helper to get effective course for a subject in a stage
  const getSubjectCourse = (subjName: string, stage: AcademicStage): AcademicCourse => {
    const key = getSubjectCourseKey(subjName, stage);
    if (draftMap[key]) return draftMap[key];
    if (draftMap[subjName.toLowerCase()]) return draftMap[subjName.toLowerCase()];
    if (draftMap[subjName]) return draftMap[subjName];
    const found = parsedData.allSubjects.find(s => s.name.trim().toLowerCase() === subjName.trim().toLowerCase());
    return found?.course ?? 'غير محدد';
  };

  // Subjects belonging to the selected stage
  const stageSubjects = useMemo(() => {
    return parsedData.allSubjects.filter(s => {
      const assigned = subjectStageMap[s.name] ?? s.defaultStage;
      return assigned === activeStage;
    });
  }, [parsedData.allSubjects, subjectStageMap, activeStage]);

  // Counts per stage for tabs
  const stageCounts = useMemo(() => {
    const counts: Record<AcademicStage, { total: number; unassigned: number }> = {
      'المرحلة الأولى': { total: 0, unassigned: 0 },
      'المرحلة الثانية': { total: 0, unassigned: 0 },
      'المرحلة الثالثة': { total: 0, unassigned: 0 },
      'المرحلة الرابعة': { total: 0, unassigned: 0 },
      'المرحلة الخامسة': { total: 0, unassigned: 0 },
      'غير محدد': { total: 0, unassigned: 0 },
    };

    parsedData.allSubjects.forEach(s => {
      const stg = subjectStageMap[s.name] ?? s.defaultStage;
      if (counts[stg]) {
        counts[stg].total++;
        const course = getSubjectCourse(s.name, stg);
        if (course === 'غير محدد') {
          counts[stg].unassigned++;
        }
      }
    });

    return counts;
  }, [parsedData.allSubjects, subjectStageMap, draftMap]);

  // Filtered subjects for current stage
  const filteredSubjects = useMemo(() => {
    let result = [...stageSubjects];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }

    if (courseFilter !== 'all') {
      result = result.filter(s => getSubjectCourse(s.name, activeStage) === courseFilter);
    }

    return result;
  }, [stageSubjects, search, courseFilter, activeStage, draftMap]);

  // Update a single subject's course
  const setSingleSubjectCourse = (subjName: string, course: AcademicCourse) => {
    const key = getSubjectCourseKey(subjName, activeStage);
    setDraftMap(prev => ({
      ...prev,
      [key]: course,
      [subjName]: course,
      [subjName.toLowerCase()]: course,
    }));
    setHasUnsavedCourseChanges(true);
    setSaveSuccessMessage(false);
  };

  // Bulk assign selected subjects to a course
  const handleBulkAssign = (course: AcademicCourse) => {
    if (selectedSubjects.size === 0) return;
    setDraftMap(prev => {
      const next = { ...prev };
      selectedSubjects.forEach(name => {
        const key = getSubjectCourseKey(name, activeStage);
        next[key] = course;
        next[name] = course;
        next[name.toLowerCase()] = course;
      });
      return next;
    });
    setHasUnsavedCourseChanges(true);
    setSaveSuccessMessage(false);
  };

  // Selection toggle
  const toggleSelect = (name: string) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSubjects(new Set(filteredSubjects.map(s => s.name)));
  };

  const deselectAll = () => {
    setSelectedSubjects(new Set());
  };

  // Save changes
  const handleSave = () => {
    saveSubjectCourseAssignments(draftMap);
    setSaveSuccessMessage(true);
    setHasUnsavedCourseChanges(false);
    setTimeout(() => {
      setSaveSuccessMessage(false);
    }, 4500);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <span>{t.subjectCourseAssignment}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t.subjectCourseAssignmentDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {hasUnsavedCourseChanges && (
            <span className="badge badge-amber text-xs font-bold py-1 px-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isAr ? 'تعديلات معلقة غير محفوظة' : 'Unsaved changes'}</span>
            </span>
          )}

          <button
            type="button"
            className="btn btn-primary shadow-sm flex items-center gap-2 px-4 sm:px-5 py-2 font-bold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 min-h-[38px] flex-1 sm:flex-none justify-center"
            onClick={handleSave}
            disabled={!hasUnsavedCourseChanges}
          >
            <Save className="w-4 h-4" />
            <span>{t.saveCourseAssignments}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMessage && (
        <div className="alert alert-success p-3.5 sm:p-4 border border-emerald-200 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-emerald-900 text-sm">
              {t.courseAssignmentsSavedSuccess}
            </p>
          </div>
        </div>
      )}

      {/* Stage Selector Tabs (المرحلة الأولى إلى المرحلة الخامسة) */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-2">
          {isAr ? 'اختر المرحلة الدراسية لمواد التحميل:' : 'Select Academic Stage for Carryover Subjects:'}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
          {STAGE_ORDER.map(stage => {
            const countInfo = stageCounts[stage];
            const isSelected = activeStage === stage;
            return (
              <button
                key={stage}
                type="button"
                className={`p-2.5 sm:p-3 rounded-xl border text-start transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setActiveStage(stage);
                  setSelectedSubjects(new Set());
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-bold text-xs sm:text-sm truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {isAr ? stage : STAGE_EN[stage]}
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold flex-shrink-0 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {countInfo.total}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  {countInfo.unassigned > 0 ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block flex-shrink-0" />
                      <span>{countInfo.unassigned} {isAr ? 'غير محدد' : 'unassigned'}</span>
                    </span>
                  ) : countInfo.total > 0 ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <span>{isAr ? 'مكتمل' : 'All set'}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">
                      {isAr ? 'لا توجد مواد' : 'No subjects'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="card overflow-hidden border border-slate-200/80 shadow-sm">
        {/* Table Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[200px] w-full">
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs w-full">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={isAr ? 'بحث عن مادة في هذه المرحلة...' : 'Search subjects in this stage...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input input-sm ps-9 w-full bg-white text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs w-full sm:w-auto">
              <span className="px-1.5 text-slate-500 font-medium">{t.filterByCourse}:</span>
              <button
                type="button"
                className={`px-2 py-1 rounded-md font-semibold transition-all min-h-[30px] ${
                  courseFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setCourseFilter('all')}
              >
                {t.allCourses}
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-md font-semibold transition-all min-h-[30px] ${
                  courseFilter === 'الكورس الأول'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setCourseFilter('الكورس الأول')}
              >
                {t.firstCourse}
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-md font-semibold transition-all min-h-[30px] ${
                  courseFilter === 'الكورس الثاني'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setCourseFilter('الكورس الثاني')}
              >
                {t.secondCourse}
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-md font-semibold transition-all min-h-[30px] ${
                  courseFilter === 'غير محدد'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setCourseFilter('غير محدد')}
              >
                {t.unassignedCourse}
              </button>
            </div>
          </div>

          {/* Bulk Assign Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium">
              {t.selectedSubjectsCount.replace('{count}', String(selectedSubjects.size))}
            </span>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 w-full sm:w-auto">
              <button
                type="button"
                className="btn btn-secondary btn-sm text-xs py-1 px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50 flex-1 sm:flex-none justify-center min-h-[30px]"
                onClick={() => handleBulkAssign('الكورس الأول')}
                disabled={selectedSubjects.size === 0}
                title={t.assignToFirstCourse}
              >
                {t.assignToFirstCourse}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm text-xs py-1 px-2.5 border-purple-200 text-purple-700 hover:bg-purple-50 flex-1 sm:flex-none justify-center min-h-[30px]"
                onClick={() => handleBulkAssign('الكورس الثاني')}
                disabled={selectedSubjects.size === 0}
                title={t.assignToSecondCourse}
              >
                {t.assignToSecondCourse}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs py-1 px-2 text-slate-500 hover:text-rose-600 flex-1 sm:flex-none justify-center min-h-[30px]"
                onClick={() => handleBulkAssign('غير محدد')}
                disabled={selectedSubjects.size === 0}
                title={t.unassignCourse}
              >
                {t.unassignCourse}
              </button>
            </div>
          </div>
        </div>

        {/* Subjects Table */}
        <div className="table-wrapper border-0 overflow-x-auto w-full">
          {filteredSubjects.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">
                {stageSubjects.length === 0 ? t.noSubjectsInStage : t.noResults}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {stageSubjects.length === 0
                  ? isAr
                    ? 'يمكنك تعيين مواد لهذه المرحلة من خلال "لوحة تحكم مراحل مواد التحميل".'
                    : 'You can assign subjects to this stage in the Subject Stage Control panel.'
                  : t.noResultsDesc}
              </p>
            </div>
          ) : (
            <table className="w-full text-start text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedSubjects.size === filteredSubjects.length && filteredSubjects.length > 0}
                      onChange={e => e.target.checked ? selectAll() : deselectAll()}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 text-start">{t.subjectNameCol}</th>
                  <th className="p-3 text-center">{t.assignedSubjectStageCol}</th>
                  <th className="p-3 text-center">{t.carryingStudentsCountCol}</th>
                  <th className="p-3 text-center">{t.courseCol}</th>
                  <th className="p-3 text-center w-60">{isAr ? 'تعيين الكورس' : 'Assign Course'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubjects.map((s, idx) => {
                  const currentCourse = getSubjectCourse(s.name, activeStage);
                  const isChecked = selectedSubjects.has(s.name);

                  let courseBadge = (
                    <span className="badge badge-amber text-[11px] font-bold py-0.5 px-2.5">
                      {t.unassignedCourse}
                    </span>
                  );
                  if (currentCourse === 'الكورس الأول') {
                    courseBadge = (
                      <span className="badge badge-blue text-[11px] font-bold py-0.5 px-2.5 bg-blue-100 text-blue-800 border-blue-200">
                        {t.firstCourse}
                      </span>
                    );
                  } else if (currentCourse === 'الكورس الثاني') {
                    courseBadge = (
                      <span className="badge badge-purple text-[11px] font-bold py-0.5 px-2.5 bg-purple-100 text-purple-800 border-purple-200">
                        {t.secondCourse}
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={s.name}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isChecked ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(s.name)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-3 text-start font-bold text-slate-800">
                        {s.name}
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-600">
                        {isAr ? activeStage : STAGE_EN[activeStage]}
                      </td>
                      <td className="p-3 text-center font-extrabold text-blue-700">
                        {s.studentCount}
                      </td>
                      <td className="p-3 text-center">
                        {courseBadge}
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                              currentCourse === 'الكورس الأول'
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-blue-700 hover:bg-white'
                            }`}
                            onClick={() => setSingleSubjectCourse(s.name, 'الكورس الأول')}
                          >
                            {t.firstCourse}
                          </button>
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                              currentCourse === 'الكورس الثاني'
                                ? 'bg-purple-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-purple-700 hover:bg-white'
                            }`}
                            onClick={() => setSingleSubjectCourse(s.name, 'الكورس الثاني')}
                          >
                            {t.secondCourse}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {isAr
              ? `عرض ${filteredSubjects.length} من إجمالي ${stageSubjects.length} مادة للمرحلة المختارة.`
              : `Showing ${filteredSubjects.length} of ${stageSubjects.length} subjects for selected stage.`}
          </p>

          <button
            type="button"
            className="btn btn-primary btn-sm flex items-center gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSave}
            disabled={!hasUnsavedCourseChanges}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t.saveCourseAssignments}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
