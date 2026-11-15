import React from 'react';
import { BarChart3, Download } from 'lucide-react';
import { fmt, getCopy } from '../i18n/translations';
import type { FairnessReport } from '../lib/fairDistribution';
import type { Family, FamilyMember, FamilyTask, Locale } from '../types/fairshare';

interface WeeklyReportViewProps {
  locale: Locale;
  family: Family;
  members: FamilyMember[];
  tasks: FamilyTask[];
  fairnessReport: FairnessReport;
}

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({
  locale,
  family,
  members,
  tasks,
  fairnessReport,
}) => {
  const t = getCopy(locale);

  const completedTasks = tasks.filter((x) => x.status === 'completed');
  const totalMinutesCompleted = completedTasks.reduce((sum, x) => sum + x.estimatedMinutes, 0);
  const heavyCompleted = completedTasks.filter((x) => x.isHeavy).length;

  const handleExportCsv = () => {
    const header = [
      t.report.colMember,
      t.family.roleLabel,
      t.report.colCompleted,
      t.report.colHeavy,
      t.report.colPoints,
      t.family.hoursLabel,
      t.family.energyLabel,
    ];
    const rows = members.map((m) => [
      `"${m.displayName.replace(/"/g, '""')}"`,
      t.roles[m.role],
      String(m.tasksCompletedCount),
      String(m.heavyTasksCompleted),
      String(m.points),
      String(m.availableHoursPerWeek),
      t.energy[m.energyLevel],
    ]);
    const csv = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${family.name.toLowerCase().replace(/\s+/g, '-')}-weekly-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <BarChart3 className="h-4 w-4" />
            <span>{t.sections.weeklySummary}</span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
            {family.name} · {fmt(t.report.titleSuffix, { week: family.rotationCount || 1 })}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t.report.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap min-h-[44px]"
        >
          <Download className="h-4 w-4" />
          <span>{t.actions.exportCsv}</span>
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">{t.report.effortTitle}</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {(totalMinutesCompleted / 60).toFixed(1)} {t.report.hrsUnit}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {fmt(t.report.effortSub, { count: completedTasks.length })}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">{t.report.fairnessTitle}</p>
          <p className="mt-2 font-mono text-2xl font-bold text-teal-700 tabular-nums">
            {fairnessReport.fairnessIndex}%
          </p>
          <p className="mt-1 text-xs text-slate-500">{t.report.fairnessSub}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">{t.report.heavyTitle}</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {heavyCompleted}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t.report.heavySub}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            {t.report.breakdownTitle}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-6 py-3 text-start">{t.report.colMember}</th>
                <th className="px-4 py-3 text-end">{t.report.colCompleted}</th>
                <th className="px-4 py-3 text-end">{t.report.colHeavy}</th>
                <th className="px-4 py-3 text-end">{t.report.colLoadScore}</th>
                <th className="px-6 py-3 text-end">{t.report.colPoints}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.uid}>
                  <td className="px-6 py-3.5 font-medium text-slate-900">{m.displayName}</td>
                  <td className="px-4 py-3.5 text-end font-mono tabular-nums text-slate-700">
                    {m.tasksCompletedCount}
                  </td>
                  <td className="px-4 py-3.5 text-end font-mono tabular-nums text-slate-700">
                    {m.heavyTasksCompleted}
                  </td>
                  <td className="px-4 py-3.5 text-end font-mono tabular-nums text-slate-700">
                    {m.weeklyLoadScore.toFixed(1)}
                  </td>
                  <td className="px-6 py-3.5 text-end font-mono tabular-nums font-semibold text-teal-700">
                    {m.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
