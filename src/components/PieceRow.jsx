import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, ExternalLink, Plus, Check, X } from 'lucide-react';
import { matchCloset } from '../utils/itemMatch.js';

// One detected garment + its tag-matched closet items ("from your closet").
// Shared by the analyze result and the saved-look detail so the two read as
// one design. When `sale` is set, a shirt icon opens a modal with Find similar
// + a Save action; without it the row is display-only.
//
// sale = {
//   onSave:     async () => {},   // performs the save (wishlist / closet)
//   saved?:     boolean,          // controlled "already saved" (optional)
//   saveLabel:  string,           // button label before save
//   savedLabel: string,           // button label after save
//   findSimilar?: boolean,        // show the Find similar link (default true)
// }
export function PieceRow({ piece, closet, t, sale = null, linkedItems = [] }) {
  const matches = matchCloset(piece, closet);
  const hasLinked = Array.isArray(linkedItems) && linkedItems.length > 0;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLocal, setSavedLocal] = useState(false);
  const saved = !!(sale?.saved || savedLocal);

  const label = piece.name
    || [(piece.colors || [])[0], piece.category].filter(Boolean).join(' ')
    || t('untitledItem');
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(piece.searchQuery || piece.description || label)}`;

  async function doSave() {
    if (!sale || saving || saved) return;
    setSaving(true);
    try {
      await sale.onSave();
      setSavedLocal(true);
    } catch (e) {
      console.warn('piece save failed', e?.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="piece-match-row">
      <div className="piece-match-head">
        <span className="piece-match-name">{label}</span>
        {piece.category && (
          <span className="piece-match-cat">{t(`taxonomy.categories.${piece.category}`)}</span>
        )}
        {sale && (
          <button
            type="button"
            className="piece-add-closet"
            aria-label={sale.saveLabel}
            title={sale.saveLabel}
            onClick={() => setOpen(true)}
          >
            <Shirt size={15} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {piece.description && <p className="piece-match-desc">{piece.description}</p>}
      {/* The item(s) actually linked to this piece take priority — once you've
          said "this is what I wore", the tag-match suggestions are noise. */}
      {hasLinked ? (
        <div className="analyze-match-strip">
          <div className="analyze-match-row">
            {linkedItems.map(item => {
              const cover = item.croppedUrl || item.originalUrl;
              return (
                <Link key={item.id} to={`/i/${item.id}`} className="analyze-match-card is-linked" title={item.name || ''}>
                  {cover
                    ? <img src={cover} alt={item.name || ''} loading="lazy" />
                    : <div className="item-card-skeleton" />}
                </Link>
              );
            })}
          </div>
        </div>
      ) : matches.length > 0 ? (
        <div className="analyze-match-strip">
          <span className="analyze-match-label">{t('fromYourCloset')}</span>
          <div className="analyze-match-row">
            {matches.map(({ item }) => {
              const cover = item.croppedUrl || item.originalUrl;
              return (
                <Link key={item.id} to={`/i/${item.id}`} className="analyze-match-card" title={item.name || ''}>
                  {cover
                    ? <img src={cover} alt={item.name || ''} loading="lazy" />
                    : <div className="item-card-skeleton" />}
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <span className="piece-match-empty">{t('noClosetMatch')}</span>
      )}

      {open && sale && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal piece-wishlist-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('close')} onClick={() => setOpen(false)}>
              <X size={18} strokeWidth={1.8} />
            </button>
            <h3 className="piece-wishlist-title">{label}</h3>
            {piece.category && (
              <span className="piece-match-cat">{t(`taxonomy.categories.${piece.category}`)}</span>
            )}
            {piece.description && <p className="piece-match-desc">{piece.description}</p>}
            <div className="piece-wishlist-actions">
              {sale.findSimilar !== false && (
                <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <ExternalLink size={13} strokeWidth={1.8} /> {t('findSimilar')}
                </a>
              )}
              <button type="button" className="btn btn-primary btn-sm" onClick={doSave} disabled={saved || saving}>
                {saved
                  ? <><Check size={13} strokeWidth={2} /> {sale.savedLabel}</>
                  : <><Plus size={13} strokeWidth={1.9} /> {sale.saveLabel}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
