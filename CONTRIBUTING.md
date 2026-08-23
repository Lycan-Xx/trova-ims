# Contributing to Trova IMS

## Commit convention

Trova IMS uses [Conventional Commits](https://www.conventionalcommits.org/).
The type prefix on your commit message determines whether a new release
is created and what kind of version bump it triggers:

| Prefix | What it means | Version bump |
|---|---|---|
| `feat:` | A new feature | **minor** (0.x.0) |
| `fix:` | A bug fix | **patch** (0.0.x) |
| `feat!:` or any commit with `BREAKING CHANGE:` in the body | Breaking change | **major** (x.0.0) |
| `chore:`, `docs:`, `refactor:`, `style:`, `test:`, `ci:` | Housekeeping | No release |

### Examples

```
feat: add barcode lookup at POS and intake screens
fix: correct beforeBuildCommand path in CI
feat!: replace Aurora with PGlite for offline desktop support
chore: update dependencies
docs: add desktop testing guide to README
```

## Release process

Releases are automatic. Once commits land on `main`:

1. [release-please](https://github.com/googleapis/release-please)
   reads the conventional commit prefixes and opens a "Release PR"
   that bumps `package.json`, `src-tauri/Cargo.toml`, and prepends
   the new section to `CHANGELOG.md`.
2. Review the Release PR. You can let more `feat:`/`fix:` commits
   accumulate before merging — release-please keeps updating it.
3. Merging the Release PR creates the tagged GitHub Release and kicks
   off `.github/workflows/release.yml`, which builds Windows/macOS/Linux
   installers and uploads them directly to the release.
