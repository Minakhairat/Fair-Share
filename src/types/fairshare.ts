import type { Timestamp } from 'firebase/firestore';

export type Locale = 'en' | 'ar';

export type MemberRole = 'admin' | 'member';

export type EnergyLevel = 'low' | 'medium' | 'high';

export type TaskCategory = 'chores' | 'groceries' | 'bills' | 'maintenance' | 'childcare';

export type TaskRecurrence = 'once' | 'daily' | 'weekly';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type SwapStatus = 'pending' | 'accepted' | 'declined';

export type RewardCategory = 'exemption' | 'leisure' | 'treat' | 'privilege';

export type RedemptionStatus = 'pending' | 'fulfilled';

export type NotificationType =
  | 'task_assigned'
  | 'deadline_near'
  | 'task_completed'
  | 'swap_requested'
  | 'swap_resolved'
  | 'reward_redeemed'
  | 'weekly_rotation';

export type AppTab =
  | 'dashboard'
  | 'tasks'
  | 'engine'
  | 'rewards'
  | 'family'
  | 'report'
  | 'docs';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  activeFamilyId?: string;
  preferredLocale: Locale;
  fcmToken?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserMembership {
  familyId: string;
  familyName: string;
  role: MemberRole;
  joinedAt: Timestamp;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  memberUids: string[];
  weeklyRotationDay: number;
  rotationCount: number;
  lastBalancedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FamilyMember {
  uid: string;
  familyId: string;
  memberUids: string[];
  displayName: string;
  photoURL?: string;
  role: MemberRole;
  availableHoursPerWeek: number;
  energyLevel: EnergyLevel;
  points: number;
  weeklyLoadScore: number;
  heavyTasksCompleted: number;
  tasksCompletedCount: number;
  inviteCodeUsed?: string;
  lastCompletedTaskId?: string | null;
  lastRedemptionId?: string | null;
  notificationsEnabled: boolean;
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FamilyTask {
  id: string;
  familyId: string;
  memberUids: string[];
  title: string;
  description?: string;
  category: TaskCategory;
  difficulty: number;
  estimatedMinutes: number;
  energyRequired: EnergyLevel;
  isHeavy: boolean;
  recurrence: TaskRecurrence;
  pointsValue: number;
  status: TaskStatus;
  assigneeId: string;
  assigneeName: string;
  createdBy: string;
  dueAt: Timestamp;
  completedAt?: Timestamp | null;
  completedBy?: string | null;
  rotationWeek: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TaskSwapRequest {
  id: string;
  familyId: string;
  memberUids: string[];
  taskId: string;
  taskTitle: string;
  requesterId: string;
  requesterName: string;
  targetMemberId: string;
  targetMemberName: string;
  reason: string;
  status: SwapStatus;
  resolvedBy?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RewardPerk {
  id: string;
  familyId: string;
  memberUids: string[];
  title: string;
  description?: string;
  costPoints: number;
  category: RewardCategory;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RewardRedemption {
  id: string;
  familyId: string;
  memberUids: string[];
  rewardId: string;
  rewardTitle: string;
  costPoints: number;
  memberId: string;
  memberName: string;
  status: RedemptionStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FamilyNotification {
  id: string;
  familyId: string;
  memberUids: string[];
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedTaskId?: string | null;
  readBy: string[];
  createdBy: string;
  createdAt: Timestamp;
}
