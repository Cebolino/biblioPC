const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const router = express.Router();
const db = require('../db/init');
const { requireAuth } = require('./auth');
const { extrairDadosCapa } = require('../ocr');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'covers');
const tmpDir = path.join(__dirname, '..', '..', 'uploads', 'tmp');
[uploadsDir, tmpDir].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Arquivo deve ser uma imagem.'));
    cb(null, true);
  },
});

// Otimiza e persiste a capa em duas versões: normal (busca visual) e thumbnail (listagem)
async function salvarCapaOtimizada(tmpPath) {
  const id = crypto.randomBytes(8).toString('hex');
  const coverName = `cover_${id}.jpg`;
  const thumbName = `thumb_${id}.jpg`;
  const coverPath = path.join(uploadsDir, coverName);
  const thumbPath = path.join(uploadsDir, thumbName);

  await sharp(tmpPath).rotate().resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 82 }).toFile(coverPath);
  await sharp(tmpPath).rotate().resize({ width: 220, withoutEnlargement: true })
    .jpeg({ quality: 78 }).toFile(thumbPath);

  return {
    cover_path: `/uploads/covers/${coverName}`,
    cover_thumb_path: `/uploads/covers/${thumbName}`,
  };
}

// ---- Endpoint: OCR (admin) - envia foto da capa e recebe sugestão de dados ----
router.post('/ocr', requireAuth, upload.single('capa'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie uma imagem da capa.' });
  try {
    const resultado = await extrairDadosCapa(req.file.path);
    const { cover_path, cover_thumb_path } = await salvarCapaOtimizada(req.file.path);
    fs.unlink(req.file.path, () => {});
    res.json({
      ok: true,
      tituloSugerido: resultado.tituloSugerido,
      autorSugerido: resultado.autorSugerido,
      ocrRawText: resultado.ocrRawText,
      cover_path,
      cover_thumb_path,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao processar OCR da imagem: ' + err.message });
  }
});

// ---- Endpoint público: listar/buscar livros com filtros ----
router.get('/', (req, res) => {
  const { q, categoria, tema, autor, idioma, disponivel, page = 1, pageSize = 24 } = req.query;
  const conditions = [];
  const params = {};

  let baseQuery = 'SELECT b.* FROM books b';

  if (q && q.trim()) {
    baseQuery = `SELECT b.* FROM books_fts f JOIN books b ON b.id = f.rowid`;
    conditions.push('books_fts MATCH @q');
    params.q = q.trim().split(/\s+/).map((t) => `${t}*`).join(' ');
  }
  if (categoria) { conditions.push('b.categoria = @categoria'); params.categoria = categoria; }
  if (tema) { conditions.push('b.tema = @tema'); params.tema = tema; }
  if (autor) { conditions.push('b.autor LIKE @autor'); params.autor = `%${autor}%`; }
  if (idioma) { conditions.push('b.idioma = @idioma'); params.idioma = idioma; }
  if (disponivel === '1') { conditions.push('b.disponiveis > 0'); }

  const whereSql = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const limit = Math.min(parseInt(pageSize) || 24, 100);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

  const countSql = `SELECT COUNT(*) as total FROM (${baseQuery}${whereSql})`;
  const total = db.prepare(countSql).get(params).total;

  const dataSql = `${baseQuery}${whereSql} ORDER BY b.titulo ASC LIMIT @limit OFFSET @offset`;
  const rows = db.prepare(dataSql).all({ ...params, limit, offset });

  res.json({ total, page: Number(page), pageSize: limit, items: rows });
});

// ---- Metadados para popular filtros (categorias, temas, idiomas distintos) ----
router.get('/meta/filtros', (req, res) => {
  const categorias = db.prepare('SELECT DISTINCT categoria FROM books WHERE categoria IS NOT NULL AND categoria != "" ORDER BY categoria').all().map(r => r.categoria);
  const temas = db.prepare('SELECT DISTINCT tema FROM books WHERE tema IS NOT NULL AND tema != "" ORDER BY tema').all().map(r => r.tema);
  const idiomas = db.prepare('SELECT DISTINCT idioma FROM books WHERE idioma IS NOT NULL AND idioma != "" ORDER BY idioma').all().map(r => r.idioma);
  res.json({ categorias, temas, idiomas });
});

// ---- Detalhe de um livro (público) ----
router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livro não encontrado.' });
  res.json(book);
});

// ---- Cadastro de livro (admin) - usa dados confirmados/editados pelo professor após OCR ----
router.post('/', requireAuth, (req, res) => {
  const {
    titulo, autor, editora, categoria, tema, ano, isbn, sinopse, idioma,
    paginas, exemplares, localizacao, cover_path, cover_thumb_path, ocr_raw_text,
  } = req.body;

  if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'Título é obrigatório.' });

  const stmt = db.prepare(`
    INSERT INTO books (titulo, autor, editora, categoria, tema, ano, isbn, sinopse, idioma,
      paginas, exemplares, disponiveis, localizacao, cover_path, cover_thumb_path, ocr_raw_text)
    VALUES (@titulo, @autor, @editora, @categoria, @tema, @ano, @isbn, @sinopse, @idioma,
      @paginas, @exemplares, @exemplares, @localizacao, @cover_path, @cover_thumb_path, @ocr_raw_text)
  `);
  const info = stmt.run({
    titulo: titulo.trim(),
    autor: autor || null,
    editora: editora || null,
    categoria: categoria || null,
    tema: tema || null,
    ano: ano ? Number(ano) : null,
    isbn: isbn || null,
    sinopse: sinopse || null,
    idioma: idioma || null,
    paginas: paginas ? Number(paginas) : null,
    exemplares: exemplares ? Number(exemplares) : 1,
    localizacao: localizacao || null,
    cover_path: cover_path || null,
    cover_thumb_path: cover_thumb_path || null,
    ocr_raw_text: ocr_raw_text || null,
  });

  const novo = db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(novo);
});

// ---- Atualização de livro (admin) ----
router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Livro não encontrado.' });

  const campos = ['titulo', 'autor', 'editora', 'categoria', 'tema', 'ano', 'isbn', 'sinopse',
    'idioma', 'paginas', 'exemplares', 'disponiveis', 'localizacao', 'cover_path', 'cover_thumb_path'];
  const updates = {};
  campos.forEach((c) => { if (req.body[c] !== undefined) updates[c] = req.body[c]; });
  updates.updated_at = new Date().toISOString();

  const setSql = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE books SET ${setSql} WHERE id = @id`).run({ ...updates, id: req.params.id });

  const atualizado = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  res.json(atualizado);
});

// ---- Remoção de livro (admin) ----
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Livro não encontrado.' });
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
