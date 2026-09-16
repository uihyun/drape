// Scrim + centred card, the shape used for anything that needs the screen's
// full attention once: teaching a gesture, or asking a question with two real
// answers. Inline banners can't do the latter — a row that has to hold a
// sentence and two buttons collapses on a phone.
//
// Visual language matches the tour on purpose, so "drape is telling me
// something" always looks the same.
export function HintDialog({ visual, text, note, actions = [] }) {
  return (
    <div className="hintdlg" role="dialog" aria-modal="true">
      <div className="hintdlg-card">
        {visual}
        <p className="hintdlg-text">{text}</p>
        {note && <p className="hintdlg-note">{note}</p>}
        <div className={`hintdlg-actions${actions.length > 1 ? ' two' : ''}`}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HintDialog;
