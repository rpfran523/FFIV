#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting Render build process...');

try {
  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  const distDir = join(__dirname, 'dist');
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // Install dependencies for workspaces
  console.log('📦 Installing server dependencies...');
  execSync('cd server && npm install', { stdio: 'inherit' });
  
  console.log('📦 Installing client dependencies...');
  execSync('cd client && npm install', { stdio: 'inherit' });

  // Build server
  console.log('🔨 Building server...');
  execSync('cd server && npm run build', { stdio: 'inherit' });

  // Build client
  console.log('🎨 Building client...');
  execSync('cd client && npm run build', { stdio: 'inherit' });

  // Copy client build to server dist
  console.log('📦 Copying client build to server dist...');
  const clientBuildPath = join(__dirname, 'client', 'dist');
  const serverClientPath = join(__dirname, 'dist', 'client');
  
  if (existsSync(clientBuildPath)) {
    cpSync(clientBuildPath, serverClientPath, { recursive: true });
    console.log('✅ Client files copied successfully');
  } else {
    throw new Error('Client build directory not found');
  }

  // Copy server build to dist
  console.log('📦 Copying server build...');
  const serverBuildPath = join(__dirname, 'server', 'dist');
  const distServerPath = join(__dirname, 'dist', 'server');
  
  if (existsSync(serverBuildPath)) {
    cpSync(serverBuildPath, distServerPath, { recursive: true });
    console.log('✅ Server files copied successfully');
  } else {
    throw new Error('Server build directory not found');
  }

  // Copy package.json for production
  const serverPackageJson = join(__dirname, 'server', 'package.json');
  const distPackageJson = join(__dirname, 'dist', 'package.json');
  cpSync(serverPackageJson, distPackageJson);

  console.log('✨ Render build completed successfully!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
