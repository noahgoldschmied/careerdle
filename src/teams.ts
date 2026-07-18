export interface TeamMeta {
  name: string;
  color: string;   // #rrggbb, primary
  hasLogo: boolean;
}

export const TEAMS: Record<string, TeamMeta> = {
  // Current 32 franchises with logos
  ANA: { name: "Anaheim Ducks", color: "#f47a38", hasLogo: true },
  BOS: { name: "Boston Bruins", color: "#000000", hasLogo: true },
  BUF: { name: "Buffalo Sabres", color: "#fcb514", hasLogo: true },
  CAR: { name: "Carolina Hurricanes", color: "#cc0000", hasLogo: true },
  CBJ: { name: "Columbus Blue Jackets", color: "#00205b", hasLogo: true },
  CGY: { name: "Calgary Flames", color: "#e4202a", hasLogo: true },
  CHI: { name: "Chicago Blackhawks", color: "#e8202a", hasLogo: true },
  COL: { name: "Colorado Avalanche", color: "#6f263d", hasLogo: true },
  DAL: { name: "Dallas Stars", color: "#006341", hasLogo: true },
  DET: { name: "Detroit Red Wings", color: "#ce1141", hasLogo: true },
  EDM: { name: "Edmonton Oilers", color: "#041c6c", hasLogo: true },
  FLA: { name: "Florida Panthers", color: "#b0975b", hasLogo: true },
  LAK: { name: "Los Angeles Kings", color: "#111111", hasLogo: true },
  MIN: { name: "Minnesota Wild", color: "#154734", hasLogo: true },
  MTL: { name: "Montreal Canadiens", color: "#af3433", hasLogo: true },
  NJD: { name: "New Jersey Devils", color: "#000000", hasLogo: true },
  NSH: { name: "Nashville Predators", color: "#041e42", hasLogo: true },
  NYI: { name: "New York Islanders", color: "#003087", hasLogo: true },
  NYR: { name: "New York Rangers", color: "#0038a8", hasLogo: true },
  OTT: { name: "Ottawa Senators", color: "#c2122e", hasLogo: true },
  PHI: { name: "Philadelphia Flyers", color: "#f74601", hasLogo: true },
  PIT: { name: "Pittsburgh Penguins", color: "#000000", hasLogo: true },
  SEA: { name: "Seattle Kraken", color: "#001628", hasLogo: true },
  SJS: { name: "San Jose Sharks", color: "#006272", hasLogo: true },
  STL: { name: "St. Louis Blues", color: "#003da5", hasLogo: true },
  TBL: { name: "Tampa Bay Lightning", color: "#002868", hasLogo: true },
  TOR: { name: "Toronto Maple Leafs", color: "#003da5", hasLogo: true },
  UTA: { name: "Utah Hockey Club", color: "#a4423e", hasLogo: true },
  VAN: { name: "Vancouver Canucks", color: "#001f3f", hasLogo: true },
  VGK: { name: "Vegas Golden Knights", color: "#b4975a", hasLogo: true },
  WPG: { name: "Winnipeg Jets", color: "#003087", hasLogo: true },
  WSH: { name: "Washington Capitals", color: "#e8202a", hasLogo: true },

  // Defunct/historical teams (12) without logos
  AFM: { name: "Atlanta Flames", color: "#e4202a", hasLogo: false },
  ARI: { name: "Arizona Coyotes", color: "#8b2635", hasLogo: false },
  ATL: { name: "Atlanta Thrashers", color: "#041c6c", hasLogo: false },
  CGS: { name: "California Golden Seals", color: "#006272", hasLogo: false },
  CLE: { name: "Cleveland Barons", color: "#003da5", hasLogo: false },
  CLR: { name: "California Golden Seals", color: "#006272", hasLogo: false },
  HFD: { name: "Hartford Whalers", color: "#003087", hasLogo: false },
  MNS: { name: "Minnesota North Stars", color: "#028a41", hasLogo: false },
  OAK: { name: "Oakland Seals", color: "#006272", hasLogo: false },
  PHX: { name: "Phoenix Coyotes", color: "#8b2635", hasLogo: false },
  QUE: { name: "Quebec Nordiques", color: "#1e4497", hasLogo: false },
  WIN: { name: "Winnipeg Jets", color: "#003087", hasLogo: false },
};

export function getTeam(triCode: string): TeamMeta {
  const meta = TEAMS[triCode];
  if (!meta) throw new Error(`Unknown triCode: ${triCode}`);
  return meta;
}
