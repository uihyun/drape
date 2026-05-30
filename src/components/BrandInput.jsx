import { useMemo, useRef, useState } from 'react';
import { searchBrands } from '../data/brands.js';

// Brand autocomplete. Unlike LocationInput (which canonicalizes to a
// city id), brands are free text: `value` is the raw brand string and
// every keystroke is propagated via onChange so a custom brand the list
// doesn't know about is preserved verbatim. The dropdown is an assist,
// never a constraint — typing "My Local Brand" and tabbing away keeps
// that exact string.

// Split a brand name around the matched query so the match can be bolded
// in the suggestion row. Case-insensitive; returns [before, match, after].
function splitMatch(name, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [name, '', ''];
  const idx = name.toLowerCase().indexOf(q);
  if (idx === -1) return [name, '', ''];
  return [name.slice(0, idx), name.slice(idx, idx + q.length), name.slice(idx + q.length)];
}

export function BrandInput({ value = '', onChange, placeholder = '' }) {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const blurTimer = useRef(null);

  const suggestions = useMemo(
    () => (open ? searchBrands(value, { limit: 8 }) : []),
    [value, open],
  );

  const select = (brand) => {
    onChange(brand);
    setOpen(false);
    setFocusedIdx(0);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(suggestions[focusedIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="location-input brand-input">
      <input
        type="text"
        className="tag-brand-input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setFocusedIdx(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <ul
          className="location-input-suggest"
          // mousedown fires before input blur; preventDefault keeps focus
          // so the blur timer doesn't close the menu before the pick.
          onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); }}
        >
          {suggestions.map((b, i) => {
            const [before, match, after] = splitMatch(b, value);
            return (
              <li key={b}>
                <button
                  type="button"
                  className={`location-input-row${i === focusedIdx ? ' focused' : ''}`}
                  onClick={() => select(b)}
                  onMouseEnter={() => setFocusedIdx(i)}
                >
                  <span className="location-input-name">
                    {before}<strong>{match}</strong>{after}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default BrandInput;
