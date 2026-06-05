import { useState } from 'react';
import { User } from 'lucide-react';

// Shared avatar — image when a custom photo is set, otherwise the first
// letter of the name as a monogram (consistent everywhere: feed, outfit,
// board, chat). Only when there's no name at all do we fall back to a
// neutral User glyph.
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
  const iconPx = iconSize ?? Math.round(size * 0.55);
  const letter = (name || '').trim().replace(/^@/, '').slice(0, 1).toUpperCase();

  return (
    <span
      className={`avatar ${className}${showImg ? '' : ' avatar-empty'}`}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : letter ? (
        <span className="avatar-letter" style={{ fontSize: Math.round(size * 0.42) }}>{letter}</span>
      ) : (
        <User size={iconPx} strokeWidth={1.6} />
      )}
    </span>
  );
}

export default Avatar;
