import { getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateFairDistribution, type FairnessReport } from '../lib/fairDistribution';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  subscribeForegroundFCM,
  triggerGentleDeviceAlert,
} from '../lib/firebase';
import {
  ensureUserProfile,
  syncMemberUidsAcrossWorkspace,
  updateUserPreferences,
} from '../services/fairshareService';
import type {
  Family,
  FamilyMember,
  FamilyNotification,
  FamilyTask,
  Locale,
  RewardPerk,
  RewardRedemption,
  TaskSwapRequest,
  UserMembership,
  UserProfile,
} from '../types/fairshare';

export interface FairShareState {
  authReady: boolean;
  user: User | null;
  authSyncError: string | null;
  profile: UserProfile | null;
  memberships: UserMembership[];
  activeFamily: Family | null;
  members: FamilyMember[];
  currentMember: FamilyMember | null;
  tasks: FamilyTask[];
  swaps: TaskSwapRequest[];
  rewards: RewardPerk[];
  redemptions: RewardRedemption[];
  notifications: FamilyNotification[];
  fairnessReport: FairnessReport;
  unreadNotificationsCount: number;
  loadingWorkspace: boolean;
  toastMessage: { title: string; body: string } | null;
  clearToast: () => void;
}

export function useFairShareData(locale: Locale): FairShareState {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authSyncError, setAuthSyncError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [myFamilies, setMyFamilies] = useState<Family[]>([]);
  const [familiesLoaded, setFamiliesLoaded] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [tasks, setTasks] = useState<FamilyTask[]>([]);
  const [swaps, setSwaps] = useState<TaskSwapRequest[]>([]);
  const [rewards, setRewards] = useState<RewardPerk[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string } | null>(null);

  const localeRef = useRef<Locale>(locale);
  localeRef.current = locale;

  const seenNotificationIds = useRef<Set<string>>(new Set());
  const initialNotifLoad = useRef(true);

  useEffect(() => {
    void getRedirectResult(auth).catch((err) => {
      console.warn('Redirect sign-in check:', err);
      setAuthSyncError(err instanceof Error ? err.message : 'Google redirect sign-in failed.');
    });

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthSyncError(null);
      if (nextUser) {
        setFamiliesLoaded(false);
        setMembersLoaded(false);
        try {
          await ensureUserProfile(nextUser, localeRef.current);
        } catch (err) {
          console.error('ensureUserProfile error:', err);
          setAuthSyncError(err instanceof Error ? err.message : 'Unable to sync user profile.');
        }
      } else {
        setProfile(null);
        setMemberships([]);
        setMyFamilies([]);
        setFamiliesLoaded(false);
        setMembersLoaded(false);
        setMembers([]);
        setTasks([]);
        setSwaps([]);
        setRewards([]);
        setRedemptions([]);
        setNotifications([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let unsubFCM: (() => void) | undefined;
    void subscribeForegroundFCM((payload) => {
      const title = payload.notification?.title || 'FairShare';
      const body = payload.notification?.body || '';
      setToastMessage({ title, body });
      triggerGentleDeviceAlert(title, body);
    }).then((unsub) => {
      unsubFCM = unsub;
    });
    return () => {
      if (unsubFCM) unsubFCM();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    const userPath = `users/${user.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, userPath)
    );

    const membershipsPath = `users/${user.uid}/memberships`;
    const unsubMemberships = onSnapshot(
      collection(db, 'users', user.uid, 'memberships'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserMembership);
        setMemberships(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, membershipsPath)
    );

    // Query only families where this user is listed in memberUids.
    // Avoids get() permission errors if an activeFamilyId becomes stale or deleted.
    const familiesQuery = query(
      collection(db, 'families'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsubFamilies = onSnapshot(
      familiesQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Family);
        setMyFamilies(list);
        setFamiliesLoaded(true);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'families')
    );

    return () => {
      unsubProfile();
      unsubMemberships();
      unsubFamilies();
    };
  }, [authReady, user]);

  const activeFamily = useMemo(() => {
    if (myFamilies.length === 0) return null;
    if (profile?.activeFamilyId) {
      const matched = myFamilies.find((f) => f.id === profile.activeFamilyId);
      if (matched) return matched;
    }
    return myFamilies[0] ?? null;
  }, [myFamilies, profile?.activeFamilyId]);

  const activeFamilyId = activeFamily?.id || '';

  // Heal stale activeFamilyId or orphaned membership entries once server families finish loading
  useEffect(() => {
    if (!authReady || !user || !familiesLoaded || !profile) return;
    const validIds = new Set(myFamilies.map((f) => f.id));

    if (profile.activeFamilyId && !validIds.has(profile.activeFamilyId)) {
      const fallbackId = myFamilies[0]?.id || '';
      void updateUserPreferences(user.uid, { activeFamilyId: fallbackId }).catch(() => {
        // Ignore transient write errors while healing stale activeFamilyId
      });
    }

    for (const m of memberships) {
      if (!validIds.has(m.familyId)) {
        void deleteDoc(doc(db, 'users', user.uid, 'memberships', m.familyId)).catch(() => {
          // Ignore cleanup errors for stale membership pointers
        });
      }
    }
  }, [authReady, user, familiesLoaded, profile, myFamilies, memberships]);

  useEffect(() => {
    if (!authReady || !user || !activeFamilyId) {
      setMembers([]);
      setTasks([]);
      setSwaps([]);
      setRewards([]);
      setRedemptions([]);
      setNotifications([]);
      setMembersLoaded(false);
      return;
    }

    setMembersLoaded(false);
    initialNotifLoad.current = true;
    seenNotificationIds.current.clear();

    const famPath = `families/${activeFamilyId}`;
    const scopedQuery = (sub: string) =>
      query(
        collection(db, 'families', activeFamilyId, sub),
        where('memberUids', 'array-contains', user.uid)
      );

    const unsubMembers = onSnapshot(
      scopedQuery('members'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as FamilyMember);
        list.sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1));
        setMembers(list);
        setMembersLoaded(true);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${famPath}/members`)
    );

    const unsubTasks = onSnapshot(
      scopedQuery('tasks'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as FamilyTask);
        list.sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          const ta = a.dueAt?.toMillis?.() ?? 0;
          const tb = b.dueAt?.toMillis?.() ?? 0;
          return ta - tb;
        });
        setTasks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${famPath}/tasks`)
    );

    const unsubSwaps = onSnapshot(
      scopedQuery('swaps'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as TaskSwapRequest);
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setSwaps(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${famPath}/swaps`)
    );

    const unsubRewards = onSnapshot(
      scopedQuery('rewards'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as RewardPerk);
        list.sort((a, b) => a.costPoints - b.costPoints);
        setRewards(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${famPath}/rewards`)
    );

    const unsubRedemptions = onSnapshot(
      scopedQuery('redemptions'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as RewardRedemption);
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setRedemptions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${famPath}/redemptions`)
    );

    const unsubNotifications = onSnapshot(
      scopedQuery('notifications'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as FamilyNotification);
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setNotifications(list);

        if (initialNotifLoad.current) {
          list.forEach((n) => seenNotificationIds.current.add(n.id));
          initialNotifLoad.current = false;
        } else {
          for (const n of list) {
            if (!seenNotificationIds.current.has(n.id)) {
              seenNotificationIds.current.add(n.id);
              const isForMe = n.recipientId === 'all' || n.recipientId === user.uid;
              if (isForMe && n.createdBy !== user.uid) {
                setToastMessage({ title: n.title, body: n.body });
                triggerGentleDeviceAlert(n.title, n.body);
              }
            }
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${famPath}/notifications`)
    );

    return () => {
      unsubMembers();
      unsubTasks();
      unsubSwaps();
      unsubRewards();
      unsubRedemptions();
      unsubNotifications();
    };
  }, [authReady, user, activeFamilyId]);

  const currentMember = useMemo(
    () => members.find((m) => m.uid === user?.uid) ?? null,
    [members, user?.uid]
  );

  useEffect(() => {
    if (!activeFamily || currentMember?.role !== 'admin') return;
    void syncMemberUidsAcrossWorkspace(activeFamily, {
      members,
      tasks,
      swaps,
      rewards,
      redemptions,
      notifications,
    });
  }, [activeFamily, currentMember?.role, members, tasks, swaps, rewards, redemptions, notifications]);

  const fairnessReport = useMemo(
    () => calculateFairDistribution(members, tasks),
    [members, tasks]
  );

  const unreadNotificationsCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter(
      (n) => (n.recipientId === 'all' || n.recipientId === user.uid) && !n.readBy.includes(user.uid)
    ).length;
  }, [notifications, user]);

  const loadingWorkspace = Boolean(
    authReady && user && (!familiesLoaded || (activeFamilyId && !membersLoaded))
  );

  return {
    authReady,
    user,
    authSyncError,
    profile,
    memberships,
    activeFamily,
    members,
    currentMember,
    tasks,
    swaps,
    rewards,
    redemptions,
    notifications,
    fairnessReport,
    unreadNotificationsCount,
    loadingWorkspace,
    toastMessage,
    clearToast: () => setToastMessage(null),
  };
}
