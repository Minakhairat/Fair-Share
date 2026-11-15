import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckSquare,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Scale,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getCopy } from '../i18n/translations';
import { auth } from '../lib/firebase';
import { markNotificationRead } from '../services/fairshareService';
import type {
  AppTab,
  Family,
  FamilyMember,
  FamilyNotification,
  Locale,
} from '../types/fairshare';

interface AppShellProps {
  locale: Locale;
  onToggleLocale: () => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  family: Family;
  currentMember: FamilyMember;
  notifications: FamilyNotification[];
  unreadCount: number;
  toastMessage: { title: string; body: string } | null;
  onClearToast: () => void;
  onOpenNewTask: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  locale,
  onToggleLocale,
  activeTab,
  onSelectTab,
  family,
  currentMember,
  notifications,
  unreadCount,
  toastMessage,
  onClearToast,
  onOpenNewTask,
  children,
}) => {
  const t = getCopy(locale);
  const isOnline = useOnlineStatus();
  const isAdmin = currentMember.role === 'admin';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const navItems: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }>; shortcut: string }> = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard, shortcut: '1' },
    { id: 'tasks', label: t.nav.tasks, icon: CheckSquare, shortcut: '2' },
    { id: 'engine', label: t.nav.engine, icon: Scale, shortcut: '3' },
    { id: 'rewards', label: t.nav.rewards, icon: Award, shortcut: '4' },
    { id: 'family', label: t.nav.family, icon: Users, shortcut: '5' },
    { id: 'report', label: t.nav.report, icon: BarChart3, shortcut: '6' },
    { id: 'docs', label: t.nav.docs, icon: BookOpen, shortcut: '7' },
  ];

  const mobileBottomTabs = navItems.slice(0, 5);

  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row"
    >
      {/* Desktop Persistent Sidebar (>= 1024px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:start-0 border-e border-slate-200 bg-white z-30">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white shrink-0">
            <Scale className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            {t.brand}
          </span>
        </div>

        <div className="px-4 py-4 border-b border-slate-100">
          <p className="text-[11px] font-medium text-slate-500">{t.shell.activeWorkspace}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate">{family.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t.roles[currentMember.role]} ·{' '}
            <span className="font-mono font-semibold text-teal-700 tabular-nums">
              {currentMember.points} {t.shell.pts}
            </span>
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-[42px] ${
                  active
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className={`h-4 w-4 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">{item.shortcut}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4 space-y-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-slate-700 truncate">
              {currentMember.displayName}
            </span>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              aria-label={t.signOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col lg:ps-64 min-w-0">
        {/* Top Bar (Compact 56px mobile, 64px desktop) */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md pt-safe">
          <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
                aria-label={t.shell.openNavigation}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={onToggleLocale}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Globe className="h-3.5 w-3.5 text-teal-700" />
                <span>{locale === 'en' ? 'العربية' : 'EN'}</span>
              </button>

              <button
                type="button"
                onClick={() => setNotifDrawerOpen((v) => !v)}
                aria-label={t.shell.notifications}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -end-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal-700 px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenNewTask}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t.actions.newTask}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area (bottom padding prevents overlap with mobile bottom bar) */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile & Tablet Fixed Bottom Tab Bar (< 1024px) */}
      <nav
        aria-label={t.shell.openNavigation}
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {mobileBottomTabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate?.(8);
                  }
                  onSelectTab(item.id);
                }}
                className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium tracking-tight transition-colors ${
                  active ? 'text-teal-700 font-semibold' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile / Tablet Slide-Over Drawer for Secondary Views (Report, Docs, Sign Out) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-teal-700" />
                <span className="font-display text-base font-bold text-slate-900">
                  {family.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium min-h-[44px] ${
                      active ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 min-h-[44px]"
            >
              <LogOut className="h-4 w-4" />
              <span>{t.signOut}</span>
            </button>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {notifDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
            onClick={() => setNotifDrawerOpen(false)}
          />
          <div className="relative z-10 flex w-full max-w-sm flex-col bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {t.sections.recentNotifications}
              </h2>
              <button
                type="button"
                onClick={() => setNotifDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{t.empty.notifications}</p>
              ) : (
                notifications.map((n) => {
                  const isRead = n.readBy.includes(currentMember.uid);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (!isRead) {
                          void markNotificationRead(family.id, n.id, currentMember.uid);
                        }
                      }}
                      className={`w-full rounded-xl border p-3.5 text-start transition-colors ${
                        isRead
                          ? 'border-slate-100 bg-white text-slate-600'
                          : 'border-teal-200 bg-teal-50/50 text-slate-900'
                      }`}
                    >
                      <p className="text-xs font-semibold">{n.title}</p>
                      <p className="mt-1 text-xs leading-relaxed opacity-90">{n.body}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gentle Live Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 end-4 lg:bottom-6 lg:end-6 z-40 max-w-xs rounded-2xl border border-teal-200 bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-teal-800">{toastMessage.title}</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">{toastMessage.body}</p>
            </div>
            <button
              type="button"
              onClick={onClearToast}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Offline PWA Banner */}
      {!isOnline && (
        <div className="fixed bottom-20 start-4 lg:bottom-6 lg:start-72 z-40 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
          <WifiOff className="h-4 w-4" />
          <span>{t.shell.offlineBanner}</span>
        </div>
      )}
    </div>
  );
};
