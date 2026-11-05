// BuscaJob IA: ajuda estudantes (e qualquer pessoa) a achar trabalho na fronteira, na Argentina, em Lima ou em home office.
// Não inventa vagas: monta a busca já filtrada nos sites de emprego reais de cada país e mostra as vagas das empresas parceiras.
// A conversa é por voz com a atendente 3D (mesma técnica do StudentMedical/HablaPY/CambioFronteira).

const VERSAO = 2;
const API_PADRAO = 'https://buscajob.sandlj.com.br';   // servidor na VPS (Oracle IA). Sem ele no ar, o app usa a regra do navegador
function apiUrl() {
  const q = new URLSearchParams(location.search).get('api');
  try {
    if (q !== null) { localStorage.setItem('bj.api', q); return q; }
    const salvo = localStorage.getItem('bj.api');
    return salvo !== null ? salvo : API_PADRAO;
  } catch (e) { return q || API_PADRAO; }
}
const API = apiUrl().replace(/\/$/, '');

const T = {
  pt: {
    remotasAgora: 'Vagas remotas de hoje', fonte: 'Fonte', 
    titulo: 'Encontre trabalho perto da sua faculdade ou de casa', subtitulo: 'Escolha a cidade e a área, ou toque no microfone e diga, por exemplo: "quero trabalhar de garçom em Buenos Aires à noite".',
    onde: 'Onde?', area: 'Área', horario: 'Horário', buscar: 'Ver vagas em', abrir: 'Abrir',
    resumo: (a, c, p) => `${a} em ${c}${p ? ' · ' + p : ''}`, escolha: 'Escolha uma cidade e uma área para ver as vagas.',
    parceiros: 'Vagas das empresas parceiras', semParceiro: 'Ainda não há vagas de parceiros para essa busca.', exemplo: 'EXEMPLO — ainda não é uma vaga real.',
    contato: 'Contato', patrocinado: 'Patrocinado', promos: 'Uniformes & Faculdades',
    dica: 'Dica para estudante estrangeiro: antes de aceitar, confirme se o seu visto ou radicação permite trabalhar no país e quantas horas.',
    dicaRemoto: 'Dica: vagas remotas costumam pedir inglês e um portfólio. Muitas pagam em dólar.',
    comecar: '👋 Toque para conversar', carregando: 'Chamando a atendente…', tocarFalar: 'Toque e fale', ouvindo: 'Estou ouvindo…', pensando: 'Procurando…',
    ola: 'Oi! Eu te ajudo a achar trabalho. Diga a cidade e o que você quer fazer, por exemplo: garçom em Ciudad del Este, à noite.',
    semMic: 'Este navegador não ouve a voz. Use o Chrome ou o Safari.', falar: 'Falar',
    achei: (a, c, p, n) => `Pronto! Separei vagas de ${a} em ${c}${p ? ', ' + p : ''}. Toque em um dos ${n} sites abaixo para ver as vagas de hoje.`,
    faltaCidade: (a) => `Certo, ${a}. Em qual cidade? Pode ser Foz, Ciudad del Este, Asunción, Buenos Aires, Lima ou home office.`,
    faltaArea: (c) => `Beleza, ${c}. Que tipo de trabalho você procura? Garçom, limpeza, eventos, enfermagem, TI...`,
    naoEntendi: 'Não entendi a cidade nem a área. Tente: "vaga de enfermeira em Foz do Iguaçu".',
    rodape: 'O BuscaJob IA não é agência de emprego: ele abre a busca nos sites oficiais de vagas. Nunca pague para conseguir uma vaga.'
  },
  es: {
    remotasAgora: 'Vacantes remotas de hoy', fonte: 'Fuente', 
    titulo: 'Encuentra trabajo cerca de tu facultad o desde casa', subtitulo: 'Elige la ciudad y el área, o toca el micrófono y di, por ejemplo: "quiero trabajar de mozo en Buenos Aires de noche".',
    onde: '¿Dónde?', area: 'Área', horario: 'Horario', buscar: 'Ver vacantes en', abrir: 'Abrir',
    resumo: (a, c, p) => `${a} en ${c}${p ? ' · ' + p : ''}`, escolha: 'Elige una ciudad y un área para ver las vacantes.',
    parceiros: 'Vacantes de empresas socias', semParceiro: 'Todavía no hay vacantes de socios para esta búsqueda.', exemplo: 'EJEMPLO — todavía no es una vacante real.',
    contato: 'Contacto', patrocinado: 'Patrocinado', promos: 'Uniformes y Facultades',
    dica: 'Consejo para estudiante extranjero: antes de aceptar, confirma si tu visa o radicación te permite trabajar en el país y cuántas horas.',
    dicaRemoto: 'Consejo: las vacantes remotas suelen pedir inglés y un portafolio. Muchas pagan en dólares.',
    comecar: '👋 Toca para conversar', carregando: 'Llamando a la asistente…', tocarFalar: 'Toca y habla', ouvindo: 'Te escucho…', pensando: 'Buscando…',
    ola: '¡Hola! Te ayudo a encontrar trabajo. Dime la ciudad y qué quieres hacer, por ejemplo: mozo en Ciudad del Este, de noche.',
    semMic: 'Este navegador no escucha la voz. Usa Chrome o Safari.', falar: 'Hablar',
    achei: (a, c, p, n) => `¡Listo! Separé vacantes de ${a} en ${c}${p ? ', ' + p : ''}. Toca uno de los ${n} sitios de abajo para ver las vacantes de hoy.`,
    faltaCidade: (a) => `Bien, ${a}. ¿En qué ciudad? Puede ser Foz, Ciudad del Este, Asunción, Buenos Aires, Lima o remoto.`,
    faltaArea: (c) => `Perfecto, ${c}. ¿Qué tipo de trabajo buscas? Mozo, limpieza, eventos, enfermería, TI...`,
    naoEntendi: 'No entendí la ciudad ni el área. Prueba: "trabajo de enfermera en Asunción".',
    rodape: 'BuscaJob IA no es una agencia de empleo: abre la búsqueda en los sitios oficiales de vacantes. Nunca pagues para conseguir un trabajo.'
  },
  en: {
    remotasAgora: "Today's remote jobs", fonte: 'Source', 
    titulo: 'Find work near your university or from home', subtitulo: 'Pick the city and the area, or tap the mic and say, for example: "I want to work as a waiter in Buenos Aires at night".',
    onde: 'Where?', area: 'Area', horario: 'Schedule', buscar: 'See jobs on', abrir: 'Open',
    resumo: (a, c, p) => `${a} in ${c}${p ? ' · ' + p : ''}`, escolha: 'Pick a city and an area to see the jobs.',
    parceiros: 'Jobs from partner companies', semParceiro: 'No partner jobs for this search yet.', exemplo: 'SAMPLE — not a real job yet.',
    contato: 'Contact', patrocinado: 'Sponsored', promos: 'Uniforms & Universities',
    dica: 'Tip for international students: before accepting, check that your visa or residency allows you to work in the country and for how many hours.',
    dicaRemoto: 'Tip: remote jobs usually ask for English and a portfolio. Many pay in dollars.',
    comecar: '👋 Tap to talk', carregando: 'Calling the assistant…', tocarFalar: 'Tap and speak', ouvindo: "I'm listening…", pensando: 'Searching…',
    ola: "Hi! I'll help you find work. Tell me the city and what you want to do, for example: waiter in Ciudad del Este, at night.",
    semMic: "This browser can't hear voice. Use Chrome or Safari.", falar: 'Speak',
    achei: (a, c, p, n) => `Done! I lined up ${a} jobs in ${c}${p ? ', ' + p : ''}. Tap one of the ${n} sites below to see today's openings.`,
    faltaCidade: (a) => `OK, ${a}. Which city? Foz, Ciudad del Este, Asunción, Buenos Aires, Lima or remote.`,
    faltaArea: (c) => `Great, ${c}. What kind of work? Waiter, cleaning, events, nursing, IT...`,
    naoEntendi: "I didn't get the city or the area. Try: \"nurse jobs in Foz do Iguaçu\".",
    rodape: 'BuscaJob IA is not a job agency: it opens the search on official job sites. Never pay to get a job.'
  }
};
const LOCALE = { pt: 'pt-BR', es: 'es-PY', en: 'en-US' };

const ler = (k, p) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : p; } catch (e) { return p; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const lang0 = (navigator.language || 'pt').slice(0, 2);
let idioma = ler('bj.idioma', T[lang0] ? lang0 : 'pt');
let busca = ler('bj.busca', { cidade: '', area: '', periodo: '' });
let cat = null, vagas = { exemplo: true, vagas: [] }, online = false;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const t = () => T[idioma];
const txt = (o) => (o && (o[idioma] || o.pt)) || '';
const semAcento = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- dados ----------
async function carregar() {
  cat = await (await fetch('./catalogo.json?v=' + VERSAO, { cache: 'no-cache' })).json();
  if (API) {
    try {
      const r = await fetch(API + '/api/vagas', { cache: 'no-store' });
      if (r.ok) { vagas = await r.json(); online = true; return; }
    } catch (e) { /* sem servidor: usa o exemplo */ }
  }
  vagas = await (await fetch('./vagas-exemplo.json?v=' + VERSAO, { cache: 'no-cache' })).json();
}
const cidade = () => cat.cidades.find(c => c.id === busca.cidade);
const area = () => cat.areas.find(a => a.id === busca.area);
const periodo = () => cat.periodos.find(p => p.id === busca.periodo) || cat.periodos[0];

// termo de busca no idioma do país da vaga (Brasil em português, Paraguai/Argentina/Peru em espanhol, remoto em inglês)
function termo(comHorario = true) {
  const c = cidade(), a = area(), p = periodo();
  if (!c || !a) return '';
  const lingua = cat.paises[c.pais].idioma;
  const base = busca.livre || a.termo[lingua];
  return [base, comHorario ? p.termo[lingua] : ''].filter(Boolean).join(' ');
}
function linksDeBusca() {
  const c = cidade();
  if (!c || !area()) return [];
  const q = termo(), base = termo(false);   // sites com link em "slug" ficam só com a profissão
  return cat.paises[c.pais].sites.map(id => {
    const s = cat.sites[id];
    const url = s.url.replace('{q}', encodeURIComponent(q)).replace('{qslug}', slug(base)).replace('{local}', encodeURIComponent(c.local)).replace('{slug}', c.slug);
    return { id, nome: s.nome, url };
  });
}

function registrar(tipo, id) {
  if (!online) return;
  try { fetch(API + '/api/clique', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, id }), keepalive: true }); } catch (e) {}
}

// ---------- tela ----------
function telaFiltros() {
  const x = t();
  const porPais = Object.keys(cat.paises).map(p => {
    const cs = cat.cidades.filter(c => c.pais === p);
    return `<div class="pais">${cat.paises[p].bandeira} ${esc(txt(cat.paises[p].nome))}</div>
      <div class="chips">${cs.map(c => `<button type="button" class="chip" data-cidade="${c.id}" aria-pressed="${busca.cidade === c.id}">${esc(c.nome)}</button>`).join('')}</div>`;
  }).join('');
  return `
  <div class="grupo"><h3>📍 ${x.onde}</h3>${porPais}</div>
  <div class="grupo"><h3>🧰 ${x.area}</h3><div class="areas">
    ${cat.areas.map(a => `<button type="button" class="area" data-area="${a.id}" aria-pressed="${busca.area === a.id && !busca.livre}"><span class="ic" aria-hidden="true">${a.icone}</span>${esc(txt(a.nome))}</button>`).join('')}
  </div></div>
  <div class="grupo"><h3>🕒 ${x.horario}</h3><div class="chips">
    ${cat.periodos.map(p => `<button type="button" class="chip" data-periodo="${p.id}" aria-pressed="${busca.periodo === p.id}">${esc(txt(p.nome))}</button>`).join('')}
  </div></div>
  <div id="resultado"></div>`;
}

function anuncioHtml() {
  const x = t(), lista = (cat.anuncios || []).filter(a => a.ativo && a.tipo === 'banner');
  if (!lista.length) return '';
  const zap = cat.anuncie && cat.anuncie.whatsapp;
  return `<div class="carrossel" id="carrossel">${lista.map(a => {
    const cor = a.cor || '#0f8b5f', link = a.link || (a.id === 'anuncie' && zap ? `https://wa.me/${zap}` : '');
    const corpo = `<span class="ic" style="background:${esc(cor)}">${esc(a.icone)}</span><span><span class="tag">${x.patrocinado}</span><b>${esc(txt(a.titulo))}</b><small>${esc(txt(a.texto))}</small></span>`;
    const estilo = `style="background:${esc(cor)}1a;border-color:${esc(cor)}55"`;
    return link ? `<a class="parceiro" ${estilo} href="${esc(link)}" target="_blank" rel="noopener sponsored" data-ad="${esc(a.id)}">${corpo}</a>` : `<div class="parceiro" ${estilo}>${corpo}</div>`;
  }).join('')}</div>`;
}
function promosHtml() {
  const x = t(), lista = (cat.anuncios || []).filter(a => a.ativo && a.tipo === 'promo');
  if (!lista.length) return '';
  return `<h2 class="titulo-sec">${x.promos}</h2><div class="promos">${lista.map(a => {
    const corpo = `<span class="selo-p" style="background:${esc(a.cor)}">${esc(a.selo)}</span><b>${esc(txt(a.titulo))}</b><span class="cta">${esc(txt(a.texto))} ›</span>`;
    const estilo = `style="background-image:url('${esc(a.imagem)}')"`;
    return a.link ? `<a class="promo" ${estilo} href="${esc(a.link)}" target="_blank" rel="noopener sponsored" data-ad="${esc(a.id)}">${corpo}</a>` : `<div class="promo" ${estilo}>${corpo}</div>`;
  }).join('')}</div>`;
}

function vagasParceiros() {
  const lista = (vagas.vagas || []).filter(v => (!busca.cidade || v.cidade === busca.cidade) && (!busca.area || v.area === busca.area));
  return lista;
}

function telaResultado() {
  const x = t(), c = cidade(), a = area(), p = periodo();
  const links = linksDeBusca();
  const nomeArea = busca.livre || (a ? txt(a.nome) : '');
  const topo = c && a ? `<div class="resumo"><b>🔎 ${esc(x.resumo(nomeArea, c.nome, p.id ? txt(p.nome) : ''))}</b>
      <div class="sites">${links.map(l => `<a class="site" href="${esc(l.url)}" target="_blank" rel="noopener" data-site="${l.id}"><span>${esc(l.nome)}<small>${x.buscar} ${esc(l.nome)}</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div>
      <div class="dica">💡 ${c.pais === 'REMOTO' ? x.dicaRemoto : x.dica}</div></div>`
    : `<div class="resumo">${x.escolha}</div>`;
  const pv = vagasParceiros();
  const parceiros = `<h2 class="titulo-sec">🤝 ${x.parceiros}</h2>
    ${vagas.exemplo ? `<div class="aviso">⚠️ ${x.exemplo}</div>` : ''}
    ${pv.length ? `<div class="lista-vagas">${pv.map(v => {
      const cid = cat.cidades.find(cc => cc.id === v.cidade);
      const contato = v.link || (v.contato ? `https://wa.me/${v.contato}` : '');
      return `<div class="vaga"><div><b>${esc(txt(v.titulo))}</b><small>${esc(v.empresa)} · ${esc(cid ? cid.nome : '')}</small></div>
        ${contato ? `<a class="btn prim" href="${esc(contato)}" target="_blank" rel="noopener" data-vaga="${esc(v.id)}">${x.contato}</a>` : ''}</div>`;
    }).join('')}</div>` : `<div class="vazio">${x.semParceiro}</div>`}`;
  return topo + '<div id="remotas"></div>' + anuncioHtml() + parceiros + promosHtml();
}

function atualizarResultado() {
  $('#resultado').innerHTML = telaResultado();
  document.querySelectorAll('[data-site]').forEach(a => a.onclick = () => registrar('site', a.dataset.site + ':' + busca.cidade + ':' + busca.area));
  document.querySelectorAll('[data-ad]').forEach(a => a.onclick = () => registrar('anuncio', a.dataset.ad));
  document.querySelectorAll('[data-vaga]').forEach(a => a.onclick = () => registrar('vaga', a.dataset.vaga));
  gravar('bj.busca', busca);
  carregarRemotas();
}

// vagas remotas reais do Remote OK (só com o servidor ligado; o crédito ao Remote OK é obrigatório)
async function carregarRemotas() {
  const c = cidade();
  if (!online || !c || c.pais !== 'REMOTO' || !area()) return;
  const alvo = $('#remotas'), q = termo(false);
  try {
    const r = await fetch(API + '/api/remotas?q=' + encodeURIComponent(q));
    if (!r.ok || termo(false) !== q) return;
    const j = await r.json();
    if (!j.vagas.length) return;
    alvo.innerHTML = `<h2 class="titulo-sec">🌎 ${t().remotasAgora}</h2><div class="lista-vagas">${j.vagas.map(v => `
      <div class="vaga"><div><b>${esc(v.titulo)}</b><small>${esc(v.empresa)} · ${esc(v.local)}</small></div>
      <a class="btn prim" href="${esc(v.link)}" target="_blank" rel="noopener">${t().abrir}</a></div>`).join('')}</div>
      <p class="info">${t().fonte}: <a href="${esc(j.fonte_link)}" target="_blank" rel="noopener">${esc(j.fonte)}</a></p>`;
  } catch (e) { /* sem vagas remotas agora */ }
}

function render() {
  const x = t();
  document.documentElement.lang = idioma;
  document.querySelectorAll('.idiomas button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === idioma)));
  $('#mic').setAttribute('aria-label', x.falar); $('#dicaVoz').textContent = rec ? x.ouvindo : x.tocarFalar;
  $('#titulo').textContent = x.titulo; $('#subtitulo').textContent = x.subtitulo; $('#rodape').textContent = x.rodape;
  if (!audioLiberado) $('#comecar').textContent = x.comecar;
  $('#app').innerHTML = telaFiltros();
  atualizarResultado(); ligar(); rodarCarrossel();
}

let timerCarrossel = null;
function rodarCarrossel() {
  clearInterval(timerCarrossel);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timerCarrossel = setInterval(() => {
    const c = $('#carrossel'); if (!c || c.matches(':hover') || !c.firstElementChild) return;
    const fim = c.scrollLeft + c.clientWidth >= c.scrollWidth - 4;
    c.scrollTo({ left: fim ? 0 : c.scrollLeft + c.firstElementChild.offsetWidth + 12, behavior: 'smooth' });
  }, 4000);
}

// ---------- entender a fala ----------
export function entender(texto, catalogo = cat) {
  const s = ' ' + semAcento(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const tem = (p) => s.includes(' ' + semAcento(p) + ' ');
  const achar = (lista) => {
    let melhor = null, tam = 0;
    for (const item of lista) for (const p of (item.palavras || [])) if (tem(p) && p.length > tam) { melhor = item; tam = p.length; }
    return melhor;
  };
  const c = achar(catalogo.cidades), a = achar(catalogo.areas), p = achar(catalogo.periodos.filter(x => x.id));
  return { cidade: c ? c.id : '', area: a ? a.id : '', periodo: p ? p.id : '' };
}

async function perguntar(texto) {
  const x = t();
  $('#balao').textContent = '🎤 ' + texto + ' · ' + x.pensando;
  let r = entender(texto), resposta = null;
  if (online) {
    try {
      const resp = await fetch(API + '/api/perguntar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, idioma, ...busca }) });
      if (resp.ok) { const j = await resp.json(); r = { cidade: j.cidade || r.cidade, area: j.area || r.area, periodo: j.periodo ?? r.periodo, livre: j.livre || '' }; resposta = j.resposta || null; }
    } catch (e) { /* entende pela regra */ }
  }
  if (r.cidade) busca.cidade = r.cidade;
  if (r.area) { busca.area = r.area; busca.livre = ''; }
  if (r.livre) busca.livre = r.livre;
  if (r.periodo) busca.periodo = r.periodo;
  render();
  const c = cidade(), a = area(), p = periodo();
  if (!resposta) {
    if (!r.cidade && !r.area) resposta = x.naoEntendi;
    else if (!c) resposta = x.faltaCidade(txt(a.nome));
    else if (!a) resposta = x.faltaArea(c.nome);
    else resposta = x.achei(busca.livre || txt(a.nome), c.nome, p.id ? txt(p.nome) : '', linksDeBusca().length);
  }
  $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  falar(resposta);
}

// ---------- atendente 3D e voz (iPhone: volume volta para o alto-falante principal) ----------
function modoSom(tipo) { try { if (navigator.audioSession) navigator.audioSession.type = tipo; } catch (e) {} }
modoSom('playback');
let atendente = null, audioLiberado = false;
function vozDoIdioma() {
  const lang = LOCALE[idioma], vozes = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
  const nota = (v) => (v.lang.replace('_', '-') === lang ? 100 : v.lang.startsWith(lang.slice(0, 2)) ? 60 : 0) + (/female|mulher|mujer|francisca|tania|maria|luciana|paulina|helena|zira|samantha/i.test(v.name) ? 20 : 0) + (/natural|neural|online|premium|enhanced/i.test(v.name) ? 30 : 0);
  return { lang, voz: vozes.slice().sort((a, b) => nota(b) - nota(a))[0] };
}
async function iniciarAtendente() {
  $('#status').textContent = t().carregando;
  $('#comecar').hidden = true;
  try {
    const { Atendente } = await import('./atendente.js?v=' + VERSAO);
    atendente = new Atendente($('#avatar'));
    await atendente.carregar();
    $('#status').textContent = '';
  } catch (e) { console.warn('atendente 3D indisponível', e); atendente = null; $('#status').textContent = '🤖'; }
  $('#comecar').textContent = t().comecar;
  $('#comecar').hidden = audioLiberado;
}
async function falar(texto) {
  $('#balao').textContent = texto;
  modoSom('playback');
  const info = { ...vozDoIdioma(), dito: texto };
  if (atendente) { atendente.liberarAudio(); return atendente.falar(texto, info); }
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto); u.lang = info.lang; u.volume = 1; if (info.voz) u.voice = info.voz;
  speechSynthesis.speak(u);
}
function liberarAudio() {
  if (audioLiberado) return;
  audioLiberado = true; $('#comecar').hidden = true;
  if (atendente) atendente.liberarAudio();
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function ouvir() {
  liberarAudio();
  if (!SR) { $('#balao').textContent = t().semMic; return; }
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = LOCALE[idioma]; rec.interimResults = false;
  $('#mic').dataset.ouvindo = '1'; $('#dicaVoz').textContent = t().ouvindo;
  rec.onresult = (e) => { modoSom('playback'); const fala = e.results[0][0].transcript; if (fala) perguntar(fala); };
  rec.onend = rec.onerror = () => { modoSom('playback'); rec = null; $('#mic').dataset.ouvindo = ''; $('#dicaVoz').textContent = t().tocarFalar; };
  try { if (atendente) atendente.parar(); else if ('speechSynthesis' in window) speechSynthesis.cancel(); modoSom('play-and-record'); rec.start(); } catch (e) { rec = null; }
}

// ---------- eventos ----------
function ligar() {
  document.querySelectorAll('[data-cidade]').forEach(b => b.onclick = () => { busca.cidade = b.dataset.cidade; render(); });
  document.querySelectorAll('[data-area]').forEach(b => b.onclick = () => { busca.area = b.dataset.area; busca.livre = ''; render(); });
  document.querySelectorAll('[data-periodo]').forEach(b => b.onclick = () => { busca.periodo = b.dataset.periodo; render(); });
}
$('#mic').onclick = ouvir;
document.querySelectorAll('.idiomas button').forEach(b => b.onclick = () => { idioma = b.dataset.lang; gravar('bj.idioma', idioma); render(); });
$('#comecar').onclick = () => { liberarAudio(); if (atendente) atendente.acenar(); falar(t().ola); };

if (document.querySelector('#app')) {
  await carregar();
  iniciarAtendente();
  render();
}
