// Splash warm-up: while the animated splash plays, prefetch the first surfaces
// the user lands on (home feed, my-outfits, profile, calendar, closet) and
// prime the shared caches (services/uiCache) so those pages paint instantly.
// Best-effort and bounded — every task is guarded and the whole thing is
// awaited with Promise.allSettled so one slow query can't stall the splash
// (the splash also has its own hard cap).
import { OutfitService } from './outfit-service.js';
import { ItemService } from './item-service.js';
import { ProfileService } from './profile-service.js';
import { FollowService, FOLLOWING_FEED_LIMIT } from './follow-service.js';
import { feedCache, feedKey, olCache, olKey, calendarWarm, closetWarm } from './uiCache.js';

function monthBounds(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth();
  const mm = String(m + 1).padStart(2, '0');
  const last = new Date(y, m + 1, 0).getDate();
  return { key: `${y}-${mm}`, monthStart: `${y}-${mm}-01`, monthEnd: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

// Resolve with the FIRST value an onSnapshot subscription emits, then detach —
// warms the SDK's in-memory cache without leaving a live listener around.
function firstSnapshot(subscribe) {
  return new Promise((resolve) => {
    let unsub = null, done = false;
    const finish = (v) => { if (done) return; done = true; try { unsub && unsub(); } catch { /* noop */ } resolve(v); };
    try { unsub = subscribe(finish); } catch { finish(null); }
    setTimeout(() => finish(null), 3000); // safety
  });
}

let warmedOnce = false;

export async function warmUp(user) {
  if (warmedOnce) return; // once per cold start
  warmedOnce = true;

  const tasks = [];

  // Public discovery feed — everyone, including anonymous/guest.
  tasks.push(
    OutfitService.listPublicFeed({ pageSize: 24, sortBy: 'latest' })
      .then(({ ootds }) => feedCache.set(feedKey('ootds', 'latest', 'forYou'), ootds))
      .catch(() => {}),
  );

  const uid = user && !user.isAnonymous ? user.uid : null;
  if (uid) {
    tasks.push(
      FollowService.getFollowingIds(uid, { max: FOLLOWING_FEED_LIMIT })
        .then(ids => (ids?.length
          ? OutfitService.listFollowingFeed({ followingIds: ids, pageSize: 24 })
            .then(rows => feedCache.set(feedKey('ootds', 'latest', 'following'), rows))
          : null))
        .catch(() => {}),
    );
    tasks.push(
      OutfitService.listMyOotds({ uid, pageSize: 60 })
        .then(({ ootds }) => olCache.set(olKey(uid, 'mine'), ootds)).catch(() => {}),
    );
    tasks.push(
      OutfitService.listBookmarkedOotds({ uid })
        .then(({ ootds }) => olCache.set(olKey(uid, 'saved'), ootds)).catch(() => {}),
    );
    tasks.push(ProfileService.getByUid(uid).catch(() => {}));

    const mb = monthBounds();
    tasks.push(
      firstSnapshot(cb => OutfitService.subscribeMonth({ uid, monthStart: mb.monthStart, monthEnd: mb.monthEnd }, cb))
        .then(map => { if (map) calendarWarm.set(`${uid}|${mb.key}`, map); }),
    );
    tasks.push(
      firstSnapshot(cb => ItemService.subscribeMyCloset(uid, cb))
        .then(items => { if (items) closetWarm.set(uid, items); }),
    );
  }

  await Promise.allSettled(tasks);
}
