# Changelog

## [0.1.1](https://github.com/Lycan-Xx/trova-ims/compare/0.1.0...v0.1.1) (2026-08-19)


### Bug Fixes

* copy desktop-schema.sql into standalone bundle (root cause of Windows startup failure) ([c95c584](https://github.com/Lycan-Xx/trova-ims/commit/c95c584b2d349cf80322fa1e681ef0667f3a5c22))
* copy desktop-schema.sql into standalone bundle + log server errors ([6cf69b7](https://github.com/Lycan-Xx/trova-ims/commit/6cf69b7c74676aeafd3356368a50b14b6d2b0791))
* Linux AppImage removed from CI + Windows verbatim path stripped ([a6d8434](https://github.com/Lycan-Xx/trova-ims/commit/a6d8434c8fc6782c021b81e8f82968fde89173e3))
* Linux AppImage removed from CI, Windows \\?\ path stripped ([8e8ad2a](https://github.com/Lycan-Xx/trova-ims/commit/8e8ad2a08002bfca4cca272ba69b75d265bba71e))

## Changelog

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
