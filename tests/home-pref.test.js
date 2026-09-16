import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHomePref, setHomePref, getHomeRoute } from '../src/services/homePref.js';

// jsdom isn't configured for this suite, so stand up the one API the module
// touches. Keeps the migration covered without pulling in a DOM environment.
const store = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  clear: () => store.clear(),
});

describe('home screen preference', () => {
  beforeEach(() => store.clear());

  // The feed lost its tab in 2.1.0. Honoring a stored 'feed' would cold-start
  // those users onto a surface with no nav entry to leave it by.
  it('migrates the legacy feed choice to trends', () => {
    store.set('drape_home', 'feed');
    expect(getHomePref()).toBe('trends');
    expect(getHomeRoute()).toBe('/trends');
  });

  it('round-trips trends', () => {
    setHomePref('trends');
    expect(getHomePref()).toBe('trends');
    expect(getHomeRoute()).toBe('/trends');
  });

  it('round-trips profile', () => {
    setHomePref('profile');
    expect(getHomePref()).toBe('profile');
    expect(getHomeRoute()).toBe('/profile');
  });

  it('defaults to the closet when never chosen', () => {
    expect(getHomePref()).toBe(null);
    expect(getHomeRoute()).toBe('/profile');
  });

  it('refuses a value it cannot route', () => {
    setHomePref('feed');
    expect(store.get('drape_home')).toBeUndefined();
    setHomePref('nonsense');
    expect(getHomePref()).toBe(null);
  });
});
