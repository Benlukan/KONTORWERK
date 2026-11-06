// Bei jeder Auslieferung hochzählen: hier, android/app/build.gradle, package.json, public/sw.js, CHANGELOG.md
export const TOOL_CONFIG = {
  name: 'KONTORWERK',
  version: '2.5.2',
  build: 17,
  emoji: '🏛️',
  dbName: 'kontorwerk',
  // Altbestand aus WAWIWERK/KASSENWERK (wird beim ersten Start übernommen)
  legacyDbName: 'kassenwerk',
  legacyStateKey: 'state_v1'
};
