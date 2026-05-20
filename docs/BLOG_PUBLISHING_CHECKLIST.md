# JumpFlix Blog Publishing Checklist

This checklist is built for **watch intent** SEO, not filler content.

Use it every time you publish a new file in `/blog/*.md`.

## 1) Intent Gate (before writing)

- [ ] Primary query has clear watch intent (example: `parkour tutorial`, `parkour pov`, `parkour fails`, `best parkour videos`)
- [ ] Article angle answers: "what should I watch next on JumpFlix?"
- [ ] Topic maps to one of the platform discovery lenses:
  - [ ] Tutorials / Educational
  - [ ] Best videos / Compilations
  - [ ] Move-specific
  - [ ] Spot/location
  - [ ] Fear/progression
  - [ ] Challenges
  - [ ] POV
  - [ ] Athlete inspiration
  - [ ] Fails/safety
  - [ ] Motivation
  - [ ] Viral/stunt + urbex overlap

## 2) Frontmatter Validation

Required/strongly recommended fields for the current blog engine:

- [ ] `title`
- [ ] `description`
- [ ] `date`
- [ ] `updated`
- [ ] `slug` (optional but recommended for control)
- [ ] `category`
- [ ] `tags` (3-6)
- [ ] `keywords` (4-8)
- [ ] `author`
- [ ] `coverImage`
- [ ] `ctaLabel`
- [ ] `ctaHref`
- [ ] `faq` (3-5 practical Q/A)

Practical quality checks:

- [ ] Title ~50-65 characters and includes main intent phrase naturally
- [ ] Description ~140-160 characters and promises watch outcome
- [ ] Slug is short, lowercase, and search-readable

## 3) On-Page SEO + LLM Readability

- [ ] One clear H1
- [ ] H2/H3 structure answers user questions quickly
- [ ] First 150 words includes direct answer and watch context
- [ ] Includes one short "what to do now" section near top
- [ ] Includes at least one list/table for snippet eligibility
- [ ] Avoids filler paragraphs and vague motivational fluff

LLM/AI answer optimization:

- [ ] Includes explicit definitions ("what is X", "why X matters")
- [ ] Includes concise procedural blocks (steps/checklists)
- [ ] FAQ answers are direct, concrete, and 1-4 sentences

## 4) Watch-Conversion Requirements

- [ ] At least 3 internal JumpFlix deep links to real watch intent searches (`/?q=`)
- [ ] At least 1 strong CTA section near bottom
- [ ] CTA ties to article intent (not generic "browse catalog")
- [ ] At least 2-3 `video-placeholder` blocks showing what kind of videos to embed

Good CTA examples:

- "Watch beginner-friendly progression videos on JumpFlix"
- "Open a ready-to-watch POV queue on JumpFlix"
- "Watch fail breakdown + safety progression videos on JumpFlix"

## 5) Internal Linking Rules

- [ ] Link to 3-5 relevant blog posts
- [ ] Link to 2-4 JumpFlix search/deep links
- [ ] Include at least one link to a complementary cluster (example: tutorial -> fails/safety)
- [ ] No orphaned article: every new post should receive links from at least 2 existing posts

Recommended anchor style:

- Use descriptive anchors ("POV line-reading guide", "fails safety breakdown")
- Avoid repeated exact-match anchors everywhere

## 6) Schema Suggestions Section (in article body)

- [ ] Include a "Schema suggestions" section in each post
- [ ] Default: `Article` + `FAQPage`
- [ ] Add `HowTo` for procedural guides
- [ ] Add `ItemList` for ranked lists/watch stacks

Note:
The route renderer already outputs JSON-LD for `Article` and optional `FAQPage` using frontmatter-backed content.

## 7) Culture and Editorial Tone Gate

- [ ] Writing matches parkour/freerunning culture (practical, community-aware)
- [ ] No generic "AI SEO" voice
- [ ] Safety and progression framing is responsible (no reckless encouragement)
- [ ] Emphasis on long-form context and preservation, not short-form dopamine loops

## 8) Technical Publish QA

After adding or updating markdown files:

- [ ] `npm run check --silent`
- [ ] Open `/blog` and verify card rendering
- [ ] Open `/blog/[slug]` and verify metadata in head
- [ ] Open `/blog/tag/[tag]` and verify tag routing
- [ ] Open `/blog/rss.xml` and verify latest item exists
- [ ] Open `/sitemap.xml` and verify blog URL appears

## 9) Post-Publish Indexing + Monitoring

- [ ] Confirm sitemap contains new URL
- [ ] Submit sitemap (automatic on build or manual submit script)
- [ ] Track Search Console for:
  - [ ] Query impressions for target phrase family
  - [ ] CTR by article
  - [ ] Indexing status
- [ ] Track behavior KPI in analytics:
  - [ ] Avg engagement time
  - [ ] Scroll depth
  - [ ] CTR to JumpFlix watch links

## 10) 7-Day Optimization Loop (per post)

Day 1-2:

- [ ] Improve title if CTR underperforms
- [ ] Strengthen intro answer block

Day 3-4:

- [ ] Add 2-3 contextual internal links from newer/older posts
- [ ] Add one additional FAQ if query coverage gap appears

Day 5-7:

- [ ] Expand one section with real watch-path examples
- [ ] Tighten CTA copy based on click behavior

## Quick Publish Command Flow

1. Add markdown file in `/blog/`
2. Run `npm run check --silent`
3. Verify `/blog`, `/blog/rss.xml`, `/sitemap.xml`
4. Build/deploy
5. Monitor queries + improve within 7 days
