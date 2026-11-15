import React, { useState } from 'react';
import { signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { ArrowRight, CheckCircle2, ExternalLink, Globe, KeyRound, Scale, Users } from 'lucide-react';
import heroImg from '../assets/images/fairshare_home_harmony_1794766830780.jpg';
import { getCopy } from '../i18n/translations';
import { auth, googleProvider } from '../lib/firebase';
import { createFamilyWorkspace, joinFamilyByInviteCode } from '../services/fairshareService';
import type { Locale } from '../types/fairshare';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthOnboardingViewProps {
  user: User | null;
  authSyncError?: string | null;
  locale: Locale;
  onToggleLocale: () => void;
}

export const AuthOnboardingView: React.FC<AuthOnboardingViewProps> = ({
  user,
  authSyncError,
  locale,
  onToggleLocale,
}) => {
  const t = getCopy(locale);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPopupFallback, setShowPopupFallback] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const mapAuthError = (err: unknown): { message: string; isPopupIssue: boolean } => {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/web-storage-unsupported'
    ) {
      return { message: t.authErrors.popupBlocked, isPopupIssue: true };
    }
    if (code === 'auth/popup-closed-by-user') {
      return { message: t.authErrors.popupClosed, isPopupIssue: true };
    }
    if (code === 'auth/unauthorized-domain') {
      return { message: t.authErrors.unauthorizedDomain, isPopupIssue: false };
    }
    if (code === 'auth/network-request-failed') {
      return { message: t.authErrors.network, isPopupIssue: false };
    }
    const raw = err instanceof Error ? err.message : '';
    return {
      message: raw ? `${t.authErrors.generic} (${code || raw})` : t.authErrors.generic,
      isPopupIssue: true,
    };
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setShowPopupFallback(false);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
      setShowPopupFallback(mapped.isPopupIssue || isInIframe);
    } finally {
      setBusy(false);
    }
  };

  const handleRedirectSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
      setBusy(false);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !familyName.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await createFamilyWorkspace(user, familyName, locale);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.authErrors.generic);
    } finally {
      setBusy(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteCode.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await joinFamilyByInviteCode(user, inviteCode, locale);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.authErrors.generic);
    } finally {
      setBusy(false);
    }
  };

  const displayError = error || authSyncError;

  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col"
    >
      {/* Clean 3-zone Top Bar */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 h-16">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Scale className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              {t.brand}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#fairness-engine" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              {t.nav.engine}
            </a>
            <a href="#rbac-isolation" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              {t.nav.rbac}
            </a>
            <a href="#cross-platform" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              {t.nav.crossPlatform}
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleLocale}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Globe className="h-3.5 w-3.5 text-teal-700" />
              <span>{locale === 'en' ? 'العربية' : 'English'}</span>
            </button>
            <PWAInstallButton compact locale={locale} />
            {user && (
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                {t.signOut}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero / Workspace Setup */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left Column: Core Auth or Family Setup */}
          <section className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10">
            <div>
              <p className="text-xs font-medium text-teal-700">{t.tagline}</p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                {t.welcomeTitle}
              </h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                {t.welcomeSubtitle}
              </p>

              {!user ? (
                <div className="mt-8 space-y-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleGoogleSignIn()}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-xl bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60 min-h-[48px]"
                  >
                    <span>{busy ? t.connecting : t.signInGoogle}</span>
                    <ArrowRight className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`} />
                  </button>
                  <p className="text-xs text-slate-500">
                    {t.authSecurityNote}
                  </p>
                </div>
              ) : (
                <div className="mt-8">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-800 font-semibold text-sm">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {user.displayName || t.signedIn}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Mode Switch Tabs */}
                  <div className="mt-6 flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('create');
                        setError(null);
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                        mode === 'create'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.createWorkspace}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('join');
                        setError(null);
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                        mode === 'join'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.joinWorkspace}
                    </button>
                  </div>

                  {mode === 'create' ? (
                    <form onSubmit={(e) => void handleCreateFamily(e)} className="mt-5 space-y-4">
                      <div>
                        <label
                          htmlFor="family-name"
                          className="block text-xs font-medium text-slate-700 mb-1.5"
                        >
                          {t.workspaceNameLabel}
                        </label>
                        <input
                          id="family-name"
                          type="text"
                          required
                          maxLength={80}
                          value={familyName}
                          onChange={(e) => setFamilyName(e.target.value)}
                          placeholder={t.familyNamePlaceholder}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-700 focus:bg-white transition-colors min-h-[44px]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy || !familyName.trim()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 min-h-[48px]"
                      >
                        <Users className="h-4 w-4" />
                        <span>{busy ? t.creatingButton : t.createButton}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={(e) => void handleJoinFamily(e)} className="mt-5 space-y-4">
                      <div>
                        <label
                          htmlFor="invite-code"
                          className="block text-xs font-medium text-slate-700 mb-1.5"
                        >
                          {t.inviteCodeLabel}
                        </label>
                        <input
                          id="invite-code"
                          type="text"
                          required
                          maxLength={24}
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          placeholder={t.inviteCodePlaceholder}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm uppercase tracking-wider text-slate-900 outline-none focus:border-teal-700 focus:bg-white transition-colors min-h-[44px]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy || !inviteCode.trim()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 min-h-[48px]"
                      >
                        <KeyRound className="h-4 w-4" />
                        <span>{busy ? t.joiningButton : t.joinButton}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {displayError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-2.5">
                  <p className="leading-relaxed">{displayError}</p>
                  {!user && (showPopupFallback || isInIframe) && (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>{t.openInNewTab}</span>
                      </a>
                      {!isInIframe && (
                        <button
                          type="button"
                          onClick={() => void handleRedirectSignIn()}
                          className="rounded-lg bg-white border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                        >
                          {t.signInRedirect}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-6 text-xs text-slate-600">
              {t.onboardingFeatures.map((feat) => (
                <div key={feat} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Right Column: Editorial Home Scene */}
          <section className="lg:col-span-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {!imgFailed ? (
              <img
                src={heroImg}
                alt={t.heroFallbackTitle}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-64 w-full object-cover sm:h-80 lg:h-full"
              />
            ) : (
              <div className="flex h-64 lg:h-full w-full flex-col items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-slate-100 p-8 text-center">
                <Scale className="h-12 w-12 text-teal-700 mb-3" />
                <p className="font-display text-lg font-semibold text-slate-800">
                  {t.heroFallbackTitle}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Mechanism-to-Outcome Architecture Strip */}
        <section
          id="fairness-engine"
          className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {t.onboardingCards.map((card, idx) => (
            <div
              key={card.title}
              id={idx === 0 ? 'rbac-isolation' : idx === 2 ? 'cross-platform' : undefined}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <h2 className="font-display text-base font-semibold text-slate-900">
                {card.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};
