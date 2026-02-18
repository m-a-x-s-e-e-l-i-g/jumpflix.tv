#!/usr/bin/env tsx
/**
 * JumpFlix Database Backup Tool
 * Creates complete local backups of the Supabase database including schema and data
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/types';
import * as prompts from '@inquirer/prompts';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase credentials!');
	console.error('Please set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
	process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

interface BackupOptions {
	outputDir: string;
	includeSchema: boolean;
	includeData: boolean;
	includeMigrations: boolean;
	includeUsers: boolean;
	anonymizeUserEmails?: boolean;
	tables?: string[];
}

interface TableInfo {
	table_name: string;
	table_schema: string;
}

/**
 * Get list of all user tables in the database
 */
async function getUserTables(): Promise<TableInfo[]> {
	// Discover all relations exposed by PostgREST (Supabase REST API) via its OpenAPI schema.
	// This automatically stays up-to-date when new tables are added.
	try {
		const openApiResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
			headers: {
				apikey: supabaseKey!,
				Authorization: `Bearer ${supabaseKey}`,
				Accept: 'application/openapi+json'
			}
		});

		if (!openApiResponse.ok) {
			throw new Error(
				`OpenAPI fetch failed: ${openApiResponse.status} ${openApiResponse.statusText}`
			);
		}

		const openApi = (await openApiResponse.json()) as {
			paths?: Record<string, Record<string, unknown>>;
		};

		const paths = openApi.paths ?? {};
		const discoveredNames = new Set<string>();

		for (const [rawPath, operations] of Object.entries(paths)) {
			if (!rawPath.startsWith('/')) continue;
			const p = rawPath.slice(1);
			if (!p) continue;
			if (p.includes('{')) continue;
			if (p.startsWith('rpc/')) continue;

			const ops = operations as Record<string, unknown>;
			const hasGet = Boolean(ops.get);
			// Include anything that supports GET; export will gracefully record failures.
			if (!hasGet) continue;

			discoveredNames.add(p);
		}

		const discovered = Array.from(discoveredNames)
			.sort()
			.map((name) => {
				if (name.includes('.')) {
					const [schema, table] = name.split('.', 2);
					return { table_name: table, table_schema: schema };
				}
				return { table_name: name, table_schema: 'public' };
			});

		if (discovered.length === 0) {
			throw new Error('No tables discovered from REST OpenAPI schema');
		}

		console.log(`  📚 Discovered ${discovered.length} tables via REST schema`);
		return discovered;
	} catch (err) {
		console.warn(
			`  ⚠️  Could not auto-discover tables (falling back to known list): ${
				err instanceof Error ? err.message : String(err)
			}`
		);
		return [
			{ table_name: 'media_items', table_schema: 'public' },
			{ table_name: 'series_seasons', table_schema: 'public' },
			{ table_name: 'series_episodes', table_schema: 'public' },
			{ table_name: 'watch_history', table_schema: 'public' },
			{ table_name: 'user_preferences', table_schema: 'public' },
			{ table_name: 'ratings', table_schema: 'public' }
		];
	}
}

/**
 * Export database schema (DDL)
 * Combines migration files into a single schema file
 */
async function exportSchema(): Promise<string> {
	console.log('📋 Exporting schema...');

	let schema = '';
	schema += '-- JumpFlix Database Schema Backup\n';
	schema += `-- Generated: ${new Date().toISOString()}\n`;
	schema += '-- This file combines all migration files into a single schema\n\n';

	// Read and combine all migration files
	const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

	if (fs.existsSync(migrationsDir)) {
		const files = fs
			.readdirSync(migrationsDir)
			.filter((f) => f.endsWith('.sql'))
			.sort();

		if (files.length > 0) {
			console.log(`  📄 Combining ${files.length} migration files...`);

			schema += 'BEGIN;\n\n';
			schema += '-- This schema is generated from the following migrations:\n';
			files.forEach((file) => {
				schema += `-- - ${file}\n`;
			});
			schema += '\n\n';

			for (const file of files) {
				const filePath = path.join(migrationsDir, file);
				const content = fs.readFileSync(filePath, 'utf-8');

				schema += `-- ============================================\n`;
				schema += `-- Migration: ${file}\n`;
				schema += `-- ============================================\n\n`;
				schema += content;
				schema += '\n\n';
			}

			schema += 'COMMIT;\n';
		} else {
			schema += '-- No migration files found\n';
			schema += 'BEGIN;\n\n';
			schema += await exportSchemaFromIntrospection();
			schema += '\nCOMMIT;\n';
		}
	} else {
		console.log('  ⚠️  No migrations directory found, using introspection...');
		schema += 'BEGIN;\n\n';
		schema += await exportSchemaFromIntrospection();
		schema += '\nCOMMIT;\n';
	}

	return schema;
}

/**
 * Export schema by introspecting existing tables (fallback method)
 */
async function exportSchemaFromIntrospection(): Promise<string> {
	let schema = '';
	const tables = await getUserTables();

	for (const table of tables) {
		if (table.table_schema !== 'public') continue;

		console.log(`  📄 Introspecting ${table.table_schema}.${table.table_name}`);

		try {
			// Get a sample row to infer structure
			const dataResponse = await fetch(`${supabaseUrl}/rest/v1/${table.table_name}?limit=1`, {
				headers: {
					apikey: supabaseKey!,
					Authorization: `Bearer ${supabaseKey}`
				}
			});

			if (dataResponse.ok) {
				const sampleData = await dataResponse.json();

				schema += `-- Table: ${table.table_schema}.${table.table_name}\n`;
				schema += `-- NOTE: Inferred from data. Check migrations for accurate schema.\n`;

				if (sampleData && sampleData.length > 0) {
					const sample = sampleData[0];
					const columns = Object.keys(sample);

					schema += `CREATE TABLE IF NOT EXISTS ${table.table_schema}.${table.table_name} (\n`;

					const columnDefs = columns.map((col) => {
						const value = sample[col];
						let type = 'text';

						// Infer basic types from sample data
						if (value === null) {
							type = 'text';
						} else if (typeof value === 'number') {
							type = Number.isInteger(value) ? 'bigint' : 'numeric';
						} else if (typeof value === 'boolean') {
							type = 'boolean';
						} else if (Array.isArray(value)) {
							type = 'text[]';
						} else if (typeof value === 'object') {
							type = 'jsonb';
						} else if (typeof value === 'string') {
							if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
								type = 'timestamptz';
							} else if (
								value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
							) {
								type = 'uuid';
							} else {
								type = 'text';
							}
						}

						return `  ${col} ${type}`;
					});

					schema += columnDefs.join(',\n');
					schema += '\n);\n\n';
				} else {
					schema += `-- Table exists but is empty\n\n`;
				}
			}
		} catch (err) {
			schema += `-- Could not introspect ${table.table_name}: ${err instanceof Error ? err.message : String(err)}\n\n`;
		}
	}

	return schema;
}

/**
 * Export table data as SQL INSERT statements using REST API
 */
async function exportTableData(tableName: string, schema: string = 'public'): Promise<string> {
	console.log(`  💾 Exporting data from ${schema}.${tableName}`);

	try {
		// Use REST API directly - works for all tables regardless of TypeScript types.
		// IMPORTANT: Supabase REST has a default row limit, so we must paginate.
		const pageSize = 1000;
		let offset = 0;
		let totalRows = 0;
		let sql = '';
		let wroteHeader = false;

		while (true) {
			const response = await fetch(
				`${supabaseUrl}/rest/v1/${tableName}?select=*&limit=${pageSize}&offset=${offset}`,
				{
					headers: {
						apikey: supabaseKey!,
						Authorization: `Bearer ${supabaseKey}`
					}
				}
			);

			if (!response.ok) {
				console.warn(`  ⚠️  Could not export ${tableName}: ${response.statusText}`);
				return `-- Failed to export ${tableName}: ${response.statusText}\n\n`;
			}

			const pageData = (await response.json()) as any[];
			if (!pageData || pageData.length === 0) {
				break;
			}

			totalRows += pageData.length;
			sql += formatDataAsSQL(pageData, tableName, schema, !wroteHeader);
			wroteHeader = true;
			offset += pageData.length;

			if (pageData.length < pageSize) {
				break;
			}
		}

		if (totalRows === 0) {
			return `-- No data in ${tableName}\n\n`;
		}

		// Patch the header with the real total row count if we wrote one.
		// (formatDataAsSQL writes a header per chunk when includeHeader=true; we only do it once.)
		return sql.replace(
			new RegExp(`^-- Data for ${schema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.${tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+) rows\\)`, 'm'),
			`-- Data for ${schema}.${tableName} (${totalRows} rows)`
		);
	} catch (err) {
		console.warn(
			`  ⚠️  Could not export ${tableName}: ${err instanceof Error ? err.message : String(err)}`
		);
		return `-- Failed to export ${tableName}: ${err instanceof Error ? err.message : String(err)}\n\n`;
	}
}

/**
 * Format data rows as SQL INSERT statements
 */
function formatDataAsSQL(data: any[], tableName: string, schema: string, includeHeader: boolean = true): string {
	let sql = '';
	if (includeHeader) {
		sql += `-- Data for ${schema}.${tableName} (${data.length} rows)\n`;
	}

	for (const row of data) {
		const columns = Object.keys(row);
		const values = columns.map((col) => {
			const value = row[col];
			if (value === null) return 'NULL';
			if (typeof value === 'string') {
				return `'${value.replace(/'/g, "''")}'`;
			}
			if (typeof value === 'boolean') {
				return value ? 'TRUE' : 'FALSE';
			}
			if (Array.isArray(value)) {
				if (value.length === 0) return 'ARRAY[]::text[]';
				return `ARRAY[${value.map((v) => (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v)).join(', ')}]`;
			}
			if (typeof value === 'object') {
				return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
			}
			return value;
		});

		sql += `INSERT INTO ${schema}.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
	}

	sql += '\n';
	return sql;
}

/**
 * Export all table data
 */
async function exportData(): Promise<string> {
	console.log('💾 Exporting data...');

	let data = '';
	data += '-- JumpFlix Database Data Backup\n';
	data += `-- Generated: ${new Date().toISOString()}\n`;
	data += '-- This file contains all data from the database\n\n';
	data += 'BEGIN;\n\n';

	const tables = await getUserTables();

	for (const table of tables) {
		if (table.table_schema !== 'public') continue;

		const tableData = await exportTableData(table.table_name, table.table_schema);
		data += tableData;
	}

	data += 'COMMIT;\n';
	return data;
}

/**
 * Copy migration files
 */
async function copyMigrations(outputDir: string): Promise<void> {
	console.log('📁 Copying migrations...');

	const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
	const backupMigrationsDir = path.join(outputDir, 'migrations');

	if (!fs.existsSync(migrationsDir)) {
		console.log('  ⚠️  No migrations directory found');
		return;
	}

	if (!fs.existsSync(backupMigrationsDir)) {
		fs.mkdirSync(backupMigrationsDir, { recursive: true });
	}

	const files = fs.readdirSync(migrationsDir);
	for (const file of files) {
		if (file.endsWith('.sql')) {
			const source = path.join(migrationsDir, file);
			const dest = path.join(backupMigrationsDir, file);
			fs.copyFileSync(source, dest);
			console.log(`  📄 Copied ${file}`);
		}
	}
}

/**
 * Export users from Supabase Auth
 */
async function exportUsers(anonymizeUserEmails: boolean = false): Promise<string> {
	console.log('👥 Exporting users from Supabase Auth...');

	try {
		// Use Auth Admin API to list all users
		const { data, error } = await supabase.auth.admin.listUsers();

		if (error) {
			console.warn(`  ⚠️  Could not export users: ${error.message}`);
			return `-- Failed to export users: ${error.message}\n\n`;
		}

		if (!data || !data.users || data.users.length === 0) {
			return `-- No users in auth.users\n\n`;
		}

		console.log(`  👥 Found ${data.users.length} users`);

		const usersForExport = anonymizeUserEmails
			? data.users.map((user) => anonymizeUserEmailFields(user))
			: data.users;

		let sql = `-- Auth Users Data Backup\n`;
		sql += `-- Generated: ${new Date().toISOString()}\n`;
		sql += `-- Total users: ${data.users.length}\n\n`;
		if (anonymizeUserEmails) {
			sql += `-- NOTE: Emails have been anonymized (SHA-256).\n\n`;
		}
		sql += `-- NOTE: This is a JSON export of user data.\n`;
		sql += `-- To restore, you'll need to use Supabase Auth Admin API or import via dashboard.\n`;
		sql += `-- Password hashes and some metadata may need special handling.\n\n`;

		// Export as JSON for easier restoration through Auth API
		sql += `-- Users JSON Export:\n`;
		sql += `/*\n`;
		sql += JSON.stringify(usersForExport, null, 2);
		sql += `\n*/\n\n`;

		// Also create SQL INSERT statements for reference (though these won't work directly)
		sql += `-- SQL Reference (for manual restoration):\n`;
		sql += `-- WARNING: Direct insertion into auth.users may not work due to triggers and constraints\n`;
		sql += `-- Use Supabase Auth Admin API instead\n\n`;

		for (const user of usersForExport) {
			sql += `-- User: ${user.email || user.phone || user.id}\n`;
			sql += `-- ID: ${user.id}\n`;
			sql += `-- Created: ${user.created_at}\n`;
			sql += `-- Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}\n`;
			if (user.user_metadata && Object.keys(user.user_metadata).length > 0) {
				sql += `-- Metadata: ${JSON.stringify(user.user_metadata)}\n`;
			}
			sql += `--\n`;
		}

		sql += `\n-- To restore users, use the Supabase dashboard or Auth Admin API:\n`;
		sql += `-- https://supabase.com/docs/guides/auth/managing-user-data\n\n`;

		return sql;
	} catch (err) {
		console.warn(
			`  ⚠️  Could not export users: ${err instanceof Error ? err.message : String(err)}`
		);
		return `-- Failed to export users: ${err instanceof Error ? err.message : String(err)}\n\n`;
	}
}

function sha256Hex(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

function anonymizeEmail(email: unknown): unknown {
	if (typeof email !== 'string') return email;
	const trimmed = email.trim();
	if (!trimmed) return email;
	return sha256Hex(trimmed.toLowerCase());
}

function anonymizeUserEmailFields<T extends { email?: unknown; user_metadata?: any }>(user: T): T {
	// Keep this targeted: only anonymize email fields, preserve all other data.
	const cloned: any = { ...user };
	cloned.email = anonymizeEmail(cloned.email);
	if (cloned.user_metadata && typeof cloned.user_metadata === 'object') {
		cloned.user_metadata = { ...cloned.user_metadata };
		cloned.user_metadata.email = anonymizeEmail(cloned.user_metadata.email);
	}
	return cloned as T;
}

/**
 * Create a complete database backup
 */
async function createBackup(options: BackupOptions): Promise<void> {
	const timestamp =
		new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] +
		'_' +
		new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
	const backupDir = path.join(options.outputDir, `backup_${timestamp}`);

	console.log('\n🔧 Creating backup...');
	console.log(`📁 Output directory: ${backupDir}\n`);

	// Create backup directory
	if (!fs.existsSync(backupDir)) {
		fs.mkdirSync(backupDir, { recursive: true });
	}

	// Create README
	const readme = `# JumpFlix Database Backup
Generated: ${new Date().toISOString()}

## Contents
${options.includeSchema ? '- schema.sql: Complete database schema (DDL)' : ''}
${options.includeData ? '- data.sql: All table data (DML)' : ''}
${options.includeUsers ? '- users.sql: Supabase Auth users (JSON export)' : ''}
${options.includeMigrations ? '- migrations/: All migration files' : ''}

## Restore Instructions

### 1. Restore Schema
\`\`\`bash
psql -h your-db-host -U your-user -d your-database -f schema.sql
\`\`\`

### 2. Restore Data
\`\`\`bash
psql -h your-db-host -U your-user -d your-database -f data.sql
\`\`\`

### 3. Restore Users
Users are exported as JSON. Restore using Supabase Auth Admin API or dashboard.
See users.sql for the JSON data and instructions.

### 4. Apply Migrations
Run migrations in order from the migrations/ directory.

## Notes
- This backup was created from: ${supabaseUrl}
- Always test restores in a non-production environment first
- Keep backups secure and encrypted
- User passwords are hashed and may require special handling
`;

	fs.writeFileSync(path.join(backupDir, 'README.md'), readme);

	// Export schema
	if (options.includeSchema) {
		const schema = await exportSchema();
		fs.writeFileSync(path.join(backupDir, 'schema.sql'), schema);
		console.log('✅ Schema exported');
	}

	// Export data
	if (options.includeData) {
		const data = await exportData();
		fs.writeFileSync(path.join(backupDir, 'data.sql'), data);
		console.log('✅ Data exported');
	}

	// Export users
	if (options.includeUsers) {
		const users = await exportUsers(Boolean(options.anonymizeUserEmails));
		fs.writeFileSync(path.join(backupDir, 'users.sql'), users);
		console.log('✅ Users exported');
	}

	// Copy migrations
	if (options.includeMigrations) {
		await copyMigrations(backupDir);
		console.log('✅ Migrations copied');
	}

	// Create backup info file
	const backupInfo = {
		timestamp: new Date().toISOString(),
		supabaseUrl,
		includeSchema: options.includeSchema,
		includeData: options.includeData,
		includeUsers: options.includeUsers,
		includeMigrations: options.includeMigrations,
		anonymizeUserEmails: Boolean(options.anonymizeUserEmails),
		tables: (await getUserTables()).map((t) => `${t.table_schema}.${t.table_name}`)
	};
	fs.writeFileSync(path.join(backupDir, 'backup-info.json'), JSON.stringify(backupInfo, null, 2));

	console.log('\n✅ Backup complete!');
	console.log(`📁 Saved to: ${backupDir}`);
	console.log(`📊 Size: ${getDirectorySize(backupDir)} KB\n`);
}

/**
 * Get directory size in KB
 */
function getDirectorySize(dirPath: string): number {
	let size = 0;
	const files = fs.readdirSync(dirPath, { withFileTypes: true });

	for (const file of files) {
		const filePath = path.join(dirPath, file.name);
		if (file.isDirectory()) {
			size += getDirectorySize(filePath);
		} else {
			size += fs.statSync(filePath).size;
		}
	}

	return Math.round(size / 1024);
}

/**
 * Main menu
 */
async function main() {
	console.clear();
	console.log('💾 JumpFlix Database Backup Tool\n');

	const backupType = await prompts.select({
		message: 'What would you like to backup?',
		choices: [
			{ name: '📦 Complete backup (Schema + Data + Users + Migrations)', value: 'complete' },
			{ name: '📋 Schema only', value: 'schema' },
			{ name: '💾 Data only', value: 'data' },
			{ name: '👥 Users only', value: 'users' },
			{ name: '📁 Migrations only', value: 'migrations' },
			{ name: '⚙️  Custom backup', value: 'custom' }
		]
	});

	let options: BackupOptions = {
		outputDir: path.join(process.cwd(), 'backups'),
		includeSchema: false,
		includeData: false,
		includeUsers: false,
		includeMigrations: false
	};

	switch (backupType) {
		case 'complete':
			options.includeSchema = true;
			options.includeData = true;
			options.includeUsers = true;
			options.includeMigrations = true;
			options.anonymizeUserEmails = true;
			break;
		case 'schema':
			options.includeSchema = true;
			break;
		case 'data':
			options.includeData = true;
			break;
		case 'users':
			options.includeUsers = true;
			break;
		case 'migrations':
			options.includeMigrations = true;
			break;
		case 'custom':
			options.includeSchema = await prompts.confirm({
				message: 'Include schema?',
				default: true
			});
			options.includeData = await prompts.confirm({
				message: 'Include data?',
				default: true
			});
			options.includeUsers = await prompts.confirm({
				message: 'Include users?',
				default: true
			});
			options.includeMigrations = await prompts.confirm({
				message: 'Include migrations?',
				default: true
			});
			break;
	}

	// Ask for output directory
	const customDir = await prompts.confirm({
		message: 'Use custom output directory?',
		default: false
	});

	if (customDir) {
		options.outputDir = await prompts.input({
			message: 'Output directory:',
			default: options.outputDir
		});
	}

	// Confirm
	console.log('\n📋 Backup Configuration:');
	console.log(`   Schema: ${options.includeSchema ? '✓' : '✗'}`);
	console.log(`   Data: ${options.includeData ? '✓' : '✗'}`);
	console.log(`   Users: ${options.includeUsers ? '✓' : '✗'}`);
	console.log(`   Migrations: ${options.includeMigrations ? '✓' : '✗'}`);
	console.log(`   Output: ${options.outputDir}\n`);

	const confirm = await prompts.confirm({
		message: 'Start backup?',
		default: true
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		process.exit(0);
	}

	await createBackup(options);
}

// Run
main().catch((error) => {
	console.error('❌ Backup failed:', error);
	process.exit(1);
});
