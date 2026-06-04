import { useEffect, useRef, useState } from 'react';
import { isNativeApp } from '../services/platform-service.js';

// Animated cold-start splash (hims-style): the word "drape" settles, then
// r·a·p·e collapse into the "d", and a pine accent arc orbits the "d" as a
// real loader. It lifts the moment the warm-up finishes (`ready`), bounded by
// a min show time (so the motion reads) and a hard cap (so it never traps).
//
// The native iOS LaunchScreen shows the same ink base first; this fades in and
// takes over once Capacitor's SplashScreen.hide() runs.
const MERGE_AT = 1100;  // ms — word holds, then begins collapsing to "d"
const LOAD_AT = 1800;   // ms — only the "d" remains, arc starts spinning
const MIN_SHOW = 3000;  // ms — never lift before this (let the arc spin ~1.2s)
const MAX_SHOW = 6000;  // ms — hard cap regardless of warm-up
const EXIT_MS = 520;    // ms — fade-out duration

const REST = ['r', 'a', 'p', 'e']; // the letters that fold into the 'd'

export function JsSplash({ ready = false }) {
  // enter → merge (rape fold into d) → loading (arc spins) → exit → done
  const [phase, setPhase] = useState('enter');
  const [hardStop, setHardStop] = useState(false);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    mountTime.current = Date.now();
    if (isNativeApp()) {
      import(/* @vite-ignore */ '@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}))
        .catch(() => {});
    }
    const t1 = setTimeout(() => setPhase(p => (p === 'enter' ? 'merge' : p)), MERGE_AT);
    const t2 = setTimeout(() => setPhase(p => (p === 'merge' ? 'loading' : p)), LOAD_AT);
    const cap = setTimeout(() => setHardStop(true), MAX_SHOW);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(cap); };
  }, []);

  // Begin the exit once warm-up is done (or the cap fires), respecting MIN_SHOW.
  useEffect(() => {
    if (phase === 'exit' || phase === 'done') return undefined;
    if (!ready && !hardStop) return undefined;
    const wait = Math.max(0, MIN_SHOW - (Date.now() - mountTime.current));
    const t = setTimeout(() => setPhase('exit'), wait);
    return () => clearTimeout(t);
  }, [ready, hardStop, phase]);

  useEffect(() => {
    if (phase !== 'exit') return undefined;
    const t = setTimeout(() => setPhase('done'), EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return null;

  const collapsed = phase === 'merge' || phase === 'loading' || phase === 'exit';
  const showArc = phase === 'loading' || phase === 'exit';

  return (
    <div className={`js-splash${phase === 'exit' ? ' js-splash-exit' : ''}`} aria-hidden="true">
      <div className={`js-splash-stage${collapsed ? ' is-collapsed' : ''}`}>
        {/* The 'd' stays; r·a·p·e live in a wrapper whose width collapses to 0
            on merge — so the flex word shrinks to just the 'd' and the stage
            (always viewport-centered) re-centers it EXACTLY under the arc,
            independent of the other letters' widths. */}
        <h1 className="js-splash-word" aria-label="drape">
          <span className="js-splash-letter js-splash-d">
            <span className="js-splash-glyph" style={{ '--i': 0 }}>d</span>
          </span>
          <span className="js-splash-rest">
            {REST.map((c, i) => (
              <span key={i} className="js-splash-letter">
                <span className="js-splash-glyph" style={{ '--i': i + 1 }}>{c}</span>
              </span>
            ))}
          </span>
        </h1>
        <svg className={`js-splash-arc${showArc ? ' is-on' : ''}${phase === 'exit' ? ' is-complete' : ''}`}
             viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" />
        </svg>
      </div>
    </div>
  );
}

export default JsSplash;
