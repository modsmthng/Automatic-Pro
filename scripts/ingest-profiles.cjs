#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const INCOMING_DIR = 'incoming';
const RELEASES_FILE = path.join('src', 'data', 'releases.json');
const DOWNLOADS_DIR = path.join('public', 'downloads');
const GITKEEP_NAME = '.gitkeep';
const BERLIN_TIME_ZONE = 'Europe/Berlin';

const profileTypeLabels = {
  'direct-lever': 'Direct Lever',
  'spring-lever': 'Spring Lever',
  'adaptive-pressure': 'Adaptive Pressure',
  'nine-bar': '9bar',
};

const v2DoseMap = {
  '9g': {
    label: '9g',
    dose: '9g',
    variant: 'Standard V-shape basket',
    temperatureC: 91,
    notes: 'Optimized for low flow and tested the least.',
    slotId: 'v2-9g-standard',
  },
  '15g': {
    label: '15g',
    dose: '15g',
    variant: 'Standard basket',
    temperatureC: 91,
    notes: '',
    slotId: 'v2-15g-standard',
  },
  '18g': {
    label: '18g',
    dose: '18g',
    variant: 'Standard basket',
    temperatureC: 91,
    notes: '',
    slotId: 'v2-18g-standard',
  },
  '20g': {
    label: '20g',
    dose: '20g',
    variant: 'Standard or HE basket',
    temperatureC: 91,
    notes: '',
    slotId: 'v2-20g-standard',
  },
  '22g': {
    label: '22g',
    dose: '22g',
    variant: 'Standard or HE basket',
    temperatureC: 91,
    notes: '',
    slotId: 'v2-22g-standard',
  },
};

main().catch((error) => {
  console.error(`[ingest] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const repoRoot = process.cwd();
  const incomingDir = path.join(repoRoot, INCOMING_DIR);
  const releasesPath = path.join(repoRoot, RELEASES_FILE);
  const downloadsRoot = path.join(repoRoot, DOWNLOADS_DIR);

  ensureIncomingDirectory(incomingDir);

  const incomingFiles = findIncomingJsonFiles(incomingDir).sort();

  if (incomingFiles.length === 0) {
    console.log('[ingest] No incoming JSON files found.');
    return;
  }

  const currentBerlinDate = getCurrentBerlinDate();
  const uploads = incomingFiles.map((filePath) => parseUpload(filePath, currentBerlinDate));

  validateIncomingUploads(uploads);
  uploads.forEach((upload) => validateJsonFile(upload.sourcePath));

  const releases = readJsonFile(releasesPath);
  applyUploads(releases, uploads, downloadsRoot);
  normalizeLatestFlags(releases);
  writeJsonFile(releasesPath, releases);
  clearIncomingDirectory(incomingDir);

  console.log(`[ingest] Processed ${uploads.length} uploaded profile${uploads.length === 1 ? '' : 's'}.`);

  for (const summary of summarizeUploads(uploads)) {
    console.log(`[ingest] ${summary}`);
  }
}

function ensureIncomingDirectory(incomingDir) {
  fs.mkdirSync(incomingDir, { recursive: true });
  const gitkeepPath = path.join(incomingDir, GITKEEP_NAME);

  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '');
  }
}

function findIncomingJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === GITKEEP_NAME || entry.name === '.DS_Store') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findIncomingJsonFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseUpload(sourcePath, currentBerlinDate) {
  const fileName = path.basename(sourcePath);
  const v2Match = fileName.match(/^Automatic Pro\s+v2\s+(?<dose>\d+g)\.json$/i);

  if (v2Match?.groups?.dose) {
    const baseDownload = v2DoseMap[v2Match.groups.dose];

    if (!baseDownload) {
      throw new Error(`Unsupported v2 dose in filename: ${fileName}`);
    }

    return {
      sourcePath,
      fileName,
      familySlug: 'v2',
      buildVersion: currentBerlinDate,
      releaseDate: currentBerlinDate,
      download: { ...baseDownload, file: fileName },
    };
  }

  const vit3Match = fileName.match(
    /^Automatic Pro\s+(?<dose>\d+g)(?:\s+\[(?<tag>[^\]]+)\])?\s+(?<version>v(?:IT)?3(?:_\d+)+)\.json$/i
  );

  if (vit3Match?.groups?.dose && vit3Match?.groups?.version) {
    return {
      sourcePath,
      fileName,
      familySlug: 'vit3',
      buildVersion: vit3Match.groups.version,
      releaseDate: currentBerlinDate,
      download: buildVit3Download(vit3Match.groups.dose, vit3Match.groups.tag, fileName),
    };
  }

  throw new Error(
    `Unsupported filename "${fileName}". Expected "Automatic Pro v2 18g.json" or "Automatic Pro 21g [Spring Lever] vIT3_0_29_5.json".`
  );
}

function buildVit3Download(dose, rawTag, fileName) {
  const tag = normalizeTag(rawTag);

  if (!tag) {
    return {
      label: dose,
      dose,
      variant: 'Standard basket',
      file: fileName,
      temperatureC: 89,
      notes: '',
      slotId: `vit3-${dose}-main`,
    };
  }

  if (tag.includes('step-down')) {
    return {
      label: `${dose} Step-Down`,
      dose,
      variant: 'Step-Down basket',
      file: fileName,
      temperatureC: 89,
      notes: 'Experimental step-down variant inside the Direct Lever branch.',
      slotId: `vit3-${dose}-step-down`,
      profileType: 'direct-lever',
    };
  }

  if (tag === 'direct lever') {
    return {
      label: dose,
      dose,
      variant: 'Standard basket',
      file: fileName,
      temperatureC: 89,
      notes: '',
      slotId: `vit3-${dose}-main`,
      profileType: 'direct-lever',
    };
  }

  if (tag === 'spring lever') {
    return {
      label: dose,
      dose,
      variant: 'Spring Lever basket',
      file: fileName,
      temperatureC: 89,
      notes: '',
      slotId: `vit3-${dose}-spring-lever`,
      profileType: 'spring-lever',
    };
  }

  if (tag === 'adaptive pressure') {
    return {
      label: dose,
      dose,
      variant: 'Standard basket',
      file: fileName,
      temperatureC: 89,
      notes: '',
      slotId: `vit3-${dose}-adaptive-pressure`,
      profileType: 'adaptive-pressure',
    };
  }

  if (tag === '9 bar' || tag === '9bar') {
    return {
      label: dose,
      dose,
      variant: 'Standard basket',
      file: fileName,
      temperatureC: 89,
      notes: '',
      slotId: `vit3-${dose}-nine-bar`,
      profileType: 'nine-bar',
    };
  }

  throw new Error(`Unsupported vIT3/v3 tag "[${rawTag}]" in filename "${fileName}".`);
}

function normalizeTag(rawTag) {
  if (!rawTag) {
    return '';
  }

  return rawTag
    .trim()
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function validateIncomingUploads(uploads) {
  const seen = new Set();

  for (const upload of uploads) {
    const key = `${upload.familySlug}::${upload.buildVersion}::${upload.download.slotId}`;

    if (seen.has(key)) {
      throw new Error(
        `Incoming upload duplicates the same slot in one run: ${upload.fileName} conflicts on ${upload.familySlug}/${upload.buildVersion}/${upload.download.slotId}.`
      );
    }

    seen.add(key);
  }
}

function validateJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');

  try {
    JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${error.message}`);
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function applyUploads(releases, uploads, downloadsRoot) {
  for (const upload of uploads) {
    const family = releases.find((entry) => entry.slug === upload.familySlug);

    if (!family) {
      throw new Error(`Unknown release family slug "${upload.familySlug}".`);
    }

    const destinationDir = path.join(downloadsRoot, upload.familySlug, upload.buildVersion);
    const destinationPath = path.join(destinationDir, upload.fileName);
    fs.mkdirSync(destinationDir, { recursive: true });
    fs.copyFileSync(upload.sourcePath, destinationPath);

    let build = family.builds.find((entry) => entry.buildVersion === upload.buildVersion);

    if (!build) {
      build = {
        buildVersion: upload.buildVersion,
        releaseDate: upload.releaseDate,
        isLatest: false,
        notes: '',
        downloads: [],
      };

      family.builds.unshift(build);
    }

    build.releaseDate = upload.releaseDate;

    const existingIndex = build.downloads.findIndex((entry) => getSlotKey(entry) === getSlotKey(upload.download));

    if (existingIndex >= 0) {
      build.downloads[existingIndex] = upload.download;
    } else {
      build.downloads.push(upload.download);
    }

    build.notes = createAutomatedBuildNote(upload.familySlug, build.downloads);
  }
}

function getSlotKey(download) {
  return download.slotId ?? `${download.label}::${download.variant}`;
}

function createAutomatedBuildNote(familySlug, downloads) {
  const items = [...downloads]
    .sort(compareDownloadsForNotes)
    .map((download) => formatDownloadForNote(download, familySlug));

  if (items.length === 0) {
    return '';
  }

  if (familySlug === 'v2') {
    return `Automated v2 release for ${joinNaturalLanguage(items)}.`;
  }

  return `Automated update for ${joinNaturalLanguage(items)}.`;
}

function compareDownloadsForNotes(left, right) {
  const leftDose = Number.parseInt(left.dose, 10);
  const rightDose = Number.parseInt(right.dose, 10);

  if (leftDose !== rightDose) {
    return leftDose - rightDose;
  }

  return getSlotKey(left).localeCompare(getSlotKey(right));
}

function formatDownloadForNote(download, familySlug) {
  if (familySlug === 'v2') {
    return download.label;
  }

  if (download.slotId?.includes('step-down')) {
    return `${download.label} Direct Lever`;
  }

  if (download.profileType) {
    return `${download.label} ${profileTypeLabels[download.profileType]}`;
  }

  return `${download.label} Main`;
}

function joinNaturalLanguage(items) {
  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function normalizeLatestFlags(releases) {
  for (const family of releases) {
    const sortedBuilds = [...family.builds].sort(compareBuildsDesc);

    sortedBuilds.forEach((build, index) => {
      build.isLatest = index === 0;
    });
  }
}

function compareBuildsDesc(left, right) {
  const versionDiff = compareNumberTuplesDesc(toNumberTuple(left.buildVersion), toNumberTuple(right.buildVersion));

  if (versionDiff !== 0) {
    return versionDiff;
  }

  const dateDiff = new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime();

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return 0;
}

function toNumberTuple(buildVersion) {
  const matchedBuild = buildVersion.match(/v(?:it3|v?3|v?2)?_?([0-9_]+)/i);

  if (matchedBuild?.[1]) {
    return matchedBuild[1].split('_').map((chunk) => Number.parseInt(chunk, 10));
  }

  const digits = buildVersion.match(/\d+/g);
  return digits ? digits.map((chunk) => Number.parseInt(chunk, 10)) : [];
}

function compareNumberTuplesDesc(left, right) {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? -1;
    const b = right[index] ?? -1;

    if (a !== b) {
      return b - a;
    }
  }

  return 0;
}

function clearIncomingDirectory(incomingDir) {
  fs.rmSync(incomingDir, { recursive: true, force: true });
  fs.mkdirSync(incomingDir, { recursive: true });
  fs.writeFileSync(path.join(incomingDir, GITKEEP_NAME), '');
}

function summarizeUploads(uploads) {
  const grouped = new Map();

  for (const upload of uploads) {
    const key = `${upload.familySlug}/${upload.buildVersion}`;
    const entry = grouped.get(key) ?? [];
    entry.push(formatDownloadForNote(upload.download, upload.familySlug));
    grouped.set(key, entry);
  }

  return [...grouped.entries()].map(([key, labels]) => `${key}: ${joinNaturalLanguage(labels)}.`);
}

function getCurrentBerlinDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}
