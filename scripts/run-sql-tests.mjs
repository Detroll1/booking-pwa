// Boots a throwaway Postgres, applies migrations + seed, runs every SQL case.
import {startDatabase} from './db/embedded.mjs';
import {cases} from '../tests/sql/cases.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

async function main() {
  let db;
  try {
    db = await startDatabase();
  } catch (error) {
    console.error('Failed to start the test database:\n', error);
    process.exit(2);
  }
  let passed = 0;
  const failures = [];
  const started = Date.now();
  try {
    for (const testCase of cases) {
      try {
        // Isolate cases: seed data stays, but no bookings leak between tests.
        await db.client.query(
          'delete from public.notification_jobs; delete from public.payments; delete from public.booking_events; delete from public.bookings;',
        );
        await testCase.run({client: db.client, newClient: db.newClient, assert});
        passed += 1;
        console.log(`  ok   ${testCase.name}`);
      } catch (error) {
        failures.push({name: testCase.name, error});
        console.log(`  FAIL ${testCase.name}\n       ${error.message}`);
      }
    }
  } finally {
    await db.stop();
  }
  const ms = Date.now() - started;
  console.log(`\nSQL tests: ${passed}/${cases.length} passed in ${ms}ms`);
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
