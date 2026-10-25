# Render deployment fixes

## Changes in this patch
- Added `.js` extensions to the ESLint flat-config imports to avoid Node ESM resolution errors.
- Moved the Telegram Web App script out of a manually-authored `<head>` and into the root layout body using `next/script`.
- Added an App Router `src/app/not-found.tsx` page.
- Pinned the deployment runtime to Node.js 22 via `.nvmrc` and `package.json` engines.

## Before redeploying
1. In Render, open the service's Environment settings.
2. Remove any custom `NODE_ENV` value unless it is exactly `production`. Do not set it to values such as `prod`, `development-production`, or `staging`.
3. Confirm the service root directory points to the directory containing `package.json`.
4. Commit and push these changes, then trigger a **Clear build cache & deploy**.

## If the `<Html> should not be imported outside of pages/_document` error remains
The uploaded source archive contains no `next/document` import, no `<Html>` usage from `next/document`, and no `pages/` directory. That means the exact source of this error is not present in this archive. Check that Render deploys the same commit and root directory as the uploaded project, and inspect any other files in the actual GitHub commit for `next/document`, `next/head`, or a `pages/` directory.
