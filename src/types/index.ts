// =============================================
// Core Data Types for Pharmacy Academic Carryover Analyzer
// =============================================

export type AcademicStage =
  | 'المرحلة الأولى'
  | 'المرحلة الثانية'
  | 'المرحلة الثالثة'
  | 'المرحلة الرابعة'
  | 'المرحلة الخامسة'
  | 'غير محدد';

export const STAGE_ORDER: AcademicStage[] = [
  'المرحلة الأولى',
  'المرحلة الثانية',
  'المرحلة الثالثة',
  'المرحلة الرابعة',
  'المرحلة الخامسة',
];

export const STAGE_EN: Record<AcademicStage, string> = {
  'المرحلة الأولى': 'First Stage',
  'المرحلة الثانية': 'Second Stage',
  'المرحلة الثالثة': 'Third Stage',
  'المرحلة الرابعة': 'Fourth Stage',
  'المرحلة الخامسة': 'Fifth Stage',
  'غير محدد': 'Unknown Stage',
};

// ---- Course Types (الكورس الأول / الكورس الثاني) ----

export type AcademicCourse =
  | 'الكورس الأول'
  | 'الكورس الثاني'
  | 'غير محدد';

export const COURSE_ORDER: AcademicCourse[] = [
  'الكورس الأول',
  'الكورس الثاني',
];

export const COURSE_EN: Record<AcademicCourse, string> = {
  'الكورس الأول': 'First Course',
  'الكورس الثاني': 'Second Course',
  'غير محدد': 'Unassigned Course',
};

export type CourseExportChoice = 'both' | 'first' | 'second';
export type CourseFilterChoice = 'all' | 'first' | 'second' | 'unassigned';

// Helper to create a composite key for a subject within an assigned stage
export function getSubjectCourseKey(subjectName: string, stage?: string): string {
  const cleanSubj = subjectName.trim().toLowerCase();
  return stage ? `${stage}::${cleanSubj}` : cleanSubj;
}

// ---- Per-field column configuration (customizable column mapping) ----

export type ColumnFieldKey =
  | 'nameCol'
  | 'stageCol'
  | 'carryoverCountCol'
  | 'carryoverSubjectsCol';

export interface ColumnFieldConfig {
  key: ColumnFieldKey;
  colIndex: number;          // 0-based column index
  enabled: boolean;          // Whether this field is active in analysis/export
  displayNameAr: string;     // Arabic display label (used in UI + Excel headers)
  displayNameEn: string;     // English display label
}

// Default display names for each field
export const DEFAULT_FIELD_NAMES: Record<ColumnFieldKey, { ar: string; en: string }> = {
  nameCol:              { ar: 'اسم الطالب',             en: 'Student Name' },
  stageCol:             { ar: 'المرحلة الدراسية',        en: 'Academic Stage' },
  carryoverCountCol:    { ar: 'عدد مواد التحميل',        en: 'Carryover Count' },
  carryoverSubjectsCol: { ar: 'مواد التحميل',            en: 'Carryover Subjects' },
};

// ---- Subject → Academic Stage mapping ----

// Maps a subject name → the academic stage that subject belongs to
export type SubjectStageMap = Record<string, AcademicStage>;
export type ModifiedSubjectsMap = Record<string, boolean>;

// Maps a subject name (or stage::subject) → course (الكورس الأول / الكورس الثاني / غير محدد)
export type SubjectCourseMap = Record<string, AcademicCourse>;

// Helper to determine the suggested default stage for a subject from student stages
export function calculateDefaultSubjectStage(
  stages: Partial<Record<AcademicStage, number>>,
  fallback: AcademicStage = 'المرحلة الأولى'
): AcademicStage {
  let bestStage: AcademicStage = fallback;
  let maxCount = -1;

  for (const stg of STAGE_ORDER) {
    const count = stages[stg] ?? 0;
    if (count > maxCount && count > 0) {
      maxCount = count;
      bestStage = stg;
    }
  }

  return bestStage;
}

export interface StudentRecord {
  id: string;
  rowIndex: number;
  name: string;
  stage: AcademicStage;           // Student's actual current academic stage (never overwritten)
  rawStage: string;
  carryoverCount: number;         // From Column D (numeric count of carryover subjects)
  rawCarryoverCount: string;      // Raw text/number from Column D
  carryoverSubjects: string[];    // From Column E (parsed subject names)
  rawCarryoverSubjects: string;   // Raw text from Column E
  isExcluded: boolean;            // True if carryoverCount > maxAllowedCarryover (e.g. > 2)
  exclusionReason?: string;
  hasCountMismatch?: boolean;     // True if Column D count !== carryoverSubjects.length
  hasWarning?: boolean;
  isDuplicate?: boolean;
  subjectStages?: Record<string, AcademicStage>; // Assigned academic stage per carryover subject
  subjectCourses?: Record<string, AcademicCourse>; // Assigned course per carryover subject
}

export interface SubjectInfo {
  name: string;
  studentCount: number;
  stages: Partial<Record<AcademicStage, number>>;
  defaultStage: AcademicStage;    // Suggested default academic stage based on students' current stages
  subjectStage: AcademicStage;    // User-assigned or default academic stage
  isModified?: boolean;           // True if user manually changed from default
  course?: AcademicCourse;        // First Course / Second Course / Unassigned
}

export interface ValidationWarning {
  type:
    | 'unknown_stage'
    | 'missing_name'
    | 'duplicate_student'
    | 'count_mismatch'
    | 'exceeded_max_carryover'
    | 'empty_subjects'
    | 'parse_error';
  rowIndex: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface ParseStats {
  totalRows: number;
  validRecords: number;
  includedStudents: number;        // carryoverCount <= 2
  excludedStudents: number;        // carryoverCount > 2
  zeroCarryoverStudents: number;   // carryoverCount === 0
  oneCarryoverStudents: number;    // carryoverCount === 1
  twoCarryoverStudents: number;    // carryoverCount === 2
  countMismatches: number;         // Column D !== Column E length
  missingNames: number;
  unknownStages: number;
  duplicates: number;
  emptySubjectCells: number;
  distinctSubjects: number;
}

export interface ParsedData {
  students: StudentRecord[];
  includedStudents: StudentRecord[];
  excludedStudents: StudentRecord[];
  allSubjects: SubjectInfo[];
  stageGroups: Record<AcademicStage, StudentRecord[]>;
  warnings: ValidationWarning[];
  parseStats: ParseStats;
  detectedHeaders: string[];  // Column headers detected from the file's first row
}

export interface ColumnMapping {
  nameCol: number;               // Column B: default 1 (0-indexed)
  stageCol: number;              // Column C: default 2 (0-indexed)
  carryoverCountCol: number;     // Column D: default 3 (0-indexed)
  carryoverSubjectsCol: number;  // Column E: default 4 (0-indexed)
}

export interface ParseOptions {
  sheetIndex: number;
  columnMapping: ColumnMapping;
  columnFields: ColumnFieldConfig[];   // Detailed per-field config with display names
  subjectSeparators: string[];
  startRow: number;              // 0-indexed row to start reading (e.g. 1 to skip header)
  includeZeroCarryover: boolean; // Whether students with 0 carryover subjects are included
  maxAllowedCarryover: number;   // Maximum allowed carryover subjects (default 2)
}

export type Language = 'ar' | 'en';

export type ActiveView =
  | 'dashboard'
  | 'stage'
  | 'subject-explorer'
  | 'assign-stages'
  | 'assign-courses'
  | 'export'
  | 'validation';

export type CarryoverCountFilter = 'all' | '1' | '2' | '0' | 'excluded' | 'mismatch';

export interface FilterState {
  search: string;
  stage: AcademicStage | 'all';
  carryoverCountFilter: CarryoverCountFilter;
  specificSubject: string;
}
