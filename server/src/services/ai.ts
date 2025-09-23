import OpenAI from 'openai';
import { cacheService } from './cache';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'text-embedding-3-small';

export async function embed(text: string): Promise<number[]> {
  const key = `embed:${MODEL}:${Buffer.from(text).toString('base64').slice(0,64)}`;
  const cached = await cacheService.get(key);
  if (cached) return JSON.parse(cached);

  const res = await client.embeddings.create({ model: MODEL, input: text });
  const vec = res.data[0].embedding as number[];
  await cacheService.set(key, JSON.stringify(vec), 7 * 24 * 60 * 60);
  return vec;
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}
