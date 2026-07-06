require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/angatu.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id      TEXT,
    telefone        TEXT NOT NULL,
    nome            TEXT,
    tipo            TEXT CHECK(tipo IN ('novo','recorrente')),
    utm_source      TEXT,
    utm_campaign    TEXT,
    origem_declarada TEXT,
    total_visitas   INTEGER,
    sucesso_tabletcloud BOOLEAN DEFAULT 0,
    sucesso_n8n     BOOLEAN DEFAULT 0,
    criado_em       DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_telefone   ON checkins(telefone);
  CREATE INDEX IF NOT EXISTS idx_criado_em  ON checkins(criado_em);
  CREATE INDEX IF NOT EXISTS idx_utm_source ON checkins(utm_source);
`);

function salvarCheckin(dados) {
  const stmt = db.prepare(`
    INSERT INTO checkins
      (cliente_id, telefone, nome, tipo, utm_source, utm_campaign,
       origem_declarada, total_visitas, sucesso_tabletcloud, sucesso_n8n)
    VALUES
      (@cliente_id, @telefone, @nome, @tipo, @utm_source, @utm_campaign,
       @origem_declarada, @total_visitas, @sucesso_tabletcloud, @sucesso_n8n)
  `);
  const info = stmt.run({
    cliente_id:       dados.clienteId || null,
    telefone:         dados.telefone,
    nome:             dados.nome || null,
    tipo:             dados.tipo,
    utm_source:       dados.utmSource || null,
    utm_campaign:     dados.utmCampaign || null,
    origem_declarada: dados.origemDeclarada || null,
    total_visitas:    dados.totalVisitas || null,
    sucesso_tabletcloud: dados.sucessoTabletcloud ? 1 : 0,
    sucesso_n8n:      dados.sucessoN8n ? 1 : 0,
  });
  return info.lastInsertRowid;
}

module.exports = { db, salvarCheckin };

if (require.main === module) {
  console.log('Banco inicializado em:', path.resolve(DB_PATH));
}
