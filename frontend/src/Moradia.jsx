import { useEffect, useState } from 'react';
import { Pin, Externo, Info, Predio } from './icones.jsx';

// Moradia para estudantes: locais reais (Google Maps via servidor) + busca pronta nos portais de aluguel de cada país
export default function Moradia({ parte, cat, t, txt, API, ligada, cidadeId, setCidadeId, tipoId, setTipoId, registrar }) {
  const [locais, setLocais] = useState({ estado: 'parado', lista: [] });
  const cidades = cat.cidades.filter(c => c.pais !== 'REMOTO');
  const cidade = cidades.find(c => c.id === cidadeId);
  const tipo = cat.moradia.tipos.find(x => x.id === tipoId) || cat.moradia.tipos[0];
  const lingua = cidade ? (cidade.pais === 'BR' ? 'pt' : 'es') : 'pt';

  useEffect(() => {
    if (parte !== 'conteudo') return;
    if (!ligada || !cidade) { setLocais({ estado: 'parado', lista: [] }); return; }
    let vivo = true;
    setLocais(l => ({ ...l, estado: 'carregando' }));
    fetch(`${API}/api/moradia?cidade=${cidade.id}&tipo=${tipo.id}`).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(j => { if (vivo) setLocais({ estado: 'pronto', lista: j.locais || [] }); })
      .catch(() => { if (vivo) setLocais({ estado: 'erro', lista: [] }); });
    return () => { vivo = false; };
  }, [ligada, cidadeId, tipoId]);

  const portais = cidade ? [
    ...cat.moradia.portais[cidade.pais].map(p => ({
      ...p, url: `https://www.google.com/search?q=${encodeURIComponent(`${tipo.termo[lingua]} ${cidade.nome}`)}+site%3A${encodeURIComponent(p.dominio)}`
    })),
    { id: 'airbnb', nome: 'Airbnb (estadia de 1 mês ou mais)', dominio: 'airbnb.com', url: `https://www.airbnb.com/s/${encodeURIComponent(cidade.local)}/homes` }
  ] : [];

  if (parte === 'hero') return (
      <section className="hero">
        <div className="container">
          <h1>{t.morHeroTitulo}</h1>
          <p className="hero-sub">{t.morHeroSub}</p>
          <div className="barra-busca barra-moradia">
            <label className="campo">
              <span className="campo-rotulo">{t.local}</span>
              <span className="campo-input"><Pin />
                <select value={cidadeId} onChange={e => setCidadeId(e.target.value)}>
                  <option value="">{t.localPh}</option>
                  {Object.entries(cat.paises).filter(([id]) => id !== 'REMOTO').map(([id, p]) => (
                    <optgroup key={id} label={txt(p.nome)}>
                      {cidades.filter(c => c.pais === id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              </span>
            </label>
            <label className="campo">
              <span className="campo-rotulo">{t.morTipo}</span>
              <span className="campo-input"><Predio />
                <select value={tipo.id} onChange={e => setTipoId(e.target.value)}>
                  {cat.moradia.tipos.map(x => <option key={x.id} value={x.id}>{txt(x.nome)}</option>)}
                </select>
              </span>
            </label>
          </div>
        </div>
      </section>
  );

  return (
    <>
          {!cidade ? (
            <section className="card vazio"><h2>{t.morVazioTitulo}</h2><p>{t.morVazioTexto}</p></section>
          ) : (
            <>
              {ligada && (
                <section className="card">
                  <div className="card-cabeca">
                    <h2>{t.morLocais(cidade.nome)}</h2>
                    <p className="sub">{locais.estado === 'carregando' ? t.procurando2 : locais.lista.length ? t.morLocaisSub(locais.lista.length) : t.morNenhum}</p>
                  </div>
                  {locais.estado === 'carregando' && <ul className="vagas">{[0, 1, 2].map(i => <li key={i} className="vaga esqueleto"><div><span /><span /></div></li>)}</ul>}
                  {locais.estado === 'pronto' && locais.lista.length > 0 && (
                    <ul className="vagas">
                      {locais.lista.map(l => (
                        <li key={l.nome + l.endereco} className="vaga vaga-real">
                          <div>
                            <strong>{l.nome}</strong>
                            <span className="vaga-meta">{l.endereco}</span>
                            {(l.nota || l.telefone) && <span className="vaga-tags">
                              {l.nota && <span className="tag">★ {Number(l.nota).toFixed(1)} ({l.avaliacoes})</span>}
                              {l.telefone && <span className="tag">{l.telefone}</span>}
                            </span>}
                          </div>
                          <div className="acoes-local">
                            {l.telefone && <a className="btn btn-primario" href={`https://wa.me/${l.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={() => registrar('anuncio', 'moradia-zap')}>WhatsApp</a>}
                            {l.mapa && <a className="btn btn-secundario" href={l.mapa} target="_blank" rel="noopener noreferrer">{t.morMapa}</a>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
              <section className="card">
                <div className="card-cabeca"><h2>{t.morPortais(txt(tipo.nome).toLowerCase(), cidade.nome)}</h2><p className="sub">{t.morPortaisSub}</p></div>
                <ul className="portais">
                  {portais.map(p => (
                    <li key={p.id} className="portal">
                      <span className={`portal-logo logo-${p.id}`} aria-hidden="true">{p.nome.slice(0, 2).toUpperCase()}</span>
                      <div className="portal-info"><strong>{p.nome}</strong><span>{p.dominio}</span></div>
                      <a className="btn btn-secundario" href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => registrar('site', `moradia:${p.id}:${cidade.id}`)}>{t.morVer} <Externo width={15} height={15} /></a>
                    </li>
                  ))}
                </ul>
                <div className="nota nota-alerta"><Info /><span>{t.morGolpe}</span></div>
              </section>
            </>
          )}
    </>
  );
}
