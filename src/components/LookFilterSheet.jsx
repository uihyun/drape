import { X } from 'lucide-react';
import { CATEGORIES, SUBCATEGORIES, COLORS, SEASONS, STYLES, FITS } from '../services/taxonomy.js';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { useLocale } from '../hooks/useLocale.jsx';

// subcategory → its parent category, so a subcategory filter only bites when
// its parent category is actively selected.
const SUB_PARENT = {};
for (const [cat, subs] of Object.entries(SUBCATEGORIES)) for (const s of subs) SUB_PARENT[s] = cat;

// THE single tag-filter module for the whole app (closet, outfits, OOTDs,
// try-ons, boards — everything except the calendar). Same chip-grid UX
// everywhere, no text box. Manage filter UI + matching in ONE place so a
// new dimension or fix lands across every surface at once.
//
// Two entity shapes are filtered:
//   • ITEMS (closet) — one `tags` object per doc → itemMatchesFilters.
//   • LOOKS (outfit/ootd/tryon/board) — tags aggregated from the style
//     breakdown + linked closet items + analyzed pieces → lookMatches.
// Both read the same `filters` shape, so the same sheet drives both.
const FILTER_DIMS = [
  { key: 'styles',   field: 'styles',   values: STYLES,     ns: 'styles',     labelKey: 'tagStyles' },
  { key: 'category', field: 'category', values: CATEGORIES, ns: 'categories', labelKey: 'tagCategory' },
  { key: 'colors',   field: 'colors',   values: COLORS,     ns: 'colors',     labelKey: 'tagColors' },
  { key: 'seasons',  field: 'seasons',  values: SEASONS,    ns: 'seasons',    labelKey: 'tagSeasons' },
  { key: 'fits',     field: 'fit',      values: FITS,       ns: 'fits',       labelKey: 'tagFit' },
];

export const LOOK_DIMS = FILTER_DIMS;

export function emptyLookFilters() {
  return { styles: [], category: [], subcategory: [], colors: [], seasons: [], fits: [] };
}

export function countLookFilters(f) {
  return Object.values(f).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}

// ── ITEM (closet) matching ─────────────────────────────────────────────
// A closet item carries one tags object. `forSale`/`kind` are item-only
// extras handled outside the tag dims.
export function itemMatchesFilters(item, filters) {
  const tags = item.tags || {};
  for (const dim of FILTER_DIMS) {
    const sel = filters[dim.key];
    if (!sel?.length) continue;
    const v = tags[dim.field];
    const has = Array.isArray(v) ? v.some(x => sel.includes(x)) : sel.includes(v);
    if (!has) return false;
  }
  // Subcategory refines a selected category — only enforced when the item's
  // category is one the user actively filtered AND drilled into (so a hat
  // filter doesn't hide bags). Orphaned subs (parent category not selected)
  // are ignored, which avoids any cascade-cleanup on category deselect.
  const subs = filters.subcategory;
  if (subs?.length) {
    const activeCats = new Set(filters.category || []);
    const drilled = new Set(subs.map(s => SUB_PARENT[s]).filter(c => activeCats.has(c)));
    if (drilled.has(tags.category) && !subs.includes(tags.subcategory)) return false;
  }
  if (filters.forSale?.length && !item.forSale) return false;
  if (filters.kind?.length && !filters.kind.includes(item.kind || 'owned')) return false;
  return true;
}

// ── LOOK matching ──────────────────────────────────────────────────────
/** Build the set of tag tokens a look carries, from its style breakdown +
 *  the tags of its linked closet items (resolved via `closetById`). */
export function lookTagSet(look, closetById = {}) {
  const styles = new Set();
  const category = new Set();
  const subcategory = new Set();
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
    if (tg.subcategory) subcategory.add(tg.subcategory);
    if (tg.fit) fits.add(tg.fit);
    for (const c of (tg.colors || [])) colors.add(c);
    for (const sn of (tg.seasons || [])) seasons.add(sn);
    for (const st of (tg.styles || [])) styles.add(st);
  }
  // pieces (analyzed worn-garments) also contribute category/colors.
  for (const p of (look.pieces || [])) {
    if (p.category) category.add(p.category);
    if (p.subcategory) subcategory.add(p.subcategory);
    for (const c of (p.colors || [])) colors.add(c);
  }
  return { styles, category, subcategory, colors, seasons, fits };
}

/** Does a look pass the active filters? */
export function lookMatches(look, filters, closetById = {}) {
  const tags = lookTagSet(look, closetById);
  for (const dim of FILTER_DIMS) {
    const sel = filters[dim.key];
    if (!sel?.length) continue;
    if (!sel.some(v => tags[dim.key].has(v))) return false;
  }
  // Subcategory refinement (same rule as items): only for drilled-into cats.
  const subs = filters.subcategory;
  if (subs?.length) {
    const activeCats = new Set(filters.category || []);
    const drilled = subs.filter(s => activeCats.has(SUB_PARENT[s]));
    if (drilled.length && !drilled.some(s => tags.subcategory.has(s))) return false;
  }
  return true;
}

// `extras` (optional) lets a surface add non-taxonomy chip sections after
// the shared dims — e.g. closet's For-sale + Owned/Wishlist. Each:
//   { key, labelKey, options: [{ value, labelKey }] }
export function LookFilterSheet({ filters, onToggle, onClear, onClose, count, resultCount, extras = [] }) {
  const { t } = useLocale();
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet detail-filter" style={sheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab', touchAction: 'none' }} />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title" {...handleProps} style={{ cursor: 'grab', touchAction: 'none' }}>{t('detailedFilter')}</h3>

        <div className="detail-filter-body">
          {FILTER_DIMS.map(dim => (
            <div key={dim.key}>
              <div className="detail-filter-dim">
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
              {/* Drill-down: selecting a top category reveals its subcategories
                  right below, so you can narrow to e.g. accessory → hat. */}
              {dim.key === 'category' && (filters.category || []).map(cat => {
                const subs = SUBCATEGORIES[cat] || [];
                if (!subs.length) return null;
                return (
                  <div key={`sub-${cat}`} className="detail-filter-dim detail-filter-sub">
                    <span className="detail-filter-dim-label">
                      {t(`taxonomy.categories.${cat}`)} · {t('tagSubcategory')}
                    </span>
                    <div className="detail-filter-chips">
                      {subs.map(v => {
                        const on = (filters.subcategory || []).includes(v);
                        return (
                          <button
                            key={v}
                            type="button"
                            className={`chip-pill${on ? ' active' : ''}`}
                            onClick={() => onToggle('subcategory', v)}
                          >
                            {t(`taxonomy.subcategories.${v}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {extras.map(section => (
            <div key={section.key} className="detail-filter-dim">
              <span className="detail-filter-dim-label">{t(section.labelKey)}</span>
              <div className="detail-filter-chips">
                {section.options.map(opt => {
                  const on = (filters[section.key] || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`chip-pill${on ? ' active' : ''}`}
                      onClick={() => onToggle(section.key, opt.value)}
                    >
                      {t(opt.labelKey)}
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
