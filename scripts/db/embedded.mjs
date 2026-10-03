// Spins up a real, throwaway Postgres (embedded-postgres), applies every
// migration and the seed, and hands the caller connected clients. Used by the
// SQL/integration tests and by `npm run db:start` for local work.
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEFAULT_PORT = Number(process.env.PG_TEST_PORT ?? 54331);

export async function startDatabase({port = DEFAULT_PORT, migrations = true, seed = true} = {}) {
  const server = new EmbeddedPostgres({
    databaseDir: path.join(repoRoot, '.tmp-pgdata'),
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('booking_test');

  const client = server.getPgClient('booking_test');
  client.on('error', () => undefined);

  try {
    await client.connect();
    if (migrations) {
      const dir = path.join(repoRoot, 'supabase', 'migrations');
      const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        await client.query(await readFile(path.join(dir, file), 'utf8'));
      }
    }
    if (seed) {
      await client.query(await readFile(path.join(repoRoot, 'supabase', 'seed.sql'), 'utf8'));
    }
  } catch (error) {
    await client.end().catch(() => undefined);
    await server.stop().catch(() => undefined);
    throw error;
  }

  return {
    client,
    newClient: () => {
      const c = server.getPgClient('booking_test');
      c.on('error', () => undefined);
      return c;
    },
    stop: () => server.stop(),
  };
}
