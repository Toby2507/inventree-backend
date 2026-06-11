#!/usr/bin/env ts-node
/**
 * Migration Generator
 * Usage: pnpm migrate:create <migration_name>
 * Example: pnpm migrate:create identity_users
 */

import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname, '../libs/database/src/migrations');

const MIGRATION_TEMPLATE = `import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      \`

      \`,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      \`

      \`,
    )
    .execute(db);
}
`;

function validateMigrationName(name: string): void {
  if (!name) {
    console.error('❌ Migration name is required');
    console.error('   Usage: pnpm migrate:create <migration_type> <migration_name>');
    console.error('   Example: pnpm migrate:create operational identity_users');
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

function validateMigrationType(type: string): void {
  const validTypes = ['operational', 'analytics'];
  if (!type) {
    console.error('❌ Migration type is required');
    console.error('   Usage: pnpm migrate:create <migration_type> <migration_name>');
    console.error('   Example: pnpm migrate:create operational identity_users');
    process.exit(1);
  }
  if (!validTypes.includes(type)) {
    console.error(`❌ Invalid migration type: "${type}"`);
    console.error(`   Valid types are: ${validTypes.join(', ')}`);
    process.exit(1);
  }
}

function ensureMigrationsDir(type: string): void {
  const migPath = path.resolve(MIGRATIONS_DIR, type);
  if (!fs.existsSync(migPath)) {
    fs.mkdirSync(migPath, { recursive: true });
    console.log(`📁 Created migrations directory: ${migPath}`);
  }
}

function generateFileName(name: string): string {
  const timestamp = Date.now();
  return `${timestamp}_${name}.ts`;
}

function createMigration(name: string, type: string): void {
  validateMigrationName(name);
  validateMigrationType(type);
  ensureMigrationsDir(type);

  const fileName = generateFileName(name);
  const filePath = path.join(MIGRATIONS_DIR, type, fileName);

  // Guard against duplicate names in the same millisecond (extremely unlikely
  // but worth handling cleanly)
  if (fs.existsSync(filePath)) {
    console.error(`❌ Migration file already exists: ${fileName}`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, MIGRATION_TEMPLATE, 'utf8');

  console.log(`✅ Migration created: ${fileName}`);
  console.log(`   Path: ${filePath}`);
  console.log('');
  console.log('⚠️  Remember to register this migration in:');
  console.log(`   libs/database/src/migrations/${type}/index.ts`);
  console.log(`   import * as ${name} from './${fileName.replace('.ts', '')}';`);
  console.log(`   Add to ${type}Migrations object: `);
  console.log(`   '${fileName.replace('.ts', '')}': ${name},`);
}

// Entry point
const migrationType = process.argv[2];
const migrationName = process.argv[3];
createMigration(migrationName, migrationType);
