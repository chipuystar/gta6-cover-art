// VICE COVER — entry hand-in program.
//
// Copies the app and its screenshots into the output directory and writes
// the dossier there, so the grader can judge the entry from /output alone.
// Run it with MAKEFUN_OUTPUT_DIR set to a scratch directory to try it
// outside the grader; inside the grader the output directory is /output.
//
// Node 22, standard library only. Two runs must write the same bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-app.ts';

// Where this program lives is the repository root.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader hands us /output; anywhere else the environment variable
// names the directory to write into. A blank value counts as unset, and
// a relative path resolves against the working directory, so a scratch
// run from the repo root behaves the same as an absolute one.
function resolveOutDir(): string {
  const given = (process.env.MAKEFUN_OUTPUT_DIR ?? '').trim();
  if (!given) return '/output';
  return resolve(given);
}

const outDir = resolveOutDir();

// The caps this bounty holds the dossier to, from its RULES.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
};

function clearPreviousRun(dir: string): void {
  // Remove only the entries this program owns, so a second run starts
  // from the same empty state as the first and writes identical bytes.
  for (const entry of ['app', 'screenshots', 'dossier.json']) {
    const target = join(dir, entry);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
}

function handIn(): void {
  mkdirSync(outDir, { recursive: true });
  clearPreviousRun(outDir);

  cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), {
    recursive: true,
  });

  const dossier = buildDossier(outDir, dossierCaps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
