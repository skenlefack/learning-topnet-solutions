'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  ArrowLeft, Award, Clock, Eye, CheckCircle, XCircle,
  BarChart3, Shield, Lock, ExternalLink,
} from 'lucide-react';

export default function SkillResultPage() {
  const { id: attemptId } = useParams<{ id: string }>();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    // Try sessionStorage first (just submitted), then API
    const cached = sessionStorage.getItem('skill-result');
    if (cached) {
      setResult(JSON.parse(cached));
      sessionStorage.removeItem('skill-result');
      setLoading(false);
      return;
    }
    if (token && attemptId) {
      skillsApi.result(token, attemptId)
        .then(res => setResult(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token, attemptId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        Resultat introuvable
      </div>
    );
  }

  const score = result.score || result;
  const pct = score.percentage || 0;
  const domains = result.domains || {};
  const trackDomains = result.trackDomains || {};

  // Score ring color
  const ringColor = pct >= 85 ? '#10b981' : pct >= 68 ? '#3b82f6' : pct >= 50 ? '#f59e0b' : pct >= 30 ? '#f97316' : '#ef4444';
  const circumference = 2 * Math.PI * 54;
  const strokeOffset = circumference * (1 - pct / 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/skills')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux tests
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {result.trackName?.fr || 'Resultats du test'}
          </h1>
          <p className="text-sm text-gray-500">
            {result.format} — {new Date(result.submittedAt || Date.now()).toLocaleDateString('fr-FR')}
          </p>
        </div>

        {/* Score ring + level */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-36 h-36 mb-4">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle cx="60" cy="60" r="54" fill="none" stroke={ringColor} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeOffset}
                className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{pct}%</span>
            </div>
          </div>

          {/* Skill level badge */}
          <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
            pct >= 85 ? 'bg-green-100 text-green-700' :
            pct >= 68 ? 'bg-blue-100 text-blue-700' :
            pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
            pct >= 30 ? 'bg-orange-100 text-orange-700' :
            'bg-red-100 text-red-700'
          }`}>
            {score.skillLevel || result.skillLevel || 'N/A'}
          </div>

          {/* Readiness (cert only) */}
          {(score.readiness !== null && score.readiness !== undefined) && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <Shield className="w-4 h-4 inline mr-1" />
              Indice de preparation: <strong>{score.readiness}%</strong> — {score.readinessLevel || result.readinessLevel}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{score.correct || result.totalScore || 0}</p>
            <p className="text-xs text-gray-500">Correct</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{score.total || result.maxScore || 0}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" />
              {result.timeTakenSeconds ? `${Math.floor(result.timeTakenSeconds / 60)}m` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">Duree</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1">
              <Eye className="w-4 h-4" /> {result.tabSwitches || 0}
            </p>
            <p className="text-xs text-gray-500">Sorties tab</p>
          </div>
        </div>

        {/* Domain breakdown */}
        {Object.keys(domains).length > 0 && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Bilan par domaine
            </h3>
            <div className="space-y-3">
              {Object.entries(domains).map(([code, d]: [string, any]) => {
                const domainLabel = (trackDomains as any)?.[code] || code;
                const domPct = d.pct || 0;
                const barColor = domPct >= 80 ? 'bg-green-500' : domPct >= 60 ? 'bg-blue-500' : domPct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div key={code}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                        <strong className="text-xs text-gray-400 mr-1">{code}</strong>
                        {domainLabel}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {domPct}% <span className="text-xs text-gray-400 font-normal">({d.correct}/{d.total})</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${domPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certificate */}
        {result.certCode && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">Attestation verifiable</p>
                <p className="font-mono text-sm text-green-600">{result.certCode}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/verify/${result.certCode}`)}
              className="text-sm text-green-600 hover:underline flex items-center gap-1"
            >
              Verifier <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Locked result */}
        {!result.unlocked && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-center gap-3">
            <Lock className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-400">Bilan verrouille</p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                Debloquez le bilan complet et l'attestation en choisissant une offre.
              </p>
              <button
                onClick={() => router.push('/shop')}
                className="mt-2 text-sm text-blue-600 hover:underline font-medium"
              >
                Voir les offres
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => router.push('/skills')}
            className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200"
          >
            Passer un autre test
          </button>
          <button
            onClick={() => router.push('/skills/results/' + attemptId)}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Voir l'historique
          </button>
        </div>
      </div>
    </div>
  );
}
