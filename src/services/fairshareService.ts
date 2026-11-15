import type { User } from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { computeTaskWeight, type BalancedProposal } from '../lib/fairDistribution';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  EnergyLevel,
  Family,
  FamilyMember,
  FamilyNotification,
  FamilyTask,
  Locale,
  MemberRole,
  NotificationType,
  RewardCategory,
  RewardPerk,
  RewardRedemption,
  TaskCategory,
  TaskRecurrence,
  TaskStatus,
  TaskSwapRequest,
} from '../types/fairshare';

function generateSafeId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${randomPart}`;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FS-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function clampStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

export async function ensureUserProfile(user: User, preferredLocale: Locale = 'en'): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: clampStr(user.displayName || user.email?.split('@')[0] || 'Family Member', 80),
        email: clampStr(user.email || 'member@fairshare.app', 160),
        photoURL: clampStr(user.photoURL || '', 500),
        activeFamilyId: '',
        preferredLocale,
        fcmToken: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserPreferences(
  uid: string,
  updates: { activeFamilyId?: string; preferredLocale?: Locale; fcmToken?: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createFamilyWorkspace(
  user: User,
  familyName: string,
  locale: Locale = 'en'
): Promise<string> {
  const cleanName = clampStr(familyName, 80);
  if (!cleanName) {
    throw new Error(locale === 'ar' ? 'اسم العائلة مطلوب.' : 'Family name is required.');
  }

  await ensureUserProfile(user, locale);

  const familyId = generateSafeId('fam');
  const inviteCode = generateInviteCode();
  const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Parent', 80);

  // Batch 1: Atomic family + owner admin member + invite code + membership index
  const batch = writeBatch(db);
  batch.set(doc(db, 'families', familyId), {
    id: familyId,
    name: cleanName,
    inviteCode,
    ownerId: user.uid,
    memberUids: [user.uid],
    weeklyRotationDay: 0,
    rotationCount: 1,
    lastBalancedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', familyId, 'members', user.uid), {
    uid: user.uid,
    familyId,
    memberUids: [user.uid],
    displayName,
    photoURL: clampStr(user.photoURL || '', 500),
    role: 'admin',
    availableHoursPerWeek: 14,
    energyLevel: 'high',
    points: 0,
    weeklyLoadScore: 0,
    heavyTasksCompleted: 0,
    tasksCompletedCount: 0,
    inviteCodeUsed: inviteCode,
    notificationsEnabled: true,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'inviteCodes', inviteCode), {
    code: inviteCode,
    familyId,
    familyName: cleanName,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', user.uid, 'memberships', familyId), {
    familyId,
    familyName: cleanName,
    role: 'admin',
    joinedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', user.uid), {
    activeFamilyId: familyId,
    preferredLocale: locale,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${familyId}`);
  }

  // Batch 2: Starter household responsibilities and positive perks (admin already exists)
  const seedBatch = writeBatch(db);
  const now = Date.now();
  const starterTasks: Array<{
    title: string;
    description: string;
    category: TaskCategory;
    difficulty: number;
    estimatedMinutes: number;
    energyRequired: EnergyLevel;
    isHeavy: boolean;
    recurrence: TaskRecurrence;
    pointsValue: number;
    hoursAhead: number;
  }> =
    locale === 'ar'
      ? [
          {
            title: 'تسوق البقالة الأسبوعي وترتيب المؤن',
            description: 'توفير الخضروات والمنتجات الأساسية واحتياجات المنزل للأسبوع.',
            category: 'groceries',
            difficulty: 3,
            estimatedMinutes: 50,
            energyRequired: 'medium',
            isHeavy: true,
            recurrence: 'weekly',
            pointsValue: 60,
            hoursAhead: 18,
          },
          {
            title: 'غسل الأطباق المسائي وترتيب المطبخ',
            description: 'تنظيف الحوض ومسح الأسطح وترتيب المطبخ بعد العشاء.',
            category: 'chores',
            difficulty: 2,
            estimatedMinutes: 25,
            energyRequired: 'low',
            isHeavy: false,
            recurrence: 'daily',
            pointsValue: 30,
            hoursAhead: 6,
          },
          {
            title: 'مراجعة فواتير الكهرباء والإنترنت الشهرية',
            description: 'التحقق من مواعيد الاستحقاق وتأكيد سداد الفواتير المشتركة.',
            category: 'bills',
            difficulty: 2,
            estimatedMinutes: 20,
            energyRequired: 'low',
            isHeavy: false,
            recurrence: 'weekly',
            pointsValue: 35,
            hoursAhead: 36,
          },
        ]
      : [
          {
            title: 'Weekly grocery run & pantry check',
            description: 'Restock produce, dairy, and household essentials for the week.',
            category: 'groceries',
            difficulty: 3,
            estimatedMinutes: 50,
            energyRequired: 'medium',
            isHeavy: true,
            recurrence: 'weekly',
            pointsValue: 60,
            hoursAhead: 18,
          },
          {
            title: 'Evening dishwashing & kitchen reset',
            description: 'Clear sink, wipe counters, and load dishwasher after dinner.',
            category: 'chores',
            difficulty: 2,
            estimatedMinutes: 25,
            energyRequired: 'low',
            isHeavy: false,
            recurrence: 'daily',
            pointsValue: 30,
            hoursAhead: 6,
          },
          {
            title: 'Monthly utilities & internet bills check',
            description: 'Review upcoming due dates and confirm shared household payments.',
            category: 'bills',
            difficulty: 2,
            estimatedMinutes: 20,
            energyRequired: 'low',
            isHeavy: false,
            recurrence: 'weekly',
            pointsValue: 35,
            hoursAhead: 36,
          },
        ];

  for (const item of starterTasks) {
    const taskId = generateSafeId('tsk');
    seedBatch.set(doc(db, 'families', familyId, 'tasks', taskId), {
      id: taskId,
      familyId,
      memberUids: [user.uid],
      title: item.title,
      description: item.description,
      category: item.category,
      difficulty: item.difficulty,
      estimatedMinutes: item.estimatedMinutes,
      energyRequired: item.energyRequired,
      isHeavy: item.isHeavy,
      recurrence: item.recurrence,
      pointsValue: item.pointsValue,
      status: 'pending',
      assigneeId: user.uid,
      assigneeName: displayName,
      createdBy: user.uid,
      dueAt: Timestamp.fromDate(new Date(now + item.hoursAhead * 3600 * 1000)),
      completedAt: null,
      completedBy: null,
      rotationWeek: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const starterRewards: Array<{
    title: string;
    description: string;
    costPoints: number;
    category: RewardCategory;
  }> =
    locale === 'ar'
      ? [
          {
            title: 'بطاقة إعفاء من غسل الأطباق',
            description: 'إعفاء لمرة واحدة من مهمة غسل الأطباق المسائية بروح تعاونية.',
            costPoints: 80,
            category: 'exemption',
          },
          {
            title: 'اختيار فيلم نهاية الأسبوع للعائلة',
            description: 'حق اختيار فيلم سهرة الجمعة العائلية.',
            costPoints: 120,
            category: 'leisure',
          },
          {
            title: 'مكافأة قهوة أو حلوى مفضلة',
            description: 'مشروب أو حلوى مفضلة خلال نزهة نهاية الأسبوع.',
            costPoints: 150,
            category: 'treat',
          },
        ]
      : [
          {
            title: 'Dishwashing Exemption Pass',
            description: 'Skip evening dishwashing duty once — covered happily by the team.',
            costPoints: 80,
            category: 'exemption',
          },
          {
            title: 'Weekend Family Movie Pick',
            description: 'Full veto & selection power for Friday family movie night.',
            costPoints: 120,
            category: 'leisure',
          },
          {
            title: 'Artisan Coffee / Dessert Treat',
            description: 'Enjoy a favorite cafe drink or dessert picked up on the weekend.',
            costPoints: 150,
            category: 'treat',
          },
        ];

  for (const r of starterRewards) {
    const rewardId = generateSafeId('rew');
    seedBatch.set(doc(db, 'families', familyId, 'rewards', rewardId), {
      id: rewardId,
      familyId,
      memberUids: [user.uid],
      title: r.title,
      description: r.description,
      costPoints: r.costPoints,
      category: r.category,
      isActive: true,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await seedBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${familyId}/tasks`);
  }

  return familyId;
}

export async function joinFamilyByInviteCode(
  user: User,
  rawCode: string,
  locale: Locale = 'en'
): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(code) || code.length < 4) {
    throw new Error(
      locale === 'ar'
        ? 'يرجى إدخال رمز دعوة صحيح (مثال: FS-8K4M2P).'
        : 'Please enter a valid invite code (e.g. FS-8K4M2P).'
    );
  }

  await ensureUserProfile(user, locale);

  let inviteSnap;
  try {
    inviteSnap = await getDoc(doc(db, 'inviteCodes', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `inviteCodes/${code}`);
  }

  if (!inviteSnap.exists()) {
    throw new Error(
      locale === 'ar'
        ? 'رمز الدعوة غير موجود. تأكد من الرمز مع مدير العائلة.'
        : 'Invite code not found. Double-check with your family admin.'
    );
  }

  const invite = inviteSnap.data() as { familyId: string; familyName: string; ownerId: string };
  const familyId = invite.familyId;
  const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Family Member', 80);

  const existingMemberSnap = await getDoc(doc(db, 'families', familyId, 'members', user.uid));
  if (existingMemberSnap.exists()) {
    await updateDoc(doc(db, 'users', user.uid), {
      activeFamilyId: familyId,
      updatedAt: serverTimestamp(),
    });
    return familyId;
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'families', familyId, 'members', user.uid), {
    uid: user.uid,
    familyId,
    memberUids: [invite.ownerId, user.uid],
    displayName,
    photoURL: clampStr(user.photoURL || '', 500),
    role: 'member',
    availableHoursPerWeek: 10,
    energyLevel: 'medium',
    points: 0,
    weeklyLoadScore: 0,
    heavyTasksCompleted: 0,
    tasksCompletedCount: 0,
    inviteCodeUsed: code,
    notificationsEnabled: true,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'families', familyId), {
    memberUids: arrayUnion(user.uid),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', user.uid, 'memberships', familyId), {
    familyId,
    familyName: invite.familyName,
    role: 'member',
    joinedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', user.uid), {
    activeFamilyId: familyId,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${familyId}/members/${user.uid}`);
  }

  return familyId;
}

export async function syncMemberUidsAcrossWorkspace(
  family: Family,
  collections: {
    members: FamilyMember[];
    tasks: FamilyTask[];
    swaps: TaskSwapRequest[];
    rewards: RewardPerk[];
    redemptions: RewardRedemption[];
    notifications: FamilyNotification[];
  }
): Promise<void> {
  const target = family.memberUids;
  const sameSet = (arr: string[]) =>
    arr.length === target.length && target.every((uid) => arr.includes(uid));

  const batch = writeBatch(db);
  let pendingWrites = 0;

  for (const m of collections.members) {
    if (!sameSet(m.memberUids)) {
      batch.update(doc(db, 'families', family.id, 'members', m.uid), {
        memberUids: target,
        updatedAt: serverTimestamp(),
      });
      pendingWrites++;
    }
  }
  for (const t of collections.tasks) {
    if (!sameSet(t.memberUids)) {
      batch.update(doc(db, 'families', family.id, 'tasks', t.id), {
        memberUids: target,
        updatedAt: serverTimestamp(),
      });
      pendingWrites++;
    }
  }
  for (const s of collections.swaps) {
    if (!sameSet(s.memberUids)) {
      batch.update(doc(db, 'families', family.id, 'swaps', s.id), {
        memberUids: target,
        updatedAt: serverTimestamp(),
      });
      pendingWrites++;
    }
  }
  for (const r of collections.rewards) {
    if (!sameSet(r.memberUids)) {
      batch.update(doc(db, 'families', family.id, 'rewards', r.id), {
        memberUids: target,
        updatedAt: serverTimestamp(),
      });
      pendingWrites++;
    }
  }
  for (const red of collections.redemptions) {
    if (!sameSet(red.memberUids)) {
      batch.update(doc(db, 'families', family.id, 'redemptions', red.id), {
        memberUids: target,
        updatedAt: serverTimestamp(),
      });
      pendingWrites++;
    }
  }
  for (const n of collections.notifications) {
    if (!sameSet(n.memberUids)) {
      batch.update(doc(db, 'families', family.id, 'notifications', n.id), {
        memberUids: target,
      });
      pendingWrites++;
    }
  }

  if (pendingWrites === 0) return;

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `families/${family.id}`);
  }
}

export async function dispatchFamilyNotification(params: {
  familyId: string;
  memberUids: string[];
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedTaskId?: string | null;
  createdBy: string;
}): Promise<void> {
  const notifId = generateSafeId('ntf');
  try {
    await setDoc(doc(db, 'families', params.familyId, 'notifications', notifId), {
      id: notifId,
      familyId: params.familyId,
      memberUids: params.memberUids,
      recipientId: params.recipientId,
      type: params.type,
      title: clampStr(params.title, 120),
      body: clampStr(params.body, 300),
      relatedTaskId: params.relatedTaskId || null,
      readBy: [params.createdBy],
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `families/${params.familyId}/notifications/${notifId}`);
  }
}

export async function createFamilyTask(params: {
  family: Family;
  createdBy: string;
  title: string;
  description?: string;
  category: TaskCategory;
  difficulty: number;
  estimatedMinutes: number;
  energyRequired: EnergyLevel;
  isHeavy: boolean;
  recurrence: TaskRecurrence;
  pointsValue: number;
  assignee: FamilyMember;
  dueDate: Date;
  locale?: Locale;
}): Promise<void> {
  const isAr = params.locale === 'ar';
  const taskId = generateSafeId('tsk');
  const notifId = generateSafeId('ntf');
  const batch = writeBatch(db);

  batch.set(doc(db, 'families', params.family.id, 'tasks', taskId), {
    id: taskId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    title: clampStr(params.title, 120),
    description: clampStr(params.description, 500),
    category: params.category,
    difficulty: Math.min(5, Math.max(1, Math.round(params.difficulty))),
    estimatedMinutes: Math.min(480, Math.max(5, Math.round(params.estimatedMinutes))),
    energyRequired: params.energyRequired,
    isHeavy: params.isHeavy,
    recurrence: params.recurrence,
    pointsValue: Math.min(500, Math.max(5, Math.round(params.pointsValue))),
    status: 'pending',
    assigneeId: params.assignee.uid,
    assigneeName: clampStr(params.assignee.displayName, 80),
    createdBy: params.createdBy,
    dueAt: Timestamp.fromDate(params.dueDate),
    completedAt: null,
    completedBy: null,
    rotationWeek: params.family.rotationCount || 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.family.id, 'notifications', notifId), {
    id: notifId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    recipientId: params.assignee.uid,
    type: 'task_assigned',
    title: isAr ? 'تم إسناد مسؤولية جديدة' : 'New responsibility assigned',
    body: isAr
      ? `تم إسناد "${clampStr(params.title, 80)}" إلى ${params.assignee.displayName} (+${params.pointsValue} نقطة).`
      : `${clampStr(params.title, 90)} was assigned to ${params.assignee.displayName} (+${params.pointsValue} pts).`,
    relatedTaskId: taskId,
    readBy: [params.createdBy],
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `families/${params.family.id}/tasks/${taskId}`);
  }
}

export async function updateTaskStatus(
  familyId: string,
  taskId: string,
  status: TaskStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'families', familyId, 'tasks', taskId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `families/${familyId}/tasks/${taskId}`);
  }
}

export async function claimOrHelpTask(
  familyId: string,
  taskId: string,
  member: FamilyMember
): Promise<void> {
  try {
    await updateDoc(doc(db, 'families', familyId, 'tasks', taskId), {
      assigneeId: member.uid,
      assigneeName: clampStr(member.displayName, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `families/${familyId}/tasks/${taskId}`);
  }
}

export async function completeTaskAtomically(
  family: Family,
  task: FamilyTask,
  actorMember: FamilyMember,
  authUid: string,
  locale: Locale = 'en'
): Promise<void> {
  const isAr = locale === 'ar';
  const batch = writeBatch(db);
  const taskRef = doc(db, 'families', family.id, 'tasks', task.id);

  batch.update(taskRef, {
    status: 'completed',
    completedAt: serverTimestamp(),
    completedBy: authUid,
    updatedAt: serverTimestamp(),
  });

  // Award points to the completing member (or if admin completing on behalf of managed profile)
  const targetMemberRef = doc(db, 'families', family.id, 'members', actorMember.uid);
  const weight = computeTaskWeight(task);
  batch.update(targetMemberRef, {
    points: actorMember.points + task.pointsValue,
    tasksCompletedCount: actorMember.tasksCompletedCount + 1,
    heavyTasksCompleted: actorMember.heavyTasksCompleted + (task.isHeavy ? 1 : 0),
    weeklyLoadScore: Number((actorMember.weeklyLoadScore + weight).toFixed(2)),
    lastCompletedTaskId: task.id,
    updatedAt: serverTimestamp(),
  });

  const notifId = generateSafeId('ntf');
  batch.set(doc(db, 'families', family.id, 'notifications', notifId), {
    id: notifId,
    familyId: family.id,
    memberUids: family.memberUids,
    recipientId: 'all',
    type: 'task_completed',
    title: isAr ? 'تم إنجاز مسؤولية' : 'Responsibility completed',
    body: isAr
      ? `أتمّ ${actorMember.displayName} مهمة "${clampStr(task.title, 70)}" (+${task.pointsValue} نقطة).`
      : `${actorMember.displayName} completed "${clampStr(task.title, 80)}" (+${task.pointsValue} pts).`,
    relatedTaskId: task.id,
    readBy: [authUid],
    createdBy: authUid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${family.id}/tasks/${task.id}`);
  }
}

export async function deleteFamilyTask(familyId: string, taskId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'families', familyId, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `families/${familyId}/tasks/${taskId}`);
  }
}

export async function applyBalancedDistribution(params: {
  family: Family;
  proposals: BalancedProposal[];
  actorUid: string;
  isWeeklyRotation: boolean;
  locale?: Locale;
}): Promise<void> {
  const isAr = params.locale === 'ar';
  const changedProposals = params.proposals.filter((p) => p.changed);
  const batch = writeBatch(db);
  const nextRotation = (params.family.rotationCount || 1) + (params.isWeeklyRotation ? 1 : 0);

  batch.update(doc(db, 'families', params.family.id), {
    rotationCount: nextRotation,
    lastBalancedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const p of changedProposals) {
    batch.update(doc(db, 'families', params.family.id, 'tasks', p.taskId), {
      assigneeId: p.proposedAssigneeId,
      assigneeName: clampStr(p.proposedAssigneeName, 80),
      rotationWeek: nextRotation,
      updatedAt: serverTimestamp(),
    });
  }

  const notifId = generateSafeId('ntf');
  batch.set(doc(db, 'families', params.family.id, 'notifications', notifId), {
    id: notifId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    recipientId: 'all',
    type: params.isWeeklyRotation ? 'weekly_rotation' : 'task_assigned',
    title: isAr
      ? params.isWeeklyRotation
        ? 'تم تطبيق التدوير الأسبوعي للمهام الثقيلة'
        : 'تم تحديث التوزيع العادل'
      : params.isWeeklyRotation
        ? 'Weekly heavy-task rotation applied'
        : 'Fair balance updated',
    body: isAr
      ? changedProposals.length > 0
        ? `تم إعادة توزيع ${changedProposals.length} مهام بعدالة على أفراد العائلة.`
        : 'جميع المسؤوليات موزعة بأفضل توازن حالياً.'
      : changedProposals.length > 0
        ? `${changedProposals.length} tasks were rebalanced fairly across family members.`
        : 'All responsibilities are already optimally balanced for current capacity.',
    relatedTaskId: null,
    readBy: [params.actorUid],
    createdBy: params.actorUid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${params.family.id}`);
  }
}

export async function requestTaskSwap(params: {
  family: Family;
  task: FamilyTask;
  requester: FamilyMember;
  target: FamilyMember;
  reason: string;
  locale?: Locale;
}): Promise<void> {
  const isAr = params.locale === 'ar';
  const swapId = generateSafeId('swp');
  const notifId = generateSafeId('ntf');
  const batch = writeBatch(db);

  batch.set(doc(db, 'families', params.family.id, 'swaps', swapId), {
    id: swapId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    taskId: params.task.id,
    taskTitle: clampStr(params.task.title, 120),
    requesterId: params.requester.uid,
    requesterName: clampStr(params.requester.displayName, 80),
    targetMemberId: params.target.uid,
    targetMemberName: clampStr(params.target.displayName, 80),
    reason:
      clampStr(params.reason, 280) ||
      (isAr ? 'تعارض في الوقت — يسعدني تعويضها لاحقاً.' : 'Schedule conflict — happy to trade later.'),
    status: 'pending',
    resolvedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.family.id, 'notifications', notifId), {
    id: notifId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    recipientId: params.target.uid,
    type: 'swap_requested',
    title: isAr ? 'طلب تبديل مهمة' : 'Task swap request',
    body: isAr
      ? `طلب ${params.requester.displayName} تبديل مهمة "${clampStr(params.task.title, 70)}" معك.`
      : `${params.requester.displayName} asked to swap "${clampStr(params.task.title, 80)}" with you.`,
    relatedTaskId: params.task.id,
    readBy: [params.requester.uid],
    createdBy: params.requester.uid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `families/${params.family.id}/swaps/${swapId}`);
  }
}

export async function resolveTaskSwap(params: {
  family: Family;
  swap: TaskSwapRequest;
  decision: 'accepted' | 'declined';
  actorUid: string;
  locale?: Locale;
}): Promise<void> {
  const isAr = params.locale === 'ar';
  const batch = writeBatch(db);

  batch.update(doc(db, 'families', params.family.id, 'swaps', params.swap.id), {
    status: params.decision,
    resolvedBy: params.actorUid,
    updatedAt: serverTimestamp(),
  });

  if (params.decision === 'accepted') {
    batch.update(doc(db, 'families', params.family.id, 'tasks', params.swap.taskId), {
      assigneeId: params.swap.targetMemberId,
      assigneeName: clampStr(params.swap.targetMemberName, 80),
      updatedAt: serverTimestamp(),
    });
  }

  const notifId = generateSafeId('ntf');
  batch.set(doc(db, 'families', params.family.id, 'notifications', notifId), {
    id: notifId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    recipientId: params.swap.requesterId,
    type: 'swap_resolved',
    title: isAr
      ? params.decision === 'accepted'
        ? 'تم قبول التبديل'
        : 'تم رفض التبديل'
      : params.decision === 'accepted'
        ? 'Swap accepted'
        : 'Swap declined',
    body: isAr
      ? `${params.decision === 'accepted' ? 'قبل' : 'اعتذر'} ${params.swap.targetMemberName} عن طلب تبديل "${clampStr(params.swap.taskTitle, 70)}".`
      : `${params.swap.targetMemberName} ${params.decision} the swap for "${clampStr(params.swap.taskTitle, 80)}".`,
    relatedTaskId: params.swap.taskId,
    readBy: [params.actorUid],
    createdBy: params.actorUid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${params.family.id}/swaps/${params.swap.id}`);
  }
}

export async function addManagedFamilyMember(params: {
  family: Family;
  displayName: string;
  role: MemberRole;
  availableHoursPerWeek: number;
  energyLevel: EnergyLevel;
}): Promise<void> {
  const memberId = generateSafeId('mem');
  try {
    await setDoc(doc(db, 'families', params.family.id, 'members', memberId), {
      uid: memberId,
      familyId: params.family.id,
      memberUids: params.family.memberUids,
      displayName: clampStr(params.displayName, 80),
      photoURL: '',
      role: params.role,
      availableHoursPerWeek: Math.min(168, Math.max(1, params.availableHoursPerWeek)),
      energyLevel: params.energyLevel,
      points: 0,
      weeklyLoadScore: 0,
      heavyTasksCompleted: 0,
      tasksCompletedCount: 0,
      inviteCodeUsed: 'ADMIN_CREATED',
      notificationsEnabled: true,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `families/${params.family.id}/members/${memberId}`);
  }
}

export async function updateFamilyMember(
  familyId: string,
  memberId: string,
  updates: Partial<Pick<FamilyMember, 'displayName' | 'role' | 'availableHoursPerWeek' | 'energyLevel' | 'notificationsEnabled'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'families', familyId, 'members', memberId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `families/${familyId}/members/${memberId}`);
  }
}

export async function removeFamilyMember(familyId: string, memberId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'families', familyId, 'members', memberId));
  batch.update(doc(db, 'families', familyId), {
    memberUids: arrayRemove(memberId),
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `families/${familyId}/members/${memberId}`);
  }
}

export async function createRewardPerk(params: {
  family: Family;
  createdBy: string;
  title: string;
  description?: string;
  costPoints: number;
  category: RewardCategory;
}): Promise<void> {
  const rewardId = generateSafeId('rew');
  try {
    await setDoc(doc(db, 'families', params.family.id, 'rewards', rewardId), {
      id: rewardId,
      familyId: params.family.id,
      memberUids: params.family.memberUids,
      title: clampStr(params.title, 100),
      description: clampStr(params.description, 300),
      costPoints: Math.min(5000, Math.max(10, Math.round(params.costPoints))),
      category: params.category,
      isActive: true,
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `families/${params.family.id}/rewards/${rewardId}`);
  }
}

export async function toggleRewardActive(familyId: string, rewardId: string, isActive: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'families', familyId, 'rewards', rewardId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `families/${familyId}/rewards/${rewardId}`);
  }
}

export async function deleteRewardPerk(familyId: string, rewardId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'families', familyId, 'rewards', rewardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `families/${familyId}/rewards/${rewardId}`);
  }
}

export async function redeemRewardAtomically(params: {
  family: Family;
  reward: RewardPerk;
  member: FamilyMember;
  locale?: Locale;
}): Promise<void> {
  const isAr = params.locale === 'ar';
  if (params.member.points < params.reward.costPoints) {
    throw new Error(
      isAr ? 'لا تملك نقاطاً كافية لاستبدال هذه المكافأة حالياً.' : 'Not enough points to redeem this perk yet.'
    );
  }
  const redemptionId = generateSafeId('red');
  const notifId = generateSafeId('ntf');
  const batch = writeBatch(db);

  batch.set(doc(db, 'families', params.family.id, 'redemptions', redemptionId), {
    id: redemptionId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    rewardId: params.reward.id,
    rewardTitle: clampStr(params.reward.title, 100),
    costPoints: params.reward.costPoints,
    memberId: params.member.uid,
    memberName: clampStr(params.member.displayName, 80),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'families', params.family.id, 'members', params.member.uid), {
    points: params.member.points - params.reward.costPoints,
    lastRedemptionId: redemptionId,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.family.id, 'notifications', notifId), {
    id: notifId,
    familyId: params.family.id,
    memberUids: params.family.memberUids,
    recipientId: 'all',
    type: 'reward_redeemed',
    title: isAr ? 'تم استبدال مكافأة' : 'Perk redeemed',
    body: isAr
      ? `استبدل ${params.member.displayName} "${clampStr(params.reward.title, 70)}" مقابل ${params.reward.costPoints} نقطة.`
      : `${params.member.displayName} redeemed "${clampStr(params.reward.title, 80)}" for ${params.reward.costPoints} pts.`,
    relatedTaskId: null,
    readBy: [params.member.uid],
    createdBy: params.member.uid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${params.family.id}/redemptions/${redemptionId}`);
  }
}

export async function fulfillRedemption(familyId: string, redemptionId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'families', familyId, 'redemptions', redemptionId), {
      status: 'fulfilled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `families/${familyId}/redemptions/${redemptionId}`);
  }
}

export async function markNotificationRead(familyId: string, notificationId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'families', familyId, 'notifications', notificationId), {
      readBy: arrayUnion(uid),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `families/${familyId}/notifications/${notificationId}`);
  }
}
