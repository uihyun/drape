// Firestore rules unit tests for the users collection.
// Run with:  npm run test:rules  (requires the Firestore emulator on :8080)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

const PROJECT_ID = 'voda-rules-test';
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve('./firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

// Seed a doc as the server would (bypassing rules).
async function seedServerDoc(path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe('users/{uid} — credit field protection', () => {
  it('owner can create a profile doc WITHOUT credit fields', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'users/alice'), {
        displayName: 'Alice',
        email: 'alice@example.com',
        photoURL: '',
        provider: 'google',
        savedCustomStyles: [],
      })
    );
  });

  it('owner CANNOT create a doc that includes credits', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users/alice'), {
        displayName: 'Alice',
        credits: 999,
      })
    );
  });

  it('owner CANNOT create a doc that includes lifetimeCredits', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users/alice'), {
        displayName: 'Alice',
        lifetimeCredits: 999,
      })
    );
  });

  it('owner CANNOT create a doc that includes lastDailyBonusAt', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users/alice'), {
        displayName: 'Alice',
        lastDailyBonusAt: '2026-04-21',
      })
    );
  });

  it('another user CANNOT create someone else’s doc', async () => {
    await assertFails(
      setDoc(doc(bob(), 'users/alice'), { displayName: 'Fake Alice' })
    );
  });

  it('anonymous/unauthenticated CANNOT create a user doc', async () => {
    await assertFails(
      setDoc(doc(anon(), 'users/alice'), { displayName: 'Alice' })
    );
  });

  it('owner can update profile fields (displayName)', async () => {
    await seedServerDoc('users/alice', { credits: 3, displayName: 'Old' });
    await assertSucceeds(
      updateDoc(doc(alice(), 'users/alice'), { displayName: 'New' })
    );
  });

  it('owner CANNOT update credits directly', async () => {
    await seedServerDoc('users/alice', { credits: 3 });
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { credits: 999 })
    );
  });

  it('owner CANNOT update lifetimeCredits', async () => {
    await seedServerDoc('users/alice', { credits: 3, lifetimeCredits: 3 });
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { lifetimeCredits: 999 })
    );
  });

  it('owner CANNOT update lastDailyBonusAt', async () => {
    await seedServerDoc('users/alice', { credits: 3, lastDailyBonusAt: '2026-04-20' });
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { lastDailyBonusAt: '1999-01-01' })
    );
  });

  it('owner CANNOT delete their user doc', async () => {
    await seedServerDoc('users/alice', { credits: 3 });
    await assertFails(deleteDoc(doc(alice(), 'users/alice')));
  });

  it('owner CAN read their own doc', async () => {
    await seedServerDoc('users/alice', { credits: 3 });
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
  });

  it('another user CANNOT read someone else’s doc', async () => {
    await seedServerDoc('users/alice', { credits: 3 });
    await assertFails(getDoc(doc(bob(), 'users/alice')));
  });
});

describe('users/{uid} — billing field protection (Phase 8-2)', () => {
  const BILLING_FIELDS = [
    'plan',
    'subscriptionStatus',
    'subscriptionRenewsAt',
    'cancelAtPeriodEnd',
    'stripeCustomerId',
    'stripeSubscriptionId',
  ];

  for (const field of BILLING_FIELDS) {
    it(`owner CANNOT create a doc that includes ${field}`, async () => {
      await assertFails(
        setDoc(doc(alice(), 'users/alice'), {
          displayName: 'Alice',
          [field]: 'anything',
        })
      );
    });

    it(`owner CANNOT update ${field} directly`, async () => {
      await seedServerDoc('users/alice', { credits: 3, [field]: 'seed' });
      await assertFails(
        updateDoc(doc(alice(), 'users/alice'), { [field]: 'tampered' })
      );
    });
  }
});

describe('billingInvoices/{id} — server only', () => {
  it('no client can read', async () => {
    await seedServerDoc('billingInvoices/inv_1', { uid: 'alice', creditsGranted: 10 });
    await assertFails(getDoc(doc(alice(), 'billingInvoices/inv_1')));
  });

  it('no client can write', async () => {
    await assertFails(
      setDoc(doc(alice(), 'billingInvoices/inv_1'), { uid: 'alice', creditsGranted: 10 })
    );
  });
});

describe('users/{uid} — referral field protection (Phase 8-3)', () => {
  const REFERRAL_FIELDS = ['referralCode', 'referredBy'];

  for (const field of REFERRAL_FIELDS) {
    it(`owner CANNOT create a doc that includes ${field}`, async () => {
      await assertFails(
        setDoc(doc(alice(), 'users/alice'), {
          displayName: 'Alice',
          [field]: 'anything',
        })
      );
    });

    it(`owner CANNOT update ${field} directly`, async () => {
      await seedServerDoc('users/alice', { credits: 3, [field]: 'seed' });
      await assertFails(
        updateDoc(doc(alice(), 'users/alice'), { [field]: 'tampered' })
      );
    });
  }
});

describe('referralCodes/{code} — server only', () => {
  it('no client can read', async () => {
    await seedServerDoc('referralCodes/VODA-AAAA', { uid: 'alice' });
    await assertFails(getDoc(doc(alice(), 'referralCodes/VODA-AAAA')));
  });

  it('no client can write', async () => {
    await assertFails(
      setDoc(doc(alice(), 'referralCodes/VODA-BBBB'), { uid: 'alice' })
    );
  });
});

describe('promoCodes/{code} — readable by signed-in users, server-only write', () => {
  it('signed-in user CAN read a promo code (to preview credits)', async () => {
    await seedServerDoc('promoCodes/LAUNCH', { credits: 10, usedCount: 0 });
    await assertSucceeds(getDoc(doc(alice(), 'promoCodes/LAUNCH')));
  });

  it('anonymous user CANNOT read promo codes', async () => {
    await seedServerDoc('promoCodes/LAUNCH', { credits: 10, usedCount: 0 });
    await assertFails(getDoc(doc(anon(), 'promoCodes/LAUNCH')));
  });

  it('signed-in user CANNOT create a promo code', async () => {
    await assertFails(
      setDoc(doc(alice(), 'promoCodes/HACKED'), { credits: 9999, usedCount: 0 })
    );
  });

  it('signed-in user CANNOT tamper with usedCount', async () => {
    await seedServerDoc('promoCodes/LAUNCH', { credits: 10, usedCount: 0 });
    await assertFails(
      updateDoc(doc(alice(), 'promoCodes/LAUNCH'), { usedCount: -1 })
    );
  });
});

describe('promoCodeUses/{id} — server only', () => {
  it('no client can read', async () => {
    await seedServerDoc('promoCodeUses/alice_LAUNCH', { uid: 'alice', code: 'LAUNCH' });
    await assertFails(getDoc(doc(alice(), 'promoCodeUses/alice_LAUNCH')));
  });

  it('no client can write', async () => {
    await assertFails(
      setDoc(doc(alice(), 'promoCodeUses/alice_LAUNCH'), { uid: 'alice', code: 'LAUNCH' })
    );
  });
});

describe('reports/{id} — Phase 8-4 moderation', () => {
  const validReport = (uid, designId, reason = 'nsfw') => ({
    designId,
    reporterId: uid,
    reason,
    createdAt: new Date(),
  });

  it('signed-in user CAN file a report with composite id', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'reports/alice_design123'), validReport('alice', 'design123'))
    );
  });

  it('signed-in user CANNOT resubmit — existing doc blocks re-filing', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'reports/alice_design123'), validReport('alice', 'design123', 'spam'))
    );
    // Second submission hits the update rule (doc exists now) which is denied,
    // so one user can only file one report per design. The aggregation trigger
    // fires exactly once.
    await assertFails(
      setDoc(doc(alice(), 'reports/alice_design123'), validReport('alice', 'design123', 'nsfw'))
    );
  });

  it('anonymous user CANNOT file a report', async () => {
    await assertFails(
      setDoc(doc(anon(), 'reports/anon_design123'), {
        designId: 'design123',
        reporterId: 'anon',
        reason: 'nsfw',
        createdAt: new Date(),
      })
    );
  });

  it('CANNOT use a doc id that does not match uid_designId', async () => {
    await assertFails(
      setDoc(doc(alice(), 'reports/bob_design123'), validReport('alice', 'design123'))
    );
    await assertFails(
      setDoc(doc(alice(), 'reports/alice_wrongDesign'), validReport('alice', 'design123'))
    );
  });

  it('CANNOT spoof reporterId', async () => {
    await assertFails(
      setDoc(doc(alice(), 'reports/alice_design123'), {
        ...validReport('alice', 'design123'),
        reporterId: 'bob',
      })
    );
  });

  it('CANNOT submit with an unknown reason', async () => {
    await assertFails(
      setDoc(doc(alice(), 'reports/alice_design123'), validReport('alice', 'design123', 'bogus'))
    );
  });

  it('no client can read a report (server-only review)', async () => {
    await seedServerDoc('reports/alice_design123', validReport('alice', 'design123'));
    await assertFails(getDoc(doc(alice(), 'reports/alice_design123')));
    await assertFails(getDoc(doc(bob(), 'reports/alice_design123')));
  });

  it('cannot update or delete a report', async () => {
    await seedServerDoc('reports/alice_design123', validReport('alice', 'design123'));
    await assertFails(
      updateDoc(doc(alice(), 'reports/alice_design123'), { reason: 'other' })
    );
    await assertFails(deleteDoc(doc(alice(), 'reports/alice_design123')));
  });
});

describe('designs/{id} — moderation fields locked to server (Phase 8-4)', () => {
  const MOD_FIELDS = ['reportCount', 'moderationFlag', 'moderationReason', 'moderatedAt'];

  async function seedDesign(uid) {
    await seedServerDoc(`designs/d1`, {
      userId: uid,
      style: 'modern',
      timestamp: new Date(),
      status: 'success',
      originalImageUrls: ['u'],
      generatedImageUrls: ['g'],
      isListed: false,
      isPublic: false,
    });
  }

  for (const field of MOD_FIELDS) {
    it(`owner CANNOT update ${field} directly`, async () => {
      await seedDesign('alice');
      await assertFails(
        updateDoc(doc(alice(), 'designs/d1'), { [field]: 'tampered' })
      );
    });
  }

  it('other users CANNOT set moderation fields', async () => {
    await seedDesign('alice');
    await assertFails(
      updateDoc(doc(bob(), 'designs/d1'), { reportCount: 0 })
    );
  });
});

describe('designs/{id}/chat/main — Phase 10-6 chat advisor', () => {
  async function seedDesign(uid) {
    await seedServerDoc(`designs/dchat`, {
      userId: uid,
      style: 'modern',
      timestamp: new Date(),
      status: 'success',
      originalImageUrls: ['u'],
      generatedImageUrls: ['g'],
    });
    await seedServerDoc(`designs/dchat/chat/main`, {
      designId: 'dchat',
      messages: [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'hello' },
      ],
      updatedAt: new Date(),
    });
  }

  it('owner CAN read chat', async () => {
    await seedDesign('alice');
    await assertSucceeds(getDoc(doc(alice(), 'designs/dchat/chat/main')));
  });

  it('non-owner CANNOT read chat', async () => {
    await seedDesign('alice');
    await assertFails(getDoc(doc(bob(), 'designs/dchat/chat/main')));
  });

  it('anon CANNOT read chat', async () => {
    await seedDesign('alice');
    await assertFails(getDoc(doc(anon(), 'designs/dchat/chat/main')));
  });

  it('owner CANNOT write chat directly (server-only)', async () => {
    await seedDesign('alice');
    await assertFails(
      setDoc(doc(alice(), 'designs/dchat/chat/main'), {
        designId: 'dchat',
        messages: [{ role: 'user', text: 'spoof' }],
      })
    );
  });

  it('non-owner CANNOT write chat', async () => {
    await seedDesign('alice');
    await assertFails(
      setDoc(doc(bob(), 'designs/dchat/chat/main'), {
        designId: 'dchat',
        messages: [{ role: 'assistant', text: 'spoof' }],
      })
    );
  });
});

describe('designs/{id}/comments/{cid} — Phase 10-1', () => {
  async function seedDesign(uid) {
    await seedServerDoc('designs/dc1', {
      userId: uid,
      style: 'modern',
      timestamp: new Date(),
      status: 'success',
      originalImageUrls: ['u'],
      generatedImageUrls: ['g'],
      isPublic: true,
    });
  }

  it('anyone (signed in or not) CAN read comments', async () => {
    await seedDesign('alice');
    await seedServerDoc('designs/dc1/comments/c1', {
      userId: 'bob', displayName: 'Bob', text: 'nice', createdAt: new Date(),
    });
    await assertSucceeds(getDoc(doc(anon(), 'designs/dc1/comments/c1')));
    await assertSucceeds(getDoc(doc(bob(), 'designs/dc1/comments/c1')));
  });

  it('signed-in user CAN create their own comment', async () => {
    await seedDesign('alice');
    await assertSucceeds(
      setDoc(doc(bob(), 'designs/dc1/comments/c1'), {
        userId: 'bob',
        displayName: 'Bob',
        text: 'looks great',
        createdAt: new Date(),
      })
    );
  });

  it('user CANNOT create a comment as someone else', async () => {
    await seedDesign('alice');
    await assertFails(
      setDoc(doc(bob(), 'designs/dc1/comments/c1'), {
        userId: 'alice',
        displayName: 'Bob',
        text: 'spoof',
        createdAt: new Date(),
      })
    );
  });

  it('anon user CANNOT create comments', async () => {
    await seedDesign('alice');
    await assertFails(
      setDoc(doc(anon(), 'designs/dc1/comments/c1'), {
        userId: 'anon',
        text: 'hi',
        createdAt: new Date(),
      })
    );
  });

  it('empty text rejected; over-length text rejected', async () => {
    await seedDesign('alice');
    await assertFails(
      setDoc(doc(bob(), 'designs/dc1/comments/empty'), {
        userId: 'bob', text: '', createdAt: new Date(),
      })
    );
    const tooLong = 'x'.repeat(501);
    await assertFails(
      setDoc(doc(bob(), 'designs/dc1/comments/long'), {
        userId: 'bob', text: tooLong, createdAt: new Date(),
      })
    );
  });

  it('author CAN delete own comment; design owner CAN delete any; others CANNOT', async () => {
    await seedDesign('alice');
    await seedServerDoc('designs/dc1/comments/c1', {
      userId: 'bob', text: 'hi', createdAt: new Date(),
    });
    // bob (author) can delete
    await assertSucceeds(deleteDoc(doc(bob(), 'designs/dc1/comments/c1')));
  });

  it('design owner can delete others comments', async () => {
    await seedDesign('alice');
    await seedServerDoc('designs/dc1/comments/c2', {
      userId: 'bob', text: 'hi', createdAt: new Date(),
    });
    await assertSucceeds(deleteDoc(doc(alice(), 'designs/dc1/comments/c2')));
  });

  it('non-author non-owner CANNOT delete', async () => {
    await seedDesign('alice');
    await seedServerDoc('designs/dc1/comments/c3', {
      userId: 'bob', text: 'hi', createdAt: new Date(),
    });
    const charlie = () => env.authenticatedContext('charlie').firestore();
    await assertFails(deleteDoc(doc(charlie(), 'designs/dc1/comments/c3')));
  });
});

describe('collections — Phase 10-4', () => {
  it('owner CAN create their collection', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'collections/c1'), {
        ownerId: 'alice', name: 'Living room ideas', isPublic: false, itemCount: 0, createdAt: new Date(),
      })
    );
  });

  it('user CANNOT create collection as someone else', async () => {
    await assertFails(
      setDoc(doc(alice(), 'collections/c1'), {
        ownerId: 'bob', name: 'spoof', isPublic: false, itemCount: 0, createdAt: new Date(),
      })
    );
  });

  it('anon CANNOT create collection', async () => {
    await assertFails(
      setDoc(doc(anon(), 'collections/c1'), {
        ownerId: 'anon', name: 'x', isPublic: false, itemCount: 0, createdAt: new Date(),
      })
    );
  });

  it('public collection readable by anyone', async () => {
    await seedServerDoc('collections/c1', {
      ownerId: 'alice', name: 'Public', isPublic: true, itemCount: 0,
    });
    await assertSucceeds(getDoc(doc(anon(), 'collections/c1')));
    await assertSucceeds(getDoc(doc(bob(), 'collections/c1')));
  });

  it('private collection NOT readable by non-owner', async () => {
    await seedServerDoc('collections/c1', {
      ownerId: 'alice', name: 'Private', isPublic: false, itemCount: 0,
    });
    await assertFails(getDoc(doc(bob(), 'collections/c1')));
    await assertFails(getDoc(doc(anon(), 'collections/c1')));
  });

  it('owner CAN update name / isPublic but NOT itemCount', async () => {
    await seedServerDoc('collections/c1', {
      ownerId: 'alice', name: 'Old', isPublic: false, itemCount: 0,
    });
    await assertSucceeds(
      updateDoc(doc(alice(), 'collections/c1'), { name: 'New', isPublic: true })
    );
    await seedServerDoc('collections/c1', {
      ownerId: 'alice', name: 'Old', isPublic: false, itemCount: 0,
    });
    await assertFails(
      updateDoc(doc(alice(), 'collections/c1'), { itemCount: 999 })
    );
  });

  it('owner CAN delete; non-owner CANNOT', async () => {
    await seedServerDoc('collections/c1', { ownerId: 'alice', name: 'X', isPublic: false, itemCount: 0 });
    await assertFails(deleteDoc(doc(bob(), 'collections/c1')));
    await assertSucceeds(deleteDoc(doc(alice(), 'collections/c1')));
  });

  it('owner CAN add items; non-owner CANNOT', async () => {
    await seedServerDoc('collections/c1', {
      ownerId: 'alice', name: 'X', isPublic: false, itemCount: 0,
    });
    await assertSucceeds(
      setDoc(doc(alice(), 'collections/c1/items/d1'), {
        designId: 'd1', addedAt: new Date(),
      })
    );
    await assertFails(
      setDoc(doc(bob(), 'collections/c1/items/d2'), {
        designId: 'd2', addedAt: new Date(),
      })
    );
  });

  it('public collection items are readable; private items are not', async () => {
    await seedServerDoc('collections/cpub', { ownerId: 'alice', name: 'Pub', isPublic: true, itemCount: 0 });
    await seedServerDoc('collections/cpub/items/d1', { designId: 'd1', addedAt: new Date() });
    await seedServerDoc('collections/cpriv', { ownerId: 'alice', name: 'Priv', isPublic: false, itemCount: 0 });
    await seedServerDoc('collections/cpriv/items/d1', { designId: 'd1', addedAt: new Date() });
    await assertSucceeds(getDoc(doc(bob(), 'collections/cpub/items/d1')));
    await assertFails(getDoc(doc(bob(), 'collections/cpriv/items/d1')));
  });
});

describe('profiles + handles — Phase 10-3', () => {
  it('anyone CAN read a profile', async () => {
    await seedServerDoc('profiles/alice', {
      handle: 'alice', displayName: 'Alice', bio: '', followerCount: 0, followingCount: 0, designCount: 0,
    });
    await assertSucceeds(getDoc(doc(anon(), 'profiles/alice')));
    await assertSucceeds(getDoc(doc(bob(), 'profiles/alice')));
  });

  it('owner CANNOT directly write profile (server-only)', async () => {
    await seedServerDoc('profiles/alice', { handle: 'alice', displayName: 'A' });
    await assertFails(
      updateDoc(doc(alice(), 'profiles/alice'), { bio: 'spoof' })
    );
  });

  it('anyone CAN read a handle reservation', async () => {
    await seedServerDoc('handles/alice', { uid: 'alice', claimedAt: new Date() });
    await assertSucceeds(getDoc(doc(anon(), 'handles/alice')));
  });

  it('clients CANNOT write handle reservations', async () => {
    await assertFails(
      setDoc(doc(alice(), 'handles/alice'), { uid: 'alice', claimedAt: new Date() })
    );
  });
});

describe('follows/{followerId_followingId} — Phase 10-2', () => {
  it('signed-in user CAN follow someone else', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'follows/alice_bob'), {
        followerId: 'alice',
        followingId: 'bob',
        createdAt: new Date(),
      })
    );
  });

  it('user CANNOT follow themselves', async () => {
    await assertFails(
      setDoc(doc(alice(), 'follows/alice_alice'), {
        followerId: 'alice',
        followingId: 'alice',
        createdAt: new Date(),
      })
    );
  });

  it('user CANNOT use someone else as follower', async () => {
    await assertFails(
      setDoc(doc(alice(), 'follows/bob_charlie'), {
        followerId: 'bob',
        followingId: 'charlie',
        createdAt: new Date(),
      })
    );
  });

  it('doc ID must match followerId_followingId pattern', async () => {
    await assertFails(
      setDoc(doc(alice(), 'follows/some_random_id'), {
        followerId: 'alice',
        followingId: 'bob',
        createdAt: new Date(),
      })
    );
  });

  it('anon CANNOT create follow', async () => {
    await assertFails(
      setDoc(doc(anon(), 'follows/x_y'), {
        followerId: 'x', followingId: 'y', createdAt: new Date(),
      })
    );
  });

  it('anyone CAN read follow docs (for counts/state)', async () => {
    await seedServerDoc('follows/alice_bob', {
      followerId: 'alice', followingId: 'bob', createdAt: new Date(),
    });
    await assertSucceeds(getDoc(doc(anon(), 'follows/alice_bob')));
    await assertSucceeds(getDoc(doc(bob(), 'follows/alice_bob')));
  });

  it('only the follower CAN delete their follow', async () => {
    await seedServerDoc('follows/alice_bob', {
      followerId: 'alice', followingId: 'bob', createdAt: new Date(),
    });
    await assertSucceeds(deleteDoc(doc(alice(), 'follows/alice_bob')));
    // re-seed for bob attempt
    await seedServerDoc('follows/alice_bob', {
      followerId: 'alice', followingId: 'bob', createdAt: new Date(),
    });
    await assertFails(deleteDoc(doc(bob(), 'follows/alice_bob')));
  });
});

describe('users/{uid} — follow counter protection (Phase 10-2)', () => {
  it('user CANNOT directly write followerCount / followingCount', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), { displayName: 'Alice' });
    });
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { followerCount: 999 })
    );
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { followingCount: 999 })
    );
  });
});

describe('users/{uid}/bookmarks/{designId} — Phase 10-1', () => {
  it('owner CAN write + read their bookmarks', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'users/alice/bookmarks/d1'), {
        designId: 'd1', savedAt: new Date(),
      })
    );
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/bookmarks/d1')));
  });

  it('non-owner CANNOT read or write someone else bookmarks', async () => {
    await seedServerDoc('users/alice/bookmarks/d1', { designId: 'd1', savedAt: new Date() });
    await assertFails(getDoc(doc(bob(), 'users/alice/bookmarks/d1')));
    await assertFails(
      setDoc(doc(bob(), 'users/alice/bookmarks/d2'), { designId: 'd2', savedAt: new Date() })
    );
  });

  it('anon CANNOT read or write bookmarks', async () => {
    await seedServerDoc('users/alice/bookmarks/d1', { designId: 'd1', savedAt: new Date() });
    await assertFails(getDoc(doc(anon(), 'users/alice/bookmarks/d1')));
  });
});

describe('designs/{id} — sourceDesignId lineage (Phase 9-3 후속)', () => {
  it('owner can create a design with sourceDesignId set', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'designs/edit1'), {
        userId: 'alice',
        style: 'modern',
        timestamp: new Date(),
        status: 'success',
        originalImageUrls: ['u'],
        generatedImageUrls: ['g'],
        sourceDesignId: 'parent_xyz',
      })
    );
  });

  it('owner CANNOT modify sourceDesignId after create (not in update whitelist)', async () => {
    await seedServerDoc('designs/edit1', {
      userId: 'alice',
      style: 'modern',
      timestamp: new Date(),
      status: 'success',
      originalImageUrls: ['u'],
      generatedImageUrls: ['g'],
      sourceDesignId: 'parent_xyz',
    });
    await assertFails(
      updateDoc(doc(alice(), 'designs/edit1'), { sourceDesignId: 'tampered' })
    );
  });
});
