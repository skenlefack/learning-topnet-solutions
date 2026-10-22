'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api';
import { Monitor, Shield, Cloud, Code, Database, Network, Award, Briefcase, ShoppingBag } from 'lucide-react';

const trackIcons: Record<string, any> = {
  SUPPORT: Monitor, SECU: Shield, CLOUD: Cloud, DEV: Code,
  DATA: Database, NET: Network, PM: Briefcase,
};

export default function SkillsCatalogPage() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    skillsApi.tracks()
      .then((res) => setTracks(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const skillTracks = tracks.filter(t => t.kind === 'track');
  const certTracks = tracks.filter(t => t.kind === 'cert');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Tests de niveau IT
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-6">
          Evaluez vos competences en informatique avec des tests professionnels.
          Identifiez vos forces, vos lacunes, et trouvez la formation adaptee.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.push('/shop')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ShoppingBag className="w-4 h-4" /> Voir les offres
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10 max-w-lg mx-auto">
        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">{tracks.length}</p>
          <p className="text-xs text-gray-500">Tests</p>
        </div>
        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">{skillTracks.length}</p>
          <p className="text-xs text-gray-500">Parcours</p>
        </div>
        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">{certTracks.length}</p>
          <p className="text-xs text-gray-500">Certifications</p>
        </div>
      </div>

      {/* Skill Tracks */}
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Parcours metier ({skillTracks.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {skillTracks.map((track) => {
          const Icon = trackIcons[track.code] || Monitor;
          const domainCount = Object.keys(track.domains || {}).length;
          return (
            <div
              key={track.id}
              onClick={() => router.push(`/skills/${track.code}`)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2">
                  {track.name?.fr || track.code}
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                {track.description?.fr || track.role_description?.fr || ''}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{track.question_count} questions</span>
                <span>{domainCount} domaines</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Certifications */}
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Award className="w-5 h-5 text-yellow-500" />
        Examens blancs de certification ({certTracks.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {certTracks.map((track) => {
          const domainCount = Object.keys(track.domains || {}).length;
          return (
            <div
              key={track.id}
              onClick={() => router.push(`/skills/${track.code}`)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                  {track.name?.fr || track.code}
                </h3>
                {track.vendor && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
                    {track.vendor}
                  </span>
                )}
              </div>
              {track.exam_code && (
                <p className="text-xs text-blue-500 font-mono mb-2">{track.exam_code}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{track.question_count} questions</span>
                <span>{domainCount} domaines</span>
                {track.exam_duration_sec && (
                  <span>{Math.round(track.exam_duration_sec / 60)} min</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {tracks.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun test disponible pour le moment.</p>
        </div>
      )}
    </div>
  );
}
