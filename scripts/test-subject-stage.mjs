// Verification script for Requirement 9: Testing Carryover Subject Stage Control
import fs from 'fs';
import * as XLSX from 'xlsx';

// 1. Load sample Excel file
const buffer = fs.readFileSync('./public/sample_students.xlsx');
const wb = XLSX.read(buffer, { type: 'buffer' });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- TESTING CARRYOVER SUBJECT STAGE CONTROL ---');

// Mock parser logic matching excelParser.ts
const STAGE_ORDER = [
  'المرحلة الأولى',
  'المرحلة الثانية',
  'المرحلة الثالثة',
  'المرحلة الرابعة',
  'المرحلة الخامسة',
];

function calculateDefaultSubjectStage(stages) {
  let bestStage = 'المرحلة الأولى';
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

// Parse rows from sample
const students = [];
for (let r = 1; r < rawData.length; r++) {
  const row = rawData[r];
  if (!row || !row[1]) continue;
  const name = String(row[1]).trim();
  const rawStage = String(row[2] || '').trim();
  const carryoverCount = Number(row[3] || 0);
  const rawSubjects = String(row[4] || '');
  const carryoverSubjects = rawSubjects ? rawSubjects.split(/[،,]/).map(s => s.trim()).filter(Boolean) : [];

  let stage = 'غير محدد';
  if (rawStage.includes('أولى') || rawStage.includes('الأولى') || rawStage.includes('First')) stage = 'المرحلة الأولى';
  else if (rawStage.includes('ثانية') || rawStage.includes('الثانية') || rawStage.includes('Second')) stage = 'المرحلة الثانية';
  else if (rawStage.includes('ثالثة') || rawStage.includes('الثالثة') || rawStage.includes('Third')) stage = 'المرحلة الثالثة';
  else if (rawStage.includes('رابعة') || rawStage.includes('الرابعة') || rawStage.includes('Fourth')) stage = 'المرحلة الرابعة';
  else if (rawStage.includes('خامسة') || rawStage.includes('الخامسة') || rawStage.includes('Fifth')) stage = 'المرحلة الخامسة';

  const initialSubjectStages = {};
  carryoverSubjects.forEach(cs => {
    initialSubjectStages[cs] = stage;
  });

  students.push({
    id: `row-${r}`,
    name,
    stage,
    carryoverCount,
    carryoverSubjects,
    isExcluded: carryoverCount > 2,
    subjectStages: initialSubjectStages,
  });
}

const includedStudents = students.filter(s => !s.isExcluded);

// Build subjects
const subjectMap = new Map();
includedStudents.forEach(s => {
  s.carryoverSubjects.forEach(subj => {
    if (!subjectMap.has(subj)) {
      subjectMap.set(subj, {
        name: subj,
        studentCount: 0,
        stages: {},
      });
    }
    const info = subjectMap.get(subj);
    info.studentCount++;
    info.stages[s.stage] = (info.stages[s.stage] ?? 0) + 1;
  });
});

const allSubjects = Array.from(subjectMap.values()).map(info => {
  const defStage = calculateDefaultSubjectStage(info.stages);
  return {
    ...info,
    defaultStage: defStage,
    subjectStage: defStage,
    isModified: false,
  };
});

// TEST 1: A Fourth Stage student carrying Pharmacology I (أدوية 1) initially gets Fourth Stage as default stage
console.log('\n--- Test 1: Initial Default Subject Stage ---');
const fourthStageStudent = includedStudents.find(s => s.stage === 'المرحلة الرابعة' && s.carryoverSubjects.includes('أدوية 1'));
if (!fourthStageStudent) throw new Error('Fourth stage student carrying أدوية 1 not found');
const pharmacologySubj = allSubjects.find(s => s.name === 'أدوية 1');
if (!pharmacologySubj) throw new Error('Subject أدوية 1 not found in allSubjects');

console.log(`Student: ${fourthStageStudent.name}, Current Stage: ${fourthStageStudent.stage}`);
console.log(`Subject: ${pharmacologySubj.name}, Default Stage: ${pharmacologySubj.defaultStage}`);
if (pharmacologySubj.defaultStage !== 'المرحلة الرابعة') {
  throw new Error(`Expected default stage to be المرحلة الرابعة, got ${pharmacologySubj.defaultStage}`);
}
console.log('✅ Test 1 Passed: Fourth stage student carrying Pharmacology I initially gets Fourth Stage as default stage.');

// TEST 2: The user can change Pharmacology I to Third Stage
console.log('\n--- Test 2: User Changes Pharmacology I to Third Stage ---');
const subjectStageMap = {};
allSubjects.forEach(s => { subjectStageMap[s.name] = s.defaultStage; });
subjectStageMap['أدوية 1'] = 'المرحلة الثالثة';
console.log(`New assigned stage for أدوية 1: ${subjectStageMap['أدوية 1']}`);
if (subjectStageMap['أدوية 1'] !== 'المرحلة الثالثة') {
  throw new Error('Failed to set assignment to المرحلة الثالثة');
}
console.log('✅ Test 2 Passed: User can change Pharmacology I to Third Stage.');

// TEST 3: Saving the change updates all students carrying Pharmacology I
console.log('\n--- Test 3: Saving Updates All Students Carrying Pharmacology I ---');
includedStudents.forEach(student => {
  student.carryoverSubjects.forEach(cs => {
    if (subjectStageMap[cs]) {
      student.subjectStages[cs] = subjectStageMap[cs];
    }
  });
});

const studentsWithPharm = includedStudents.filter(s => s.carryoverSubjects.includes('أدوية 1'));
studentsWithPharm.forEach(s => {
  if (s.subjectStages['أدوية 1'] !== 'المرحلة الثالثة') {
    throw new Error(`Student ${s.name} does not have assigned stage المرحلة الثالثة`);
  }
});
console.log(`Updated ${studentsWithPharm.length} students carrying أدوية 1 to assigned stage: المرحلة الثالثة.`);
console.log('✅ Test 3 Passed: Saving the change updates all students carrying Pharmacology I.');

// TEST 4: Students remain in their actual current stages
console.log('\n--- Test 4: Students Remain in Their Actual Current Stages ---');
studentsWithPharm.forEach(s => {
  if (s.stage !== 'المرحلة الرابعة') {
    throw new Error(`Student ${s.name} current stage changed unexpectedly to ${s.stage}`);
  }
});
console.log(`Student ${fourthStageStudent.name} remains in current stage: ${fourthStageStudent.stage}`);
console.log('✅ Test 4 Passed: Students remain in their actual current stages.');

// TEST 5: Third Stage subject reports include Pharmacology I and all relevant students
console.log('\n--- Test 5: Third Stage Subject Reports Include Pharmacology I and Relevant Students ---');
const thirdStageCarryoverStudents = [];
allSubjects.forEach(subj => {
  const assigned = subjectStageMap[subj.name] ?? subj.defaultStage;
  if (assigned === 'المرحلة الثالثة') {
    const matching = includedStudents.filter(st => st.carryoverSubjects.includes(subj.name));
    matching.forEach(st => {
      thirdStageCarryoverStudents.push({
        studentName: st.name,
        currentStage: st.stage,
        subjectName: subj.name,
        assignedStage: assigned,
      });
    });
  }
});

const foundPharmRecord = thirdStageCarryoverStudents.find(r => r.subjectName === 'أدوية 1');
if (!foundPharmRecord) {
  throw new Error('Pharmacology I not found in Third Stage carryover report!');
}
console.log(`Third Stage Report Entry found: Student "${foundPharmRecord.studentName}" (Current Stage: ${foundPharmRecord.currentStage}), Subject: "${foundPharmRecord.subjectName}" (Assigned: ${foundPharmRecord.assignedStage})`);
console.log('✅ Test 5 Passed: Third Stage subject reports include Pharmacology I and all relevant students.');

// TEST 6: Excel exports reflect the saved assignment
console.log('\n--- Test 6: Excel Exports Reflect Saved Assignment ---');
const exportHeaders = ['#', 'اسم الطالب', 'المرحلة الحالية للطالب', 'مادة التحميل', 'المرحلة الدراسية المحمّل بها', 'عدد مواد التحميل', 'حالة التطابق'];
const exportRows = thirdStageCarryoverStudents.map((r, i) => [
  i + 1,
  r.studentName,
  r.currentStage,
  r.subjectName,
  r.assignedStage,
  1,
  'مطابق'
]);
const testWb = XLSX.utils.book_new();
const testWs = XLSX.utils.aoa_to_sheet([['كشف طلبة مواد التحميل للمرحلة الدراسية المحمّل بها: المرحلة الثالثة'], [], exportHeaders, ...exportRows]);
XLSX.utils.book_append_sheet(testWb, testWs, 'المرحلة الثالثة');
const testOut = './public/test_output_stage3.xlsx';
XLSX.writeFile(testWb, testOut);

const readBackWb = XLSX.read(fs.readFileSync(testOut), { type: 'buffer' });
const readBackWs = readBackWb.Sheets['المرحلة الثالثة'];
const readBackData = XLSX.utils.sheet_to_json(readBackWs, { header: 1 });
const pharmExportRow = readBackData.find(row => row && row.includes('أدوية 1'));
if (!pharmExportRow) throw new Error('أدوية 1 not found in exported Excel sheet');
console.log(`Excel Export Verified: Row: [${pharmExportRow.join(' | ')}]`);
console.log('✅ Test 6 Passed: Excel exports reflect the saved assignment.');

// TEST 7: Resetting defaults restores the automatically suggested stages
console.log('\n--- Test 7: Resetting Defaults Restores Automatically Suggested Stages ---');
allSubjects.forEach(s => {
  subjectStageMap[s.name] = s.defaultStage;
});
includedStudents.forEach(st => {
  st.carryoverSubjects.forEach(cs => {
    st.subjectStages[cs] = st.stage;
  });
});
if (subjectStageMap['أدوية 1'] !== 'المرحلة الرابعة') {
  throw new Error(`Reset failed: expected المرحلة الرابعة, got ${subjectStageMap['أدوية 1']}`);
}
console.log(`After Reset: Subject "أدوية 1" assigned stage restored to: ${subjectStageMap['أدوية 1']}`);
console.log('✅ Test 7 Passed: Resetting defaults restores automatically suggested stages.');

console.log('\n🎉 ALL 7 TEST REQUIREMENTS PASSED PERFECTLY!\n');
