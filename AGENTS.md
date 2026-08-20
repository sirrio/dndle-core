# Agent guide

This repository inherits the global Codex project policy. The rules below cover
only the product, contracts, verification, and distribution details specific to
`dndle-core`.

## Product boundary

- `dndle-core` is the shared React game shell for Spelldle and Critterdle.
- Keep daily UTC puzzle selection, the six-guess board, comparison feedback,
  local statistics, result sharing, responsive layout, tooltips, and the legal
  footer generic and reusable by both games.
- Game entries, icons, comparison traits, copy, theme values, storage
  namespaces, and game-specific attribution belong to the consuming game.
- Do not add consumer-specific branches or content to the shared core. Extend
  the typed configuration contract when both games need a new capability.

## Architecture and public contract

- The public React and TypeScript API is exported from `src/index.tsx`.
- Shared styling is exported from `src/styles.css`.
- Consumers compile the source package themselves and provide React 19 or
  newer through peer dependencies; this repository does not publish a compiled
  bundle.
- Treat exported types and functions, `DndleConfig`, shared CSS selectors and
  custom properties, UTC selection behavior, storage behavior, and share-text
  formatting as cross-repository contracts.
- Preserve deterministic UTC day and target selection. A release must not
  silently change an already published daily answer sequence.
- Preserve accessible names, keyboard interaction, reduced-motion behavior,
  and functional desktop and mobile layouts.

## Verification

- Install the locked dependency set with `npm ci` when a clean installation is
  required.
- Run `npm run check` for the strict TypeScript check.
- Run `npm test` for the Node test suite.
- GitHub CI runs all three commands on Node 22 for pull requests and pushes to
  `main`.
- For changes to shared behavior, public types, or CSS, verify both consuming
  repositories with `npm test` and `npm run build`, using the local candidate
  package without committing temporary dependency or lockfile changes.
- Verify shared UI changes in both Spelldle and Critterdle on desktop and mobile.

## Distribution and coordinated releases

- The package is distributed from this public GitHub repository as an exact
  version-tag tarball; there is no npm publish workflow.
- `package.json`, the root package metadata in `package-lock.json`, the release
  branch, and the final annotated tag must use the same semantic version.
- Spelldle and Critterdle pin exact `dndle-core` tag archives. Test both
  consumers against the release candidate before tagging, then update each
  consumer on its own release branch after the tag exists.
- GitHub release notes describe the shared player-visible outcomes. Reuse the
  applicable wording in the consuming games' release notes.

## Licensing

- The shared source is MIT licensed.
- Game data and icons remain owned, licensed, and attributed by the consuming
  repositories; do not move them into this package without reviewing their
  licenses.
