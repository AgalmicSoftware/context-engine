import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) {
  throw new Error('Usage: node ./scripts/generate-world-map-geographies.mjs <countries-110m.json> [output.mjs]');
}

const findContextEngineRoot = async () => {
  let candidate = path.resolve(import.meta.dirname);
  while (path.dirname(candidate) !== candidate) {
    try {
      await fs.access(path.join(candidate, 'client', 'node_modules', 'd3-geo', 'src', 'index.js'));
      await fs.access(path.join(candidate, 'client', 'node_modules', 'topojson-client', 'src', 'index.js'));
      return candidate;
    } catch {
      candidate = path.dirname(candidate);
    }
  }
  throw new Error('Could not find Context Engine client dependencies. Set CONTEXT_ENGINE_ROOT.');
};

const inputPath = path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3] || './src/world-map-geographies.mjs');
const contextEngineRoot = process.env.CONTEXT_ENGINE_ROOT
  ? path.resolve(process.env.CONTEXT_ENGINE_ROOT)
  : await findContextEngineRoot();
const clientModules = path.join(contextEngineRoot, 'client', 'node_modules');

const d3Geo = await import(pathToFileURL(path.join(clientModules, 'd3-geo', 'src', 'index.js')).href);
const topojson = await import(pathToFileURL(path.join(clientModules, 'topojson-client', 'src', 'index.js')).href);
const topology = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const countries = topojson.feature(topology, topology.objects.countries).features;
const projection = d3Geo.geoEqualEarth()
  .rotate([-10, 0, 0])
  .scale(147)
  .translate([400, 300]);
const renderPath = d3Geo.geoPath(projection);

const geographies = countries
  .map((country) => ({
    name: country.properties?.name || String(country.id || ''),
    path: renderPath(country),
  }))
  .filter((country) => country.name && country.path)
  .sort((left, right) => left.name.localeCompare(right.name));

const source = `// Generated from world-atlas@2 countries-110m.json using the same Equal Earth projection as Context Engine.\n`
  + `// Regenerate with: node ./scripts/generate-world-map-geographies.mjs <countries-110m.json>\n\n`
  + `export const WORLD_MAP_VIEW_BOX = '0 0 800 600';\n`
  + `export const WORLD_MAP_SPHERE_PATH = ${JSON.stringify(renderPath({ type: 'Sphere' }))};\n`
  + `export const WORLD_MAP_GRATICULE_PATH = ${JSON.stringify(renderPath(d3Geo.geoGraticule10()))};\n`
  + `export const WORLD_MAP_GEOGRAPHIES = Object.freeze(${JSON.stringify(geographies, null, 2)});\n`;

await fs.writeFile(outputPath, source);
console.log(`Wrote ${geographies.length} world-map geographies to ${outputPath}`);
