'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { ArrowLeft, Play, Clock, HelpCircle, Award, Lock, ShoppingBag } from 'lucide-react';

export default function SkillTrackDetailPage() {
  const { track: trackCode } = useParams<{ track: string }>();
  const [track, setTrack] = useState<any>(null);
  const [formats, setFormats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    Promise.all([skillsApi.track(trackCode), skillsApi.formats()])
      .then(([t, f]) => {
        setTrack(t.data);
        const applicable = (f.data || []).filter((fmt: any) =>
          fmt.applicable_to?.includes(t.data?.kind),
        );
        setFormats(applicable);
        if (applicable.length > 0) setSelectedFormat(applicable[0].code);
      })
      .catch(() => setError('Track not found'))
      .finally(() => setLoading(false));
  }, [trackCode]);

  const handleStart = async () => {
    if (!token) {
      router.push('/login?redirect=/skills/' + trackCode);
      return;
    }
    setStarting(true);
    setError('');
    try {
      const res = await skillsApi.start(token, { trackCode, format: selectedFormat });
      if (res.success && res.data) {
        sessionStorage.setItem('skill-test', JSON.stringify(res.data));
        // Navigate to dedicated test environment (outside main layout)
        router.push(`/test/${trackCode}`);
      }
    } catch (err: any) {
      if (err.message?.includes('payment_required') || err.message?.includes('402')) {
        setError('Vous devez acheter des credits pour passer ce test.');
      } else {
        setError(err.message || 'Erreur lors du demarrage du test');
      }
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        Parcours introuvable
      </div>
    );
  }

  const domains = track.domains || {};
  const isCert = track.kind === 'cert';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {track.name?.fr || track.code}
            </h1>
            {track.exam_code && (
              <p className="text-sm text-blue-500 font-mono mt-1">{track.exam_code} — {track.vendor}</p>
            )}
          </div>
          {isCert && <Award className="w-8 h-8 text-yellow-500" />}
        </div>

        {track.description?.fr && (
          <p className="text-gray-600 dark:text-gray-400 mb-6">{track.description.fr}</p>
        )}

        {/* Domains */}
        <div className="mb-6">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">
            Domaines couverts ({Object.keys(domains).length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(domains).map(([code, label]) => (
              <span key={code} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-300">
                <strong>{code}</strong> — {label as string}
              </span>
            ))}
          </div>
        </div>

        {/* Format selection */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Choisir un format de test
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {formats.map((fmt: any) => (
              <button
                key={fmt.code}
                onClick={() => setSelectedFormat(fmt.code)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedFormat === fmt.code
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {fmt.label?.fr || fmt.code}
                  </span>
                  {fmt.is_free ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Gratuit</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Payant
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {fmt.question_count > 0 && (
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> {fmt.question_count} questions
                    </span>
                  )}
                  {fmt.duration_sec > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {Math.round(fmt.duration_sec / 60)} min
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
            {error.includes('credits') && (
              <button onClick={() => router.push('/shop')} className="underline ml-2 font-medium flex items-center gap-1 mt-1">
                <ShoppingBag className="w-3.5 h-3.5" /> Voir les offres
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting || !selectedFormat}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {starting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <Play className="w-5 h-5" />
              {token ? 'Commencer le test' : 'Se connecter pour commencer'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
