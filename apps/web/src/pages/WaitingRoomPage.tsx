import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SessionInfoResponse,
} from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { Copy, Share2, Play, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function WaitingRoomPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfoResponse | null>(null);
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!code) {
      return;
    }

    // Get stored credentials
    const stored = localStorage.getItem(`dabb-${code}`);
    if (!stored) {
      // Redirect to home with session code pre-filled for joining
      navigate(`/?join=${encodeURIComponent(code)}`);
      return;
    }

    const { secretId, playerIndex } = JSON.parse(stored);
    setIsHost(playerIndex === 0);

    // Fetch session info
    fetch(`${API_URL}/sessions/${code}`)
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch((err) => setError(err.message));

    // Connect socket
    const newSocket: GameSocket = io(API_URL, {
      auth: { secretId, sessionId: code },
    });

    newSocket.on('connect', () => {
      // Connection established
    });

    newSocket.on('player:joined', () => {
      // Refresh session info
      fetch(`${API_URL}/sessions/${code}`)
        .then((res) => res.json())
        .then((data) => setSession(data));
    });

    newSocket.on('player:left', () => {
      fetch(`${API_URL}/sessions/${code}`)
        .then((res) => res.json())
        .then((data) => setSession(data));
    });

    newSocket.on('player:reconnected', () => {
      fetch(`${API_URL}/sessions/${code}`)
        .then((res) => res.json())
        .then((data) => setSession(data));
    });

    newSocket.on('game:events', ({ events }) => {
      // Check if game started
      const gameStarted = events.some((e) => e.type === 'GAME_STARTED');
      if (gameStarted) {
        navigate(`/game/${code}/play`);
      }
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [code, navigate]);

  const handleStartGame = () => {
    if (socket && session && session.players.length === session.playerCount) {
      socket.emit('game:start');
    }
  };

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
    }
  };

  const shareUrl = async () => {
    if (!code) {
      return;
    }

    const url = `${window.location.origin}/game/${code}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${t('home.title')} - ${t('home.subtitle')}`,
          text: t('waitingRoom.shareMessage'),
          url,
        });
      } catch {
        // User cancelled or share failed, ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (!session) {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '4rem auto', textAlign: 'center' }}>
        {error ? <p className="error">{error}</p> : <p>{t('common.loading')}</p>}
      </div>
    );
  }

  const canStart = session.players.length === session.playerCount;

  return (
    <div className="card" style={{ maxWidth: 500, margin: '4rem auto' }}>
      <h2>{t('waitingRoom.title')}</h2>

      <div
        style={{
          background: 'var(--bg-input)',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('waitingRoom.gameCode')}
          </p>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{code}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={copyCode}>
            <Copy size={16} /> {t('common.copy')}
          </button>
          <button className="secondary" onClick={shareUrl}>
            <Share2 size={16} /> {t('common.share')}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3>
          {t('common.players')} ({session.players.length}/{session.playerCount})
        </h3>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}
        >
          {Array.from({ length: session.playerCount }).map((_, i) => {
            const player = session.players.find((p) => p.playerIndex === i);
            return (
              <div
                key={i}
                style={{
                  background: 'var(--bg-input)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  {player ? player.nickname : `(${t('waitingRoom.waitingForPlayers')})`}
                  {i === 0 && ` (${t('waitingRoom.host')})`}
                </span>
                {player?.connected && (
                  <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>
                    {t('common.connected')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {isHost && (
        <button onClick={handleStartGame} disabled={!canStart} style={{ width: '100%' }}>
          {canStart ? (
            <>
              <Play size={16} /> {t('waitingRoom.startGame')}
            </>
          ) : (
            <>
              <Loader2 size={16} className="animate-spin" />{' '}
              {t('waitingRoom.waitingForPlayersCount', {
                count: session.playerCount - session.players.length,
              })}
            </>
          )}
        </button>
      )}

      {!isHost && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('waitingRoom.waitingForHost')}
        </p>
      )}
    </div>
  );
}

export default WaitingRoomPage;
