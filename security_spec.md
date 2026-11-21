# Security Specification — EduBot Công Dân Số (Firestore)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched are denied for reads and writes.
2. **Owner-Scoped Workspace Isolation**: Every `ClassRoom`, `Lesson`, `AnswerSubmission`, `PushNotification`, and `ActivityLog` document MUST carry `ownerUid == request.auth.uid`, and `ownerUid` is immutable after creation (`incoming().ownerUid == existing().ownerUid`).
3. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
4. **PII Isolation**: `/users/{userId}` contains `email` and is readable/writable ONLY by the owner (`userId == request.auth.uid`) or a verified admin (`isAdmin()`). Self-assigning `role: "admin"` is strictly blocked on non-admin users.
5. **Bounded Payloads & Strict Schemas**: Every document write validates exact required + allowed keys (`hasAll` + `hasOnly`), field types, string `.size()` bounds, ID regex (`^[A-Za-z0-9_\\-]+$`), and server-enforced timestamps (`request.time`).
6. **Secure List Queries**: Every `allow list` rule evaluates `resource.data.ownerUid == request.auth.uid` (or `isAdmin()`) directly on the rule side without client delegation.

## 2. Dirty Dozen Payloads (Must All Be Denied)
1. Unauthenticated read or write to `/classes/LOP-5A` or `/lessons/lesson-1`.
2. Unverified email (`email_verified: false`) attempting to write `/classes/LOP-5A`.
3. Identity spoofing: user A creating `/classes/LOP-9A` with `ownerUid: "user-B"`.
4. Shadow update: teacher updating `/classes/LOP-5A` with an unexpected ghost key `isAdminApproved: true`.
5. Immutable field mutation: user attempting to change `ownerUid` or `createdAt` on `/lessons/lesson-1`.
6. Self-privilege escalation: normal user creating `/users/{uid}` with `role: "admin"`.
7. Client timestamp spoofing: creating a class with `createdAt` not equal to `request.time`.
8. Oversized ID / resource poisoning: path ID longer than 128 chars or containing invalid characters (`../evil`).
9. Oversized payload: `title` > 240 chars or `questions` array > 30 items in `/lessons/{id}`.
10. PII scrape: user A reading `/users/{userB}` (`get` or `list`).
11. Unscoped list query: user A listing `/lessons` without `where('ownerUid', '==', userA.uid)` filter.
12. Client write to `/admins/{uid}` or `/test/connection`.
