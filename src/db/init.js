const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'biblioteca.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  autor TEXT,
  editora TEXT,
  categoria TEXT,
  tema TEXT,
  ano INTEGER,
  isbn TEXT,
  sinopse TEXT,
  idioma TEXT,
  paginas INTEGER,
  exemplares INTEGER DEFAULT 1,
  disponiveis INTEGER DEFAULT 1,
  localizacao TEXT,
  cover_path TEXT,
  cover_thumb_path TEXT,
  ocr_raw_text TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
  titulo, autor, editora, categoria, tema, sinopse, isbn,
  content='books', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN
  INSERT INTO books_fts(rowid, titulo, autor, editora, categoria, tema, sinopse, isbn)
  VALUES (new.id, new.titulo, new.autor, new.editora, new.categoria, new.tema, new.sinopse, new.isbn);
END;

CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN
  INSERT INTO books_fts(books_fts, rowid, titulo, autor, editora, categoria, tema, sinopse, isbn)
  VALUES ('delete', old.id, old.titulo, old.autor, old.editora, old.categoria, old.tema, old.sinopse, old.isbn);
END;

CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN
  INSERT INTO books_fts(books_fts, rowid, titulo, autor, editora, categoria, tema, sinopse, isbn)
  VALUES ('delete', old.id, old.titulo, old.autor, old.editora, old.categoria, old.tema, old.sinopse, old.isbn);
  INSERT INTO books_fts(rowid, titulo, autor, editora, categoria, tema, sinopse, isbn)
  VALUES (new.id, new.titulo, new.autor, new.editora, new.categoria, new.tema, new.sinopse, new.isbn);
END;
`);

// Seed default admin (professor) if none exists
const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
if (adminCount === 0) {
  const defaultUser = process.env.ADMIN_USER || 'professor';
  const defaultPass = process.env.ADMIN_PASS || 'biblioteca123';
  const hash = bcrypt.hashSync(defaultPass, 10);
  db.prepare('INSERT INTO admins (username, password_hash, nome) VALUES (?, ?, ?)')
    .run(defaultUser, hash, 'Administrador');
  console.log(`[seed] Admin padrão criado -> usuário: "${defaultUser}" senha: "${defaultPass}" (ALTERE após o primeiro login)`);
}

module.exports = db;
