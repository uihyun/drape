// Friendly reminder push copy, rotated per user (reminderIdx % length). Each
// entry is localized en/ko/ja with a title + body. Server-side (no shared
// client/server locale bundle). Warm but refined tone — NO emoji (matches the
// editorial brand). Keep the set varied so the same line doesn't repeat soon.

const REMINDERS = [
  {
    en: { title: 'Fill your closet', body: 'Add the pieces you reach for most — it makes outfits easier to plan.' },
    ko: { title: '옷장 채우기', body: '요즘 자주 입은 옷, 옷장에 넣어두면 코디 짤 때 훨씬 편해요.' },
    ja: { title: 'クローゼットを充実', body: 'よく着る服を入れておくと、コーデ作りがぐっとラクになります。' },
  },
  {
    en: { title: 'Something new?', body: 'Snap your latest pickup and drop it into your closet.' },
    ko: { title: '새로 산 옷 있어요?', body: '이번에 들인 옷, 한 장 찍어 옷장에 추가해볼까요.' },
    ja: { title: '新しい服は？', body: '最近手に入れた服を撮って、クローゼットに追加しましょう。' },
  },
  {
    en: { title: 'New looks in the feed', body: 'Found a look you love? Try it on yourself, just as it is.' },
    ko: { title: '피드에 새로운 룩', body: '마음에 드는 다른 사람의 룩, 그대로 나한테 입혀볼 수 있어요.' },
    ja: { title: 'フィードに新着ルック', body: '気になるルックを、そのまま自分に着せて試せます。' },
  },
  {
    en: { title: 'A little inspiration', body: 'Browse the feed and find your next outfit idea.' },
    ko: { title: '오늘의 영감', body: '피드를 둘러보며 다음 코디 힌트를 얻어보세요.' },
    ja: { title: '今日のヒント', body: 'フィードを眺めて、次のコーデのヒントを。' },
  },
  {
    en: { title: 'What did you wear today?', body: 'Save today’s OOTD to your calendar — you’ll love looking back.' },
    ko: { title: '오늘 뭐 입었어요?', body: '오늘의 OOTD를 캘린더에 남겨두면 두고두고 보기 좋아요.' },
    ja: { title: '今日のコーデは？', body: '今日のOOTDをカレンダーに残すと、後で見返すのが楽しいです。' },
  },
  {
    en: { title: 'One look a day', body: 'Capture today’s outfit before it slips your mind.' },
    ko: { title: '하루 한 컷', body: '오늘 착장, 잊기 전에 기록해둘까요.' },
    ja: { title: '1日1コーデ', body: '今日の装い、忘れる前に記録を。' },
  },
  {
    en: { title: 'Try before you buy', body: 'Put that cart pick on yourself before you check out.' },
    ko: { title: '사기 전에 입어보기', body: '담아둔 옷, 결제 전에 나한테 먼저 입혀보세요.' },
    ja: { title: '買う前に試着', body: 'カートの服、購入前にまず自分で試着を。' },
  },
  {
    en: { title: 'Not sure it suits you?', body: 'See it on yourself first, then decide.' },
    ko: { title: '어울릴까 고민될 때', body: '그 옷이 나한테 맞을지, 미리 입어보고 정하세요.' },
    ja: { title: '似合うか迷ったら', body: 'まず自分に着せてから決めましょう。' },
  },
  {
    en: { title: 'Build an outfit', body: 'Mix pieces from your closet into something new.' },
    ko: { title: '코디 짜보기', body: '옷장 속 옷들로 새로운 조합을 만들어볼까요.' },
    ja: { title: 'コーデを組む', body: 'クローゼットの服で新しい組み合わせを。' },
  },
  {
    en: { title: 'What about tomorrow?', body: 'Pick tomorrow’s look tonight and ease into your morning.' },
    ko: { title: '내일 뭐 입지?', body: '내일 입을 룩을 미리 골라두면 아침이 한결 여유로워요.' },
    ja: { title: '明日は何を着る？', body: '明日のルックを今夜決めておくと、朝に余裕が。' },
  },
  {
    en: { title: 'Rediscover your closet', body: 'A quick scroll brings forgotten pieces back into rotation.' },
    ko: { title: '잊고 있던 옷', body: '옷장을 한 번 둘러보면 안 입던 옷이 다시 눈에 들어와요.' },
    ja: { title: 'クローゼットを再発見', body: '一度見返すと、着ていなかった服が目に留まります。' },
  },
  {
    en: { title: 'For this season', body: 'Try on a look that fits the weather and get a step ahead.' },
    ko: { title: '요즘 날씨엔', body: '지금 계절에 어울리는 룩, 미리 입어보고 준비해볼까요.' },
    ja: { title: 'この季節に', body: '今の天気に合うルックを試着して、先取りを。' },
  },
  {
    en: { title: 'Show today’s look', body: 'Loved your outfit today? Share it to the feed.' },
    ko: { title: '오늘 룩 자랑', body: '마음에 든 오늘 코디, 피드에 올려 공유해볼까요.' },
    ja: { title: '今日のコーデを', body: '気に入った今日の装い、フィードでシェアしませんか。' },
  },
  {
    en: { title: 'Make a moodboard', body: 'Gather pieces you love onto a board and shape your style.' },
    ko: { title: '무드보드 만들기', body: '좋아하는 아이템들을 보드에 모아 나만의 스타일을 정리해보세요.' },
    ja: { title: 'ムードボード作り', body: '好きなアイテムをボードに集めて、自分のスタイルを整理。' },
  },
];

function pickReminder(idx, lang) {
  const r = REMINDERS[((idx % REMINDERS.length) + REMINDERS.length) % REMINDERS.length];
  return r[lang] || r.en;
}

module.exports = { REMINDERS, pickReminder };
