let estadoOCR = { cover_path: null, cover_thumb_path: null, ocr_raw_text: null };
let editandoLivroId = null;
let paginaAtual = 1;

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na requisição.');
  return data;
}

function mostrarView(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('tabConsulta').classList.remove('active');
  document.getElementById('tabAdmin').classList.remove('active');

  if (view === 'consulta') {
    document.getElementById('viewConsulta').classList.add('active');
    document.getElementById('tabConsulta').classList.add('active');
    buscarLivros(1);
  } else if (view === 'admin') {
    document.getElementById('tabAdmin').classList.add('active');
    checarSessao();
  }
}

// -------- CONSULTA PÚBLICA --------
async function carregarFiltros() {
  const meta = await api('/api/books/meta/filtros');
  preencherSelect('fCategoria', meta.categorias);
  preencherSelect('fTema', meta.temas);
  preencherSelect('fIdioma', meta.idiomas);
  preencherDatalist('listaCategorias', meta.categorias);
  preencherDatalist('listaTemas', meta.temas);
}
function preencherSelect(id, valores) {
  const sel = document.getElementById(id);
  const atual = sel.value;
  sel.innerHTML = `<option value="">${sel.options[0].text}</option>` +
    valores.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  sel.value = atual;
}
function preencherDatalist(id, valores) {
  document.getElementById(id).innerHTML = valores.map((v) => `<option value="${escapeHtml(v)}">`).join('');
}

async function buscarLivros(pagina = 1) {
  paginaAtual = pagina;
  const params = new URLSearchParams({
    q: document.getElementById('q').value,
    categoria: document.getElementById('fCategoria').value,
    tema: document.getElementById('fTema').value,
    idioma: document.getElementById('fIdioma').value,
    disponivel: document.getElementById('fDisponivel').value,
    page: pagina,
    pageSize: 24,
  });
  const data = await api('/api/books?' + params.toString());
  renderizarGrid(data);
}

function renderizarGrid(data) {
  const grid = document.getElementById('gridBooks');
  document.getElementById('resultCount').textContent = `${data.total} livro(s) encontrado(s)`;
  if (data.items.length === 0) {
    grid.innerHTML = '<div class="empty">Nenhum livro encontrado com esses filtros.</div>';
  } else {
    grid.innerHTML = data.items.map((b) => `
      <div class="book-card" onclick="abrirDetalhe(${b.id})">
        <img src="${b.cover_thumb_path || placeholderCapa()}" alt="Capa de ${escapeHtml(b.titulo)}" onerror="this.src='${placeholderCapa()}'"/>
        <div class="info">
          <div class="titulo">${escapeHtml(b.titulo)}</div>
          <div class="autor">${escapeHtml(b.autor || 'Autor desconhecido')}</div>
          <div class="badges">
            ${b.categoria ? `<span class="badge">${escapeHtml(b.categoria)}</span>` : ''}
            <span class="badge ${b.disponiveis > 0 ? 'ok' : 'no'}">${b.disponiveis > 0 ? 'Disponível' : 'Indisponível'}</span>
          </div>
        </div>
      </div>
    `).join('');
  }
  renderizarPaginacao(data);
}

function renderizarPaginacao(data) {
  const totalPaginas = Math.max(1, Math.ceil(data.total / data.pageSize));
  const el = document.getElementById('pagination');
  if (totalPaginas <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="btn ${i === data.page ? '' : 'secondary'}" onclick="buscarLivros(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

async function abrirDetalhe(id) {
  const b = await api('/api/books/' + id);
  document.getElementById('modalContent').innerHTML = `
    <button class="close-btn" onclick="fecharModal()">✕</button>
    <div class="detail-flex">
      <img src="${b.cover_path || placeholderCapa()}" onerror="this.src='${placeholderCapa()}'"/>
      <div class="detail-info">
        <h2>${escapeHtml(b.titulo)}</h2>
        <p><span class="label">Autor:</span> ${escapeHtml(b.autor || '—')}</p>
        <p><span class="label">Editora:</span> ${escapeHtml(b.editora || '—')}</p>
        <p><span class="label">Categoria:</span> ${escapeHtml(b.categoria || '—')}</p>
        <p><span class="label">Tema:</span> ${escapeHtml(b.tema || '—')}</p>
        <p><span class="label">Ano:</span> ${b.ano || '—'}</p>
        <p><span class="label">ISBN:</span> ${escapeHtml(b.isbn || '—')}</p>
        <p><span class="label">Idioma:</span> ${escapeHtml(b.idioma || '—')}</p>
        <p><span class="label">Páginas:</span> ${b.paginas || '—'}</p>
        <p><span class="label">Localização:</span> ${escapeHtml(b.localizacao || '—')}</p>
        <p><span class="label">Disponibilidade:</span> ${b.disponiveis} de ${b.exemplares} exemplar(es)</p>
        ${b.sinopse ? `<p><span class="label">Sinopse:</span> ${escapeHtml(b.sinopse)}</p>` : ''}
      </div>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('active');
}
function fecharModal() { document.getElementById('modalOverlay').classList.remove('active'); }

function placeholderCapa() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="100%" height="100%" fill="%23dfe4ea"/><text x="50%" y="50%" font-size="14" fill="%236b7280" text-anchor="middle">Sem capa</text></svg>`
  );
}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// -------- ÁREA DO ADMIN --------
async function checarSessao() {
  const me = await api('/api/auth/me');
  if (me.authenticated) {
    document.getElementById('viewAdminPanel').classList.add('active');
    document.getElementById('adminUserLabel').textContent = me.username;
    carregarTabelaLivros();
    carregarFiltros();
  } else {
    document.getElementById('viewLogin').classList.add('active');
  }
}

async function fazerLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    document.getElementById('viewLogin').classList.remove('active');
    checarSessao();
  } catch (e) {
    errEl.textContent = e.message;
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  document.getElementById('viewAdminPanel').classList.remove('active');
  mostrarView('admin');
}

function abrirTrocaSenha() {
  const senhaAtual = prompt('Senha atual:');
  if (!senhaAtual) return;
  const novaSenha = prompt('Nova senha (mín. 6 caracteres):');
  if (!novaSenha) return;
  api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ senhaAtual, novaSenha }) })
    .then(() => alert('Senha alterada com sucesso!'))
    .catch((e) => alert('Erro: ' + e.message));
}

async function processarCapa(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('capaPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('uploadHint').style.display = 'none';
  };
  reader.readAsDataURL(file);

  const statusEl = document.getElementById('ocrStatus');
  statusEl.innerHTML = '<div class="ocr-status loading">🔍 Processando OCR da capa, aguarde...</div>';

  const formData = new FormData();
  formData.append('capa', file);

  try {
    const res = await fetch('/api/books/ocr', { method: 'POST', body: formData, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    estadoOCR.cover_path = data.cover_path;
    estadoOCR.cover_thumb_path = data.cover_thumb_path;
    estadoOCR.ocr_raw_text = data.ocrRawText;

    if (data.tituloSugerido) document.getElementById('fTitulo').value = data.tituloSugerido;
    if (data.autorSugerido) document.getElementById('fAutor').value = data.autorSugerido;

    statusEl.innerHTML = `<div class="ocr-status done">✅ OCR concluído! Título e autor sugeridos preenchidos automaticamente — confira e ajuste antes de salvar.</div>`;
  } catch (e) {
    statusEl.innerHTML = `<div class="ocr-status error">⚠️ ${e.message} — preencha os dados manualmente.</div>`;
  }
}

async function salvarLivro(event) {
  event.preventDefault();
  const payload = {
    titulo: document.getElementById('fTitulo').value,
    autor: document.getElementById('fAutor').value,
    editora: document.getElementById('fEditora').value,
    categoria: document.getElementById('fCategoriaForm').value,
    tema: document.getElementById('fTemaForm').value,
    ano: document.getElementById('fAno').value,
    isbn: document.getElementById('fIsbn').value,
    idioma: document.getElementById('fIdiomaForm').value,
    paginas: document.getElementById('fPaginas').value,
    exemplares: document.getElementById('fExemplares').value,
    localizacao: document.getElementById('fLocalizacao').value,
    sinopse: document.getElementById('fSinopse').value,
    cover_path: estadoOCR.cover_path,
    cover_thumb_path: estadoOCR.cover_thumb_path,
    ocr_raw_text: estadoOCR.ocr_raw_text,
  };

  try {
    if (editandoLivroId) {
      await api('/api/books/' + editandoLivroId, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/books', { method: 'POST', body: JSON.stringify(payload) });
    }
    limparFormulario();
    carregarTabelaLivros();
    carregarFiltros();
    alert('Livro salvo com sucesso!');
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

function limparFormulario() {
  document.getElementById('formLivro').reset();
  document.getElementById('capaPreview').style.display = 'none';
  document.getElementById('uploadHint').style.display = 'block';
  document.getElementById('ocrStatus').innerHTML = '';
  document.getElementById('fExemplares').value = 1;
  estadoOCR = { cover_path: null, cover_thumb_path: null, ocr_raw_text: null };
  editandoLivroId = null;
}

async function carregarTabelaLivros() {
  const data = await api('/api/books?pageSize=100');
  const tbody = document.querySelector('#tabelaLivros tbody');
  tbody.innerHTML = data.items.map((b) => `
    <tr>
      <td><img src="${b.cover_thumb_path || placeholderCapa()}" onerror="this.src='${placeholderCapa()}'"/></td>
      <td>${escapeHtml(b.titulo)}</td>
      <td>${escapeHtml(b.autor || '—')}</td>
      <td>${escapeHtml(b.categoria || '—')}</td>
      <td>${b.disponiveis}/${b.exemplares}</td>
      <td class="actions">
        <button class="btn secondary" onclick="editarLivro(${b.id})">Editar</button>
        <button class="btn danger" onclick="removerLivro(${b.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
}

async function editarLivro(id) {
  const b = await api('/api/books/' + id);
  editandoLivroId = id;
  document.getElementById('fTitulo').value = b.titulo || '';
  document.getElementById('fAutor').value = b.autor || '';
  document.getElementById('fEditora').value = b.editora || '';
  document.getElementById('fCategoriaForm').value = b.categoria || '';
  document.getElementById('fTemaForm').value = b.tema || '';
  document.getElementById('fAno').value = b.ano || '';
  document.getElementById('fIsbn').value = b.isbn || '';
  document.getElementById('fIdiomaForm').value = b.idioma || '';
  document.getElementById('fPaginas').value = b.paginas || '';
  document.getElementById('fExemplares').value = b.exemplares || 1;
  document.getElementById('fLocalizacao').value = b.localizacao || '';
  document.getElementById('fSinopse').value = b.sinopse || '';
  estadoOCR.cover_path = b.cover_path;
  estadoOCR.cover_thumb_path = b.cover_thumb_path;
  estadoOCR.ocr_raw_text = b.ocr_raw_text;
  if (b.cover_path) {
    document.getElementById('capaPreview').src = b.cover_path;
    document.getElementById('capaPreview').style.display = 'block';
    document.getElementById('uploadHint').style.display = 'none';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removerLivro(id) {
  if (!confirm('Tem certeza que deseja excluir este livro?')) return;
  await api('/api/books/' + id, { method: 'DELETE' });
  carregarTabelaLivros();
  carregarFiltros();
}

// Inicialização
carregarFiltros();
buscarLivros(1);
