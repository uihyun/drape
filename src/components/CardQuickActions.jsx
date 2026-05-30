// The button row that appears over a card during a press-and-hold (see
// useLongPressQuickActions). Centered, semi-transparent dark pills; the one
// the finger is hovering scales up. Pointer events are off so the hit-test
// in the hook (which owns the gesture) stays authoritative.
export function CardQuickActions({ actions, focusedKey, registerButton }) {
  return (
    <div className="card-quick-overlay" aria-hidden="true">
      <div className="card-quick-actions">
        {actions.map(a => (
          <div
            key={a.key}
            ref={(el) => registerButton(a.key, el)}
            className={`card-quick-btn${focusedKey === a.key ? ' focused' : ''}`}
          >
            {a.icon}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CardQuickActions;
