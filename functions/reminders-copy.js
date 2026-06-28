// Friendly reminder push copy, rotated per user (reminderIdx % length). Each
// entry is localized en/ko/ja with a title + body. Server-side because there's
// no shared client/server locale bundle; keep this small + warm in tone.

const REMINDERS = [
  {
    en: { title: 'Add to your closet', body: 'Snap a piece you wore lately — drape cuts it out and tags it for you. 📸' },
    ko: { title: '옷장 채우기', body: '요즘 입은 옷 한 장 찍어봐요 — drape가 알아서 잘라내고 태그까지 달아줘요. 📸' },
    ja: { title: 'クローゼットに追加', body: '最近着た服を1枚パチリ — drapeが切り抜いてタグ付けします。📸' },
  },
  {
    en: { title: 'New looks in the feed', body: 'Fresh OOTDs just dropped — find one you love and try it on yourself. 👗' },
    ko: { title: '피드에 새 OOTD', body: '새로운 OOTD가 올라왔어요 — 마음에 드는 룩, 나한테 입혀볼까요? 👗' },
    ja: { title: 'フィードに新着', body: '新しいOOTDが届いています — 気になるルック、試着してみませんか？👗' },
  },
  {
    en: { title: 'What did you wear today?', body: 'Log today’s OOTD before you forget — your calendar’s waiting. 🗓️' },
    ko: { title: '오늘 뭐 입었어요?', body: '잊기 전에 오늘의 OOTD를 남겨봐요 — 캘린더가 기다리고 있어요. 🗓️' },
    ja: { title: '今日のコーデは？', body: '忘れる前に今日のOOTDを記録 — カレンダーが待っています。🗓️' },
  },
  {
    en: { title: 'Try before you buy', body: 'Eyeing something? See it on you first — no fitting room needed. ✨' },
    ko: { title: '사기 전에 입어보기', body: '눈여겨본 옷 있어요? 사기 전에 먼저 입어봐요 — 피팅룸 필요 없어요. ✨' },
    ja: { title: '買う前に試着', body: '気になる服があれば、まず自分に着せて確認 — 試着室いらず。✨' },
  },
];

function pickReminder(idx, lang) {
  const r = REMINDERS[((idx % REMINDERS.length) + REMINDERS.length) % REMINDERS.length];
  return r[lang] || r.en;
}

module.exports = { REMINDERS, pickReminder };
