#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync, mkdirSync, cpSync, rmSync } = require('fs');
const { join } = require('path');

console.log('🚀 Starting Render build process...');

try {
  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  const distDir = join(__dirname, '..', 'dist');
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // Install all dependencies including devDependencies for build
  console.log('📦 Installing all dependencies for build...');
  execSync('npm ci', { stdio: 'inherit', cwd: join(__dirname, '..') });

  // Install server dependencies including devDependencies
  console.log('📦 Installing server dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: join(__dirname, '..', 'server') });
  
  // Install client dependencies
  console.log('📦 Installing client dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: join(__dirname, '..', 'client') });

  // Build server
  console.log('🔨 Building server...');
  execSync('npm run build', { stdio: 'inherit', cwd: join(__dirname, '..', 'server') });

  // Build client
  console.log('🎨 Building client...');
  execSync('npm run build', { stdio: 'inherit', cwd: join(__dirname, '..', 'client') });

  // Copy client build to server dist
  console.log('📦 Copying client build to server dist...');
  const clientBuildPath = join(__dirname, '..', 'client', 'dist');
  const serverClientPath = join(__dirname, '..', 'dist', 'client');
  
  if (existsSync(clientBuildPath)) {
    cpSync(clientBuildPath, serverClientPath, { recursive: true });
    console.log('✅ Client files copied successfully');
  } else {
    throw new Error('Client build directory not found');
  }

  // Copy server build to dist
  console.log('📦 Copying server build...');
  const serverBuildPath = join(__dirname, '..', 'server', 'dist');
  const distServerPath = join(__dirname, '..', 'dist', 'server');
  
  if (existsSync(serverBuildPath)) {
    cpSync(serverBuildPath, distServerPath, { recursive: true });
    console.log('✅ Server files copied successfully');
  } else {
    throw new Error('Server build directory not found');
  }

  // Copy server package.json and install production dependencies
  console.log('📦 Setting up production dependencies...');
  const serverPackageJson = join(__dirname, '..', 'server', 'package.json');
  const distPackageJson = join(__dirname, '..', 'dist', 'package.json');
  cpSync(serverPackageJson, distPackageJson);
  
  // Install only production dependencies in dist
  execSync('npm install --production', { stdio: 'inherit', cwd: distDir });

  console.log('✨ Render build completed successfully!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
