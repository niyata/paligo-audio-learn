# Paligo Production Candidate Deploy Checklist

Status: pre-launch checklist

Use this before pushing or deploying a production candidate branch for
`app.paligo.jp` / `paligo.pages.dev`.

## Required Checks

1. Review dirty tree:

   ```bash
   git status --short --branch
   ```

   Do not stage unrelated audit screenshots, local media, or another agent's
   dirty files.

2. Whitespace check for touched files:

   ```bash
   git diff --check -- <files>
   ```

3. Syntax checks for touched JavaScript:

   ```bash
   node --check <file.js>
   ```

4. Backend and app-state contract checks:

   ```bash
   node scripts/test-production-contracts.mjs
   ```

5. Critical visual smoke:

   ```bash
   python3 -m http.server 8765
   node scripts/audit-production-critical-pages.mjs
   ```

6. Pre-launch privacy gate:

   ```bash
   node scripts/check-deploy-discipline.mjs
   ```

7. PR automation:

   ```bash
   # Runs automatically on pull requests that touch production-critical files.
   .github/workflows/production-hardening.yml
   ```

8. Live API readiness, before promoting a branch to `app.paligo.jp`:

   ```bash
   node scripts/audit-live-api-readiness.mjs
   ```

   Optional login contract checks can be enabled without storing secrets in git:

   ```bash
   PALIGO_LIVE_STUDENT_EMAIL="tha.std@paligo.jp" \
   PALIGO_LIVE_STUDENT_PIN="147258" \
   PALIGO_LIVE_REVIEWER_EMAIL="1.tha.tc@paligo.jp" \
   PALIGO_LIVE_REVIEWER_PIN="147258" \
   node scripts/audit-live-api-readiness.mjs
   ```

## Privacy Rule

Until the PO explicitly opens public indexing:

- `robots.txt` must disallow crawlers.
- `_headers` must send `X-Robots-Tag: noindex,nofollow`.
- `crawlerIndexingAllowed=false` remains the default in platform flags.

When the Super Admin switch is intentionally opened for launch, Integrator must
ship the matching `robots.txt` and `_headers` change in the same release note.

## Artifact Rule

The visual audit writes to `docs/audit/production-critical-pages/`.
That directory is ignored by git. Commit those screenshots only when the PO asks
for an evidence bundle.
