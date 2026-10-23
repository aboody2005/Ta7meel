// =============================================
// Export Reports Component
// =============================================

import { useState } from 'react';
import {
  Download, FileSpreadsheet, Layers, BookOpen, UserX
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../i18n/translations';
import { STAGE_ORDER, STAGE_EN } from '../types';
import {
  exportCompleteReport,
  exportSubjectSummary,
  exportCourseReport,
  exportStyledStageReport,
} from '../services/excelExporter';

export default function ExportReports() {
  const {
    language,
    parsedData,
    parseOptions,
    subjectStageMap,
    subjectCourseMap,
    getStudentsCarryingStage,
  } = useApp();

  const t = translations[language];
  const isAr = language === 'ar';
  const [exporting, setExporting] = useState<string | null>(null);
  const columnFields = parseOptions?.columnFields;

  if (!parsedData) return null;

  const doExport = (key: string, fn: () => Promise<void>) => {
    setExporting(key);
    setTimeout(async () => {
      try {
        await fn();
      } catch (err) {
        console.error('Export error:', err);
      } finally {
        setExporting(null);
      }
    }, 100);
  };

  const exportCards = [
    {
      key: 'complete',
      icon: <Layers className="w-6 h-6 text-blue-600" />,
      bg: 'bg-blue-50',
      title: t.exportComplete,
      desc: t.exportCompleteDesc,
      count: `${parsedData.includedStudents.length} ${t.studentsCount} (${t.includedBadge})`,
      action: () => doExport('complete', () => exportCompleteReport(parsedData, language, columnFields, subjectStageMap, subjectCourseMap)),
    },
    {
      key: 'course-first',
      icon: <FileSpreadsheet className="w-6 h-6 text-indigo-600" />,
      bg: 'bg-indigo-50',
      title: isAr ? 'تقرير الكورس الأول لجميع المراحل' : 'All Stages – First Course Report',
      desc: isAr
      ? 'تصدير مصنف Excel لجميع المراحل يتضمن فقط مواد وطلبة الكورس الأول'
      : 'Export workbook for all stages containing First Course carryover records only',
      count: isAr ? 'الكورس الأول فقط' : 'First Course Only',
      action: () => doExport('course-first', () => exportCourseReport(parsedData, 'الكورس الأول', language, columnFields, subjectStageMap, subjectCourseMap)),
    },
    {
      key: 'course-second',
      icon: <FileSpreadsheet className="w-6 h-6 text-purple-600" />,
      bg: 'bg-purple-50',
      title: isAr ? 'تقرير الكورس الثاني لجميع المراحل' : 'All Stages – Second Course Report',
      desc: isAr
      ? 'تصدير مصنف Excel لجميع المراحل يتضمن فقط مواد وطلبة الكورس الثاني'
      : 'Export workbook for all stages containing Second Course carryover records only',
      count: isAr ? 'الكورس الثاني فقط' : 'Second Course Only',
      action: () => doExport('course-second', () => exportCourseReport(parsedData, 'الكورس الثاني', language, columnFields, subjectStageMap, subjectCourseMap)),
    },
    {
      key: 'subjects',
      icon: <BookOpen className="w-6 h-6 text-emerald-600" />,
      bg: 'bg-emerald-50',
      title: t.exportSubjectSummary,
      desc: isAr ? 'ملخص جميع مواد التحميل وتوزيع أعداد الطلبة وتصنيف الكورسات عبر المراحل الخمس' : 'Summary of all carryover subjects across all 5 stages with course classification',
      count: `${parsedData.parseStats.distinctSubjects} ${t.subjectsCount}`,
      action: () => doExport('subjects', () => exportSubjectSummary(parsedData, language, subjectStageMap, subjectCourseMap)),
    },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-5xl mx-auto w-full space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">{t.exportTitle}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'تصدير تقارير رسمية منسقة (A4 أفقي، 75%، RTL، عناوين زرقاء، وفلاتر Excel تلقائية)'
              : 'Export official formatted Excel reports (A4 landscape, 75% scale, RTL, blue headers, AutoFilter)'}
          </p>
        </div>
      </div>

      {/* Quick export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {exportCards.map(card => (
          <div key={card.key} className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-start sm:items-center border border-slate-200/80 hover:shadow-md transition-shadow">
            <div className={`stat-icon ${card.bg} flex-shrink-0`}>
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-snug">{card.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{card.desc}</p>
              <p className="text-xs text-blue-600 font-semibold mt-1.5">{card.count}</p>
            </div>
            <button
              className="btn btn-primary btn-sm w-full sm:w-auto flex-shrink-0 font-bold min-h-[36px] justify-center"
              onClick={card.action}
              disabled={exporting === card.key}
            >
              {exporting === card.key ? (
                <><span className="spinner" />{t.generating}</>
              ) : (
                <><Download className="w-4 h-4" />{t.exportBtn}</>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Stage-specific styled exports with Course Options */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {t.exportStageReport}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isAr
                ? 'تقارير المراحل الدراسية مصنفة حسب مرحلة التحميل مع خيارات الكورسين معاً أو كورس محدد'
                : 'Stage reports grouped by carryover stage with Both Courses or Single Course options'}
            </p>
          </div>
          <span className="text-xs text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full whitespace-nowrap">
            {isAr ? 'نموذج الكلية المعتمد' : 'Official Template'}
          </span>
        </div>

        <div className="card overflow-hidden border border-slate-200/80 shadow-sm">
          {STAGE_ORDER.map((stage, idx) => {
            const carryingCount = getStudentsCarryingStage(stage).length;
            const keyBoth = `stage-${idx}-both`;
            const keyFirst = `stage-${idx}-first`;
            const keySecond = `stage-${idx}-second`;

            return (
              <div
                key={stage}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {isAr ? stage : STAGE_EN[stage]}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {carryingCount} {t.carryingStudentsInStage}
                    </p>
                  </div>
                </div>

                {/* Course Export Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm text-xs font-bold bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none justify-center min-h-[34px]"
                    onClick={() => doExport(keyBoth, () => exportStyledStageReport(parsedData, stage, 'both', language, columnFields, subjectStageMap, subjectCourseMap))}
                    disabled={exporting !== null || carryingCount === 0}
                    title={t.bothCoursesDesc}
                  >
                    {exporting === keyBoth ? (
                      <span className="spinner" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{t.bothCourses}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50 flex-1 sm:flex-none justify-center min-h-[34px]"
                    onClick={() => doExport(keyFirst, () => exportStyledStageReport(parsedData, stage, 'first', language, columnFields, subjectStageMap, subjectCourseMap))}
                    disabled={exporting !== null || carryingCount === 0}
                  >
                    {exporting === keyFirst ? (
                      <span className="spinner" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{t.firstCourseOnly}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm text-xs font-semibold border-purple-200 text-purple-700 hover:bg-purple-50 flex-1 sm:flex-none justify-center min-h-[34px]"
                    onClick={() => doExport(keySecond, () => exportStyledStageReport(parsedData, stage, 'second', language, columnFields, subjectStageMap, subjectCourseMap))}
                    disabled={exporting !== null || carryingCount === 0}
                  >
                    {exporting === keySecond ? (
                      <span className="spinner" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{t.secondCourseOnly}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Excluded summary note */}
      {parsedData.excludedStudents.length > 0 && (
        <div className="alert alert-warning text-xs mb-6 p-4">
          <UserX className="w-4 h-4 flex-shrink-0" />
          <p>
            {isAr
              ? `يتضمن التقرير الشامل ورقة عمل خاصة بالطلبة المستبعدين (${parsedData.excludedStudents.length} طلاب) الذين تجاوزت مواد تحميلهم الحد المسموح به (> 2).`
              : `The complete workbook includes a dedicated sheet for excluded students (${parsedData.excludedStudents.length} students) with > 2 carryover subjects.`}
          </p>
        </div>
      )}

      {/* Privacy note */}
      <div className="alert alert-info text-xs p-4">
        <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
        <p>{t.privacyNotice}</p>
      </div>
    </div>
  );
}
