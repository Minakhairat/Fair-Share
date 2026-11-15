import React from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  RefreshCw,
  Scale,
  Users,
} from 'lucide-react';
import { fmt, getCopy } from '../i18n/translations';
import {
  applyBalancedDistribution,
  completeTaskAtomically,
  resolveTaskSwap,
} from '../services/fairshareService';
import type { FairnessReport } from '../lib/fairDistribution';
import type {
  AppTab,
  Family,
  FamilyMember,
  FamilyNotification,
  FamilyTask,
  Locale,
  TaskSwapRequest,
} from '../types/fairshare';

interface DashboardViewProps {
  locale: Locale;
  family: Family;
  members: FamilyMember[];
  currentMember: FamilyMember;
  tasks: FamilyTask[];
  swaps: TaskSwapRequest[];
  notifications: FamilyNotification[];
  fairnessReport: FairnessReport;
  onNavigate: (tab: AppTab) => void;
  onOpenNewTask: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  locale,
  family,
  members,
  currentMember,
  tasks,
  swaps,
  notifications,
  fairnessReport,
  onNavigate,
  onOpenNewTask,
}) => {
  const t = getCopy(locale);
  const isAdmin = currentMember.role === 'admin';

  const activeTasks = tasks.filter((item) => item.status !== 'completed');
  const completedTasks = tasks.filter((item) => item.status === 'completed');
  const pendingSwaps = swaps.filter((s) => s.status === 'pending');

  const dueSoonTasks = activeTasks.slice(0, 5);
  const recentNotifications = notifications.slice(0, 5);

  const handleQuickComplete = async (task: FamilyTask) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(15);
    }
    const actor = members.find((m) => m.uid === currentMember.uid) ?? currentMember;
    await completeTaskAtomically(family, task, actor, currentMember.uid, locale);
  };

  const handleQuickBalance = async () => {
    await applyBalancedDistribution({
      family,
      proposals: fairnessReport.proposals,
      actorUid: currentMember.uid,
      isWeeklyRotation: false,
      locale,
    });
  };

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">{t.kpis.activeTasks}</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums">
            {activeTasks.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tasks.filter((x) => x.status === 'in_progress').length} {t.kpis.inProgressCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">{t.kpis.fairnessIndex}</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-teal-700 tabular-nums">
            {fairnessReport.fairnessIndex}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t.kpis.rotationWeek} {family.rotationCount || 1}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">{t.kpis.completedWeek}</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums">
            {completedTasks.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}% {t.kpis.completionSuffix}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">{t.kpis.myPoints}</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums">
            {currentMember.points}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {currentMember.tasksCompletedCount} {t.kpis.tasksFinished}
          </p>
        </div>
      </section>

      {/* Main 2-Column Adaptive Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 Columns: Who is doing what + Active Responsibilities */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {t.sections.whosDoingWhat}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.sections.liveSyncHint}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenNewTask}
                    className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 min-h-[40px]"
                  >
                    + {t.actions.newTask}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('tasks')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <span>{t.sections.allTasksLink}</span>
                  <ArrowRight className={`h-3.5 w-3.5 ${locale === 'ar' ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {dueSoonTasks.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-teal-600" />
                <p className="mt-3 text-sm font-medium text-slate-700">{t.empty.tasks}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {dueSoonTasks.map((task) => {
                  const dueMs = task.dueAt?.toMillis?.() ?? Date.now();
                  const hoursLeft = Math.round((dueMs - Date.now()) / 3600000);
                  const dueLabel =
                    hoursLeft < 0
                      ? fmt(t.dashboard.overdueHours, { hours: Math.abs(hoursLeft) })
                      : hoursLeft < 24
                      ? fmt(t.dashboard.dueInHours, { hours: hoursLeft })
                      : fmt(t.dashboard.dueInDays, { days: Math.round(hoursLeft / 24) });

                  return (
                    <div
                      key={task.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{task.assigneeName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.categories[task.category]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{task.estimatedMinutes}m</span>
                          <span aria-hidden="true">·</span>
                          <span className={hoursLeft < 0 ? 'text-red-600 font-medium' : hoursLeft < 8 ? 'text-amber-700 font-medium' : ''}>
                            {dueLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-teal-700 tabular-nums">
                            +{task.pointsValue} {t.shell.pts}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleQuickComplete(task)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap min-h-[40px]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{t.actions.complete}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Pending Swap Requests */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {t.sections.swapQueue}
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {fmt(t.sections.pendingCount, { count: pendingSwaps.length })}
              </span>
            </div>

            {pendingSwaps.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">{t.empty.swaps}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingSwaps.map((swap) => {
                  const canDecide =
                    isAdmin || swap.targetMemberId === currentMember.uid;
                  return (
                    <div key={swap.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {swap.taskTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {swap.requesterName} → {swap.targetMemberName} · {swap.reason}
                        </p>
                      </div>
                      {canDecide && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              void resolveTaskSwap({
                                family,
                                swap,
                                decision: 'accepted',
                                actorUid: currentMember.uid,
                                locale,
                              })
                            }
                            className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 min-h-[40px]"
                          >
                            {t.actions.accept}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void resolveTaskSwap({
                                family,
                                swap,
                                decision: 'declined',
                                actorUid: currentMember.uid,
                                locale,
                              })
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[40px]"
                          >
                            {t.actions.decline}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 Columns: Fairness Balance & Gentle Notifications */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {t.sections.fairnessBalance}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fmt(t.sections.capacityWeightedHint, { count: members.length })}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void handleQuickBalance()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-teal-700" />
                  <span>{t.actions.balanceNow}</span>
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {fairnessReport.memberMetrics.map(({ member, effectiveCapacity, assignedLoad, utilizationRatio }) => {
                const percent = Math.min(100, Math.round(utilizationRatio * 25));
                return (
                  <div key={member.uid} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">
                        {member.displayName}
                      </span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {fmt(t.dashboard.loadCap, {
                          load: assignedLoad.toFixed(1),
                          cap: effectiveCapacity.toFixed(1),
                        })}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilizationRatio > 3.5 ? 'bg-amber-600' : 'bg-teal-700'
                        }`}
                        style={{ width: `${Math.max(8, percent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {fmt(t.dashboard.hrsPerWeekEnergy, {
                          hours: member.availableHoursPerWeek,
                          energy: t.energy[member.energyLevel],
                        })}
                      </span>
                      <span className="font-mono tabular-nums">
                        {member.points} {t.shell.pts}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Scale className="h-4 w-4 text-teal-700" />
                <span>{t.sections.viewProposalBreakdown}</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('engine')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                {t.sections.openFairEngine} {locale === 'ar' ? '←' : '→'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {t.sections.recentNotifications}
              </h2>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>

            {recentNotifications.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">{t.empty.notifications}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentNotifications.map((notif) => (
                  <div key={notif.id} className="py-3">
                    <p className="text-xs font-semibold text-slate-900">{notif.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{notif.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => onNavigate('rewards')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                <Award className="h-4 w-4" />
                <span>{fmt(t.sections.redeemPointsLink, { points: currentMember.points })}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('family')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <Users className="h-4 w-4" />
                <span>{t.sections.manageFamilyLink}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
