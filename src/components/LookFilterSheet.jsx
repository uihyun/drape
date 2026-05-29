import { X } from 'lucide-react';
import { CATEGORIES, COLORS, SEASONS, STYLES, FITS } from '../services/taxonomy.js';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Detailed tag-filter sheet for "looks" (try-ons, outfits, OOTDs) — same
// chip-grid UX as the closet's filter, no text box. A look matches a
// selection when its aggregated tags (the style breakdown + every linked
// closet item's tags) intersect. Across dimensions = AND, within = OR.
//
// `style` is the look's own [{label, level}] breakdown; the rest come from
// the items the look references.
const LOOK_DIMS = [
  { key: 'styles',   values: STYLES,     ns: 'styles',     labelKey: 'tagStyles' },
  { key: 'category', values: CATEGORIES, ns: 'categories', labelKey: 'tagCategory' },
  { key: 'colors',   values: COLORS,     ns: 'colors',     labelKey: 'tagColors' },
  { key: 'seasons',  values: SEASONS,    ns: 'seasons',    labelKey: 'tagSeasons' },
  { key: 'fits',     values: FITS,       ns: 'fits',       labelKey: 'tagFit' },
];

export function emptyLookFilters() {
  return { styles: [], category: [], colors: [], seasons: [], fits: [] };
}

export function countLookFilters(f) {
  return Object.values(f).reduce((n, arr) => n + (arr?.length || 0), 0);
}

/** Build the set of tag tokens a look carries, from its style breakdown +
 *  the tags of its linked closet items (resolved via `closetById`). */
export function lookTagSet(look, closetById) {
  const styles = new Set();
  const category = new Set();
  const colors = new Set();
  const seasons = new Set();
  const fits = new Set();
  for (const s of (look.style || [])) {
    if (s.label && (s.level || 0) >= 1) styles.add(s.label);
  }
  for (const id of (look.itemIds || [])) {
    const it = closetById[id];
    if (!it) continue;
    const tg = it.tags || {};
    if (tg.category) category.add(tg.category);
    if (tg.fit) fits.add(tg.fit);
    for (const c of (tg.colors || [])) colors.add(c);
    for (const sn of (tg.seasons || [])) seasons.add(sn);
    for (const st of (tg.styles || [])) styles.add(st);
  }
  // pieces (analyzed worn-garments) also contribute category/colors.
  for (const p of (look.pieces || [])) {
    if (p.category) category.add(p.category);
    for (const c of (p.colors || [])) colors.add(c);
  }
  return { styles, category, colors, seasons, fits };
}

/** Does a look pass the active filters? */
export function lookMatches(look, filters, closetById) {
  const tags = lookTagSet(look, closetById);
  for (const dim of LOOK_DIMS) {
    const sel = filters[dim.key];
    if (!sel?.length) continue;
    if (!sel.some(v => tags[dim.key].has(v))) return false;
  }
  return true;
}

export function LookFilterSheet({ filters, onToggle, onClear, onClose, count, resultCount }) {
  const { t } = useLocale();
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet detail-filter" style={sheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab' }} />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title">{t('detailedFilter')}</h3>

        <div className="detail-filter-body">
          {LOOK_DIMS.map(dim => (
            <div key={dim.key} className="detail-filter-dim">
              <span className="detail-filter-dim-label">{t(dim.labelKey)}</span>
              <div className="detail-filter-chips">
                {dim.values.map(v => {
                  const on = (filters[dim.key] || []).includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`chip-pill${on ? ' active' : ''}`}
                      onClick={() => onToggle(dim.key, v)}
                    >
                      {t(`taxonomy.${dim.ns}.${v}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="detail-filter-actions">
          <button type="button" className="btn btn-secondary" onClick={onClear} disabled={count === 0}>
            {t('clear')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('detailedFilterApply', { n: resultCount })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LookFilterSheet;
