# FairShare (منظم المسؤوليات العائلية والمشتركة)

FairShare is a cross-platform family and team responsibility planner built with **React 19, TypeScript, Tailwind CSS v4, Vite PWA, Firebase Authentication, Cloud Firestore (Real-Time `onSnapshot`), and Firebase Cloud Messaging (FCM)**.

## 1. Architecture Overview & Firebase Setup
- **Isolated Family Workspaces**: Each household/team operates inside `/families/{familyId}` with strictly isolated subcollections (`members`, `tasks`, `swaps`, `rewards`, `redemptions`, `notifications`).
- **PII Isolation**: User emails and FCM tokens reside in `/users/{userId}` and are readable/writable strictly by the owning user.
- **Role-Based Access Control (RBAC)**:
  - **Admin / Parent (`role: 'admin'`)**: Create/delete tasks, manage member roles & capacities, run the fair distribution & weekly heavy-task rotation engine, create rewards, and fulfill redemptions.
  - **Member / Child (`role: 'member'`)**: View tasks, start/complete responsibilities, claim/help with open tasks, request peer task swaps, and redeem points for perks.
- **Firestore Rules & Blueprint**: Schema defined in `firebase-blueprint.json` and enforced by `firestore.rules` (validated with `@firebase/eslint-plugin-security-rules`).
- **FCM Push Setup**: Optional `VITE_FIREBASE_VAPID_KEY` can be configured in `.env` for Web Push token registration via `public/firebase-messaging-sw.js`, alongside live foreground Firestore notifications and Web Notification / haptic feedback.

## 2. Smart Balanced Distribution Algorithm
Implemented in `src/lib/fairDistribution.ts`:
- `EffectiveCapacity = availableHoursPerWeek * energyMultiplier(low: 0.72, medium: 1.0, high: 1.28)`
- `TaskEffortWeight = max(0.25, estimatedMinutes / 30) * (0.7 + difficulty * 0.35) * (isHeavy ? 1.45 : 1.0) * 10`
- Allocates heaviest tasks first to the member with the lowest projected load-to-capacity ratio while penalizing energy mismatches and rotating `isHeavy` responsibilities weekly.

## 3. Cross-Platform Responsive Rules
- **Desktop (`>= 1024px`)**: Persistent `260px` sidebar, multi-column KPI and split dashboard, keyboard shortcuts (`1`–`7` views, `N` new task).
- **Tablets / iPads (`768px–1023px`)**: Adaptive slide-over drawer and 2-column fluid grids.
- **Mobile (`< 768px`)**: Fixed thumb-zone bottom tab bar with `env(safe-area-inset-bottom)`, `>= 44px` touch targets, bottom-sheet modals, haptic `navigator.vibrate()`, and installable PWA manifest.

## 4. Setup & Run Commands
```bash
npm install
npm run lint     # TypeScript verification
npx eslint firestore.rules
npm run dev      # Starts dev server on port 3000
npm run build    # Production build
```
