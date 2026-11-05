// Bei jeder Auslieferung hochzählen: hier, android/app/build.gradle, package.json, public/sw.js, CHANGELOG.md
export const TOOL_CONFIG = {
  name: 'KONTORWERK',
  version: '2.1.0',
  build: 8,
  emoji: '🏛️',
  dbName: 'kontorwerk',
  // Altbestand aus WAWIWERK/KASSENWERK (wird beim ersten Start übernommen)
  legacyDbName: 'kassenwerk',
  legacyStateKey: 'state_v1'
};
