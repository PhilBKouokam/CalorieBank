# CalorieBank

CalorieBank is moving from a web prototype into an iPhone-first mobile V1. The current source of truth is:

- `docs/architecture/current-state-audit.md`
- `docs/product/v1-prd.md`

## Repository Structure

```text
apps/
  mobile/          Expo React Native app with Expo Router and TypeScript
packages/
  domain/          Shared calorie-bank domain logic
  schemas/         Shared validation schemas and API DTOs
  config/          Shared TypeScript/tooling configuration
legacy/
  web-frontend/    Preserved Vite/React prototype
  mongo-api/       Preserved Express/Mongoose prototype
docs/              Product and architecture documentation
screenshots/       Existing prototype screenshots
```

## Current Foundation Scope

This branch establishes the monorepo and mobile shell only. It intentionally does not implement authentication, food logging, database persistence, Apple Health, USDA lookup, or ledger finalization yet.

## Requirements

- Node.js 20.19 or newer
- npm
- Expo Go for quick device testing

## Install

From the repository root:

```bash
npm install
```

## Run Mobile

```bash
npm run mobile:start
```

Then open the project in Expo Go or use the iOS/Android commands when the local environment supports them.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
```

`npm run test` currently runs only workspaces that define a test script.

## Legacy Prototype

The existing web frontend and Mongo API were moved under `legacy/` unchanged so the prototype remains available as reference while mobile V1 is built in `apps/` and `packages/`.
