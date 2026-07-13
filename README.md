# 📚 Biblioteca Escolar — Consulta + Cadastro via OCR

Site completo para consulta do acervo de uma biblioteca escolar (estudantes)
com área administrativa (professor) para cadastro de livros usando **OCR
automático da capa**.

## Funcionalidades

- **Consulta pública (estudantes)**: busca por texto (título, autor, ISBN,
  sinopse) com full‑text search (SQLite FTS5) + filtros por categoria, tema,
  idioma e disponibilidade. Grade de capas + modal de detalhes.
- **Login do professor** (usuário/senha, sessão protegida por bcrypt +
  express-session).
- **Cadastro via OCR**: o professor tira uma foto da capa, o sistema roda OCR
  (Tesseract.js, português + inglês) e sugere automaticamente título e autor.
  O professor confirma/edita antes de salvar (evita erros do OCR).
- **Armazenamento persistente e otimizado das capas**: cada capa é salva em
  disco em duas versões via `sharp` (JPEG comprimido): uma versão média
  (800px) para a tela de detalhes e um thumbnail (220px) para as listagens —
  reduz drasticamente o espaço em disco e acelera a busca visual.
- CRUD completo de livros (editar, excluir, controle de exemplares
  disponíveis).

## Como rodar

```bash
cd school-library
npm install
cp .env.example .env     # ajuste usuário/senha do professor se quiser
npm start
```

Acesse `http://localhost:3000`.

Login padrão do professor (definido em `.env`): `professor` / `biblioteca123`
— **troque a senha após o primeiro login** (botão "Trocar senha" no painel).

## Estrutura

```
school-library/
  public/          front-end (HTML/CSS/JS puro, sem build step)
  src/
    server.js      servidor Express
    ocr.js          extração de texto da capa (Tesseract.js) + heurística título/autor
    db/init.js      schema SQLite + criação do admin padrão
    routes/auth.js  login/logout/sessão
    routes/books.js OCR endpoint, CRUD de livros, busca/filtros
  uploads/covers/  capas otimizadas (persistente)
  data/            banco SQLite (biblioteca.db)
```

## Notas técnicas

- Banco: SQLite (`better-sqlite3`), sem dependências externas de servidor de
  banco de dados — ideal para uma escola.
- OCR: `tesseract.js` roda localmente (sem custo de API externa, funciona
  offline). A extração de título/autor é heurística (linha mais longa =
  título, linha com padrão de nome próprio = autor) — por isso o professor
  sempre confirma/edita os dados sugeridos antes de salvar, garantindo
  qualidade dos dados.
- Sessão de admin: `express-session` com `MemoryStore` (adequado para uso em
  uma única instância/escola). Para produção com múltiplas instâncias, trocar
  por um store persistente (Redis, etc.).
- Para trocar o modelo de OCR por um serviço de IA de visão mais preciso
  (ex: GPT-4 Vision, Google Vision), basta substituir a lógica de
  `src/ocr.js` mantendo a mesma interface (`extrairDadosCapa`).

## Segurança

- Senhas de admin armazenadas com hash bcrypt.
- Sessões com cookie httpOnly (padrão do express-session).
- Recomenda-se rodar atrás de HTTPS em produção e definir uma
  `SESSION_SECRET` forte no `.env`.
