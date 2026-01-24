import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerCount } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [nickname, setNickname] = useState('');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(4);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
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
        throw new Error(data.error || t('errors.createFailed'));
      }

      const data = await res.json();

      // Store credentials
      localStorage.setItem(
        `dabb-${data.sessionCode}`,
        JSON.stringify({
          secretId: data.secretId,
          playerId: data.playerId,
          playerIndex: data.playerIndex,
        })
      );

      navigate(`/game/${data.sessionCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }

    if (!joinCode.trim()) {
      setError(t('errors.enterGameCode'));
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
        throw new Error(data.error || t('errors.joinFailed'));
      }

      const data = await res.json();

      // Store credentials
      localStorage.setItem(
        `dabb-${joinCode.trim()}`,
        JSON.stringify({
          secretId: data.secretId,
          playerId: data.playerId,
          playerIndex: data.playerIndex,
        })
      );

      navigate(`/game/${joinCode.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'menu') {
    return (
      <div className="card" style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <LanguageSwitcher />
        </div>
        <h1 style={{ marginBottom: '2rem' }}>{t('home.title')}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t('home.subtitle')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={() => setMode('create')}>{t('home.createGame')}</button>
          <button className="secondary" onClick={() => setMode('join')}>
            {t('home.joinGame')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: '4rem auto' }}>
      <h2>{mode === 'create' ? t('home.newGame') : t('home.joinGame')}</h2>

      <div className="form-group">
        <label>{t('home.nickname')}</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t('home.nicknamePlaceholder')}
          maxLength={20}
        />
      </div>

      {mode === 'create' && (
        <div className="form-group">
          <label>{t('home.playerCount')}</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {([2, 3, 4] as PlayerCount[]).map((count) => (
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
          <label>{t('home.gameCode')}</label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder={t('home.gameCodePlaceholder')}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button className="secondary" onClick={() => setMode('menu')}>
          {t('common.back')}
        </button>
        <button
          onClick={mode === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? t('common.loading') : mode === 'create' ? t('home.create') : t('home.join')}
        </button>
      </div>
    </div>
  );
}

export default HomePage;
