import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerCount } from '@dabb/shared-types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [nickname, setNickname] = useState('');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(4);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError('Bitte gib einen Spitznamen ein');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerCount,
          nickname: nickname.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Erstellen');
      }

      const data = await res.json();

      // Store credentials
      localStorage.setItem(`dabb-${data.sessionCode}`, JSON.stringify({
        secretId: data.secretId,
        playerId: data.playerId,
        playerIndex: data.playerIndex,
      }));

      navigate(`/game/${data.sessionCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError('Bitte gib einen Spitznamen ein');
      return;
    }

    if (!joinCode.trim()) {
      setError('Bitte gib einen Spielcode ein');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/sessions/${joinCode.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Beitreten');
      }

      const data = await res.json();

      // Store credentials
      localStorage.setItem(`dabb-${joinCode.trim()}`, JSON.stringify({
        secretId: data.secretId,
        playerId: data.playerId,
        playerIndex: data.playerIndex,
      }));

      navigate(`/game/${joinCode.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'menu') {
    return (
      <div className="card" style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '2rem' }}>Dabb</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Binokel Online
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={() => setMode('create')}>
            Neues Spiel erstellen
          </button>
          <button className="secondary" onClick={() => setMode('join')}>
            Spiel beitreten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: '4rem auto' }}>
      <h2>{mode === 'create' ? 'Neues Spiel' : 'Spiel beitreten'}</h2>

      <div className="form-group">
        <label>Dein Spitzname</label>
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="z.B. Hans"
          maxLength={20}
        />
      </div>

      {mode === 'create' && (
        <div className="form-group">
          <label>Spieleranzahl</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {([2, 3, 4] as PlayerCount[]).map(count => (
              <button
                key={count}
                className={playerCount === count ? '' : 'secondary'}
                onClick={() => setPlayerCount(count)}
                style={{ flex: 1 }}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="form-group">
          <label>Spielcode</label>
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="z.B. schnell-fuchs-42"
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button className="secondary" onClick={() => setMode('menu')}>
          Zurück
        </button>
        <button
          onClick={mode === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? 'Laden...' : mode === 'create' ? 'Erstellen' : 'Beitreten'}
        </button>
      </div>
    </div>
  );
}

export default HomePage;
