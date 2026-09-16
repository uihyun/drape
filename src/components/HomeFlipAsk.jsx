// "Which screen should drape open on?" — asked once, and only of accounts
// whose first landing was Trends (a closet that was empty when they arrived).
// Anyone who already owned items when this shipped has always opened on their
// closet, so for them the question describes a change that never happened.
import { useLocale } from '../hooks/useLocale.jsx';
import { HintDialog } from './HintDialog.jsx';
import {
  hintSeen, markHintSeen, getHomePref, setHomePref,
  HINT_HOME_FLIP, startedOnTrends,
} from '../services/homePref.js';

export function HomeFlipAsk({ itemCount }) {
  const { t } = useLocale();
  // No state: every input is already persistent, and a render-time read keeps
  // this from flashing in for a frame after the answer is stored.
  const due = itemCount > 0
    && getHomePref() === null
    && startedOnTrends()
    && !hintSeen(HINT_HOME_FLIP);
  if (!due) return null;

  const answer = (v) => { markHintSeen(HINT_HOME_FLIP); setHomePref(v); };

  return (
    <HintDialog
      text={t('homeFlipAsk')}
      note={t('homeFlipNote')}
      actions={[
        { label: t('homeFlipYes'), primary: true, onClick: () => answer('profile') },
        { label: t('homeFlipNo'), onClick: () => answer('trends') },
      ]}
    />
  );
}

export default HomeFlipAsk;
