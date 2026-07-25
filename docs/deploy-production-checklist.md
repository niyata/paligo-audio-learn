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

2. Run the offline production hardening gate:

   ```bash
   node scripts/run-production-hardening.mjs
   ```

   The runner includes `git diff --check`, critical JS syntax checks, backend
   app-state/error contracts, PiP Pali glyph normalization, and the pre-launch
   privacy/deploy-discipline gate.

   It also verifies that `git-lfs` is available when the local repo is
   configured with Git LFS hooks. Missing Git LFS blocks normal pushes on this
   repo and must be fixed before a production-candidate deploy. Use
   `PALIGO_ALLOW_MISSING_GIT_LFS=1` only as a documented emergency bypass for a
   code-only push that does not touch LFS-managed media.

3. Critical visual smoke, before a UI release candidate:

   ```bash
   python3 -m http.server 8765
   PALIGO_RUN_VISUAL_AUDIT=1 node scripts/run-production-hardening.mjs
   ```

4. PR automation:

   ```bash
   # Runs automatically on pull requests that touch production-critical files.
   .github/workflows/production-hardening.yml
   ```

5. Live API readiness, before promoting a branch to `app.paligo.jp`:

   ```bash
   PALIGO_RUN_LIVE_API_AUDIT=1 node scripts/run-production-hardening.mjs
   ```

   Optional login contract checks can be enabled without storing secrets in git:

   ```bash
   PALIGO_LIVE_STUDENT_EMAIL="tha.std@paligo.jp" \
   PALIGO_LIVE_STUDENT_PIN="147258" \
   PALIGO_LIVE_REVIEWER_EMAIL="1.tha.tc@paligo.jp" \
   PALIGO_LIVE_REVIEWER_PIN="147258" \
   PALIGO_RUN_LIVE_API_AUDIT=1 node scripts/run-production-hardening.mjs
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

Do not bypass Git LFS hooks for production media changes. A code-only bypass is
acceptable only when documented and followed by a proper Git LFS fix.
