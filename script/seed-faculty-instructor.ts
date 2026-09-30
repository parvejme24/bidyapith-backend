import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttendanceStatus,
  DayOfWeek,
  Designation,
  EnrollmentStatus,
  ExamType,
  LetterGrade,
  OfferingStatus,
  Prisma,
  PrismaClient,
  Role,
  SemesterTerm,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const databaseUrl = process.env['DATABASE_URL'];
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const facultyEmail = 'faculty@bidyapith.edu.bd';
const facultyPassword = 'Teach1234';

const courseSections = [
  {
    courseCode: 'CSE-2201',
    section: 'B',
    room: 'AB2-403',
    day: DayOfWeek.TUESDAY,
    start: '10:30',
    end: '12:00',
    attendanceDates: [
      new Date('2026-09-01'),
      new Date('2026-09-08'),
      new Date('2026-09-15'),
      new Date('2026-09-22'),
      new Date('2026-09-29'),
    ],
  },
  {
    courseCode: 'CSE-2303',
    section: 'B',
    room: 'AB2-307',
    day: DayOfWeek.WEDNESDAY,
    start: '09:00',
    end: '10:30',
    attendanceDates: [
      new Date('2026-09-02'),
      new Date('2026-09-09'),
      new Date('2026-09-16'),
      new Date('2026-09-23'),
      new Date('2026-09-30'),
    ],
  },
] as const;

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

async function main(): Promise<void> {
  const password = await bcrypt.hash(facultyPassword, 10);

  console.log(`Connecting and seeding faculty instructor: ${facultyEmail}...`);

  const department = await prisma.department.findUnique({
    where: { code: 'CSE' },
    select: { id: true },
  });
  if (department === null) throw new Error('CSE department was not found');

  const semester = await prisma.semester.findFirst({
    where: { term: SemesterTerm.FALL, year: 2026, deletedAt: null },
    select: { id: true, classStartDate: true },
  });
  if (semester === null) throw new Error('Fall 2026 semester was not found');

  const courses = await prisma.course.findMany({
    where: { code: { in: courseSections.map((item) => item.courseCode) }, deletedAt: null },
    select: { id: true, code: true },
  });
  const courseIdByCode = new Map(courses.map((course) => [course.code, course.id]));
  for (const section of courseSections) {
    if (!courseIdByCode.has(section.courseCode)) {
      throw new Error(`Course ${section.courseCode} was not found`);
    }
  }

  // 1. Create or update Faculty User
  const user = await prisma.user.upsert({
    where: { email: facultyEmail },
    update: {
      firstName: 'Faculty',
      lastName: 'Instructor',
      password,
      role: Role.INSTRUCTOR,
      status: UserStatus.ACTIVE,
      phone: '+8801711223369',
      emailVerified: true,
      deletedAt: null,
    },
    create: {
      email: facultyEmail,
      firstName: 'Faculty',
      lastName: 'Instructor',
      password,
      role: Role.INSTRUCTOR,
      status: UserStatus.ACTIVE,
      phone: '+8801711223369',
      emailVerified: true,
    },
  });

  // 2. Create or update InstructorProfile
  const currentProfile = await prisma.instructorProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, employeeId: true },
  });
  let employeeId = currentProfile?.employeeId;
  if (employeeId === undefined) {
    const usedEmployeeIds = new Set(
      (await prisma.instructorProfile.findMany({ select: { employeeId: true } })).map(
        (profile) => profile.employeeId,
      ),
    );
    let sequence = 9001;
    employeeId = `FAC-${sequence}`;
    while (usedEmployeeIds.has(employeeId)) {
      sequence += 1;
      employeeId = `FAC-${sequence}`;
    }
  }

  const instructor = await prisma.instructorProfile.upsert({
    where: { userId: user.id },
    update: {
      departmentId: department.id,
      designation: Designation.ASSISTANT_PROFESSOR,
      specialization: 'Computer Science & Engineering',
      deletedAt: null,
    },
    create: {
      userId: user.id,
      employeeId,
      departmentId: department.id,
      designation: Designation.ASSISTANT_PROFESSOR,
      specialization: 'Computer Science & Engineering',
      joiningDate: new Date('2026-01-15'),
    },
  });

  // 3. Find available students to enroll (up to 50 active students)
  const allStudents = await prisma.studentProfile.findMany({
    where: { deletedAt: null },
    select: { id: true, studentId: true, userId: true },
    orderBy: { studentId: 'asc' },
    take: 50,
  });

  if (allStudents.length < 25) {
    console.warn(`Only found ${allStudents.length} students in DB. Will assign available.`);
  }

  const result = [];

  for (let sIndex = 0; sIndex < courseSections.length; sIndex++) {
    const item = courseSections[sIndex];
    const courseId = courseIdByCode.get(item.courseCode)!;

    const uniqueSection = {
      courseId_semesterId_section: {
        courseId,
        semesterId: semester.id,
        section: item.section,
      },
    };

    // Ensure offering exists
    const offering = await prisma.courseOffering.upsert({
      where: uniqueSection,
      update: {
        instructorId: instructor.id,
        capacity: 45,
        status: OfferingStatus.OPEN,
        room: item.room,
        deletedAt: null,
      },
      create: {
        courseId,
        semesterId: semester.id,
        instructorId: instructor.id,
        section: item.section,
        capacity: 45,
        enrolledCount: 0,
        status: OfferingStatus.OPEN,
        room: item.room,
      },
    });

    // Class Schedule
    await prisma.classSchedule.upsert({
      where: {
        offeringId_dayOfWeek_startTime: {
          offeringId: offering.id,
          dayOfWeek: item.day,
          startTime: item.start,
        },
      },
      update: {
        endTime: item.end,
        room: item.room,
      },
      create: {
        offeringId: offering.id,
        dayOfWeek: item.day,
        startTime: item.start,
        endTime: item.end,
        room: item.room,
      },
    });

    // Assessments / Exams
    const assessments = [
      { type: ExamType.MIDTERM, title: 'Midterm Examination', marks: 30, weight: 30, day: 25 },
      { type: ExamType.ASSIGNMENT, title: 'Continuous Assessment', marks: 20, weight: 20, day: 35 },
      { type: ExamType.FINAL, title: 'Final Examination', marks: 50, weight: 50, day: 60 },
    ];

    const examMap = new Map<ExamType, string>();
    for (const assessment of assessments) {
      const existingExam = await prisma.exam.findFirst({
        where: { offeringId: offering.id, type: assessment.type, deletedAt: null },
      });
      if (existingExam) {
        examMap.set(assessment.type, existingExam.id);
      } else {
        const createdExam = await prisma.exam.create({
          data: {
            offeringId: offering.id,
            type: assessment.type,
            title: assessment.title,
            totalMarks: new Prisma.Decimal(assessment.marks),
            weight: new Prisma.Decimal(assessment.weight),
            examDate: addDays(semester.classStartDate, assessment.day),
          },
        });
        examMap.set(assessment.type, createdExam.id);
      }
    }

    // Assign 22 students per section
    const startOffset = (sIndex * 22) % Math.max(1, allStudents.length - 22);
    const assignedStudents = allStudents.slice(startOffset, startOffset + 22);

    console.log(`Enrolling ${assignedStudents.length} students into ${item.courseCode} Section ${item.section}...`);

    const attendanceRecords: Prisma.AttendanceCreateManyInput[] = [];
    const examResults: Prisma.ExamResultCreateManyInput[] = [];

    for (let idx = 0; idx < assignedStudents.length; idx++) {
      const sp = assignedStudents[idx];

      // Generate realistic marks
      const mid = 19 + ((idx * 5) % 10); // 19-28
      const assign = 14 + ((idx * 3) % 6); // 14-19
      const final = 36 + ((idx * 7) % 13); // 36-48
      const total = mid + assign + final;

      const letterGrade: LetterGrade =
        total >= 80 ? LetterGrade.A_PLUS : total >= 75 ? LetterGrade.A : total >= 70 ? LetterGrade.A_MINUS : LetterGrade.B_PLUS;
      const gradePoint = total >= 80 ? '4.00' : total >= 75 ? '3.75' : total >= 70 ? '3.50' : '3.25';

      const enrollment = await prisma.enrollment.upsert({
        where: {
          studentId_offeringId: {
            studentId: sp.id,
            offeringId: offering.id,
          },
        },
        update: {
          status: EnrollmentStatus.ENROLLED,
          examEligible: true,
          totalMarks: new Prisma.Decimal(total.toFixed(2)),
          letterGrade,
          gradePoint: new Prisma.Decimal(gradePoint),
          gradedAt: new Date('2026-09-28'),
        },
        create: {
          studentId: sp.id,
          offeringId: offering.id,
          status: EnrollmentStatus.ENROLLED,
          examEligible: true,
          totalMarks: new Prisma.Decimal(total.toFixed(2)),
          letterGrade,
          gradePoint: new Prisma.Decimal(gradePoint),
          gradedAt: new Date('2026-09-28'),
        },
      });

      // Attendance records
      for (let d = 0; d < item.attendanceDates.length; d++) {
        const attDate = item.attendanceDates[d];
        const status =
          (idx + d) % 9 === 0
            ? AttendanceStatus.ABSENT
            : (idx + d) % 5 === 0
              ? AttendanceStatus.LATE
              : AttendanceStatus.PRESENT;

        attendanceRecords.push({
          enrollmentId: enrollment.id,
          date: attDate,
          status,
        });
      }

      // Exam results
      const midExamId = examMap.get(ExamType.MIDTERM);
      if (midExamId) {
        examResults.push({
          examId: midExamId,
          enrollmentId: enrollment.id,
          marksObtained: new Prisma.Decimal(mid.toFixed(2)),
        });
      }
      const assignExamId = examMap.get(ExamType.ASSIGNMENT);
      if (assignExamId) {
        examResults.push({
          examId: assignExamId,
          enrollmentId: enrollment.id,
          marksObtained: new Prisma.Decimal(assign.toFixed(2)),
        });
      }
      const finalExamId = examMap.get(ExamType.FINAL);
      if (finalExamId) {
        examResults.push({
          examId: finalExamId,
          enrollmentId: enrollment.id,
          marksObtained: new Prisma.Decimal(final.toFixed(2)),
        });
      }
    }

    // Insert attendance in bulk
    await prisma.attendance.createMany({
      data: attendanceRecords,
      skipDuplicates: true,
    });

    // Insert exam results in bulk
    await prisma.examResult.createMany({
      data: examResults,
      skipDuplicates: true,
    });

    // Update offering enrolledCount
    const actualCount = await prisma.enrollment.count({
      where: { offeringId: offering.id, status: EnrollmentStatus.ENROLLED },
    });
    await prisma.courseOffering.update({
      where: { id: offering.id },
      data: { enrolledCount: actualCount },
    });

    result.push({
      course: item.courseCode,
      section: item.section,
      offeringId: offering.id,
      enrolledStudents: actualCount,
      attendanceSessions: item.attendanceDates.length,
    });
  }

  console.log('✅ Successfully seeded faculty instructor data:');
  console.log(JSON.stringify({ email: facultyEmail, employeeId: instructor.employeeId, offerings: result }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error('Error seeding faculty instructor:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });