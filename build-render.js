#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync, mkdirSync, cpSync, rmSync } = require('fs');
const { join } = require('path');

console.log('🚀 Starting Render build process...');

try {
  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  const distDir = join(__dirname, 'dist');
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // Install all dependencies including devDependencies for build
  console.log('📦 Installing all dependencies for build...');
  execSync('npm install --include=dev', { stdio: 'inherit' });

  // The root install should handle workspaces, so these are not needed
  // and may cause issues.
  // console.log('📦 Installing server dependencies...');
  // execSync('cd server && npm install --include=dev', { stdio: 'inherit' });
  //
  // console.log('📦 Installing client dependencies...');
  // execSync('cd client && npm install --include=dev', { stdio: 'inherit' });

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

  // Copy database scripts
  console.log('📦 Copying database scripts...');
  const dbScriptsPath = join(__dirname, 'server', 'db');
  const distDbPath = join(__dirname, 'dist', 'server', 'db');
  if (existsSync(dbScriptsPath)) {
    cpSync(dbScriptsPath, distDbPath, { recursive: true });
    console.log('✅ Database scripts copied successfully');
  } else {
    // This is not a critical error, just a warning
    console.warn('⚠️ Database scripts directory not found, skipping copy.');
  }

  // Copy server package.json and install production dependencies
  console.log('📦 Setting up production dependencies...');
  const serverPackageJson = join(__dirname, 'server', 'package.json');
  const distPackageJson = join(__dirname, 'dist', 'package.json');
  cpSync(serverPackageJson, distPackageJson);
  
  // Install only production dependencies in dist
  execSync('npm install --production', { stdio: 'inherit', cwd: distDir });

  console.log('✨ Render build completed successfully!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}