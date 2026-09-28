import crypto from 'node:crypto';

export interface ICertificatePayload {
  studentId: string;
  studentName: string;
  programTitle: string;
  cgpa: number;
  graduationDate: string;
}

/**
 * Generates an immutable cryptographic hash verification code for graduation certificates.
 */
export function generateCertificateVerificationHash(payload: ICertificatePayload): string {
  const secret = process.env.CERTIFICATE_SECRET || 'bidyapith_academic_trust_root_2026';
  const dataString = `${payload.studentId}:${payload.studentName}:${payload.programTitle}:${payload.cgpa.toFixed(2)}:${payload.graduationDate}`;
  return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
}
