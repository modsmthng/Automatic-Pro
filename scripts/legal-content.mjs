import {
  cpSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const legalContentEntries = ['legal', 'privacy', 'legal-assets'];
export const requiredLegalContentFiles = [
  'legal/index.html',
  'privacy/index.html',
  'legal-assets/styles.css',
];

const markerPattern = /\s*<!-- legal-links:start -->[\s\S]*?<!-- legal-links:end -->/g;

function assertSafeTree(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    const stats = lstatSync(entryPath);

    if (stats.isSymbolicLink()) {
      throw new Error(`Legal content must not contain symbolic links: ${entryPath}`);
    }

    if (stats.isDirectory()) {
      assertSafeTree(entryPath);
    } else if (!stats.isFile()) {
      throw new Error(`Legal content contains an unsupported file type: ${entryPath}`);
    }
  }
}

export function resolveLegalContentDirectory(directory) {
  if (!directory?.trim()) {
    return null;
  }

  const resolvedDirectory = path.resolve(directory);

  if (!existsSync(resolvedDirectory) || !lstatSync(resolvedDirectory).isDirectory()) {
    throw new Error(`Legal content directory does not exist: ${resolvedDirectory}`);
  }

  const entryNames = readdirSync(resolvedDirectory, { withFileTypes: true }).map((entry) => entry.name);
  const unexpectedEntries = entryNames.filter((name) => !legalContentEntries.includes(name));
  const missingEntries = legalContentEntries.filter((name) => !entryNames.includes(name));

  if (unexpectedEntries.length > 0) {
    throw new Error(`Unexpected legal content entries: ${unexpectedEntries.join(', ')}`);
  }

  if (missingEntries.length > 0) {
    throw new Error(`Missing legal content entries: ${missingEntries.join(', ')}`);
  }

  for (const relativePath of requiredLegalContentFiles) {
    const filePath = path.join(resolvedDirectory, relativePath);

    if (!existsSync(filePath) || !lstatSync(filePath).isFile()) {
      throw new Error(`Missing legal content file: ${relativePath}`);
    }
  }

  assertSafeTree(resolvedDirectory);
  return resolvedDirectory;
}

export function copyLegalContent(directory, outputDirectory) {
  for (const entry of legalContentEntries) {
    cpSync(path.join(directory, entry), path.join(outputDirectory, entry), {
      recursive: true,
      force: true,
    });
  }
}

export function transformLegalLinks(html, enabled) {
  if (!enabled) {
    return html.replace(markerPattern, '');
  }

  return html
    .replace(/\s*<!-- legal-links:start -->\s*/g, '\n')
    .replace(/\s*<!-- legal-links:end -->\s*/g, '\n');
}

function findHtmlFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findHtmlFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(entryPath);
    }
  }

  return files;
}

export function transformGeneratedLegalLinks(outputDirectory, enabled) {
  for (const htmlPath of findHtmlFiles(outputDirectory)) {
    const html = readFileSync(htmlPath, 'utf8');
    const transformed = transformLegalLinks(html, enabled);

    if (transformed !== html) {
      writeFileSync(htmlPath, transformed);
    }
  }
}

function assertNonEmptyFile(outputDirectory, relativePath) {
  const filePath = path.join(outputDirectory, relativePath);

  if (!existsSync(filePath) || !statSync(filePath).isFile() || statSync(filePath).size === 0) {
    throw new Error(`Missing or empty generated legal file: ${relativePath}`);
  }
}

export function validateGeneratedLegalOutput(outputDirectory, enabled) {
  const html = findHtmlFiles(outputDirectory)
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');

  if (/<!-- legal-links:(?:start|end) -->/.test(html)) {
    throw new Error('Generated HTML still contains legal-link marker comments.');
  }

  if (enabled) {
    for (const relativePath of requiredLegalContentFiles) {
      assertNonEmptyFile(outputDirectory, relativePath);
    }

    if (!/href=["'][^"']*legal\/["']/.test(html) || !/href=["'][^"']*privacy\/["']/.test(html)) {
      throw new Error('Generated HTML is missing enabled legal or privacy links.');
    }

    return;
  }

  for (const entry of legalContentEntries) {
    if (existsSync(path.join(outputDirectory, entry))) {
      throw new Error(`Disabled legal build unexpectedly contains: ${entry}`);
    }
  }

  if (/href=["'][^"']*(?:legal|privacy)\/["']/.test(html)) {
    throw new Error('Disabled legal build unexpectedly contains legal or privacy links.');
  }
}

export function legalPagesIntegration() {
  const legalContentDirectory = resolveLegalContentDirectory(process.env.LEGAL_CONTENT_DIR);
  const enabled = legalContentDirectory !== null;

  return {
    name: 'automatic-pro-private-legal-pages',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const outputDirectory = fileURLToPath(dir);
        transformGeneratedLegalLinks(outputDirectory, enabled);

        if (legalContentDirectory) {
          copyLegalContent(legalContentDirectory, outputDirectory);
        }

        validateGeneratedLegalOutput(outputDirectory, enabled);
      },
    },
  };
}
