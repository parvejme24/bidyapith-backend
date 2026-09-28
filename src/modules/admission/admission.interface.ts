export interface IAttachedDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

export interface IAdmissionApplication {
  id: string;
  studentName: string;
  email: string;
  studentEmail?: string | undefined;
  phone: string;
  programId: string;
  programTitle: string;
  degreeType?: 'B.Sc.' | 'M.Sc.' | 'BBA' | 'MBA' | undefined;
  applicationType?: 'DEGREE_ADMISSION' | 'COURSE_REGISTRATION' | undefined;
  courseCode?: string | undefined;
  courseTitle?: string | undefined;
  courseCredits?: number | undefined;
  previousDegree?: string | undefined;
  previousInstitute?: string | undefined;
  previousCgpa?: string | undefined;
  hscGpa?: string | undefined;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'PAYMENT_PENDING' | 'ENROLLED' | 'GRADUATED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string | undefined;
  admissionFee: number;
  isPaid: boolean;
  paymentStatus?: 'PAID' | 'PENDING' | undefined;
  attachedDocuments?: IAttachedDocument[] | undefined;
  motivationStatement?: string | undefined;
  notes?: string | undefined;
}
