import { useState } from 'react';
import { User } from 'lucide-react';

// Shared avatar — image when a custom photo is set, otherwise a neutral
// User glyph. The empty state is intentionally bland (no colored
// initial circle) so a freshly-signed-up profile feels like it needs a
// photo and nudges the user to add one.
export function Avatar({
  src,
  alt = '',
  name, // kept for API compat — currently unused at render time
  size = 36,
  className = '',
  iconSize,
}) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  const iconPx = iconSize ?? Math.round(size * 0.55);

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
      ) : (
        <User size={iconPx} strokeWidth={1.6} />
      )}
    </span>
  );
}

export default Avatar;
