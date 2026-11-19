// Nota de compatibilidade (0 a 100) entre uma vaga e o perfil da pessoa, para QUALQUER área (enfermagem, TI, garçom...).
// Roda no navegador: o perfil fica só no aparelho da pessoa. Não envia candidatura: só mostra o que combina.
import { semAcento } from './busca.js';

const PESO = { titulo: 30, skills: 45, nivel: 15, local: 10 };
const NIVEIS = ['junior', 'pleno', 'senior'];
const RE_NIVEL = {
  junior: /(^|[^a-z0-9])(junior|jr|estagio|estagiario|estagiaria|trainee|aprendiz|pasante|intern|entry level|entry-level)($|[^a-z0-9])/,
  pleno: /(^|[^a-z0-9])(pleno|pl|semi senior|semi-senior|ssr|mid|middle|mid-level|intermediario|intermedio)($|[^a-z0-9])/,
  senior: /(^|[^a-z0-9])(senior|sr|especialista|lead|lider|coordenador|coordinador|gerente|supervisor|chefe|jefe)($|[^a-z0-9])/
};

const norm = (s) => semAcento(s).replace(/\s+/g, ' ').trim();
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// a palavra inteira, aceitando plural simples (curativo/curativos, enfermeiro/enfermeiros)
const palavra = (termo) => new RegExp('(^|[^a-z0-9])' + escapar(termo) + '(?:s|es)?($|[^a-z0-9])');

export function listaHabilidades(texto) {
  const vistos = new Set(), saida = [];
  for (const bruto of String(texto || '').split(/[,;\n]+/)) {
    const h = bruto.trim().slice(0, 40), k = norm(h);
    if (k.length >= 2 && !vistos.has(k)) { vistos.add(k); saida.push(h); }
    if (saida.length >= 30) break;
  }
  return saida;
}

export function pontuar(vaga, perfil) {
  const titulo = norm(vaga.titulo), corpo = norm([vaga.titulo, vaga.resumo, vaga.descricao].filter(Boolean).join(' '));
  const habilidades = perfil.habilidades || [];
  const alertas = [];

  // habilidades que aparecem na vaga
  const casou = habilidades.filter(h => palavra(norm(h)).test(corpo));
  const nSkills = Math.min(habilidades.length, 5) || 1;
  const notaSkills = PESO.skills * Math.min(1, casou.length / nSkills);

  // título: profissão inteira = tudo; só uma palavra dela, ou uma habilidade no título = metade
  const cargo = norm(perfil.cargo);
  const palavrasCargo = cargo.split(' ').filter(p => p.length >= 4);
  let notaTitulo = 0;
  if (cargo && palavra(escapar(cargo).replace(/\\ /g, ' ')).test(titulo)) notaTitulo = PESO.titulo;
  else if (palavrasCargo.some(p => palavra(p).test(titulo)) || habilidades.some(h => palavra(norm(h)).test(titulo))) notaTitulo = PESO.titulo / 2;

  // nível (só se a pessoa informou e a vaga diz o nível no título)
  const doTitulo = NIVEIS.filter(n => RE_NIVEL[n].test(titulo));
  let notaNivel = PESO.nivel * 0.67;
  if (perfil.nivel && doTitulo.length) {
    if (doTitulo.includes(perfil.nivel)) notaNivel = PESO.nivel;
    else {
      const meu = NIVEIS.indexOf(perfil.nivel), vaga_ = Math.min(...doTitulo.map(n => NIVEIS.indexOf(n)));
      notaNivel = Math.abs(meu - vaga_) === 1 ? PESO.nivel * 0.45 : PESO.nivel * 0.2;
      alertas.push(vaga_ > meu ? 'acima' : 'abaixo');
    }
  }

  // local / remoto
  const local = norm(vaga.local), cid = norm(perfil.cidadeNome);
  let notaLocal;
  if (vaga.remoto && perfil.aceitaRemoto !== false) notaLocal = PESO.local;
  else if (cid && local.includes(cid)) notaLocal = PESO.local;
  else if (!local) notaLocal = PESO.local / 2;
  else if (/remot|home office|anywhere|qualquer lugar|cualquier/.test(local) && perfil.aceitaRemoto !== false) notaLocal = PESO.local * 0.8;
  else { notaLocal = PESO.local * 0.3; alertas.push('longe'); }

  let nota = notaTitulo + notaSkills + notaNivel + notaLocal;
  if (!casou.length && !notaTitulo) nota = Math.min(nota, 30);       // nada da vaga combina com o perfil
  nota = Math.round(Math.max(0, Math.min(100, nota)));
  return { nota, faixa: nota >= 70 ? 'alta' : nota >= 45 ? 'media' : 'baixa', casou, alertas };
}

// mais alta primeiro; empate: a mais nova
export function ranquear(vagas, perfil) {
  return vagas.map(v => ({ ...v, compat: pontuar(v, perfil) }))
    .sort((a, b) => b.compat.nota - a.compat.nota || String(b.data || '').localeCompare(String(a.data || '')));
}
