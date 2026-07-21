// Multi-image try-on composite: identity photo + item images → same person,
// same scene/pose, wearing the items. Mirrors the app's custom-photo try-on.
const fs = require('fs');
const { GoogleGenAI } = require('/Users/uihyun/Desktop/work/drape/functions/node_modules/@google/genai');
const key = fs.readFileSync('/Users/uihyun/Desktop/work/drape/.env', 'utf8').match(/VITE_GEMINI_API_KEY_DEV=(.+)/)[1].trim();
const ai = new GoogleGenAI({ apiKey: key });

const [OUT, IDENTITY, PROMPT, ...ITEMS] = process.argv.slice(2);
const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];
const part = (p) => ({ inlineData: { mimeType: p.endsWith('.jpg') ? 'image/jpeg' : 'image/png', data: fs.readFileSync(p).toString('base64') } });

(async () => {
  const res = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: [part(IDENTITY), ...ITEMS.map(part), { text: PROMPT }],
    config: { safetySettings, imageConfig: { imageSize: '2K' } },
  });
  const img = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!img) { console.error('NO IMAGE:', res?.candidates?.[0]?.finishReason); process.exit(1); }
  fs.writeFileSync(OUT, Buffer.from(img.inlineData.data, 'base64'));
  console.log('OK', OUT);
})();
