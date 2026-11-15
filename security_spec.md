# FairShare Firestore Security Specification

## 1. Core Data Invariants
1. **Complete Family Isolation**: Every family subcollection (`/members`, `/tasks`, `/swaps`, `/rewards`, `/redemptions`, `/notifications`) is gated by active membership in `/families/{familyId}/members/{uid}`. Users in Family A can never read, list, create, update, or delete records in Family B.
2. **PII Isolation**: User emails and FCM tokens live exclusively in `/users/{userId}` and are strictly readable/writable only by `request.auth.uid == userId`. Family member cards use `/families/{familyId}/members/{memberId}` which excludes all PII.
3. **Zero Privilege Escalation**: A user joining a family via an invite code must supply the matching `inviteCodeUsed` verified against `/families/{familyId}`, must start with `role: 'member'`, and must start with `points: 0`. Only an existing family `admin` can promote/demote roles or modify reward costs.
4. **Atomic Economy & Terminal State Locking**:
   - Completed tasks lock against non-admin edits once `status == 'completed'`.
   - Resolved swaps lock once `status != 'pending'`.
   - Reward redemptions enforce atomic point deduction via `getAfter()` so a user cannot mint free rewards without deducting `costPoints`.
5. **Strict Timestamp & Key Allowlisting**: Every `create` verifies `createdAt == request.time` and exact key sets (`hasAll` + `hasOnly`). Every `update` verifies `updatedAt == request.time`, `isValid[Entity](incoming())`, and `affectedKeys().hasOnly(...)`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Cross-Family Task Read**: Authenticated user in Family A attempts `get` on `/families/familyB/tasks/task1`.
2. **Invite Code Enumeration**: Authenticated user attempts `list` on `/inviteCodes` to scrape family invite codes.
3. **Self-Promotion to Admin**: Member with `role: 'member'` attempts `update` on `/families/fam1/members/uid` with `{ role: 'admin' }`.
4. **Join Without Valid Invite Code**: Attacker attempts `create` on `/families/fam1/members/attackerUid` with `inviteCodeUsed: 'WRONG'`.
5. **Shadow / Ghost Field Injection**: Admin attempts `create` on `/families/fam1/tasks/t1` with extra field `{ isSystemVerified: true }`.
6. **PII Leak Attempt**: Family member attempts `get` on `/users/otherUid` to read another member's email or FCM token.
7. **Unverified Email Write**: Token with `email_verified: false` attempts any `create`/`update`/`delete`.
8. **ID Poisoning (1.5KB ID)**: Attacker attempts `create` with a 1,500-character document ID or invalid regex characters (`../admin`).
9. **Free Reward Redemption (Sync Bypass)**: Member attempts `create` on `/families/fam1/redemptions/r1` without an atomic batch deducting `costPoints` from their member document.
10. **Terminal State Rollback**: Non-admin member attempts `update` on a `'completed'` task to set `status: 'pending'` and re-earn points.
11. **Spoofed Timestamp**: Client submits `createdAt` set to a past or future client timestamp instead of `serverTimestamp()`.
12. **Unscoped List Query**: Client queries `/families/fam1/tasks` without `where('memberUids', 'array-contains', auth.uid)`.
