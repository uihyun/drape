import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firebase surface item-service imports, capturing what setDoc writes
// so we can assert the `kind` chosen by createFromDetected's owned flag.
const writes = [];
vi.mock('firebase/firestore', () => ({
  doc: (...a) => ({ __doc: a }),
  setDoc: async (_ref, data) => { writes.push(data); },
  collection: () => ({}),
  serverTimestamp: () => '__ts',
  getDoc: async () => ({ exists: () => false, data: () => ({}) }),
  getDocs: async () => ({ docs: [] }),
  query: () => ({}), where: () => ({}), orderBy: () => ({}), limit: () => ({}),
  updateDoc: async () => {}, deleteDoc: async () => {}, writeBatch: () => ({ set(){}, commit: async()=>{} }),
  onSnapshot: () => () => {}, arrayUnion: (x)=>x, arrayRemove:(x)=>x, increment:(x)=>x,
}));
vi.mock('firebase/storage', () => ({
  ref: () => ({}),
  uploadBytes: async () => ({}),
  getDownloadURL: async () => 'https://example/test.jpg',
  deleteObject: async () => {},
}));
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async () => ({ data: {} }),
}));
vi.mock('../src/firebase.js', () => ({
  db: {}, storage: {}, functions: {},
  auth: { currentUser: { uid: 'u1' } },
}));
vi.mock('../src/services/storageCache.js', () => ({ IMG_CACHE: 'test' }));
vi.mock('../src/services/taxonomy.js', () => ({ TAXONOMY: { CATEGORIES: [], COLORS: [], STYLES: [] } }));

const { ItemService } = await import('../src/services/item-service.js');

beforeEach(() => { writes.length = 0; });

const piece = (n) => ({ name: n, category: 'top', colors: ['black'], description: `${n} desc` });

describe('createFromDetected owned flag', () => {
  it('saves as wishlist by default (detected from someone else\'s photo)', async () => {
    await ItemService.createFromDetected({ blob: new Blob(), detected: piece('shirt') });
    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe('wishlist');
  });

  it('saves as owned when owned:true (bulk-add my own closet)', async () => {
    await ItemService.createFromDetected({ blob: new Blob(), detected: piece('jeans'), owned: true });
    expect(writes[0].kind).toBe('owned');
  });

  it('carries detected tags + name onto the item doc', async () => {
    await ItemService.createFromDetected({ blob: new Blob(), detected: piece('cap'), owned: true });
    expect(writes[0].name).toBe('cap');
    expect(writes[0].tags.category).toBe('top');
    expect(writes[0].tags.colors).toEqual(['black']);
    expect(writes[0].status).toBe('processing');
  });
});

describe('bulk add-all loop semantics', () => {
  // Mirror AnalyzePhoto.addAllInBatch: iterate items, skip already-saved keys,
  // save the rest. Verify all unsaved pieces in a multi-item photo get written.
  it('writes one doc per not-yet-saved detected piece', async () => {
    const items = [piece('top'), piece('pants'), piece('shoes')];
    const savedKeys = new Set(['0:1']); // pretend 'pants' already added
    for (let i = 0; i < items.length; i++) {
      if (savedKeys.has(`0:${i}`)) continue;
      await ItemService.createFromDetected({ blob: new Blob(), detected: items[i], owned: true });
    }
    // top + shoes written, pants skipped
    expect(writes).toHaveLength(2);
    expect(writes.map(w => w.name)).toEqual(['top', 'shoes']);
    expect(writes.every(w => w.kind === 'owned')).toBe(true);
  });
});
