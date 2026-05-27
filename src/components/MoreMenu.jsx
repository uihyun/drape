import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Flag, Ban } from 'lucide-react';
import { ReportModal } from './ReportModal.jsx';
import { BlockService } from '../services/block-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Visitor-facing safety menu. Renders the three-dot button + popover with
// Report (and optional Block) entries — backend infra (reports collection,
// blocks collection) already exists; this is the surface that exposes it.
//
// Props:
//   target = { type: 'item' | 'ootd' | 'board' | 'outfit' | 'profile', id }
//   targetUid — the content owner's uid (required for Block, optional otherwise)
//   user — the viewer
//   onSignIn — sign-in prompt callback (anonymous users can't report/block)
//   showBlock — render the "Block user" entry (true for profiles)
//   className — wrapper class for the trigger button
//   buttonSize — icon size (default 20)
export function MoreMenu({
  target,
  targetUid,
  user,
  onSignIn,
  showBlock = false,
  className = '',
  buttonSize = 20,
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!showBlock || !targetUid) return;
    const unsub = BlockService.subscribeIsBlocked(targetUid, setBlocked);
    return () => unsub && unsub();
  }, [showBlock, targetUid]);

  // Close on outside click. Popover patterns this small don't need a
  // portal — just dismiss when the user clicks anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const requireAuth = () => {
    if (!user || user.isAnonymous) {
      onSignIn?.();
      return false;
    }
    return true;
  };

  const onReport = () => {
    setOpen(false);
    if (!requireAuth()) return;
    setReporting(true);
  };

  const onToggleBlock = async () => {
    setOpen(false);
    if (!requireAuth() || !targetUid) return;
    try {
      await BlockService.toggleBlock(targetUid, blocked);
    } catch (err) {
      console.warn('block toggle failed:', err.message);
    }
  };

  return (
    <div className={`more-menu ${className}`} ref={wrapRef}>
      <button
        type="button"
        className="more-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label={t('more')}
        aria-expanded={open}
      >
        <MoreHorizontal size={buttonSize} strokeWidth={1.6} />
      </button>
      {open && (
        <div className="more-menu-popover" role="menu">
          <button type="button" role="menuitem" onClick={onReport}>
            <Flag size={14} strokeWidth={1.7} /> {t('report')}
          </button>
          {showBlock && targetUid && (
            <button
              type="button"
              role="menuitem"
              className={blocked ? '' : 'danger'}
              onClick={onToggleBlock}
            >
              <Ban size={14} strokeWidth={1.7} /> {blocked ? t('unblock') : t('block')}
            </button>
          )}
        </div>
      )}
      {reporting && (
        <ReportModal target={target} user={user} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}

export default MoreMenu;
