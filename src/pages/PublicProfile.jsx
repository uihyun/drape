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
import { ExpandableBio } from '../components/ExpandableBio.jsx';
import { MoreMenu } from '../components/MoreMenu.jsx';
import { CardImage } from '../components/CardImage.jsx';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { formatCount } from '../utils/formatCount.js';
import { cityDisplay } from '../data/cities.js';
import { useLocale } from '../hooks/useLocale.jsx';

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
  const [ootds, setOotds] = useState(null);
  const [boards, setBoards] = useState(null);
  const [followSheet, setFollowSheet] = useState(null);

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
    if (!profile?.uid) { setOotds(null); return; }
    OutfitService.listPublicByUser({ uid: profile.uid, pageSize: 200 })
      .then(setOotds)
      .catch((err) => {
        console.warn('public ootds failed:', err?.code, err?.message);
        setOotds([]);
      });
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) { setBoards(null); return; }
    BoardService.listPublicBoardsByUser({ uid: profile.uid, pageSize: 30 })
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
  const outfitCount = profile.outfitCount ?? 0;
  const photoURL = profile.photoURL;
  const isSelf = user && profile.uid === user.uid;

  return (
    <div className="profile">
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
              <strong>{formatCount(outfitCount, lang)}</strong>
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

      <nav className="profile-tabs" role="tablist">
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
        {tab === 'calendar' && <PublicCalendar ootds={ootds} t={t} />}
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
  // Same 2-col natural-ratio grid the owner's Outfits tab uses (.ootd-feed).
  return (
    <div className="ootd-feed">
      {items.map(o => {
        const photo = outfitCardPhoto(o);
        return (
          <Link key={o.id} to={`/o/${o.id}`} className="ootd-card">
            {photo
              ? <CardImage src={photo} />
              : <div className="ootd-card-empty">◇</div>}
            {/* OOTD memo only — built/analyzed outfits keep a clean cover. */}
            {o.date && o.note && (
              <div className="ootd-card-overlay">
                <h3 className="ootd-card-title">{o.note}</h3>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function PublicBoardsGrid({ boards, t }) {
  if (boards === null) return <div className="loading"><div className="spinner" /></div>;
  if (boards.length === 0) return <div className="empty-state"><p>{t('publicBoardsEmpty')}</p></div>;
  return (
    <div className="board-list-grid">
      {boards.map(b => (
        <Link key={b.id} to={`/boards/${b.id}`} className="board-card">
          <BoardThumbnail board={b} />
          <div className="board-card-meta">
            <span className="card-meta-name">{b.name || t('untitledBoard')}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Calendar view of someone else's public OOTDs. Month grid pulled from
// the already-fetched ootds list (bucketed by date) so we don't re-hit
// Firestore on month navigation. Cells link to /ootd/:id; days with no
// public entry render as blanks.
function PublicCalendar({ ootds, t }) {
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
              {(entry?.photoCutUrl || entry?.photoUrl) && (
                <img
                  src={entry.photoCutUrl || entry.photoUrl}
                  alt=""
                  className={`calendar-thumb${entry.photoCutUrl ? ' is-cut' : ''}`}
                  loading="lazy"
                />
              )}
            </>
          );
          return entry ? (
            <Link
              key={i}
              to={`/o/${entry.id}`}
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
