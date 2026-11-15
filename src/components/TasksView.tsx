import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  HandHelping,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { fmt, getCopy } from '../i18n/translations';
import {
  claimOrHelpTask,
  completeTaskAtomically,
  createFamilyTask,
  deleteFamilyTask,
  requestTaskSwap,
  updateTaskStatus,
} from '../services/fairshareService';
import type {
  EnergyLevel,
  Family,
  FamilyMember,
  FamilyTask,
  Locale,
  TaskCategory,
  TaskRecurrence,
  TaskStatus,
} from '../types/fairshare';

interface TasksViewProps {
  locale: Locale;
  family: Family;
  members: FamilyMember[];
  currentMember: FamilyMember;
  tasks: FamilyTask[];
  openCreateModal: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  locale,
  family,
  members,
  currentMember,
  tasks,
  openCreateModal,
  onCloseCreateModal,
  onOpenCreateModal,
}) => {
  const t = getCopy(locale);
  const isAdmin = currentMember.role === 'admin';

  const [statusFilter, setStatusFilter] = useState<'all' | 'mine' | TaskStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('chores');
  const [difficulty, setDifficulty] = useState(2);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [energyRequired, setEnergyRequired] = useState<EnergyLevel>('medium');
  const [isHeavy, setIsHeavy] = useState(false);
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('weekly');
  const [pointsValue, setPointsValue] = useState(40);
  const [assigneeId, setAssigneeId] = useState(currentMember.uid);
  const [dueHours, setDueHours] = useState(24);
  const [saving, setSaving] = useState(false);

  const [swapTask, setSwapTask] = useState<FamilyTask | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      if (statusFilter === 'mine' && item.assigneeId !== currentMember.uid) return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'mine' &&
        item.status !== statusFilter
      ) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (
        searchQuery.trim() &&
        !`${item.title} ${item.assigneeName} ${item.description ?? ''}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, statusFilter, categoryFilter, searchQuery, currentMember.uid]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const assignee = members.find((m) => m.uid === assigneeId) ?? members[0] ?? currentMember;
    setSaving(true);
    try {
      await createFamilyTask({
        family,
        createdBy: currentMember.uid,
        title,
        description,
        category,
        difficulty,
        estimatedMinutes,
        energyRequired,
        isHeavy,
        recurrence,
        pointsValue,
        assignee,
        dueDate: new Date(Date.now() + dueHours * 3600 * 1000),
        locale,
      });
      setTitle('');
      setDescription('');
      onCloseCreateModal();
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (task: FamilyTask) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(15);
    }
    await completeTaskAtomically(family, task, currentMember, currentMember.uid, locale);
  };

  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapTask) return;
    const target = members.find((m) => m.uid === swapTargetId);
    if (!target) return;
    setSaving(true);
    try {
      await requestTaskSwap({
        family,
        task: swapTask,
        requester: currentMember,
        target,
        reason: swapReason || t.tasks.defaultSwapReason,
        locale,
      });
      setSwapTask(null);
      setSwapReason('');
    } finally {
      setSaving(false);
    }
  };

  const otherMembers = members.filter((m) => m.uid !== currentMember.uid);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(['all', 'mine', 'pending', 'in_progress', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'all'
                  ? t.tasks.all
                  : tab === 'mine'
                  ? t.tasks.mine
                  : t.status[tab]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-56">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.tasks.searchPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-700 focus:bg-white min-h-[40px]"
              />
            </div>

            <select
              aria-label={t.tasks.allCategories}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | TaskCategory)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-teal-700 min-h-[40px]"
            >
              <option value="all">{t.tasks.allCategories}</option>
              <option value="chores">{t.categories.chores}</option>
              <option value="groceries">{t.categories.groceries}</option>
              <option value="bills">{t.categories.bills}</option>
              <option value="maintenance">{t.categories.maintenance}</option>
              <option value="childcare">{t.categories.childcare}</option>
            </select>

            {isAdmin && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Plus className="h-4 w-4" />
                <span>{t.actions.newTask}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Task List */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        {filteredTasks.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-600">{t.empty.tasks}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isAssignedToMe = task.assigneeId === currentMember.uid;
              const dueDate = task.dueAt?.toDate ? task.dueAt.toDate() : new Date();
              const isOverdue = !isCompleted && dueDate.getTime() < Date.now();

              return (
                <div
                  key={task.id}
                  className={`flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between transition-colors ${
                    isCompleted ? 'bg-slate-50/60 opacity-75' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h3
                        className={`text-sm font-semibold ${
                          isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.isHeavy && (
                        <span className="text-[11px] font-semibold text-amber-700">
                          {t.tasks.heavyRotationTag}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-800">{task.assigneeName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.categories[task.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{task.estimatedMinutes}m</span>
                      <span aria-hidden="true">·</span>
                      <span>{fmt(t.tasks.levelOfFive, { level: task.difficulty })}</span>
                      <span aria-hidden="true">·</span>
                      <span className={isOverdue ? 'font-semibold text-red-600' : ''}>
                        {t.status[task.status]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-semibold text-teal-700 tabular-nums">
                        +{task.pointsValue} {t.shell.pts}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!isCompleted && task.status === 'pending' && isAssignedToMe && (
                      <button
                        type="button"
                        onClick={() => void updateTaskStatus(family.id, task.id, 'in_progress')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[40px]"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>{t.actions.start}</span>
                      </button>
                    )}

                    {!isCompleted && !isAssignedToMe && (
                      <button
                        type="button"
                        onClick={() => void claimOrHelpTask(family.id, task.id, currentMember)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[40px]"
                      >
                        <HandHelping className="h-3.5 w-3.5 text-teal-700" />
                        <span>{t.actions.claim}</span>
                      </button>
                    )}

                    {!isCompleted && isAssignedToMe && otherMembers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSwapTask(task);
                          setSwapTargetId(otherMembers[0].uid);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[40px]"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        <span>{t.actions.requestSwap}</span>
                      </button>
                    )}

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => void handleComplete(task)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 min-h-[40px]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{t.actions.complete}</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void deleteFamilyTask(family.id, task.id)}
                        aria-label={`${t.actions.delete} ${task.title}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Admin Create Task Modal */}
      {openCreateModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {t.tasks.createModalTitle}
              </h3>
              <button
                type="button"
                onClick={onCloseCreateModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateTask(e)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.tasks.titleLabel}
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.tasks.titlePlaceholder}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.tasks.notesLabel}
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.tasks.notesPlaceholder}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.categoryLabel}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskCategory)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  >
                    <option value="chores">{t.categories.chores}</option>
                    <option value="groceries">{t.categories.groceries}</option>
                    <option value="bills">{t.categories.bills}</option>
                    <option value="maintenance">{t.categories.maintenance}</option>
                    <option value="childcare">{t.categories.childcare}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.assignToLabel}
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  >
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.displayName} ({t.energy[m.energyLevel]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.minutesLabel}
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.difficultyLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.rewardPtsLabel}
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={pointsValue}
                    onChange={(e) => setPointsValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.energyNeededLabel}
                  </label>
                  <select
                    value={energyRequired}
                    onChange={(e) => setEnergyRequired(e.target.value as EnergyLevel)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  >
                    <option value="low">{t.energy.low}</option>
                    <option value="medium">{t.energy.medium}</option>
                    <option value="high">{t.energy.high}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.recurrenceLabel}
                  </label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  >
                    <option value="once">{t.recurrence.once}</option>
                    <option value="daily">{t.recurrence.daily}</option>
                    <option value="weekly">{t.recurrence.weekly}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.tasks.dueHoursLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={dueHours}
                    onChange={(e) => setDueHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={isHeavy}
                  onChange={(e) => setIsHeavy(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <span>{t.tasks.heavyCheckboxLabel}</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseCreateModal}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 min-h-[44px]"
                >
                  {saving ? t.actions.saving : t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Swap Modal */}
      {swapTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {t.tasks.swapModalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setSwapTask(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleRequestSwap(e)} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                {t.tasks.taskLabel} <strong className="text-slate-900">{swapTask.title}</strong>
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.tasks.askMemberLabel}
                </label>
                <select
                  value={swapTargetId}
                  onChange={(e) => setSwapTargetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                >
                  {otherMembers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName} ({m.availableHoursPerWeek}h · {t.energy[m.energyLevel]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.tasks.gentleNoteLabel}
                </label>
                <input
                  type="text"
                  maxLength={280}
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder={t.tasks.gentleNotePlaceholder}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSwapTask(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 min-h-[44px]"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 min-h-[44px]"
                >
                  {t.actions.sendRequest}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
