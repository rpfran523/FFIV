#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

console.log('🚀 Starting Flower Fairies build process...');

try {
  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  const distDir = join(rootDir, 'dist');
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // Build server
  console.log('🔨 Building server...');
  execSync('npm run build --workspace=server', { 
    stdio: 'inherit',
    cwd: rootDir
  });

  // Build client
  console.log('🎨 Building client...');
  execSync('npm run build --workspace=client', {
    stdio: 'inherit',
    cwd: rootDir
  });

  // Copy client build to server dist
  console.log('📦 Copying client build to server dist...');
  const clientBuildPath = join(rootDir, 'client', 'dist');
  const serverClientPath = join(rootDir, 'dist', 'client');
  
  if (existsSync(clientBuildPath)) {
    cpSync(clientBuildPath, serverClientPath, { recursive: true });
    console.log('✅ Client files copied successfully');
  } else {
    throw new Error('Client build directory not found');
  }

  // Copy any additional files needed for production
  console.log('📄 Copying production files...');
  
  // Copy package.json for production dependencies
  const serverPackageJson = join(rootDir, 'server', 'package.json');
  const distPackageJson = join(rootDir, 'dist', 'package.json');
  cpSync(serverPackageJson, distPackageJson);

  // Copy environment example
  const envExample = join(rootDir, '.env.example');
  if (existsSync(envExample)) {
    cpSync(envExample, join(rootDir, 'dist', '.env.example'));
  }

  console.log('✨ Build completed successfully!');
  console.log('');
  console.log('To run in production:');
  console.log('  cd dist');
  console.log('  npm install --production');
  console.log('  node server/index.js');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
