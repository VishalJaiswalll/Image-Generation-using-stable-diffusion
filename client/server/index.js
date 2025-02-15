const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
require('dotenv').config();

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com' 
    : 'http://localhost:5173'
}));

app.use(express.json({ limit: '5mb' })); // Add request size limit

// Validate environment variables on startup
if (!process.env.HF_TOKEN) {
  console.error('ERROR: Missing HF_TOKEN in environment variables');
  process.exit(1);
}

const hf = new HfInference(process.env.HF_TOKEN);

// Add rate limiting
const RATE_LIMIT = 5; // Requests per minute per IP
const requestCounts = new Map();

app.post('/generate', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    const count = (requestCounts.get(clientIP) || 0) + 1;
    requestCounts.set(clientIP, count);
    
    if (count > RATE_LIMIT) {
      return res.status(429).json({ 
        error: "Too many requests. Please wait a minute."
      });
    }

    // Validate input
    const { prompt, ratio } = req.body;
    
    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ 
        error: "Prompt must be at least 3 meaningful characters"
      });
    }

    // Block common inappropriate content patterns
    const blockedKeywords = ['nude', 'violence', 'hate'];
    if (blockedKeywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
      return res.status(400).json({ 
        error: "Prompt contains restricted content"
      });
    }

    // Enhanced dimension handling
    const dimensions = {
      '1:1': { width: 768, height: 768 },
      '16:9': { width: 1024, height: 576 } // Better SD aspect ratio
    }[ratio] || { width: 768, height: 768 };

    // Timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Generate image with better parameters
    const response = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0', // Newer model
      inputs: prompt,
      parameters: {
        ...dimensions,
        num_inference_steps: 30, // Faster generation
        guidance_scale: 7.5,
        negative_prompt: "out of frame, lowres, text, error, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, username, watermark, signature" // Better results
      },
      options: { signal: controller.signal }
    });

    clearTimeout(timeoutId);

    // Convert to base64 with error handling
    try {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      res.json({ 
        images: [`data:image/png;base64,${base64}`],
        aspectRatio: ratio
      });
    } catch (convertError) {
      console.error("Conversion error:", convertError);
      throw new Error("Failed to process image");
    }

  } catch (error) {
    console.error("Generation Error:", {
      message: error.message,
      code: error.code,
      type: error.name,
      stack: error.stack
    });

    const statusCode = error.name === 'AbortError' ? 504 : 500;
    
    res.status(statusCode).json({ 
      error: "Image generation failed",
      details: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Please try again with a different prompt'
    });
  }
});

// Reset rate limits every minute
setInterval(() => requestCounts.clear(), 60000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Hugging Face model: stabilityai/stable-diffusion-3.5-large`);
});