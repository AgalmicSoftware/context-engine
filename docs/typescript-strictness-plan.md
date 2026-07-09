# TypeScript Strictness Migration Plan

This plan describes how to keep moving from the explicit-debt count ratchet
toward smaller compiler-owned areas. The repo already runs `strict` and
`noImplicitAny` globally in `client/tsconfig.json`; the remaining ratchet tracks
explicit escape hatches that the compiler still permits.

## Current Ratchet

`scripts/check-type-debt-ratchet.mjs --list` checked 990 production TS/TSX files
under `client/src` and reported:

| Debt kind | Current baseline |
|---|---:|
| `@ts-nocheck` | 0 |
| `: any` | 936 |
| `as any` | 85 |
| `as unknown as` | 47 |
| `Promise<any>` | 2 |
| `Array<any>` | 0 |
| `Record<...any...>` | 45 |
| `type alias = any` | 3 |
| `Map/Set<...any...>` | 4 |

`scripts/type-debt-baseline.json` also lists `strictDebtFreeDirectories`. Those
directories are compiler-owned for explicit-debt purposes: `type-debt:check`
fails if any production TS/TSX file under the listed directories introduces a
counted marker, even if another file lowers the global count enough to offset it.
After the `aiClient.ts` typed-host rename, `client/src/utilities/ai` is also
strict-listed because its production TypeScript surface has zero counted debt.

Largest current clusters:

| File | Debt |
|---|---:|
| `client/src/components/CommunityTab/CommunityTab.tsx` | `: any=148`, `Record<...any...>=4` |
| `client/src/components/Account/LoginAndSettingsModal.tsx` | `: any=106`, `as any=2` |
| `client/src/components/SurveyTool/SurveyPileViewMode.tsx` | `: any=104`, `as any=1`, `as unknown as=2` |
| `client/src/components/OnePageSession/OnePageSession.tsx` | `: any=103`, `as any=1`, `Record<...any...>=17` |
| `client/src/utilities/web3/contractScripts.sbtRegistryMethods.ts` | `: any=101`, `as any=11` |
| `client/src/utilities/web3/contractScripts.sbtMintMethods.ts` | `: any=65`, `as any=29` |
| `client/src/utilities/web3/contractScripts.impl.ts` | `: any=65`, `as any=6`, `Map/Set<...any...>=2` |
| `client/src/utilities/web3/contractScripts.surveyPayloadReadMethods.ts` | `: any=61`, `as any=5` |
| `client/src/components/Admin/AdminPage.tsx` | `: any=51`, `Record<...any...>=1` |
| `client/src/components/Admin/adminPageMetadataDraftHelpers.ts` | `: any=17` |

## Migration Ladder

1. Keep the count ratchet active and monotonic. Every slice that lowers debt must
   re-bank `scripts/type-debt-baseline.json` in the same commit.
2. Keep `strictDebtFreeDirectories` monotonic. Once a directory is listed, do not
   remove it to land unrelated debt; fix the directory or leave the slice out.
3. Finish domain ports and utility modules first. They have smaller semantic
   surfaces and provide typed boundaries for route/page cleanup.
4. Remove `as unknown as` casts in components with existing controller or planner
   seams, especially SBT and survey support modules.
5. Continue large route/runtime decomposition for `SurveyQuestions.tsx`,
   `contractScripts.impl.ts`, `CommunityTab.tsx`, `LoginAndSettingsModal.tsx`,
   `OnePageSession.tsx`, `AdminPage.tsx`, and `SurveyPileViewMode.tsx`.
6. After a directory has no count-ratchet debt, add it to
   `strictDebtFreeDirectories` and document any framework interop exceptions.
7. Only after the highest-debt runtime owners are below explicit local exception
   lists should the repo consider directory-level `noImplicitAny` or stricter
   compiler options beyond the current global `strict` baseline.

## Exception Policy

Allowed temporary exceptions:

- Untyped third-party interop when no local type is available.
- Test-spy or mock seams where preserving call-time object lookup is required.
- JSON payload boundaries that must validate unknown external data before
  narrowing.

Rules for new exceptions:

- Prefer `unknown` plus a narrow parser over `any`.
- Prefer a named domain type over `Record<string, any>`.
- Keep casts close to the validation or adapter boundary.
- Do not add `@ts-nocheck`.
- Do not introduce new `: any`, `as any`, `as unknown as`, `Promise<any>`,
  broad `Record<...any...>`, bare `type = any`, or `Map`/`Set` `any` debt
  without rebanking and an explicit follow-up.

## Retiring The Count Ratchet

The count ratchet can be replaced by compiler enforcement only when:

- Production `client/src` has no `@ts-nocheck`.
- `: any`, `as any`, `as unknown as`, `Promise<any>`,
  `Record<...any...>`, bare `type = any`, and `Map`/`Set` `any` debt are
  either zero or limited to a short checked exception file.
- Every remaining exception is tied to a boundary parser, third-party interop
  adapter, or test seam.
- Strict debt-free directory checks are green for domains, utilities, and
  component directories before repo-wide exception removal is attempted.
