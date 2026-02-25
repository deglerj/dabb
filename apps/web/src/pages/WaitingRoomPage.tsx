import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import type {
  AIDifficulty,
  ClientToServerEvents,
  ServerToClientEvents,
  SessionInfoResponse,
} from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { Bot, Copy, Loader2, Play, Share2, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const AI_DIFFICULTIES: AIDifficulty[] = ['easy', 'medium', 'hard'];

function WaitingRoomPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfoResponse | null>(null);
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [secretId, setSecretId] = useState<string | null>(null);
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [addAIDifficulty, setAddAIDifficulty] = useState<AIDifficulty>('medium');

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

    const { secretId: storedSecretId, playerIndex } = JSON.parse(stored);
    setSecretId(storedSecretId);
    setIsHost(playerIndex === 0);

    // Fetch session info
    fetch(`${API_URL}/api/sessions/${code}`)
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch((err) => setError(err.message));

    // Connect socket
    const newSocket: GameSocket = io(API_URL, {
      auth: { secretId: storedSecretId, sessionId: code },
    });

    newSocket.on('connect', () => {
      // Connection established
    });

    newSocket.on('player:joined', () => {
      // Refresh session info
      fetch(`${API_URL}/api/sessions/${code}`)
        .then((res) => res.json())
        .then((data) => setSession(data));
    });

    newSocket.on('player:left', () => {
      fetch(`${API_URL}/api/sessions/${code}`)
        .then((res) => res.json())
        .then((data) => setSession(data));
    });

    newSocket.on('player:reconnected', () => {
      fetch(`${API_URL}/api/sessions/${code}`)
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

  const handleAddAI = async () => {
    if (!code || !secretId || isAddingAI) {
      return;
    }

    setIsAddingAI(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/sessions/${code}/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Id': secretId,
        },
        body: JSON.stringify({ difficulty: addAIDifficulty }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to add AI player');
        return;
      }

      // Refresh session info
      const sessionResponse = await fetch(`${API_URL}/api/sessions/${code}`);
      const sessionData = await sessionResponse.json();
      setSession(sessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add AI player');
    } finally {
      setIsAddingAI(false);
    }
  };

  const handleRemoveAI = async (playerIndex: number) => {
    if (!code || !secretId) {
      return;
    }

    setError('');

    try {
      const response = await fetch(`${API_URL}/api/sessions/${code}/ai/${playerIndex}`, {
        method: 'DELETE',
        headers: {
          'X-Secret-Id': secretId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to remove AI player');
        return;
      }

      // Refresh session info
      const sessionResponse = await fetch(`${API_URL}/api/sessions/${code}`);
      const sessionData = await sessionResponse.json();
      setSession(sessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove AI player');
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

      <div className="waiting-code-block">
        <div>
          <p className="waiting-code-label">{t('waitingRoom.gameCode')}</p>
          <p className="waiting-code-value">{code}</p>
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
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
          {Array.from({ length: session.playerCount }).map((_, i) => {
            const player = session.players.find((p) => p.playerIndex === i);
            return (
              <div key={i} className="player-entry">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {player?.isAI && <Bot size={16} style={{ color: 'var(--ink-faint)' }} />}
                  {player ? (
                    <span>
                      {player.nickname}
                      {i === 0 && ` (${t('waitingRoom.host')})`}
                      {player.isAI && player.aiDifficulty && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--ink-faint)',
                            marginLeft: '0.25rem',
                          }}
                        >
                          ({player.aiDifficulty})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="player-entry-empty">
                      {`(${t('waitingRoom.waitingForPlayers')})`}
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {player?.connected && !player?.isAI && (
                    <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>
                      {t('common.connected')}
                    </span>
                  )}
                  {isHost && player?.isAI && (
                    <button
                      className="secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => handleRemoveAI(player.playerIndex)}
                    >
                      <X size={14} /> {t('waitingRoom.removeAI')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isHost && session.players.length < session.playerCount && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem' }}>
              {AI_DIFFICULTIES.map((diff) => (
                <button
                  key={diff}
                  className={addAIDifficulty === diff ? '' : 'secondary'}
                  style={{ flex: 1, padding: '0.375rem 0.5rem', fontSize: '0.8rem' }}
                  onClick={() => setAddAIDifficulty(diff)}
                >
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="secondary"
              onClick={handleAddAI}
              disabled={isAddingAI}
              style={{ width: '100%' }}
            >
              {isAddingAI ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}{' '}
              {t('waitingRoom.addAIPlayer')}
            </button>
          </div>
        )}
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
        <p style={{ textAlign: 'center', color: 'var(--ink-mid)' }}>
          {t('waitingRoom.waitingForHost')}
        </p>
      )}
    </div>
  );
}

export default WaitingRoomPage;
