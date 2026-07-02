import assert from 'node:assert/strict';
import { access, cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  resolveLegalContentDirectory,
  transformLegalLinks,
} from '../scripts/legal-content.mjs';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const fixtureDirectory = path.join(rootDirectory, 'tests/fixtures/legal-content');

async function withFixtureCopy(run) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'automatic-pro-legal-test-'));
  const copyDirectory = path.join(temporaryRoot, 'legal-content');
  await cp(fixtureDirectory, copyDirectory, { recursive: true });

  try {
    await run(copyDirectory, temporaryRoot);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

test('public source contains no bundled legal or privacy pages', async () => {
  await assert.rejects(access(path.join(rootDirectory, 'src/content/docs/imprint.mdx')));
  await assert.rejects(access(path.join(rootDirectory, 'src/content/docs/privacy-policy.mdx')));
});

test('legal link markers follow the selected build mode', () => {
  const html = `before
<!-- legal-links:start -->
<a href="./legal/">Imprint</a>
<a href="./privacy/">Privacy Policy</a>
<!-- legal-links:end -->
after`;

  const enabled = transformLegalLinks(html, true);
  assert.match(enabled, /href="\.\/legal\/"/);
  assert.match(enabled, /href="\.\/privacy\/"/);
  assert.doesNotMatch(enabled, /legal-links:/);

  const disabled = transformLegalLinks(html, false);
  assert.doesNotMatch(disabled, /href="\.\/(?:legal|privacy)\/"/);
  assert.doesNotMatch(disabled, /legal-links:/);
});

test('valid legal content satisfies the exact overlay contract', () => {
  assert.equal(resolveLegalContentDirectory(fixtureDirectory), fixtureDirectory);
  assert.equal(resolveLegalContentDirectory(''), null);
});

test('missing required legal files are rejected', async () => {
  await withFixtureCopy(async (directory) => {
    await rm(path.join(directory, 'privacy/index.html'));
    assert.throws(() => resolveLegalContentDirectory(directory), /Missing legal content file/);
  });
});

test('unexpected top-level entries are rejected', async () => {
  await withFixtureCopy(async (directory) => {
    await writeFile(path.join(directory, 'unexpected.txt'), 'not allowed');
    assert.throws(() => resolveLegalContentDirectory(directory), /Unexpected legal content entries/);
  });
});

test('symbolic links are rejected', async () => {
  await withFixtureCopy(async (directory) => {
    await symlink(path.join(directory, 'legal/index.html'), path.join(directory, 'legal/linked.html'));
    assert.throws(() => resolveLegalContentDirectory(directory), /must not contain symbolic links/);
  });
});

test('a non-directory LEGAL_CONTENT_DIR is rejected', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'automatic-pro-legal-file-'));
  const filePath = path.join(temporaryRoot, 'not-a-directory');
  await writeFile(filePath, 'invalid');

  try {
    assert.throws(() => resolveLegalContentDirectory(filePath), /does not exist/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
