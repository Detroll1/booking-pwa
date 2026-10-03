// `npm run db:start` — throwaway Postgres with migrations + seed for local
// development when no Supabase project is available. Stays up until Ctrl+C.
import {startDatabase} from './embedded.mjs';

async function main() {
  const db = await startDatabase();
  console.log('Postgres ready: postgres://postgres:postgres@localhost:54329/booking_test');
  console.log('Migrations and seed applied. Press Ctrl+C to stop.');
  const shutdown = () => {
    void db.stop().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // keep alive
  await new Promise(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
