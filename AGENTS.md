# Agent guide

This repository inherits the global Codex project policy. The rules below cover
only the product, contracts, verification, and distribution details specific to
`dndle-core`.

## Product boundary

- `dndle-core` is the shared React game shell for Spelldle and Critterdle.
- Keep daily UTC puzzle selection, the seven-guess board, comparison feedback,
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
- During Coding, select checks for the changed shared behavior and contracts.
  Public type changes require `npm run check`; exercise affected behavior and UI
  in both consuming games where the shared change applies, using only the
  directly affected flows and viewports.
- In the PR phase, run `npm run check` for strict TypeScript checking and
  `npm test` for the full Node test suite.
- For changes to shared behavior, public types, or CSS, the PR checks also run
  `npm test` and `npm run build` in both consuming repositories. Use the local
  candidate package without committing temporary dependency or lockfile changes.
  Shared UI changes require the full desktop and mobile checks in both games.
- Use the consuming game's documented local browser-test service and readiness
  endpoint. This package has no standalone web server; tests need the candidate
  integrated into Spelldle and Critterdle.
- GitHub CI currently runs installation, type checking, and the Node suite on
  Node 22 for all pull requests, including Drafts, and pushes to `main`; CI does
  not yet distinguish Coding and PR phases.

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
