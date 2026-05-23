import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Sparkles } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { BoardService } from '../services/board-service.js';
import { CATEGORIES } from '../services/taxonomy.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Lekondo/Essembl-style stats row that sits between the identity block
// and the segmented tabs on Profile:
//   [Wardrobe count] [Outfits count] [Posts count]
//   [category circles with item counts]
//
// All numbers are derived client-side from the user's own data so they
// stay in sync without any extra server denorm beyond what we already
// have on profiles/{uid}.outfitCount (= isListed outfit count).
export function ProfileStats({ user, profile, onTabChange }) {
  const { t } = useLocale();
  const [items, setItems] = useState(null);
  const [outfits, setOutfits] = useState(null);
  const [boards, setBoards] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setItems([]); return; }
    return ItemService.subscribeMyCloset(user.uid, list => {
      setItems(list.filter(i => !i.isArchived));
    });
  }, [user]);

  useEffect(() => {
    if (!user || user.isAnonymous) { setOutfits([]); return; }
    OutfitService.listMyOutfits({ uid: user.uid })
      .then(({ outfits }) => setOutfits(outfits))
      .catch(() => setOutfits([]));
  }, [user]);

  useEffect(() => {
    if (!user || user.isAnonymous) { setBoards([]); return; }
    return BoardService.subscribeMyBoards(setBoards);
  }, [user]);

  const closetN = items?.length ?? 0;
  const outfitsN = outfits?.length ?? 0;
  const boardsN = boards?.length ?? 0;

  // Build per-category counts in display order, dropping zero-count
  // categories so the row stays compact on small wardrobes.
  const catCounts = useMemo(() => {
    if (!items) return [];
    const counts = {};
    for (const it of items) {
      const c = it.tags?.category;
      if (!c) continue;
      counts[c] = (counts[c] || 0) + 1;
    }
    return CATEGORIES.filter(c => counts[c] > 0).map(c => ({ category: c, n: counts[c] }));
  }, [items]);

  // Stats order matches the Profile tab order below: Outfits / Closet
  // / Boards. Each tile jumps to that tab so it's an actual nav, not
  // just a label. Try-ons history is a separate page (see linked chip).
  return (
    <section className="profile-stats" aria-label={t('stats')}>
      <div className="profile-stats-row">
        <StatBtn n={outfitsN} label={t('navOutfits')} onClick={() => onTabChange?.('outfits')} />
        <StatBtn n={closetN}  label={t('navCloset')}  onClick={() => onTabChange?.('closet')} />
        <StatBtn n={boardsN}  label={t('boards')}     onClick={() => onTabChange?.('boards')} />
      </div>

      {/* Secondary quick-links — try-ons (history page) and Feed
          (published outfits). Public outfit count = profile.outfitCount. */}
      <div className="profile-quicklinks">
        <Link to="/tryons" className="profile-quicklink">
          <Sparkles size={13} strokeWidth={1.6} /> {t('tryOnHistory')}
        </Link>
        {(profile?.outfitCount ?? 0) > 0 && (
          <Link to="/feed" className="profile-quicklink">
            {t('navFeed')} · {profile.outfitCount}
          </Link>
        )}
      </div>

      {catCounts.length > 0 && (
        <div className="profile-cat-row">
          {catCounts.map(({ category, n }) => (
            <div key={category} className="profile-cat-chip" aria-label={`${t(`taxonomy.categories.${category}`)} ${n}`}>
              <span className="profile-cat-icon">
                <Shirt size={16} strokeWidth={1.5} />
              </span>
              <span className="profile-cat-n">{n}</span>
              <span className="profile-cat-label">{t(`taxonomy.categories.${category}`)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatBtn({ n, label, onClick }) {
  return (
    <button type="button" className="profile-stat-col" onClick={onClick}>
      <span className="profile-stat-n">{n}</span>
      <span className="profile-stat-label">{label}</span>
    </button>
  );
}

export default ProfileStats;
