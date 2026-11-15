import React, { useState } from 'react';
import { BookOpen, Database, Lock, Smartphone } from 'lucide-react';
import { getCopy } from '../i18n/translations';
import type { Locale } from '../types/fairshare';

interface ArchitectureDocsViewProps {
  locale: Locale;
}

export const ArchitectureDocsView: React.FC<ArchitectureDocsViewProps> = ({ locale }) => {
  const t = getCopy(locale);
  const [section, setSection] = useState<'firebase' | 'rbac' | 'api' | 'responsive'>('firebase');

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
          <BookOpen className="h-4 w-4" />
          <span>{t.docs.badge}</span>
        </div>
        <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
          {t.docs.title}
        </h2>

        <div className="mt-5 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              { id: 'firebase', label: t.docs.tabs.firebase },
              { id: 'rbac', label: t.docs.tabs.rbac },
              { id: 'api', label: t.docs.tabs.api },
              { id: 'responsive', label: t.docs.tabs.responsive },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors min-h-[38px] ${
                section === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {section === 'firebase' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Database className="h-4 w-4 text-teal-700" />
            <span>{t.docs.firebaseTitle}</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{t.docs.firebaseDesc}</p>
          <div
            dir="ltr"
            className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 leading-relaxed text-left whitespace-pre"
          >
            {`/users/{userId}                        # Private PII + activeFamilyId + FCM token
/users/{userId}/memberships/{familyId} # Workspace index for the signed-in user
/inviteCodes/{code}                    # Direct-get lookup (list disabled)
/families/{familyId}                   # Workspace metadata + rotationCount
/families/{familyId}/members/{uid}     # Role, hours/wk, energy, points, load
/families/{familyId}/tasks/{taskId}    # Responsibilities + heavy rotation flag
/families/{familyId}/swaps/{swapId}    # Peer-to-peer swap requests
/families/{familyId}/rewards/{id}      # Admin-defined positive perks
/families/{familyId}/redemptions/{id}  # Atomic point-deducted redemptions
/families/{familyId}/notifications/{id}# Real-time gentle alert feed`}
          </div>
        </section>
      )}

      {section === 'rbac' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lock className="h-4 w-4 text-teal-700" />
            <span>{t.docs.rbacTitle}</span>
          </div>
          <ul className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
            {t.docs.rbacItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {section === 'api' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            {t.docs.apiTitle}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 pe-4 text-start">{t.docs.apiCols.op}</th>
                  <th className="py-2.5 pe-4 text-start">{t.docs.apiCols.path}</th>
                  <th className="py-2.5 text-start">{t.docs.apiCols.guarantee}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {t.docs.apiRows.map((row) => (
                  <tr key={row.op}>
                    <td className="py-2.5 pe-4 font-sans font-medium">{row.op}</td>
                    <td dir="ltr" className="py-2.5 pe-4 font-mono text-left">
                      {row.path}
                    </td>
                    <td className="py-2.5 font-sans">{row.guarantee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === 'responsive' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Smartphone className="h-4 w-4 text-teal-700" />
            <span>{t.docs.responsiveTitle}</span>
          </div>
          <ul className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
            {t.docs.responsiveItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
