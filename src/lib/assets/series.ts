// Series are powered by YouTube playlists but displayed as series in the app
// For now we reuse the same data shape but with type: 'series'
export const series = [
  // {
  //   id: 1,
  //   title: "Dutch Community TV",
  //   creators: ["the Netherlands"],
  //   description: "Dutch parkour content from the community.",
  //   thumbnail: "/images/posters/dutch-parkour-community-tv-playlist-freerunning.webp",
  //   playlistId: "PL3iwaCsp8s8P0lVvw3DkmMFmGxqBGSXnS",
  //   type: "series",
  //   videoCount: 53,
  //   starring: []
  // },
  {
    id: 3,
    title: "Parkour - The Nature of Challenge",
    creators: ["Northern Parkour", "Dave Sedgley", "Paul Maunder"],
    description: "A short documentary series exploring what parkour means to practitioners and the so-called 'parkour vision'.",
    thumbnail: "/images/posters/parkour-the-nature-of-challenge-poster.webp",
    type: "series",
    seasons: [
      { seasonNumber: 1, playlistId: "PLFE063C4ADA6CAA18" }
    ],
    videoCount: 4,
    starring: []
  },
  // {
  //   id: 4,
  //   title: "Forest Flow | Parkour in Nature",
  //   creators: ["pkfr.nl"],
  //   description: "A playlist showcasing parkour in natural environments.",
  //   thumbnail: "/images/posters/forest-flow-parkour-in-nature-poster.webp",
  //   playlistId: "PL3iwaCsp8s8Mdg2gI45nhevmbalyAeBJ5",
  //   type: "series",
  //   videoCount: 2,
  //   starring: []
  // },
  // {
  //   id: 5,
  //   title: "World Chase Tag", // https://en.wikipedia.org/wiki/World_Chase_Tag // https://www.youtube.com/@WorldChaseTag/playlists
  //   creators: ["World Chase Tag"],
  //   description: "The First and Only Global League for Professional Tag! 🏃‍♂️ #KeepChasing #DontGetCaught",
  //   thumbnail: "/images/posters/world-chase-tag-poster.webp",
  //   seasons: [
  //     { seasonNumber: 4, playlistId: "PLAh6we_yqvHG9gJ8ze2ar1ALqNCwJrGeF" }
  //   ],
  //   type: "series",
  //   videoCount: 312,
  //   starring: []
  // },
  {
    id: 6,
    title: "Gravity Series | Spanish Parkour",
    creators: ["Adrian Pueyo"],
    description: "A four-part Spanish parkour series (2013–2015) featuring MADD, BTT GUP, James Kingston and others.",
    thumbnail: "/images/posters/gravity-series-spanish-parkour-poster.webp",
    type: "series",
    seasons: [
      { seasonNumber: 1, playlistId: "PLQLQeBBGuzK93e_bI1nt7j5Hkb92Nzgre" }
    ],
    videoCount: 4,
    starring: ["MADD", "BTT", "GUP", "Scott Bass", "James Kingston", "Tyler Harder", "Marc Selby", "Curtis Randolph", "Franziska Marie", "Garrett Moore", "the Spanish Community"]
  },
  {
    id: 7,
    title: "KIPA - UDG",
    creators: ["KIPA", "Lester Castro"],
    description: "A Swedish winter parkour trilogy shot in undercover and underground spots across Stockholm and the south (Lund, Helsingborg, Malmö), turning rough, unlikely locations into creative lines. DIY-filmed with a colorful, psychedelic, EDM-tinged vibe, it shows how the crew keeps moving through long, dark, wet winters.",
    thumbnail: "/images/posters/kipa-udg-poster-underground-parkour-freerun.webp",
    type: "series",
    seasons: [
      { seasonNumber: 1, playlistId: "PL5_AeU_YPHqX5CfDpxWbogjIGBn_JtdTc" }
    ],
    videoCount: 3,
    starring: ["Joel Larsson", "Arvid Nygren", "Lester Castro", "Hugo Arnesson", "Affe Zetterberg"]
  }
];
