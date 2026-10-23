import ExcelJS from 'exceljs';
import assert from 'assert';

// Mock test for exportSubjectReport logic
function buildSubjectReportWorkbook(subjectName, students, lang = 'ar', assignedStage = 'المرحلة الثالثة', assignedCourse = 'الكورس الأول') {
  const isAr = lang === 'ar';
  const stageLabel = assignedStage;
  const courseLabel = assignedCourse;

  // 1. Strict filtering
  const targetSubjClean = subjectName.trim().toLowerCase();
  const qualifyingStudents = students.filter(student =>
    student.carryoverSubjects.some(cs => {
      const c = cs.trim().toLowerCase();
      return c === targetSubjClean || c.includes(targetSubjClean);
    })
  );

  // 2. Strict deduplication
  const seenStudent = new Set();
  const uniqueStudents = [];
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
  ws.getCell('A1').value = title;

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
  headers.forEach((h, idx) => {
    hRow.getCell(idx + 1).value = h;
  });

  uniqueStudents.forEach((s, idx) => {
    const r = ws.getRow(3 + idx);
    const matchStatus = s.hasCountMismatch
      ? (isAr ? 'تنبيه: لا يطابق' : 'Mismatch')
      : (isAr ? 'مطابق' : 'Matches');

    r.getCell(1).value = idx + 1;
    r.getCell(2).value = s.name;
    r.getCell(3).value = s.stage;
    r.getCell(4).value = stageLabel;
    r.getCell(5).value = courseLabel;
    r.getCell(6).value = s.carryoverCount;
    r.getCell(7).value = subjectName; // Column J: ONLY selected subject
    r.getCell(8).value = matchStatus;
  });

  return { workbook, uniqueStudents };
}

// Test cases
async function runTests() {
  console.log('Testing Subject Explorer Excel Export Changes...\n');

  const mockStudents = [
    {
      id: 's1',
      name: 'علي حسن أحمد',
      stage: 'المرحلة الثانية',
      carryoverCount: 3,
      carryoverSubjects: ['الكيمياء العضوية', 'علم الأدوية 1', 'الحسابات الصيدلانية'],
      hasCountMismatch: false,
    },
    {
      id: 's2',
      name: 'فاطمة محمود كريم',
      stage: 'المرحلة الثالثة',
      carryoverCount: 1,
      carryoverSubjects: ['علم الأدوية 1'],
      hasCountMismatch: false,
    },
    {
      id: 's3',
      name: 'سارة خالد عمر',
      stage: 'المرحلة الأولى',
      carryoverCount: 2,
      carryoverSubjects: ['الكيمياء العضوية', 'الفيزياء الطبية'],
      hasCountMismatch: false,
    },
    // Duplicate entry of student s1
    {
      id: 's1_dup',
      name: 'علي حسن أحمد',
      stage: 'المرحلة الثانية',
      carryoverCount: 3,
      carryoverSubjects: ['الكيمياء العضوية'],
      hasCountMismatch: false,
    },
    // Student who does NOT carry Organic Chemistry
    {
      id: 's4',
      name: 'يوسف زيد إبراهيم',
      stage: 'المرحلة الرابعة',
      carryoverCount: 1,
      carryoverSubjects: ['الكيمياء الصيدلانية'],
      hasCountMismatch: false,
    },
  ];

  // 1. Export for "الكيمياء العضوية" (Organic Chemistry)
  console.log('--- Test 1: Export for "الكيمياء العضوية" ---');
  const { workbook: wb1, uniqueStudents: exported1 } = buildSubjectReportWorkbook('الكيمياء العضوية', mockStudents, 'ar');
  const ws1 = wb1.getWorksheet(1);

  // Verification 1: Only students who carry Organic Chemistry are included (s1 and s3)
  assert.strictEqual(exported1.length, 2, 'Should have exactly 2 unique students carrying Organic Chemistry');
  assert.deepStrictEqual(exported1.map(s => s.name), ['علي حسن أحمد', 'سارة خالد عمر']);
  console.log('✅ Only students carrying Organic Chemistry are exported (s4 excluded).');
  console.log('✅ Duplicate student entries are deduplicated (s1 only appeared once).');

  // Verification 2: Check Column J (Col 7 / key J) header
  const headerCol7 = ws1.getRow(2).getCell(7).value;
  assert.strictEqual(headerCol7, 'مادة التحميل', 'Header at Col 7 must be "مادة التحميل"');
  console.log(`✅ Header for Column J is correctly: "${headerCol7}"`);

  // Verification 3: Check student s1 who carries 3 subjects (Organic Chemistry, Pharmacology 1, Calculations)
  // Row 3 is student s1
  const s1Row = ws1.getRow(3);
  assert.strictEqual(s1Row.getCell(2).value, 'علي حسن أحمد');
  assert.strictEqual(s1Row.getCell(3).value, 'المرحلة الثانية'); // Preserves student's current stage
  assert.strictEqual(s1Row.getCell(7).value, 'الكيمياء العضوية'); // Column J: ONLY Organic Chemistry!
  assert.strictEqual(s1Row.getCell('J').value, 'الكيمياء العضوية'); // Access by key J
  console.log(`✅ Student s1 (carrying 3 subjects) row Column J contains ONLY: "${s1Row.getCell(7).value}"`);
  assert(!String(s1Row.getCell(7).value).includes('علم الأدوية'), 'Must NOT include Pharmacology 1 in Column J');
  assert(!String(s1Row.getCell(7).value).includes('الحسابات الصيدلانية'), 'Must NOT include Calculations in Column J');
  console.log('✅ Confirmed: Other carryover subjects are NOT listed in Column J.');

  // 2. Export dynamically for "علم الأدوية 1" (Pharmacology 1)
  console.log('\n--- Test 2: Export dynamically for "علم الأدوية 1" ---');
  const { workbook: wb2, uniqueStudents: exported2 } = buildSubjectReportWorkbook('علم الأدوية 1', mockStudents, 'ar');
  const ws2 = wb2.getWorksheet(1);
  assert.strictEqual(exported2.length, 2, 'Should have 2 students (s1 and s2)');
  const s1Row2 = ws2.getRow(3);
  assert.strictEqual(s1Row2.getCell(7).value, 'علم الأدوية 1');
  console.log(`✅ Dynamic behavior verified: For "علم الأدوية 1", Column J contains: "${s1Row2.getCell(7).value}"`);

  // 3. Page Setup verification
  assert.strictEqual(ws1.pageSetup.paperSize, 9, 'Must be A4 paper size');
  assert.strictEqual(ws1.pageSetup.orientation, 'landscape', 'Must be landscape');
  assert.strictEqual(ws1.pageSetup.scale, 75, 'Must be 75% scale');
  assert.strictEqual(ws1.views[0].rightToLeft, true, 'Must be RTL mode');
  console.log('✅ Page Setup verified: A4, Landscape, 75% scale, RTL view.');

  console.log('\n🎉 ALL SUBJECT EXPLORER EXPORT TESTS PASSED SUCCESSFULLY!');
}

runTests();
