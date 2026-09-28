export interface IAdmissionApplication {
  id: string;
  studentName: string;
  email: string;
  phone: string;
  programId: string;
  programTitle: string;
  degreeType: 'B.Sc.' | 'M.Sc.';
  previousDegree?: string;
  previousCgpa?: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'PAYMENT_PENDING' | 'ENROLLED' | 'GRADUATED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string;
  admissionFee: number;
  isPaid: boolean;
  notes?: string;
}
