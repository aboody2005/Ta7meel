// =============================================
// Excel Parser Service using SheetJS
// =============================================

import * as XLSX from 'xlsx';
import type {
  StudentRecord,
  ParsedData,
  ParseOptions,
  ValidationWarning,
  ParseStats,
  AcademicStage,
  SubjectInfo,
} from '../types';
import { STAGE_ORDER, calculateDefaultSubjectStage } from '../types';

// --------------- Stage Normalization ---------------

const STAGE_MAP: Record<string, AcademicStage> = {
  // Arabic words
  'المرحلة الأولى': 'المرحلة الأولى',
  'الأولى': 'المرحلة الأولى',
  'أولى': 'المرحلة الأولى',
  'الاولى': 'المرحلة الأولى',
  'اولى': 'المرحلة الأولى',
  'الاول': 'المرحلة الأولى',
  'أول': 'المرحلة الأولى',
  'المرحلة الثانية': 'المرحلة الثانية',
  'الثانية': 'المرحلة الثانية',
  'ثانية': 'المرحلة الثانية',
  'الثاني': 'المرحلة الثانية',
  'ثاني': 'المرحلة الثانية',
  'المرحلة الثالثة': 'المرحلة الثالثة',
  'الثالثة': 'المرحلة الثالثة',
  'ثالثة': 'المرحلة الثالثة',
  'الثالث': 'المرحلة الثالثة',
  'ثالث': 'المرحلة الثالثة',
  'المرحلة الرابعة': 'المرحلة الرابعة',
  'الرابعة': 'المرحلة الرابعة',
  'رابعة': 'المرحلة الرابعة',
  'الرابع': 'المرحلة الرابعة',
  'رابع': 'المرحلة الرابعة',
  'المرحلة الخامسة': 'المرحلة الخامسة',
  'الخامسة': 'المرحلة الخامسة',
  'خامسة': 'المرحلة الخامسة',
  'الخامس': 'المرحلة الخامسة',
  'خامس': 'المرحلة الخامسة',
  // Arabic numerals
  '١': 'المرحلة الأولى',
  '٢': 'المرحلة الثانية',
  '٣': 'المرحلة الثالثة',
  '٤': 'المرحلة الرابعة',
  '٥': 'المرحلة الخامسة',
  // English words
  'first': 'المرحلة الأولى',
  'first stage': 'المرحلة الأولى',
  'stage 1': 'المرحلة الأولى',
  'year 1': 'المرحلة الأولى',
  'second': 'المرحلة الثانية',
  'second stage': 'المرحلة الثانية',
  'stage 2': 'المرحلة الثانية',
  'year 2': 'المرحلة الثانية',
  'third': 'المرحلة الثالثة',
  'third stage': 'المرحلة الثالثة',
  'stage 3': 'المرحلة الثالثة',
  'year 3': 'المرحلة الثالثة',
  'fourth': 'المرحلة الرابعة',
  'fourth stage': 'المرحلة الرابعة',
  'stage 4': 'المرحلة الرابعة',
  'year 4': 'المرحلة الرابعة',
  'fifth': 'المرحلة الخامسة',
  'fifth stage': 'المرحلة الخامسة',
  'stage 5': 'المرحلة الخامسة',
  'year 5': 'المرحلة الخامسة',
  // English numerals
  '1': 'المرحلة الأولى',
  '2': 'المرحلة الثانية',
  '3': 'المرحلة الثالثة',
  '4': 'المرحلة الرابعة',
  '5': 'المرحلة الخامسة',
};

function normalizeStage(raw: string): AcademicStage | null {
  const cleaned = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  const directKey = Object.keys(STAGE_MAP).find(
    k => k.toLowerCase() === cleaned
  );
  if (directKey) return STAGE_MAP[directKey];
  const numMatch = cleaned.match(/[١٢٣٤٥]|[1-5]/);
  if (numMatch) {
    const n = numMatch[0]
      .replace('١','1').replace('٢','2').replace('٣','3')
      .replace('٤','4').replace('٥','5');
    return STAGE_MAP[n] ?? null;
  }
  return null;
}

// --------------- Subject Parsing ---------------

export function parseSubjects(raw: string, separators: string[]): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const text = raw.trim();
  if (!text) return [];

  const escapedSeps = separators
    .map(s => {
      if (s === '\n') return '\\n';
      if (s === '\r\n') return '\\r?\\n';
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('|');

  const parts = text
    .split(new RegExp(escapedSeps))
    .map(p => p.trim().replace(/\s+/g, ' '))
    .filter(p => p.length > 0);

  // Deduplicate within the cell
  const seen = new Set<string>();
  return parts.filter(p => {
    const key = p.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --------------- Number Parsing for Column D ---------------

export function parseCarryoverCount(raw: string): { count: number; isValid: boolean } {
  if (!raw || !raw.trim()) return { count: 0, isValid: true };
  const cleaned = raw.trim();
  const normalized = cleaned
    .replace(/٠/g, '0')
    .replace(/١/g, '1')
    .replace(/٢/g, '2')
    .replace(/٣/g, '3')
    .replace(/٤/g, '4')
    .replace(/٥/g, '5')
    .replace(/٦/g, '6')
    .replace(/٧/g, '7')
    .replace(/٨/g, '8')
    .replace(/٩/g, '9');

  const match = normalized.match(/\d+/);
  if (match) {
    return { count: parseInt(match[0], 10), isValid: true };
  }
  return { count: 0, isValid: false };
}

// --------------- Cell Value Extraction ---------------

function getCellValue(
  sheet: XLSX.WorkSheet,
  colIndex: number,
  rowIndex: number
): string {
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  const cell = sheet[addr];
  if (!cell) return '';
  const val = cell.w !== undefined && cell.w !== null ? cell.w : cell.v;
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

// --------------- Header Detection ---------------

export function detectHeaders(buffer: ArrayBuffer, sheetIndex: number, headerRow = 0): string[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[Math.min(sheetIndex, workbook.SheetNames.length - 1)];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const headers: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = getCellValue(sheet, c, headerRow);
      headers.push(val || `العمود ${colIndexToLetter(c)}`);
    }
    return headers;
  } catch {
    return [];
  }
}

// --------------- Preview column data ---------------

export function getColumnPreview(
  buffer: ArrayBuffer,
  sheetIndex: number,
  colIndex: number,
  startRow: number,
  maxRows = 5
): string[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[Math.min(sheetIndex, workbook.SheetNames.length - 1)];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const preview: string[] = [];
    for (let r = startRow; r <= Math.min(range.e.r, startRow + maxRows - 1); r++) {
      const val = getCellValue(sheet, colIndex, r);
      if (val) preview.push(val);
    }
    return preview;
  } catch {
    return [];
  }
}

// --------------- Main Parser ---------------

export function parseExcelFile(
  buffer: ArrayBuffer,
  options: ParseOptions
): {
  data: ParsedData;
  sheetNames: string[];
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const sheetIndex = Math.min(options.sheetIndex, sheetNames.length - 1);
  const sheetName = sheetNames[sheetIndex];
  const sheet = workbook.Sheets[sheetName];

  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const totalRows = Math.max(0, range.e.r - options.startRow + 1);

  // Detect headers from the row before startRow (typically row 0)
  const headerRow = Math.max(0, options.startRow - 1);
  const detectedHeaders: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const val = getCellValue(sheet, c, headerRow);
    detectedHeaders.push(val || `${colIndexToLetter(c)}`);
  }

  const students: StudentRecord[] = [];
  const warnings: ValidationWarning[] = [];
  let missingNames = 0;
  let unknownStages = 0;
  let emptySubjectCells = 0;
  let countMismatches = 0;

  const { nameCol, stageCol, carryoverCountCol, carryoverSubjectsCol } = options.columnMapping;
  const maxAllowed = options.maxAllowedCarryover ?? 2;

  for (let r = options.startRow; r <= range.e.r; r++) {
    const name = getCellValue(sheet, nameCol, r);
    const rawStage = getCellValue(sheet, stageCol, r);
    const rawCarryoverCount = getCellValue(sheet, carryoverCountCol, r);
    const rawCarryoverSubjects = getCellValue(sheet, carryoverSubjectsCol, r);

    // Skip entirely empty rows
    if (!name && !rawStage && !rawCarryoverCount && !rawCarryoverSubjects) continue;

    if (!name) {
      missingNames++;
      warnings.push({
        type: 'missing_name',
        rowIndex: r + 1,
        message: `الصف ${r + 1}: اسم الطالب مفقود`,
        data: { stage: rawStage, carryoverCount: rawCarryoverCount, carryoverSubjects: rawCarryoverSubjects },
      });
      continue;
    }

    const normalizedStage = rawStage ? normalizeStage(rawStage) : null;
    const stage: AcademicStage = normalizedStage ?? 'غير محدد';

    if (rawStage && !normalizedStage) {
      unknownStages++;
      warnings.push({
        type: 'unknown_stage',
        rowIndex: r + 1,
        message: `الصف ${r + 1}: المرحلة الدراسية غير معروفة: "${rawStage}"`,
        data: { name, rawStage },
      });
    }

    // Parse Column D (Numeric count) and Column E (Subject names)
    const { count: carryoverCount } = parseCarryoverCount(rawCarryoverCount);
    const carryoverSubjects = parseSubjects(rawCarryoverSubjects, options.subjectSeparators);

    // Validate Column D count against Column E subject names count
    let hasCountMismatch = false;
    if (carryoverCount !== carryoverSubjects.length) {
      hasCountMismatch = true;
      countMismatches++;
      warnings.push({
        type: 'count_mismatch',
        rowIndex: r + 1,
        message: `الصف ${r + 1} (${name}): عدد مواد التحميل (${carryoverCount}) لا يطابق عدد المواد المستخرجة (${carryoverSubjects.length})`,
        data: {
          name,
          carryoverCount,
          extractedCount: carryoverSubjects.length,
          rawCarryoverCount,
          rawCarryoverSubjects,
          carryoverSubjects,
        },
      });
    }

    // Inclusion criteria:
    // - 1 or 2 subjects included
    // - 0 subjects included if includeZeroCarryover is true
    // - > 2 subjects excluded
    const isOverMax = carryoverCount > maxAllowed;
    const isZeroExcluded = carryoverCount === 0 && !options.includeZeroCarryover;
    const isExcluded = isOverMax || isZeroExcluded;

    let exclusionReason: string | undefined = undefined;
    if (isOverMax) {
      exclusionReason = `تجاوز الحد الأقصى لمواد التحميل (${carryoverCount} مواد - المسموح به ${maxAllowed} كحد أقصى)`;
      warnings.push({
        type: 'exceeded_max_carryover',
        rowIndex: r + 1,
        message: `الصف ${r + 1} (${name}): طالب مستبعد لتجاوز الحد الأقصى للتحميل (${carryoverCount} مواد)`,
        data: { name, carryoverCount, stage, carryoverSubjects },
      });
    } else if (isZeroExcluded) {
      exclusionReason = 'عدد مواد التحميل صفر (مستبعد حسب الإعدادات)';
    }

    if (carryoverCount === 0 && carryoverSubjects.length === 0) {
      emptySubjectCells++;
    }

    const initialSubjectStages: Record<string, AcademicStage> = {};
    const fallbackStage: AcademicStage = stage === 'غير محدد' ? 'المرحلة الأولى' : stage;
    carryoverSubjects.forEach(cs => {
      initialSubjectStages[cs] = fallbackStage;
    });

    students.push({
      id: `row-${r}`,
      rowIndex: r + 1,
      name,
      stage,
      rawStage,
      carryoverCount,
      rawCarryoverCount,
      carryoverSubjects,
      rawCarryoverSubjects,
      isExcluded,
      exclusionReason,
      hasCountMismatch,
      hasWarning: hasCountMismatch || isOverMax,
      subjectStages: initialSubjectStages,
    });
  }

  // Detect duplicates (same name + stage)
  const nameStageCount = new Map<string, number[]>();
  students.forEach((s, idx) => {
    const key = `${s.name.trim().toLowerCase()}|${s.stage}`;
    const arr = nameStageCount.get(key) ?? [];
    arr.push(idx);
    nameStageCount.set(key, arr);
  });
  let duplicates = 0;
  nameStageCount.forEach((indices) => {
    if (indices.length > 1) {
      duplicates++;
      indices.forEach(idx => {
        students[idx].isDuplicate = true;
        students[idx].hasWarning = true;
        warnings.push({
          type: 'duplicate_student',
          rowIndex: students[idx].rowIndex,
          message: `الصف ${students[idx].rowIndex}: الطالب "${students[idx].name}" يظهر ${indices.length} مرات في نفس المرحلة`,
          data: { name: students[idx].name, stage: students[idx].stage, rowIndex: students[idx].rowIndex },
        });
      });
    }
  });

  // Separate included vs excluded students
  const includedStudents = students.filter(s => !s.isExcluded);
  const excludedStudents = students.filter(s => s.isExcluded);

  // Build subject info based on actual subject names from included students
  const subjectMap = new Map<string, SubjectInfo>();
  includedStudents.forEach(s => {
    const countedInThisStudent = new Set<string>();
    s.carryoverSubjects.forEach(subj => {
      const cleanSubj = subj.trim();
      if (!cleanSubj) return;
      if (!subjectMap.has(cleanSubj)) {
        subjectMap.set(cleanSubj, {
          name: cleanSubj,
          studentCount: 0,
          stages: {},
          defaultStage: 'المرحلة الأولى',
          subjectStage: 'المرحلة الأولى',
          isModified: false,
        });
      }
      const info = subjectMap.get(cleanSubj)!;
      if (!countedInThisStudent.has(cleanSubj)) {
        info.studentCount++;
        info.stages[s.stage] = (info.stages[s.stage] ?? 0) + 1;
        countedInThisStudent.add(cleanSubj);
      }
    });
  });

  const allSubjects = Array.from(subjectMap.values())
    .map(info => {
      const defStage = calculateDefaultSubjectStage(info.stages);
      return {
        ...info,
        defaultStage: defStage,
        subjectStage: defStage,
        isModified: false,
      };
    })
    .sort(
      (a, b) => b.studentCount - a.studentCount || a.name.localeCompare(b.name, 'ar')
    );

  // Group included students by stage
  const stageGroups: Record<AcademicStage, StudentRecord[]> = {
    'المرحلة الأولى': [],
    'المرحلة الثانية': [],
    'المرحلة الثالثة': [],
    'المرحلة الرابعة': [],
    'المرحلة الخامسة': [],
    'غير محدد': [],
  };
  STAGE_ORDER.forEach(st => { stageGroups[st] = []; });
  includedStudents.forEach(s => {
    if (!stageGroups[s.stage]) stageGroups[s.stage] = [];
    stageGroups[s.stage].push(s);
  });

  // Calculate statistics
  let zeroCarryoverStudents = 0;
  let oneCarryoverStudents = 0;
  let twoCarryoverStudents = 0;

  students.forEach(s => {
    if (s.carryoverCount === 0) zeroCarryoverStudents++;
    else if (s.carryoverCount === 1) oneCarryoverStudents++;
    else if (s.carryoverCount === 2) twoCarryoverStudents++;
  });

  const parseStats: ParseStats = {
    totalRows,
    validRecords: students.length,
    includedStudents: includedStudents.length,
    excludedStudents: excludedStudents.length,
    zeroCarryoverStudents,
    oneCarryoverStudents,
    twoCarryoverStudents,
    countMismatches,
    missingNames,
    unknownStages,
    duplicates,
    emptySubjectCells,
    distinctSubjects: allSubjects.length,
  };

  return {
    data: {
      students,
      includedStudents,
      excludedStudents,
      allSubjects,
      stageGroups,
      warnings,
      parseStats,
      detectedHeaders,
    },
    sheetNames,
  };
}

export function getSheetNames(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}

// --------------- Column Letters ---------------

export function colIndexToLetter(idx: number): string {
  let result = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function colLetterToIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.toUpperCase().charCodeAt(i) - 64);
  }
  return result - 1;
}
