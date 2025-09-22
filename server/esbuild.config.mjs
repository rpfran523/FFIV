import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure dist directory exists
mkdirSync(join(__dirname, 'dist'), { recursive: true });

// Copy .env if it exists
try {
  copyFileSync(join(__dirname, '.env'), join(__dirname, 'dist/.env'));
} catch (err) {
  // .env might not exist, that's okay
}

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  format: 'cjs',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  external: [
    'pg-native',
    'stripe',
    'ioredis',
    'bcrypt',
    'uuid',
    'dotenv',
    'express',
    'cors',
    'helmet',
    'cookie-parser',
    'jsonwebtoken',
    'bcryptjs',
    'pg',
    'joi',
    'express-rate-limit'
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
});
