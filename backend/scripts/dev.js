#!/usr/bin/env node
process.env.NODE_ENV = 'development';
const { spawn } = require('child_process');
const nodemon = spawn('npx', ['nodemon'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});
nodemon.on('error', (err) => {
  console.error('Failed to start nodemon:', err);
  process.exit(1);
});
nodemon.on('exit', (code) => process.exit(code != null ? code : 0));
