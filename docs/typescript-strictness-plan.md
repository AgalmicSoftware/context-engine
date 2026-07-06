# TypeScript Strictness Migration Plan

This plan describes how to move from the current count-ratchet regime toward
compiler enforcement. It does not change `tsconfig` settings.

## Current Ratchet

`scripts/check-type-debt-ratchet.mjs --list` checked 862 production TS/TSX files
under `client/src` and reported:

| Debt kind | Current baseline |
|---|---:|
| `@ts-nocheck` | 0 |
| `: any` | 2,630 |
| `as any` | 209 |
| `as unknown as` | 60 |
| `Promise<any>` | 2 |
| `Array<any>` | 0 |
| `Record<...any...>` | 48 |

Largest current clusters:

| File | Debt |
|---|---:|
| `client/src/components/SurveyTool/SurveyQuestions.tsx` | `: any=1472`, `as any=116` |
| `client/src/utilities/web3/contractScripts.impl.ts` | `: any=450`, `as any=66` |
| `client/src/components/CommunityTab/CommunityTab.tsx` | `: any=148`, `Record<...any...>=4` |
| `client/src/components/Account/LoginAndSettingsModal.tsx` | `: any=130`, `as any=6` |
| `client/src/components/OnePageSession/OnePageSession.tsx` | `: any=111`, `as any=1`, `Record<...any...>=17` |
| `client/src/components/Admin/AdminPage.tsx` | `: any=105`, `Record<...any...>=1` |
| `client/src/components/SurveyTool/SurveyPileViewMode.tsx` | `: any=104`, `as any=1`, `as unknown as=2` |

## Migration Ladder

1. Keep the count ratchet active and monotonic. Every slice that lowers debt must
   re-bank `scripts/type-debt-baseline.json` in the same commit.
2. Finish domain ports and utility modules first. They have smaller semantic
   surfaces and provide typed boundaries for route/page cleanup.
3. Remove `as unknown as` casts in components with existing controller or planner
   seams, especially SBT and survey support modules.
4. Continue large route/runtime decomposition for `SurveyQuestions.tsx`,
   `contractScripts.impl.ts`, `CommunityTab.tsx`, `LoginAndSettingsModal.tsx`,
   `OnePageSession.tsx`, `AdminPage.tsx`, and `SurveyPileViewMode.tsx`.
5. After a directory has no count-ratchet debt, enable a local compiler or lint
   dry run for that directory and document any framework interop exceptions.
6. Only after the highest-debt runtime owners are below explicit local exception
   lists should the repo consider directory-level `noImplicitAny` or stricter
   compiler options.

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
- Do not introduce new `: any`, `as any`, `as unknown as`, `Promise<any>`, or
  broad `Record<...any...>` debt without rebanking and an explicit follow-up.

## Retiring The Count Ratchet

The count ratchet can be replaced by compiler enforcement only when:

- Production `client/src` has no `@ts-nocheck`.
- `: any`, `as any`, `as unknown as`, `Promise<any>`, and
  `Record<...any...>` are either zero or limited to a short checked exception
  file.
- Every remaining exception is tied to a boundary parser, third-party interop
  adapter, or test seam.
- Directory-level `noImplicitAny` dry runs are green for domains, utilities,
  and component directories before repo-wide strictness is attempted.
