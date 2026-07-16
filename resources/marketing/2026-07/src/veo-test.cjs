const fs = require('fs');
const { GoogleGenAI } = require('/Users/uihyun/Desktop/work/drape/functions/node_modules/@google/genai');
const key = fs.readFileSync('/Users/uihyun/Desktop/work/drape/.env','utf8').match(/VITE_GEMINI_API_KEY_DEV=(.+)/)[1].trim();
const ai = new GoogleGenAI({ apiKey: key });
(async () => {
  try {
    const img = fs.readFileSync('/private/tmp/claude-501/-Users-uihyun-Desktop-work-drape/d7c5166a-a2ce-461a-9fd4-3993458b1b28/scratchpad/model-bomber-916.png');
    let op = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: 'Subtle cinematic fashion editorial motion: the model shifts weight slightly, fabric of the black varsity bomber moves naturally, soft studio light flicker, camera slowly pushes in. Calm, minimal, high-end lookbook mood. No text.',
      image: { imageBytes: img.toString('base64'), mimeType: 'image/png' },
      config: { aspectRatio: '9:16', resolution: '720p' },
    });
    console.log('operation started:', op.name || '(no name)');
    for (let i = 0; i < 60 && !op.done; i++) {
      await new Promise(r => setTimeout(r, 10000));
      op = await ai.operations.getVideosOperation({ operation: op });
      console.log('poll', i, 'done:', op.done);
    }
    const video = op.response?.generatedVideos?.[0];
    if (!video) { console.log('NO VIDEO:', JSON.stringify(op.error || op.response || {}).slice(0, 400)); process.exit(1); }
    await ai.files.download({ file: video.video, downloadPath: '/private/tmp/claude-501/-Users-uihyun-Desktop-work-drape/d7c5166a-a2ce-461a-9fd4-3993458b1b28/scratchpad/veo-bomber2.mp4' });
    console.log('VEO OK — saved veo-bomber2.mp4');
  } catch (e) {
    console.log('VEO FAILED:', String(e.message || e).slice(0, 500));
    process.exit(1);
  }
})();
