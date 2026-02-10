# Figma Connecter CLI Tightening & Refactor Tasks

**Date**: 2026-02-06  
**Goal**: Decompose and track the correctness, hygiene, and refactor improvements for figma-connecter.

---

## Emitter Quality & Determinism

- [x] Normalize label strategy (e.g., `toTitleCase` of prop name) for emitter output.

## Pipeline + CLI Ergonomics

- [x] Add `--continue-on-error` CLI option.
- [x] Plumb `continueOnError` through pipeline to `processComponentBatch`.
- [x] Add `--base-import-path` CLI option.
- [x] Pass base import path to emitters for `@momentum-design/components` overrides.

## Pipeline Context Object

- [ ] Update `src/io/source-loader.ts` to produce and consume context.
- [ ] Add tests verifying context propagation.
