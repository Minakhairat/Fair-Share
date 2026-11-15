import React, { useState } from 'react';
import { Award, CheckCircle2, Gift, Plus, Trash2, X } from 'lucide-react';
import { fmt, getCopy } from '../i18n/translations';
import {
  createRewardPerk,
  deleteRewardPerk,
  fulfillRedemption,
  redeemRewardAtomically,
} from '../services/fairshareService';
import type {
  Family,
  FamilyMember,
  Locale,
  RewardCategory,
  RewardPerk,
  RewardRedemption,
} from '../types/fairshare';

interface RewardsViewProps {
  locale: Locale;
  family: Family;
  currentMember: FamilyMember;
  rewards: RewardPerk[];
  redemptions: RewardRedemption[];
}

export const RewardsView: React.FC<RewardsViewProps> = ({
  locale,
  family,
  currentMember,
  rewards,
  redemptions,
}) => {
  const t = getCopy(locale);
  const isAdmin = currentMember.role === 'admin';

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costPoints, setCostPoints] = useState(100);
  const [category, setCategory] = useState<RewardCategory>('exemption');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusyId('create');
    try {
      await createRewardPerk({
        family,
        createdBy: currentMember.uid,
        title,
        description,
        costPoints,
        category,
      });
      setTitle('');
      setDescription('');
      setShowCreate(false);
    } finally {
      setBusyId(null);
    }
  };

  const handleRedeem = async (reward: RewardPerk) => {
    setError(null);
    setBusyId(reward.id);
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([15, 25, 15]);
      }
      await redeemRewardAtomically({
        family,
        reward,
        member: currentMember,
        locale,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rewards.notEnoughError);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Points Balance Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{t.kpis.myPoints}</p>
            <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
              {currentMember.points}{' '}
              <span className="text-sm font-normal text-slate-500">{t.shell.pts}</span>
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            <span>{t.actions.addPerkBtn}</span>
          </button>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Perks Grid */}
      <section>
        <h2 className="font-display text-base font-semibold text-slate-900 mb-3">
          {t.sections.rewardsCatalog}
        </h2>
        {rewards.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            {t.empty.rewards}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rewards.map((reward) => {
              const affordable = currentMember.points >= reward.costPoints;
              return (
                <div
                  key={reward.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          {t.rewardCategories[reward.category]}
                        </p>
                        <h3 className="mt-1 font-display text-base font-semibold text-slate-900">
                          {reward.title}
                        </h3>
                      </div>
                      <span className="font-mono text-sm font-bold text-teal-700 tabular-nums shrink-0">
                        {reward.costPoints} {t.shell.pts}
                      </span>
                    </div>
                    {reward.description && (
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        {reward.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      disabled={!affordable || busyId === reward.id}
                      onClick={() => void handleRedeem(reward)}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                        affordable
                          ? 'bg-teal-700 text-white hover:bg-teal-800'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Gift className="h-3.5 w-3.5" />
                      <span>
                        {busyId === reward.id
                          ? t.actions.redeeming
                          : affordable
                          ? t.actions.redeem
                          : fmt(t.rewards.needMore, {
                              points: reward.costPoints - currentMember.points,
                            })}
                      </span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void deleteRewardPerk(family.id, reward.id)}
                        aria-label={`${t.actions.delete} ${reward.title}`}
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
        )}
      </section>

      {/* Redemption History */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
          {t.sections.redemptionHistory}
        </h2>
        {redemptions.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">{t.rewards.noRedemptions}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {redemptions.map((red) => (
              <div
                key={red.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{red.rewardTitle}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {red.memberName} ·{' '}
                    <span className="font-mono tabular-nums">
                      {red.costPoints} {t.shell.pts}
                    </span>{' '}
                    ·{' '}
                    <span
                      className={
                        red.status === 'fulfilled'
                          ? 'text-teal-700 font-medium'
                          : 'text-amber-700 font-medium'
                      }
                    >
                      {red.status === 'fulfilled'
                        ? t.rewards.fulfilled
                        : t.rewards.awaitingFulfillment}
                    </span>
                  </p>
                </div>

                {isAdmin && red.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void fulfillRedemption(family.id, red.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 min-h-[40px]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t.actions.fulfill}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admin Create Reward Modal */}
      {showCreate && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {t.rewards.modalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateReward(e)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.rewards.perkTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.rewards.perkTitlePlaceholder}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.rewards.descLabel}
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.rewards.pointsCostLabel}
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={costPoints}
                    onChange={(e) => setCostPoints(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.rewards.categoryLabel}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as RewardCategory)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-700 min-h-[44px]"
                  >
                    <option value="exemption">{t.rewardCategories.exemption}</option>
                    <option value="leisure">{t.rewardCategories.leisure}</option>
                    <option value="treat">{t.rewardCategories.treat}</option>
                    <option value="privilege">{t.rewardCategories.privilege}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 min-h-[44px]"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={busyId === 'create' || !title.trim()}
                  className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 min-h-[44px]"
                >
                  {t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
