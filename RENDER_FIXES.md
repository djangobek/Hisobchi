# Render deploy fixes

This patch fixes the ESLint flat-config compatibility issue (`nextVitals is not iterable`) by adapting Next.js legacy configs with `FlatCompat`, and fixes the grammY `language_code` TypeScript inference by preserving the `"ru"` literal type.

## Render settings
- Build command: `npm ci && npx prisma generate && npm run build`
- Start command: `npm start` (if deploying the Next.js web service)
- Set `NODE_ENV=production` in Render Environment. Remove any non-standard value such as `development-local`.
- Ensure all required environment variables are configured in Render.

After committing these changes, push to GitHub and run **Clear build cache & deploy**.
