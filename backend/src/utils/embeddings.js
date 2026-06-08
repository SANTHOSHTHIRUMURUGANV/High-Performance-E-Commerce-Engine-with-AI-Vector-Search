import { pipeline } from '@xenova/transformers';

let extractor = null;
let useLocalModel = true;

/**
 * Deterministically generates a 384-dimensional normalized vector from text.
 * Used as a zero-dependency local fallback when model loading is offline or skipped.
 */
export const getMockEmbedding = (text) => {
  const embedding = new Array(384).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  for (let i = 0; i < 384; i++) {
    const seed = Math.sin(hash + i) * 10000;
    embedding[i] = seed - Math.floor(seed);
  }
  
  // Normalize vector to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return embedding;
  return embedding.map(val => val / magnitude);
};

/**
 * Generates a 384-dimensional embedding vector for a given text.
 * First attempts to load and run Xenova/all-MiniLM-L6-v2 model locally.
 * Falls back to getMockEmbedding if loading fails.
 */
export const getEmbedding = async (text) => {
  if (!text || typeof text !== 'string') {
    return getMockEmbedding('');
  }

  // If previous attempts failed, bypass and use mock directly
  if (!useLocalModel) {
    return getMockEmbedding(text);
  }

  try {
    if (!extractor) {
      console.log('Initializing local ONNX embedding pipeline (Xenova/all-MiniLM-L6-v2)...');
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        progress_callback: (info) => {
          if (info.status === 'downloading') {
            console.log(`Downloading embedding model: ${info.file} (${Math.round(info.loaded / 1024 / 1024)}MB / ${Math.round(info.total / 1024 / 1024)}MB)`);
          }
        }
      });
      console.log('ONNX Embedding model initialized successfully!');
    }
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (err) {
    console.warn(`Could not load local ONNX model (${err.message}). Falling back to deterministic offline embeddings.`);
    useLocalModel = false;
    return getMockEmbedding(text);
  }
};

/**
 * Service object wrapper to facilitate testing and spy stubs in native ESM environments.
 */
export const embeddingsService = {
  getEmbedding,
  getMockEmbedding
};
