const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db/init');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }
  req.session.adminId = admin.id;
  req.session.adminUser = admin.username;
  res.json({ ok: true, username: admin.username, nome: admin.nome });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (req.session.adminId) {
    return res.json({ authenticated: true, username: req.session.adminUser });
  }
  res.json({ authenticated: false });
});

router.post('/change-password', (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ error: 'Não autenticado.' });
  const { senhaAtual, novaSenha } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.adminId);
  if (!bcrypt.compareSync(senhaAtual, admin.password_hash)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter ao menos 6 caracteres.' });
  }
  const hash = bcrypt.hashSync(novaSenha, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'Acesso restrito ao administrador (professor).' });
  next();
}

module.exports = { router, requireAuth };
