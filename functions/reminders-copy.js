// Friendly reminder push copy, rotated per user (reminderIdx % length). Each
// entry is localized en/ko/ja/es/fr/pt/de with a title + body (es/fr were
// missing until 2026-10-12 and fell back to English). Server-side (no shared
// client/server locale bundle). Warm but refined tone — NO emoji (matches the
// editorial brand). Keep the set varied so the same line doesn't repeat soon.

const REMINDERS = [
  {
    en: { title: 'Fill your closet', body: 'Add the pieces you reach for most — it makes outfits easier to plan.' },
    ko: { title: '옷장 채우기', body: '요즘 자주 입은 옷, 옷장에 넣어두면 코디 짤 때 훨씬 편해요.' },
    ja: { title: 'クローゼットを充実', body: 'よく着る服を入れておくと、コーデ作りがぐっとラクになります。' },
    es: { title: 'Llena tu armario', body: 'Agrega las prendas que más usas: así planear outfits es más fácil.' },
    fr: { title: 'Remplissez votre dressing', body: 'Ajoutez les pièces que vous portez le plus : vos tenues seront plus simples à composer.' },
    pt: { title: 'Monte seu guarda-roupa', body: 'Adicione as peças que você mais usa: fica muito mais fácil montar looks.' },
    de: { title: 'Füll deinen Kleiderschrank', body: 'Füg die Teile hinzu, die du am meisten trägst – so planst du Outfits viel leichter.' },
  },
  {
    en: { title: 'Something new?', body: 'Snap your latest pickup and drop it into your closet.' },
    ko: { title: '새로 산 옷 있어요?', body: '이번에 들인 옷, 한 장 찍어 옷장에 추가해볼까요.' },
    ja: { title: '新しい服は？', body: '最近手に入れた服を撮って、クローゼットに追加しましょう。' },
    es: { title: '¿Algo nuevo?', body: 'Tómale una foto a tu última compra y súmala a tu armario.' },
    fr: { title: 'Du nouveau ?', body: 'Photographiez votre dernier achat et ajoutez-le à votre dressing.' },
    pt: { title: 'Comprou algo novo?', body: 'Tire uma foto da sua última compra e coloque no seu guarda-roupa.' },
    de: { title: 'Was Neues?', body: 'Fotografier dein neuestes Teil und pack es in deinen Kleiderschrank.' },
  },
  {
    en: { title: 'New looks in the feed', body: 'Found a look you love? Try it on yourself, just as it is.' },
    ko: { title: '피드에 새로운 룩', body: '마음에 드는 다른 사람의 룩, 그대로 나한테 입혀볼 수 있어요.' },
    ja: { title: 'フィードに新着ルック', body: '気になるルックを、そのまま自分に着せて試せます。' },
    es: { title: 'Nuevos looks en el feed', body: '¿Viste un look que te encanta? Pruébatelo tal cual.' },
    fr: { title: 'Nouveaux looks dans le fil', body: 'Une tenue vous plaît ? Essayez-la sur vous, telle quelle.' },
    pt: { title: 'Looks novos no feed', body: 'Curtiu um look? Prove em você, do jeitinho que ele é.' },
    de: { title: 'Neue Looks im Feed', body: 'Ein Look gefällt dir? Probier ihn genau so an dir an.' },
  },
  {
    en: { title: 'A little inspiration', body: 'Browse the feed and find your next outfit idea.' },
    ko: { title: '오늘의 영감', body: '피드를 둘러보며 다음 코디 힌트를 얻어보세요.' },
    ja: { title: '今日のヒント', body: 'フィードを眺めて、次のコーデのヒントを。' },
    es: { title: 'Un poco de inspiración', body: 'Recorre el feed y encuentra la idea para tu próximo outfit.' },
    fr: { title: 'Un peu d’inspiration', body: 'Parcourez le fil et trouvez l’idée de votre prochaine tenue.' },
    pt: { title: 'Um pouco de inspiração', body: 'Dê uma olhada no feed e ache a ideia do seu próximo look.' },
    de: { title: 'Ein bisschen Inspiration', body: 'Stöber im Feed und finde die Idee für dein nächstes Outfit.' },
  },
  {
    en: { title: 'What did you wear today?', body: 'Save today’s OOTD to your calendar — you’ll love looking back.' },
    ko: { title: '오늘 뭐 입었어요?', body: '오늘의 OOTD를 캘린더에 남겨두면 두고두고 보기 좋아요.' },
    ja: { title: '今日のコーデは？', body: '今日のOOTDをカレンダーに残すと、後で見返すのが楽しいです。' },
    es: { title: '¿Qué te pusiste hoy?', body: 'Guarda tu OOTD de hoy en el calendario: te va a encantar verlo después.' },
    fr: { title: 'Qu’avez-vous porté aujourd’hui ?', body: 'Enregistrez votre OOTD du jour dans le calendrier : vous aimerez le revoir.' },
    pt: { title: 'O que você vestiu hoje?', body: 'Salve o OOTD de hoje no calendário: vai ser ótimo relembrar depois.' },
    de: { title: 'Was hast du heute an?', body: 'Speicher dein heutiges OOTD im Kalender – später schaust du es dir gern wieder an.' },
  },
  {
    en: { title: 'One look a day', body: 'Capture today’s outfit before it slips your mind.' },
    ko: { title: '하루 한 컷', body: '오늘 착장, 잊기 전에 기록해둘까요.' },
    ja: { title: '1日1コーデ', body: '今日の装い、忘れる前に記録を。' },
    es: { title: 'Un look al día', body: 'Guarda el outfit de hoy antes de que se te olvide.' },
    fr: { title: 'Une tenue par jour', body: 'Gardez une trace de la tenue du jour avant de l’oublier.' },
    pt: { title: 'Um look por dia', body: 'Registre o look de hoje antes que você esqueça.' },
    de: { title: 'Ein Look am Tag', body: 'Halt dein heutiges Outfit fest, bevor du es vergisst.' },
  },
  {
    en: { title: 'Try before you buy', body: 'Put that cart pick on yourself before you check out.' },
    ko: { title: '사기 전에 입어보기', body: '담아둔 옷, 결제 전에 나한테 먼저 입혀보세요.' },
    ja: { title: '買う前に試着', body: 'カートの服、購入前にまず自分で試着を。' },
    es: { title: 'Pruébatelo antes de comprar', body: 'Ponte esa prenda del carrito antes de pagar.' },
    fr: { title: 'Essayez avant d’acheter', body: 'Voyez cette pièce de votre panier sur vous avant de payer.' },
    pt: { title: 'Prove antes de comprar', body: 'Veja em você aquela peça do carrinho antes de finalizar a compra.' },
    de: { title: 'Erst anprobieren, dann kaufen', body: 'Probier das Teil aus deinem Warenkorb an, bevor du bestellst.' },
  },
  {
    en: { title: 'Not sure it suits you?', body: 'See it on yourself first, then decide.' },
    ko: { title: '어울릴까 고민될 때', body: '그 옷이 나한테 맞을지, 미리 입어보고 정하세요.' },
    ja: { title: '似合うか迷ったら', body: 'まず自分に着せてから決めましょう。' },
    es: { title: '¿No sabes si te queda?', body: 'Míralo primero en ti y después decide.' },
    fr: { title: 'Pas sûr que ça vous aille ?', body: 'Voyez-le d’abord sur vous, puis décidez.' },
    pt: { title: 'Não sabe se combina com você?', body: 'Veja primeiro em você e depois decida.' },
    de: { title: 'Unsicher, ob es dir steht?', body: 'Sieh es dir zuerst an dir an und entscheide dann.' },
  },
  {
    en: { title: 'Build an outfit', body: 'Mix pieces from your closet into something new.' },
    ko: { title: '코디 짜보기', body: '옷장 속 옷들로 새로운 조합을 만들어볼까요.' },
    ja: { title: 'コーデを組む', body: 'クローゼットの服で新しい組み合わせを。' },
    es: { title: 'Arma un outfit', body: 'Combina prendas de tu armario y crea algo nuevo.' },
    fr: { title: 'Composez une tenue', body: 'Associez des pièces de votre dressing pour créer du neuf.' },
    pt: { title: 'Monte um look', body: 'Combine peças do seu guarda-roupa e crie algo novo.' },
    de: { title: 'Stell ein Outfit zusammen', body: 'Kombinier Teile aus deinem Schrank zu etwas Neuem.' },
  },
  {
    en: { title: 'What about tomorrow?', body: 'Pick tomorrow’s look tonight and ease into your morning.' },
    ko: { title: '내일 뭐 입지?', body: '내일 입을 룩을 미리 골라두면 아침이 한결 여유로워요.' },
    ja: { title: '明日は何を着る？', body: '明日のルックを今夜決めておくと、朝に余裕が。' },
    es: { title: '¿Y mañana?', body: 'Elige esta noche el look de mañana y empieza el día con calma.' },
    fr: { title: 'Et demain ?', body: 'Choisissez ce soir la tenue de demain et commencez la journée sereinement.' },
    pt: { title: 'E amanhã?', body: 'Escolha hoje à noite o look de amanhã e comece o dia com calma.' },
    de: { title: 'Und morgen?', body: 'Such heute Abend den Look für morgen aus und starte entspannt in den Tag.' },
  },
  {
    en: { title: 'Rediscover your closet', body: 'A quick scroll brings forgotten pieces back into rotation.' },
    ko: { title: '잊고 있던 옷', body: '옷장을 한 번 둘러보면 안 입던 옷이 다시 눈에 들어와요.' },
    ja: { title: 'クローゼットを再発見', body: '一度見返すと、着ていなかった服が目に留まります。' },
    es: { title: 'Redescubre tu armario', body: 'Un repaso rápido devuelve a la rotación prendas que habías olvidado.' },
    fr: { title: 'Redécouvrez votre dressing', body: 'Un coup d’œil rapide remet en circulation des pièces oubliées.' },
    pt: { title: 'Redescubra seu guarda-roupa', body: 'Uma olhada rápida traz de volta peças esquecidas.' },
    de: { title: 'Entdeck deinen Schrank neu', body: 'Ein kurzer Blick bringt vergessene Teile wieder ins Spiel.' },
  },
  {
    en: { title: 'For this season', body: 'Try on a look that fits the weather and get a step ahead.' },
    ko: { title: '요즘 날씨엔', body: '지금 계절에 어울리는 룩, 미리 입어보고 준비해볼까요.' },
    ja: { title: 'この季節に', body: '今の天気に合うルックを試着して、先取りを。' },
    es: { title: 'Para esta temporada', body: 'Pruébate un look acorde al clima y adelántate.' },
    fr: { title: 'Pour cette saison', body: 'Essayez une tenue adaptée à la météo et prenez de l’avance.' },
    pt: { title: 'Para esta estação', body: 'Prove um look que combine com o clima e saia na frente.' },
    de: { title: 'Für diese Saison', body: 'Probier einen Look passend zum Wetter an und sei einen Schritt voraus.' },
  },
  {
    en: { title: 'Show today’s look', body: 'Loved your outfit today? Share it to the feed.' },
    ko: { title: '오늘 룩 자랑', body: '마음에 든 오늘 코디, 피드에 올려 공유해볼까요.' },
    ja: { title: '今日のコーデを', body: '気に入った今日の装い、フィードでシェアしませんか。' },
    es: { title: 'Muestra tu look de hoy', body: '¿Te encantó tu outfit de hoy? Compártelo en el feed.' },
    fr: { title: 'Montrez votre tenue du jour', body: 'Vous avez aimé votre tenue aujourd’hui ? Partagez-la dans le fil.' },
    pt: { title: 'Mostre o look de hoje', body: 'Amou seu look de hoje? Compartilhe no feed.' },
    de: { title: 'Zeig deinen Look von heute', body: 'Dein Outfit heute war top? Teil es im Feed.' },
  },
  {
    en: { title: 'Make a moodboard', body: 'Gather pieces you love onto a board and shape your style.' },
    ko: { title: '무드보드 만들기', body: '좋아하는 아이템들을 보드에 모아 나만의 스타일을 정리해보세요.' },
    ja: { title: 'ムードボード作り', body: '好きなアイテムをボードに集めて、自分のスタイルを整理。' },
    es: { title: 'Haz un moodboard', body: 'Reúne en un tablero las prendas que te encantan y define tu estilo.' },
    fr: { title: 'Créez un moodboard', body: 'Rassemblez vos pièces préférées sur une planche et affinez votre style.' },
    pt: { title: 'Crie um moodboard', body: 'Junte num painel as peças que você ama e defina seu estilo.' },
    de: { title: 'Erstell ein Moodboard', body: 'Sammle deine Lieblingsteile auf einem Board und finde deinen Stil.' },
  },
];

function pickReminder(idx, lang) {
  const r = REMINDERS[((idx % REMINDERS.length) + REMINDERS.length) % REMINDERS.length];
  return r[lang] || r.en;
}

module.exports = { REMINDERS, pickReminder };
