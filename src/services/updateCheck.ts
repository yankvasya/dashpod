const REPO = 'yankvasya/dashpod';

export interface ReleaseInfo {
  version: string;
  stage: string;
  buildNumber: number;
  releaseUrl: string;
  apkDownloadUrl: string | null;
}

// Matches the tag format produced by .github/workflows/build.yml: v0.1.0-alpha.42
const TAG_PATTERN = /^v(?<version>[\d.]+)-(?<stage>[a-z]+)\.(?<build>\d+)$/;

/** The build number baked into this running app by CI (see build.yml) — only set on builds
 * produced by the GitHub Actions workflow. 0 in local dev, where there's nothing to compare. */
export function getCurrentBuildNumber(): number {
  const raw = process.env.EXPO_PUBLIC_BUILD_NUMBER;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Fetches the latest GitHub release and parses its tag. Returns null on any failure (offline,
 * rate-limited, no releases yet, or a release whose tag doesn't match the expected format) —
 * callers should treat null the same as "couldn't check, don't bother the user about it." */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!response.ok) return null;
    const data = await response.json();
    const match = TAG_PATTERN.exec(data.tag_name ?? '');
    if (!match?.groups) return null;

    const assets: { name?: string; browser_download_url?: string }[] = data.assets ?? [];
    const apkAsset = assets.find((asset) => asset.name?.endsWith('.apk'));

    return {
      version: match.groups.version,
      stage: match.groups.stage,
      buildNumber: parseInt(match.groups.build, 10),
      releaseUrl: data.html_url,
      apkDownloadUrl: apkAsset?.browser_download_url ?? null,
    };
  } catch {
    return null;
  }
}

export function isNewerBuildAvailable(latest: ReleaseInfo): boolean {
  const current = getCurrentBuildNumber();
  // A build number of 0 means this isn't a CI build (local dev) — nothing meaningful to compare.
  return current > 0 && latest.buildNumber > current;
}

export interface ReleaseNote {
  version: string;
  stage: string;
  buildNumber: number;
  body: string;
  publishedAt: string;
}

/** Fetches recent GitHub releases for an in-app "What's New" list. Skips releases whose tag
 * doesn't match the expected format or that have no description — earlier releases in this
 * project's history predate writing real changelog text, so this naturally shows only the
 * releases that actually have something to say. Returns [] on any failure (offline, rate-limited),
 * same "couldn't check, don't bother the user" treatment as fetchLatestRelease. */
export async function fetchReleaseHistory(limit = 10): Promise<ReleaseNote[]> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    const notes: ReleaseNote[] = [];
    for (const release of data) {
      const match = TAG_PATTERN.exec(release.tag_name ?? '');
      if (!match?.groups || !release.body) continue;
      notes.push({
        version: match.groups.version,
        stage: match.groups.stage,
        buildNumber: parseInt(match.groups.build, 10),
        body: release.body,
        publishedAt: release.published_at,
      });
    }
    return notes;
  } catch {
    return [];
  }
}
