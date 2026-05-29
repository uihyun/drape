import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar as CalendarIcon, SlidersHorizontal } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import {
  LookFilterSheet, emptyLookFilters, countLookFilters, lookMatches,
} from '../components/LookFilterSheet.jsx';
import { usePinchColumns } from '../hooks/usePinchColumns.js';
import { useLocale } from '../hooks/useLocale.jsx';

function formatCardDate(ts) {
  const d = ts?.toDate?.() || (ts instanceof Date ? ts : null);
  return d ? d.toLocaleDateString() : '';
}

// 2-col grid of natural-ratio look photos — matches the discovery feed.
function OotdGrid({ ootds, t }) {
  return (
    <div className="ootd-feed">
      {ootds.map(o => {
        const photo = o.photoCutUrl || o.photoUrl;
        return (
          <Link key={o.id} to={`/o/${o.id}`} className="ootd-card">
            {photo
              ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
              : <div className="ootd-card-empty">◇</div>}
            {(o.note || o.name) && (
              <div className="ootd-card-overlay">
                <h3 className="ootd-card-title">{o.note || o.name}</h3>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function OutfitList({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [outfits, setOutfits] = useState(null);
  const [ootds, setOotds] = useState(null);
  const [itemsById, setItemsById] = useState({});
  // 'mine' (my OOTDs) | 'saved' (OOTDs I bookmarked from feed) | 'analyzed'
  const [tab, setTab] = useState('mine');
  const [filterLiked, setFilterLiked] = useState(false);
  const [filters, setFilters] = useState(emptyLookFilters());
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterCount = countLookFilters(filters);
  const toggleFilter = (dim, value) => {
    setFilters(prev => {
      const cur = prev[dim] || [];
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...prev, [dim]: next };
    });
  };

  // Each tab populates a different source:
  //   mine     → OutfitService.listMyOotds
  //   saved    → OutfitService.listBookmarkedOotds (feed bookmarks)
  //   analyzed → OutfitService.listMyOutfits (kind='analyzed')
  useEffect(() => {
    if (!user || user.isAnonymous) { setOutfits([]); setOotds([]); return; }
    if (tab === 'mine') {
      setOotds(null);
      OutfitService.listMyOotds({ uid: user.uid, pageSize: 60 })
        .then(({ ootds }) => setOotds(ootds))
        .catch(() => setOotds([]));
    } else if (tab === 'saved') {
      setOotds(null);
      OutfitService.listBookmarkedOotds({ uid: user.uid })
        .then(({ ootds }) => setOotds(ootds))
        .catch((err) => {
          console.warn('saved bookmarks query failed:', err?.code, err?.message);
          setOotds([]);
        });
    } else {
      setOutfits(null);
      OutfitService.listMyOutfits({ uid: user.uid, kind: 'analyzed' })
        .then(({ outfits }) => setOutfits(outfits))
        .catch(() => setOutfits([]));
    }
  }, [user, tab]);

  // Once we have outfits, batch-fetch every referenced item just once
  // (de-duped) so the cards can render a moodboard-style collage cover
  // instead of just one piece. Per-list reads = unique item count,
  // bounded by user's closet size.
  useEffect(() => {
    if (!outfits?.length) return;
    const allIds = new Set();
    for (const o of outfits) {
      for (const id of (o.itemIds || []).slice(0, 6)) allIds.add(id);
    }
    const missing = Array.from(allIds).filter(id => !itemsById[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map(id => getDoc(doc(db, 'items', id))))
      .then(snaps => {
        const next = { ...itemsById };
        for (const s of snaps) {
          if (s.exists()) {
            const d = s.data();
            next[s.id] = d.croppedUrl || d.originalUrl || null;
          }
        }
        setItemsById(next);
      })
      .catch(() => {});
  }, [outfits]);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <h2>{t('outfitSignInTitle')}</h2>
        <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
      </div>
    );
  }

  return (
    <div className={`outfit-list${embedded ? ' outfit-list-embedded' : ''}`}>
      {!embedded && (
        <div className="closet-header">
          <h2 className="section-title">{t('navOutfits')}</h2>
          <Link to="/outfits/new" className="btn btn-primary">
            <Plus size={14} strokeWidth={1.8} /> {t('newOutfit')}
          </Link>
        </div>
      )}

      <nav className="filter-chips filter-chips--text" role="tablist" style={{ marginBottom: '1.25rem' }}>
        {['mine', 'saved', 'analyzed'].map(key => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`chip${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(`outfits${key.charAt(0).toUpperCase() + key.slice(1)}`)}
          </button>
        ))}
      </nav>

      {tab === 'mine' ? (
        ootds === null ? (
          <div className="loading"><div className="spinner" /></div>
        ) : ootds.length === 0 ? (
          <div className="empty-state empty-state-card">
            <p>{t('ootdsMineEmpty')}</p>
            <Link to="/profile/calendar?ootd=today" className="btn btn-primary">
              <CalendarIcon size={14} strokeWidth={1.8} /> {t('createLogOotd')}
            </Link>
          </div>
        ) : (
          <OotdGrid ootds={ootds} t={t} />
        )
      ) : tab === 'saved' ? (
        ootds === null ? (
          <div className="loading"><div className="spinner" /></div>
        ) : ootds.length === 0 ? (
          <div className="empty-state empty-state-card">
            <p>{t('savedEmpty')}</p>
            <Link to="/feed" className="btn btn-primary">{t('browseFeed')}</Link>
          </div>
        ) : (
          <OotdGrid ootds={ootds} t={t} />
        )
      ) : outfits === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : outfits.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('analyzedEmpty')}</p>
          <Link to="/analyze" className="btn btn-primary">
            <Plus size={14} strokeWidth={1.8} /> {t('analyzeAPhoto')}
          </Link>
        </div>
      ) : (
        <>
          <div className="closet-header" style={{ marginBottom: '1.25rem' }}>
            <nav className="filter-chips filter-chips--text" style={{ margin: 0 }}>
              <button
                type="button"
                className={`chip${filterLiked ? ' active' : ''}`}
                onClick={() => setFilterLiked(f => !f)}
              >
                {t('filterLiked')}
              </button>
            </nav>
            <button
              type="button"
              className={`closet-search-btn${filterCount > 0 ? ' has-filters' : ''}`}
              aria-label={t('detailedFilter')}
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontal size={18} strokeWidth={1.7} />
              {filterCount > 0 && <span className="closet-filter-badge">{filterCount}</span>}
            </button>
          </div>
          <AnalyzedGrid
            outfits={outfits.filter(o => {
              if (filterLiked && !o.selfLiked) return false;
              if (filterCount > 0 && !lookMatches(o, filters, {})) return false;
              return true;
            })}
            itemsById={itemsById}
            t={t}
          />
          {sheetOpen && (
            <LookFilterSheet
              filters={filters}
              onToggle={toggleFilter}
              onClear={() => setFilters(emptyLookFilters())}
              onClose={() => setSheetOpen(false)}
              count={filterCount}
              resultCount={outfits.filter(o => {
                if (filterLiked && !o.selfLiked) return false;
                if (filterCount > 0 && !lookMatches(o, filters, {})) return false;
                return true;
              }).length}
            />
          )}
        </>
      )}
    </div>
  );
}

function AnalyzedGrid({ outfits, itemsById, t }) {
  const { cols, ref } = usePinchColumns('outfits', { min: 1, max: 3, def: 1 });
  return (
    <div
      ref={ref}
      className="outfit-grid pinch-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {outfits.map(o => (
        <Link key={o.id} to={`/o/${o.id}`} className="outfit-card">
          <OutfitCover outfit={o} itemsById={itemsById} t={t} />
          <div className="outfit-card-meta">
            <span className="card-meta-name">{o.name || t('untitledOutfit')}</span>
            <span className="card-meta-date">{formatCardDate(o.createdAt || o.updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Card cover. If we have ≥ 2 of the outfit's items resolved, render a
// moodboard-style collage (overlapping cutouts on a soft gradient).
// Otherwise fall back to the single coverUrl / placeholder.
function OutfitCover({ outfit, itemsById, t }) {
  const thumbs = useMemo(() => {
    const ids = (outfit.itemIds || []).slice(0, 5);
    return ids.map(id => itemsById[id]).filter(Boolean);
  }, [outfit.itemIds, itemsById]);

  if (thumbs.length >= 2) {
    return (
      <div className="outfit-card-cover outfit-card-collage">
        {thumbs.map((url, idx) => {
          const total = thumbs.length;
          const pct = total === 1 ? 0.5 : idx / (total - 1);
          const x = 0.22 + pct * 0.56;
          const y = 0.34 + (idx % 2 === 0 ? -0.04 : 0.05) + Math.abs(pct - 0.5) * 0.16;
          const rot = (pct - 0.5) * 18;
          const scale = 0.6 - Math.abs(pct - 0.5) * 0.1;
          return (
            <img
              key={idx}
              src={url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
                zIndex: idx + 1,
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="outfit-card-cover">
      {outfit.coverUrl
        ? <img src={outfit.coverUrl} alt={outfit.name || ''} loading="lazy" />
        : <div className="outfit-card-cover-empty">
            <span>{outfit.itemIds?.length || 0} {t('itemsShort')}</span>
          </div>}
    </div>
  );
}
