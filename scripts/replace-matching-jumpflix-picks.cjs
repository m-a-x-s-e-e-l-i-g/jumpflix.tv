const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const blogDir = path.join(process.cwd(), "blog");

const mappings = {
  "best-parkour-movies-films-and-documentaries-for-beginners.md": [
    "- [People in Motion](/movie/people-in-motion-2012): Beginner-friendly documentary pacing with clear movement context.",
    "- [Jump London](/movie/jump-london-2003): Foundational watch for understanding parkour roots and culture.",
    "- [Bound By Movement](/movie/bound-by-movement-2019): Modern long-form documentary that balances inspiration and realism."
  ],
  "best-parkour-videos-to-watch-tonight.md": [
    "- [Enter the Breach](/movie/enter-the-breach-2021): Strong anchor film to start a full watch session.",
    "- [Amsterdam Is Dead](/movie/amsterdam-is-dead-2024): Contemporary style and energy for your second slot.",
    "- [S.O.L](/movie/s-o-l-2022): Long-form team project to close with depth and momentum."
  ],
  "competition-run-building-playbook-from-concept-to-finals-ready-line.md": [
    "- [CAPSTONE VERKY](/movie/capstone-verky-2025): High-level example of structured risk and controlled commitment.",
    "- [CAPSTONE // SWARM](/movie/capstone-swarm-2022): Useful for studying run architecture and section planning.",
    "- [Louvain-la-Neuve | Parkour as fast as you can!](/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018): Fast short-form reference for transition pacing."
  ],
  "competitive-parkour-training-plan-for-freerunning-season.md": [
    "- [Sport Parkour League](/series/sport-parkour-league): Event-context footage for season planning and format awareness.",
    "- [CAPSTONE // OATH](/movie/capstone-oath-2024): Benchmark run intensity for peak-phase prep.",
    "- [The Progression Series](/series/the-progression-series-2010): Long-view progression logic that supports periodized training."
  ],
  "creative-urban-freerun-lines-raw-footage-and-technical-breakdowns.md": [
    "- [MAUERFALL | A Berlin Parkour Film](/movie/mauerfall-a-berlin-parkour-film-2023): Dense urban line creativity with readable decisions.",
    "- [Skull Chatter](/movie/skull-chatter-2020): Technical line detail ideal for breakdown-based analysis.",
    "- [Tether](/movie/tether-2023): Compact conceptual piece for studying transition logic."
  ],
  "evolution-of-parkour-from-foundations-to-modern-flow.md": [
    "- [Speed Air Man](/movie/speed-air-man-1997): Earliest-era reference for foundational movement language.",
    "- [Jump London](/movie/jump-london-2003): Historic documentary bridge from roots to wider culture.",
    "- [Enter the Breach](/movie/enter-the-breach-2021): Modern counterpart showing current flow and style evolution."
  ],
  "fast-flow-vs-technical-scoring-in-parkour-competitions.md": [
    "- [Louvain-la-Neuve | Parkour as fast as you can!](/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018): Pure speed-flow sample for continuity scoring.",
    "- [CAPSTONE VERKY](/movie/capstone-verky-2025): Technical density reference for high-difficulty sections.",
    "- [Ultimate Tag](/series/ultimate-tag-2020): Format-based contrast on pace, consistency, and execution."
  ],
  "fear-to-flow-parkour-progression-without-fake-bravery.md": [
    "- [Our relationship with fear](/movie/our-relationship-with-fear-sebastien-foucan-at-tedxealing-2012): Direct mental framing from a foundational voice.",
    "- [Controlled Descent](/movie/controlled-descent-2021): Process-focused movement that rewards calm choices.",
    "- [Imagination Is Everything](/movie/imagination-is-everything-2011): Short mindset reset before high-pressure sessions."
  ],
  "freerunning-contests-europe-highlights-what-winners-are-doing-2026.md": [
    "- [Sport Parkour League](/series/sport-parkour-league): Competition format reference for tactical benchmarking.",
    "- [CAPSTONE // OATH](/movie/capstone-oath-2024): Modern high-conversion run example.",
    "- [Civilisation](/movie/civilisation-2023): Europe scene depth with strong pace-and-composition signal."
  ],
  "how-judges-score-parkour-comps-and-freerunning-contests.md": [
    "- [Sport Parkour League](/series/sport-parkour-league): Best baseline for judging categories in action.",
    "- [Ultimate Tag](/series/ultimate-tag-2020): Contrast format for consistency and execution scoring behavior.",
    "- [CAPSTONE // SWARM](/movie/capstone-swarm-2022): Difficulty-vs-cleanliness tradeoffs in one run package."
  ],
  "how-to-start-parkour-safely-as-a-kid.md": [
    "- [The Progression Series](/series/the-progression-series-2010): Scalable progression cues for younger beginners.",
    "- [People in Motion](/movie/people-in-motion-2012): Friendly long-form context without stunt-only pressure.",
    "- [Imagination Is Everything](/movie/imagination-is-everything-2011): Positive mindset framing for safe early development."
  ],
  "how-to-win-parkour-comps-score-strategy-recovery-and-reputation.md": [
    "- [CAPSTONE // SWARM](/movie/capstone-swarm-2022): Strong model for balancing risk, score value, and control.",
    "- [CAPSTONE VERKY](/movie/capstone-verky-2025): Useful benchmark for high-level execution standards.",
    "- [Enter the Breach](/movie/enter-the-breach-2021): Long-form context on composure and consistency."
  ],
  "new-parkour-films-2026-for-experienced-traceurs.md": [
    "- [THE MANPOWER STICK](/movie/the-manpower-stick-2026): Fresh 2026 technical documentary with clear intent.",
    "- [Capstone Verky BTS](/movie/capstone-verky-bts-2026): Behind-the-scenes context for current production methods.",
    "- [BOOGIE VIDEOEN](/movie/boogie-videoen-2025): Contemporary scene energy with strong movement signal."
  ],
  "oldschool-parkour-crews-videos-and-philosophy-documentaries.md": [
    "- [OUT OF TIME](/movie/out-of-time-2009): Raw oldschool crew reference with high line literacy.",
    "- [Jump London](/movie/jump-london-2003): Core cultural documentary from the formative era.",
    "- [The Monkey's Back / Le Singe est de Retour](/movie/the-monkeys-back-le-singe-est-de-retour-2006): Early philosophy-focused documentary perspective."
  ],
  "parkour-athlete-motivation-edits-that-make-you-train.md": [
    "- [One Last Run](/movie/one-last-run-2025): Immediate train-now motivation with clean movement signal.",
    "- [state Of miNd](/movie/state-of-mind-2023): Style-driven focus and discipline framing.",
    "- [BOOGIE VIDEOEN](/movie/boogie-videoen-2025): High-energy short-form piece that still shows real output."
  ],
  "parkour-challenge-videos-that-build-real-skill.md": [
    "- [Ultimate Tag](/series/ultimate-tag-2020): Constraint-based challenge format with measurable outcomes.",
    "- [Louvain-la-Neuve | Parkour as fast as you can!](/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018): Compact speed challenge reference for repeatability.",
    "- [CAVEMEN](/series/storror-cavemen): Team challenge energy with practical route adaptation."
  ],
  "parkour-competitions-2026-schedule-and-qualification-guide.md": [
    "- [Sport Parkour League](/series/sport-parkour-league): Ongoing format signal for season scheduling decisions.",
    "- [CAPSTONE // OATH](/movie/capstone-oath-2024): Current benchmark for expected competition quality.",
    "- [Ultimate Tag](/series/ultimate-tag-2020): Useful format contrast when planning event fit."
  ],
  "parkour-fails-safety-breakdowns-you-can-learn-from.md": [
    "- [Controlled Descent](/movie/controlled-descent-2021): Reinforces control-first movement under consequence.",
    "- [The Progression Series](/series/the-progression-series-2010): Technique-first progression model to reduce avoidable errors.",
    "- [Our relationship with fear](/movie/our-relationship-with-fear-sebastien-foucan-at-tedxealing-2012): Mental framework for safer commitment decisions."
  ],
  "parkour-performance-mindset-under-competition-pressure.md": [
    "- [Our relationship with fear](/movie/our-relationship-with-fear-sebastien-foucan-at-tedxealing-2012): Direct pressure-management framing.",
    "- [Enter the Breach](/movie/enter-the-breach-2021): Composure and execution under high expectation.",
    "- [Imagination Is Everything](/movie/imagination-is-everything-2011): Fast pre-session mindset reset."
  ],
  "parkour-progression-videos-beginner-to-confident.md": [
    "- [The Progression Series](/series/the-progression-series-2010): Best progression-first backbone for new athletes.",
    "- [People in Motion](/movie/people-in-motion-2012): Solid movement context and fundamentals in long form.",
    "- [Parkour, imaginatively.](/movie/parkour-imaginatively-2013): Clear technical cues with readable line design."
  ],
  "parkour-spot-discovery-street-rooftop-urbex-watch-guide.md": [
    "- [STORROR Rooftop POV's & Escapes](/series/storror-rooftop-povs-escapes-2016): Strong rooftop route-reading reference.",
    "- [Holi Shit](/movie/holi-shit-2013): Urbex environment adaptation in compact form.",
    "- [Traceurs Des Arbres](/movie/traceurs-des-arbres-2025): Nature-focused movement scouting reference."
  ],
  "pov-parkour-videos-how-to-read-lines-like-a-traceur.md": [
    "- [STORROR Rooftop POV's & Escapes](/series/storror-rooftop-povs-escapes-2016): Primary POV source for line-reading practice.",
    "- [CAVEMEN](/series/storror-cavemen): Supplemental perspective for commitment and spatial choices.",
    "- [Louvain-la-Neuve | Parkour as fast as you can!](/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018): Speed timing study in short form."
  ],
  "precision-jump-plateau-longevity-recovery-and-flow-state-training.md": [
    "- [Controlled Descent](/movie/controlled-descent-2021): Precision control and landing economy reference.",
    "- [One Last Run](/movie/one-last-run-2025): Good model for intensity with technical consistency.",
    "- [The Progression Series](/series/the-progression-series-2010): Long-term progression framing for plateau phases."
  ],
  "real-parkour-vs-fake-parkour-for-beginners.md": [
    "- [People in Motion](/movie/people-in-motion-2012): Real training culture with minimal gimmick framing.",
    "- [The Progression Series](/series/the-progression-series-2010): Process-driven movement that contrasts with stunt edits.",
    "- [Jump London](/movie/jump-london-2003): Foundational real-world context for beginner media literacy."
  ],
  "top-parkour-athlete-rankings-how-to-track-results-and-climb.md": [
    "- [Sport Parkour League](/series/sport-parkour-league): Competition footage suitable for trend tracking.",
    "- [CAPSTONE VERKY](/movie/capstone-verky-2025): Elite benchmark for run quality comparison.",
    "- [Ultimate Tag](/series/ultimate-tag-2020): Useful format contrast for consistency and pressure handling."
  ],
  "viral-parkour-tricks-urbex-edits-and-what-to-watch-next.md": [
    "- [District B13](/movie/district-b13-2004): Viral gateway classic with historical context.",
    "- [STORROR Rooftop POV's & Escapes](/series/storror-rooftop-povs-escapes-2016): High-click rooftop format that converts to deeper watching.",
    "- [Holi Shit](/movie/holi-shit-2013): Urbex-style bridge from trend clips to full sessions."
  ],
  "wall-run-kong-precision-videos-that-actually-help.md": [
    "- [The Progression Series](/series/the-progression-series-2010): Move-by-move progression references for core skills.",
    "- [Parkour, imaginatively.](/movie/parkour-imaginatively-2013): Clean line readability for takeoff and landing rhythm.",
    "- [Controlled Descent](/movie/controlled-descent-2021): Precision and control cues that transfer to drills."
  ],
  "what-makes-a-winning-parkour-competition-run.md": [
    "- [CAPSTONE // SWARM](/movie/capstone-swarm-2022): Strong run architecture with high-value sections.",
    "- [CAPSTONE VERKY](/movie/capstone-verky-2025): Balanced difficulty and execution under pressure.",
    "- [Sport Parkour League](/series/sport-parkour-league): Event-format examples for scoring pillar analysis."
  ]
};

const heading = "## Matching JumpFlix Picks";
const updated = [];
const missing = [];

for (const [file, bullets] of Object.entries(mappings)) {
  const fullPath = path.join(blogDir, file);
  if (!fs.existsSync(fullPath)) {
    missing.push(file);
    continue;
  }

  const original = fs.readFileSync(fullPath, "utf8");
  const marker = /^##\s+Matching JumpFlix Picks\s*$/im;
  const match = marker.exec(original);
  let before = match ? original.slice(0, match.index) : original;
  before = before.replace(/[\s\uFEFF]*$/u, "");

  const section = `${heading}\n\n${bullets.join("\n")}`;
  const next = before.length ? `${before}\n\n${section}\n` : `${section}\n`;

  fs.writeFileSync(fullPath, next, "utf8");
  updated.push(file);
}

const titleCounts = new Map();
for (const bullets of Object.values(mappings)) {
  for (const line of bullets) {
    const m = line.match(/\[([^\]]+)\]\(/);
    if (m) {
      const title = m[1].trim();
      titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
    }
  }
}
const repeats = [...titleCounts.entries()]
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

console.log(`Updated files (${updated.length}):`);
for (const f of updated) console.log(`  ${f}`);
if (missing.length) {
  console.log(`Missing files (${missing.length}):`);
  for (const f of missing) console.log(`  ${f}`);
}

console.log("Top repeated pick titles with counts:");
if (!repeats.length) {
  console.log("  (none)");
} else {
  for (const [title, count] of repeats) {
    console.log(`  ${count}  ${title}`);
  }
}

console.log("git diff --stat -- blog:");
try {
  const stat = execSync("git diff --stat -- blog", { encoding: "utf8" });
  process.stdout.write(stat || "  (no diff)\n");
} catch (err) {
  process.stdout.write((err.stdout && String(err.stdout)) || "  (unable to read diff stat)\n");
}
