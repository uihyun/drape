// === MarketplaceService =================================================
// Read-only queries over the `items` collection filtered to listings
// (items where forSale==true). Reuses the existing item doc rather than
// duplicating into a separate /listings/ collection — the item already
// holds image, name, brand, tags, price, condition, sellerId (userId).
//
// Listings are public-readable per the items/list rule:
//   allow list: if resource.data.forSale == true (no auth required).

import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase.js';

const ITEMS = 'items';

export const MarketplaceService = {
  // Recent listings, newest first. Pagination via lastDoc cursor.
  async listRecent({ pageSize = 30, lastDoc = null, conditionGrade = null } = {}) {
    const constraints = [where('forSale', '==', true)];
    if (conditionGrade) constraints.push(where('conditionGrade', '==', conditionGrade));
    constraints.push(orderBy('listedAt', 'desc'));
    constraints.push(limit(pageSize));
    let q = query(collection(db, ITEMS), ...constraints);
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return {
      listings: snap.docs.map(d => ({ id: d.id, ...d.data() })),
      lastVisible: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    };
  },

  // Listings by a specific seller (e.g. on the Profile → Marketplace tab).
  async listBySeller({ uid, pageSize = 30 }) {
    const q = query(
      collection(db, ITEMS),
      where('userId', '==', uid),
      where('forSale', '==', true),
      orderBy('listedAt', 'desc'),
      limit(pageSize),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
};
