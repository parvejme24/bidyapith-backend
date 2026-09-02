import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttendanceStatus,
  CourseType,
  DayOfWeek,
  DegreeType,
  Designation,
  EnrollmentStatus,
  ExamType,
  InvoiceStatus,
  InvoiceType,
  LetterGrade,
  OfferingStatus,
  PaymentGateway,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
  SemesterStatus,
  SemesterTerm,
  StudentStatus,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ADMIN_EMAIL = 'admin@bidyapith.edu';
const ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin1234';
const STUDENT_PASSWORD = 'Student1234';
const INSTRUCTOR_PASSWORD = 'Teach1234';
const BCRYPT_ROUNDS = 12;

const addDays = (base: Date, days: number): Date => {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const academicTerm = (date: Date): { term: SemesterTerm; year: number } => {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month < 4) {
    return { term: SemesterTerm.SPRING, year };
  }
  if (month < 8) {
    return { term: SemesterTerm.SUMMER, year };
  }
  return { term: SemesterTerm.FALL, year };
};

const displayName = (term: SemesterTerm, year: number): string =>
  `${term.charAt(0)}${term.slice(1).toLowerCase()} ${year}`;

const bumpTerm = (slot: {
  term: SemesterTerm;
  year: number;
}): { term: SemesterTerm; year: number } => {
  if (slot.term === SemesterTerm.SPRING) {
    return { term: SemesterTerm.SUMMER, year: slot.year };
  }
  if (slot.term === SemesterTerm.SUMMER) {
    return { term: SemesterTerm.FALL, year: slot.year };
  }
  return { term: SemesterTerm.SPRING, year: slot.year + 1 };
};

const uniqueSlots = (
  candidates: { term: SemesterTerm; year: number }[],
): { term: SemesterTerm; year: number }[] => {
  const used = new Set<string>();
  const result: { term: SemesterTerm; year: number }[] = [];
  for (let slot of candidates) {
    let key = `${slot.term}-${slot.year}`;
    while (used.has(key)) {
      slot = bumpTerm(slot);
      key = `${slot.term}-${slot.year}`;
    }
    used.add(key);
    result.push(slot);
  }
  return result;
};

const semesterDates = (kind: 'completed' | 'registration' | 'upcoming', now: Date) => {
  if (kind === 'registration') {
    const registrationStart = addDays(now, -7);
    const registrationEnd = addDays(now, 21);
    const classStartDate = addDays(now, 22);
    return {
      registrationStart,
      registrationEnd,
      dropDeadline: addDays(now, 35),
      classStartDate,
      classEndDate: addDays(now, 120),
      resultPublishedAt: null as Date | null,
    };
  }
  if (kind === 'upcoming') {
    const registrationStart = addDays(now, 60);
    const registrationEnd = addDays(now, 90);
    const classStartDate = addDays(now, 95);
    return {
      registrationStart,
      registrationEnd,
      dropDeadline: addDays(now, 110),
      classStartDate,
      classEndDate: addDays(now, 180),
      resultPublishedAt: null as Date | null,
    };
  }
  const registrationStart = addDays(now, -200);
  const registrationEnd = addDays(now, -160);
  const classStartDate = addDays(now, -155);
  const classEndDate = addDays(now, -20);
  return {
    registrationStart,
    registrationEnd,
    dropDeadline: addDays(now, -140),
    classStartDate,
    classEndDate,
    resultPublishedAt: addDays(now, -10),
  };
};

const FIRST_NAMES = [
  'Aisha',
  'Rahim',
  'Nadia',
  'Karim',
  'Farah',
  'Imran',
  'Laila',
  'Tanvir',
  'Sadia',
  'Hasan',
  'Maliha',
  'Omar',
  'Yasmin',
  'Rafi',
  'Nusrat',
  'Adnan',
  'Shaila',
  'Jamal',
  'Priya',
  'Sajid',
  'Hina',
  'Arif',
  'Mehnaz',
  'Faisal',
  'Rina',
  'Nabil',
  'Tania',
  'Zahid',
  'Anika',
  'Shuvo',
] as const;

const COURSES: {
  code: string;
  title: string;
  credits: string;
  type: CourseType;
  level: number;
  dept: 'CSE' | 'MAT';
}[] = [
  {
    code: 'CSE-1101',
    title: 'Introduction to Programming',
    credits: '3.0',
    type: CourseType.CORE,
    level: 1,
    dept: 'CSE',
  },
  {
    code: 'CSE-1102',
    title: 'Programming Laboratory',
    credits: '1.5',
    type: CourseType.LAB,
    level: 1,
    dept: 'CSE',
  },
  {
    code: 'CSE-1201',
    title: 'Discrete Mathematics',
    credits: '3.0',
    type: CourseType.CORE,
    level: 1,
    dept: 'CSE',
  },
  {
    code: 'CSE-2201',
    title: 'Data Structures',
    credits: '3.0',
    type: CourseType.CORE,
    level: 2,
    dept: 'CSE',
  },
  {
    code: 'CSE-2202',
    title: 'Object-Oriented Programming',
    credits: '3.0',
    type: CourseType.CORE,
    level: 2,
    dept: 'CSE',
  },
  {
    code: 'CSE-2303',
    title: 'Database Systems',
    credits: '3.0',
    type: CourseType.CORE,
    level: 2,
    dept: 'CSE',
  },
  {
    code: 'CSE-3201',
    title: 'Software Engineering',
    credits: '3.0',
    type: CourseType.CORE,
    level: 3,
    dept: 'CSE',
  },
  {
    code: 'CSE-3301',
    title: 'Algorithms',
    credits: '3.0',
    type: CourseType.CORE,
    level: 3,
    dept: 'CSE',
  },
  {
    code: 'CSE-3303',
    title: 'Operating Systems',
    credits: '3.0',
    type: CourseType.CORE,
    level: 3,
    dept: 'CSE',
  },
  {
    code: 'CSE-4401',
    title: 'Compiler Design',
    credits: '3.0',
    type: CourseType.CORE,
    level: 4,
    dept: 'CSE',
  },
  {
    code: 'MAT-1101',
    title: 'Calculus I',
    credits: '3.0',
    type: CourseType.CORE,
    level: 1,
    dept: 'MAT',
  },
  {
    code: 'MAT-1201',
    title: 'Calculus II',
    credits: '3.0',
    type: CourseType.CORE,
    level: 1,
    dept: 'MAT',
  },
  {
    code: 'MAT-2101',
    title: 'Linear Algebra',
    credits: '3.0',
    type: CourseType.CORE,
    level: 2,
    dept: 'MAT',
  },
  {
    code: 'MAT-2201',
    title: 'Probability and Statistics',
    credits: '3.0',
    type: CourseType.CORE,
    level: 2,
    dept: 'MAT',
  },
];

const PREREQS: [string, string][] = [
  ['CSE-2201', 'CSE-1101'],
  ['CSE-2202', 'CSE-1101'],
  ['CSE-3301', 'CSE-2201'],
  ['CSE-3303', 'CSE-2201'],
  ['CSE-4401', 'CSE-3301'],
  ['MAT-1201', 'MAT-1101'],
  ['MAT-2101', 'MAT-1101'],
];

const gradePoint = (letter: LetterGrade): Prisma.Decimal | null => {
  const table: Partial<Record<LetterGrade, string>> = {
    A_PLUS: '4.00',
    A: '3.75',
    A_MINUS: '3.50',
    B_PLUS: '3.25',
    B: '3.00',
    B_MINUS: '2.75',
    C_PLUS: '2.50',
    C: '2.25',
    D: '2.00',
    F: '0.00',
  };
  const value = table[letter];
  return value === undefined ? null : new Prisma.Decimal(value);
};

async function main(): Promise<void> {
  const now = new Date();
  const [completedSlot, retakeSlot, registrationSlot, upcomingSlot] = uniqueSlots([
    academicTerm(addDays(now, -540)),
    academicTerm(addDays(now, -240)),
    academicTerm(now),
    academicTerm(addDays(now, 180)),
  ]);
  if (
    completedSlot === undefined ||
    retakeSlot === undefined ||
    registrationSlot === undefined ||
    upcomingSlot === undefined
  ) {
    throw new Error('Failed to allocate unique semester slots');
  }

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const studentHash = await bcrypt.hash(STUDENT_PASSWORD, BCRYPT_ROUNDS);
  const instructorHash = await bcrypt.hash(INSTRUCTOR_PASSWORD, BCRYPT_ROUNDS);

  const cse = await prisma.department.upsert({
    where: { code: 'CSE' },
    update: {
      name: 'Computer Science and Engineering',
      contactEmail: 'cse@bidyapith.edu',
      deletedAt: null,
    },
    create: {
      code: 'CSE',
      name: 'Computer Science and Engineering',
      contactEmail: 'cse@bidyapith.edu',
    },
  });
  const mat = await prisma.department.upsert({
    where: { code: 'MAT' },
    update: { name: 'Mathematics', contactEmail: 'mat@bidyapith.edu', deletedAt: null },
    create: { code: 'MAT', name: 'Mathematics', contactEmail: 'mat@bidyapith.edu' },
  });

  const bscCse = await prisma.program.upsert({
    where: { code: 'BSC-CSE' },
    update: {
      departmentId: cse.id,
      name: 'B.Sc. in Computer Science and Engineering',
      feePerCredit: '4500.00',
      registrationFee: '5000.00',
      deletedAt: null,
    },
    create: {
      code: 'BSC-CSE',
      name: 'B.Sc. in Computer Science and Engineering',
      departmentId: cse.id,
      degreeType: DegreeType.BSC,
      totalCredits: 140,
      durationYears: 4,
      minCreditsPerSemester: 9,
      maxCreditsPerSemester: 15,
      feePerCredit: '4500.00',
      registrationFee: '5000.00',
    },
  });
  const mscCse = await prisma.program.upsert({
    where: { code: 'MSC-CSE' },
    update: {
      departmentId: cse.id,
      name: 'M.Sc. in Computer Science and Engineering',
      feePerCredit: '6000.00',
      registrationFee: '8000.00',
      deletedAt: null,
    },
    create: {
      code: 'MSC-CSE',
      name: 'M.Sc. in Computer Science and Engineering',
      departmentId: cse.id,
      degreeType: DegreeType.MSC,
      totalCredits: 36,
      durationYears: 2,
      minCreditsPerSemester: 6,
      maxCreditsPerSemester: 12,
      feePerCredit: '6000.00',
      registrationFee: '8000.00',
    },
  });
  const bscMat = await prisma.program.upsert({
    where: { code: 'BSC-MAT' },
    update: {
      departmentId: mat.id,
      name: 'B.Sc. in Mathematics',
      feePerCredit: '3500.00',
      registrationFee: '4000.00',
      deletedAt: null,
    },
    create: {
      code: 'BSC-MAT',
      name: 'B.Sc. in Mathematics',
      departmentId: mat.id,
      degreeType: DegreeType.BSC,
      totalCredits: 128,
      durationYears: 4,
      minCreditsPerSemester: 9,
      maxCreditsPerSemester: 15,
      feePerCredit: '3500.00',
      registrationFee: '4000.00',
    },
  });

  const courseByCode = new Map<string, { id: string; code: string }>();
  for (const course of COURSES) {
    const row = await prisma.course.upsert({
      where: { code: course.code },
      update: {
        title: course.title,
        credits: course.credits,
        type: course.type,
        level: course.level,
        departmentId: course.dept === 'CSE' ? cse.id : mat.id,
        deletedAt: null,
      },
      create: {
        code: course.code,
        title: course.title,
        credits: course.credits,
        type: course.type,
        level: course.level,
        departmentId: course.dept === 'CSE' ? cse.id : mat.id,
      },
    });
    courseByCode.set(course.code, row);
  }

  const requireCourse = (code: string) => {
    const row = courseByCode.get(code);
    if (row === undefined) {
      throw new Error(`Course ${code} was not seeded`);
    }
    return row;
  };

  for (const program of [bscCse, bscMat, mscCse]) {
    const codes =
      program.code === 'BSC-MAT'
        ? COURSES.filter((c) => c.dept === 'MAT' || c.code.startsWith('CSE-11')).map((c) => c.code)
        : COURSES.filter((c) => c.dept === 'CSE' || c.code.startsWith('MAT-11')).map((c) => c.code);
    for (const [index, code] of codes.entries()) {
      await prisma.programCourse.upsert({
        where: { programId_courseId: { programId: program.id, courseId: requireCourse(code).id } },
        update: { recommendedSemester: (index % 8) + 1, type: CourseType.CORE },
        create: {
          programId: program.id,
          courseId: requireCourse(code).id,
          type: CourseType.CORE,
          recommendedSemester: (index % 8) + 1,
        },
      });
    }
  }

  for (const [courseCode, prereqCode] of PREREQS) {
    await prisma.coursePrerequisite.upsert({
      where: {
        courseId_prerequisiteId: {
          courseId: requireCourse(courseCode).id,
          prerequisiteId: requireCourse(prereqCode).id,
        },
      },
      update: { minGradePoint: '2.00' },
      create: {
        courseId: requireCourse(courseCode).id,
        prerequisiteId: requireCourse(prereqCode).id,
        minGradePoint: '2.00',
      },
    });
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: adminHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      deletedAt: null,
    },
    create: {
      firstName: 'System',
      lastName: 'Admin',
      email: ADMIN_EMAIL,
      password: adminHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
  });

  const instructorSpecs = [
    {
      email: 'instructor01@bidyapith.edu',
      first: 'Mahmud',
      last: 'Hasan',
      dept: cse.id,
      spec: 'Algorithms',
      des: Designation.PROFESSOR,
    },
    {
      email: 'instructor02@bidyapith.edu',
      first: 'Nusrat',
      last: 'Jahan',
      dept: cse.id,
      spec: 'Databases',
      des: Designation.ASSOCIATE_PROFESSOR,
    },
    {
      email: 'instructor03@bidyapith.edu',
      first: 'Arif',
      last: 'Rahman',
      dept: cse.id,
      spec: 'Software Engineering',
      des: Designation.ASSISTANT_PROFESSOR,
    },
    {
      email: 'instructor04@bidyapith.edu',
      first: 'Sabina',
      last: 'Yasmin',
      dept: cse.id,
      spec: 'Programming',
      des: Designation.LECTURER,
    },
    {
      email: 'instructor05@bidyapith.edu',
      first: 'Kamal',
      last: 'Uddin',
      dept: mat.id,
      spec: 'Calculus',
      des: Designation.ASSOCIATE_PROFESSOR,
    },
    {
      email: 'instructor06@bidyapith.edu',
      first: 'Rina',
      last: 'Akter',
      dept: mat.id,
      spec: 'Linear Algebra',
      des: Designation.LECTURER,
    },
  ] as const;

  const instructors: { profileId: string; email: string }[] = [];
  for (const [index, spec] of instructorSpecs.entries()) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        password: instructorHash,
        firstName: spec.first,
        lastName: spec.last,
        role: Role.INSTRUCTOR,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
      },
      create: {
        firstName: spec.first,
        lastName: spec.last,
        email: spec.email,
        password: instructorHash,
        role: Role.INSTRUCTOR,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });
    const employeeId = `EMP-${String(index + 1).padStart(4, '0')}`;
    const existing = await prisma.instructorProfile.findUnique({ where: { userId: user.id } });
    const profile =
      existing === null
        ? await prisma.instructorProfile.create({
            data: {
              userId: user.id,
              employeeId,
              departmentId: spec.dept,
              designation: spec.des,
              specialization: spec.spec,
              joiningDate: new Date('2018-01-15'),
            },
          })
        : await prisma.instructorProfile.update({
            where: { id: existing.id },
            data: {
              departmentId: spec.dept,
              designation: spec.des,
              specialization: spec.spec,
              deletedAt: null,
            },
          });
    instructors.push({ profileId: profile.id, email: spec.email });
  }

  const requireInstructor = (index: number) => {
    const row = instructors[index];
    if (row === undefined) {
      throw new Error(`Instructor ${index} missing`);
    }
    return row;
  };

  const upsertSemester = async (
    slot: { term: SemesterTerm; year: number },
    status: SemesterStatus,
    kind: 'completed' | 'registration' | 'upcoming',
  ) => {
    const dates = semesterDates(kind, now);
    return prisma.semester.upsert({
      where: { term_year: { term: slot.term, year: slot.year } },
      update: {
        name: displayName(slot.term, slot.year),
        status,
        ...dates,
        deletedAt: null,
      },
      create: {
        term: slot.term,
        year: slot.year,
        name: displayName(slot.term, slot.year),
        status,
        ...dates,
      },
    });
  };

  const completedSemester = await upsertSemester(
    completedSlot,
    SemesterStatus.COMPLETED,
    'completed',
  );
  const retakeSemester = await upsertSemester(retakeSlot, SemesterStatus.COMPLETED, 'completed');
  const registrationSemester = await upsertSemester(
    registrationSlot,
    SemesterStatus.REGISTRATION,
    'registration',
  );
  const upcomingSemester = await upsertSemester(upcomingSlot, SemesterStatus.UPCOMING, 'upcoming');

  const students: {
    profileId: string;
    userId: string;
    email: string;
    studentId: string;
  }[] = [];

  for (let index = 0; index < 30; index += 1) {
    const n = index + 1;
    const email = `student${String(n).padStart(2, '0')}@bidyapith.edu`;
    const program = index < 20 ? bscCse : bscMat;
    const batch = index % 2 === 0 ? '2024' : '2025';
    const studentId =
      program.code === 'BSC-CSE'
        ? `2024-BSC-CSE-${String(n).padStart(4, '0')}`
        : `2024-BSC-MAT-${String(n).padStart(4, '0')}`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: studentHash,
        firstName: FIRST_NAMES[index] ?? 'Student',
        lastName: `Seed${String(n).padStart(2, '0')}`,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        deletedAt: null,
      },
      create: {
        firstName: FIRST_NAMES[index] ?? 'Student',
        lastName: `Seed${String(n).padStart(2, '0')}`,
        email,
        password: studentHash,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });
    const existing = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    const profile =
      existing === null
        ? await prisma.studentProfile.create({
            data: {
              userId: user.id,
              studentId,
              programId: program.id,
              batch,
              admissionDate: new Date(`${batch}-01-15`),
              status: StudentStatus.ACTIVE,
            },
          })
        : await prisma.studentProfile.update({
            where: { id: existing.id },
            data: {
              programId: program.id,
              batch,
              status: StudentStatus.ACTIVE,
              deletedAt: null,
            },
          });
    students.push({ profileId: profile.id, userId: user.id, email, studentId });
  }

  const studentAt = (index: number) => {
    const row = students[index];
    if (row === undefined) {
      throw new Error(`Student ${index} missing`);
    }
    return row;
  };

  const upsertOffering = async (input: {
    courseCode: string;
    semesterId: string;
    section: string;
    instructorIndex: number;
    capacity: number;
    enrolledCount: number;
    status: OfferingStatus;
    room: string;
    day: DayOfWeek;
    start: string;
    end: string;
  }) => {
    const offering = await prisma.courseOffering.upsert({
      where: {
        courseId_semesterId_section: {
          courseId: requireCourse(input.courseCode).id,
          semesterId: input.semesterId,
          section: input.section,
        },
      },
      update: {
        instructorId: requireInstructor(input.instructorIndex).profileId,
        capacity: input.capacity,
        enrolledCount: input.enrolledCount,
        status: input.status,
        room: input.room,
        deletedAt: null,
      },
      create: {
        courseId: requireCourse(input.courseCode).id,
        semesterId: input.semesterId,
        instructorId: requireInstructor(input.instructorIndex).profileId,
        section: input.section,
        capacity: input.capacity,
        enrolledCount: input.enrolledCount,
        status: input.status,
        room: input.room,
      },
    });
    await prisma.classSchedule.upsert({
      where: {
        offeringId_dayOfWeek_startTime: {
          offeringId: offering.id,
          dayOfWeek: input.day,
          startTime: input.start,
        },
      },
      update: { endTime: input.end, room: input.room },
      create: {
        offeringId: offering.id,
        dayOfWeek: input.day,
        startTime: input.start,
        endTime: input.end,
        room: input.room,
      },
    });
    return offering;
  };

  const completed1101 = await upsertOffering({
    courseCode: 'CSE-1101',
    semesterId: completedSemester.id,
    section: 'A',
    instructorIndex: 3,
    capacity: 40,
    enrolledCount: 8,
    status: OfferingStatus.COMPLETED,
    room: 'CSE-101',
    day: DayOfWeek.SUNDAY,
    start: '09:00',
    end: '10:30',
  });
  const completed2201 = await upsertOffering({
    courseCode: 'CSE-2201',
    semesterId: completedSemester.id,
    section: 'A',
    instructorIndex: 0,
    capacity: 40,
    enrolledCount: 4,
    status: OfferingStatus.COMPLETED,
    room: 'CSE-201',
    day: DayOfWeek.MONDAY,
    start: '11:00',
    end: '12:30',
  });
  const completed1201 = await upsertOffering({
    courseCode: 'CSE-1201',
    semesterId: completedSemester.id,
    section: 'A',
    instructorIndex: 2,
    capacity: 40,
    enrolledCount: 4,
    status: OfferingStatus.COMPLETED,
    room: 'CSE-102',
    day: DayOfWeek.TUESDAY,
    start: '09:00',
    end: '10:30',
  });
  const completedMat = await upsertOffering({
    courseCode: 'MAT-1101',
    semesterId: completedSemester.id,
    section: 'A',
    instructorIndex: 4,
    capacity: 40,
    enrolledCount: 4,
    status: OfferingStatus.COMPLETED,
    room: 'MAT-101',
    day: DayOfWeek.WEDNESDAY,
    start: '09:00',
    end: '10:30',
  });
  const retake2201 = await upsertOffering({
    courseCode: 'CSE-2201',
    semesterId: retakeSemester.id,
    section: 'A',
    instructorIndex: 0,
    capacity: 40,
    enrolledCount: 1,
    status: OfferingStatus.COMPLETED,
    room: 'CSE-201',
    day: DayOfWeek.MONDAY,
    start: '11:00',
    end: '12:30',
  });

  const reg1101 = await upsertOffering({
    courseCode: 'CSE-1101',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 3,
    capacity: 40,
    enrolledCount: 2,
    status: OfferingStatus.OPEN,
    room: 'CSE-101',
    day: DayOfWeek.SUNDAY,
    start: '09:00',
    end: '10:30',
  });
  const reg2201 = await upsertOffering({
    courseCode: 'CSE-2201',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 0,
    capacity: 40,
    enrolledCount: 0,
    status: OfferingStatus.OPEN,
    room: 'CSE-201',
    day: DayOfWeek.TUESDAY,
    start: '11:00',
    end: '12:30',
  });
  const reg3301 = await upsertOffering({
    courseCode: 'CSE-3301',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 0,
    capacity: 40,
    enrolledCount: 0,
    status: OfferingStatus.OPEN,
    room: 'CSE-301',
    day: DayOfWeek.WEDNESDAY,
    start: '11:00',
    end: '12:30',
  });
  const regFull = await upsertOffering({
    courseCode: 'CSE-1102',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 3,
    capacity: 5,
    enrolledCount: 5,
    status: OfferingStatus.OPEN,
    room: 'LAB-1',
    day: DayOfWeek.THURSDAY,
    start: '14:00',
    end: '16:00',
  });
  const regLastSeat = await upsertOffering({
    courseCode: 'MAT-1101',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 4,
    capacity: 2,
    enrolledCount: 1,
    status: OfferingStatus.OPEN,
    room: 'MAT-101',
    day: DayOfWeek.SUNDAY,
    start: '14:00',
    end: '15:30',
  });
  const regConflictA = await upsertOffering({
    courseCode: 'CSE-2303',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 1,
    capacity: 40,
    enrolledCount: 1,
    status: OfferingStatus.OPEN,
    room: 'CSE-202',
    day: DayOfWeek.MONDAY,
    start: '09:00',
    end: '10:30',
  });
  const regConflictB = await upsertOffering({
    courseCode: 'CSE-3201',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 2,
    capacity: 40,
    enrolledCount: 0,
    status: OfferingStatus.OPEN,
    room: 'CSE-203',
    day: DayOfWeek.MONDAY,
    start: '09:00',
    end: '10:30',
  });
  const regMat1201 = await upsertOffering({
    courseCode: 'MAT-1201',
    semesterId: registrationSemester.id,
    section: 'A',
    instructorIndex: 5,
    capacity: 40,
    enrolledCount: 0,
    status: OfferingStatus.OPEN,
    room: 'MAT-102',
    day: DayOfWeek.TUESDAY,
    start: '14:00',
    end: '15:30',
  });

  const upsertEnrollment = async (input: {
    studentIndex: number;
    offeringId: string;
    status: EnrollmentStatus;
    letter?: LetterGrade;
    marks?: string;
    examEligible?: boolean;
  }) => {
    const student = studentAt(input.studentIndex);
    const letter = input.letter;
    const point = letter === undefined ? null : gradePoint(letter);
    return prisma.enrollment.upsert({
      where: {
        studentId_offeringId: { studentId: student.profileId, offeringId: input.offeringId },
      },
      update: {
        status: input.status,
        ...(letter !== undefined ? { letterGrade: letter, gradePoint: point } : {}),
        ...(input.marks !== undefined ? { totalMarks: input.marks } : {}),
        examEligible: input.examEligible ?? true,
      },
      create: {
        studentId: student.profileId,
        offeringId: input.offeringId,
        status: input.status,
        ...(letter !== undefined ? { letterGrade: letter, gradePoint: point } : {}),
        ...(input.marks !== undefined ? { totalMarks: input.marks } : {}),
        examEligible: input.examEligible ?? true,
      },
    });
  };

  const clean = 0;
  const hold = 1;
  const lowAttend = 2;
  const retake = 3;

  await upsertEnrollment({
    studentIndex: clean,
    offeringId: completed1101.id,
    status: EnrollmentStatus.COMPLETED,
    letter: LetterGrade.A_PLUS,
    marks: '92.00',
  });
  await upsertEnrollment({
    studentIndex: clean,
    offeringId: completed1201.id,
    status: EnrollmentStatus.COMPLETED,
    letter: LetterGrade.A,
    marks: '86.00',
  });
  await upsertEnrollment({
    studentIndex: clean,
    offeringId: completedMat.id,
    status: EnrollmentStatus.COMPLETED,
    letter: LetterGrade.B,
    marks: '72.00',
  });

  await upsertEnrollment({
    studentIndex: hold,
    offeringId: completed1101.id,
    status: EnrollmentStatus.COMPLETED,
    letter: LetterGrade.B_PLUS,
    marks: '78.00',
  });

  await upsertEnrollment({
    studentIndex: retake,
    offeringId: completed1101.id,
    status: EnrollmentStatus.COMPLETED,
    letter: LetterGrade.A,
    marks: '85.00',
  });
  await upsertEnrollment({
    studentIndex: retake,
    offeringId: completed2201.id,
    status: EnrollmentStatus.FAILED,
    letter: LetterGrade.F,
    marks: '32.00',
  });
  await upsertEnrollment({
    studentIndex: retake,
    offeringId: retake2201.id,
    status: EnrollmentStatus.COMPLETED,
    letter: LetterGrade.B,
    marks: '68.00',
  });

  for (const index of [4, 5, 6, 7]) {
    await upsertEnrollment({
      studentIndex: index,
      offeringId: completed1101.id,
      status: EnrollmentStatus.COMPLETED,
      letter: LetterGrade.B,
      marks: '70.00',
    });
  }

  const lowEnrollment = await upsertEnrollment({
    studentIndex: lowAttend,
    offeringId: reg1101.id,
    status: EnrollmentStatus.ENROLLED,
    examEligible: false,
  });
  await upsertEnrollment({
    studentIndex: clean,
    offeringId: reg1101.id,
    status: EnrollmentStatus.ENROLLED,
  });
  await upsertEnrollment({
    studentIndex: 5,
    offeringId: regConflictA.id,
    status: EnrollmentStatus.ENROLLED,
  });
  await upsertEnrollment({
    studentIndex: 6,
    offeringId: regLastSeat.id,
    status: EnrollmentStatus.ENROLLED,
  });
  for (const index of [9, 10, 11, 12, 13]) {
    await upsertEnrollment({
      studentIndex: index,
      offeringId: regFull.id,
      status: EnrollmentStatus.ENROLLED,
    });
  }

  const attendDates = [addDays(now, -10), addDays(now, -9), addDays(now, -8), addDays(now, -7)];
  const attendStatuses = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.ABSENT,
  ];
  for (const [index, date] of attendDates.entries()) {
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const status = attendStatuses[index] ?? AttendanceStatus.ABSENT;
    await prisma.attendance.upsert({
      where: { enrollmentId_date: { enrollmentId: lowEnrollment.id, date: day } },
      update: { status },
      create: { enrollmentId: lowEnrollment.id, date: day, status },
    });
  }

  const upsertResult = async (
    studentIndex: number,
    semesterId: string,
    gpa: string,
    attempted: string,
    earned: string,
    cgpa: string,
  ) => {
    const publishedAt = addDays(now, -10);
    await prisma.semesterResult.upsert({
      where: {
        studentId_semesterId: { studentId: studentAt(studentIndex).profileId, semesterId },
      },
      update: {
        gpa,
        creditsAttempted: attempted,
        creditsEarned: earned,
        cgpaSnapshot: cgpa,
        isPublished: true,
        publishedAt,
      },
      create: {
        studentId: studentAt(studentIndex).profileId,
        semesterId,
        gpa,
        creditsAttempted: attempted,
        creditsEarned: earned,
        cgpaSnapshot: cgpa,
        isPublished: true,
        publishedAt,
      },
    });
  };

  await upsertResult(clean, completedSemester.id, '3.58', '9.0', '9.0', '3.58');
  await upsertResult(hold, completedSemester.id, '3.25', '3.0', '3.0', '3.25');
  await upsertResult(retake, completedSemester.id, '1.88', '6.0', '3.0', '1.88');
  await upsertResult(retake, retakeSemester.id, '3.00', '3.0', '3.0', '3.38');

  await prisma.studentProfile.update({
    where: { id: studentAt(clean).profileId },
    data: { cgpa: '3.58', totalCreditsEarned: '9.0' },
  });
  await prisma.studentProfile.update({
    where: { id: studentAt(hold).profileId },
    data: { cgpa: '3.25', totalCreditsEarned: '3.0' },
  });
  await prisma.studentProfile.update({
    where: { id: studentAt(retake).profileId },
    data: { cgpa: '3.38', totalCreditsEarned: '6.0' },
  });

  const upsertInvoice = async (input: {
    studentIndex: number;
    semesterId: string;
    type: InvoiceType;
    number: string;
    status: InvoiceStatus;
    total: string;
    paid: string;
    due: Date;
    paidAt?: Date;
  }) => {
    await prisma.feeInvoice.upsert({
      where: {
        studentId_semesterId_type: {
          studentId: studentAt(input.studentIndex).profileId,
          semesterId: input.semesterId,
          type: input.type,
        },
      },
      update: {
        invoiceNumber: input.number,
        status: input.status,
        totalAmount: input.total,
        paidAmount: input.paid,
        dueDate: input.due,
        paidAt: input.paidAt ?? null,
        deletedAt: null,
      },
      create: {
        invoiceNumber: input.number,
        studentId: studentAt(input.studentIndex).profileId,
        semesterId: input.semesterId,
        type: input.type,
        status: input.status,
        totalAmount: input.total,
        paidAmount: input.paid,
        dueDate: input.due,
        paidAt: input.paidAt ?? null,
      },
    });
  };

  await upsertInvoice({
    studentIndex: clean,
    semesterId: completedSemester.id,
    type: InvoiceType.TUITION,
    number: 'INV-SEED-PAID-0001',
    status: InvoiceStatus.PAID,
    total: '13500.00',
    paid: '13500.00',
    due: addDays(now, -120),
    paidAt: addDays(now, -110),
  });
  await upsertInvoice({
    studentIndex: clean,
    semesterId: registrationSemester.id,
    type: InvoiceType.REGISTRATION,
    number: 'INV-SEED-CUR-0001',
    status: InvoiceStatus.UNPAID,
    total: '5000.00',
    paid: '0.00',
    due: addDays(now, 14),
  });
  await upsertInvoice({
    studentIndex: hold,
    semesterId: completedSemester.id,
    type: InvoiceType.TUITION,
    number: 'INV-SEED-DUE-0001',
    status: InvoiceStatus.UNPAID,
    total: '13500.00',
    paid: '0.00',
    due: addDays(now, -40),
  });

  const paidInvoice = await prisma.feeInvoice.findUnique({
    where: { invoiceNumber: 'INV-SEED-PAID-0001' },
  });
  if (paidInvoice !== null) {
    await prisma.payment.upsert({
      where: { transactionRef: 'PAY-SEED-PAID-0001' },
      update: {
        invoiceId: paidInvoice.id,
        status: PaymentStatus.SUCCESS,
        amount: '13500.00',
        paidAt: addDays(now, -110),
        gatewayTransactionId: 'pi_seed_paid_0001',
      },
      create: {
        invoiceId: paidInvoice.id,
        transactionRef: 'PAY-SEED-PAID-0001',
        gateway: PaymentGateway.STRIPE,
        status: PaymentStatus.SUCCESS,
        amount: '13500.00',
        paidAt: addDays(now, -110),
        gatewayTransactionId: 'pi_seed_paid_0001',
      },
    });
  }

  const upsertFinalExam = async (offeringId: string, title: string) => {
    const existing = await prisma.exam.findFirst({
      where: { offeringId, type: ExamType.FINAL, deletedAt: null },
    });
    if (existing === null) {
      return prisma.exam.create({
        data: {
          offeringId,
          type: ExamType.FINAL,
          title,
          totalMarks: '100.00',
          weight: '100.00',
          examDate: addDays(now, -30),
          isPublished: true,
        },
      });
    }
    return prisma.exam.update({
      where: { id: existing.id },
      data: { title, isPublished: true, deletedAt: null },
    });
  };

  const exam1101 = await upsertFinalExam(completed1101.id, 'CSE-1101 Final');
  const graded1101 = await prisma.enrollment.findMany({
    where: {
      offeringId: completed1101.id,
      status: { in: [EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED] },
    },
    select: { id: true, totalMarks: true },
  });
  for (const row of graded1101) {
    const marks = row.totalMarks ?? new Prisma.Decimal('70.00');
    await prisma.examResult.upsert({
      where: { examId_enrollmentId: { examId: exam1101.id, enrollmentId: row.id } },
      update: { marksObtained: marks },
      create: { examId: exam1101.id, enrollmentId: row.id, marksObtained: marks },
    });
  }

  const occupiedStatuses = [
    EnrollmentStatus.ENROLLED,
    EnrollmentStatus.COMPLETED,
    EnrollmentStatus.FAILED,
  ];
  const syncSeats = async (offeringId: string, mode?: 'full' | 'lastSeat') => {
    const occupied = await prisma.enrollment.count({
      where: { offeringId, status: { in: occupiedStatuses } },
    });
    const capacity =
      mode === 'full' ? Math.max(occupied, 1) : mode === 'lastSeat' ? occupied + 1 : undefined;
    await prisma.courseOffering.update({
      where: { id: offeringId },
      data: {
        enrolledCount: occupied,
        ...(capacity === undefined ? {} : { capacity }),
      },
    });
    return { occupied, capacity };
  };

  await syncSeats(completed1101.id);
  await syncSeats(completed2201.id);
  await syncSeats(completed1201.id);
  await syncSeats(completedMat.id);
  await syncSeats(retake2201.id);
  await syncSeats(reg1101.id);
  await syncSeats(reg2201.id);
  await syncSeats(reg3301.id);
  await syncSeats(regConflictA.id);
  await syncSeats(regConflictB.id);
  await syncSeats(regMat1201.id);
  const fullSeats = await syncSeats(regFull.id, 'full');
  const lastSeats = await syncSeats(regLastSeat.id, 'lastSeat');

  const counts = {
    users: await prisma.user.count({ where: { deletedAt: null } }),
    departments: await prisma.department.count({ where: { deletedAt: null } }),
    programs: await prisma.program.count({ where: { deletedAt: null } }),
    courses: await prisma.course.count({ where: { deletedAt: null } }),
    semesters: await prisma.semester.count({ where: { deletedAt: null } }),
    offerings: await prisma.courseOffering.count({ where: { deletedAt: null } }),
    enrollments: await prisma.enrollment.count(),
    invoices: await prisma.feeInvoice.count({ where: { deletedAt: null } }),
    payments: await prisma.payment.count(),
    exams: await prisma.exam.count({ where: { deletedAt: null } }),
    semesterResults: await prisma.semesterResult.count(),
  };

  console.log('\nBidyapith seed complete\n');
  console.log('Counts');
  console.log(`  users            ${counts.users}`);
  console.log(`  departments      ${counts.departments}`);
  console.log(`  programs         ${counts.programs}`);
  console.log(`  courses          ${counts.courses}`);
  console.log(`  semesters        ${counts.semesters}`);
  console.log(`  offerings        ${counts.offerings}`);
  console.log(`  enrollments      ${counts.enrollments}`);
  console.log(`  invoices         ${counts.invoices}`);
  console.log(`  payments         ${counts.payments}`);
  console.log(`  exams            ${counts.exams}`);
  console.log(`  semesterResults  ${counts.semesterResults}`);
  console.log('\nAdmin');
  console.log(`  ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  console.log('\nInstructors  (password Teach1234)');
  console.log(`  ${requireInstructor(0).email}   Algorithms, CSE-3301`);
  console.log('\nDemo students  (password Student1234)');
  console.log(`  ${studentAt(clean).email}   clean record + published transcript`);
  console.log(`  ${studentAt(hold).email}   unpaid overdue invoice (402 financial hold)`);
  console.log(`  ${studentAt(lowAttend).email}   attendance < 75% (examEligible false)`);
  console.log(`  ${studentAt(retake).email}   failed CSE-2201 then retake B (superseded F)`);
  console.log('\nSemesters');
  console.log(`  completed     ${completedSemester.name}  ${completedSemester.id}`);
  console.log(`  retake term   ${retakeSemester.name}  ${retakeSemester.id}`);
  console.log(`  registration  ${registrationSemester.name}  ${registrationSemester.id}`);
  console.log(`  upcoming      ${upcomingSemester.name}  ${upcomingSemester.id}`);
  console.log('\nOfferings for failure demos (paste into Postman collection variables)');
  console.log(
    `  fullOfferingId        ${regFull.id}  CSE-1102 A  ${fullSeats.occupied}/${fullSeats.capacity}`,
  );
  console.log(
    `  oneSeatOfferingId     ${regLastSeat.id}  MAT-1101 A  ${lastSeats.occupied}/${lastSeats.capacity}`,
  );
  console.log(`  prereqOfferingId      ${reg3301.id}  CSE-3301 (needs CSE-2201)`);
  console.log(`  conflictOfferingId    ${regConflictB.id}  CSE-3201 Mon 09:00`);
  console.log(`  enrolledConflictId    ${regConflictA.id}  CSE-2303 Mon 09:00  (student06)`);
  console.log(`  introOfferingId       ${reg1101.id}  CSE-1101`);
  console.log(`  openOfferingId        ${reg2201.id}  CSE-2201 (use with student02 for 402)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
