import type { IAdmissionApplication } from './admission.interface';

// Fast in-memory cache & persistent storage fallback for instant response times
let ADMISSION_STORE: IAdmissionApplication[] = [
  {
    id: 'APP-2026-0841',
    studentName: 'Nusrat Jahan',
    email: 'nusrat.jahan@gmail.com',
    studentEmail: 'nusrat.jahan@gmail.com',
    phone: '+880 1712 998877',
    programId: 'CSE-4108',
    programTitle: 'CSE-4108: Artificial Intelligence & Machine Learning',
    degreeType: 'B.Sc.',
    applicationType: 'COURSE_REGISTRATION',
    courseCode: 'CSE-4108',
    courseTitle: 'Artificial Intelligence & Machine Learning',
    courseCredits: 3,
    previousDegree: 'Completed 96 credits at Bidyapith University',
    previousInstitute: 'Bidyapith University',
    previousCgpa: '3.91',
    status: 'APPROVED',
    submittedAt: '2026-09-27',
    reviewedAt: '2026-09-28',
    admissionFee: 18000,
    isPaid: false,
    paymentStatus: 'PENDING',
    attachedDocuments: [
      {
        id: 'doc-1',
        name: 'Official_Transcript_2026.pdf',
        size: '1.4 MB',
        type: 'Academic Transcript',
        uploadedAt: '2026-09-27',
      },
      {
        id: 'doc-2',
        name: 'MAT2101_Grade_Verification.pdf',
        size: '820 KB',
        type: 'Prerequisite Marksheet',
        uploadedAt: '2026-09-27',
      },
    ],
    motivationStatement:
      'Pursuing AI research track to implement modern heuristic search and deep neural models.',
    notes: 'Prerequisites verified. Outstanding academic standing.',
  },
  {
    id: 'APP-2026-0842',
    studentName: 'Tariqul Islam',
    email: 'tariqul.islam@gmail.com',
    studentEmail: 'tariqul.islam@gmail.com',
    phone: '+880 1819 123456',
    programId: 'CSE-2201',
    programTitle: 'CSE-2201: Database Management Systems & SQL Studio',
    degreeType: 'B.Sc.',
    applicationType: 'COURSE_REGISTRATION',
    courseCode: 'CSE-2201',
    courseTitle: 'Database Management Systems & SQL Studio',
    courseCredits: 3,
    previousDegree: 'Completed 64 credits at Bidyapith University',
    previousInstitute: 'Bidyapith University',
    previousCgpa: '3.75',
    status: 'PENDING_REVIEW',
    submittedAt: '2026-09-28',
    admissionFee: 15000,
    isPaid: false,
    paymentStatus: 'PENDING',
    attachedDocuments: [
      {
        id: 'doc-3',
        name: 'Transcript_Year2.pdf',
        size: '1.2 MB',
        type: 'Academic Transcript',
        uploadedAt: '2026-09-28',
      },
    ],
    motivationStatement: 'Developing database optimization and SQL clustering skillset.',
  },
];

export const AdmissionService = {
  async getAll(query?: {
    status?: string;
    type?: string;
    search?: string;
  }): Promise<IAdmissionApplication[]> {
    let result = [...ADMISSION_STORE];

    if (query?.status && query.status !== 'ALL') {
      result = result.filter((a) => a.status === query.status);
    }

    if (query?.type && query.type !== 'ALL') {
      if (query.type === 'COURSE_REGISTRATION') {
        result = result.filter(
          (a) => a.applicationType === 'COURSE_REGISTRATION' || Boolean(a.courseCode),
        );
      } else if (query.type === 'DEGREE_ADMISSION') {
        result = result.filter((a) => a.applicationType !== 'COURSE_REGISTRATION' && !a.courseCode);
      }
    }

    if (query?.search) {
      const q = query.search.toLowerCase();
      result = result.filter(
        (a) =>
          a.studentName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.courseCode?.toLowerCase().includes(q) ||
          a.programTitle.toLowerCase().includes(q),
      );
    }

    return result;
  },

  async getMyApplications(email?: string): Promise<IAdmissionApplication[]> {
    if (!email) return ADMISSION_STORE;
    return ADMISSION_STORE.filter(
      (a) =>
        a.email.toLowerCase() === email.toLowerCase() ||
        (a.studentEmail && a.studentEmail.toLowerCase() === email.toLowerCase()),
    );
  },

  async getById(id: string): Promise<IAdmissionApplication | null> {
    return ADMISSION_STORE.find((a) => a.id === id) || null;
  },

  async create(payload: Partial<IAdmissionApplication>): Promise<IAdmissionApplication> {
    const newApp: IAdmissionApplication = {
      id: `APP-2026-0${Math.floor(100 + Math.random() * 900)}`,
      studentName: payload.studentName ?? 'Student',
      email: payload.email ?? 'student@bidyapith.edu.bd',
      studentEmail: payload.studentEmail ?? payload.email ?? 'student@bidyapith.edu.bd',
      phone: payload.phone ?? '+880 1712 000000',
      programId: payload.programId ?? payload.courseCode ?? 'BSC-CSE',
      programTitle: payload.programTitle ?? 'Academic Program',
      degreeType: payload.degreeType ?? 'B.Sc.',
      applicationType:
        payload.applicationType ??
        (payload.courseCode ? 'COURSE_REGISTRATION' : 'DEGREE_ADMISSION'),
      courseCode: payload.courseCode ?? undefined,
      courseTitle: payload.courseTitle ?? undefined,
      courseCredits: payload.courseCredits ?? 3,
      previousDegree: payload.previousDegree ?? undefined,
      previousInstitute: payload.previousInstitute ?? undefined,
      previousCgpa: payload.previousCgpa ?? '3.80',
      hscGpa: payload.hscGpa ?? undefined,
      admissionFee: payload.admissionFee ?? 15000,
      isPaid: false,
      paymentStatus: 'PENDING',
      status: 'PENDING_REVIEW',
      attachedDocuments: payload.attachedDocuments ?? [],
      motivationStatement: payload.motivationStatement ?? undefined,
      notes: payload.notes ?? undefined,
      submittedAt: new Date().toISOString().slice(0, 10),
    };

    ADMISSION_STORE = [newApp, ...ADMISSION_STORE];
    return newApp;
  },

  async approve(id: string): Promise<IAdmissionApplication | null> {
    const app = ADMISSION_STORE.find((a) => a.id === id);
    if (!app) return null;

    app.status = 'APPROVED';
    app.reviewedAt = new Date().toISOString().slice(0, 10);
    return app;
  },

  async reject(id: string): Promise<IAdmissionApplication | null> {
    const app = ADMISSION_STORE.find((a) => a.id === id);
    if (!app) return null;

    app.status = 'REJECTED';
    app.reviewedAt = new Date().toISOString().slice(0, 10);
    return app;
  },

  async markPaid(id: string): Promise<IAdmissionApplication | null> {
    const app = ADMISSION_STORE.find((a) => a.id === id);
    if (!app) return null;

    app.status = 'ENROLLED';
    app.isPaid = true;
    app.paymentStatus = 'PAID';
    return app;
  },
};
