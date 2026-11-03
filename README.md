# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read `farzad-behzadi-mortgage-website/project/Farzad Dark Site.dc.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `farzad-behzadi-mortgage-website/README.md` — this file
- `farzad-behzadi-mortgage-website/project/` — the `Farzad Behzadi Mortgage Website` project files (HTML prototypes, assets, components)


## Client reviews carousel

`reviews.json` is the shared content source for the manual testimonial carousel. Add only approved quotes and accurate author attribution. Each item accepts `author`, `quote`, and optional `rating` (integer 1–5), `source` (`Google` for actual Google reviews), and `url` (HTTPS link to the original review). `googleReviewsUrl` optionally links to the business's Google review page. This is curated content; it does not automatically sync with Google.

The initial content contains five short excerpts from the Google listing supplied by the client, verified on 26 October 2026. Each quote links to its individual original review. `excerpt: true` labels shortened reviews. Review counts and aggregate ratings are not cached or displayed. When no reviews are configured, clearly labeled design placeholders appear on localhost only. The section stays hidden elsewhere, including if the content request fails. No ratings or reviewer names are fabricated. The carousel supports touch scrolling, previous/next buttons, arrow keys, Home/End, and reduced motion. It does not auto-rotate.

### Carousel browser checks

Start the static site locally, then run `npm install --prefix tests` and `npx --prefix tests playwright install chromium`. Run `npm test --prefix tests` for the light site, or `SITE_URL=http://127.0.0.1:8767 npm test --prefix tests` for the dark site. `BROWSER_EXECUTABLE` can select an existing Chrome executable. Tests use fixture reviews and never submit enquiries or contact the review service.
