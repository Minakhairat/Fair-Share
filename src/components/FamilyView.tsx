import React, { useState } from 'react';
import { Bell, Check, Copy, KeyRound, Shield, Trash2, UserPlus, X } from 'lucide-react';
import { fmt, getCopy } from '../i18n/translations';
import { registerForPushNotifications } from '../lib/firebase';
import {
  addManagedFamilyMember,
  createFamilyWorkspace,
  joinFamilyByInviteCode,
  removeFamilyMember,
  updateFamilyMember,
  updateUserPreferences,
} from '../services/fairshareService';
import type {
  EnergyLevel,
  Family,
  FamilyMember,
  Locale,
  MemberRole,
  UserMembership,
} from '../types/fairshare';
import type { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';

interface FamilyViewProps {
  locale: Locale;
  user: User;
  family: Family;
  members: FamilyMember[];
  memberships: UserMembership[];
  currentMember: FamilyMember;
}

export const FamilyView: React.FC<FamilyViewProps> = ({
  locale,
  user,
  family,
  members,
  memberships,
  currentMember,
}) => {
  const t = getCopy(locale);
  const isAdmin = currentMember.role === 'admin';

  const [copied, setCopied] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'granted' | 'denied'>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
      ? 'granted'
      : 'idle'
  );
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('member');
  const [newHours, setNewHours] = useState(8);
  const [newEnergy, setNewEnergy] = useState<EnergyLevel>('medium');
  const [busy, setBusy] = useState(false);

  const [newFamilyName, setNewFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const handleCopyInvite = async () => {
    await navigator.clipboard?.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnablePush = async () => {
    const res = await registerForPushNotifications();
    if (res.granted) {
      setPushStatus('granted');
      if (res.fcmToken) {
        await updateUserPreferences(user.uid, { fcmToken: res.fcmToken });
      }
      await updateFamilyMember(family.id, currentMember.uid, {
        notificationsEnabled: true,
      });
    } else {
      setPushStatus('denied');
    }
  };

  const handleAddManagedMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await addManagedFamilyMember({
        family,
        displayName: newName,
        role: newRole,
        availableHoursPerWeek: newHours,
        energyLevel: newEnergy,
      });
      setNewName('');
      setShowAddMember(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAnotherFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    setWorkspaceError(null);
    try {
      await createFamilyWorkspace(user, newFamilyName, locale);
      setNewFamilyName('');
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : t.authErrors.generic);
    }
  };

  const handleJoinAnotherFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setWorkspaceError(null);
    try {
      await joinFamilyByInviteCode(user, joinCode, locale);
      setJoinCode('');
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : t.authErrors.generic);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Invite & FCM Notifications Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">{t.family.isolatedLabel}</p>
              <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
                {family.name}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {t.family.inviteDesc}
              </p>
            </div>
            <KeyRound className="h-5 w-5 text-teal-700 shrink-0" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-base font-semibold tracking-wider text-slate-900">
              {family.inviteCode}
            </div>
            <button
              type="button"
              onClick={() => void handleCopyInvite()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
            >
              {copied ? <Check className="h-4 w-4 text-teal-700" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? t.actions.copied : t.actions.copyInvite}</span>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">{t.family.fcmLabel}</p>
              <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
                {t.family.fcmTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {t.family.fcmDesc}
              </p>
            </div>
            <Bell className="h-5 w-5 text-teal-700 shrink-0" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleEnablePush()}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold min-h-[44px] ${
                pushStatus === 'granted'
                  ? 'border border-teal-200 bg-teal-50 text-teal-800'
                  : 'bg-teal-700 text-white hover:bg-teal-800'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>
                {pushStatus === 'granted' ? t.actions.alertsActive : t.actions.enableAlerts}
              </span>
            </button>

            <PWAInstallButton locale={locale} />
          </div>
        </section>
      </div>

      {/* RBAC Members Directory & Capacity Controls */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {fmt(t.family.directoryTitle, { count: members.length })}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t.family.directorySubtitle}
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap min-h-[40px]"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t.sections.addMember}</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const isSelf = member.uid === currentMember.uid;
            const canEditCapacity = isAdmin || isSelf;
            const canRemove = isAdmin && member.uid !== currentMember.uid && member.uid !== family.ownerId;

            return (
              <div
                key={member.uid}
                className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-display text-sm font-bold text-slate-800 shrink-0">
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {member.displayName}
                      </p>
                      {isSelf && (
                        <span className="text-xs text-teal-700 font-medium">
                          {t.family.youTag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      <Shield className="inline h-3 w-3 me-1 text-slate-400" />
                      {t.roles[member.role]} ·{' '}
                      <span className="font-mono tabular-nums">
                        {member.points} {t.shell.pts}
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono tabular-nums">
                        {member.tasksCompletedCount} {t.family.doneTag}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isAdmin && member.uid !== family.ownerId && (
                    <select
                      aria-label={`${t.family.roleLabel} ${member.displayName}`}
                      value={member.role}
                      onChange={(e) =>
                        void updateFamilyMember(family.id, member.uid, {
                          role: e.target.value as MemberRole,
                        })
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 min-h-[40px]"
                    >
                      <option value="admin">{t.roles.admin}</option>
                      <option value="member">{t.roles.member}</option>
                    </select>
                  )}

                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-slate-500">{t.family.hrsWkLabel}</label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      disabled={!canEditCapacity}
                      value={member.availableHoursPerWeek}
                      onChange={(e) =>
                        void updateFamilyMember(family.id, member.uid, {
                          availableHoursPerWeek: Math.min(168, Math.max(1, Number(e.target.value))),
                        })
                      }
                      className="w-16 rounded-xl border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-900 disabled:bg-slate-50 min-h-[40px]"
                    />
                  </div>

                  <select
                    aria-label={`${t.family.energyLabel} ${member.displayName}`}
                    disabled={!canEditCapacity}
                    value={member.energyLevel}
                    onChange={(e) =>
                      void updateFamilyMember(family.id, member.uid, {
                        energyLevel: e.target.value as EnergyLevel,
                      })
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:bg-slate-50 min-h-[40px]"
                  >
                    <option value="low">{t.energy.low}</option>
                    <option value="medium">{t.energy.medium}</option>
                    <option value="high">{t.energy.high}</option>
                  </select>

                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => void removeFamilyMember(family.id, member.uid)}
                      aria-label={`${t.actions.delete} ${member.displayName}`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Multi-Workspace Switcher */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          {t.family.workspacesTitle}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {memberships.map((m) => {
            const active = m.familyId === family.id;
            return (
              <button
                key={m.familyId}
                type="button"
                onClick={() => void updateUserPreferences(user.uid, { activeFamilyId: m.familyId })}
                className={`rounded-xl px-4 py-2 text-xs font-semibold border transition-colors min-h-[40px] ${
                  active
                    ? 'border-teal-700 bg-teal-50 text-teal-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {m.familyName} · {t.roles[m.role]}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 border-t border-slate-100 pt-5">
          <form onSubmit={(e) => void handleCreateAnotherFamily(e)} className="flex gap-2">
            <input
              type="text"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              placeholder={t.family.newWorkspacePlaceholder}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-teal-700 min-h-[40px]"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap min-h-[40px]"
            >
              {t.actions.create}
            </button>
          </form>

          <form onSubmit={(e) => void handleJoinAnotherFamily(e)} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t.family.joinCodePlaceholder}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 font-mono text-xs uppercase outline-none focus:border-teal-700 min-h-[40px]"
            />
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap min-h-[40px]"
            >
              {t.actions.join}
            </button>
          </form>
        </div>
        {workspaceError && (
          <p className="mt-2 text-xs text-red-600">{workspaceError}</p>
        )}
      </section>

      {/* Add Managed Family Member Modal */}
      {showAddMember && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {t.sections.addMember}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleAddManagedMember(e)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.family.memberNameLabel}
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t.family.memberNamePlaceholder}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.family.roleLabel}
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as MemberRole)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  >
                    <option value="member">{t.roles.member}</option>
                    <option value="admin">{t.roles.admin}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.family.hoursLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={newHours}
                    onChange={(e) => setNewHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.family.energyLabel}
                  </label>
                  <select
                    value={newEnergy}
                    onChange={(e) => setNewEnergy(e.target.value as EnergyLevel)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  >
                    <option value="low">{t.energy.low}</option>
                    <option value="medium">{t.energy.medium}</option>
                    <option value="high">{t.energy.high}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 min-h-[44px]"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={busy || !newName.trim()}
                  className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 min-h-[44px]"
                >
                  {t.actions.addMemberBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
