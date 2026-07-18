import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_TEAMS = [
  "ANA","BOS","BUF","CAR","CBJ","CGY","CHI","COL","DAL","DET",
  "EDM","FLA","LAK","MIN","MTL","NJD","NSH","NYI","NYR","OTT",
  "PHI","PIT","SEA","SJS","STL","TBL","TOR","UTA","VAN","VGK",
  "WPG","WSH",
];

const OUT_DIR = new URL("../public/logos/", import.meta.url);

async function main() {
  await mkdir(fileURLToPath(OUT_DIR), { recursive: true });
  for (const tri of CURRENT_TEAMS) {
    const url = `https://assets.nhle.com/logos/nhl/svg/${tri}_light.svg`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ${tri}: ${res.status} ${res.statusText}`);
      continue;
    }
    const svg = await res.text();
    const outPath = new URL(`${tri}.svg`, OUT_DIR);
    const filePath = fileURLToPath(outPath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, svg);
    console.log(`  ${tri} OK`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
