import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { ProfileService } from '../services/profile-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { FollowButton } from '../components/FollowButton.jsx';
import { FollowListSheet } from '../components/FollowListSheet.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { ExpandableBio } from '../components/ExpandableBio.jsx';
import { formatCount } from '../utils/formatCount.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Read-only profile for *other* users (route: /u/:handle). Same identity
// header as the owner Profile (handle, avatar with 14 badge, name +
// IG, follower/following counts, location) but Invite is replaced with
// a Follow button and the closet / calendar tabs are omitted — only the
// public Outfits grid renders, matching what other people can actually
// see.
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

export function PublicProfile({ user, onSignIn }) {
  const { t, lang } = useLocale();
  const { handle } = useParams();
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not found
  const [outfits, setOutfits] = useState(null);
  const [followSheet, setFollowSheet] = useState(null);

  useEffect(() => {
    if (!handle) { setProfile(null); return; }
    let cancelled = false;
    ProfileService.getByHandle(handle).then(p => {
      if (cancelled) return;
      setProfile(p);
    });
    return () => { cancelled = true; };
  }, [handle]);

  useEffect(() => {
    if (!profile?.uid) { setOutfits([]); return; }
    OutfitService.getFeedOutfits({ userIds: [profile.uid], pageSize: 30 })
      .then(({ outfits }) => setOutfits(outfits))
      .catch(() => setOutfits([]));
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
  const location = profile.location || '';
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
            <FollowButton targetUid={profile.uid} user={user} onSignInRequest={onSignIn} />
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
          {outfitCount > 0 && (
            <span className="profile-avatar-badge" aria-label={`${outfitCount} outfits`}>
              {outfitCount}
            </span>
          )}
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

      <div className="profile-public-tab">
        <span>{t('profileTabs.outfits')}</span>
      </div>

      {outfits === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : outfits.length === 0 ? (
        <div className="empty-state">
          <p>{t('publicProfileEmpty')}</p>
        </div>
      ) : (
        <div className="moodboard-grid">
          {outfits.map(o => (
            <div key={o.id} className="moodboard-item">
              <Link to={`/o/${o.id}`} className="feed-card">
                <div className="feed-card-cover">
                  {o.coverUrl
                    ? <img src={o.coverUrl} alt={o.name || ''} loading="lazy" />
                    : <div className="feed-card-cover-empty" />}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      <FollowListSheet
        open={!!followSheet}
        uid={profile.uid}
        kind={followSheet}
        onClose={() => setFollowSheet(null)}
      />
    </div>
  );
}

export default PublicProfile;
