/// <reference path="../pb_data/types.d.ts" />
// KONTORWERK – Server-Schema für den Geräte-Abgleich
// Eine Sammlung „kw_daten“: je Datensatz der App eine Zeile (Tabelle + id), Inhalt als JSON.
migrate((app) => {
  const daten = new Collection({
    name: 'kw_daten',
    type: 'base',
    // Nur angemeldete Nutzer; löschen geht nie (Löschen = Grabstein in den Daten)
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: null,
    fields: [
      {name: 'tabelle', type: 'text', required: true, max: 40},
      {name: 'rid', type: 'text', required: true, max: 120},
      {name: 'daten', type: 'json', maxSize: 30000000},
      {name: 'geaendert', type: 'number', onlyInt: true},
      {name: 'geraet', type: 'text', max: 40},
      {name: 'geloescht', type: 'bool'},
      {name: 'updated', type: 'autodate', onCreate: true, onUpdate: true}
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_kw_daten_tab_rid ON kw_daten (tabelle, rid)',
      'CREATE INDEX idx_kw_daten_updated ON kw_daten (updated)'
    ]
  });
  app.save(daten);

  // Keine Selbst-Registrierung: Nutzer legt nur der Admin an
  const users = app.findCollectionByNameOrId('users');
  users.createRule = null;
  app.save(users);

  // Batch-Anfragen erlauben (Hochladen vieler Datensätze auf einmal)
  const s = app.settings();
  s.batch.enabled = true;
  s.batch.maxRequests = 100;
  s.batch.timeout = 30;
  s.batch.maxBodySize = 64 * 1024 * 1024;
  // Tägliche Sicherung um 3 Uhr, die letzten 7 behalten
  s.backups.cron = '0 3 * * *';
  s.backups.cronMaxKeep = 7;
  s.meta.appName = 'KONTORWERK';
  app.save(s);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('kw_daten'));
});
