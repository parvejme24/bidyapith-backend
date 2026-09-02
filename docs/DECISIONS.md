# Engineering decisions

Each note is the problem, the choice, and what that choice costs.

## 1. Seat capacity under concurrency

**The problem.** Two students can hit “enroll” on the last seat at the same moment. A read of `enrolledCount`, a check against `capacity`, then a write is a classic lost update: both requests see one seat, both write, the section is overfilled.

**What I chose.** The seat is taken with a single guarded update:

```sql
UPDATE course_offerings
SET enrolled_count = enrolled_count + 1
WHERE id = $1 AND enrolled_count < capacity AND deleted_at IS NULL
```

Zero rows means the section is full — the transaction throws 409 and rolls back. `enrolledCount` is denormalized so that check does not `COUNT(*)` the enrollment table under a lock.

**What I gave up.** The counter can drift if a write path forgets to increment or decrement. Every enroll and drop must go through `takeSeat` / `releaseSeat`. A live `COUNT` would be slower and still need locking; the counter is the cheaper invariant, with the unique `(studentId, offeringId)` constraint as a second line of defence.

## 2. Row lock for per-student checks, guarded update for cross-student

**The problem.** Enrollment runs eight checks (window, duplicate, prerequisites, credit limit, dues, schedule, capacity, then write). A blanket `SERIALIZABLE` transaction serializes unrelated students against each other and retries on conflicts that have nothing to do with seats.

**What I chose.** The transaction runs at the default `ReadCommitted`. The student row is locked with `SELECT ... FOR UPDATE` so one student cannot enroll in two overlapping sections at once. Seat contention is the guarded `UPDATE` above, which is correct under `ReadCommitted` because the predicate is evaluated atomically.

**What I gave up.** Serializable would have been simpler to explain and would catch some exotic anomalies automatically. It also aborts innocent concurrent enrollments on a busy registration morning. Per-student locking plus a conditional seat update is more code and more comments, and it is the isolation the load actually needs.

## 3. Materialized `SemesterResult`

**The problem.** A transcript joins enrollments, offerings, courses, and grade points across every semester the student has ever taken. Doing that aggregation on every `GET /students/me/transcript` repeats the same arithmetic and contends with live grading.

**What I chose.** GPA is computed once inside the publish-results transaction and written to `SemesterResult` (`gpa`, credits, `cgpaSnapshot`). Transcript reads those rows. Publish is the only writer; the student profile’s `cgpa` / `totalCreditsEarned` are updated in the same transaction.

**What I gave up.** A grade patched after publish is invisible on the transcript until someone republishes. That is intentional: a published result is a snapshot, not a live view. The cost is operational — corrections go through a controlled republish, not an implicit recompute.

## 4. Webhook idempotency via unique `gatewayTransactionId`

**The problem.** Stripe (and any gateway) will retry a webhook. Crediting `paidAmount` twice turns a paid invoice into an overpayment and a broken ledger.

**What I chose.** `Payment.gatewayTransactionId` is unique. The handler inserts or matches on that id, then credits with `updateMany` only where the payment is still unsettled (`gatewayTransactionId` null or status not yet `SUCCESS`). A duplicate delivery hits the unique constraint or updates zero rows and returns 200. The database, not an in-memory set, is the idempotency mechanism.

**What I gave up.** Application-level “have I seen this event id?” is easier to write and easier to get wrong under two app instances. The unique column cannot express “same event, different payment row” as a soft warning — the second insert simply fails, which is the correct production behaviour.

## 5. Soft deletes everywhere

**The problem.** Academic records are evidence. Hard-deleting a course, enrollment, or invoice after a dispute, an audit, or a retake destroys the history the transcript and the finance ledger depend on.

**What I chose.** Live rows have `deletedAt: null`. Admin “delete” sets the timestamp. List and get queries always filter it. Unique natural keys (email, course code, invoice number) stay on the row so a resurrected record upserts cleanly.

**What I gave up.** Every query must remember the filter. A missing `deletedAt: null` leaks tombstones into a roster. Unique constraints still apply to soft-deleted rows, so you cannot immediately reuse `CSE-1101` for a different course — you restore or you pick a new code. That friction is the point.

## 6. Retake arithmetic

**The problem.** A student who fails `CSE-2201` and later passes it has two attempts. Showing only the pass erases the failure. Counting both toward CGPA punishes them twice for the same course.

**What I chose.** The transcript lists every attempt (letter, term, status). CGPA uses the best grade point per `courseId` and counts those credits once (`bestAttempts` in `src/utils/gpa.ts`). An `F` remains on the record; it is just not the attempt that enters the cumulative average once a higher point exists.

**What I gave up.** Some policies replace the old row or average both attempts. Replacement hides the fail; averaging is harsher than the UGC-style “best attempt” rule this API implements. Reviewers should confirm this matches the university’s published ordinance before going live.
