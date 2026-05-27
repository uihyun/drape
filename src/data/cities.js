// Curated city list for the profile location picker. Each entry has a
// stable canonical id (stored in profiles.location) and a names map for
// every supported app locale. Display lookup uses the current locale
// and falls back to en when a translation is missing.
//
// Keep the list short and obviously-major — autocomplete is meant to
// canonicalize "tokyo" / "도쿄" / "東京" to one entry, not to mirror
// the world's geo database. Add cities on user request, not pre-emptively.

export const CITIES = [
  // ── Korea ──────────────────────────────────────────────────────────
  { id: 'seoul-kr',          country: 'KR', names: { en: 'Seoul',          ko: '서울',        ja: 'ソウル' } },
  { id: 'busan-kr',          country: 'KR', names: { en: 'Busan',          ko: '부산',        ja: 'プサン' } },
  { id: 'incheon-kr',        country: 'KR', names: { en: 'Incheon',        ko: '인천',        ja: 'インチョン' } },
  { id: 'daegu-kr',          country: 'KR', names: { en: 'Daegu',          ko: '대구',        ja: 'テグ' } },
  { id: 'daejeon-kr',        country: 'KR', names: { en: 'Daejeon',        ko: '대전',        ja: 'テジョン' } },
  { id: 'gwangju-kr',        country: 'KR', names: { en: 'Gwangju',        ko: '광주',        ja: 'クァンジュ' } },
  { id: 'ulsan-kr',          country: 'KR', names: { en: 'Ulsan',          ko: '울산',        ja: 'ウルサン' } },
  { id: 'jeju-kr',           country: 'KR', names: { en: 'Jeju',           ko: '제주',        ja: '済州' } },

  // ── Japan ──────────────────────────────────────────────────────────
  { id: 'tokyo-jp',          country: 'JP', names: { en: 'Tokyo',          ko: '도쿄',        ja: '東京' } },
  { id: 'osaka-jp',          country: 'JP', names: { en: 'Osaka',          ko: '오사카',      ja: '大阪' } },
  { id: 'kyoto-jp',          country: 'JP', names: { en: 'Kyoto',          ko: '교토',        ja: '京都' } },
  { id: 'yokohama-jp',       country: 'JP', names: { en: 'Yokohama',       ko: '요코하마',    ja: '横浜' } },
  { id: 'nagoya-jp',         country: 'JP', names: { en: 'Nagoya',         ko: '나고야',      ja: '名古屋' } },
  { id: 'sapporo-jp',        country: 'JP', names: { en: 'Sapporo',        ko: '삿포로',      ja: '札幌' } },
  { id: 'fukuoka-jp',        country: 'JP', names: { en: 'Fukuoka',        ko: '후쿠오카',    ja: '福岡' } },
  { id: 'kobe-jp',           country: 'JP', names: { en: 'Kobe',           ko: '고베',        ja: '神戸' } },
  { id: 'sendai-jp',         country: 'JP', names: { en: 'Sendai',         ko: '센다이',      ja: '仙台' } },
  { id: 'hiroshima-jp',      country: 'JP', names: { en: 'Hiroshima',      ko: '히로시마',    ja: '広島' } },
  { id: 'kawasaki-jp',       country: 'JP', names: { en: 'Kawasaki',       ko: '가와사키',    ja: '川崎' } },
  { id: 'saitama-jp',        country: 'JP', names: { en: 'Saitama',        ko: '사이타마',    ja: 'さいたま' } },
  { id: 'kitakyushu-jp',     country: 'JP', names: { en: 'Kitakyushu',     ko: '기타큐슈',    ja: '北九州' } },
  { id: 'chiba-jp',          country: 'JP', names: { en: 'Chiba',          ko: '치바',        ja: '千葉' } },
  { id: 'okinawa-jp',        country: 'JP', names: { en: 'Okinawa',        ko: '오키나와',    ja: '沖縄' } },

  // ── Greater China ─────────────────────────────────────────────────
  { id: 'shanghai-cn',       country: 'CN', names: { en: 'Shanghai',       ko: '상하이',      ja: '上海' } },
  { id: 'beijing-cn',        country: 'CN', names: { en: 'Beijing',        ko: '베이징',      ja: '北京' } },
  { id: 'hongkong-hk',       country: 'HK', names: { en: 'Hong Kong',      ko: '홍콩',        ja: '香港' } },
  { id: 'shenzhen-cn',       country: 'CN', names: { en: 'Shenzhen',       ko: '선전',        ja: '深圳' } },
  { id: 'guangzhou-cn',      country: 'CN', names: { en: 'Guangzhou',      ko: '광저우',      ja: '広州' } },
  { id: 'chengdu-cn',        country: 'CN', names: { en: 'Chengdu',        ko: '청두',        ja: '成都' } },
  { id: 'hangzhou-cn',       country: 'CN', names: { en: 'Hangzhou',       ko: '항저우',      ja: '杭州' } },
  { id: 'xian-cn',           country: 'CN', names: { en: "Xi'an",          ko: '시안',        ja: '西安' } },
  { id: 'wuhan-cn',          country: 'CN', names: { en: 'Wuhan',          ko: '우한',        ja: '武漢' } },
  { id: 'taipei-tw',         country: 'TW', names: { en: 'Taipei',         ko: '타이베이',    ja: '台北' } },

  // ── Southeast Asia ────────────────────────────────────────────────
  { id: 'singapore-sg',      country: 'SG', names: { en: 'Singapore',      ko: '싱가포르',    ja: 'シンガポール' } },
  { id: 'bangkok-th',        country: 'TH', names: { en: 'Bangkok',        ko: '방콕',        ja: 'バンコク' } },
  { id: 'kualalumpur-my',    country: 'MY', names: { en: 'Kuala Lumpur',   ko: '쿠알라룸푸르', ja: 'クアラルンプール' } },
  { id: 'manila-ph',         country: 'PH', names: { en: 'Manila',         ko: '마닐라',      ja: 'マニラ' } },
  { id: 'hochiminh-vn',      country: 'VN', names: { en: 'Ho Chi Minh City', ko: '호치민',    ja: 'ホーチミン' } },
  { id: 'jakarta-id',        country: 'ID', names: { en: 'Jakarta',        ko: '자카르타',    ja: 'ジャカルタ' } },
  { id: 'hanoi-vn',          country: 'VN', names: { en: 'Hanoi',          ko: '하노이',      ja: 'ハノイ' } },
  { id: 'bali-id',           country: 'ID', names: { en: 'Bali',           ko: '발리',        ja: 'バリ' } },

  // ── North America ─────────────────────────────────────────────────
  { id: 'newyork-us',        country: 'US', names: { en: 'New York',       ko: '뉴욕',        ja: 'ニューヨーク' } },
  { id: 'losangeles-us',     country: 'US', names: { en: 'Los Angeles',    ko: '로스앤젤레스', ja: 'ロサンゼルス' } },
  { id: 'sanfrancisco-us',   country: 'US', names: { en: 'San Francisco',  ko: '샌프란시스코', ja: 'サンフランシスコ' } },
  { id: 'chicago-us',        country: 'US', names: { en: 'Chicago',        ko: '시카고',      ja: 'シカゴ' } },
  { id: 'seattle-us',        country: 'US', names: { en: 'Seattle',        ko: '시애틀',      ja: 'シアトル' } },
  { id: 'boston-us',         country: 'US', names: { en: 'Boston',         ko: '보스턴',      ja: 'ボストン' } },
  { id: 'austin-us',         country: 'US', names: { en: 'Austin',         ko: '오스틴',      ja: 'オースティン' } },
  { id: 'miami-us',          country: 'US', names: { en: 'Miami',          ko: '마이애미',    ja: 'マイアミ' } },
  { id: 'portland-us',       country: 'US', names: { en: 'Portland',       ko: '포틀랜드',    ja: 'ポートランド' } },
  { id: 'brooklyn-us',       country: 'US', names: { en: 'Brooklyn',       ko: '브루클린',    ja: 'ブルックリン' } },
  { id: 'washingtondc-us',   country: 'US', names: { en: 'Washington DC',  ko: '워싱턴 D.C.', ja: 'ワシントンD.C.' } },
  { id: 'atlanta-us',        country: 'US', names: { en: 'Atlanta',        ko: '애틀랜타',    ja: 'アトランタ' } },
  { id: 'lasvegas-us',       country: 'US', names: { en: 'Las Vegas',      ko: '라스베이거스', ja: 'ラスベガス' } },
  { id: 'denver-us',         country: 'US', names: { en: 'Denver',         ko: '덴버',        ja: 'デンバー' } },
  { id: 'philadelphia-us',   country: 'US', names: { en: 'Philadelphia',   ko: '필라델피아',  ja: 'フィラデルフィア' } },
  { id: 'houston-us',        country: 'US', names: { en: 'Houston',        ko: '휴스턴',      ja: 'ヒューストン' } },
  { id: 'dallas-us',         country: 'US', names: { en: 'Dallas',         ko: '댈러스',      ja: 'ダラス' } },
  { id: 'sandiego-us',       country: 'US', names: { en: 'San Diego',      ko: '샌디에이고',  ja: 'サンディエゴ' } },
  { id: 'phoenix-us',        country: 'US', names: { en: 'Phoenix',        ko: '피닉스',      ja: 'フェニックス' } },
  { id: 'minneapolis-us',    country: 'US', names: { en: 'Minneapolis',    ko: '미니애폴리스', ja: 'ミネアポリス' } },
  { id: 'nashville-us',      country: 'US', names: { en: 'Nashville',      ko: '내슈빌',      ja: 'ナッシュビル' } },
  { id: 'toronto-ca',        country: 'CA', names: { en: 'Toronto',        ko: '토론토',      ja: 'トロント' } },
  { id: 'vancouver-ca',      country: 'CA', names: { en: 'Vancouver',      ko: '밴쿠버',      ja: 'バンクーバー' } },
  { id: 'montreal-ca',       country: 'CA', names: { en: 'Montreal',       ko: '몬트리올',    ja: 'モントリオール' } },
  { id: 'calgary-ca',        country: 'CA', names: { en: 'Calgary',        ko: '캘거리',      ja: 'カルガリー' } },

  // ── Europe ────────────────────────────────────────────────────────
  { id: 'london-gb',         country: 'GB', names: { en: 'London',         ko: '런던',        ja: 'ロンドン' } },
  { id: 'paris-fr',          country: 'FR', names: { en: 'Paris',          ko: '파리',        ja: 'パリ' } },
  { id: 'berlin-de',         country: 'DE', names: { en: 'Berlin',         ko: '베를린',      ja: 'ベルリン' } },
  { id: 'milan-it',          country: 'IT', names: { en: 'Milan',          ko: '밀라노',      ja: 'ミラノ' } },
  { id: 'rome-it',           country: 'IT', names: { en: 'Rome',           ko: '로마',        ja: 'ローマ' } },
  { id: 'madrid-es',         country: 'ES', names: { en: 'Madrid',         ko: '마드리드',    ja: 'マドリード' } },
  { id: 'barcelona-es',      country: 'ES', names: { en: 'Barcelona',      ko: '바르셀로나',  ja: 'バルセロナ' } },
  { id: 'amsterdam-nl',      country: 'NL', names: { en: 'Amsterdam',      ko: '암스테르담',  ja: 'アムステルダム' } },
  { id: 'copenhagen-dk',     country: 'DK', names: { en: 'Copenhagen',     ko: '코펜하겐',    ja: 'コペンハーゲン' } },
  { id: 'stockholm-se',      country: 'SE', names: { en: 'Stockholm',      ko: '스톡홀름',    ja: 'ストックホルム' } },
  { id: 'oslo-no',           country: 'NO', names: { en: 'Oslo',           ko: '오슬로',      ja: 'オスロ' } },
  { id: 'helsinki-fi',       country: 'FI', names: { en: 'Helsinki',       ko: '헬싱키',      ja: 'ヘルシンキ' } },
  { id: 'vienna-at',         country: 'AT', names: { en: 'Vienna',         ko: '빈',          ja: 'ウィーン' } },
  { id: 'zurich-ch',         country: 'CH', names: { en: 'Zurich',         ko: '취리히',      ja: 'チューリッヒ' } },
  { id: 'lisbon-pt',         country: 'PT', names: { en: 'Lisbon',         ko: '리스본',      ja: 'リスボン' } },
  { id: 'dublin-ie',         country: 'IE', names: { en: 'Dublin',         ko: '더블린',      ja: 'ダブリン' } },
  { id: 'prague-cz',         country: 'CZ', names: { en: 'Prague',         ko: '프라하',      ja: 'プラハ' } },
  { id: 'munich-de',         country: 'DE', names: { en: 'Munich',         ko: '뮌헨',        ja: 'ミュンヘン' } },
  { id: 'florence-it',       country: 'IT', names: { en: 'Florence',       ko: '피렌체',      ja: 'フィレンツェ' } },
  { id: 'reykjavik-is',      country: 'IS', names: { en: 'Reykjavik',      ko: '레이캬비크',  ja: 'レイキャビク' } },
  { id: 'hamburg-de',        country: 'DE', names: { en: 'Hamburg',        ko: '함부르크',    ja: 'ハンブルク' } },
  { id: 'frankfurt-de',      country: 'DE', names: { en: 'Frankfurt',      ko: '프랑크푸르트', ja: 'フランクフルト' } },
  { id: 'brussels-be',       country: 'BE', names: { en: 'Brussels',       ko: '브뤼셀',      ja: 'ブリュッセル' } },
  { id: 'edinburgh-gb',      country: 'GB', names: { en: 'Edinburgh',      ko: '에든버러',    ja: 'エディンバラ' } },
  { id: 'manchester-gb',     country: 'GB', names: { en: 'Manchester',     ko: '맨체스터',    ja: 'マンチェスター' } },
  { id: 'athens-gr',         country: 'GR', names: { en: 'Athens',         ko: '아테네',      ja: 'アテネ' } },
  { id: 'budapest-hu',       country: 'HU', names: { en: 'Budapest',       ko: '부다페스트',  ja: 'ブダペスト' } },
  { id: 'warsaw-pl',         country: 'PL', names: { en: 'Warsaw',         ko: '바르샤바',    ja: 'ワルシャワ' } },
  { id: 'istanbul-tr',       country: 'TR', names: { en: 'Istanbul',       ko: '이스탄불',    ja: 'イスタンブール' } },
  { id: 'naples-it',         country: 'IT', names: { en: 'Naples',         ko: '나폴리',      ja: 'ナポリ' } },
  { id: 'venice-it',         country: 'IT', names: { en: 'Venice',         ko: '베네치아',    ja: 'ヴェネツィア' } },
  { id: 'lyon-fr',           country: 'FR', names: { en: 'Lyon',           ko: '리옹',        ja: 'リヨン' } },
  { id: 'marseille-fr',      country: 'FR', names: { en: 'Marseille',      ko: '마르세유',    ja: 'マルセイユ' } },
  { id: 'geneva-ch',         country: 'CH', names: { en: 'Geneva',         ko: '제네바',      ja: 'ジュネーブ' } },
  { id: 'porto-pt',          country: 'PT', names: { en: 'Porto',          ko: '포르투',      ja: 'ポルト' } },

  // ── Other ─────────────────────────────────────────────────────────
  { id: 'sydney-au',         country: 'AU', names: { en: 'Sydney',         ko: '시드니',      ja: 'シドニー' } },
  { id: 'melbourne-au',      country: 'AU', names: { en: 'Melbourne',      ko: '멜버른',      ja: 'メルボルン' } },
  { id: 'perth-au',          country: 'AU', names: { en: 'Perth',          ko: '퍼스',        ja: 'パース' } },
  { id: 'auckland-nz',       country: 'NZ', names: { en: 'Auckland',       ko: '오클랜드',    ja: 'オークランド' } },
  { id: 'dubai-ae',          country: 'AE', names: { en: 'Dubai',          ko: '두바이',      ja: 'ドバイ' } },
  { id: 'abudhabi-ae',       country: 'AE', names: { en: 'Abu Dhabi',      ko: '아부다비',    ja: 'アブダビ' } },
  { id: 'riyadh-sa',         country: 'SA', names: { en: 'Riyadh',         ko: '리야드',      ja: 'リヤド' } },
  { id: 'telaviv-il',        country: 'IL', names: { en: 'Tel Aviv',       ko: '텔아비브',    ja: 'テルアビブ' } },
  { id: 'cairo-eg',          country: 'EG', names: { en: 'Cairo',          ko: '카이로',      ja: 'カイロ' } },
  { id: 'marrakech-ma',      country: 'MA', names: { en: 'Marrakech',      ko: '마라케시',    ja: 'マラケシュ' } },
  { id: 'capetown-za',       country: 'ZA', names: { en: 'Cape Town',      ko: '케이프타운',  ja: 'ケープタウン' } },
  { id: 'johannesburg-za',   country: 'ZA', names: { en: 'Johannesburg',   ko: '요하네스버그', ja: 'ヨハネスブルグ' } },
  { id: 'mumbai-in',         country: 'IN', names: { en: 'Mumbai',         ko: '뭄바이',      ja: 'ムンバイ' } },
  { id: 'delhi-in',          country: 'IN', names: { en: 'Delhi',          ko: '델리',        ja: 'デリー' } },
  { id: 'bangalore-in',      country: 'IN', names: { en: 'Bangalore',      ko: '벵갈루루',    ja: 'バンガロール' } },
  { id: 'mexicocity-mx',     country: 'MX', names: { en: 'Mexico City',    ko: '멕시코시티',  ja: 'メキシコシティ' } },
  { id: 'saopaulo-br',       country: 'BR', names: { en: 'São Paulo',      ko: '상파울루',    ja: 'サンパウロ' } },
  { id: 'riodejaneiro-br',   country: 'BR', names: { en: 'Rio de Janeiro', ko: '리우데자네이루', ja: 'リオデジャネイロ' } },
  { id: 'buenosaires-ar',    country: 'AR', names: { en: 'Buenos Aires',   ko: '부에노스아이레스', ja: 'ブエノスアイレス' } },
];

const BY_ID = new Map(CITIES.map(c => [c.id, c]));

/** Look up a city by id and render in the current locale. Falls back
 *  to en, then to the raw id string (so legacy free-text entries don't
 *  disappear). */
export function cityDisplay(id, lang = 'en') {
  if (!id) return '';
  const c = BY_ID.get(id);
  if (!c) return id;
  return c.names[lang] || c.names.en || c.id;
}

/** Substring search across every locale name. Returns at most `limit`
 *  cities sorted by match position (prefix matches first), with
 *  alphabetical name as the tie-breaker so siblings like "San Diego"
 *  / "San Francisco" stay predictable. Empty query → empty result; the
 *  caller decides whether to show anything when nothing's typed. */
export function searchCities(query, { limit = 10 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const c of CITIES) {
    let best = Infinity;
    for (const lang of ['en', 'ko', 'ja']) {
      const n = c.names[lang]?.toLowerCase();
      if (!n) continue;
      const idx = n.indexOf(q);
      if (idx !== -1 && idx < best) best = idx;
    }
    if (best !== Infinity) scored.push({ c, best });
  }
  scored.sort((a, b) => {
    if (a.best !== b.best) return a.best - b.best;
    return (a.c.names.en || '').localeCompare(b.c.names.en || '');
  });
  return scored.slice(0, limit).map(s => s.c);
}
