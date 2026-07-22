// === AdminService ======================================================
// Thin wrapper over the email-gated admin callables (functions/admin.js).
// The page never touches Firestore directly — rules block cross-account
// reads anyway, so all admin data comes back through these callables.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

const call = (name) => httpsCallable(functions, name);

export const AdminService = {
  // Full dashboard payload: bucket summary, totals, try-on health,
  // marketplace, and trailing daily trend series.
  async overview() {
    const { data } = await call('adminOverview')();
    return data;
  },

  // Items ranked by how many try-ons reference them.
  async topTryons(limit = 30) {
    const { data } = await call('adminTopTryons')({ limit });
    return data.items;
  },

  // User table for one bucket. sort: recent | activity | followers | active.
  async users({ bucket = 'real', sort = 'recent', limit = 200 } = {}) {
    const { data } = await call('adminUsers')({ bucket, sort, limit });
    return data;
  },

  // One user, deep — metrics + already-public content only.
  async userDetail(uid) {
    const { data } = await call('adminUserDetail')({ uid });
    return data;
  },

  // Recent client error logs (newest first), optional message/url filter.
  async errors({ limit = 100, q = '' } = {}) {
    const { data } = await call('adminErrors')({ limit, q });
    return data.errors;
  },

  // GA screen-engagement proxy (functions/ga.js). from/to: YYYY-MM-DD.
  async screenEngagement({ from, to }) {
    const { data } = await call('adminScreenEngagement')({ from, to });
    return data.rows;
  },

  // ── Marketing post queue (functions/marketing.js) ───────────────────
  async marketingList() {
    const { data } = await call('adminMarketingList')();
    return data.posts;
  },
  async marketingUpsert(post) {
    const { data } = await call('adminMarketingUpsert')(post);
    return data.id;
  },
  async marketingDelete(id) {
    await call('adminMarketingDelete')({ id });
  },
  // Storage-hosted creatives for the image picker.
  async marketingAssets() {
    const { data } = await call('adminMarketingAssets')();
    return data.assets;
  },
};
