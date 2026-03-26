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
  'user-profile': 'User Profile',
  experimental: 'Experimental and Other',
};

const vit3BatchDefinitions = [
  {
    profileType: 'direct-lever',
    aliases: ['direct lever'],
    defaultVariant: 'Standard basket',
    defaultSlotId: (dose) => `vit3-${dose}-main`,
    customSlotPrefix: (dose) => `vit3-${dose}-main`,
  },
  {
    profileType: 'spring-lever',
    aliases: ['spring lever'],
    defaultVariant: 'Spring Lever basket',
    defaultSlotId: (dose) => `vit3-${dose}-spring-lever`,
    customSlotPrefix: (dose) => `vit3-${dose}-spring-lever`,
  },
  {
    profileType: 'adaptive-pressure',
    aliases: ['adaptive pressure'],
    defaultVariant: 'Standard basket',
    defaultSlotId: (dose) => `vit3-${dose}-adaptive-pressure`,
    customSlotPrefix: (dose) => `vit3-${dose}-adaptive-pressure`,
  },
  {
    profileType: 'nine-bar',
    aliases: ['9 bar', '9bar'],
    defaultVariant: 'Standard basket',
    defaultSlotId: (dose) => `vit3-${dose}-nine-bar`,
    customSlotPrefix: (dose) => `vit3-${dose}-nine-bar`,
  },
  {
    profileType: 'user-profile',
    aliases: ['user profile'],
    defaultVariant: 'User Profile',
    defaultSlotId: (dose) => `vit3-${dose}-user-profile`,
    customSlotPrefix: (dose) => `vit3-${dose}-user-profile`,
  },
];

const v2KnownDoseMap = {
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
    const baseDownload = getV2DownloadMetadata(v2Match.groups.dose);

    return {
      sourcePath,
      fileName,
      familySlug: 'v2',
      buildVersion: currentBerlinDate,
      releaseDate: currentBerlinDate,
      download: { ...baseDownload, file: fileName },
    };
  }

  const vit3Match = parseVit3FileName(fileName);

  if (vit3Match?.version) {
    return {
      sourcePath,
      fileName,
      familySlug: 'vit3',
      buildVersion: vit3Match.version,
      releaseDate: currentBerlinDate,
      download: buildVit3Download(vit3Match.dose, vit3Match.rawTag, vit3Match.trailingText, fileName),
    };
  }

  throw new Error(
    `Unsupported filename "${fileName}". Expected "Automatic Pro v2 11g.json", "Automatic Pro 21g [Spring Lever] vIT3_0_29_5.json", or "Automatic Pro Soup vIT3_0_29_5.json".`
  );
}

function parseVit3FileName(fileName) {
  const matchedFile = fileName.match(/^Automatic Pro\s+(?<body>.+?)\s+(?<version>v(?:IT)?3(?:_\d+)+)\.json$/i);

  if (!matchedFile?.groups?.body || !matchedFile.groups.version) {
    return null;
  }

  const body = matchedFile.groups.body.trim();
  const doseMatch = body.match(/^(?<dose>\d+g)(?:\s+(?<rest>.+))?$/i);
  const dose = doseMatch?.groups?.dose ?? '';
  const remainder = doseMatch ? (doseMatch.groups?.rest ?? '').trim() : body;

  if (!dose && !remainder) {
    return null;
  }

  const bracketMatch = remainder.match(/^\[(?<tag>[^\]]+)\](?:\s+(?<tail>.+))?$/);

  if (bracketMatch?.groups?.tag) {
    return {
      dose,
      rawTag: bracketMatch.groups.tag,
      trailingText: (bracketMatch.groups.tail ?? '').trim(),
      version: matchedFile.groups.version,
    };
  }

  if (!dose && !remainder) {
    return null;
  }

  return {
    dose,
    rawTag: '',
    trailingText: remainder,
    version: matchedFile.groups.version,
  };
}

function getV2DownloadMetadata(dose) {
  const knownDose = v2KnownDoseMap[dose];

  if (knownDose) {
    return knownDose;
  }

  return {
    label: dose,
    dose,
    variant: 'Custom dose',
    temperatureC: 91,
    notes: '',
    slotId: `v2-${dose}-custom`,
  };
}

function buildVit3Download(dose, rawTag, trailingText, fileName) {
  const parsedTag = parseVit3Tag(rawTag);
  const trailingSegments = splitTrailingTextSegments(trailingText);

  if (!parsedTag && trailingSegments.length === 0) {
    return {
      label: formatDisplayLabel(dose),
      dose,
      variant: 'Standard basket',
      file: fileName,
      temperatureC: 89,
      notes: '',
      slotId: `vit3-${getDoseKey(dose)}-main`,
      profileType: 'direct-lever',
    };
  }

  if (!parsedTag) {
    return buildExperimentalDownload(dose, buildVisibleExtraLabel(trailingSegments), fileName);
  }

  if (parsedTag.hasStepDown) {
    const combinedSegments = [...parsedTag.extraSegments, ...trailingSegments];
    const extraLabel = buildVisibleExtraLabel(combinedSegments);
    const label = formatDisplayLabel(dose, extraLabel || 'Step-Down');
    const extraSlug = buildExtraSlug(combinedSegments.filter((segment) => normalizeSegment(segment) !== 'step-down'));

    return {
      label,
      dose,
      variant: 'Step-Down basket',
      file: fileName,
      temperatureC: 89,
      notes: 'Experimental step-down variant inside the Direct Lever branch.',
      slotId: extraSlug
        ? `vit3-${getDoseKey(dose)}-step-down-${extraSlug}`
        : `vit3-${getDoseKey(dose)}-step-down`,
      profileType: 'direct-lever',
    };
  }

  if (!parsedTag.batch) {
    return buildExperimentalDownload(dose, buildVisibleExtraLabel([...parsedTag.extraSegments, ...trailingSegments]), fileName);
  }

  const extraSegments = [...parsedTag.extraSegments, ...trailingSegments];
  const extraLabel = buildVisibleExtraLabel(extraSegments);
  const extraSlug = buildExtraSlug(extraSegments);
  const slotDose = getDoseKey(dose);

  return {
    label: formatDisplayLabel(dose, extraLabel || (!dose ? profileTypeLabels[parsedTag.batch.profileType] : '')),
    dose,
    variant: parsedTag.batch.defaultVariant,
    file: fileName,
    temperatureC: 89,
    notes: '',
    slotId: extraSlug
      ? `${parsedTag.batch.customSlotPrefix(slotDose)}-${extraSlug}`
      : parsedTag.batch.defaultSlotId(slotDose),
    profileType: parsedTag.batch.profileType,
  };
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

function normalizeSegment(segment) {
  return segment
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function cleanSegment(segment) {
  return segment.trim().replace(/\s+/g, ' ');
}

function parseVit3Tag(rawTag) {
  const normalizedTag = normalizeTag(rawTag);

  if (!normalizedTag) {
    return null;
  }

  const segments = rawTag
    .split(/\s*(?:,|\/)\s*/)
    .map(cleanSegment)
    .filter(Boolean);
  const normalizedSegments = segments.map(normalizeSegment);
  const batchIndex = normalizedSegments.findIndex((segment) =>
    vit3BatchDefinitions.some((definition) => definition.aliases.includes(segment))
  );

  const hasStepDown = normalizedSegments.includes('step-down');

  if (batchIndex === -1) {
    if (hasStepDown) {
      return {
        batch: vit3BatchDefinitions.find((definition) => definition.profileType === 'direct-lever'),
        extraSegments: segments,
        hasStepDown: true,
      };
    }

    return {
      batch: null,
      extraSegments: segments,
      hasStepDown: false,
    };
  }

  const batch = vit3BatchDefinitions.find((definition) => definition.aliases.includes(normalizedSegments[batchIndex]));
  const extraSegments = segments.filter((_, index) => index !== batchIndex);

  return {
    batch,
    extraSegments,
    hasStepDown,
  };
}

function buildVisibleExtraLabel(extraSegments) {
  if (extraSegments.length === 0) {
    return '';
  }

  return extraSegments.map(cleanSegment).join(' ');
}

function splitTrailingTextSegments(trailingText) {
  if (!trailingText) {
    return [];
  }

  return trailingText
    .split(/\s*(?:,|\/)\s*/)
    .map(cleanSegment)
    .filter(Boolean);
}

function formatDisplayLabel(dose, visibleExtraLabel = '') {
  if (dose && visibleExtraLabel) {
    return `${dose} ${visibleExtraLabel}`;
  }

  if (dose) {
    return dose;
  }

  if (visibleExtraLabel) {
    return visibleExtraLabel;
  }

  throw new Error('Cannot build a display label without a dose or visible name.');
}

function getDoseKey(dose) {
  return dose ? normalizeSegment(dose).replace(/[^a-z0-9]+/g, '-') : 'no-dose';
}

function buildExperimentalDownload(dose, visibleExtraLabel, fileName) {
  const label = formatDisplayLabel(dose, visibleExtraLabel);
  const extraSlug = buildExtraSlug(splitTrailingTextSegments(visibleExtraLabel));
  const slotPrefix = dose ? `vit3-${getDoseKey(dose)}-experimental` : 'vit3-experimental';

  return {
    label,
    dose,
    variant: 'Experimental',
    file: fileName,
    temperatureC: 89,
    notes: '',
    slotId: extraSlug ? `${slotPrefix}-${extraSlug}` : slotPrefix,
    profileType: 'experimental',
  };
}

function buildExtraSlug(extraSegments) {
  const normalized = extraSegments
    .map((segment) => normalizeSegment(segment))
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized;
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
  const leftDose = getDoseSortValue(left.dose);
  const rightDose = getDoseSortValue(right.dose);

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

  if (download.profileType === 'experimental') {
    return download.label;
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

function getDoseSortValue(dose) {
  const parsedDose = Number.parseInt(dose, 10);
  return Number.isNaN(parsedDose) ? Number.POSITIVE_INFINITY : parsedDose;
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
