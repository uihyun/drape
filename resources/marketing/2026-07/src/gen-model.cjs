// Generate an editorial model shot wearing a real closet item (for ad concept B).
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('/Users/uihyun/Desktop/work/drape/functions/node_modules/@google/genai');

const env = fs.readFileSync('/Users/uihyun/Desktop/work/drape/.env', 'utf8');
const key = env.match(/VITE_GEMINI_API_KEY_DEV=(.+)/)[1].trim();
const ai = new GoogleGenAI({ apiKey: key });

const OUT = process.argv[2];
const ITEM = process.argv[3];
const PROMPT = process.argv[4];

const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

(async () => {
  const itemB64 = fs.readFileSync(ITEM).toString('base64');
  const parts = [
    { inlineData: { mimeType: 'image/png', data: itemB64 } },
    { text: PROMPT },
  ];
  const res = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: parts,
    config: { safetySettings, imageConfig: { imageSize: '2K' } },
  });
  const cand = res?.candidates?.[0];
  const img = cand?.content?.parts?.find((p) => p.inlineData);
  if (!img) {
    console.error('NO IMAGE. finishReason:', cand?.finishReason, JSON.stringify(cand?.content?.parts?.map(p => p.text).filter(Boolean)));
    process.exit(1);
  }
  fs.writeFileSync(OUT, Buffer.from(img.inlineData.data, 'base64'));
  console.log('OK', OUT, res.usageMetadata?.totalTokenCount, 'tokens');
})();
