import { useState } from 'react';
import { listaHabilidades } from './compat.js';

// Perfil da pessoa (qualquer área): fica só no navegador e serve para dar a nota de compatibilidade às vagas reais
export default function Perfil({ t, perfil, setPerfil }) {
  const n = listaHabilidades(perfil.habilidades).length;
  const [aberto, setAberto] = useState(n === 0);   // abre sozinho na 1ª vez; depois quem decide é a pessoa
  return (
    <details className="card perfil" open={aberto} onToggle={e => setAberto(e.currentTarget.open)}>
      <summary>
        <strong>{t.perfilTitulo}</strong>
        {n > 0 && <span className="tag">{t.perfilAtivo(n)}</span>}
      </summary>
      <p className="sub">{t.perfilSub}</p>
      <label className="perfil-campo">
        <span className="campo-rotulo">{t.perfilHab}</span>
        <textarea rows={2} maxLength={600} value={perfil.habilidades} placeholder={t.perfilHabPh} onChange={e => setPerfil(p => ({ ...p, habilidades: e.target.value }))} />
      </label>
      <div className="perfil-linha">
        <label className="perfil-campo">
          <span className="campo-rotulo">{t.perfilNivel}</span>
          <select value={perfil.nivel} onChange={e => setPerfil(p => ({ ...p, nivel: e.target.value }))}>
            {Object.entries(t.perfilNiveis).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <label className="perfil-check">
          <input type="checkbox" checked={perfil.remoto} onChange={e => setPerfil(p => ({ ...p, remoto: e.target.checked }))} /> {t.perfilRemoto}
        </label>
        {(n > 0 || perfil.nivel) && <button type="button" className="btn btn-secundario" onClick={() => setPerfil({ habilidades: '', nivel: '', remoto: true })}>{t.perfilLimpar}</button>}
      </div>
    </details>
  );
}
