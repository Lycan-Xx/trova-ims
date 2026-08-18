# Changelog

All notable changes to Trova IMS are documented here.

This file is maintained automatically by
[release-please](https://github.com/googleapis/release-please). Do not
edit it by hand — your commit messages drive the content.

## Commit convention

Trova IMS uses [Conventional Commits](https://www.conventionalcommits.org/).
The type prefix on your commit message determines how the version bumps:

| Prefix | What it signals | Version bump |
|---|---|---|
| `feat:` | A new feature | **minor** (0.x.0) |
| `fix:` | A bug fix | **patch** (0.0.x) |
| `feat!:` or `BREAKING CHANGE:` | A breaking change | **major** (x.0.0) |
| `chore:`, `docs:`, `refactor:`, `style:`, `test:`, `ci:` | Housekeeping | No bump |

### Examples

```
feat: add barcode lookup at POS and intake screens
fix: correct beforeBuildCommand path in CI
feat!: replace Aurora with PGlite for offline desktop support
chore: update dependencies
docs: add desktop testing guide to README
```

release-please reads these prefixes on every merge to `main`, groups
them into the right changelog section, and opens a Release PR when
there is anything worth releasing. Merging that PR creates the GitHub
Release and triggers the installer builds automatically.

---

<!-- release-please-start -->
<!-- release-please-end -->
