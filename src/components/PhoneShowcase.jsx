import '../styles/phone-showcase.css';

// Two angled phone mockups (OOTD calendar + digital closet) rendered in
// pure CSS/markup — no screenshot assets to keep in sync. Shared by the
// marketing landing and the welcome screen. Decorative only.
export function PhoneShowcase() {
  return (
    <div className="lp-visual" aria-hidden="true">
      <PhoneCalendar />
      <PhoneCloset />
    </div>
  );
}

function PhoneCalendar() {
  const filled = new Set([2, 4, 7, 8, 11, 14, 15, 18, 21, 22, 25, 27]);
  return (
    <div className="lp-phone lp-phone--back">
      <div className="lp-phone-screen">
        <div className="lp-cal-top">
          <span className="lp-cal-handle">@you</span>
          <span className="lp-cal-invite">Invite</span>
        </div>
        <div className="lp-cal-tabs"><span className="on">Calendar</span><span>Closet</span><span>Outfits</span></div>
        <div className="lp-cal-month">June 2026</div>
        <div className="lp-cal-grid">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className={`lp-cal-cell${filled.has(i) ? ' filled' : ''}`}>
              {filled.has(i) && <span className="lp-cal-look" style={{ '--h': LOOK_HUES[i % LOOK_HUES.length] }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhoneCloset() {
  return (
    <div className="lp-phone lp-phone--front">
      <div className="lp-phone-screen">
        <div className="lp-closet-grid">
          {CLOSET_TILES.map((tile, i) => (
            <div key={i} className="lp-closet-card">
              <div className="lp-closet-img" style={{ '--h': tile.hue, '--a': tile.alt }} />
              <span className="lp-closet-cat">{tile.cat}</span>
              <span className="lp-closet-name">{tile.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const LOOK_HUES = [222, 28, 0, 200, 45, 260, 12];
const CLOSET_TILES = [
  { cat: 'OUTERWEAR', name: 'Charcoal wool coat', hue: 220, alt: 4 },
  { cat: 'TOP', name: 'Ivory silk blouse', hue: 40, alt: 8 },
  { cat: 'BAG', name: 'Black leather tote', hue: 0, alt: 0 },
  { cat: 'BOTTOM', name: 'Indigo wide jeans', hue: 222, alt: 6 },
  { cat: 'SKIRT', name: 'Tartan pleated skirt', hue: 12, alt: 5 },
  { cat: 'KNIT', name: 'Camel ribbed knit', hue: 32, alt: 7 },
  { cat: 'SHOES', name: 'Black pointed heels', hue: 0, alt: 2 },
  { cat: 'HAT', name: 'Wide-brim fedora', hue: 28, alt: 3 },
  { cat: 'DRESS', name: 'Slip midi dress', hue: 260, alt: 5 },
];

export default PhoneShowcase;
