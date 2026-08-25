# Desktop Build Guide

This guide covers building Trova IMS desktop applications locally and via CircleCI.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Local Build Testing](#local-build-testing)
- [CircleCI Setup](#circleci-setup)
- [Build Outputs](#build-outputs)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### All Platforms

1. **Node.js 20+**
   ```bash
   node --version  # Should be v20.x or higher
   ```

2. **Rust Toolchain**
   ```bash
   # Install from https://rustup.rs/
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Verify installation
   rustc --version
   cargo --version
   ```

3. **Project Dependencies**
   ```bash
   npm install
   ```

### Platform-Specific Dependencies

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential
```

#### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Windows

```bash
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++" workload
```

## Local Development

### Running the Desktop App in Dev Mode

```bash
npm run desktop:dev
```

This will:
1. Start the Next.js dev server
2. Launch the Tauri desktop app
3. Enable hot reload for both frontend and backend

### Dev Mode with External Server

If you want to run the Next.js server separately:

```bash
# Terminal 1: Start Next.js
npm run dev:desktop

# Terminal 2: Start Tauri (pointing to existing server)
npm run desktop:dev:external
```

## Local Build Testing

### Quick Test (Current Platform)

```bash
npm run test:desktop-build
```

This script will:
- ✅ Check all dependencies (Node, Rust, Cargo)
- ✅ Verify platform-specific requirements
- ✅ Check environment variables
- 🔨 Build the desktop app for your platform
- 📦 List generated installer files

### Platform-Specific Builds

```bash
# Linux (creates .deb and .rpm)
node scripts/test-desktop-build.mjs linux

# macOS (creates .dmg)
node scripts/test-desktop-build.mjs macos

# Windows (creates .msi and .exe)
node scripts/test-desktop-build.mjs windows
```

### Debug Builds

Debug builds compile faster and include debug symbols:

```bash
npm run test:desktop-build -- debug
# or
node scripts/test-desktop-build.mjs current debug
```

### Full Production Build

```bash
npm run desktop:build
```

This runs the full Tauri build pipeline:
1. Runs `scripts/tauri-prebuild.mjs`
2. Builds Next.js with `output: 'standalone'`
3. Copies `public/` and `.next/static/` into standalone
4. Bundles the standalone app with Tauri (using system Node.js and WebView2)
5. Creates platform-specific installers

## CircleCI Setup

### Initial Setup

1. **Enable Project in CircleCI**
   - Go to https://circleci.com/
   - Sign in with GitHub
   - Click "Projects" → Find "trova-ims" → "Set Up Project"

2. **Configure Environment Variables** (Optional)
   - Project Settings → Environment Variables
   - Add (if needed):
     - `DATABASE_URL`: PostgreSQL connection string
     - `BETTER_AUTH_SECRET`: Auth secret key
   
   **Note**: Default placeholder values work fine for builds

3. **Verify Configuration**
   ```bash
   # Check config syntax locally
   circleci config validate
   ```

### Triggering Builds

#### Method 1: Manual Trigger (CircleCI UI)

1. Go to your project in CircleCI
2. Click "Trigger Pipeline"
3. Optional: Add parameters for debug build:
   ```json
   {
     "build-profile": "debug"
   }
   ```
4. Click "Trigger Pipeline"

All three platforms (Linux, macOS, Windows) will build in parallel.

#### Method 2: Git Tags

```bash
git tag v0.1.4
git push origin v0.1.4
```

#### Method 3: Branch Push

Push to `main` or `separation-attempt`:

```bash
git push origin main
```

#### Method 4: Scheduled (Nightly)

Automatic nightly builds run at midnight UTC on `main` branch.

To disable: Comment out the `nightly-builds` workflow in `.circleci/config.yml`.

### Monitoring Builds

1. Go to CircleCI dashboard
2. Click on your pipeline
3. View parallel jobs:
   - `build-linux`
   - `build-macos`
   - `build-windows`
   - `collect-artifacts`
4. Click on each job to see logs
5. Go to "Artifacts" tab to download installers

### Build Status Badge

Add to your README.md:

```markdown
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/YOUR_USERNAME/trova-ims/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/YOUR_USERNAME/trova-ims/tree/main)
```

## Build Outputs

### File Locations

After a successful build, installers are in:

```
src-tauri/target/release/bundle/
├── deb/           # Linux: Debian/Ubuntu packages
│   └── trova-ims_0.1.2_amd64.deb
├── rpm/           # Linux: Fedora/RHEL packages
│   └── trova-ims-0.1.2-1.x86_64.rpm
├── dmg/           # macOS: Disk images
│   └── Trova IMS_0.1.2_x64.dmg
├── msi/           # Windows: MSI installers
│   └── Trova IMS_0.1.2_x64_en-US.msi
└── nsis/          # Windows: NSIS installers
    └── Trova IMS_0.1.2_x64-setup.exe
```

### Installer Types

| Platform | Format | Description | Recommended |
|----------|--------|-------------|-------------|
| Linux | `.deb` | Debian/Ubuntu package | ✅ Yes |
| Linux | `.rpm` | Fedora/RHEL package | ✅ Yes |
| Linux | `.AppImage` | Portable executable | ❌ No (FUSE issues on CI) |
| macOS | `.dmg` | Disk image | ✅ Yes |
| macOS | `.app` | Application bundle | Inside .dmg |
| Windows | `.msi` | Windows Installer | ✅ Yes |
| Windows | `.exe` | NSIS installer | ✅ Yes |

### File Sizes

Typical installer sizes:
- **Linux (.deb/.rpm)**: 150-200 MB
- **macOS (.dmg)**: 180-250 MB
- **Windows (.msi/.exe)**: 160-220 MB

The standalone Next.js server + Rust binary account for most of the size.
The lean installer does not include a Node.js runtime or offline WebView2
installer; those are expected to be available on the target machine.

## Troubleshooting

### Local Build Issues

#### "rustc not found"

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Verify
rustc --version
```

#### Linux: "webkit2gtk not found"

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev
```

#### macOS: "xcode-select: error"

```bash
xcode-select --install
```

#### Windows: "LINK: fatal error"

Install Visual Studio Build Tools with "Desktop development with C++" workload.

#### "ENOENT: .next/standalone"

This means the prebuild script failed. Try:

```bash
# Run the prebuild manually
node scripts/tauri-prebuild.mjs

# Then build
npm run desktop:build
```

### CircleCI Build Issues

#### Build Timeout

If builds exceed 30 minutes, increase timeout in `.circleci/config.yml`:

```yaml
- build-tauri-app:
    no_output_timeout: 45m  # Increase from 30m
```

#### Cache Issues

Clear caches:
1. CircleCI → Project Settings → Caches
2. Click "Clear Cache"
3. Re-run build

#### macOS: Code Signing Issues

For public distribution, you need Apple Developer certificates.

Add to CircleCI environment variables:
- `APPLE_CERTIFICATE`: Base64-encoded certificate
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_ID`: Apple ID email
- `APPLE_PASSWORD`: App-specific password

Then update `tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Your Name (TEAM_ID)"
    }
  }
}
```

#### Windows: Signing Issues

For Windows code signing, add:
- `WINDOWS_CERTIFICATE`: Base64-encoded PFX
- `WINDOWS_CERTIFICATE_PASSWORD`: PFX password

### Build Performance

#### Slow Initial Builds

First build takes longer due to:
- Downloading Rust dependencies
- Compiling Rust crates
- Building Next.js standalone output

Subsequent builds are much faster (5-10x) thanks to caching.

#### Optimize Build Speed

1. **Use larger resource classes** in CircleCI (costs more):
   ```yaml
   resource_class: xlarge  # or macos.m1.xlarge.gen1
   ```

2. **Enable incremental compilation** (already configured):
   ```toml
   # src-tauri/Cargo.toml
   [profile.release]
   incremental = true
   ```

3. **Reduce bundle types** for testing:
   ```bash
   # Only build .deb on Linux
   npx tauri build --bundles deb
   ```

## Advanced Topics

### Custom Build Scripts

Create platform-specific build scripts:

```json
// package.json
{
  "scripts": {
    "build:linux": "tauri build --bundles deb,rpm",
    "build:macos": "tauri build --bundles dmg",
    "build:windows": "tauri build --bundles msi,nsis"
  }
}
```

### Version Management

Versions are defined in multiple places:

1. `package.json` - Web app version
2. `src-tauri/Cargo.toml` - Rust version (tagged with `x-release-please-version`)
3. `src-tauri/tauri.conf.json` - Bundle version

Keep them in sync or use release-please (already configured).

### Conditional Features

Build with different features:

```bash
# Include experimental features
cargo build --features experimental

# Minimal build
cargo build --no-default-features
```

### Cross-Compilation

For advanced users who want to build for other platforms:

```bash
# On Linux, build for Windows (requires mingw)
rustup target add x86_64-pc-windows-gnu
cargo build --target x86_64-pc-windows-gnu
```

**Note**: Cross-compilation is complex and not fully supported by Tauri. Use CI for multi-platform builds.

## Resources

- [Tauri Documentation](https://tauri.app/)
- [CircleCI Documentation](https://circleci.com/docs/)
- [Rust Installation Guide](https://www.rust-lang.org/tools/install)
- [Next.js Standalone Output](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)

## Support

- **Tauri Issues**: https://github.com/tauri-apps/tauri/issues
- **CircleCI Support**: https://support.circleci.com/
- **Project Issues**: Open an issue in this repository
