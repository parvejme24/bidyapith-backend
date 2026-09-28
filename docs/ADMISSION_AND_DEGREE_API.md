# Admission & Degree Program API Specification

## 1. Single Degree Program Model
Students may enroll in exactly one active degree program (e.g. B.Sc. in CSE, M.Sc. in DSAI).

## 2. Admission Lifecycle & State Machine
1. **Submission**: Student submits admission application with credentials (`PENDING_REVIEW`).
2. **Admin Evaluation**: Academic admin reviews prerequisites and marks `APPROVED` or `REJECTED`.
3. **Admission Fee Payment**: Student pays admission invoice via bKash / Card gateway (`ENROLLED`).
4. **Semester Progression**: Student registers courses across 8 semesters (B.Sc.) or 4 semesters (M.Sc.).
5. **Graduation & Certificate**: Upon meeting credit requirements and 75% attendance rule, digital certificate is generated with HMAC SHA-256 verification.
