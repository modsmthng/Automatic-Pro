# Automatic Pro

Docs site: https://modsmthng.github.io/Automatic-Pro/

GaggiMate: https://github.com/jniebuhr/gaggimate

## Upload workflow

New profile uploads now go through `incoming/` and a GitHub Action.

1. Create a branch from `main`.
2. Drop new JSON files into `incoming/`.
3. Push the branch.
4. _The `Ingest Uploaded Profiles` workflow validates the files, moves them into `public/downloads/`, updates `src/data/releases.json`, and opens or updates a PR to `main`._

`main` does not ingest files directly. The automation only processes uploads from non-`main` branches.

## Filename format
`vIT3` / `v3`

Format:

- `Automatic Pro <dose> [<batch name><optional extra info>] <buildVersion>.json`
- `Automatic Pro <dose> <custom name> <buildVersion>.json`
- `Automatic Pro [<custom name>] <buildVersion>.json`
- `Automatic Pro <custom name> <buildVersion>.json`

Known batch names:

- `Direct Lever`
- `Spring Lever`
- `Adaptive Pressure`
- `9 bar`
- **`User Profile`** _<-- Use this batch if you are unsure. You can add a comma and then continue naming the profile, or also add your name. E.g.: [User Profile, Extra Strong]_

If a profile does not contain one of these known batch names, it automatically lands in `Experimental and Other`.

Examples:

- `Automatic Pro 18g [Direct Lever] vIT3_0_29_5.json`
- `Automatic Pro 18g [Step-Down, Direct Lever] vIT3_0_29_5.json`
- `Automatic Pro 21g [Spring Lever] vIT3_0_29_5.json`
- `Automatic Pro 20g [Adaptive Pressure] vIT3_0_29_5.json`
- `Automatic Pro 20g [9 bar] vIT3_0_29_5.json`
- `Automatic Pro 20g [User Profile] vIT3_0_29_5.json`
- `Automatic Pro 20g [User Profile, Turbo Shot] vIT3_0_29_5.json`
- `Automatic Pro 20g [User Profile / Turbo Shot] vIT3_0_29_5.json`
- `Automatic Pro 20g [Soup] vIT3_0_29_5.json`
- `Automatic Pro 17g Soup vIT3_0_29_5.json`
- `Automatic Pro Soup vIT3_0_29_5.json`
- `Automatic Pro 18g vIT3_0_29_1.json` for legacy untagged main-slot files


`v2`

Format:

- `Automatic Pro v2 <dose>.json`

Examples:

- `Automatic Pro v2 11g.json`
- `Automatic Pro v2 18g.json`
- `Automatic Pro v2 22g.json`



For `v2`, the workflow creates a build named with the current Berlin date, for example `2026-03-26`.

For `vIT3`/`v3`, the build version comes from the filename and partial updates only replace the matching slot.

`[User Profile]` is meant for profiles that differ from the main profile schemas or are small variations of an existing profile or variation.

Additional info inside the brackets is allowed. The workflow extracts the known batch name for sorting and uses the remaining text as the visible variation name after the dose. If no known batch name is found, the remaining text is used as the visible name inside `Experimental and Other`.

Examples:

- `[Step-Down, Direct Lever]` becomes `18g Step-Down` in the `Direct Lever` batch
- `[User Profile, Turbo Shot]` becomes `20g Turbo Shot` in the `User Profile` batch
- `[User Profile / Turbo Shot]` behaves the same way
- `[Soup]` becomes `20g Soup` or `Soup`, depending on whether a dose is present
- `17g Soup` becomes `17g Soup` in `Experimental and Other`
