// "Which screen should drape open on?" — asked once, and only of accounts
// whose first landing was Trends (a closet that was empty when they arrived).
// Anyone who already owned items when this shipped has always opened on their
// closet, so for them the question describes a change that never happened.
import { useState } from 'react';
import { Shirt, TrendingUp } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';
import { HintDialog } from './HintDialog.jsx';
import {
  hintSeen, markHintSeen, getHomePref, setHomePref,
  HINT_HOME_FLIP, startedOnTrends,
} from '../services/homePref.js';

export function HomeFlipAsk({ itemCount }) {
  const { t } = useLocale();
  // `answered` exists only to re-render. The gate below reads localStorage, and
  // writing localStorage doesn't notify React — without this the dialog stayed
  // on screen after a choice, looking like the buttons were dead.
  const [answered, setAnswered] = useState(false);
  const due = !answered
    && itemCount > 0
    && getHomePref() === null
    && startedOnTrends()
    && !hintSeen(HINT_HOME_FLIP);
  if (!due) return null;

  const answer = (v) => { markHintSeen(HINT_HOME_FLIP); setHomePref(v); setAnswered(true); };

  // Same order and icons as Settings → Display, so the one-time question and
  // the permanent control read as the same switch.
  return (
    <HintDialog
      text={t('homeFlipAsk')}
      note={t('homeFlipNote')}
      actions={[
        { label: t('homeScreenTrends'), Icon: TrendingUp, onClick: () => answer('trends') },
        { label: t('homeScreenProfile'), Icon: Shirt, onClick: () => answer('profile') },
      ]}
    />
  );
}

export default HomeFlipAsk;
