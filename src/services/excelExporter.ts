// =============================================
// Excel Export Service using ExcelJS (Rich Styling, RTL, A4 Landscape, 75% Scale)
// =============================================

import ExcelJS from 'exceljs';
import type {
  ParsedData, StudentRecord, AcademicStage, AcademicCourse,
  ColumnFieldConfig, SubjectStageMap, SubjectCourseMap, CourseExportChoice
} from '../types';
import {
  STAGE_ORDER, STAGE_EN, DEFAULT_FIELD_NAMES, COURSE_EN,
  getSubjectCourseKey
} from '../types';

// Palette matching user reference screenshot
const THEME = {
  headerBg: 'FF1F4E78',      // Deep Blue
  headerFg: 'FFFFFFFF',      // White
  titleBg:  'FF1F4E78',      // Deep Blue
  titleFg:  'FFFFFFFF',      // White
  borderColor: 'FFBFBFBF',   // Soft gray grid borders
  fontFamily: 'Calibri',
};

// Helper: trigger browser file download from an ExcelJS Workbook
async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper: get display name for a field from ColumnFieldConfig or fall back to default
function fieldLabel(
  fields: ColumnFieldConfig[] | undefined,
  key: keyof typeof DEFAULT_FIELD_NAMES,
  lang: 'ar' | 'en'
): string {
  const found = fields?.find(f => f.key === key);
  if (found) return lang === 'ar' ? found.displayNameAr : found.displayNameEn;
  return lang === 'ar' ? DEFAULT_FIELD_NAMES[key].ar : DEFAULT_FIELD_NAMES[key].en;
}

// Helper: get assigned stage for a subject
function getAssignedStage(
  subj: string,
  map?: SubjectStageMap,
  data?: ParsedData,
  fallback?: AcademicStage
): AcademicStage {
  const clean = subj.trim();
  if (map && map[clean]) return map[clean];
  const found = data?.allSubjects.find(s => s.name.trim().toLowerCase() === clean.toLowerCase());
  return found?.subjectStage ?? found?.defaultStage ?? fallback ?? 'المرحلة الأولى';
}

// Helper: get assigned course for a subject within a stage
function getAssignedCourse(
  subj: string,
  stage: AcademicStage,
  courseMap?: SubjectCourseMap,
  data?: ParsedData
): AcademicCourse {
  const clean = subj.trim();
  if (courseMap) {
    const keyWithStage = getSubjectCourseKey(clean, stage);
    if (courseMap[keyWithStage]) return courseMap[keyWithStage];
    if (courseMap[clean.toLowerCase()]) return courseMap[clean.toLowerCase()];
    if (courseMap[clean]) return courseMap[clean];
  }
  const found = data?.allSubjects.find(s => s.name.trim().toLowerCase() === clean.toLowerCase());
  return found?.course ?? 'غير محدد';
}

interface StudentCourseAggregation {
  student: StudentRecord;
  relevantSubjects: string[];
  assignedStage: AcademicStage;
  course: AcademicCourse;
  count: number;
}

// Aggregate students carrying subjects belonging to `stage` (and optionally filtered by `courseFilter`)
function aggregateStudentsForStage(
  data: ParsedData,
  stage: AcademicStage,
  courseFilter?: AcademicCourse,
  subjectStageMap?: SubjectStageMap,
  subjectCourseMap?: SubjectCourseMap
): StudentCourseAggregation[] {
  const results: StudentCourseAggregation[] = [];

  data.includedStudents.forEach(student => {
    // Find all subjects carried by this student that belong to `stage`
    const matchingSubjects: string[] = [];

    student.carryoverSubjects.forEach(cs => {
      const clean = cs.trim();
      const subjStage = student.subjectStages?.[clean] ?? getAssignedStage(clean, subjectStageMap, data, student.stage);
      if (subjStage !== stage) return;

      if (courseFilter) {
        const subjCourse = student.subjectCourses?.[clean] ?? getAssignedCourse(clean, stage, subjectCourseMap, data);
        if (subjCourse !== courseFilter) return;
      }

      matchingSubjects.push(clean);
    });

    if (matchingSubjects.length > 0) {
      results.push({
        student,
        relevantSubjects: matchingSubjects,
        assignedStage: stage,
        course: courseFilter ?? 'غير محدد',
        count: matchingSubjects.length,
      });
    }
  });

  return results;
}

// Apply styling to table headers and title
function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { name: THEME.fontFamily, size: 11, bold: true, color: { argb: THEME.headerFg } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = {
    top: { style: 'thin', color: { argb: THEME.borderColor } },
    bottom: { style: 'thin', color: { argb: THEME.borderColor } },
    left: { style: 'thin', color: { argb: THEME.borderColor } },
    right: { style: 'thin', color: { argb: THEME.borderColor } },
  };
}

function styleTitleCell(cell: ExcelJS.Cell, title: string) {
  cell.value = title;
  cell.font = { name: THEME.fontFamily, size: 13, bold: true, color: { argb: THEME.titleFg } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.titleBg } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function styleDataCell(cell: ExcelJS.Cell, value: any, isNumber = false) {
  cell.value = value;
  cell.font = { name: THEME.fontFamily, size: 11, color: { argb: 'FF000000' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = {
    top: { style: 'thin', color: { argb: THEME.borderColor } },
    bottom: { style: 'thin', color: { argb: THEME.borderColor } },
    left: { style: 'thin', color: { argb: THEME.borderColor } },
    right: { style: 'thin', color: { argb: THEME.borderColor } },
  };
  if (isNumber) {
    cell.numFmt = '#,##0';
  }
}

// =========================================================================
// 1. PRIMARY STYLED REPORT: Matching Reference Excel Image Exactly
// =========================================================================
export async function exportStyledStageReport(
  data: ParsedData,
  stage: AcademicStage,
  courseChoice: CourseExportChoice = 'both',
  lang: 'ar' | 'en' = 'ar',
  columnFields?: ColumnFieldConfig[],
  subjectStageMap?: SubjectStageMap,
  subjectCourseMap?: SubjectCourseMap
) {
  const isAr = lang === 'ar';
  const stageName = isAr ? stage : STAGE_EN[stage];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pharmacy Academic Carryover Analyzer';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(stageName.substring(0, 31), {
    views: [{ rightToLeft: true }], // Right-to-Left (RTL) mode as in reference
    pageSetup: {
      paperSize: 9,           // A4
      orientation: 'landscape', // Landscape
      scale: 75,              // 75% scaling
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Set column widths matching reference screenshot (A: #, B: Name, C: Current Stage, D: Subjects, E: Carryover Stage, F: Count, G: Status)
  worksheet.columns = [
    { key: 'colA', width: 8 },  // #
    { key: 'colB', width: 34 }, // اسم الطالب
    { key: 'colC', width: 26 }, // المرحلة الحالية للطالب
    { key: 'colD', width: 38 }, // مواد التحميل
    { key: 'colE', width: 28 }, // المرحلة الدراسية المحمّل بها
    { key: 'colF', width: 20 }, // عدد مواد التحميل
    { key: 'colG', width: 20 }, // حالة التطابق
  ];

  const headers = [
    '#',
    fieldLabel(columnFields, 'nameCol', lang),
    isAr ? 'المرحلة الحالية للطالب' : 'Student Current Stage',
    fieldLabel(columnFields, 'carryoverSubjectsCol', lang),
    isAr ? 'المرحلة الدراسية المحمّل بها' : 'Assigned Subject Stage',
    fieldLabel(columnFields, 'carryoverCountCol', lang),
    isAr ? 'حالة التطابق' : 'Matching Status',
  ];

  // Helper to render one course table starting at `startRow`
  const renderCourseTable = (
    startRow: number,
    courseTitle: string,
    records: StudentCourseAggregation[]
  ): number => {
    // 1. Title Row (merged across cols 1 to 7)
    worksheet.mergeCells(startRow, 1, startRow, 7);
    const titleCell = worksheet.getCell(startRow, 1);
    styleTitleCell(titleCell, courseTitle);
    worksheet.getRow(startRow).height = 32;

    // 2. Header Row
    const headerRowNum = startRow + 1;
    const headerRow = worksheet.getRow(headerRowNum);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      styleHeaderCell(cell);
    });

    let currentRow = headerRowNum;

    // 3. Data Rows or empty state
    if (records.length === 0) {
      currentRow++;
      worksheet.mergeCells(currentRow, 1, currentRow, 7);
      const emptyCell = worksheet.getCell(currentRow, 1);
      emptyCell.value = isAr ? '— لا يوجد طلبة محملين بمواد في هذا الكورس —' : '— No students carrying subjects for this course —';
      emptyCell.font = { name: THEME.fontFamily, size: 11, italic: true, color: { argb: 'FF7F7F7F' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      emptyCell.border = {
        top: { style: 'thin', color: { argb: THEME.borderColor } },
        bottom: { style: 'thin', color: { argb: THEME.borderColor } },
        left: { style: 'thin', color: { argb: THEME.borderColor } },
        right: { style: 'thin', color: { argb: THEME.borderColor } },
      };
      worksheet.getRow(currentRow).height = 24;
    } else {
      records.forEach((rec, i) => {
        currentRow++;
        const row = worksheet.getRow(currentRow);
        row.height = 22;

        const s = rec.student;
        const currentStageLabel = isAr ? s.stage : STAGE_EN[s.stage];
        const assignedStageLabel = isAr ? rec.assignedStage : STAGE_EN[rec.assignedStage];
        const matchStatus = s.hasCountMismatch
          ? (isAr ? `تنبيه: لا يطابق` : `Mismatch`)
          : (isAr ? 'مطابق' : 'Matches');

        styleDataCell(row.getCell(1), i + 1, true); // #
        styleDataCell(row.getCell(2), s.name);       // اسم الطالب
        styleDataCell(row.getCell(3), currentStageLabel); // المرحلة الحالية للطالب
        styleDataCell(row.getCell(4), rec.relevantSubjects.join(' ، ')); // مواد التحميل
        styleDataCell(row.getCell(5), assignedStageLabel); // المرحلة الدراسية المحمّل بها
        styleDataCell(row.getCell(6), rec.count, true); // عدد مواد التحميل
        styleDataCell(row.getCell(7), matchStatus);  // حالة التطابق
      });
    }

    return currentRow; // Return last used row
  };

  // Determine what to render based on `courseChoice`
  if (courseChoice === 'first') {
    const course1Records = aggregateStudentsForStage(data, stage, 'الكورس الأول', subjectStageMap, subjectCourseMap);
    const title = isAr
      ? `الطلبة المحملين في ${stage} – الكورس الأول`
      : `Carryover Students in ${STAGE_EN[stage]} – First Course`;
    const lastRow = renderCourseTable(1, title, course1Records);

    // Native Excel AutoFilter on header row
    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: Math.max(3, lastRow), column: 7 },
    };
  } else if (courseChoice === 'second') {
    const course2Records = aggregateStudentsForStage(data, stage, 'الكورس الثاني', subjectStageMap, subjectCourseMap);
    const title = isAr
      ? `الطلبة المحملين في ${stage} – الكورس الثاني`
      : `Carryover Students in ${STAGE_EN[stage]} – Second Course`;
    const lastRow = renderCourseTable(1, title, course2Records);

    // Native Excel AutoFilter on header row
    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: Math.max(3, lastRow), column: 7 },
    };
  } else {
    // Both Courses: Table 1 + exactly 3 blank rows + Table 2
    const course1Records = aggregateStudentsForStage(data, stage, 'الكورس الأول', subjectStageMap, subjectCourseMap);
    const course2Records = aggregateStudentsForStage(data, stage, 'الكورس الثاني', subjectStageMap, subjectCourseMap);

    // Table 1 (First Course)
    const title1 = isAr
      ? `الطلبة المحملين في ${stage} – الكورس الأول`
      : `Carryover Students in ${STAGE_EN[stage]} – First Course`;
    const endRow1 = renderCourseTable(1, title1, course1Records);

    // Exactly 3 completely blank rows:
    // Rows: endRow1 + 1, endRow1 + 2, endRow1 + 3
    const startRow2 = endRow1 + 4;

    // Table 2 (Second Course)
    const title2 = isAr
      ? `الطلبة المحملين في ${stage} – الكورس الثاني`
      : `Carryover Students in ${STAGE_EN[stage]} – Second Course`;
    renderCourseTable(startRow2, title2, course2Records);

    // Native Excel AutoFilter on Table 1 header row (covering Table 1)
    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: Math.max(3, endRow1), column: 7 },
    };
  }

  // Construct standard file name
  const courseSuffix = courseChoice === 'first' ? '_كورس1' : courseChoice === 'second' ? '_كورس2' : '_الكورسين';
  const fileName = isAr
    ? `تقرير_تحميل_${stage.replace(/\s/g, '_')}${courseSuffix}.xlsx`
    : `Carryover_Report_${STAGE_EN[stage].replace(/\s/g, '_')}${courseChoice === 'first' ? '_C1' : courseChoice === 'second' ? '_C2' : '_Both'}.xlsx`;

  await downloadWorkbook(workbook, fileName);
}

// Wrapper preserving existing signature for stage export
export async function exportStageReport(
  data: ParsedData,
  stage: AcademicStage,
  lang: 'ar' | 'en' = 'ar',
  columnFields?: ColumnFieldConfig[],
  subjectStageMap?: SubjectStageMap,
  subjectCourseMap?: SubjectCourseMap,
  courseChoice: CourseExportChoice = 'both'
) {
  return exportStyledStageReport(
    data,
    stage,
    courseChoice,
    lang,
    columnFields,
    subjectStageMap,
    subjectCourseMap
  );
}

// =========================================================================
// 2. COMPLETE WORKBOOK EXPORT: Multi-sheet Comprehensive Report
// =========================================================================
export async function exportCompleteReport(
  data: ParsedData,
  lang: 'ar' | 'en' = 'ar',
  columnFields?: ColumnFieldConfig[],
  subjectStageMap?: SubjectStageMap,
  subjectCourseMap?: SubjectCourseMap
) {
  const isAr = lang === 'ar';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pharmacy Academic Carryover Analyzer';
  workbook.created = new Date();

  // 1. Summary Sheet
  const summaryWs = workbook.addWorksheet(isAr ? 'ملخص عام' : 'Summary', {
    views: [{ rightToLeft: true }],
    pageSetup: { paperSize: 9, orientation: 'landscape', scale: 75 }
  });
  summaryWs.columns = [{ width: 45 }, { width: 25 }];

  summaryWs.mergeCells('A1:B1');
  styleTitleCell(
    summaryWs.getCell('A1'),
    isAr ? 'تقرير نظام تحليل ومتابعة مواد التحميل الأكاديمي' : 'Academic Carryover Analysis Report'
  );
  summaryWs.getRow(1).height = 30;

  const summaryHeaders = [isAr ? 'البيان الإحصائي' : 'Metric', isAr ? 'العدد' : 'Count'];
  const hRow = summaryWs.getRow(3);
  hRow.height = 24;
  summaryHeaders.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    styleHeaderCell(c);
  });

  const metrics: [string, number][] = [
    [isAr ? 'إجمالي الطلبة المشمولين (مادتين أو أقل)' : 'Total Included Students (<= 2)', data.includedStudents.length],
    [isAr ? 'الطلبة المحملين بمادة واحدة' : 'Students with 1 Subject', data.parseStats.oneCarryoverStudents],
    [isAr ? 'الطلبة المحملين بمادتين' : 'Students with 2 Subjects', data.parseStats.twoCarryoverStudents],
    [isAr ? 'الطلبة بدون مواد تحميل (0)' : 'Students with 0 Subjects', data.parseStats.zeroCarryoverStudents],
    [isAr ? 'الطلبة المستبعدون (أكثر من مادتين)' : 'Excluded Students (> 2 subjects)', data.excludedStudents.length],
    [isAr ? 'حالات عدم تطابق العدد مع المواد' : 'Count Mismatch Cases', data.parseStats.countMismatches],
    [isAr ? 'إجمالي مواد التحميل الفريدة المكتشفة' : 'Distinct Carryover Subjects', data.parseStats.distinctSubjects],
  ];

  metrics.forEach(([label, val], i) => {
    const r = summaryWs.getRow(4 + i);
    r.height = 20;
    styleDataCell(r.getCell(1), label);
    styleDataCell(r.getCell(2), val, true);
  });

  // 2. Individual Stage Sheets (Styled according to reference with both courses)
  for (const stage of STAGE_ORDER) {
    const stageName = isAr ? stage : STAGE_EN[stage];
    const ws = workbook.addWorksheet(stageName.substring(0, 31), {
      views: [{ rightToLeft: true }],
      pageSetup: { paperSize: 9, orientation: 'landscape', scale: 75, fitToPage: true, fitToWidth: 1 }
    });

    ws.columns = [
      { key: 'colA', width: 8 },
      { key: 'colB', width: 34 },
      { key: 'colC', width: 26 },
      { key: 'colD', width: 38 },
      { key: 'colE', width: 28 },
      { key: 'colF', width: 20 },
      { key: 'colG', width: 20 },
    ];

    const c1 = aggregateStudentsForStage(data, stage, 'الكورس الأول', subjectStageMap, subjectCourseMap);
    const c2 = aggregateStudentsForStage(data, stage, 'الكورس الثاني', subjectStageMap, subjectCourseMap);

    const title1 = isAr ? `الطلبة المحملين في ${stage} – الكورس الأول` : `Carryover Students in ${STAGE_EN[stage]} – First Course`;
    const title2 = isAr ? `الطلبة المحملين في ${stage} – الكورس الثاني` : `Carryover Students in ${STAGE_EN[stage]} – Second Course`;

    // Render Table 1
    ws.mergeCells('A1:G1');
    styleTitleCell(ws.getCell('A1'), title1);
    ws.getRow(1).height = 30;

    const headers = [
      '#',
      fieldLabel(columnFields, 'nameCol', lang),
      isAr ? 'المرحلة الحالية للطالب' : 'Student Current Stage',
      fieldLabel(columnFields, 'carryoverSubjectsCol', lang),
      isAr ? 'المرحلة الدراسية المحمّل بها' : 'Assigned Subject Stage',
      fieldLabel(columnFields, 'carryoverCountCol', lang),
      isAr ? 'حالة التطابق' : 'Matching Status',
    ];

    const hRow1 = ws.getRow(2);
    hRow1.height = 24;
    headers.forEach((h, idx) => {
      const c = hRow1.getCell(idx + 1);
      c.value = h;
      styleHeaderCell(c);
    });

    let rowIdx = 2;
    if (c1.length === 0) {
      rowIdx++;
      ws.mergeCells(rowIdx, 1, rowIdx, 7);
      const ec = ws.getCell(rowIdx, 1);
      ec.value = isAr ? '— لا يوجد طلبة محملين بمواد في هذا الكورس —' : '— No students —';
      ec.font = { name: THEME.fontFamily, size: 11, italic: true };
      ec.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      c1.forEach((rec, idx) => {
        rowIdx++;
        const row = ws.getRow(rowIdx);
        row.height = 20;
        styleDataCell(row.getCell(1), idx + 1, true);
        styleDataCell(row.getCell(2), rec.student.name);
        styleDataCell(row.getCell(3), isAr ? rec.student.stage : STAGE_EN[rec.student.stage]);
        styleDataCell(row.getCell(4), rec.relevantSubjects.join(' ، '));
        styleDataCell(row.getCell(5), isAr ? rec.assignedStage : STAGE_EN[rec.assignedStage]);
        styleDataCell(row.getCell(6), rec.count, true);
        styleDataCell(row.getCell(7), isAr ? 'مطابق' : 'Matches');
      });
    }

    // 3 blank separator rows
    rowIdx += 3;

    // Table 2 (Second Course)
    const t2Row = rowIdx + 1;
    ws.mergeCells(t2Row, 1, t2Row, 7);
    styleTitleCell(ws.getCell(t2Row, 1), title2);
    ws.getRow(t2Row).height = 30;

    const hRow2 = ws.getRow(t2Row + 1);
    hRow2.height = 24;
    headers.forEach((h, idx) => {
      const c = hRow2.getCell(idx + 1);
      c.value = h;
      styleHeaderCell(c);
    });

    rowIdx = t2Row + 1;
    if (c2.length === 0) {
      rowIdx++;
      ws.mergeCells(rowIdx, 1, rowIdx, 7);
      const ec = ws.getCell(rowIdx, 1);
      ec.value = isAr ? '— لا يوجد طلبة محملين بمواد في هذا الكورس —' : '— No students —';
      ec.font = { name: THEME.fontFamily, size: 11, italic: true };
      ec.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      c2.forEach((rec, idx) => {
        rowIdx++;
        const row = ws.getRow(rowIdx);
        row.height = 20;
        styleDataCell(row.getCell(1), idx + 1, true);
        styleDataCell(row.getCell(2), rec.student.name);
        styleDataCell(row.getCell(3), isAr ? rec.student.stage : STAGE_EN[rec.student.stage]);
        styleDataCell(row.getCell(4), rec.relevantSubjects.join(' ، '));
        styleDataCell(row.getCell(5), isAr ? rec.assignedStage : STAGE_EN[rec.assignedStage]);
        styleDataCell(row.getCell(6), rec.count, true);
        styleDataCell(row.getCell(7), isAr ? 'مطابق' : 'Matches');
      });
    }

    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: Math.max(3, t2Row - 4), column: 7 },
    };
  }

  // 3. Subject Summary Sheet
  const subjWs = workbook.addWorksheet(isAr ? 'ملخص المواد' : 'Subject Summary', {
    views: [{ rightToLeft: true }],
    pageSetup: { paperSize: 9, orientation: 'landscape', scale: 75 }
  });
  subjWs.columns = [
    { width: 8 },  // #
    { width: 38 }, // Subject Name
    { width: 25 }, // Assigned Stage
    { width: 20 }, // Assigned Course
    { width: 22 }, // Total Students
  ];

  subjWs.mergeCells('A1:E1');
  styleTitleCell(
    subjWs.getCell('A1'),
    isAr ? 'ملخص مواد التحميل وتوزيع الكورسات والمراحل' : 'Carryover Subjects, Stages & Courses Summary'
  );
  subjWs.getRow(1).height = 30;

  const subjHeaders = [
    '#',
    isAr ? 'اسم مادة التحميل' : 'Subject Name',
    isAr ? 'المرحلة الدراسية المحمّل بها' : 'Assigned Stage',
    isAr ? 'الكورس' : 'Course',
    isAr ? 'إجمالي الطلبة المحملين' : 'Total Students Carrying',
  ];
  const shRow = subjWs.getRow(2);
  shRow.height = 24;
  subjHeaders.forEach((h, idx) => {
    const c = shRow.getCell(idx + 1);
    c.value = h;
    styleHeaderCell(c);
  });

  data.allSubjects.forEach((s, idx) => {
    const r = subjWs.getRow(3 + idx);
    r.height = 20;
    const assignedStage = getAssignedStage(s.name, subjectStageMap, data, s.defaultStage);
    const assignedCourse = getAssignedCourse(s.name, assignedStage, subjectCourseMap, data);

    styleDataCell(r.getCell(1), idx + 1, true);
    styleDataCell(r.getCell(2), s.name);
    styleDataCell(r.getCell(3), isAr ? assignedStage : STAGE_EN[assignedStage]);
    styleDataCell(r.getCell(4), isAr ? assignedCourse : COURSE_EN[assignedCourse]);
    styleDataCell(r.getCell(5), s.studentCount, true);
  });

  subjWs.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(3, data.allSubjects.length + 2), column: 5 },
  };

  // 4. Excluded Students Sheet (if any)
  if (data.excludedStudents.length > 0) {
    const excWs = workbook.addWorksheet(isAr ? 'الطلبة المستبعدون' : 'Excluded Students', {
      views: [{ rightToLeft: true }],
      pageSetup: { paperSize: 9, orientation: 'landscape', scale: 75 }
    });
    excWs.columns = [
      { width: 8 },
      { width: 34 },
      { width: 25 },
      { width: 20 },
      { width: 45 },
      { width: 40 },
    ];

    excWs.mergeCells('A1:F1');
    styleTitleCell(
      excWs.getCell('A1'),
      isAr ? 'كشف الطلبة المستبعدين لتجاوز الحد الأقصى لمواد التحميل (> 2 مادة)' : 'Roster of Excluded Students (> 2 Subjects)'
    );
    excWs.getRow(1).height = 30;

    const excHeaders = [
      '#',
      fieldLabel(columnFields, 'nameCol', lang),
      fieldLabel(columnFields, 'stageCol', lang),
      fieldLabel(columnFields, 'carryoverCountCol', lang),
      fieldLabel(columnFields, 'carryoverSubjectsCol', lang),
      isAr ? 'سبب الاستبعاد' : 'Exclusion Reason',
    ];
    const ehRow = excWs.getRow(2);
    ehRow.height = 24;
    excHeaders.forEach((h, idx) => {
      const c = ehRow.getCell(idx + 1);
      c.value = h;
      styleHeaderCell(c);
    });

    data.excludedStudents.forEach((s, idx) => {
      const r = excWs.getRow(3 + idx);
      r.height = 20;
      styleDataCell(r.getCell(1), idx + 1, true);
      styleDataCell(r.getCell(2), s.name);
      styleDataCell(r.getCell(3), isAr ? s.stage : STAGE_EN[s.stage]);
      styleDataCell(r.getCell(4), s.carryoverCount, true);
      styleDataCell(r.getCell(5), s.carryoverSubjects.join(' ، '));
      styleDataCell(r.getCell(6), s.exclusionReason ?? (isAr ? 'تجاوز الحد الأقصى (> 2)' : 'Exceeded max carryover'));
    });
  }

  const fileName = isAr ? 'تقرير_التحميل_الشامل.xlsx' : 'Complete_Carryover_Report.xlsx';
  await downloadWorkbook(workbook, fileName);
}

// =========================================================================
// 3. COURSE-SPECIFIC ALL-STAGES REPORT
// =========================================================================
export async function exportCourseReport(
  data: ParsedData,
  course: 'الكورس الأول' | 'الكورس الثاني',
  lang: 'ar' | 'en' = 'ar',
  columnFields?: ColumnFieldConfig[],
  subjectStageMap?: SubjectStageMap,
  subjectCourseMap?: SubjectCourseMap
) {
  const isAr = lang === 'ar';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pharmacy Academic Carryover Analyzer';
  workbook.created = new Date();

  for (const stage of STAGE_ORDER) {
    const stageName = isAr ? stage : STAGE_EN[stage];
    const records = aggregateStudentsForStage(data, stage, course, subjectStageMap, subjectCourseMap);

    const ws = workbook.addWorksheet(stageName.substring(0, 31), {
      views: [{ rightToLeft: true }],
      pageSetup: { paperSize: 9, orientation: 'landscape', scale: 75, fitToPage: true, fitToWidth: 1 }
    });

    ws.columns = [
      { key: 'colA', width: 8 },
      { key: 'colB', width: 34 },
      { key: 'colC', width: 26 },
      { key: 'colD', width: 38 },
      { key: 'colE', width: 28 },
      { key: 'colF', width: 20 },
      { key: 'colG', width: 20 },
    ];

    ws.mergeCells('A1:G1');
    const title = isAr
      ? `الطلبة المحملين في ${stage} – ${course}`
      : `Carryover Students in ${STAGE_EN[stage]} – ${COURSE_EN[course]}`;
    styleTitleCell(ws.getCell('A1'), title);
    ws.getRow(1).height = 30;

    const headers = [
      '#',
      fieldLabel(columnFields, 'nameCol', lang),
      isAr ? 'المرحلة الحالية للطالب' : 'Student Current Stage',
      fieldLabel(columnFields, 'carryoverSubjectsCol', lang),
      isAr ? 'المرحلة الدراسية المحمّل بها' : 'Assigned Subject Stage',
      fieldLabel(columnFields, 'carryoverCountCol', lang),
      isAr ? 'حالة التطابق' : 'Matching Status',
    ];

    const hRow = ws.getRow(2);
    hRow.height = 24;
    headers.forEach((h, idx) => {
      const c = hRow.getCell(idx + 1);
      c.value = h;
      styleHeaderCell(c);
    });

    let rowIdx = 2;
    if (records.length === 0) {
      rowIdx++;
      ws.mergeCells(rowIdx, 1, rowIdx, 7);
      const ec = ws.getCell(rowIdx, 1);
      ec.value = isAr ? `— لا يوجد طلبة محملين بمواد ${course} لهذه المرحلة —` : `— No students —`;
      ec.font = { name: THEME.fontFamily, size: 11, italic: true };
      ec.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      records.forEach((rec, idx) => {
        rowIdx++;
        const row = ws.getRow(rowIdx);
        row.height = 20;
        styleDataCell(row.getCell(1), idx + 1, true);
        styleDataCell(row.getCell(2), rec.student.name);
        styleDataCell(row.getCell(3), isAr ? rec.student.stage : STAGE_EN[rec.student.stage]);
        styleDataCell(row.getCell(4), rec.relevantSubjects.join(' ، '));
        styleDataCell(row.getCell(5), isAr ? rec.assignedStage : STAGE_EN[rec.assignedStage]);
        styleDataCell(row.getCell(6), rec.count, true);
        styleDataCell(row.getCell(7), isAr ? 'مطابق' : 'Matches');
      });
    }

    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: Math.max(3, rowIdx), column: 7 },
    };
  }

  const fileSuffix = course === 'الكورس الأول' ? 'الكورس_الأول' : 'الكورس_الثاني';
  const fileName = isAr ? `تقرير_تحميل_${fileSuffix}.xlsx` : `Carryover_Report_${COURSE_EN[course].replace(/\s/g, '_')}.xlsx`;
  await downloadWorkbook(workbook, fileName);
}

// =========================================================================
// 4. SINGLE SUBJECT REPORT: Students Carrying a Specific Subject
// =========================================================================
export async function exportSubjectReport(
  subjectName: string,
  students: StudentRecord[],
  lang: 'ar' | 'en' = 'ar',
  assignedStage?: AcademicStage,
  assignedCourse?: AcademicCourse
) {
  const isAr = lang === 'ar';
  const stageLabel = assignedStage
    ? (isAr ? assignedStage : STAGE_EN[assignedStage])
    : (isAr ? 'غير محدد' : 'Unassigned');
  const courseLabel = assignedCourse
    ? (isAr ? assignedCourse : COURSE_EN[assignedCourse])
    : (isAr ? 'غير محدد' : 'Unassigned');

  // 1. Strict filtering: include ONLY students who carry the selected subject
  const targetSubjClean = subjectName.trim().toLowerCase();
  const qualifyingStudents = students.filter(student =>
    student.carryoverSubjects.some(cs => {
      const c = cs.trim().toLowerCase();
      return c === targetSubjClean || c.includes(targetSubjClean);
    })
  );

  // 2. Strict deduplication: include each matching student only once, even if source data has duplicate entries
  const seenStudent = new Set<string>();
  const uniqueStudents: StudentRecord[] = [];
  qualifyingStudents.forEach(s => {
    const key = (s.name || s.id).trim().toLowerCase();
    if (!seenStudent.has(key)) {
      seenStudent.add(key);
      uniqueStudents.push(s);
    }
  });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(subjectName.substring(0, 31), {
    views: [{ rightToLeft: true }],
    pageSetup: { paperSize: 9, orientation: 'landscape', scale: 75 }
  });

  ws.columns = [
    { key: 'colA', width: 8 },  // #
    { key: 'colB', width: 34 }, // Student Name
    { key: 'colC', width: 24 }, // Student Current Stage
    { key: 'colD', width: 26 }, // Assigned Subject Stage
    { key: 'colE', width: 20 }, // Course
    { key: 'colF', width: 20 }, // Total Carryover Count
    { key: 'J',    width: 38 }, // Carryover Subject (Column J in template, heading "مادة التحميل")
    { key: 'colH', width: 20 }, // Match Status
  ];

  ws.mergeCells('A1:H1');
  const title = isAr
    ? `كشف طلبة مادة التحميل: ${subjectName} (${stageLabel} – ${courseLabel})`
    : `Carryover Roster for: ${subjectName} (${stageLabel} – ${courseLabel})`;
  styleTitleCell(ws.getCell('A1'), title);
  ws.getRow(1).height = 30;

  const headers = [
    '#',
    isAr ? 'اسم الطالب' : 'Student Name',
    isAr ? 'المرحلة الحالية للطالب' : 'Current Student Stage',
    isAr ? 'المرحلة الدراسية المحمّل بها' : 'Assigned Subject Stage',
    isAr ? 'الكورس' : 'Course',
    isAr ? 'عدد مواد التحميل' : 'Carryover Count',
    isAr ? 'مادة التحميل' : 'Carryover Subject',
    isAr ? 'حالة التطابق' : 'Match Status',
  ];

  const hRow = ws.getRow(2);
  hRow.height = 24;
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    styleHeaderCell(c);
  });

  if (uniqueStudents.length === 0) {
    ws.mergeCells(3, 1, 3, 8);
    const emptyCell = ws.getCell(3, 1);
    emptyCell.value = isAr ? '— لا يوجد طلبة محملين بهذه المادة —' : '— No students carrying this subject —';
    emptyCell.font = { name: THEME.fontFamily, size: 11, italic: true, color: { argb: 'FF7F7F7F' } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCell.border = {
      top: { style: 'thin', color: { argb: THEME.borderColor } },
      bottom: { style: 'thin', color: { argb: THEME.borderColor } },
      left: { style: 'thin', color: { argb: THEME.borderColor } },
      right: { style: 'thin', color: { argb: THEME.borderColor } },
    };
    ws.getRow(3).height = 24;
  } else {
    uniqueStudents.forEach((s, idx) => {
      const r = ws.getRow(3 + idx);
      r.height = 20;
      const matchStatus = s.hasCountMismatch
        ? (isAr ? 'تنبيه: لا يطابق' : 'Mismatch')
        : (isAr ? 'مطابق' : 'Matches');

      styleDataCell(r.getCell(1), idx + 1, true);
      styleDataCell(r.getCell(2), s.name);
      styleDataCell(r.getCell(3), isAr ? s.stage : STAGE_EN[s.stage]);
      styleDataCell(r.getCell(4), stageLabel);
      styleDataCell(r.getCell(5), courseLabel);
      styleDataCell(r.getCell(6), s.carryoverCount, true);
      styleDataCell(r.getCell(7), subjectName); // Column J: Write ONLY the selected subject's name, never list other subjects
      styleDataCell(r.getCell(8), matchStatus);
    });
  }

  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(3, uniqueStudents.length + 2), column: 8 },
  };

  const safe = subjectName.replace(/[\\/?*[\]:]/g, '').substring(0, 50);
  await downloadWorkbook(workbook, `كشف_تحميل_${safe}.xlsx`);
}

// =========================================================================
// 5. SUBJECT SUMMARY EXPORT
// =========================================================================
export async function exportSubjectSummary(
  data: ParsedData,
  lang: 'ar' | 'en' = 'ar',
  subjectStageMap?: SubjectStageMap,
  subjectCourseMap?: SubjectCourseMap
) {
  const isAr = lang === 'ar';
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(isAr ? 'ملخص مواد التحميل' : 'Carryover Summary', {
    views: [{ rightToLeft: true }],
    pageSetup: { paperSize: 9, orientation: 'landscape', scale: 75 }
  });

  ws.columns = [
    { width: 8 },  // #
    { width: 36 }, // Subject Name
    { width: 25 }, // Assigned Stage
    { width: 20 }, // Course
    { width: 22 }, // Total Students
    ...STAGE_ORDER.map(() => ({ width: 16 })),
  ];

  ws.mergeCells('A1:I1');
  styleTitleCell(
    ws.getCell('A1'),
    isAr ? 'ملخص مواد التحميل وتوزيع الطلبة عبر المراحل الدراسية' : 'Summary of Carryover Subjects Across Stages'
  );
  ws.getRow(1).height = 30;

  const headers = [
    '#',
    isAr ? 'اسم مادة التحميل' : 'Subject Name',
    isAr ? 'المرحلة الدراسية المحمّل بها' : 'Assigned Stage',
    isAr ? 'الكورس' : 'Course',
    isAr ? 'إجمالي الطلبة المحملين' : 'Total Carrying',
    ...STAGE_ORDER.map(s => (isAr ? s : STAGE_EN[s])),
  ];

  const hRow = ws.getRow(2);
  hRow.height = 24;
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    styleHeaderCell(c);
  });

  data.allSubjects.forEach((s, idx) => {
    const r = ws.getRow(3 + idx);
    r.height = 20;
    const assignedStage = getAssignedStage(s.name, subjectStageMap, data, s.defaultStage);
    const assignedCourse = getAssignedCourse(s.name, assignedStage, subjectCourseMap, data);

    styleDataCell(r.getCell(1), idx + 1, true);
    styleDataCell(r.getCell(2), s.name);
    styleDataCell(r.getCell(3), isAr ? assignedStage : STAGE_EN[assignedStage]);
    styleDataCell(r.getCell(4), isAr ? assignedCourse : COURSE_EN[assignedCourse]);
    styleDataCell(r.getCell(5), s.studentCount, true);

    STAGE_ORDER.forEach((st, sIdx) => {
      styleDataCell(r.getCell(6 + sIdx), s.stages[st] ?? 0, true);
    });
  });

  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(3, data.allSubjects.length + 2), column: headers.length },
  };

  const fileName = isAr ? 'ملخص_مواد_التحميل.xlsx' : 'Carryover_Subjects_Summary.xlsx';
  await downloadWorkbook(workbook, fileName);
}

// Backward compatibility export adapters
export async function exportSingleSubjectStageReport(
  data: ParsedData,
  stage: AcademicStage,
  subjectStageMap?: SubjectStageMap,
  lang: 'ar' | 'en' = 'ar',
  columnFields?: ColumnFieldConfig[],
  subjectCourseMap?: SubjectCourseMap
) {
  return exportStyledStageReport(
    data,
    stage,
    'both',
    lang,
    columnFields,
    subjectStageMap,
    subjectCourseMap
  );
}

export async function exportReportBySubjectStage(
  data: ParsedData,
  subjectStageMap: SubjectStageMap,
  lang: 'ar' | 'en' = 'ar',
  columnFields?: ColumnFieldConfig[],
  subjectCourseMap?: SubjectCourseMap
) {
  return exportCompleteReport(
    data,
    lang,
    columnFields,
    subjectStageMap,
    subjectCourseMap
  );
}
