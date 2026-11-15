/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { ArchitectureDocsView } from './components/ArchitectureDocsView';
import { AuthOnboardingView } from './components/AuthOnboardingView';
import { DashboardView } from './components/DashboardView';
import { FairEngineView } from './components/FairEngineView';
import { FamilyView } from './components/FamilyView';
import { RewardsView } from './components/RewardsView';
import { TasksView } from './components/TasksView';
import { WeeklyReportView } from './components/WeeklyReportView';
import { useFairShareData } from './hooks/useFairShareData';
import { getCopy } from './i18n/translations';
import { updateUserPreferences } from './services/fairshareService';
import type { AppTab, Locale } from './types/fairshare';

const LOCALE_STORAGE_KEY = 'fairshare_locale';

function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  }
  return 'ar';
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const currentLocale: Locale =
        typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ar';
      const t = getCopy(currentLocale);
      return (
        <div
          dir={currentLocale === 'ar' ? 'rtl' : 'ltr'}
          className="min-h-screen bg-slate-50 flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <h1 className="font-display text-lg font-bold text-slate-900">
              {t.shell.errorTitle}
            </h1>
            <p className="text-xs text-slate-600 break-words">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              {t.shell.reloadButton}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function FairShareApp() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [openCreateTaskModal, setOpenCreateTaskModal] = useState(false);

  const state = useFairShareData(locale);
  const t = getCopy(locale);

  // Sync document language and text direction for proper Arabic RTL & English LTR rendering
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  // Sync preferred locale from Firestore profile if no explicit local override is saved
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    if (!saved && state.profile?.preferredLocale) {
      setLocale(state.profile.preferredLocale);
    }
  }, [state.profile?.preferredLocale]);

  // Desktop keyboard shortcuts (1-7 tabs, N to create task)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!state.activeFamily || !state.currentMember) return;

      const map: Record<string, AppTab> = {
        '1': 'dashboard',
        '2': 'tasks',
        '3': 'engine',
        '4': 'rewards',
        '5': 'family',
        '6': 'report',
        '7': 'docs',
      };
      if (map[e.key]) {
        setActiveTab(map[e.key]);
      } else if (e.key.toLowerCase() === 'n' && state.currentMember.role === 'admin') {
        e.preventDefault();
        setActiveTab('tasks');
        setOpenCreateTaskModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activeFamily, state.currentMember]);

  const handleToggleLocale = () => {
    const next: Locale = locale === 'en' ? 'ar' : 'en';
    setLocale(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
    if (state.user) {
      void updateUserPreferences(state.user.uid, { preferredLocale: next });
    }
  };

  const handleOpenNewTask = () => {
    setActiveTab('tasks');
    setOpenCreateTaskModal(true);
  };

  if (!state.authReady || state.loadingWorkspace) {
    return (
      <div
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-slate-50 flex items-center justify-center p-6"
      >
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-teal-700 border-t-transparent animate-spin" />
          <p className="text-xs font-medium text-slate-600">{t.connectingApp}</p>
        </div>
      </div>
    );
  }

  if (!state.user || !state.activeFamily || !state.currentMember) {
    return (
      <AuthOnboardingView
        user={state.user}
        authSyncError={state.authSyncError}
        locale={locale}
        onToggleLocale={handleToggleLocale}
      />
    );
  }

  return (
    <AppShell
      locale={locale}
      onToggleLocale={handleToggleLocale}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      family={state.activeFamily}
      currentMember={state.currentMember}
      notifications={state.notifications}
      unreadCount={state.unreadNotificationsCount}
      toastMessage={state.toastMessage}
      onClearToast={state.clearToast}
      onOpenNewTask={handleOpenNewTask}
    >
      {activeTab === 'dashboard' && (
        <DashboardView
          locale={locale}
          family={state.activeFamily}
          members={state.members}
          currentMember={state.currentMember}
          tasks={state.tasks}
          swaps={state.swaps}
          notifications={state.notifications}
          fairnessReport={state.fairnessReport}
          onNavigate={setActiveTab}
          onOpenNewTask={handleOpenNewTask}
        />
      )}

      {activeTab === 'tasks' && (
        <TasksView
          locale={locale}
          family={state.activeFamily}
          members={state.members}
          currentMember={state.currentMember}
          tasks={state.tasks}
          openCreateModal={openCreateTaskModal}
          onCloseCreateModal={() => setOpenCreateTaskModal(false)}
          onOpenCreateModal={() => setOpenCreateTaskModal(true)}
        />
      )}

      {activeTab === 'engine' && (
        <FairEngineView
          locale={locale}
          family={state.activeFamily}
          members={state.members}
          currentMember={state.currentMember}
          tasks={state.tasks}
        />
      )}

      {activeTab === 'rewards' && (
        <RewardsView
          locale={locale}
          family={state.activeFamily}
          currentMember={state.currentMember}
          rewards={state.rewards}
          redemptions={state.redemptions}
        />
      )}

      {activeTab === 'family' && (
        <FamilyView
          locale={locale}
          user={state.user}
          family={state.activeFamily}
          members={state.members}
          memberships={state.memberships}
          currentMember={state.currentMember}
        />
      )}

      {activeTab === 'report' && (
        <WeeklyReportView
          locale={locale}
          family={state.activeFamily}
          members={state.members}
          tasks={state.tasks}
          fairnessReport={state.fairnessReport}
        />
      )}

      {activeTab === 'docs' && <ArchitectureDocsView locale={locale} />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FairShareApp />
    </ErrorBoundary>
  );
}
