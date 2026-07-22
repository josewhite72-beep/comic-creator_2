export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { scene, style } = req.body;
  if (!scene) return res.status(400).json({ error: 'Missing scene description' });

  const stylePrefix = style ||
    "children's comic book illustration, flat cartoon style, bold black outlines, bright flat colors, simple vector-art shapes, clean background, no text, no letters, no words, no speech bubbles, no watermark";

  const prompt = `${stylePrefix}. Scene: ${scene}`;
  const model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';

  try {
    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HF_API_KEY}`
      },
      body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } })
    });

    if (!response.ok) {
      let errMsg = 'Hugging Face API error (' + response.status + ')';
      try {
        const errJson = await response.json();
        if (errJson.error) {
          errMsg = errJson.error;
          if (errJson.estimated_time) {
            errMsg += ' — model is warming up, try again in ~' + Math.ceil(errJson.estimated_time) + 's';
          }
        }
      } catch (e) { /* body wasn't JSON */ }
      return res.status(response.status).json({ error: errMsg });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      // HF sometimes returns JSON errors with a 200 status
      const text = await response.text();
      return res.status(502).json({ error: 'Unexpected response: ' + text.slice(0, 200) });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({ image: `data:${contentType};base64,${base64}` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
