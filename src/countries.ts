export interface CountryMeta { name: string; flag: string; }

// ISO 3166-1 alpha-3 codes as returned by NHL landing `birthCountry`.
// Only NHL-relevant countries — every code that appears in players.json
// should be listed. Unknowns fall back to the raw code with a globe.
export const COUNTRIES: Record<string, CountryMeta> = {
  CAN: { name: "Canada", flag: "🇨🇦" },
  USA: { name: "United States", flag: "🇺🇸" },
  SWE: { name: "Sweden", flag: "🇸🇪" },
  FIN: { name: "Finland", flag: "🇫🇮" },
  RUS: { name: "Russia", flag: "🇷🇺" },
  CZE: { name: "Czechia", flag: "🇨🇿" },
  SVK: { name: "Slovakia", flag: "🇸🇰" },
  DEU: { name: "Germany", flag: "🇩🇪" },
  CHE: { name: "Switzerland", flag: "🇨🇭" },
  DNK: { name: "Denmark", flag: "🇩🇰" },
  NOR: { name: "Norway", flag: "🇳🇴" },
  AUT: { name: "Austria", flag: "🇦🇹" },
  FRA: { name: "France", flag: "🇫🇷" },
  GBR: { name: "United Kingdom", flag: "🇬🇧" },
  IRL: { name: "Ireland", flag: "🇮🇪" },
  ITA: { name: "Italy", flag: "🇮🇹" },
  NLD: { name: "Netherlands", flag: "🇳🇱" },
  BEL: { name: "Belgium", flag: "🇧🇪" },
  POL: { name: "Poland", flag: "🇵🇱" },
  SVN: { name: "Slovenia", flag: "🇸🇮" },
  SRB: { name: "Serbia", flag: "🇷🇸" },
  HUN: { name: "Hungary", flag: "🇭🇺" },
  UKR: { name: "Ukraine", flag: "🇺🇦" },
  BLR: { name: "Belarus", flag: "🇧🇾" },
  LVA: { name: "Latvia", flag: "🇱🇻" },
  LTU: { name: "Lithuania", flag: "🇱🇹" },
  EST: { name: "Estonia", flag: "🇪🇪" },
  KAZ: { name: "Kazakhstan", flag: "🇰🇿" },
  JPN: { name: "Japan", flag: "🇯🇵" },
  KOR: { name: "South Korea", flag: "🇰🇷" },
  CHN: { name: "China", flag: "🇨🇳" },
  AUS: { name: "Australia", flag: "🇦🇺" },
  NZL: { name: "New Zealand", flag: "🇳🇿" },
  BRA: { name: "Brazil", flag: "🇧🇷" },
  MEX: { name: "Mexico", flag: "🇲🇽" },
  ZAF: { name: "South Africa", flag: "🇿🇦" },
  NGA: { name: "Nigeria", flag: "🇳🇬" },
  JAM: { name: "Jamaica", flag: "🇯🇲" },
  HTI: { name: "Haiti", flag: "🇭🇹" },
  VEN: { name: "Venezuela", flag: "🇻🇪" },
  TWN: { name: "Taiwan", flag: "🇹🇼" },
  THA: { name: "Thailand", flag: "🇹🇭" },
  IND: { name: "India", flag: "🇮🇳" },
  ISR: { name: "Israel", flag: "🇮🇱" },
  LBN: { name: "Lebanon", flag: "🇱🇧" },
  UZB: { name: "Uzbekistan", flag: "🇺🇿" },
  TJK: { name: "Tajikistan", flag: "🇹🇯" },
  ROU: { name: "Romania", flag: "🇷🇴" },
  BGR: { name: "Bulgaria", flag: "🇧🇬" },
  YUG: { name: "Yugoslavia", flag: "🏳️" },
  URS: { name: "Soviet Union", flag: "🏳️" },
  TCH: { name: "Czechoslovakia", flag: "🏳️" },
};

export function formatCountry(code: string): string {
  if (!code) return "Unknown";
  const meta = COUNTRIES[code];
  if (!meta) return `🌐 ${code}`;
  return `${meta.flag} ${meta.name}`;
}
