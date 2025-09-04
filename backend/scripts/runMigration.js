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

// Run the users index migration
const migrationPath = path.join(__dirname, 'addUsersIndex.js');

exec(`node ${migrationPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  if (stderr) {
    console.error('⚠️ Migration warnings:', stderr);
  }
  
  console.log('📋 Migration output:');
  console.log(stdout);
  
  console.log('✅ Migration completed!');
});
