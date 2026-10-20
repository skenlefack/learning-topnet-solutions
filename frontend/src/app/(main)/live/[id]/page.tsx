'use client';
// ============================================================================
// Topnet Solutions Academy — Enhanced BBB Live Session Room
// Pre-join lobby with device preview, enriched header, session sidebar,
// embedded iframe with controls, recording player
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  ArrowLeft, Users, Clock, Video, Loader2,
  AlertTriangle, Mic, MicOff, Camera, CameraOff, Monitor,
  Info, X, Calendar, Play,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { liveApi } from '@/lib/api';

function getLocalText(t: any, lang = 'fr'): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRE-JOIN LOBBY
// ═══════════════════════════════════════════════════════════════════════════

function PreJoinLobby({
  session, onJoin, onBack,
}: {
  session: any;
  onJoin: (opts: { audioEnabled: boolean; videoEnabled: boolean }) => void;
  onBack: () => void;
}) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }>({ audio: [], video: [] });
  const [permError, setPermError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;

        const devs = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          audio: devs.filter(d => d.kind === 'audioinput'),
          video: devs.filter(d => d.kind === 'videoinput'),
        });
      } catch {
        if (!cancelled) setPermError(true);
      }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = audioEnabled; });
  }, [audioEnabled, stream]);

  useEffect(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = videoEnabled; });
  }, [videoEnabled, stream]);

  const handleJoin = () => {
    stream?.getTracks().forEach(t => t.stop());
    onJoin({ audioEnabled, videoEnabled });
  };

  const title = getLocalText(session.title);
  const scheduledAt = new Date(session.scheduled_at);

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image src="/logo-topnet.jpg" alt="" width={120} height={120} className="w-[120px] h-auto" />
            <span className="text-white/50 text-sm">Topnet Solutions Academy</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-1">{title}</h1>
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
            <Video className="w-3.5 h-3.5" /> {session.trainer_first_name} {session.trainer_last_name}
            <span className="text-gray-600">|</span>
            <Calendar className="w-3.5 h-3.5" />
            {scheduledAt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' '}{scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Preview card */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
          {/* Video preview */}
          <div className="relative aspect-video bg-gray-800 flex items-center justify-center">
            {videoEnabled && !permError ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-brand-navy/30 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-white">
                    {user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '?'}
                  </span>
                </div>
                {permError && (
                  <p className="text-xs text-amber-400 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Autorisez l'accès caméra/micro dans votre navigateur
                  </p>
                )}
              </div>
            )}

            {/* Audio level indicator */}
            {audioEnabled && stream && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 text-xs text-white">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>Micro actif</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 p-5">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                audioEnabled
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white',
              )}
              title={audioEnabled ? 'Couper le micro' : 'Activer le micro'}
            >
              {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setVideoEnabled(!videoEnabled)}
              className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                videoEnabled
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white',
              )}
              title={videoEnabled ? 'Couper la caméra' : 'Activer la caméra'}
            >
              {videoEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
            </button>
          </div>

          {/* Device info */}
          <div className="px-5 pb-3 text-[10px] text-gray-500 text-center">
            {devices.audio.length > 0 && `${devices.audio.length} micro(s)`}
            {devices.audio.length > 0 && devices.video.length > 0 && ' — '}
            {devices.video.length > 0 && `${devices.video.length} caméra(s)`}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 inline mr-1" /> Retour
          </button>
          <button
            onClick={handleJoin}
            className="px-8 py-2.5 rounded-xl text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Rejoindre la session
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION INFO SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════

function SessionSidebar({
  session, elapsed, onClose,
}: {
  session: any;
  elapsed: number;
  onClose: () => void;
}) {
  const title = getLocalText(session.title);
  const courseTitle = getLocalText(session.course_title);
  const scheduledAt = new Date(session.scheduled_at);

  return (
    <motion.div
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 z-20 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Informations</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-800"><X className="w-4 h-4 text-gray-400" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Session info */}
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Session</h4>
          <p className="text-sm font-medium text-white">{title}</p>
          {courseTitle && <p className="text-xs text-gray-500 mt-1">{courseTitle}</p>}
        </div>

        {/* Trainer */}
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Formateur</h4>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-navy/30 flex items-center justify-center text-xs font-bold text-white">
              {session.trainer_first_name?.[0]}{session.trainer_last_name?.[0]}
            </div>
            <span className="text-sm text-white">{session.trainer_first_name} {session.trainer_last_name}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Participants</span>
            <span className="text-white font-medium">{session.current_attendees || 0} / {session.max_participants}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Durée prévue</span>
            <span className="text-white font-medium">{session.duration_minutes} min</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Planifié le</span>
            <span className="text-white font-medium">{scheduledAt.toLocaleDateString('fr-FR')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Heure</span>
            <span className="text-white font-medium">{scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Temps écoulé</span>
            <span className="text-brand-gold font-mono font-medium">{formatElapsed(elapsed)}</span>
          </div>
        </div>

        {/* BBB Features Guide */}
        <div className="pt-3 border-t border-gray-800 space-y-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Fonctionnalités</h4>
          <div className="space-y-1.5 text-[11px] text-gray-500">
            <p>💬 Chat public et privé</p>
            <p>🖥️ Partage d'écran (formateur)</p>
            <p>📹 Caméra activable/désactivable</p>
            <p>🎤 Micro avec lever la main</p>
            <p>📊 Présentations et tableaux blancs</p>
            <p>🔴 Enregistrement automatique</p>
            <p>📝 Notes partagées</p>
            <p>📋 Sondages en direct</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function LiveRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const sessionId = params.id as string;

  const [session, setSession] = useState<any | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'prejoin' | 'live' | 'recording' | 'error'>('loading');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const joinedAtRef = useRef<number>(Date.now());

  // Fetch session
  useEffect(() => {
    if (!token || !sessionId) return;
    (async () => {
      try {
        const res: any = await liveApi.get(token, sessionId);
        const sess = res.data;
        setSession(sess);

        const endTime = new Date(sess.scheduled_at).getTime() + sess.duration_minutes * 60000;
        const isExpired = sess.status === 'ended' && Date.now() > endTime;

        if (!isExpired && (sess.status === 'live' || sess.status === 'scheduled')) {
          setPhase('prejoin');
        } else if (sess.recording_url) {
          try {
            const streamRes: any = await liveApi.streamUrl(token, sessionId);
            setStreamUrl(streamRes.data.streamUrl);
          } catch {
            setStreamUrl(sess.recording_url);
          }
          setPhase('recording');
        } else {
          setError(isExpired
            ? 'Cette session est terminée. Aucun enregistrement n\'est disponible pour le moment.'
            : 'Cette session est terminée et aucun replay n\'est disponible.');
          setPhase('error');
        }
      } catch (err: any) {
        setError(err.message || 'Impossible de charger la session');
        setPhase('error');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, sessionId]);

  // Join handler (called from PreJoinLobby)
  // Opens BBB in a new tab — BBB does not allow iframe embedding (X-Frame-Options)
  const handleJoin = useCallback(async (opts: { audioEnabled: boolean; videoEnabled: boolean }) => {
    if (!token) return;
    try {
      const joinRes: any = await liveApi.join(token, sessionId);
      const url = joinRes.data.joinUrl;
      setJoinUrl(url);
      joinedAtRef.current = Date.now();
      setPhase('live');
      // Open BBB in a new tab — iframe embedding is blocked by BBB's own headers
      const bbbWindow = window.open(url, '_blank', 'noopener');
      if (!bbbWindow) {
        // Popup blocked — fallback: redirect in same tab
        window.location.href = url;
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de rejoindre');
      setPhase('error');
    }
  }, [token, sessionId]);

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'live') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - joinedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleLeave = useCallback(() => router.push('/live'), [router]);

  const title = session ? getLocalText(session.title, language) : '';

  // ── Loading ──
  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-gold mx-auto" />
          <p className="text-sm text-gray-400">Connexion à la session...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (phase === 'error') {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-white">Impossible de rejoindre</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button onClick={() => router.push('/live')} className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy-deep">
            Retour aux sessions
          </button>
        </div>
      </div>
    );
  }

  // ── Pre-Join Lobby ──
  if (phase === 'prejoin' && session) {
    return <PreJoinLobby session={session} onJoin={handleJoin} onBack={handleLeave} />;
  }

  // ── Recording Playback ──
  if (phase === 'recording' && streamUrl) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col">
        <header className="h-12 flex items-center justify-between px-4 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleLeave} className="p-1.5 rounded-lg hover:bg-gray-800"><ArrowLeft className="w-4 h-4 text-white" /></button>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700 text-gray-300">REPLAY</span>
            <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center bg-black">
          <video src={streamUrl} controls autoPlay className="max-w-full max-h-full">
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        </div>
      </div>
    );
  }

  // ── Live Session ──
  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col">
      {/* Enhanced header */}
      <motion.header
        initial={{ y: -48 }}
        animate={{ y: 0 }}
        className="h-12 flex items-center justify-between px-3 bg-gray-900 text-white border-b border-gray-800 shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={handleLeave} className="p-1.5 rounded-lg hover:bg-gray-800 shrink-0" title="Quitter">
            <ArrowLeft className="w-4 h-4" />
          </button>
          {session?.status === 'live' && (
            <span className="flex items-center gap-1 bg-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN DIRECT
            </span>
          )}
          <h1 className="text-sm font-semibold truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Session stats */}
          <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 mr-2">
            <Users className="w-3.5 h-3.5" /> {session?.current_attendees || '—'}
          </span>
          <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400 mr-2">
            <Clock className="w-3.5 h-3.5" /> {formatElapsed(elapsed)}
          </span>

          {/* Controls */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={clsx('p-2 rounded-lg transition-colors', sidebarOpen ? 'bg-gray-700' : 'hover:bg-gray-800')}
            title="Informations"
          >
            <Info className="w-4 h-4" />
          </button>
          <button onClick={handleLeave} className="ml-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold transition-colors">
            Quitter
          </button>
        </div>
      </motion.header>

      {/* Content area — BBB runs in a separate tab */}
      <div className="flex-1 relative bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto px-4">
          {/* Live pulse animation */}
          <div className="relative mx-auto w-24 h-24">
            <span className="absolute inset-0 rounded-full bg-red-600/20 animate-ping" />
            <span className="relative flex items-center justify-center w-24 h-24 rounded-full bg-red-600/30">
              <Video className="w-10 h-10 text-red-400" />
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-2">Session en cours</h2>
            <p className="text-sm text-gray-400">
              La session BBB est ouverte dans un autre onglet.<br />
              Gardez cet onglet ouvert pour le suivi de votre participation.
            </p>
          </div>

          {/* Elapsed timer */}
          <div className="flex items-center justify-center gap-2 text-brand-gold">
            <Clock className="w-5 h-5" />
            <span className="text-lg font-mono font-semibold">{formatElapsed(elapsed)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                if (joinUrl) {
                  const w = window.open(joinUrl, '_blank', 'noopener');
                  if (!w) window.location.href = joinUrl;
                }
              }}
              className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-semibold hover:bg-brand-navy-deep transition-colors flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" /> Rejoindre à nouveau
            </button>
            <button
              onClick={handleLeave}
              className="px-5 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-xl transition-colors"
            >
              Quitter la session
            </button>
          </div>

          {/* Session info summary */}
          {session && (
            <div className="pt-4 border-t border-gray-800 text-xs text-gray-500 space-y-1">
              <p>{session.trainer_first_name} {session.trainer_last_name} — {session.current_attendees || 0} participant(s)</p>
              <p>{session.duration_minutes} min prévues</p>
            </div>
          )}
        </div>

        {/* Session sidebar */}
        <AnimatePresence>
          {sidebarOpen && session && (
            <SessionSidebar
              session={session}
              elapsed={elapsed}
              onClose={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
