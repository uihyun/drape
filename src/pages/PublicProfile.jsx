import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProfileService } from '../services/profile-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { BoardService } from '../services/board-service.js';
import { FollowButton } from '../components/FollowButton.jsx';
import { FollowListSheet } from '../components/FollowListSheet.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { Masonry } from '../components/Masonry.jsx';
import { buildSwipeState } from '../services/swipeNav.js';
import { ExpandableBio } from '../components/ExpandableBio.jsx';
import { MoreMenu } from '../components/MoreMenu.jsx';
import { CardImage } from '../components/CardImage.jsx';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { formatCount } from '../utils/formatCount.js';
import { cityDisplay } from '../data/cities.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { useHideOnScroll } from '../hooks/useHideOnScroll.js';

// Read-only profile for *other* users (route: /u/:handle). Same identity
// header as the owner Profile, with Follow + three tabs of public-only
// content: Outfits (public OOTDs), Calendar (read-only month grid of
// those OOTDs), Boards (public sticker boards). Closet / try-on / their
// drafts are not exposed.
function InstagramGlyph(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const PUBLIC_TABS = ['outfits', 'calendar', 'boards'];

export function PublicProfile({ user, onSignIn }) {
  const { t, lang } = useLocale();
  const { handle } = useParams();
  const [profile, setProfile] = useState(undefined);
  // Tab in the URL (?pt=) so back-navigation keeps the section.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('pt');
  const tab = PUBLIC_TABS.includes(tabParam) ? tabParam : 'outfits';
  const setTab = (next) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev); p.set('pt', next); return p;
  }, { replace: true });
  // Auto-hiding sticky tab row — identical behavior to the owner Profile: the
  // tabs stick under the notch and slide up on scroll-down / back on scroll-up.
  const tabsRef = useHideOnScroll({ upThreshold: 130 });
  const [ootds, setOotds] = useState(null);
  const [boards, setBoards] = useState(null);
  const [followSheet, setFollowSheet] = useState(null);
  // Public-outfit count, cached per user so it renders instantly instead of
  // flashing the stale profiles.outfitCount / 0 while the grid loads. Set to
  // the real list length once `ootds` arrives (see the fetch effect).
  const [outfitCount, setOutfitCount] = useState(null);

  // Resolve handle → uid once, then subscribe live so a follow toggle
  // here updates followerCount on the screen immediately.
  useEffect(() => {
    if (!handle) { setProfile(null); return; }
    let cancelled = false;
    let unsub = null;
    ProfileService.getByHandle(handle).then(p => {
      if (cancelled || !p) { setProfile(p || null); return; }
      setProfile(p);
      unsub = ProfileService.subscribeByUid(p.uid, live => {
        if (!cancelled && live) setProfile(live);
      });
    });
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [handle]);

  // OOTDs power both the Outfits grid and the Calendar tab, so we fetch
  // them once when the profile resolves rather than per-tab.
  useEffect(() => {
    if (!profile?.uid) { setOotds(null); setOutfitCount(null); return; }
    const key = `drape:pubOutfitCount:${profile.uid}`;
    const cached = localStorage.getItem(key);
    if (cached != null) setOutfitCount(Number(cached)); // instant, revalidated below
    OutfitService.listPublicByUser({ uid: profile.uid, pageSize: 200 })
      .then((list) => {
        setOotds(list);
        setOutfitCount(list.length); // same value → no re-render (no flicker)
        try { localStorage.setItem(key, String(list.length)); } catch { /* quota / private mode */ }
      })
      .catch((err) => {
        console.warn('public ootds failed:', err?.code, err?.message);
        setOotds([]);
      });
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) { setBoards(null); return; }
    BoardService.listPublicBoardsByUser({ uid: profile.uid, pageSize: 150 })
      .then(setBoards)
      .catch((err) => {
        console.warn('public boards failed:', err?.code, err?.message);
        setBoards([]);
      });
  }, [profile?.uid]);

  if (profile === undefined) {
    return <div className="loading"><div className="spinner" /></div>;
  }
  if (profile === null) {
    return (
      <div className="empty-state">
        <p>{t('userNotFound')}</p>
        <Link to="/feed" className="btn btn-secondary">{t('feedTitle')}</Link>
      </div>
    );
  }

  const displayName = profile.displayName || `@${profile.handle}`;
  const followers = profile.followerCount ?? 0;
  const following = profile.followingCount ?? 0;
  const bio = profile.bio || '';
  const location = cityDisplay(profile.location, lang);
  // outfitCount is the cached/live public-post count (state above). null only on
  // the first-ever visit (no cache) → render blank, not 0, so it doesn't flicker.
  const displayOutfitCount = outfitCount == null ? '' : formatCount(outfitCount, lang);
  const photoURL = profile.photoURL;
  const isSelf = user && profile.uid === user.uid;

  // Guest landed here from /profile (demo closet). One banner sells the flip
  // from "their archive" to "yours" — everything else stays read-only public.
  const isDemo = searchParams.get('demo') === '1' && (!user || user.isAnonymous);

  return (
    <div className="profile profile--sub">
      {isDemo && (
        <div className="demo-banner">
          <span>{t('demoBannerBody')}</span>
          <button type="button" className="btn btn-primary" onClick={onSignIn}>
            {t('demoBannerCta')}
          </button>
        </div>
      )}
      <header className="profile-topbar">
        <span className="profile-handle">@{profile.handle}</span>
        <div className="profile-topbar-actions">
          {isSelf ? (
            <Link to="/profile" className="btn-invite">{t('navProfile')}</Link>
          ) : (
            <>
              <FollowButton targetUid={profile.uid} user={user} onSignInRequest={onSignIn} />
              <MoreMenu
                target={{ type: 'profile', id: profile.uid }}
                targetUid={profile.uid}
                user={user}
                onSignIn={onSignIn}
                showBlock
              />
            </>
          )}
        </div>
      </header>

      <section className="profile-identity">
        <div className="profile-avatar-wrap">
          <Avatar
            src={photoURL}
            name={displayName || profile.handle}
            size={76}
            className="profile-avatar"
          />
        </div>

        <div className="profile-meta">
          <div className="profile-name-row">
            <span className="profile-name">{displayName}</span>
            {profile.instagram && (
              <a
                href={`https://instagram.com/${profile.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-ig"
                aria-label="Instagram"
              >
                <InstagramGlyph />
              </a>
            )}
          </div>
          <div className="profile-stats">
            <button type="button" className="profile-stat" onClick={() => setTab('outfits')}>
              <strong>{displayOutfitCount}</strong>
              <span>{t('navOutfits')}</span>
            </button>
            <button type="button" className="profile-stat" onClick={() => setFollowSheet('followers')}>
              <strong>{formatCount(followers, lang)}</strong>
              <span>{t('followers')}</span>
            </button>
            <button type="button" className="profile-stat" onClick={() => setFollowSheet('following')}>
              <strong>{formatCount(following, lang)}</strong>
              <span>{t('following')}</span>
            </button>
          </div>
          {location && (
            <div className="profile-location">
              <MapPin size={12} strokeWidth={1.6} />
              <span>{location}</span>
            </div>
          )}
        </div>
      </section>

      <ExpandableBio text={bio} />

      <nav className="profile-tabs" role="tablist" aria-label="Profile sections" ref={tabsRef}>
        {PUBLIC_TABS.map(name => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`profile-tab${tab === name ? ' active' : ''}`}
            onClick={() => setTab(name)}
          >
            {t(`profileTabs.${name}`)}
          </button>
        ))}
      </nav>

      <div className="profile-tabcontent" role="tabpanel">
        {tab === 'outfits' && <PublicOutfitsGrid ootds={ootds} t={t} />}
        {tab === 'calendar' && <PublicCalendar ootds={ootds} showBackground={!!profile?.calendarShowBackground} t={t} />}
        {tab === 'boards' && <PublicBoardsGrid boards={boards} t={t} />}
      </div>

      <FollowListSheet
        open={!!followSheet}
        uid={profile.uid}
        kind={followSheet}
        onClose={() => setFollowSheet(null)}
      />
    </div>
  );
}

// Merged Outfits grid — both public OOTDs and public legacy "outfits"
// (the editorial analyzed entries). Normalized into a single card
// Public OOTDs only — sorted by date desc. Analyzed outfits live in
// the user's private archive and never show up on someone else's
// profile.
function PublicOutfitsGrid({ ootds, t }) {
  if (ootds === null) {
    return <div className="loading"><div className="spinner" /></div>;
  }
  const items = [...ootds]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (items.length === 0) return <div className="empty-state"><p>{t('publicProfileEmpty')}</p></div>;
  const ids = items.map(o => o.id);
  // Same 2-col natural-ratio grid the owner's Outfits tab uses (.ootd-feed).
  return (
    <Masonry items={items}>
      {(o, i) => {
        const photo = outfitCardPhoto(o);
        return (
          <Link to={`/o/${o.id}`} state={buildSwipeState(ids, i, 'outfit')} className="ootd-card">
            {photo
              ? <CardImage src={photo} />
              : <div className="ootd-card-empty">◇</div>}
            {/* Clean cover — name/memo lives on the detail only (like the feed). */}
          </Link>
        );
      }}
    </Masonry>
  );
}

function PublicBoardsGrid({ boards, t }) {
  if (boards === null) return <div className="loading"><div className="spinner" /></div>;
  if (boards.length === 0) return <div className="empty-state"><p>{t('publicBoardsEmpty')}</p></div>;
  const ids = boards.map(b => b.id);
  return (
    <Masonry items={boards}>
      {(b, i) => (
        <Link to={`/boards/${b.id}`} state={buildSwipeState(ids, i, 'board')} className="board-card">
          <BoardThumbnail board={b} />
          <div className="board-card-meta">
            <span className="card-meta-name">{b.name || t('untitledBoard')}</span>
          </div>
        </Link>
      )}
    </Masonry>
  );
}

// Calendar view of someone else's public OOTDs. Month grid pulled from
// the already-fetched ootds list (bucketed by date) so we don't re-hit
// Firestore on month navigation. Cells link to /ootd/:id; days with no
// public entry render as blanks.
function PublicCalendar({ ootds, showBackground = false, t }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Multi-OOTD per day: pick one representative per date for the mini
  // calendar. Prefer the OOTD explicitly marked isCalendarRep; fall
  // back to most recent. Matches Calendar.jsx's listMonth sort.
  const byDate = useMemo(() => {
    const m = {};
    for (const o of ootds || []) {
      if (!o.date) continue;
      const prev = m[o.date];
      if (!prev) { m[o.date] = o; continue; }
      if (o.isCalendarRep && !prev.isCalendarRep) { m[o.date] = o; continue; }
      if (prev.isCalendarRep && !o.isCalendarRep) continue;
      const prevMs = prev?.createdAt?.toMillis?.() ?? 0;
      const curMs = o.createdAt?.toMillis?.() ?? 0;
      if (curMs > prevMs) m[o.date] = o;
    }
    return m;
  }, [ootds]);

  if (ootds === null) return <div className="loading"><div className="spinner" /></div>;

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const days = new Date(year, month0 + 1, 0).getDate();
  const firstWeekday = new Date(year, month0, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = cursor.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Chronological order of the dated looks → swipe between them from a detail.
  const calIds = Object.values(byDate)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(e => e.id);

  return (
    <div className="calendar calendar-embedded">
      <div className="calendar-header">
        <button type="button" className="btn" aria-label="Previous month" onClick={() => setCursor(new Date(year, month0 - 1, 1))}>
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <h2>{monthLabel}</h2>
        <button type="button" className="btn" aria-label="Next month" onClick={() => setCursor(new Date(year, month0 + 1, 1))}>
          <ChevronRight size={20} strokeWidth={1.6} />
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="calendar-weekday">{t(`weekdaysShort.${d.toLowerCase()}`)}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="calendar-cell empty" />;
          const dateStr = ymd(new Date(year, month0, d));
          const entry = byDate[dateStr];
          const isToday = ymd(today) === dateStr;
          const inner = (
            <>
              <span className="calendar-day-num">{d}</span>
              {(() => {
                const usingCut = !showBackground && !!entry?.photoCutUrl;
                const src = showBackground
                  ? (entry?.photoUrl || entry?.photoCutUrl)
                  : (entry?.photoCutUrl || entry?.photoUrl);
                return src ? (
                  <img
                    src={src}
                    alt=""
                    className={`calendar-thumb${usingCut ? ' is-cut' : ''}`}
                    loading="lazy"
                  />
                ) : null;
              })()}
            </>
          );
          return entry ? (
            <Link
              key={i}
              to={`/o/${entry.id}`}
              state={buildSwipeState(calIds, calIds.indexOf(entry.id), 'outfit')}
              className={`calendar-cell ${isToday ? 'today' : ''}`}
              aria-label={dateStr}
            >{inner}</Link>
          ) : (
            <div key={i} className={`calendar-cell ${isToday ? 'today' : ''}`}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

export default PublicProfile;
