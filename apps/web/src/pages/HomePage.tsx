import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PlayerCount } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useVersionCheck } from '@dabb/ui-shared';
import { Plus, UserPlus, ArrowLeft, Users, Loader2, BookOpen, Info } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import InfoModal from '../components/InfoModal';
import UpdateRequiredOverlay from '../components/UpdateRequiredOverlay';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinCodeFromUrl = searchParams.get('join');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(joinCodeFromUrl ? 'join' : 'menu');
  const [nickname, setNickname] = useState(() => localStorage.getItem('dabb-nickname') || '');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [joinCode, setJoinCode] = useState(joinCodeFromUrl || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const { needsUpdate } = useVersionCheck({
    currentVersion: APP_VERSION,
    serverBaseUrl: API_URL,
  });

  // Update state when URL changes
  useEffect(() => {
    if (joinCodeFromUrl) {
      setMode('join');
      setJoinCode(joinCodeFromUrl);
    }
  }, [joinCodeFromUrl]);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
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

      localStorage.setItem('dabb-nickname', nickname.trim());
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
      const res = await fetch(`${API_URL}/api/sessions/${joinCode.trim()}/join`, {
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

      localStorage.setItem('dabb-nickname', nickname.trim());
      navigate(`/game/${joinCode.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'menu') {
    return (
      <>
        <div className="card" style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <LanguageSwitcher />
          </div>
          <h1 style={{ marginBottom: '2rem' }}>{t('home.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {t('home.subtitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button onClick={() => setMode('create')}>
              <Plus size={18} /> {t('home.createGame')}
            </button>
            <button className="secondary" onClick={() => setMode('join')}>
              <UserPlus size={18} /> {t('home.joinGame')}
            </button>
            <button className="secondary" onClick={() => navigate('/rules')}>
              <BookOpen size={18} /> {t('rules.title')}
            </button>
            <button className="secondary" onClick={() => setShowInfo(true)}>
              <Info size={18} /> {t('info.title')}
            </button>
          </div>
          <img
            src="/ki-schlonz-stamp.svg"
            alt="100% KI-Schlonz"
            style={{ width: 120, height: 120, marginTop: '1.5rem', opacity: 0.9 }}
          />
        </div>
        {showInfo && <InfoModal version={APP_VERSION} onClose={() => setShowInfo(false)} />}
        <UpdateRequiredOverlay visible={needsUpdate} />
      </>
    );
  }

  return (
    <>
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
                  <Users size={16} /> {count}
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
            <ArrowLeft size={16} /> {t('common.back')}
          </button>
          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {t('common.loading')}
              </>
            ) : mode === 'create' ? (
              <>
                <Plus size={16} /> {t('home.create')}
              </>
            ) : (
              <>
                <UserPlus size={16} /> {t('home.join')}
              </>
            )}
          </button>
        </div>
      </div>
      <UpdateRequiredOverlay visible={needsUpdate} />
    </>
  );
}

export default HomePage;
