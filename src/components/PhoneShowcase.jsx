import '../styles/phone-showcase.css';

// Two angled phone mockups showing real app screenshots (optimized webp in
// public/landing). Shared by the marketing landing and the welcome screen.
// Decorative only.
export function PhoneShowcase() {
  return (
    <div className="lp-visual" aria-hidden="true">
      <div className="lp-phone lp-phone--back">
        <div className="lp-phone-screen">
          <img className="lp-phone-img" src="/lp/calendar.webp" alt="" loading="lazy" />
        </div>
      </div>
      <div className="lp-phone lp-phone--front">
        <div className="lp-phone-screen">
          <img className="lp-phone-img" src="/lp/feed.webp" alt="" loading="lazy" />
        </div>
      </div>
    </div>
  );
}

export default PhoneShowcase;
