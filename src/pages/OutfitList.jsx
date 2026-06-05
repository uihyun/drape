import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Calendar as CalendarIcon, SlidersHorizontal, Lock } from 'lucide-react';
import { OutfitService } from '../services/outfit-service.js';
import {
  LookFilterSheet, emptyLookFilters, countLookFilters, lookMatches,
} from '../components/LookFilterSheet.jsx';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { CardImage } from '../components/CardImage.jsx';
import { Masonry } from '../components/Masonry.jsx';
import { useLocale } from '../hooks/useLocale.jsx';
import { loadFilters, saveFilters } from '../services/filterStore.js';
import { olCache, olKey } from '../services/uiCache.js';

// Outfit lists cached by uid|tab in services/uiCache (shared with the splash
// warm-up) so returning from a detail paints instantly instead of blanking →
// spinner → refetch. Each tab still refreshes in the background.

// 2-col grid of natural-ratio look photos — matches the discovery feed.
// `showPrivacy` (own content only) flags looks that aren't published yet.
function OotdGrid({ ootds, t, showPrivacy = false }) {
  return (
    <Masonry items={ootds}>
      {o => {
        const photo = outfitCardPhoto(o);
        const isPrivate = showPrivacy && !o.isPublic && !o.isListed;
        return (
          <Link to={`/o/${o.id}`} className="ootd-card">
            {photo
              ? <CardImage src={photo} />
              : <div className="ootd-card-empty">◇</div>}
            {isPrivate && (
              <span className="card-private-badge" title={t('privateBadge')} aria-label={t('privateBadge')}>
                <Lock size={12} strokeWidth={2.2} />
              </span>
            )}
            {/* Clean cover — name/memo lives on the detail only (like the feed). */}
          </Link>
        );
      }}
    </Masonry>
  );
}

export function OutfitList({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  // Sub-tab lives in the URL (?ot=mine|saved|analyzed) so returning from a
  // detail page lands back on the tab you left, not always Mine.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('ot');
  const tab = ['mine', 'saved', 'analyzed'].includes(tabParam) ? tabParam : 'mine';
  // Seed from cache for the current tab so back-nav paints immediately.
  const seeded = user ? olCache.get(olKey(user.uid, tab)) : null;
  const [outfits, setOutfits] = useState(tab === 'analyzed' ? (seeded ?? null) : null);
  const [ootds, setOotds] = useState(tab !== 'analyzed' ? (seeded ?? null) : null);
  const setTab = (next) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev);
    p.set('ot', next);
    return p;
  }, { replace: true });
  const fkey = `outfits:${user?.uid || 'anon'}`;
  const [filters, setFilters] = useState(() => loadFilters(fkey, emptyLookFilters()));
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => { saveFilters(fkey, filters); }, [fkey, filters]);
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
    const key = olKey(user.uid, tab);
    const cached = olCache.get(key);
    let cancelled = false;
    const apply = (setter, rows) => { if (cancelled) return; olCache.set(key, rows); setter(rows); };
    if (tab === 'mine') {
      setOotds(cached ?? null); // keep cached list visible; spinner only if none
      OutfitService.listMyOotds({ uid: user.uid, pageSize: 150 })
        .then(({ ootds }) => apply(setOotds, ootds))
        .catch(() => { if (!cancelled && !cached) setOotds([]); });
    } else if (tab === 'saved') {
      setOotds(cached ?? null);
      OutfitService.listBookmarkedOotds({ uid: user.uid, pageSize: 150 })
        .then(({ ootds }) => apply(setOotds, ootds))
        .catch((err) => {
          console.warn('saved bookmarks query failed:', err?.code, err?.message);
          if (!cancelled && !cached) setOotds([]);
        });
    } else {
      setOutfits(cached ?? null);
      OutfitService.listMyOutfits({ uid: user.uid, kind: 'analyzed', pageSize: 150 })
        .then(({ outfits }) => apply(setOutfits, outfits))
        .catch(() => { if (!cancelled && !cached) setOutfits([]); });
    }
    return () => { cancelled = true; };
  }, [user, tab]);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <h2>{t('outfitSignInTitle')}</h2>
        <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
      </div>
    );
  }

  // The list for the active tab, with the shared tag filter applied. OOTD
  // tabs derive tags from each look's style[]/pieces[]; analyzed likewise.
  const rawList = tab === 'analyzed' ? outfits : ootds;
  const activeList = rawList === null
    ? null
    : (filterCount === 0 ? rawList : rawList.filter(o => lookMatches(o, filters, {})));

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

      {/* Tabs + shared tag-filter button (applies to every tab). */}
      <div className="closet-header" style={{ marginBottom: '1.25rem' }}>
        <nav className="filter-chips filter-chips--text" role="tablist" style={{ margin: 0 }}>
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

      {activeList === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : activeList.length === 0 ? (
        filterCount > 0 ? (
          <div className="empty-state empty-state-card"><p>{t('noClosetMatch')}</p></div>
        ) : tab === 'mine' ? (
          <div className="empty-state empty-state-card">
            <p>{t('ootdsMineEmpty')}</p>
            <Link to="/profile/calendar?ootd=today" className="btn btn-primary">
              <CalendarIcon size={14} strokeWidth={1.8} /> {t('createLogOotd')}
            </Link>
          </div>
        ) : tab === 'saved' ? (
          <div className="empty-state empty-state-card">
            <p>{t('savedEmpty')}</p>
            <Link to="/feed" className="btn btn-primary">{t('browseFeed')}</Link>
          </div>
        ) : (
          <div className="empty-state empty-state-card">
            <p>{t('analyzedEmpty')}</p>
            <Link to="/analyze" className="btn btn-primary">
              <Plus size={14} strokeWidth={1.8} /> {t('analyzeAPhoto')}
            </Link>
          </div>
        )
      ) : (
        <OotdGrid ootds={activeList} t={t} showPrivacy={tab === 'mine'} />
      )}

      {sheetOpen && (
        <LookFilterSheet
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(emptyLookFilters())}
          onClose={() => setSheetOpen(false)}
          count={filterCount}
          resultCount={activeList?.length ?? 0}
        />
      )}
    </div>
  );
}

