import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const astroEntry = path.join(rootDirectory, 'node_modules/astro/bin/astro.mjs');
const fixtureDirectory = path.join(rootDirectory, 'tests/fixtures/legal-content');
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'automatic-pro-site-modes-'));

function runBuild(outputDirectory, legalContentDirectory) {
  const result = spawnSync(process.execPath, [astroEntry, 'build', '--outDir', outputDirectory], {
    cwd: rootDirectory,
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1',
      BASE_PATH: '/Automatic-Pro',
      LEGAL_CONTENT_DIR: legalContentDirectory,
      SITE_URL: 'https://example.test',
    },
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`Astro build failed with exit code ${result.status}.`);
  }
}

async function readOutput(outputDirectory, relativePath) {
  return readFile(path.join(outputDirectory, relativePath), 'utf8');
}

try {
  const disabledOutput = path.join(temporaryDirectory, 'without-legal-content');
  runBuild(disabledOutput, '');

  const disabledRoot = await readOutput(disabledOutput, 'index.html');
  const disabledNested = await readOutput(disabledOutput, 'v3/history/index.html');
  assert.doesNotMatch(disabledRoot, /href="\.\/(?:legal|privacy)\/"/);
  assert.doesNotMatch(disabledNested, /href="\.\.\/\.\.\/(?:legal|privacy)\/"/);
  assert.doesNotMatch(`${disabledRoot}${disabledNested}`, /legal-links:/);
  await assert.rejects(access(path.join(disabledOutput, 'legal/index.html')));
  await assert.rejects(access(path.join(disabledOutput, 'privacy/index.html')));

  const enabledOutput = path.join(temporaryDirectory, 'with-legal-content');
  runBuild(enabledOutput, fixtureDirectory);

  const enabledRoot = await readOutput(enabledOutput, 'index.html');
  const enabledVersion = await readOutput(enabledOutput, 'v3/index.html');
  const enabledNested = await readOutput(enabledOutput, 'v3/history/index.html');
  assert.match(enabledRoot, /href="\.\/legal\/"/);
  assert.match(enabledRoot, /href="\.\/privacy\/"/);
  assert.match(enabledVersion, /href="\.\.\/legal\/"/);
  assert.match(enabledVersion, /href="\.\.\/privacy\/"/);
  assert.match(enabledNested, /href="\.\.\/\.\.\/legal\/"/);
  assert.match(enabledNested, /href="\.\.\/\.\.\/privacy\/"/);
  assert.doesNotMatch(`${enabledRoot}${enabledVersion}${enabledNested}`, /legal-links:/);
  await access(path.join(enabledOutput, 'legal/index.html'));
  await access(path.join(enabledOutput, 'privacy/index.html'));
  await access(path.join(enabledOutput, 'legal-assets/styles.css'));

  console.log('Validated Automatic Pro builds with and without private legal content.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
