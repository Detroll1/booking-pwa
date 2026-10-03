// Single source of truth for the assistant router lives in the app source so it
// can be unit-tested with the rest of the project. The Edge Function re-exports
// it here; the deploy bundler resolves the relative import.
export * from '../../../src/lib/assistant/router.ts';
