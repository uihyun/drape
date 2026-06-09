import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { FollowService } from '../services/follow-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from './Avatar.jsx';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Slide-up sheet listing the people who follow / are followed by `uid`.
// `kind` = 'followers' | 'following'. Tapping a row jumps to that
// person's public profile. Loads paginated; first 30 cover most cases.
export function FollowListSheet({ open, uid, kind, onClose }) {
  const { t } = useLocale();
  const [profiles, setProfiles] = useState(null);

  useEffect(() => {
    if (!open || !uid) return;
    let cancelled = false;
    setProfiles(null);
    const fetch = kind === 'followers' ? FollowService.listFollowers : FollowService.listFollowing;
    fetch(uid)
      .then(async ({ uids }) => {
        if (!uids?.length) { if (!cancelled) setProfiles([]); return; }
        const map = await ProfileService.getProfilesByUids(uids);
        if (cancelled) return;
        // Drop ghosts: a deleted account can leave a handle-less profile shell
        // (or a dangling follow edge). No handle → the row can't navigate
        // anywhere, so hide it instead of rendering a dead "@" entry.
        setProfiles(uids.map(u => map.get(u)).filter(p => p && p.handle));
      })
      .catch((err) => {
        console.warn('follow list fetch failed:', err?.code, err?.message);
        if (!cancelled) setProfiles([]);
      });
    return () => { cancelled = true; };
  }, [open, uid, kind]);

  const { sheetStyle, handleProps } = useSheetDrag(onClose);

  if (!open) return null;

  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet follow-sheet" style={sheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab' }} />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title">{t(kind)}</h3>

        {profiles === null ? (
          <div className="loading"><div className="spinner" /></div>
        ) : profiles.length === 0 ? (
          <p className="follow-sheet-empty">{t(kind === 'followers' ? 'followersEmpty' : 'followingEmpty')}</p>
        ) : (
          <ul className="follow-sheet-list">
            {profiles.map(p => (
              <li key={p.uid}>
                <Link to={`/u/${p.handle}`} className="follow-sheet-row" onClick={onClose}>
                  <Avatar src={p.photoURL} name={p.displayName || p.handle} size={40} />
                  <div className="follow-sheet-meta">
                    <span className="follow-sheet-name">{p.displayName || p.handle}</span>
                    <span className="follow-sheet-handle">@{p.handle}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default FollowListSheet;
