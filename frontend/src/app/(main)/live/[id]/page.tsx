'use client';
// ============================================================================
// AU-IBAR Learning — BBB Live Session Room
// Embedded iframe with info bar, leave button, attendance tracking
// Renders as fixed fullscreen overlay to escape the main layout
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Clock, Video, Loader2,
  Maximize2, Minimize2, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { liveApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionData {
  id: string;
  title: Record<string, string>;
  status: string;
  trainer_first_name: string;
  trainer_last_name: string;
  duration_minutes: number;
  current_attendees?: number;
  max_participants: number;
  scheduled_at: string;
  recording_url?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LiveRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const joinedAtRef = useRef<number>(Date.now());

  // Fetch session details
  useEffect(() => {
    if (!token || !sessionId) return;

    (async () => {
      try {
        const res: any = await liveApi.get(token, sessionId);
        const sess = res.data;
        setSession(sess);

        if (sess.status === 'live' || sess.status === 'scheduled') {
          const joinRes: any = await liveApi.join(token, sessionId);
          setJoinUrl(joinRes.data.joinUrl);
          joinedAtRef.current = Date.now();
        } else if (sess.recording_url) {
          try {
            const streamRes: any = await liveApi.streamUrl(token, sessionId);
            setStreamUrl(streamRes.data.streamUrl);
          } catch {
            setStreamUrl(sess.recording_url);
          }
        } else {
          setError('Cette session est terminée et aucun replay n\'est disponible.');
        }
      } catch (err: any) {
        setError(err.message || 'Impossible de charger la session');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, sessionId]);

  // Elapsed time counter
  useEffect(() => {
    if (!joinUrl) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - joinedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [joinUrl]);

  const handleLeave = useCallback(() => {
    router.push('/live');
  }, [router]);

  const toggleFullscreen = useCallback(() => {
    if (!iframeContainerRef.current) return;
    if (!document.fullscreenElement) {
      iframeContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const title = session
    ? (typeof session.title === 'string' ? session.title : (session.title.fr || session.title.en || ''))
    : '';

  // Render as fixed fullscreen overlay to escape the main layout
  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-navy dark:text-brand-gold mx-auto" />
            <p className="text-sm text-gray-400">Connexion &agrave; la session...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-semibold text-white">Impossible de rejoindre</h2>
            <p className="text-sm text-gray-400">{error}</p>
            <button
              onClick={() => router.push('/live')}
              className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy-deep transition-colors"
            >
              Retour aux sessions
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Info bar */}
          <motion.header
            initial={{ y: -48 }}
            animate={{ y: 0 }}
            className={clsx(
              'h-12 flex items-center justify-between px-4 shrink-0',
              'bg-gray-900 text-white border-b border-gray-800',
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleLeave}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors shrink-0"
                title="Quitter la session"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {session?.status === 'live' && (
                <span className="flex items-center gap-1.5 bg-red-500 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              )}

              <h1 className="text-sm font-semibold truncate">{title}</h1>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-400 shrink-0">
              {session && (
                <>
                  <span className="hidden sm:flex items-center gap-1">
                    <Video className="w-3.5 h-3.5" />
                    {session.trainer_first_name} {session.trainer_last_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {session.current_attendees || '—'}
                  </span>
                  {joinUrl && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatElapsed(elapsed)}
                    </span>
                  )}
                </>
              )}

              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded hover:bg-gray-800 transition-colors"
                title="Plein écran"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={handleLeave}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold transition-colors"
              >
                Quitter
              </button>
            </div>
          </motion.header>

          {/* BBB iframe / Recording player */}
          <div ref={iframeContainerRef} className="flex-1 relative bg-black">
            {joinUrl ? (
              <iframe
                src={joinUrl}
                className="absolute inset-0 w-full h-full border-0"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                allowFullScreen
              />
            ) : streamUrl ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <video
                  src={streamUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-full"
                >
                  Votre navigateur ne supporte pas la lecture vidéo.
                </video>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-500">Aucun contenu disponible</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
