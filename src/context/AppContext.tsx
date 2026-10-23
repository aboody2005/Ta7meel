// =============================================
// App Context - Global State Management
// =============================================

import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  ParsedData, ParseOptions, Language, ActiveView, AcademicStage,
  SubjectStageMap, ModifiedSubjectsMap, SubjectCourseMap, AcademicCourse,
  ColumnFieldConfig, ColumnFieldKey, StudentRecord,
} from '../types';
import { DEFAULT_FIELD_NAMES, STAGE_ORDER, getSubjectCourseKey } from '../types';

// Build default ColumnFieldConfig array
function buildDefaultFields(): ColumnFieldConfig[] {
  const order: Array<{ key: ColumnFieldKey; colIndex: number }> = [
    { key: 'nameCol',              colIndex: 1 },
    { key: 'stageCol',             colIndex: 2 },
    { key: 'carryoverCountCol',    colIndex: 3 },
    { key: 'carryoverSubjectsCol', colIndex: 4 },
  ];
  return order.map(({ key, colIndex }) => ({
    key,
    colIndex,
    enabled: true,
    displayNameAr: DEFAULT_FIELD_NAMES[key].ar,
    displayNameEn: DEFAULT_FIELD_NAMES[key].en,
  }));
}

export function buildColumnMappingFromFields(fields: ColumnFieldConfig[]) {
  const get = (key: ColumnFieldKey, fallback: number) =>
    fields.find(f => f.key === key)?.colIndex ?? fallback;
  return {
    nameCol:              get('nameCol', 1),
    stageCol:             get('stageCol', 2),
    carryoverCountCol:    get('carryoverCountCol', 3),
    carryoverSubjectsCol: get('carryoverSubjectsCol', 4),
  };
}

interface AppState {
  language: Language;
  activeView: ActiveView;
  selectedStage: AcademicStage | null;
  parsedData: ParsedData | null;
  parseOptions: ParseOptions | null;
  rawBuffer: ArrayBuffer | null;
  sheetNames: string[];
  fileName: string;
  isProcessing: boolean;
  parseError: string | null;
  validationAccepted: boolean;
  subjectStageMap: SubjectStageMap;       // User-assigned or default stage per subject
  modifiedSubjects: ModifiedSubjectsMap;  // Tracks subjects manually changed from default
  hasUnsavedChanges: boolean;             // Whether stage control panel has pending unsaved edits
  subjectCourseMap: SubjectCourseMap;     // Course assignment per subject (الكورس الأول / الكورس الثاني / غير محدد)
  hasUnsavedCourseChanges: boolean;       // Whether course control panel has pending unsaved edits
}

interface AppContextType extends AppState {
  setLanguage: (lang: Language) => void;
  setActiveView: (view: ActiveView) => void;
  setSelectedStage: (stage: AcademicStage | null) => void;
  setParsedData: (data: ParsedData | null) => void;
  setParseOptions: (opts: ParseOptions | null) => void;
  setRawBuffer: (buf: ArrayBuffer | null) => void;
  setSheetNames: (names: string[]) => void;
  setFileName: (name: string) => void;
  setIsProcessing: (v: boolean) => void;
  setParseError: (err: string | null) => void;
  setValidationAccepted: (v: boolean) => void;
  setSubjectStageMap: (map: SubjectStageMap) => void;
  setModifiedSubjects: (mod: ModifiedSubjectsMap) => void;
  setHasUnsavedChanges: (v: boolean) => void;
  setSubjectCourseMap: (map: SubjectCourseMap) => void;
  setHasUnsavedCourseChanges: (v: boolean) => void;
  saveSubjectStageAssignments: (newMap: SubjectStageMap, newModified: ModifiedSubjectsMap) => void;
  saveSubjectCourseAssignments: (newCourseMap: SubjectCourseMap) => void;
  restoreDefaultAssignments: () => void;
  resetSession: () => void;
  // Carryover-first query helpers
  getStudentsCarryingStage: (stage: AcademicStage, courseFilter?: AcademicCourse | 'all') => StudentRecord[];
  getStageCarryoverSubjectsForStudent: (student: StudentRecord, stage: AcademicStage, courseFilter?: AcademicCourse | 'all') => string[];
  getSubjectAssignedStage: (subjectName: string, fallback?: AcademicStage) => AcademicStage;
  getSubjectAssignedCourse: (subjectName: string, stage?: AcademicStage) => AcademicCourse;
}

const defaultFields = buildDefaultFields();

const defaultOptions: ParseOptions = {
  sheetIndex: 0,
  columnMapping: {
    nameCol: 1,              // Column B (0-indexed)
    stageCol: 2,             // Column C
    carryoverCountCol: 3,    // Column D (عدد مواد التحميل)
    carryoverSubjectsCol: 4, // Column E (أسماء مواد التحميل)
  },
  columnFields: defaultFields,
  subjectSeparators: [',', '،', ';', '\n'],
  startRow: 1, // Row 2 (skip header row 1)
  includeZeroCarryover: true,
  maxAllowedCarryover: 2,
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('ar');
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [selectedStage, setSelectedStage] = useState<AcademicStage | null>(null);
  const [parsedData, setParsedDataInternal] = useState<ParsedData | null>(null);
  const [parseOptions, setParseOptions] = useState<ParseOptions | null>(defaultOptions);
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationAccepted, setValidationAccepted] = useState(false);
  const [subjectStageMap, setSubjectStageMap] = useState<SubjectStageMap>({});
  const [modifiedSubjects, setModifiedSubjects] = useState<ModifiedSubjectsMap>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [subjectCourseMap, setSubjectCourseMap] = useState<SubjectCourseMap>({});
  const [hasUnsavedCourseChanges, setHasUnsavedCourseChanges] = useState(false);

  // Helper: get stage for a subject
  const getSubjectAssignedStage = useCallback((subjectName: string, fallback?: AcademicStage): AcademicStage => {
    const clean = subjectName.trim();
    if (subjectStageMap[clean]) return subjectStageMap[clean];
    const found = parsedData?.allSubjects.find(s => s.name.trim().toLowerCase() === clean.toLowerCase());
    return found?.subjectStage ?? found?.defaultStage ?? fallback ?? 'المرحلة الأولى';
  }, [subjectStageMap, parsedData?.allSubjects]);

  // Helper: get course for a subject
  const getSubjectAssignedCourse = useCallback((subjectName: string, stage?: AcademicStage): AcademicCourse => {
    const clean = subjectName.trim();
    const stg = stage ?? getSubjectAssignedStage(clean);
    const keyWithStage = getSubjectCourseKey(clean, stg);
    if (subjectCourseMap[keyWithStage]) return subjectCourseMap[keyWithStage];
    if (subjectCourseMap[clean.toLowerCase()]) return subjectCourseMap[clean.toLowerCase()];
    if (subjectCourseMap[clean]) return subjectCourseMap[clean];
    const found = parsedData?.allSubjects.find(s => s.name.trim().toLowerCase() === clean.toLowerCase());
    return found?.course ?? 'غير محدد';
  }, [subjectCourseMap, getSubjectAssignedStage, parsedData?.allSubjects]);

  // When new parsedData is loaded, initialize default subject-stage and course mapping
  const setParsedData = useCallback((data: ParsedData | null) => {
    setParsedDataInternal(data);
    if (data) {
      const initialMap: SubjectStageMap = {};
      const initialModified: ModifiedSubjectsMap = {};
      const initialCourseMap: SubjectCourseMap = {};

      data.allSubjects.forEach(s => {
        initialMap[s.name] = s.defaultStage;
        initialModified[s.name] = false;
        initialCourseMap[s.name] = s.course ?? 'غير محدد';
        initialCourseMap[getSubjectCourseKey(s.name, s.defaultStage)] = s.course ?? 'غير محدد';
      });

      setSubjectStageMap(initialMap);
      setModifiedSubjects(initialModified);
      setSubjectCourseMap(initialCourseMap);
      setHasUnsavedChanges(false);
      setHasUnsavedCourseChanges(false);
    } else {
      setSubjectStageMap({});
      setModifiedSubjects({});
      setSubjectCourseMap({});
      setHasUnsavedChanges(false);
      setHasUnsavedCourseChanges(false);
    }
  }, []);

  // Save subject stage assignments and update all student and subject records
  const saveSubjectStageAssignments = useCallback((
    newMap: SubjectStageMap,
    newModified: ModifiedSubjectsMap
  ) => {
    setSubjectStageMap(newMap);
    setModifiedSubjects(newModified);
    setHasUnsavedChanges(false);

    setParsedDataInternal(prev => {
      if (!prev) return null;

      // 1. Update allSubjects
      const updatedSubjects = prev.allSubjects.map(s => {
        const assigned = newMap[s.name] ?? s.defaultStage;
        const isModified = Boolean(newModified[s.name] || (assigned !== s.defaultStage));
        return {
          ...s,
          subjectStage: assigned,
          isModified,
        };
      });

      // 2. Update students and includedStudents
      const updateStudentList = (list: StudentRecord[]) =>
        list.map(student => {
          const updatedStages: Record<string, AcademicStage> = { ...(student.subjectStages ?? {}) };
          student.carryoverSubjects.forEach(cs => {
            const trimmed = cs.trim();
            updatedStages[trimmed] = newMap[trimmed] ?? student.stage;
          });
          return {
            ...student,
            subjectStages: updatedStages,
          };
        });

      const updatedStudents = updateStudentList(prev.students);
      const updatedIncluded = updateStudentList(prev.includedStudents);
      const updatedExcluded = updateStudentList(prev.excludedStudents);

      // Recalculate stage groups
      const updatedStageGroups: Record<AcademicStage, StudentRecord[]> = {
        'المرحلة الأولى': [],
        'المرحلة الثانية': [],
        'المرحلة الثالثة': [],
        'المرحلة الرابعة': [],
        'المرحلة الخامسة': [],
        'غير محدد': [],
      };
      STAGE_ORDER.forEach(st => { updatedStageGroups[st] = []; });
      updatedIncluded.forEach(s => {
        if (!updatedStageGroups[s.stage]) updatedStageGroups[s.stage] = [];
        updatedStageGroups[s.stage].push(s);
      });

      return {
        ...prev,
        allSubjects: updatedSubjects,
        students: updatedStudents,
        includedStudents: updatedIncluded,
        excludedStudents: updatedExcluded,
        stageGroups: updatedStageGroups,
      };
    });
  }, []);

  // Restore default automatically suggested stages
  const restoreDefaultAssignments = useCallback(() => {
    setParsedDataInternal(prev => {
      if (!prev) return null;

      const defaultMap: SubjectStageMap = {};
      const defaultModified: ModifiedSubjectsMap = {};

      prev.allSubjects.forEach(s => {
        defaultMap[s.name] = s.defaultStage;
        defaultModified[s.name] = false;
      });

      setSubjectStageMap(defaultMap);
      setModifiedSubjects(defaultModified);
      setHasUnsavedChanges(false);

      const updatedSubjects = prev.allSubjects.map(s => ({
        ...s,
        subjectStage: s.defaultStage,
        isModified: false,
      }));

      const updateStudentList = (list: StudentRecord[]) =>
        list.map(student => {
          const updatedStages: Record<string, AcademicStage> = {};
          student.carryoverSubjects.forEach(cs => {
            const trimmed = cs.trim();
            // Default: student's own current stage if valid, or subject's default stage
            const subjDefault = prev.allSubjects.find(sub => sub.name === trimmed)?.defaultStage ?? student.stage;
            updatedStages[trimmed] = student.stage !== 'غير محدد' ? student.stage : subjDefault;
          });
          return {
            ...student,
            subjectStages: updatedStages,
          };
        });

      return {
        ...prev,
        allSubjects: updatedSubjects,
        students: updateStudentList(prev.students),
        includedStudents: updateStudentList(prev.includedStudents),
        excludedStudents: updateStudentList(prev.excludedStudents),
      };
    });
  }, []);

  // Save subject course assignments
  const saveSubjectCourseAssignments = useCallback((newCourseMap: SubjectCourseMap) => {
    setSubjectCourseMap(newCourseMap);
    setHasUnsavedCourseChanges(false);

    setParsedDataInternal(prev => {
      if (!prev) return null;

      // 1. Update allSubjects
      const updatedSubjects = prev.allSubjects.map(s => {
        const assignedStage = subjectStageMap[s.name] ?? s.defaultStage;
        const keyWithStage = getSubjectCourseKey(s.name, assignedStage);
        const course = newCourseMap[keyWithStage] ?? newCourseMap[s.name.toLowerCase()] ?? newCourseMap[s.name] ?? s.course ?? 'غير محدد';
        return {
          ...s,
          course,
        };
      });

      // 2. Update students
      const updateStudentList = (list: StudentRecord[]) =>
        list.map(student => {
          const updatedCourses: Record<string, AcademicCourse> = { ...(student.subjectCourses ?? {}) };
          student.carryoverSubjects.forEach(cs => {
            const trimmed = cs.trim();
            const assignedStage = student.subjectStages?.[trimmed] ?? subjectStageMap[trimmed] ?? student.stage;
            const keyWithStage = getSubjectCourseKey(trimmed, assignedStage);
            updatedCourses[trimmed] = newCourseMap[keyWithStage] ?? newCourseMap[trimmed.toLowerCase()] ?? newCourseMap[trimmed] ?? 'غير محدد';
          });
          return {
            ...student,
            subjectCourses: updatedCourses,
          };
        });

      return {
        ...prev,
        allSubjects: updatedSubjects,
        students: updateStudentList(prev.students),
        includedStudents: updateStudentList(prev.includedStudents),
        excludedStudents: updateStudentList(prev.excludedStudents),
      };
    });
  }, [subjectStageMap]);

  // Query helper: Get students carrying subjects belonging to an assigned stage
  const getStudentsCarryingStage = useCallback((stage: AcademicStage, courseFilter?: AcademicCourse | 'all'): StudentRecord[] => {
    if (!parsedData) return [];
    return parsedData.includedStudents.filter(student => {
      return student.carryoverSubjects.some(cs => {
        const trimmed = cs.trim();
        const subjStage = student.subjectStages?.[trimmed] ?? subjectStageMap[trimmed] ?? student.stage;
        if (subjStage !== stage) return false;

        if (courseFilter && courseFilter !== 'all') {
          const subjCourse = getSubjectAssignedCourse(trimmed, subjStage);
          if (subjCourse !== courseFilter) return false;
        }

        return true;
      });
    });
  }, [parsedData, subjectStageMap, getSubjectAssignedCourse]);

  // Query helper: Get carryover subjects for a student that belong to a specific stage (and course)
  const getStageCarryoverSubjectsForStudent = useCallback((
    student: StudentRecord,
    stage: AcademicStage,
    courseFilter?: AcademicCourse | 'all'
  ): string[] => {
    return student.carryoverSubjects.filter(cs => {
      const trimmed = cs.trim();
      const subjStage = student.subjectStages?.[trimmed] ?? subjectStageMap[trimmed] ?? student.stage;
      if (subjStage !== stage) return false;

      if (courseFilter && courseFilter !== 'all') {
        const subjCourse = getSubjectAssignedCourse(trimmed, subjStage);
        if (subjCourse !== courseFilter) return false;
      }

      return true;
    });
  }, [subjectStageMap, getSubjectAssignedCourse]);

  const resetSession = useCallback(() => {
    setParsedDataInternal(null);
    setParseOptions(defaultOptions);
    setRawBuffer(null);
    setSheetNames([]);
    setFileName('');
    setIsProcessing(false);
    setParseError(null);
    setValidationAccepted(false);
    setActiveView('dashboard');
    setSelectedStage(null);
    setSubjectStageMap({});
    setModifiedSubjects({});
    setHasUnsavedChanges(false);
    setSubjectCourseMap({});
    setHasUnsavedCourseChanges(false);
  }, []);

  return (
    <AppContext.Provider value={{
      language, setLanguage,
      activeView, setActiveView,
      selectedStage, setSelectedStage,
      parsedData, setParsedData,
      parseOptions, setParseOptions,
      rawBuffer, setRawBuffer,
      sheetNames, setSheetNames,
      fileName, setFileName,
      isProcessing, setIsProcessing,
      parseError, setParseError,
      validationAccepted, setValidationAccepted,
      subjectStageMap, setSubjectStageMap,
      modifiedSubjects, setModifiedSubjects,
      hasUnsavedChanges, setHasUnsavedChanges,
      subjectCourseMap, setSubjectCourseMap,
      hasUnsavedCourseChanges, setHasUnsavedCourseChanges,
      saveSubjectStageAssignments,
      saveSubjectCourseAssignments,
      restoreDefaultAssignments,
      resetSession,
      getStudentsCarryingStage,
      getStageCarryoverSubjectsForStudent,
      getSubjectAssignedStage,
      getSubjectAssignedCourse,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}


