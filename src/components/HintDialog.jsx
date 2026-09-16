// Scrim + centred card, the shape used for anything that needs the screen's
// full attention once: teaching a gesture, or asking a question with two real
// answers. Inline banners can't do the latter — a row that has to hold a
// sentence and two buttons collapses on a phone.
//
// Visual language matches the tour on purpose, so "drape is telling me
// something" always looks the same.
// An action carrying an `Icon` turns the row into a side-by-side picker instead
// of stacked buttons — the shape Settings → Display already uses for the same
// choice, so answering here and changing it later look like the same control.
// Without icons the buttons stay stacked: either label can be long in five
// locales, and a squeezed row is what broke the banner this replaced.
export function HintDialog({ visual, text, note, actions = [] }) {
  const pick = actions.some((a) => a.Icon);
  return (
    <div className="hintdlg" role="dialog" aria-modal="true">
      <div className="hintdlg-card">
        {visual}
        <p className="hintdlg-text">{text}</p>
        {note && <p className="hintdlg-note">{note}</p>}
        <div className={`hintdlg-actions${pick ? ' pick' : ''}${actions.length > 1 ? ' two' : ''}`}>
          {actions.map(({ label, Icon, primary, onClick }) => (
            <button
              key={label}
              type="button"
              className={pick ? 'hintdlg-pick-btn' : `btn ${primary ? 'btn-primary' : 'btn-secondary'}`}
              onClick={onClick}
            >
              {Icon && <Icon size={22} strokeWidth={1.6} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HintDialog;
