#!/usr/bin/env ts-node
/**
 * Migration Generator
 * Usage: pnpm migrate:create <migration_name>
 * Example: pnpm migrate:create identity_users
 */

import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  '../libs/database/src/migrations',
);

const MIGRATION_TEMPLATE = `import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  
}

export async function down(db: Kysely<any>): Promise<void> {
  
}
`;

function validateMigrationName(name: string): void {
  if (!name) {
    console.error('❌ Migration name is required');
    console.error('   Usage: pnpm migrate:create <migration_name>');
    console.error('   Example: pnpm migrate:create identity_users');
    process.exit(1);
  }

  if (!/^[a-z0-9_]+$/.test(name)) {
    console.error(
      '❌ Migration name must only contain lowercase letters, numbers, and underscores',
    );
    console.error(`   Received: "${name}"`);
    process.exit(1);
  }
}

function ensureMigrationsDir(): void {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    console.log(`📁 Created migrations directory: ${MIGRATIONS_DIR}`);
  }
}

function generateFileName(name: string): string {
  const timestamp = Date.now();
  return `${timestamp}_${name}.ts`;
}

function createMigration(name: string): void {
  validateMigrationName(name);
  ensureMigrationsDir();

  const fileName = generateFileName(name);
  const filePath = path.join(MIGRATIONS_DIR, fileName);

  // Guard against duplicate names in the same millisecond (extremely unlikely
  // but worth handling cleanly)
  if (fs.existsSync(filePath)) {
    console.error(`❌ Migration file already exists: ${fileName}`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, MIGRATION_TEMPLATE, 'utf8');

  console.log(`✅ Migration created: ${fileName}`);
  console.log(`   Path: ${filePath}`);
}

// Entry point
const migrationName = process.argv[2];
createMigration(migrationName);
