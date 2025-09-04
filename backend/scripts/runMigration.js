#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * This script runs database migrations to improve performance.
 * 
 * Usage:
 *   node scripts/runMigration.js
 *   npm run migrate
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🔄 Starting database migration...');

// Run migrations in sequence
const migrations = [
  'addUsersIndex.js',
  'addCompoundIndexes.js'
];

let currentMigration = 0;

const runNextMigration = () => {
  if (currentMigration >= migrations.length) {
    console.log('✅ All migrations completed!');
    return;
  }
  
  const migrationFile = migrations[currentMigration];
  const migrationPath = path.join(__dirname, migrationFile);
  
  console.log(`🔄 Running migration ${currentMigration + 1}/${migrations.length}: ${migrationFile}`);
  
  // Use quotes around the path to handle spaces in directory names
  exec(`node "${migrationPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Migration ${migrationFile} failed:`, error);
      process.exit(1);
    }
    
    if (stderr) {
      console.error(`⚠️ Migration ${migrationFile} warnings:`, stderr);
    }
    
    console.log(`📋 Migration ${migrationFile} output:`);
    console.log(stdout);
    
    currentMigration++;
    runNextMigration();
  });
};

runNextMigration();
