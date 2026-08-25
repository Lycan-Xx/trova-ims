# Changelog

All notable changes to Trova IMS are documented here, generated automatically by [release-please](https://github.com/googleapis/release-please) from conventional commit messages.
## [0.3.3](https://github.com/Lycan-Xx/trova-ims/compare/v0.3.2...v0.3.3) (2026-08-25)


### Bug Fixes

* sync-desktop-version no longer false-errors when versions match ([b27133c](https://github.com/Lycan-Xx/trova-ims/commit/b27133ce4f6bc77ceae086e83aadabb613996702))
* sync-desktop-version no longer false-errors when versions match ([0a55ca9](https://github.com/Lycan-Xx/trova-ims/commit/0a55ca9af8379621aad077c65685b1bd60ec0589))

## [0.3.2](https://github.com/Lycan-Xx/trova-ims/compare/v0.3.1...v0.3.2) (2026-08-25)


### Bug Fixes

* **ci:** synchronize desktop versions and build toolchains ([25644c7](https://github.com/Lycan-Xx/trova-ims/commit/25644c77080560e19c44f30c607813e604f8a2fa))
* clean build artifacts, NSIS upgrade code, PGlite lock file ([7127164](https://github.com/Lycan-Xx/trova-ims/commit/71271645d69b827903e813e7e75f9b79cde1dc4f))
* clean build cache, NSIS upgrade code, PGlite lock file ([778aa90](https://github.com/Lycan-Xx/trova-ims/commit/778aa903e5608200227e626dd3ad814f66b0f868))

## [0.3.1](https://github.com/Lycan-Xx/trova-ims/compare/v0.3.0...v0.3.1) (2026-08-24)


### Bug Fixes

* remove .cargo/config.toml that broke all three CI platforms ([906a5e3](https://github.com/Lycan-Xx/trova-ims/commit/906a5e3a68228a0287d1990556b16e8dd29a4997))
* remove .cargo/config.toml that hardcoded Windows MSVC target globally ([80fa377](https://github.com/Lycan-Xx/trova-ims/commit/80fa377eac38191b4a494454768e743d7b6ec1e4))

## [0.3.0](https://github.com/Lycan-Xx/trova-ims/compare/v0.2.0...v0.3.0) (2026-08-23)


### Features

* **landing:** update messaging and demo flow ([8682422](https://github.com/Lycan-Xx/trova-ims/commit/86824227b29f34c2297baf03626ccd7317fac839))


### Bug Fixes

* desktop feature bugs — vendor list, intake, product delete, version badge, privacy link ([a714104](https://github.com/Lycan-Xx/trova-ims/commit/a714104d283b250ed9dfc26f60219cd42f8e19e4))
* desktop feature bugs, product delete, version badge, privacy link ([760f7d8](https://github.com/Lycan-Xx/trova-ims/commit/760f7d8902710425765b36522da04eb9aeece342))

## [0.2.0](https://github.com/Lycan-Xx/trova-ims/compare/v0.1.4...v0.2.0) (2026-08-23)


### Features

* add global CSS with custom design tokens, fonts, and base styles ([f9f94ef](https://github.com/Lycan-Xx/trova-ims/commit/f9f94ef98fd972e66268b288ab601e9153fe377e))


### Bug Fixes

* improve Linux build reliability with retries and better error handling ([110c64d](https://github.com/Lycan-Xx/trova-ims/commit/110c64df243eda9a32b773e301b42ccd5483ab55))
* install MinGW-w64 to provide dlltool for Windows builds ([990ab65](https://github.com/Lycan-Xx/trova-ims/commit/990ab65be26ce9d1c6ff11642499b8c493fcaa66))
* use MSVC toolchain directly, avoid GNU tools and dlltool issues ([2235b2e](https://github.com/Lycan-Xx/trova-ims/commit/2235b2eec8619239865bcc5df47b45a761078d75))

## [0.1.4](https://github.com/Lycan-Xx/trova-ims/compare/v0.1.3...v0.1.4) (2026-08-23)


### Bug Fixes

* vendor schema mismatch, auth route, release tooling, changelog ([de2272d](https://github.com/Lycan-Xx/trova-ims/commit/de2272d5bcd45b864ecd3512fb6f33ac726287b5))

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
