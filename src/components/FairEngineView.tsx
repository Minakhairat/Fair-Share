import React, { useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, RotateCw, Scale } from 'lucide-react';
import { fmt, getCopy } from '../i18n/translations';
import { calculateFairDistribution } from '../lib/fairDistribution';
import { applyBalancedDistribution } from '../services/fairshareService';
import type { Family, FamilyMember, FamilyTask, Locale } from '../types/fairshare';

interface FairEngineViewProps {
  locale: Locale;
  family: Family;
  members: FamilyMember[];
  currentMember: FamilyMember;
  tasks: FamilyTask[];
}

export const FairEngineView: React.FC<FairEngineViewProps> = ({
  locale,
  family,
  members,
  currentMember,
  tasks,
}) => {
  const t = getCopy(locale);
  const isAdmin = currentMember.role === 'admin';
  const [rotateHeavyWeekly, setRotateHeavyWeekly] = useState(true);
  const [applying, setApplying] = useState(false);

  const simulation = useMemo(
    () => calculateFairDistribution(members, tasks, { rotateHeavyWeekly }),
    [members, tasks, rotateHeavyWeekly]
  );

  const changedCount = simulation.proposals.filter((p) => p.changed).length;

  const handleApply = async () => {
    setApplying(true);
    try {
      await applyBalancedDistribution({
        family,
        proposals: simulation.proposals,
        actorUid: currentMember.uid,
        isWeeklyRotation: rotateHeavyWeekly,
        locale,
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Engine Controls Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
              <Scale className="h-4 w-4" />
              <span>{fmt(t.engine.badge, { week: family.rotationCount || 1 })}</span>
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
              {t.engine.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              {t.engine.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 min-h-[44px]">
              <input
                type="checkbox"
                checked={rotateHeavyWeekly}
                onChange={(e) => setRotateHeavyWeekly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700"
              />
              <span>{t.engine.rotateCheckbox}</span>
            </label>

            {isAdmin && (
              <button
                type="button"
                disabled={applying || simulation.proposals.length === 0}
                onClick={() => void handleApply()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap min-h-[44px]"
              >
                {rotateHeavyWeekly ? (
                  <RotateCw className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>
                  {applying
                    ? t.actions.applying
                    : rotateHeavyWeekly
                    ? t.actions.weeklyRotate
                    : t.actions.balanceNow}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Member Capacity Matrix */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-slate-900">
            {t.engine.capacityMatrixTitle}
          </h3>
          <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
            {fmt(t.engine.currentFairness, { score: simulation.fairnessIndex })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-6 py-3 text-start">{t.engine.colMember}</th>
                <th className="px-4 py-3 text-end">{t.engine.colHours}</th>
                <th className="px-4 py-3 text-start">{t.engine.colEnergy}</th>
                <th className="px-4 py-3 text-end">{t.engine.colEffectiveCap}</th>
                <th className="px-4 py-3 text-end">{t.engine.colActiveLoad}</th>
                <th className="px-6 py-3 text-end">{t.engine.colHeavyDone}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {simulation.memberMetrics.map((m) => (
                <tr key={m.member.uid} className="hover:bg-slate-50/60">
                  <td className="px-6 py-3.5 font-medium text-slate-900">
                    {m.member.displayName}
                    <span className="ms-2 text-xs font-normal text-slate-500">
                      ({t.roles[m.member.role]})
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-end font-mono tabular-nums text-slate-700">
                    {m.member.availableHoursPerWeek}h
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {t.energy[m.member.energyLevel]}
                  </td>
                  <td className="px-4 py-3.5 text-end font-mono tabular-nums text-slate-700">
                    {m.effectiveCapacity.toFixed(1)}
                  </td>
                  <td className="px-4 py-3.5 text-end font-mono tabular-nums text-slate-900 font-semibold">
                    {m.assignedLoad.toFixed(1)}
                  </td>
                  <td className="px-6 py-3.5 text-end font-mono tabular-nums text-slate-600">
                    {m.member.heavyTasksCompleted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Proposed Rebalance Plan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {t.engine.planTitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {fmt(t.engine.planSummary, {
                changed: changedCount,
                total: simulation.proposals.length,
              })}
            </p>
          </div>
          {!isAdmin && (
            <span className="text-xs text-slate-500">
              {t.engine.adminApprovalNote}
            </span>
          )}
        </div>

        {simulation.proposals.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {t.engine.noActiveTasks}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {simulation.proposals.map((p) => (
              <div
                key={p.taskId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {p.taskTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.engine.weightLabel}{' '}
                    <span className="font-mono tabular-nums">{p.effortWeight}</span> ·{' '}
                    {fmt(t.dashboard.hrsPerWeekEnergy, {
                      hours: p.hoursPerWeek,
                      energy: t.energy[p.energyLevel],
                    })}
                    {p.rotatedWeekly ? ` · ${t.engine.weeklyRotationReason}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs shrink-0">
                  <span className="text-slate-500">{p.previousAssigneeName}</span>
                  <ArrowRight className={`h-3.5 w-3.5 text-slate-400 ${locale === 'ar' ? 'rotate-180' : ''}`} />
                  <span
                    className={`font-semibold ${
                      p.changed ? 'text-teal-700' : 'text-slate-800'
                    }`}
                  >
                    {p.proposedAssigneeName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
