import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bell, Settings as SettingsIcon, MapPin } from 'lucide-react';
import { ProfileService } from '../services/profile-service.js';
import { Closet } from './Closet.jsx';
import { Calendar } from './Calendar.jsx';
import { OutfitList } from './OutfitList.jsx';
import { BoardList } from './BoardList.jsx';
import { TryOnHistory } from './TryOnHistory.jsx';
import { ClaimHandleModal } from '../components/ClaimHandleModal.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { shareLink } from '../services/share-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

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
  const { t } = useLocale();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const activeTab = TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;

  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [skipClaim, setSkipClaim] = useState(false);
  useEffect(() => {
    if (!user || user.isAnonymous) { setProfile(null); setProfileLoaded(false); return; }
    return ProfileService.subscribeByUid(user.uid, p => {
      setProfile(p);
      setProfileLoaded(true);
    });
  }, [user]);

  if (!authReady) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <h2>{t('profileSignInTitle')}</h2>
        <p>{t('profileSignInBody')}</p>
        <button className="btn btn-primary" onClick={onSignIn}>
          {t('signInGoogle')}
        </button>
      </div>
    );
  }

  const handle = profile?.handle ? `@${profile.handle}` : '';
  const displayName = profile?.displayName || user.displayName || '';
  const followers = profile?.followerCount ?? 0;
  const following = profile?.followingCount ?? 0;
  const bio = profile?.bio || '';
  const location = profile?.location || '';
  // Avatar badge: number of outfits this user has saved. Server-side
  // counter trigger maintains profile.outfitCount; we render the small
  // pill in the corner of the avatar like the "14" in the Lekondo
  // capture. Hidden when 0 (would otherwise be visual noise).
  const outfitCount = profile?.outfitCount ?? 0;
  const photoURL = user.photoURL || profile?.photoURL;

  // "Invite" = friend invite. Shares a referral link back to the user's
  // own public profile (so the recipient lands on their look first),
  // else just the app URL if no handle yet.
  const onInvite = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://drape-9e532.web.app';
    const url = profile?.handle ? `${origin}/u/${profile.handle}` : origin;
    try {
      await shareLink({
        title: t('inviteShareTitle'),
        text: t('inviteShareText'),
        url,
      });
    } catch (err) {
      console.warn('invite share failed', err?.message);
    }
  };

  return (
    <div className="profile">
      <header className="profile-topbar">
        <span className="profile-handle">{handle}</span>
        <div className="profile-topbar-actions">
          <button type="button" className="btn-invite" onClick={onInvite}>
            {t('invite')}
          </button>
          <button type="button" className="icon-btn" aria-label={t('notifications')}>
            <Bell size={20} strokeWidth={1.6} />
          </button>
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
          {outfitCount > 0 && (
            <span className="profile-avatar-badge" aria-label={`${outfitCount} outfits`}>
              {outfitCount}
            </span>
          )}
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
            <span><strong>{followers}</strong> {t('followers')}</span>
            <span className="profile-stats-sep">/</span>
            <span><strong>{following}</strong> {t('following')}</span>
          </div>
          {location && (
            <div className="profile-location">
              <MapPin size={12} strokeWidth={1.6} />
              <span>{location}</span>
            </div>
          )}
        </div>

      </section>

      {bio && <p className="profile-bio">{bio}</p>}

      <nav className="profile-tabs" role="tablist" aria-label="Profile sections">
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
        {activeTab === 'calendar' && <Calendar user={user} onSignIn={onSignIn} embedded />}
        {activeTab === 'closet' && <Closet user={user} authReady={authReady} onSignIn={onSignIn} embedded />}
        {activeTab === 'boards' && <BoardList user={user} onSignIn={onSignIn} embedded />}
        {activeTab === 'tryon' && <TryOnHistory user={user} onSignIn={onSignIn} embedded />}
      </div>

      <ClaimHandleModal
        open={profileLoaded && !profile?.handle && !skipClaim}
        onClose={() => setSkipClaim(true)}
      />
    </div>
  );
}

export default Profile;
