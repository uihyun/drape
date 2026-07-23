import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Bell, Settings as SettingsIcon, MapPin, MessageSquare } from 'lucide-react';
import { useUnreadMessages } from '../hooks/useUnreadMessages.js';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications.js';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';
import { ProfileService } from '../services/profile-service.js';
import { ItemService } from '../services/item-service.js';
import { Closet } from './Closet.jsx';
import { Calendar } from './Calendar.jsx';
import { OutfitList } from './OutfitList.jsx';
import { BoardList } from './BoardList.jsx';
import { TryOnHistory } from './TryOnHistory.jsx';
import { ClaimHandleModal } from '../components/ClaimHandleModal.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { ExpandableBio } from '../components/ExpandableBio.jsx';
import { FollowListSheet } from '../components/FollowListSheet.jsx';
import { formatCount } from '../utils/formatCount.js';
import { cityDisplay } from '../data/cities.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { useHideOnScroll } from '../hooks/useHideOnScroll.js';

// Lekondo-style profile shell — the app's main screen. Wraps Outfits /
// Calendar / Closet as segmented tabs over the user's identity header.
// Each tab body is the existing page component rendered with `embedded`
// (no top h2 / Add button) so the chrome is provided here once.
const TABS = ['outfits', 'calendar', 'closet', 'boards', 'tryon'];
const DEFAULT_TAB = 'calendar';

// Lucide dropped brand icons over trademark concerns. Inline the IG glyph
// so we don't take a 2nd icon dep just for one mark.
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

export function Profile({ user, authReady, onSignIn }) {
  const { t, lang } = useLocale();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const activeTab = TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;

  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [skipClaim, setSkipClaim] = useState(false);
  const [followSheet, setFollowSheet] = useState(null); // 'followers' | 'following' | null
  // Owned-closet count. Seeded from a per-user cache so it renders instantly
  // (like the stored followerCount) instead of flashing 0 → n on every open.
  const [itemCount, setItemCount] = useState(() => {
    const uid = user?.uid;
    if (!uid || user?.isAnonymous) return null;
    const c = localStorage.getItem(`drape:itemCount:${uid}`);
    return c != null ? Number(c) : null;
  });
  // Auto-hiding sticky tab row: once the identity header scrolls past, the
  // section tabs stick under the notch and slide up on scroll-down / back on
  // scroll-up (same behavior as the feed). The full header only reappears at
  // the very top. Higher upThreshold so a tiny up-flick doesn't pop it down.
  const tabsRef = useHideOnScroll({ upThreshold: 130 });
  useEffect(() => {
    if (!user || user.isAnonymous) { setProfile(null); setProfileLoaded(false); return; }
    return ProfileService.subscribeByUid(user.uid, p => {
      setProfile(p);
      setProfileLoaded(true);
    });
  }, [user]);

  // On your OWN profile the headline stat is your closet size (items) — that's
  // what you actually build here, vs OOTDs which most users never post. (A
  // public profile shows the viewer the user's public outfit count instead.)
  // Stale-while-revalidate: show the cached value at once, recount in the
  // background, write back. Same number → setState is a no-op (no flicker);
  // only a real change moves it.
  useEffect(() => {
    if (!user?.uid || user.isAnonymous) { setItemCount(null); return; }
    const key = `drape:itemCount:${user.uid}`;
    const cached = localStorage.getItem(key);
    if (cached != null) setItemCount(Number(cached));
    let alive = true;
    ItemService.countOwnedByUser(user.uid).then(n => {
      if (!alive) return;
      setItemCount(n);
      try { localStorage.setItem(key, String(n)); } catch { /* quota / private mode */ }
    });
    return () => { alive = false; };
  }, [user?.uid]);

  // One-shot self-heal for follower/following counts. Old triggers could
  // leave the counts drifted from the actual /follows collection. Cost
  // is two count() reads + one write; sessionStorage flag keeps it to
  // once per browser session per user.
  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return;
    const key = `drape:followsRecounted:${user.uid}`;
    if (sessionStorage.getItem(key)) return;
    httpsCallable(functions, 'recountMyFollows')()
      .then(() => sessionStorage.setItem(key, '1'))
      .catch(err => console.warn('recountMyFollows failed:', err?.code, err?.message));
  }, [user?.uid]);

  if (!authReady) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user || user.isAnonymous) {
    // Guests get a lived-in demo closet instead of a sign-in wall — a full
    // calendar/outfit archive sells the product better than copy. Actions
    // inside still gate through onSignIn; the ?demo=1 banner carries the
    // "start my closet" CTA (PublicProfile). Persona matches the viewer's
    // locale, alternating genders so the demo doesn't read women-only.
    const DEMO_HANDLES = {
      ko: ['jisu_daily', 'jiyongg', 'jiho'],
      ja: ['rina_cafe_life', 'miisuzu_desu', 'kenta_games_jp'],
      en: ['natalie', 'bibi', 'prof_arthur_p'],
    };
    const pool = DEMO_HANDLES[lang] || DEMO_HANDLES.en;
    // Sticky per browsing session: hopping tabs and coming back should show
    // the SAME demo person (per-visit reroll read as a glitch). Next session
    // gets a fresh roll for variety.
    let handle;
    try {
      handle = sessionStorage.getItem('drape_demo_handle');
      if (!pool.includes(handle)) {
        handle = pool[Math.floor(Math.random() * pool.length)];
        sessionStorage.setItem('drape_demo_handle', handle);
      }
    } catch {
      handle = pool[0];
    }
    return <Navigate to={`/u/${handle}?demo=1`} replace />;
  }

  const handle = profile?.handle ? `@${profile.handle}` : '';
  const displayName = profile?.displayName || user.displayName || '';
  const followers = profile?.followerCount ?? 0;
  const following = profile?.followingCount ?? 0;
  const bio = profile?.bio || '';
  const location = cityDisplay(profile?.location, lang);
  // Instagram-style stat: outfit count sits in the posts/followers/
  // following row next to the avatar. Server-side counter trigger
  // maintains profile.outfitCount.
  // null only on the first-ever load (no cache yet) — render blank, not 0, so
  // it doesn't look like it reset and counted up.
  const displayItemCount = itemCount == null ? '' : formatCount(itemCount, lang);
  // Only the user-uploaded photo counts. We deliberately don't fall
  // back to the auth provider's avatar (Google profile pic etc) so a
  // fresh account shows an empty avatar and gets nudged to upload.
  const photoURL = profile?.photoURL || null;

  return (
    <div className="profile">
      <header className="profile-topbar">
        <span className="profile-handle">{handle}</span>
        <div className="profile-topbar-actions">
          <InboxIconLink user={user} t={t} />
          <NotifIconLink user={user} t={t} />
          <Link to="/settings" className="icon-btn" aria-label={t('settings')}>
            <SettingsIcon size={20} strokeWidth={1.6} />
          </Link>
        </div>
      </header>

      <section className="profile-identity">
        <div className="profile-avatar-wrap">
          <Avatar
            src={photoURL}
            name={displayName || handle.replace('@', '')}
            size={76}
            className="profile-avatar"
          />
        </div>

        <div className="profile-meta">
          <div className="profile-name-row">
            <span className="profile-name">{displayName}</span>
            {profile?.instagram && (
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
            <button type="button" className="profile-stat" onClick={() => navigate('/profile/closet')}>
              <strong>{displayItemCount}</strong>
              <span>{t('navItems')}</span>
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
        {TABS.map(name => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={activeTab === name}
            className={`profile-tab${activeTab === name ? ' active' : ''}`}
            onClick={() => navigate(`/profile/${name}`)}
          >
            {t(`profileTabs.${name}`)}
          </button>
        ))}
      </nav>

      <div className="profile-tabcontent" role="tabpanel">
        {activeTab === 'outfits' && <OutfitList user={user} onSignIn={onSignIn} embedded />}
        {activeTab === 'calendar' && <Calendar user={user} onSignIn={onSignIn} embedded showBackground={!!profile?.calendarShowBackground} />}
        {activeTab === 'closet' && <Closet user={user} authReady={authReady} onSignIn={onSignIn} embedded />}
        {activeTab === 'boards' && <BoardList user={user} onSignIn={onSignIn} embedded />}
        {activeTab === 'tryon' && <TryOnHistory user={user} onSignIn={onSignIn} embedded />}
      </div>

      <ClaimHandleModal
        open={profileLoaded && !profile?.handle && !skipClaim}
        onClose={() => setSkipClaim(true)}
      />

      <FollowListSheet
        open={!!followSheet}
        uid={user.uid}
        kind={followSheet}
        onClose={() => setFollowSheet(null)}
      />
    </div>
  );
}

function InboxIconLink({ user, t }) {
  const unread = useUnreadMessages(user);
  return (
    <Link to="/messages" className="icon-btn icon-btn-badged" aria-label={t('inboxTitle')}>
      <MessageSquare size={20} strokeWidth={1.6} />
      {unread > 0 && (
        <span className="icon-btn-badge" aria-label={`${unread} unread`}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

function NotifIconLink({ user, t }) {
  const hasUnread = useUnreadNotifications(user);
  return (
    <Link to="/notifications" className="icon-btn icon-btn-badged" aria-label={t('notifications')}>
      <Bell size={20} strokeWidth={1.6} />
      {hasUnread && <span className="icon-btn-dot" aria-label="new" />}
    </Link>
  );
}

export default Profile;
