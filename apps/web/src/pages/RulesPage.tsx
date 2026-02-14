import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation, getRulesMarkdown, type SupportedLanguage } from '@dabb/i18n';
import { ArrowLeft } from 'lucide-react';

function RulesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const markdown = getRulesMarkdown(i18n.language as SupportedLanguage);

  return (
    <div className="card rules-page" style={{ maxWidth: 700, margin: '2rem auto' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}
      >
        <button
          className="secondary"
          onClick={() => navigate('/')}
          style={{ padding: '0.5rem 0.75rem' }}
        >
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <h1 style={{ margin: 0 }}>{t('rules.title')}</h1>
      </div>
      <div className="rules-content">
        <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
      </div>
    </div>
  );
}

export default RulesPage;
