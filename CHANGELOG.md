# Changelog

All notable changes to Trova IMS are documented here, generated automatically by [release-please](https://github.com/googleapis/release-please) from conventional commit messages.
## [0.1.3](https://github.com/Lycan-Xx/trova-ims/compare/v0.1.2...v0.1.3) (2026-08-22)


### Bug Fixes

* detect Tauri desktop mode at runtime instead of build time ([96f79c3](https://github.com/Lycan-Xx/trova-ims/commit/96f79c3420462cb0b029286210e627dc637592cd))
* grant IPC access to the local server origin (isTauri() was false) ([5003531](https://github.com/Lycan-Xx/trova-ims/commit/50035315410f6c91c34b7ae65a4cabad6790911a))
* grant Tauri IPC access to the local server origin (isTauri() was returning false) ([c0c8a0e](https://github.com/Lycan-Xx/trova-ims/commit/c0c8a0e7fd63c6fe0c880e98f57bca5b7591b144))
* orphaned server processes causing stale pg errors + EADDRINUSE ([86bde32](https://github.com/Lycan-Xx/trova-ims/commit/86bde3212dbeffb426523155be3a4367cdf9be96))
* prevent orphaned server processes (root cause of pg error recurring) ([d9be882](https://github.com/Lycan-Xx/trova-ims/commit/d9be882ae315322b723c9ffb99ce4ff2552c864b))

## [0.1.2](https://github.com/Lycan-Xx/trova-ims/compare/v0.1.1...v0.1.2) (2026-08-21)


### Bug Fixes

* desktop lands on dashboard + resolve pg Turbopack bundling crash ([b92bec2](https://github.com/Lycan-Xx/trova-ims/commit/b92bec2350019a2db5483ecd9fbc69c7553b14f4))
* Ubuntu apt-get update hang (bad default mirror) + job timeout ([1cfb2a6](https://github.com/Lycan-Xx/trova-ims/commit/1cfb2a66fb8409864c6db9dbac512a31b1dbde3d))
* Ubuntu apt-get update hang (bad mirror) + 45min job timeout ([2f99a39](https://github.com/Lycan-Xx/trova-ims/commit/2f99a3962068e2e691fbdf7b18cab18cd4282ef9))

## [0.1.1](https://github.com/Lycan-Xx/trova-ims/compare/0.1.0...v0.1.1) (2026-08-19)


### Bug Fixes

* copy desktop-schema.sql into standalone bundle (root cause of Windows startup failure) ([c95c584](https://github.com/Lycan-Xx/trova-ims/commit/c95c584b2d349cf80322fa1e681ef0667f3a5c22))
* copy desktop-schema.sql into standalone bundle + log server errors ([6cf69b7](https://github.com/Lycan-Xx/trova-ims/commit/6cf69b7c74676aeafd3356368a50b14b6d2b0791))
* Linux AppImage removed from CI + Windows verbatim path stripped ([a6d8434](https://github.com/Lycan-Xx/trova-ims/commit/a6d8434c8fc6782c021b81e8f82968fde89173e3))
* Linux AppImage removed from CI, Windows \\?\\ path stripped ([8e8ad2a](https://github.com/Lycan-Xx/trova-ims/commit/8e8ad2a08002bfca4cca272ba69b75d265bba71e))
