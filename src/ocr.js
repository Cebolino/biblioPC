const Tesseract = require('tesseract.js');

/**
 * Executa OCR na imagem da capa e tenta inferir título/autor
 * a partir do texto reconhecido, usando heurísticas simples:
 * - A linha mais longa/maior (em maiúsculas, fonte grande) tende a ser o título.
 * - Linhas contendo "por", "de autor" ou nomes próprios curtos tendem a ser o autor.
 */
async function extrairDadosCapa(imagePath) {
  const { data } = await Tesseract.recognize(imagePath, 'por+eng', {
    logger: () => {},
  });

  const rawText = (data.text || '').trim();
  const linhas = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  let titulo = '';
  let autor = '';

  if (linhas.length > 0) {
    // Heurística: título = linha mais longa entre as primeiras 60% do texto
    const candidatosTitulo = linhas.slice(0, Math.max(1, Math.ceil(linhas.length * 0.6)));
    titulo = candidatosTitulo.reduce((a, b) => (b.length > a.length ? b : a), candidatosTitulo[0]);

    // Heurística: autor = linha que parece nome próprio (2-4 palavras capitalizadas)
    // procurando de baixo para cima, ignorando a linha já usada como título
    const regexNome = /^([A-ZÀ-Ý][a-zà-ý.]+\s?){2,4}$/;
    for (let i = linhas.length - 1; i >= 0; i--) {
      const linha = linhas[i].replace(/^(por|by|de)\s+/i, '').trim();
      if (linha !== titulo && regexNome.test(linha)) {
        autor = linha;
        break;
      }
    }
  }

  return {
    ocrRawText: rawText,
    tituloSugerido: titulo,
    autorSugerido: autor,
    linhas,
  };
}

module.exports = { extrairDadosCapa };
