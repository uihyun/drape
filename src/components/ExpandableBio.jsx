import { useLayoutEffect, useRef, useState } from 'react';
import { useLocale } from '../hooks/useLocale.jsx';

// Profile bio that clamps to 2 lines and offers a "Show more" toggle
// when the text would overflow. Measures the rendered element so we
// don't have to guess at character-to-line ratios across CJK / Latin.
export function ExpandableBio({ text }) {
  const { t } = useLocale();
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  if (!text) return null;

  return (
    <div className="profile-bio-wrap">
      <p ref={ref} className={`profile-bio${expanded ? ' expanded' : ''}`}>{text}</p>
      {(overflowing || expanded) && (
        <button
          type="button"
          className="profile-bio-toggle"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? t('showLess') : t('showMore')}
        </button>
      )}
    </div>
  );
}

export default ExpandableBio;
