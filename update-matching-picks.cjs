const fs = require("fs");
const path = require("path");

const blogDir = path.join(process.cwd(), "blog");
const heading = "## Matching JumpFlix Picks";

const mapping = {
  "best-parkour-movies-films-and-documentaries-for-beginners.md": [
    { title: "Jump London", path: "/movie/jump-london-2003", reason: "Classic entry point with clear movement roots and documentary context." },
    { title: "People in Motion", path: "/movie/people-in-motion-2012", reason: "Beginner-friendly documentary pacing with real athlete perspectives." },
    { title: "Bound By Movement", path: "/movie/bound-by-movement-2019", reason: "Long-form modern documentary that balances inspiration and real training culture." }
  ],
  "best-parkour-videos-to-watch-tonight.md": [
    { title: "Enter the Breach", path: "/movie/enter-the-breach-2021", reason: "Strong anchor film for a full watch session." },
    { title: "S.O.L", path: "/movie/s-o-l-2022", reason: "Long-form project with team energy and narrative momentum." },
    { title: "Amsterdam Is Dead", path: "/movie/amsterdam-is-dead-2024", reason: "High-retention modern film for a contemporary style block." }
  ],
  "competition-run-building-playbook-from-concept-to-finals-ready-line.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Useful for studying format-driven run composition and judge conversion." },
    { title: "CAPSTONE VERKY", path: "/movie/capstone-verky-2025", reason: "Great reference for sequencing risk and commitment in one line." },
    { title: "Louvain-la-Neuve | Parkour as fast as you can!", path: "/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018", reason: "Short speed-focused run to analyze transitions and pacing." }
  ],
  "competitive-parkour-training-plan-for-freerunning-season.md": [
    { title: "The Progression Series", path: "/series/the-progression-series-2010", reason: "Shows staged progression and repeatable training logic." },
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Competition context for periodized prep decisions." },
    { title: "CAPSTONE // SWARM", path: "/movie/capstone-swarm-2022", reason: "High-level benchmark for peak-phase intensity and execution." }
  ],
  "creative-urban-freerun-lines-raw-footage-and-technical-breakdowns.md": [
    { title: "Skull Chatter", path: "/movie/skull-chatter-2020", reason: "Technical urban line detail with readable movement choices." },
    { title: "MAUERFALL | A Berlin Parkour Film", path: "/movie/mauerfall-a-berlin-parkour-film-2023", reason: "Modern urban creativity with dense line problem-solving." },
    { title: "Tether", path: "/movie/tether-2023", reason: "Compact conceptual piece for studying transition logic." }
  ],
  "evolution-of-parkour-from-foundations-to-modern-flow.md": [
    { title: "Speed Air Man", path: "/movie/speed-air-man-1997", reason: "Foundational oldschool reference from the earliest era." },
    { title: "Jump London", path: "/movie/jump-london-2003", reason: "Historic documentary milestone for philosophy and movement roots." },
    { title: "Enter the Breach", path: "/movie/enter-the-breach-2021", reason: "Modern long-form counterpoint for current movement language." }
  ],
  "fast-flow-vs-technical-scoring-in-parkour-competitions.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Direct competition footage for flow vs precision tradeoffs." },
    { title: "CAPSTONE VERKY", path: "/movie/capstone-verky-2025", reason: "Technical density and execution pressure in one package." },
    { title: "Louvain-la-Neuve | Parkour as fast as you can!", path: "/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018", reason: "Pure pace and continuity study in short form." }
  ],
  "fear-to-flow-parkour-progression-without-fake-bravery.md": [
    { title: "Our relationship with fear", path: "/movie/our-relationship-with-fear-sebastien-foucan-at-tedxealing-2012", reason: "Direct fear framing from an oldschool voice." },
    { title: "Imagination Is Everything", path: "/movie/imagination-is-everything-2011", reason: "Mindset-first piece for reframing pressure and confidence." },
    { title: "Controlled Descent", path: "/movie/controlled-descent-2021", reason: "Process-oriented movement that rewards calm decision making." }
  ],
  "freerunning-contests-europe-highlights-what-winners-are-doing-2026.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Good benchmark for competition structure and judging behavior." },
    { title: "CAPSTONE // OATH", path: "/movie/capstone-oath-2024", reason: "High-conversion run construction under pressure." },
    { title: "CAPSTONE // SWARM", path: "/movie/capstone-swarm-2022", reason: "Useful for comparing aggressive versus controlled risk." }
  ],
  "how-judges-score-parkour-comps-and-freerunning-contests.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Clear event context for score-category breakdowns." },
    { title: "Ultimate Tag", path: "/series/ultimate-tag-2020", reason: "Useful contrast on speed, consistency, and execution under format rules." },
    { title: "CAPSTONE VERKY", path: "/movie/capstone-verky-2025", reason: "Helps analyze difficulty versus execution tradeoffs." }
  ],
  "how-to-start-parkour-safely-as-a-kid.md": [
    { title: "People in Motion", path: "/movie/people-in-motion-2012", reason: "Accessible long-form intro to real parkour culture." },
    { title: "The Progression Series", path: "/series/the-progression-series-2010", reason: "Progression-focused sessions that emphasize fundamentals." },
    { title: "Imagination Is Everything", path: "/movie/imagination-is-everything-2011", reason: "Positive mindset framing without stunt-only pressure." }
  ],
  "how-to-win-parkour-comps-score-strategy-recovery-and-reputation.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Event footage for score-strategy pattern spotting." },
    { title: "CAPSTONE // SWARM", path: "/movie/capstone-swarm-2022", reason: "Great for risk management and compositional structure." },
    { title: "Enter the Breach", path: "/movie/enter-the-breach-2021", reason: "Long-form context on execution quality under pressure." }
  ],
  "new-parkour-films-2026-for-experienced-traceurs.md": [
    { title: "THE MANPOWER STICK", path: "/movie/the-manpower-stick-2026", reason: "Fresh technical documentary with clear movement intent." },
    { title: "Capstone Verky BTS", path: "/movie/capstone-verky-bts-2026", reason: "Behind-the-scenes context for modern high-level projects." },
    { title: "BOOGIE VIDEOEN", path: "/movie/boogie-videoen-2025", reason: "Contemporary send-focused energy with current scene texture." }
  ],
  "oldschool-parkour-crews-videos-and-philosophy-documentaries.md": [
    { title: "OUT OF TIME", path: "/movie/out-of-time-2009", reason: "Raw oldschool crew energy and foundational line literacy." },
    { title: "Jump London", path: "/movie/jump-london-2003", reason: "Core cultural reference for early mainstream parkour storytelling." },
    { title: "The Monkey's Back / Le Singe est de Retour", path: "/movie/the-monkeys-back-le-singe-est-de-retour-2006", reason: "Documentary perspective rooted in early philosophy." }
  ],
  "parkour-athlete-motivation-edits-that-make-you-train.md": [
    { title: "CAPSTONE VERKY", path: "/movie/capstone-verky-2025", reason: "High-discipline modern athlete project with clear training signal." },
    { title: "BOOGIE VIDEOEN", path: "/movie/boogie-videoen-2025", reason: "Fast motivational hit that still shows real movement output." },
    { title: "One Last Run", path: "/movie/one-last-run-2025", reason: "Compact piece that converts inspiration into train-now energy." }
  ],
  "parkour-challenge-videos-that-build-real-skill.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Structured challenge context with measurable outcomes." },
    { title: "Ultimate Tag", path: "/series/ultimate-tag-2020", reason: "Constraint-driven speed and decision-making under pressure." },
    { title: "Louvain-la-Neuve | Parkour as fast as you can!", path: "/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018", reason: "Useful sprint challenge reference for transition consistency." }
  ],
  "parkour-competitions-2026-schedule-and-qualification-guide.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Ongoing event reference for format and season timing." },
    { title: "CAPSTONE // OATH", path: "/movie/capstone-oath-2024", reason: "Current-era benchmark for competitive line expectations." },
    { title: "CAPSTONE // SWARM", path: "/movie/capstone-swarm-2022", reason: "Strong comparative reference for run planning across events." }
  ],
  "parkour-fails-safety-breakdowns-you-can-learn-from.md": [
    { title: "Controlled Descent", path: "/movie/controlled-descent-2021", reason: "Emphasizes control and reduction of avoidable error." },
    { title: "Our relationship with fear", path: "/movie/our-relationship-with-fear-sebastien-foucan-at-tedxealing-2012", reason: "Useful mental model for fear-aware decisions." },
    { title: "The Progression Series", path: "/series/the-progression-series-2010", reason: "Good baseline for technique-first progression." }
  ],
  "parkour-performance-mindset-under-competition-pressure.md": [
    { title: "Our relationship with fear", path: "/movie/our-relationship-with-fear-sebastien-foucan-at-tedxealing-2012", reason: "Direct mindset framework for handling pressure." },
    { title: "Imagination Is Everything", path: "/movie/imagination-is-everything-2011", reason: "Mental framing and self-direction for performance days." },
    { title: "Enter the Breach", path: "/movie/enter-the-breach-2021", reason: "Long-form case study in composure and execution." }
  ],
  "parkour-progression-videos-beginner-to-confident.md": [
    { title: "The Progression Series", path: "/series/the-progression-series-2010", reason: "Built around progressive skill acquisition." },
    { title: "People in Motion", path: "/movie/people-in-motion-2012", reason: "Context-rich movement examples with strong fundamentals." },
    { title: "Parkour, imaginatively.", path: "/movie/parkour-imaginatively-2013", reason: "Compact technical cues with clear line readability." }
  ],
  "parkour-spot-discovery-street-rooftop-urbex-watch-guide.md": [
    { title: "STORROR Rooftop POV's & Escapes", path: "/series/storror-rooftop-povs-escapes-2016", reason: "Rooftop line reading and route decisions." },
    { title: "Holi Shit", path: "/movie/holi-shit-2013", reason: "Urbex-specific atmosphere and environment adaptation." },
    { title: "Traceurs Des Arbres", path: "/movie/traceurs-des-arbres-2025", reason: "Nature movement reference for non-urban scouting." }
  ],
  "pov-parkour-videos-how-to-read-lines-like-a-traceur.md": [
    { title: "STORROR Rooftop POV's & Escapes", path: "/series/storror-rooftop-povs-escapes-2016", reason: "Core POV reference for route reading." },
    { title: "Louvain-la-Neuve | Parkour as fast as you can!", path: "/movie/louvain-la-neuve-parkour-as-fast-as-you-can-2018", reason: "Great for studying pacing in near real-time speed." },
    { title: "CAVEMEN", path: "/series/storror-cavemen", reason: "Useful supplemental perspective on commitment and spatial awareness." }
  ],
  "precision-jump-plateau-longevity-recovery-and-flow-state-training.md": [
    { title: "Controlled Descent", path: "/movie/controlled-descent-2021", reason: "Precision-focused control and landing economy." },
    { title: "One Last Run", path: "/movie/one-last-run-2025", reason: "Good model for balancing intensity with technical consistency." },
    { title: "The Progression Series", path: "/series/the-progression-series-2010", reason: "Long-view progression framing for plateau phases." }
  ],
  "real-parkour-vs-fake-parkour-for-beginners.md": [
    { title: "People in Motion", path: "/movie/people-in-motion-2012", reason: "Real training culture with clear, non-gimmick context." },
    { title: "Jump London", path: "/movie/jump-london-2003", reason: "Foundational real-world movement history for beginners." },
    { title: "The Progression Series", path: "/series/the-progression-series-2010", reason: "Process-driven movement that contrasts with stunt-only clips." }
  ],
  "top-parkour-athlete-rankings-how-to-track-results-and-climb.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Ranking-relevant competitive footage and repeatable event data." },
    { title: "CAPSTONE VERKY", path: "/movie/capstone-verky-2025", reason: "Strong benchmark for elite-level run quality." },
    { title: "Ultimate Tag", path: "/series/ultimate-tag-2020", reason: "Useful format contrast for consistency and pressure handling." }
  ],
  "viral-parkour-tricks-urbex-edits-and-what-to-watch-next.md": [
    { title: "District B13", path: "/movie/district-b13-2004", reason: "Classic viral-adjacent gateway with historical context." },
    { title: "STORROR Rooftop POV's & Escapes", path: "/series/storror-rooftop-povs-escapes-2016", reason: "High-click rooftop format that transitions well to long-form viewing." },
    { title: "Holi Shit", path: "/movie/holi-shit-2013", reason: "Urbex-style edit to bridge trend interest into deeper catalog exploration." }
  ],
  "wall-run-kong-precision-videos-that-actually-help.md": [
    { title: "The Progression Series", path: "/series/the-progression-series-2010", reason: "Strong move-by-move progression cues." },
    { title: "Parkour, imaginatively.", path: "/movie/parkour-imaginatively-2013", reason: "Clean technical lines for reading takeoff and landing rhythm." },
    { title: "Controlled Descent", path: "/movie/controlled-descent-2021", reason: "Good precision and control references for transfer to drills." }
  ],
  "what-makes-a-winning-parkour-competition-run.md": [
    { title: "Sport Parkour League", path: "/series/sport-parkour-league", reason: "Event examples for scoring pillar analysis." },
    { title: "CAPSTONE // SWARM", path: "/movie/capstone-swarm-2022", reason: "Run architecture with high-value sections and clean transitions." },
    { title: "CAPSTONE VERKY", path: "/movie/capstone-verky-2025", reason: "Useful reference for balancing difficulty with execution reliability." }
  ]
};

const updated = [];
const missing = [];

for (const [file, picks] of Object.entries(mapping)) {
  const filePath = path.join(blogDir, file);
  if (!fs.existsSync(filePath)) {
    missing.push(file);
    continue;
  }

  const original = fs.readFileSync(filePath, "utf8");
  const section = [
    heading,
    "",
    ...picks.map((p) => `- [${p.title}](${p.path}): ${p.reason}`)
  ].join("\n");

  const idx = original.indexOf(heading);
  const base = idx >= 0 ? original.slice(0, idx) : original;
  const next = `${base.replace(/\s*$/u, "")}\n\n${section}\n`;

  if (next !== original) {
    fs.writeFileSync(filePath, next, "utf8");
    updated.push(file);
  }
}

console.log("Updated files:");
updated.forEach((f) => console.log(`- ${f}`));
if (updated.length === 0) console.log("- (none)");

if (missing.length) {
  console.log("Missing files:");
  missing.forEach((f) => console.log(`- ${f}`));
}
