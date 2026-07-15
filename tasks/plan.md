# Implementation Plan

1. Add failing UI contract tests for the requested behavior.
2. Add a ninth works scene containing only repository-verifiable content.
3. Add light-scene header tone and a four-control mobile navigator with a complete directory.
4. Move remote scene backgrounds to viewport-aware loading and add gallery/background failure states.
5. Reduce interest-scene headline scale and whitespace; limit browser hot-list rendering to six items.
6. Preserve and run the AI service and static-path security tests.
7. Verify layout, interaction, errors, network behavior, and target sizes in real Chrome at four widths.
8. Start the persistent local preview server on port 4173.

## Risk Controls

- Portfolio truthfulness: document only this homepage in the works scene.
- Media identity: keep Unsplash imagery clearly contextual and never present it as a personal photo.
- AI regression: change only the browser display limit; retain server normalization, ten-item cap, cache, refresh, and link allowlist.
- Mobile density: use a dedicated bottom navigator instead of shrinking nine directory links.
- Remote failures: remove busy state after failure and provide a local visual fallback.
