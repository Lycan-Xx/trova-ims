const GITHUB_OWNER = 'Lycan-Xx'
const GITHUB_REPOSITORY = 'trova-ims'
const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/latest`
const TRUSTED_DOWNLOAD_PATH = `/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/download/`.toLowerCase()

type GitHubReleaseAsset = {
  id: number
  name: string
  size: number
  state: string
  digest?: string | null
  browser_download_url: string
}

type GitHubRelease = {
  tag_name: string
  name: string | null
  published_at: string | null
  assets: GitHubReleaseAsset[]
}

export type WindowsInstaller = {
  id: number
  format: 'exe' | 'msi'
  name: string
  size: number
  digest: string | null
  downloadUrl: string
}

export type LatestWindowsRelease = {
  tagName: string
  version: string
  name: string
  publishedAt: string | null
  installers: WindowsInstaller[]
}

function isTrustedReleaseDownload(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.toLowerCase().startsWith(TRUSTED_DOWNLOAD_PATH)
    )
  } catch {
    return false
  }
}

function isGitHubReleaseAsset(value: unknown): value is GitHubReleaseAsset {
  if (!value || typeof value !== 'object') return false

  const asset = value as Partial<GitHubReleaseAsset>
  return (
    typeof asset.id === 'number' &&
    typeof asset.name === 'string' &&
    typeof asset.size === 'number' &&
    typeof asset.state === 'string' &&
    (typeof asset.digest === 'string' || asset.digest == null) &&
    typeof asset.browser_download_url === 'string'
  )
}

function parseRelease(value: unknown): GitHubRelease | null {
  if (!value || typeof value !== 'object') return null

  const release = value as Partial<GitHubRelease>
  if (
    typeof release.tag_name !== 'string' ||
    (typeof release.name !== 'string' && release.name !== null) ||
    (typeof release.published_at !== 'string' && release.published_at !== null) ||
    !Array.isArray(release.assets)
  ) {
    return null
  }

  return {
    tag_name: release.tag_name,
    name: release.name,
    published_at: release.published_at,
    assets: release.assets.filter(isGitHubReleaseAsset),
  }
}

export function selectBundledWindowsInstallers(assets: GitHubReleaseAsset[]): WindowsInstaller[] {
  const installers: WindowsInstaller[] = []

  for (const asset of assets) {
    const name = asset.name.toLowerCase()
    const format = name.endsWith('-windows-bundled.exe')
      ? 'exe'
      : name.endsWith('-windows-bundled.msi')
        ? 'msi'
        : null

    if (
      !format ||
      asset.state !== 'uploaded' ||
      !isTrustedReleaseDownload(asset.browser_download_url)
    ) {
      continue
    }

    installers.push({
      id: asset.id,
      format,
      name: asset.name,
      size: asset.size,
      digest: asset.digest ?? null,
      downloadUrl: asset.browser_download_url,
    })
  }

  return installers.sort((left, right) => Number(left.format === 'msi') - Number(right.format === 'msi'))
}

export async function getLatestWindowsRelease(): Promise<LatestWindowsRelease | null> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'trova-download-page',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers,
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      console.error(`[downloads] GitHub latest release request failed with ${response.status}.`)
      return null
    }

    const release = parseRelease(await response.json())
    if (!release) {
      console.error('[downloads] GitHub returned an unexpected latest release payload.')
      return null
    }

    return {
      tagName: release.tag_name,
      version: release.tag_name.replace(/^v/i, ''),
      name: release.name || release.tag_name,
      publishedAt: release.published_at,
      installers: selectBundledWindowsInstallers(release.assets),
    }
  } catch (error) {
    console.error('[downloads] Could not load the latest GitHub release.', error)
    return null
  }
}
