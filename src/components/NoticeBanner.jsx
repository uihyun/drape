import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.jsx';
import { getRemoteNotice, onRemoteCopy } from '../services/remote-copy.js';
import { OnboardHint } from './OnboardHint.jsx';

// Server-driven announcement banner (config/copy.notice, edited in /admin →
// Config). Reuses OnboardHint's chrome + localStorage gate: the storage key
// carries the notice id, so publishing a NEW id re-shows the banner for
// everyone while an edited text under the same id stays dismissed for those
// who closed it.
export function NoticeBanner() {
  const { lang } = useLocale();
  const navigate = useNavigate();
  const [, setRev] = useState(0);
  useEffect(() => onRemoteCopy(() => setRev((r) => r + 1)), []);

  const n = getRemoteNotice();
  if (!n) return null;
  const text = n.text[lang] || n.text.en || Object.values(n.text)[0];
  const label = n.link ? (n.linkLabel?.[lang] || n.linkLabel?.en || n.link) : null;
  const open = () => {
    if (!n.link) return;
    if (n.link.startsWith('/')) navigate(n.link);
    else window.open(n.link, '_blank', 'noopener');
  };
  return (
    <OnboardHint
      key={n.id}
      storageKey={`notice_${n.id}`}
      text={text}
      ctaLabel={label}
      onCta={open}
    />
  );
}

export default NoticeBanner;
