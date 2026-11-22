import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/server/postgres/migrate.js';
import { apiPool, ownerPool, requireTestUrls } from './support/db.js';

const TABLE = 'migrate_probe.schema_migrations';
const ONE = 'create table migrate_probe.t (id integer primary key);\n';

describe('migrations on the test database', () => {
  const owner = ownerPool();
  const api = apiPool();

  afterAll(async () => {
    await owner.end();
    await api.end();
  });

  it('records applied migrations with checksums', async () => {
    const { rows } = await owner.query<{ checksum: string }>(
      'select checksum from schema_migrations where version = 1',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('creates tables owned by library_owner', async () => {
    const { rows } = await owner.query<{ tablename: string; tableowner: string }>(
      "select tablename, tableowner from pg_tables where schemaname = 'public' and tablename in ('books', 'readers', 'loans')",
    );
    expect(rows.map((r) => r.tablename).sort()).toEqual(['books', 'loans', 'readers']);
    expect(rows.every((r) => r.tableowner === 'library_owner')).toBe(true);
  });

  it('does not let the api role bypass RLS or own tables', async () => {
    const { rows } = await api.query<{
      current_user: string;
      rolbypassrls: boolean;
      rolsuper: boolean;
    }>('select current_user, rolbypassrls, rolsuper from pg_roles where rolname = current_user');
    expect(rows[0]).toEqual({ current_user: 'library_api', rolbypassrls: false, rolsuper: false });
  });

  describe('runner', () => {
    let dir: string;
    let client: pg.Client;

    beforeAll(async () => {
      await owner.query('drop schema if exists migrate_probe cascade');
      await owner.query('create schema migrate_probe');
      dir = await mkdtemp(path.join(os.tmpdir(), 'migrate-'));
      client = new pg.Client({ connectionString: requireTestUrls().ownerUrl });
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
      await rm(dir, { recursive: true, force: true });
      await owner.query('drop schema if exists migrate_probe cascade');
    });

    it('applies a migration file once', async () => {
      await writeFile(path.join(dir, '001-one.sql'), ONE);
      const first = await migrate(client, { dir, table: TABLE });
      const second = await migrate(client, { dir, table: TABLE });
      expect(first.applied).toHaveLength(1);
      expect(second.applied).toHaveLength(0);
      expect(second.skipped).toBe(1);
    });

    it('accepts the same file with CRLF line endings', async () => {
      await writeFile(path.join(dir, '001-one.sql'), ONE.replace(/\n/g, '\r\n'));
      const result = await migrate(client, { dir, table: TABLE });
      expect(result.applied).toHaveLength(0);
    });

    it('refuses a changed migration that was already applied', async () => {
      await writeFile(path.join(dir, '001-one.sql'), `${ONE}-- правка\n`);
      await expect(migrate(client, { dir, table: TABLE })).rejects.toThrow(/checksum/);
    });
  });
});
