import { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CITIES, cityDisplay, searchCities } from '../data/cities.js';
import { useLocale } from '../hooks/useLocale.jsx';

// City autocomplete. The picker stores a canonical city id (e.g.
// 'tokyo-jp') and displays the localized name. Search matches across
// en/ko/ja so a Korean user can type "도쿄" and an English user "tok"
// and land on the same Tokyo entry. Free-text legacy values still
// render via cityDisplay's id-fallback so nothing disappears.
export function LocationInput({ value, onChange, placeholder = '' }) {
  const { lang } = useLocale();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const blurTimer = useRef(null);

  const selected = useMemo(() => CITIES.find(c => c.id === value) || null, [value]);
  const display = selected ? (selected.names[lang] || selected.names.en) : (value || '');
  const inputValue = open ? query : display;

  const suggestions = useMemo(() => searchCities(open ? query : '', { limit: 10 }), [query, open]);

  const select = (city) => {
    onChange(city.id);
    setQuery('');
    setOpen(false);
    setFocusedIdx(0);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
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
    <div className="location-input">
      <input
        type="text"
        className="page-input"
        value={inputValue}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setFocusedIdx(0); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={onKeyDown}
      />
      {selected && !open && (
        <button
          type="button"
          className="location-input-clear"
          onClick={clear}
          aria-label="Clear"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <ul
          className="location-input-suggest"
          // mousedown fires before input blur; using onMouseDown to
          // prevent the blur from closing the menu before we register
          // the pick.
          onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); }}
        >
          {suggestions.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                className={`location-input-row${i === focusedIdx ? ' focused' : ''}`}
                onClick={() => select(c)}
                onMouseEnter={() => setFocusedIdx(i)}
              >
                <span className="location-input-name">{c.names[lang] || c.names.en}</span>
                <span className="location-input-country">{c.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LocationInput;
