import rawFamilies from '../data/releases.json';

export type ProfileType =
  | 'classic'
  | 'direct-lever'
  | 'spring-lever'
  | 'adaptive-pressure'
  | 'nine-bar'
  | 'ultra-fine'
  | 'user-profile'
  | 'experimental';

export type ProfileTypeDefinition = {
  id: ProfileType;
  label: string;
  description: string;
  chooserSummary?: string;
  note?: string;
  featured?: boolean;
  featuredLine?: string;
  ctaLabel?: string;
};

export const profileTypeDefinitions: ProfileTypeDefinition[] = [
  {
    id: 'classic',
    label: 'Classic',
    description:
      'Often works well with older beans, supermarket beans, darker roasts, and coffees with no known roast date. There is no dedicated bloom phase, the main extraction is flow-based, and the profile reacts directly to puck resistance.',
    chooserSummary: 'Often works well with older beans, supermarket beans, darker roasts and coffees with unknown roast dates.',
    featured: true,
    featuredLine: 'Easiest to dial in',
    ctaLabel: 'Go to Classic',
  },
  {
    id: 'direct-lever',
    label: 'Direct Lever',
    description:
      'Original Automatic Pro experience. Flow-based extraction that simulates a direct/manual lever machine and reacts directly to puck resistance.',
    chooserSummary: "Default recommendation for most coffees. If you're unsure where to start, start here.",
    note: 'If this causes issues with a fast pressure drop, switch to one of the other variations.',
    featured: true,
    featuredLine: 'Flow profile',
    ctaLabel: 'Go to Direct Lever',
  },
  {
    id: 'spring-lever',
    label: 'Spring Lever',
    description:
      'Pressure-based extraction that simulates a traditional spring lever machine with declining pressure throughout the shot.',
    chooserSummary: 'Try this if Direct Lever loses pressure very quickly or produces overly acidic results.',
    note: 'Useful if Direct Lever loses pressure very quickly or tastes overly acidic. If the shot runs too fast, grind finer.',
    featuredLine: 'Pressure profile',
    ctaLabel: 'Go to Spring Lever',
  },
  {
    id: 'adaptive-pressure',
    label: 'Adaptive Pressure',
    description:
      'Experimental pressure-based extraction where pressure adapts to puck resistance. It can reduce acidity for some coffees, but is still actively evolving.',
    ctaLabel: 'Go to Adaptive Pressure',
  },
  {
    id: 'nine-bar',
    label: '9bar',
    description:
      'Traditional flat-pressure extraction using Automatic Pro pre-extraction logic. It usually needs a finer grind than traditional 9 bar profiles.',
    ctaLabel: 'Go to 9bar',
  },
  {
    id: 'ultra-fine',
    label: 'Ultra Fine',
    description:
      'Experimental profile designed for very fine grind sizes. It is mainly intended for light roasts and aims to reduce perceived acidity while preserving fruit notes.',
    ctaLabel: 'Go to Ultra Fine',
  },
  {
    id: 'user-profile',
    label: 'User Profile',
    description:
      'Use this batch when the profile differs from the other profile schemas or is a small variation of an existing profile or variation',
    ctaLabel: 'Go to User Profile',
  },
  {
    id: 'experimental',
    label: 'Experimental and Other',
    description:
      'Profiles without a matching known batch name land here automatically. Remaining names are shown after the dose, for example 20g Soup or Soup.',
    ctaLabel: 'Go to Experimental and Other',
  },
];

const profileTypeMap = new Map(profileTypeDefinitions.map((entry) => [entry.id, entry]));

export type DownloadEntry = {
  label: string;
  dose: string;
  variant: string;
  file: string;
  temperatureC: number;
  notes: string;
  slotId?: string;
  profileType?: ProfileType;
};

export type Build = {
  buildVersion: string;
  releaseDate: string;
  isLatest: boolean;
  notes: string;
  downloads: DownloadEntry[];
};

export type FamilyDownloadMode = 'simple' | 'batched';
export type FamilyCurrentDownloadStrategy = 'merged' | 'latest-build';

export type Family = {
  id: string;
  slug: string;
  displayName: string;
  futureDisplayName: string;
  status: 'stable' | 'testing';
  downloadMode: FamilyDownloadMode;
  summary: string;
  homeFeaturedLine?: string;
  imageHint?: string;
  currentDownloadStrategy?: FamilyCurrentDownloadStrategy;
  builds: Build[];
};

export type CurrentDownload = DownloadEntry & {
  buildVersion: string;
  releaseDate: string;
};

export type CurrentDownloadGroup = {
  type: ProfileType;
  label: string;
  description: string;
  chooserSummary?: string;
  note?: string;
  featured?: boolean;
  featuredLine?: string;
  ctaLabel?: string;
  sectionId: string;
  downloads: CurrentDownload[];
};

const publicFamilyOrder = ['v3', 'pure-flow', 'lab', 'v2'];

export const releaseFamilies = [...(rawFamilies as Family[])].sort((left, right) => {
  const leftIndex = publicFamilyOrder.indexOf(left.slug);
  const rightIndex = publicFamilyOrder.indexOf(right.slug);

  if (leftIndex === -1 && rightIndex === -1) {
    return 0;
  }

  if (leftIndex === -1) {
    return 1;
  }

  if (rightIndex === -1) {
    return -1;
  }

  return leftIndex - rightIndex;
});

function toNumberTuple(buildVersion: string): number[] {
  const matchedBuild = buildVersion.match(/v(?:it3|v?3|v?2)?_?([0-9_]+)/i);

  if (matchedBuild?.[1]) {
    return matchedBuild[1].split('_').map((chunk) => Number.parseInt(chunk, 10));
  }

  const digits = buildVersion.match(/\d+/g);
  return digits ? digits.map((chunk) => Number.parseInt(chunk, 10)) : [];
}

function compareNumberTuplesDesc(left: number[], right: number[]): number {
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

export function compareBuildsDesc(left: Build, right: Build): number {
  const versionDiff = compareNumberTuplesDesc(toNumberTuple(left.buildVersion), toNumberTuple(right.buildVersion));

  if (versionDiff !== 0) {
    return versionDiff;
  }

  const dateDiff = new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime();

  if (dateDiff !== 0) {
    return dateDiff;
  }

  if (left.isLatest !== right.isLatest) {
    return left.isLatest ? -1 : 1;
  }

  return 0;
}

export function sortBuilds(builds: Build[]): Build[] {
  return [...builds].sort(compareBuildsDesc);
}

export function getFamilyBySlug(slug: string): Family {
  const family = releaseFamilies.find((entry) => entry.slug === slug);

  if (!family) {
    throw new Error(`Unknown release family: ${slug}`);
  }

  return family;
}

export function getLatestBuild(family: Family): Build | undefined {
  return family.builds.find((build) => build.isLatest) ?? sortBuilds(family.builds)[0];
}

function getDownloadSlotId(download: DownloadEntry): string {
  return download.slotId ?? `${download.label}::${download.variant}`;
}

function getVariantSortRank(variant: string): number {
  const normalized = variant.toLowerCase();

  if (normalized.includes('step-down')) {
    return 1;
  }

  return 0;
}

function getDoseSortValue(dose: string): number {
  if (!dose.trim()) {
    return -1;
  }

  const parsedDose = Number.parseInt(dose, 10);
  return Number.isNaN(parsedDose) ? Number.POSITIVE_INFINITY : parsedDose;
}

function compareCurrentDownloads(left: CurrentDownload, right: CurrentDownload): number {
  const leftDose = getDoseSortValue(left.dose);
  const rightDose = getDoseSortValue(right.dose);
  const leftRank = getVariantSortRank(left.variant);
  const rightRank = getVariantSortRank(right.variant);

  if (leftDose !== rightDose) {
    return leftDose - rightDose;
  }

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return `${left.label} ${left.variant}`.localeCompare(`${right.label} ${right.variant}`);
}

export function getProfileTypeDefinition(profileType: ProfileType) {
  const definition = profileTypeMap.get(profileType);

  if (!definition) {
    throw new Error(`Unknown profile type: ${profileType}`);
  }

  return definition;
}

export function getVisibleVariant(variant: string): string {
  return variant.toLowerCase().includes('step-down') ? variant : '';
}

export function getDownloadMetaLine(variant: string, temperatureC: number): string {
  const visibleVariant = getVisibleVariant(variant);
  return visibleVariant ? `${visibleVariant} · ${temperatureC}°C default` : `${temperatureC}°C default`;
}

export function getCurrentDownloads(family: Family): CurrentDownload[] {
  if (family.currentDownloadStrategy === 'latest-build') {
    const latestBuild = getLatestBuild(family);

    if (!latestBuild) {
      return [];
    }

    return latestBuild.downloads
      .map((download) => ({
        ...download,
        buildVersion: latestBuild.buildVersion,
        releaseDate: latestBuild.releaseDate,
      }))
      .sort(compareCurrentDownloads);
  }

  const seen = new Set<string>();
  const result: CurrentDownload[] = [];

  for (const build of sortBuilds(family.builds)) {
    for (const download of build.downloads) {
      const key = getDownloadSlotId(download);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push({
        ...download,
        buildVersion: build.buildVersion,
        releaseDate: build.releaseDate,
      });
    }
  }

  return result.sort(compareCurrentDownloads);
}

export function getCurrentDownloadGroups(family: Family): CurrentDownloadGroup[] {
  if (family.downloadMode !== 'batched') {
    return [];
  }

  const grouped = new Map<ProfileType, CurrentDownload[]>();

  for (const definition of profileTypeDefinitions) {
    grouped.set(definition.id, []);
  }

  for (const download of getCurrentDownloads(family)) {
    if (!download.profileType) {
      continue;
    }

    grouped.get(download.profileType)?.push(download);
  }

  return profileTypeDefinitions.map((definition) => ({
    type: definition.id,
    label: definition.label,
    description: definition.description,
    chooserSummary: definition.chooserSummary,
    note: definition.note,
    featured: definition.featured,
    featuredLine: definition.featuredLine,
    ctaLabel: definition.ctaLabel,
    sectionId: `profile-type-${definition.id}`,
    downloads: [...(grouped.get(definition.id) ?? [])].sort(compareCurrentDownloads),
  }));
}

export function getHistoryBuilds(family: Family): Build[] {
  const latestBuild = getLatestBuild(family);

  if (!latestBuild) {
    return [];
  }

  return sortBuilds(family.builds).filter((build) => build.buildVersion !== latestBuild.buildVersion);
}

export function getDownloadPath(familySlug: string, buildVersion: string, fileName: string): string {
  return `downloads/${familySlug}/${buildVersion}/${encodeURIComponent(fileName)}`;
}
