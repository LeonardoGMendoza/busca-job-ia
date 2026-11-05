import { useState } from 'react';

// Lista de espera do Premium: ainda não cobra nada, só mede o interesse e guarda o contato (opcional)
export default function Premium({ t, API, online, idioma }) {
  const [passo, setPasso] = useState('inicio');   // inicio | contato | pronto
  const [contato, setContato] = useState('');
  const enviar = async (comContato) => {
    if (online) {
      try { await fetch(API + '/api/interesse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plano: 'premium', contato: comContato ? contato : '', idioma }) }); } catch (e) { /* ignora */ }
    }
    setPasso(comContato ? 'pronto' : 'contato');
  };
  return (
    <section className="card premium" id="premium">
      <div className="premium-topo"><strong>BuscaJob Premium</strong><span className="selo">{t.emBreve}</span></div>
      <ul className="premium-lista">{t.premiumItens.map(i => <li key={i}>{i}</li>)}</ul>
      {passo === 'inicio' && <button type="button" className="btn btn-premium btn-largo" onClick={() => enviar(false)}>{t.querPremium}</button>}
      {passo === 'contato' && (
        <form className="premium-form" onSubmit={e => { e.preventDefault(); enviar(true); }}>
          <label className="campo-rotulo" htmlFor="contato-premium">{t.premiumContato}</label>
          <input id="contato-premium" value={contato} onChange={e => setContato(e.target.value)} placeholder="WhatsApp ou e-mail" maxLength={120} />
          <button className="btn btn-premium btn-largo" type="submit" disabled={!contato.trim()}>{t.premiumAvisar}</button>
        </form>
      )}
      {passo === 'pronto' && <p className="sub">{t.premiumObrigado}</p>}
    </section>
  );
}
