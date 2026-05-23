import { useState } from 'react';
import { User } from 'lucide-react';

// Shared avatar — falls back to a letter or User glyph if the image
// fails (Google profile photos sometimes 403 in third-party contexts).
// All callers used to repeat this pattern; centralized here.
export function Avatar({
  src,
  alt = '',
  name,
  size = 36,
  className = '',
  iconSize,
}) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  const letter = (name || '?').trim().slice(0, 1).toUpperCase();
  const iconPx = iconSize ?? Math.round(size * 0.55);

  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        name
          ? <span className="avatar-letter">{letter}</span>
          : <User size={iconPx} strokeWidth={1.6} />
      )}
    </span>
  );
}

export default Avatar;
