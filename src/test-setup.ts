import { vi } from 'vitest';

/*
 * One time limit for every spec, instead of the default 5 s.
 *
 * The first test in a file pays for compiling that file's screens. Alone it takes about a second;
 * inside the full suite (2,000+ tests) on an 8 GB machine under memory pressure, six different
 * files' first tests took 5–6 s and failed on a tree that was correct. A timeout is not an
 * assertion: raising it changes no expectation, and a test that genuinely hangs still fails.
 */
vi.setConfig({ testTimeout: 20_000 });
