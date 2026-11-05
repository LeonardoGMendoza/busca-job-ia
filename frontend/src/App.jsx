import { useEffect, useMemo, useState } from 'react';
import { T, LOCALE } from './i18n.js';
import { cargoDigitado, entender, portais, termo } from './busca.js';
import { Busca, Pin, Maleta, Relogio, Externo, Info, Predio, Globo } from './icones.jsx';
import Assistente from './Assistente.jsx';
import Moradia from './Moradia.jsx';
import Premium from './Premium.jsx';

const VERSAO = 3;
const API_PADRAO = 'https://buscajob.sandlj.com.br';   // servidor na VPS com a IA da Oracle
function apiUrl() {
  const q = new URLSearchParams(location.search).get('api');
  try {
    if (q !== null) { localStorage.setItem('bj.api', q); return q; }
    const salvo = localStorage.getItem('bj.api');
    return salvo !== null ? salvo : API_PADRAO;
  } catch (e) { return q ?? API_PADRAO; }
}
const API = apiUrl().replace(/\/$/, '');
const ler = (k, p) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : p; } catch (e) { return p; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ } };
const MONOGRAMA = { computrabajo: 'CT', indeed: 'in', linkedin: 'in', google: 'G', wwr: 'WWR', remoteok: 'RO' };
const iniciais = (nome) => nome.replace(/\(.*\)/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const POPULARES = [
  { area: 'garcom', cidade: 'cde' }, { area: 'enfermagem', cidade: 'foz' }, { area: 'ti', cidade: 'remoto' },
  { area: 'limpeza', cidade: 'buenos-aires' }, { area: 'atendimento', cidade: 'asuncion' }, { area: 'eventos', cidade: 'lima' }
];

export default function App() {
  const lang0 = (navigator.language || 'pt').slice(0, 2);
  const [idioma, setIdioma] = useState(() => ler('bj.idioma', T[lang0] ? lang0 : 'pt'));
  const [cat, setCat] = useState(null);
  const [vagas, setVagas] = useState({ exemplo: true, vagas: [] });
  const [online, setOnline] = useState(false);
  const [busca, setBusca] = useState(() => ler('bj.busca2', { cidade: '', area: '', livre: '', periodo: '' }));
  const [cargoTexto, setCargoTexto] = useState('');
  const [remotas, setRemotas] = useState(null);
  const [reaisLigadas, setReaisLigadas] = useState(false);
  const [moradiaLigada, setMoradiaLigada] = useState(false);
  const [pagina, setPagina] = useState(() => (location.hash === '#moradia' ? 'moradia' : 'vagas'));
  const [morCidade, setMorCidade] = useState(() => ler('bj.morCidade', ''));
  const [morTipo, setMorTipo] = useState(() => ler('bj.morTipo', 'pensionato'));
  const [reais, setReais] = useState({ estado: 'parado', vagas: [], fontes: [] });
  const t = T[idioma];
  const txt = (o) => (o && (o[idioma] || o.pt)) || '';

  useEffect(() => { document.documentElement.lang = idioma; gravar('bj.idioma', idioma); }, [idioma]);
  useEffect(() => { gravar('bj.busca2', busca); }, [busca]);
  useEffect(() => { gravar('bj.morCidade', morCidade); gravar('bj.morTipo', morTipo); }, [morCidade, morTipo]);
  useEffect(() => { history.replaceState(null, '', pagina === 'moradia' ? '#moradia' : location.pathname + location.search); window.scrollTo(0, 0); }, [pagina]);

  useEffect(() => {
    (async () => {
      const c = await (await fetch(`./catalogo.json?v=${VERSAO}`, { cache: 'no-cache' })).json();
      setCat(c);
      if (API) {
        try {
          const r = await fetch(API + '/api/vagas', { cache: 'no-store' });
          if (r.ok) {
            setVagas(await r.json()); setOnline(true);
            fetch(API + '/api/saude').then(x => x.json()).then(j => { setReaisLigadas(!!j.vagas_reais); setMoradiaLigada(!!j.moradia); }).catch(() => {});
            return;
          }
        } catch (e) { /* sem servidor: exemplo local */ }
      }
      setVagas(await (await fetch(`./vagas-exemplo.json?v=${VERSAO}`, { cache: 'no-cache' })).json());
    })();
  }, []);

  const area = cat?.areas.find(a => a.id === busca.area);
  const cidade = cat?.cidades.find(c => c.id === busca.cidade);
  const nomeCargo = area ? txt(area.nome) : busca.livre;
  useEffect(() => { if (cat) setCargoTexto(nomeCargo || ''); }, [cat, busca.area, busca.livre, idioma]);   // campo acompanha a voz

  const links = useMemo(() => (cat ? portais(busca, cat) : []), [cat, busca]);
  const parceiras = useMemo(() => (vagas.vagas || []).filter(v => (!busca.cidade || v.cidade === busca.cidade) && (!busca.area || v.area === busca.area)), [vagas, busca]);

  // vagas remotas reais (Remote OK) quando o servidor está no ar
  useEffect(() => {
    setRemotas(null);
    if (!online || !cat || busca.cidade !== 'remoto') return;
    const q = termo(busca, cat, false);
    if (!q) return;
    let vivo = true;
    fetch(`${API}/api/remotas?q=${encodeURIComponent(q)}`).then(r => (r.ok ? r.json() : null)).then(j => { if (vivo && j) setRemotas(j); }).catch(() => {});
    return () => { vivo = false; };
  }, [online, cat, busca]);

  // vagas reais (JSearch/Google Vagas + Jooble) buscadas pelo servidor
  useEffect(() => {
    if (!reaisLigadas || !busca.cidade || !(busca.area || busca.livre)) { setReais({ estado: 'parado', vagas: [], fontes: [] }); return; }
    let vivo = true;
    setReais(r => ({ ...r, estado: 'carregando' }));
    const p = new URLSearchParams({ cidade: busca.cidade, area: busca.area || '', livre: busca.area ? '' : busca.livre, periodo: busca.periodo || '' });
    const espera = setTimeout(() => {
      fetch(`${API}/api/buscar?${p}`).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(j => { if (vivo) setReais({ estado: 'pronto', vagas: j.vagas || [], fontes: j.fontes || [] }); })
        .catch(() => { if (vivo) setReais({ estado: 'erro', vagas: [], fontes: [] }); });
    }, 350);
    return () => { vivo = false; clearTimeout(espera); };
  }, [reaisLigadas, busca]);

  const registrar = (tipo, id) => {
    if (!online) return;
    try { fetch(API + '/api/clique', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, id }), keepalive: true }); } catch (e) { /* ignora */ }
  };

  function enviarBusca(e) {
    e.preventDefault();
    const c = cargoDigitado(cargoTexto, cat);
    setBusca(b => ({ ...b, ...c }));
  }

  // voz: a área nova SEMPRE substitui a anterior (não fica presa em "TI")
  async function perguntar(texto) {
    const s0 = ' ' + texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ') + ' ';
    const falaMoradia = cat.moradia.palavras.some(p => s0.includes(' ' + p + ' ')) && !/\b(vaga|vagas|emprego|trabalh|trabaj|empleo|job)/.test(s0);
    if (falaMoradia) {
      const r0 = entender(texto, cat);
      const tipo = cat.moradia.tipos.find(x => x.palavras.some(p => s0.includes(' ' + p + ' ')));
      const cid = r0.cidade && r0.cidade !== 'remoto' ? r0.cidade : morCidade;
      if (cid) setMorCidade(cid);
      if (tipo) setMorTipo(tipo.id);
      setPagina('moradia');
      const c = cat.cidades.find(x => x.id === cid);
      return c ? t.morAchei(txt((tipo || cat.moradia.tipos.find(x => x.id === morTipo)).nome).toLowerCase(), c.nome) : t.morFaltaCidade;
    }
    let r = entender(texto, cat), resposta = null;
    if (online) {
      try {
        const resp = await fetch(API + '/api/perguntar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, idioma, cidade: busca.cidade, area: busca.area, periodo: busca.periodo }) });
        if (resp.ok) { const j = await resp.json(); r = { cidade: j.cidade, area: j.area, periodo: j.periodo, livre: j.livre || '' }; resposta = j.resposta; }
      } catch (e) { /* entende pela regra */ }
    }
    const nova = { ...busca };
    if (r.cidade) nova.cidade = r.cidade;
    if (r.periodo) nova.periodo = r.periodo;
    if (r.area) { nova.area = r.area; nova.livre = ''; } else if (r.livre) { nova.area = ''; nova.livre = r.livre; }
    setBusca(nova);
    setPagina('vagas');
    document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (resposta) return resposta;
    const a = cat.areas.find(x => x.id === nova.area), c = cat.cidades.find(x => x.id === nova.cidade);
    const cargo = a ? txt(a.nome) : nova.livre;
    if (!r.cidade && !r.area && !r.livre) return t.naoEntendi;
    if (!c) return t.faltaCidade(cargo);
    if (!cargo) return t.faltaCargo(c.nome);
    return t.achei(cargo.toLowerCase(), c.nome, portais(nova, cat).length);
  }

  if (!cat) return <div className="carregando-pagina">BuscaJob IA…</div>;
  const periodo = cat.periodos.find(p => p.id === busca.periodo);
  const banners = cat.anuncios.filter(a => a.ativo && a.tipo === 'banner' && a.id !== 'anuncie');
  const promos = cat.anuncios.filter(a => a.ativo && a.tipo === 'promo');
  const zap = cat.anuncie?.whatsapp;

  return (
    <>
      <header className="topo">
        <div className="container topo-linha">
          <a className="marca" href="./"><span className="marca-logo"><Maleta /></span>BuscaJob<span className="marca-ia">IA</span></a>
          <nav className="nav">
            <button type="button" className={`aba ${pagina === 'vagas' ? 'ativa' : ''}`} onClick={() => setPagina('vagas')}>{t.nav.vagas}</button>
            <button type="button" className={`aba ${pagina === 'moradia' ? 'ativa' : ''}`} onClick={() => setPagina('moradia')}>{t.nav.moradia}</button>
            <a className="nav-empresas" href={zap ? `https://wa.me/${zap}` : '#anuncie'}>{t.nav.empresas}</a>
            <button type="button" className="btn btn-premium btn-premium-topo" onClick={() => { setPagina('vagas'); setTimeout(() => document.getElementById('premium')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}>Premium</button>
            <select className="idioma" value={idioma} onChange={e => setIdioma(e.target.value)} aria-label="Idioma">
              <option value="pt">Português</option><option value="es">Español</option><option value="en">English</option>
            </select>
          </nav>
        </div>
      </header>

      <section className="hero" hidden={pagina !== 'vagas'}>
        <div className="container">
          <h1>{t.heroTitulo}</h1>
          <p className="hero-sub">{t.heroSub}</p>
          <form className="barra-busca" onSubmit={enviarBusca}>
            <label className="campo">
              <span className="campo-rotulo">{t.cargo}</span>
              <span className="campo-input"><Busca /><input list="lista-cargos" value={cargoTexto} onChange={e => setCargoTexto(e.target.value)} placeholder={t.cargoPh} /></span>
              <datalist id="lista-cargos">{cat.areas.map(a => <option key={a.id} value={txt(a.nome)} />)}</datalist>
            </label>
            <label className="campo">
              <span className="campo-rotulo">{t.local}</span>
              <span className="campo-input"><Pin />
                <select value={busca.cidade} onChange={e => setBusca(b => ({ ...b, cidade: e.target.value }))}>
                  <option value="">{t.localPh}</option>
                  {Object.entries(cat.paises).map(([id, p]) => (
                    <optgroup key={id} label={txt(p.nome)}>
                      {cat.cidades.filter(c => c.pais === id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              </span>
            </label>
            <label className="campo campo-curto">
              <span className="campo-rotulo">{t.jornada}</span>
              <span className="campo-input"><Relogio />
                <select value={busca.periodo} onChange={e => setBusca(b => ({ ...b, periodo: e.target.value }))}>
                  {cat.periodos.map(p => <option key={p.id} value={p.id}>{p.id ? txt(p.nome) : t.qualquer}</option>)}
                </select>
              </span>
            </label>
            <button className="btn btn-primario btn-buscar" type="submit">{t.buscar}</button>
          </form>
          <div className="populares"><span>{t.populares}:</span>
            {POPULARES.map(p => {
              const a = cat.areas.find(x => x.id === p.area), c = cat.cidades.find(x => x.id === p.cidade);
              return <button key={p.area + p.cidade} type="button" className="link-popular" onClick={() => setBusca(b => ({ ...b, area: p.area, livre: '', cidade: p.cidade }))}>{txt(a.nome)} · {c.nome}</button>;
            })}
          </div>
        </div>
      </section>

      {pagina === 'moradia' && <Moradia parte="hero" cat={cat} t={t} txt={txt} API={API} ligada={moradiaLigada} cidadeId={morCidade} setCidadeId={setMorCidade} tipoId={morTipo} setTipoId={setMorTipo} registrar={registrar} />}

      <main className="container layout">
        <div className="coluna-principal" id="resultados" hidden={pagina !== 'vagas'}>
          {reais.estado !== 'parado' && links.length > 0 && (
            <section className="card">
              <div className="card-cabeca">
                <h2>{t.encontradas(nomeCargo.toLowerCase(), cidade.nome)}</h2>
                <p className="sub">{reais.estado === 'carregando' ? t.procurando : reais.vagas.length ? t.encontradasSub(reais.vagas.length, reais.fontes.join(' + ')) : t.nenhumaReal}</p>
              </div>
              {reais.estado === 'carregando' && <ul className="vagas">{[0, 1, 2].map(i => <li key={i} className="vaga esqueleto"><div><span /><span /></div></li>)}</ul>}
              {reais.estado === 'pronto' && reais.vagas.length > 0 && (
                <ul className="vagas">
                  {reais.vagas.map(v => (
                    <li key={v.link} className="vaga vaga-real">
                      <div>
                        <strong>{v.titulo}</strong>
                        <span className="vaga-meta">{[v.empresa, v.local, v.fonte, v.data && new Date(v.data + 'T12:00').toLocaleDateString(LOCALE[idioma])].filter(Boolean).join(' · ')}</span>
                        {(v.salario || v.tipo) && <span className="vaga-tags">{v.salario && <span className="tag">{v.salario}</span>}{v.tipo && <span className="tag">{v.tipo}</span>}</span>}
                        {v.resumo && <p className="vaga-resumo">{v.resumo}…</p>}
                      </div>
                      <a className="btn btn-primario" href={v.link} target="_blank" rel="noopener noreferrer" onClick={() => registrar('vaga', 'real:' + v.fonte)}>{t.candidatar}</a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {links.length ? (
            <section className="card">
              <div className="card-cabeca">
                <div>
                  <h2>{reais.estado !== 'parado' ? t.maisPortais : t.resultados(nomeCargo.toLowerCase(), cidade.nome)}{periodo?.id ? ` · ${txt(periodo.nome)}` : ''}</h2>
                  <p className="sub">{t.portaisSub}</p>
                </div>
              </div>
              <ul className="portais">
                {links.map(l => (
                  <li key={l.id} className="portal">
                    <span className={`portal-logo logo-${l.id.split('_')[0]}`} aria-hidden="true">{MONOGRAMA[l.id.split('_')[0]] || iniciais(l.nome)}</span>
                    <div className="portal-info"><strong>{l.nome}</strong><span>{l.dominio}</span></div>
                    <a className="btn btn-secundario" href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => registrar('site', `${l.id}:${busca.cidade}:${busca.area || busca.livre}`)}>
                      {t.verVagas} <Externo width={15} height={15} />
                    </a>
                  </li>
                ))}
              </ul>
              <div className="nota"><Info /><span>{cidade.pais === 'REMOTO' ? t.avisoRemoto : t.avisoEstudante}</span></div>
            </section>
          ) : (
            <section className="card vazio">
              <h2>{t.vazioTitulo}</h2>
              <p>{t.vazioTexto}</p>
            </section>
          )}

          {remotas?.vagas?.length > 0 && (
            <section className="card">
              <div className="card-cabeca"><h2><Globo /> {t.remotas}</h2></div>
              <ul className="vagas">
                {remotas.vagas.map(v => (
                  <li key={v.link} className="vaga">
                    <div><strong>{v.titulo}</strong><span className="vaga-meta">{v.empresa} · {v.local}{v.data ? ` · ${v.data}` : ''}</span></div>
                    <a className="btn btn-secundario" href={v.link} target="_blank" rel="noopener noreferrer">{t.verVagas}</a>
                  </li>
                ))}
              </ul>
              <p className="fonte">{t.fonte}: <a href={remotas.fonte_link} target="_blank" rel="noopener noreferrer">{remotas.fonte}</a></p>
            </section>
          )}

          {/* vagas publicadas por empresas parceiras: só aparecem quando são reais; até lá, um convite discreto */}
          {!vagas.exemplo && parceiras.length > 0 ? (
            <section className="card">
              <div className="card-cabeca"><h2><Predio /> {t.parceiros}</h2></div>
              <ul className="vagas">
                {parceiras.map(v => {
                  const c = cat.cidades.find(x => x.id === v.cidade), p = cat.periodos.find(x => x.id === v.periodo);
                  const contato = v.link || (v.contato ? `https://wa.me/${v.contato}` : '');
                  return (
                    <li key={v.id} className="vaga">
                      <div>
                        <strong>{txt(v.titulo)}</strong>
                        <span className="vaga-meta">{v.empresa} · {c?.nome}{p?.id ? ` · ${txt(p.nome)}` : ''}{v.publicada ? ` · ${t.publicada} ${new Date(v.publicada + 'T12:00').toLocaleDateString(LOCALE[idioma])}` : ''}</span>
                      </div>
                      {contato && <a className="btn btn-primario" href={contato} target="_blank" rel="noopener noreferrer" onClick={() => registrar('vaga', v.id)}>{t.candidatar}</a>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <a className="card convite-empresa" href={zap ? `https://wa.me/${zap}` : undefined}>
              <Predio />
              <span><strong>{t.conviteTitulo}</strong><small>{t.conviteTexto}</small></span>
            </a>
          )}
        </div>
        {pagina === 'moradia' && <div className="coluna-principal"><Moradia parte="conteudo" cat={cat} t={t} txt={txt} API={API} ligada={moradiaLigada} cidadeId={morCidade} setCidadeId={setMorCidade} tipoId={morTipo} setTipoId={setMorTipo} registrar={registrar} /></div>}

        <aside className="coluna-lateral">
          {/* a assistente fica sempre montada: não recarrega o 3D ao trocar de aba */}
          <Assistente idioma={idioma} t={t} onPergunta={perguntar} />
          {pagina === 'vagas' && <Premium t={t} API={API} online={online} idioma={idioma} />}

          <section className="card patrocinado" id="anuncie">
            <span className="rotulo-pequeno">{t.patrocinado}</span>
            <ul className="parceiros">
              {banners.map(a => (
                <li key={a.id}>
                  <a href={a.link} target="_blank" rel="noopener sponsored" onClick={() => registrar('anuncio', a.id)}>
                    <span className="parceiro-logo" style={{ background: a.cor }}>{iniciais(txt(a.titulo))}</span>
                    <span><strong>{txt(a.titulo)}</strong><small>{txt(a.texto)}</small></span>
                  </a>
                </li>
              ))}
            </ul>
            <a className="anuncie" href={zap ? `https://wa.me/${zap}` : undefined}><strong>{t.anuncie}</strong><small>{t.anuncieTexto}</small></a>
          </section>

          {promos.length > 0 && (
            <section className="card">
              <span className="rotulo-pequeno">{t.uniformes}</span>
              <div className="promos">
                {promos.map(a => {
                  const conteudo = <><span className="promo-selo" style={{ background: a.cor }}>{a.selo}</span><strong>{txt(a.titulo)}</strong><small>{txt(a.texto)} ›</small></>;
                  return a.link
                    ? <a key={a.id} className="promo" style={{ backgroundImage: `url('${a.imagem}')` }} href={a.link} target="_blank" rel="noopener sponsored" onClick={() => registrar('anuncio', a.id)}>{conteudo}</a>
                    : <div key={a.id} className="promo" style={{ backgroundImage: `url('${a.imagem}')` }}>{conteudo}</div>;
                })}
              </div>
            </section>
          )}
        </aside>
      </main>

      <footer className="rodape"><div className="container">{t.rodape}</div></footer>
    </>
  );
}
