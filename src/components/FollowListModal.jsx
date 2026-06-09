import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logEvent, analytics } from '../firebase.js';
import { FollowService } from '../services/follow-service.js';
import { ProfileService, DEFAULT_DISPLAY_NAME } from '../services/profile-service.js';
import { FollowButton } from './FollowButton.jsx';
import { Avatar } from './Avatar.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Instagram 식 followers/following 모달. 두 탭 (Followers / Following) 사이
// 토글, 페이지네이션 (30 per page) 으로 lazy load. 탭한 row 는 그 사용자
// 프로필로 이동하며 모달 자동 닫힘.
//
// Props:
//   - uid: 보여줄 사용자의 UID (자기 자신 또는 남)
//   - displayName: 헤더에 노출할 이름 (선택, 본인이면 'You' 등 i18n)
//   - initialTab: 'followers' | 'following' — 어느 탭으로 시작할지
//   - currentUser: 현재 로그인 사용자 (FollowButton 에 전달)
//   - onSignInRequest: 비로그인 사용자 follow 시도 시 sign-in 모달 열기
//   - onClose: 모달 닫기
export function FollowListModal({
  uid,
  displayName,
  initialTab = 'followers',
  currentUser,
  onSignInRequest,
  onClose,
}) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [tab, setTab] = useState(initialTab);

  // 두 탭은 별도 데이터 — 탭 전환 시 cache 한 결과 그대로 보여주고 새로 fetch
  // 안 함 (사용자가 다시 모달 열 때 fresh).
  const [data, setData] = useState({
    followers: { profiles: [], lastVisible: null, hasMore: false, loaded: false, loading: false },
    following: { profiles: [], lastVisible: null, hasMore: false, loaded: false, loading: false },
  });

  const loadPage = useCallback(async (which, reset = false) => {
    setData(prev => ({
      ...prev,
      [which]: { ...prev[which], loading: true },
    }));
    try {
      const fn = which === 'followers' ? FollowService.listFollowers : FollowService.listFollowing;
      const lastDoc = reset ? null : data[which].lastVisible;
      const { uids, lastVisible, hasMore } = await fn(uid, { lastDoc });
      // UID → profile 일괄 resolve. 일부 uid 의 profile 이 없을 수도 있어
      // (handle 미생성 / 마이그레이션 잔재 / 삭제된 계정의 빈 껍데기) — handle
      // 없는 행은 어디로도 못 가는 유령이라 거른다.
      const profMap = await ProfileService.getProfilesByUids(uids);
      const profiles = uids.map(u => profMap.get(u)).filter(p => p && p.handle);
      setData(prev => ({
        ...prev,
        [which]: {
          profiles: reset ? profiles : [...prev[which].profiles, ...profiles],
          lastVisible,
          hasMore,
          loaded: true,
          loading: false,
        },
      }));
    } catch (err) {
      console.error(`load ${which} failed:`, err);
      setData(prev => ({
        ...prev,
        [which]: { ...prev[which], loading: false, loaded: true },
      }));
    }
  }, [uid, data]);

  useEffect(() => {
    if (!data[tab].loaded && !data[tab].loading) {
      loadPage(tab, true);
    }
  }, [tab, data, loadPage]);

  useEffect(() => {
    logEvent(analytics, 'follow_list_opened', { uid, tab: initialTab });
    // ESC 닫기.
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRowClick = (handle) => {
    if (!handle) return;
    navigate(`/u/${handle}`);
    onClose?.();
  };

  const current = data[tab];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="follow-list-card" onClick={e => e.stopPropagation()}>
        <header className="follow-list-header">
          <h3 className="follow-list-title">
            {displayName || t('profileFollowers')}
          </h3>
        </header>

        <div className="follow-list-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'followers'}
            className={`follow-list-tab ${tab === 'followers' ? 'active' : ''}`}
            onClick={() => setTab('followers')}
          >
            {t('profileFollowers')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'following'}
            className={`follow-list-tab ${tab === 'following' ? 'active' : ''}`}
            onClick={() => setTab('following')}
          >
            {t('profileFollowing')}
          </button>
        </div>

        <div className="follow-list-body">
          {!current.loaded && current.loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : current.profiles.length === 0 ? (
            <p className="follow-list-empty">
              {tab === 'followers' ? t('followersEmpty') : t('followingEmpty2')}
            </p>
          ) : (
            <ul className="follow-list-rows">
              {current.profiles.map(p => {
                // Instagram 식 — @handle 이 primary (큰 글자), displayName 이 custom
                // 일 때만 부제목. default/빈 값이면 한 줄 (@handle 만).
                const hasCustomName = p.displayName && p.displayName !== DEFAULT_DISPLAY_NAME;
                return (
                  <li key={p.uid} className="follow-list-row">
                    <button
                      type="button"
                      className="follow-list-row-user"
                      onClick={() => handleRowClick(p.handle)}
                    >
                      <Avatar src={p.photoURL} name={p.handle || p.displayName} size={44} className="follow-list-avatar" />
                      <div className="follow-list-row-meta">
                        <span className="follow-list-row-name">@{p.handle}</span>
                        {hasCustomName && (
                          <span className="follow-list-row-handle">{p.displayName}</span>
                        )}
                      </div>
                    </button>
                    <FollowButton
                      targetUid={p.uid}
                      user={currentUser}
                      onSignInRequest={onSignInRequest}
                      size="sm"
                    />
                  </li>
                );
              })}
              {current.hasMore && (
                <li className="follow-list-more">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => loadPage(tab, false)}
                    disabled={current.loading}
                  >
                    {current.loading ? t('loading') : t('loadMore')}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
