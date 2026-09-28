import type { IAdmissionApplication } from './admission.interface';

export class AdmissionService {
  /**
   * Evaluates admission application eligibility based on prerequisite criteria.
   */
  public static evaluateApplication(app: Partial<IAdmissionApplication>): {
    eligible: boolean;
    recommendedStatus: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';
    reason: string;
  } {
    if (!app.previousCgpa) {
      return {
        eligible: false,
        recommendedStatus: 'PENDING_REVIEW',
        reason: 'Previous academic CGPA or HSC score required for departmental evaluation.',
      };
    }

    const gpaNum = parseFloat(app.previousCgpa);
    if (isNaN(gpaNum) || gpaNum < 3.0) {
      return {
        eligible: false,
        recommendedStatus: 'REJECTED',
        reason: 'Academic CGPA is below the minimum required institutional threshold of 3.00.',
      };
    }

    return {
      eligible: true,
      recommendedStatus: 'APPROVED',
      reason: 'Academic prerequisites satisfied. Eligible for admission payment and course enrollment.',
    };
  }
}
