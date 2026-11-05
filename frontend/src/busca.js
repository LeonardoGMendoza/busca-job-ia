// Regras de busca: as mesmas do servidor (backend/app/vagas.py). Não inventa vaga: só monta os links dos portais reais.

export const semAcento = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const slug = (s) => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const limpo = (s) => ' ' + semAcento(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

function achar(lista, s) {
  let melhor = null, tam = 0;
  for (const item of lista) for (const p of item.palavras || []) {
    if (s.includes(' ' + semAcento(p) + ' ') && p.length > tam) { melhor = item; tam = p.length; }
  }
  return melhor ? melhor.id : '';
}

const GATILHOS = /(?:trabalh\w*|vagas?|empregos?|servicos?|trabaj\w*|empleos?|puestos?|jobs?|work\w*|procuro|busco|quero ser|quiero ser)\s+(.+)/;
const CORTES = /\s(?:em|en|in|na|no|a noite|de noite|a la noche|meio periodo|medio tiempo|fim de semana|fines de semana|home office|remoto|remote|por favor)\s/;
const INUTEIS = new Set(['um', 'uma', 'a', 'o', 'de', 'da', 'do', 'como', 'un', 'una', 'el', 'la', 'as', 'of', 'trabalho', 'trabalhar', 'emprego',
  'vaga', 'vagas', 'trabajo', 'trabajar', 'empleo', 'job', 'work', 'algo', 'qualquer', 'ser', 'para']);

// profissão fora da lista: "vaga de motorista de van em Foz" -> "motorista de van"
export function extrairLivre(texto) {
  const m = limpo(texto).trim().match(GATILHOS);
  if (!m) return '';
  const palavras = (' ' + m[1] + ' ').split(CORTES)[0].trim().split(' ');
  while (palavras.length && INUTEIS.has(palavras[0])) palavras.shift();
  while (palavras.length && INUTEIS.has(palavras[palavras.length - 1])) palavras.pop();
  const livre = palavras.slice(0, 4).join(' ');
  return livre.length >= 3 ? livre : '';
}

export function entender(texto, cat) {
  const s = limpo(texto);
  return {
    cidade: achar(cat.cidades, s),
    area: achar(cat.areas, s),
    periodo: achar(cat.periodos.filter(p => p.id), s),
    livre: extrairLivre(texto)
  };
}

// o que a pessoa digitou no campo "Cargo": vira uma área da lista ou fica como texto livre
export function cargoDigitado(texto, cat) {
  const t = String(texto || '').trim();
  if (!t) return { area: '', livre: '' };
  const area = achar(cat.areas, limpo(t));
  const nomeExato = cat.areas.find(a => Object.values(a.nome).some(n => semAcento(n) === semAcento(t)));
  if (nomeExato) return { area: nomeExato.id, livre: '' };
  return area && t.split(/\s+/).length <= 2 ? { area, livre: '' } : { area: '', livre: t };
}

export function termo(busca, cat, comJornada = true) {
  const cidade = cat.cidades.find(c => c.id === busca.cidade);
  const area = cat.areas.find(a => a.id === busca.area);
  if (!cidade || (!area && !busca.livre)) return '';
  const lingua = cat.paises[cidade.pais].idioma;
  const base = area ? area.termo[lingua] : busca.livre;
  const p = cat.periodos.find(x => x.id === busca.periodo);
  return [base, comJornada && p ? p.termo[lingua] : ''].filter(Boolean).join(' ');
}

export function portais(busca, cat) {
  const cidade = cat.cidades.find(c => c.id === busca.cidade);
  const q = termo(busca, cat), base = termo(busca, cat, false);
  if (!cidade || !q) return [];
  return cat.paises[cidade.pais].sites.map(id => {
    const s = cat.sites[id];
    const url = s.url.replace('{q}', encodeURIComponent(q)).replace('{qslug}', slug(base))
      .replace('{local}', encodeURIComponent(cidade.local)).replace('{slug}', cidade.slug);
    return { id, nome: s.nome, url, dominio: new URL(url).hostname.replace(/^www\./, '') };
  });
}
