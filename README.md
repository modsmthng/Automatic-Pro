# Automatic Pro

Docs site: https://modsmthng.github.io/Automatic-Pro/

GaggiMate: https://github.com/jniebuhr/gaggimate

## Upload workflow

New profile uploads now go through `incoming/` and a GitHub Action.

1. Create a branch from `main`.
2. Drop new JSON files into `incoming/`.
3. Push the branch.

_4. The `Ingest Uploaded Profiles` workflow validates the files, moves them into `public/downloads/`, updates `src/data/releases.json`, and opens or updates a PR to `main`.
5. Review the PR and merge it when it looks right._

`main` does not ingest files directly. The automation only processes uploads from non-`main` branches.

## Filename format

`v2`

Format:

- `Automatic Pro v2 <dose>.json`

Examples:

- `Automatic Pro v2 11g.json`
- `Automatic Pro v2 18g.json`
- `Automatic Pro v2 22g.json`


`vIT3` / `v3`

Format:

- `Automatic Pro <dose> [<batch name><optional extra info>] <buildVersion>.json`

Known batch names:

- `Direct Lever`
- `Spring Lever`
- `Adaptive Pressure`
- `9 bar`
- `User Profile`

Examples:

- `Automatic Pro 18g [Direct Lever] vIT3_0_29_5.json`
- `Automatic Pro 18g [Step-Down, Direct Lever] vIT3_0_29_5.json`
- `Automatic Pro 21g [Spring Lever] vIT3_0_29_5.json`
- `Automatic Pro 20g [Adaptive Pressure] vIT3_0_29_5.json`
- `Automatic Pro 20g [9 bar] vIT3_0_29_5.json`
- `Automatic Pro 20g [User Profile] vIT3_0_29_5.json`
- `Automatic Pro 20g [User Profile, Turbo Shot] vIT3_0_29_5.json`
- `Automatic Pro 20g [User Profile / Turbo Shot] vIT3_0_29_5.json`
- `Automatic Pro 18g vIT3_0_29_1.json` for legacy untagged main-slot files

For `v2`, the workflow creates a build named with the current Berlin date, for example `2026-03-26`.

For `vIT3`/`v3`, the build version comes from the filename and partial updates only replace the matching slot.

`[User Profile]` is meant for profiles that differ from the main profile schemas or are small variations of an existing profile or variation.

Additional info inside the brackets is allowed. The workflow extracts the known batch name for sorting and uses the remaining text as the visible variation name after the dose.

Examples:

- `[Step-Down, Direct Lever]` becomes `18g Step-Down` in the `Direct Lever` batch
- `[User Profile, Turbo Shot]` becomes `20g Turbo Shot` in the `User Profile` batch
- `[User Profile / Turbo Shot]` behaves the same way
