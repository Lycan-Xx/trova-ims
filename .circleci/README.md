# CircleCI Configuration for Trova IMS Desktop Builds

This directory contains the CircleCI configuration for building Trova IMS desktop applications for Linux, macOS, and Windows.

## Features

- **Multi-platform builds**: Automatically builds for Linux (deb/rpm), macOS (dmg), and Windows (msi/nsis)
- **Caching**: Intelligent caching of npm dependencies and Rust build artifacts
- **Parallel execution**: All three platforms build simultaneously
- **Artifact storage**: Built installers are stored as CircleCI artifacts
- **Manual triggers**: Can be triggered manually or on schedule
- **Profile support**: Supports both release and debug builds

## Setup Instructions

### 1. Enable CircleCI for Your Repository

1. Go to [CircleCI](https://circleci.com/)
2. Sign in with your GitHub account
3. Click "Projects" in the left sidebar
4. Find your repository and click "Set Up Project"
5. CircleCI will auto-detect the `.circleci/config.yml` file

### 2. Configure Environment Variables (Optional)

If you need real database credentials during build:

1. In CircleCI, go to Project Settings → Environment Variables
2. Add the following variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `BETTER_AUTH_SECRET`: Your auth secret

**Note**: These are only used during the Next.js build phase. The default placeholder values work fine for most cases.

### 3. Configure Resources (Optional)

For faster builds, you can upgrade the resource classes:
- Linux: `large` (default) or `xlarge`
- macOS: `macos.m1.large.gen1` (default) or `macos.m1.xlarge.gen1`
- Windows: `windows.large` or `windows.xlarge`

Edit the `resource_class` in `.circleci/config.yml` under each executor.

## Triggering Builds

### Method 1: Manual Trigger via CircleCI UI

1. Go to your project in CircleCI
2. Click "Trigger Pipeline" in the top right
3. (Optional) Add parameters:
   ```json
   {
     "build-profile": "release"
   }
   ```
4. Click "Trigger Pipeline"

### Method 2: Git Tags

Push a git tag to trigger a build:

```bash
git tag v0.1.3
git push origin v0.1.3
```

### Method 3: Push to Specific Branches

The workflow is configured to run on:
- `main` branch
- `separation-attempt` branch

Simply push to these branches to trigger builds.

### Method 4: Scheduled Builds (Nightly)

The `nightly-builds` workflow runs automatically at midnight UTC every day on the `main` branch.

To disable nightly builds, comment out or remove the `nightly-builds` workflow section in `config.yml`.

## Build Profiles

### Release Build (Default)
- Optimized for size and performance
- Strips debug symbols
- This is what you'd ship to users

```bash
# Trigger with default (release) profile
# No special parameters needed
```

### Debug Build
- Includes debug symbols
- Faster compilation
- Useful for debugging issues

Trigger via CircleCI UI with parameter:
```json
{
  "build-profile": "debug"
}
```

## Build Outputs

### Linux
- `.deb` packages (Ubuntu/Debian)
- `.rpm` packages (Fedora/RHEL/CentOS)
- Location: `src-tauri/target/release/bundle/deb` and `bundle/rpm`

### macOS
- `.dmg` disk images
- Location: `src-tauri/target/release/bundle/dmg`

### Windows
- `.msi` installers (Windows Installer)
- `.exe` installers (NSIS)
- Location: `src-tauri/target/release/bundle/msi` and `bundle/nsis`

## Downloading Build Artifacts

1. Go to your pipeline in CircleCI
2. Click on a completed job (e.g., "build-linux")
3. Go to the "Artifacts" tab
4. Download the installer files you need

Or use the `collect-artifacts` job which aggregates all builds in one place.

## Build Times

Typical build times (cold cache):
- **Linux**: 15-25 minutes
- **macOS**: 20-30 minutes
- **Windows**: 25-35 minutes

With warm cache (subsequent builds):
- **Linux**: 8-12 minutes
- **macOS**: 10-15 minutes
- **Windows**: 12-18 minutes

## Troubleshooting

### Build Timeout
If builds exceed 30 minutes, increase the `no_output_timeout`:

```yaml
no_output_timeout: 45m
```

### Cache Issues
To clear caches, add `clear-cache` to your commit message:

```bash
git commit -m "Clear cache: rebuild dependencies"
```

Then manually delete caches in CircleCI:
1. Project Settings → Caches
2. Click "Clear Cache"

### Platform-Specific Issues

#### Linux: webkit2gtk errors
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev
```

#### macOS: Code signing
For distribution, you'll need Apple Developer certificates. Add these as environment variables:
- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`

#### Windows: Missing dependencies
Ensure Visual Studio Build Tools are available (CircleCI Windows images include these).

## CI/CD Pipeline Integration

### Automatic Releases

To automatically create GitHub releases when builds complete, add this job:

```yaml
create-release:
  docker:
    - image: cibuilds/github:0.13
  steps:
    - attach_workspace:
        at: /tmp/artifacts
    - run:
        name: Create GitHub Release
        command: |
          ghr -t ${GITHUB_TOKEN} \
              -u ${CIRCLE_PROJECT_USERNAME} \
              -r ${CIRCLE_PROJECT_REPONAME} \
              -c ${CIRCLE_SHA1} \
              -delete \
              ${CIRCLE_TAG} \
              /tmp/artifacts
```

Add `GITHUB_TOKEN` to your CircleCI environment variables.

### Slack Notifications

Add to your CircleCI project settings:
1. Project Settings → Integrations
2. Add Slack integration
3. Configure webhook URL

## Cost Optimization

### Reduce Build Frequency
- Comment out the `nightly-builds` workflow if not needed
- Build only on tags instead of branch pushes

### Use Smaller Resource Classes
For non-critical builds, downgrade to:
- Linux: `medium`
- macOS: `macos.m1.medium.gen1`
- Windows: `windows.medium`

### Parallel vs Sequential
Current config runs all platforms in parallel (faster but uses more credits).
To run sequentially:

```yaml
jobs:
  - build-linux
  - build-macos:
      requires:
        - build-linux
  - build-windows:
      requires:
        - build-macos
```

## Support

For issues specific to:
- **CircleCI config**: Check [CircleCI docs](https://circleci.com/docs/)
- **Tauri builds**: Check [Tauri docs](https://tauri.app/v2/guides/building/)
- **Trova IMS**: Open an issue in this repository

## Resources

- [CircleCI Configuration Reference](https://circleci.com/docs/configuration-reference/)
- [Tauri Building Guide](https://tauri.app/v2/guides/building/)
- [CircleCI Orbs](https://circleci.com/developer/orbs)
- [Rust CircleCI Orb](https://circleci.com/developer/orbs/orb/circleci/rust)
