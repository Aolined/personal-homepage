# Spec: Aolined Personal Scenes

## Objective

Build an original, scene-based personal homepage for Aolined. It should feel like entering a quiet digital room rather than reading a resume, while keeping every claim in the works scene verifiable from this repository.

## Current Experience

The page contains nine ordered scenes:

1. Home
2. About
3. Works
4. AI Hot List
5. Interests
6. Timeline
7. Gallery
8. Notes
9. Contact

The works scene documents this website only. It must not invent other projects, clients, roles, or personal photographs.

## Interaction Contract

- Desktop and tablet use the fixed full scene directory in the header.
- Phones use four stable controls: previous scene, current scene, next scene, and a complete directory dialog.
- The active scene updates both navigation systems and the screen-reader live status.
- Light scenes declare `data-header-tone="light"` so fixed header controls retain contrast.
- Remote scene backgrounds load near the viewport and expose loading or failure states.
- Gallery images use native lazy loading, asynchronous decoding, and a readable failure state.
- Dialogs close with Escape and return focus to their trigger.
- Motion respects `prefers-reduced-motion`.

## AI Hot List Boundary

- `GET /api/hot-search` remains the only browser data endpoint.
- The server normalizes and caches at most ten Hacker News items.
- The browser safely renders the first six valid items with `textContent`.
- Outbound story links are restricted to `https://news.ycombinator.com`.
- Manual refresh uses `/api/hot-search?refresh=1`; automatic refresh remains two minutes.
- Stale data is served after an upstream failure when a previous successful response exists.

## Content And Media

- Scene labels and gallery copy live in `src/content.js`.
- Structural copy and remote image addresses live in `index.html`.
- Unsplash images are visual material, not representations of Aolined or personal photographs.
- Missing personal photos must remain missing; do not generate or imply a likeness.

## Technology

- Semantic HTML5
- Modern CSS
- Vanilla JavaScript modules
- Dependency-free Node.js preview server
- No build or install step

## Commands

```powershell
node scripts/server.mjs --port 4173
node scripts/verify.mjs
node --test scripts/ui-contract.test.mjs
node --test scripts/ai-hot.test.mjs
node --test scripts/server-path.test.mjs
```

## Verification

- Test real Chrome at 320x700, 768x900, 1024x768, and 1440x900.
- Require zero console errors or warnings, zero failed first-party requests, and no document-level horizontal overflow.
- Confirm visible interactive targets are at least 44 by 44 CSS pixels.
- Confirm the mobile directory, previous/next navigation, light header tone, six-item hot list, image loading, and image failure states.

## Boundaries

### Always

- Preserve semantic landmarks, keyboard access, focus visibility, reduced motion, and safe external-data rendering.
- Keep the existing AI endpoint, cache behavior, URL allowlist, request bounds, and path traversal protection.
- Verify automated tests and real browser output before completion.

### Ask First

- Add third-party runtime dependencies, analytics, forms, authentication, storage, or new remote APIs.
- Publish or push the project to an external service.

### Never

- Invent portfolio history or personal photos.
- Commit API keys, tokens, private contact data, or browser credentials.
- Attach testing tools to the owner's personal browser profile.
