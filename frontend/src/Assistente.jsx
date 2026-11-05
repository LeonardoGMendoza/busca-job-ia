import { useEffect, useRef, useState } from 'react';
import { LOCALE } from './i18n.js';
import { Mic } from './icones.jsx';

// iPhone: depois do microfone o iOS manda o som para o alto-falante de ligação (baixinho). Voltamos para "playback".
const modoSom = (tipo) => { try { if (navigator.audioSession) navigator.audioSession.type = tipo; } catch (e) { /* sem suporte */ } };
modoSom('playback');

function vozDoIdioma(idioma) {
  const lang = LOCALE[idioma], vozes = 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
  const nota = (v) => (v.lang.replace('_', '-') === lang ? 100 : v.lang.startsWith(lang.slice(0, 2)) ? 60 : 0)
    + (/female|mulher|mujer|francisca|tania|maria|luciana|paulina|helena|zira|samantha/i.test(v.name) ? 20 : 0)
    + (/natural|neural|online|premium|enhanced/i.test(v.name) ? 30 : 0);
  return { lang, voz: vozes.slice().sort((a, b) => nota(b) - nota(a))[0] };
}

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function Assistente({ idioma, t, onPergunta }) {
  const caixa = useRef(null), atendente = useRef(null), rec = useRef(null);
  const [status, setStatus] = useState('carregando');   // carregando | pronto | sem3d
  const [ativo, setAtivo] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [balao, setBalao] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const url = new URL('assistente/atendente.js', document.baseURI).href;
        const { Atendente } = await import(/* @vite-ignore */ url);
        const a = new Atendente(caixa.current);
        await a.carregar();
        if (vivo) { atendente.current = a; setStatus('pronto'); }
      } catch (e) { console.warn('assistente 3D indisponível', e); if (vivo) setStatus('sem3d'); }
    })();
    return () => { vivo = false; };
  }, []);

  async function falar(texto) {
    setBalao(texto);
    modoSom('playback');
    const info = { ...vozDoIdioma(idioma), dito: texto };
    if (atendente.current) { atendente.current.liberarAudio(); return atendente.current.falar(texto, info); }
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto); u.lang = info.lang; u.volume = 1; if (info.voz) u.voice = info.voz;
    speechSynthesis.speak(u);
  }

  function ativar() {
    if (ativo) return;
    setAtivo(true);
    if (atendente.current) { atendente.current.liberarAudio(); atendente.current.acenar(); }
    falar(t.ola);
  }

  function ouvir() {
    if (!ativo) { setAtivo(true); if (atendente.current) atendente.current.liberarAudio(); }
    if (!SR) { setBalao(t.semMic); return; }
    if (rec.current) { rec.current.stop(); return; }
    const r = new SR(); r.lang = LOCALE[idioma]; r.interimResults = false;
    r.onresult = async (e) => {
      modoSom('playback');
      const fala = e.results[0][0].transcript;
      if (!fala) return;
      setBalao(`“${fala}” · ${t.pensando}`);
      const resposta = await onPergunta(fala);
      falar(resposta);
    };
    r.onend = r.onerror = () => { modoSom('playback'); rec.current = null; setOuvindo(false); };
    try {
      if (atendente.current) atendente.current.parar(); else if ('speechSynthesis' in window) speechSynthesis.cancel();
      modoSom('play-and-record'); r.start(); rec.current = r; setOuvindo(true);
    } catch (e) { rec.current = null; }
  }

  return (
    <section className="card assistente" aria-labelledby="tit-assistente">
      <div className="assistente-topo">
        <div>
          <h2 id="tit-assistente">{t.assistente}</h2>
          <p>{t.assistenteSub}</p>
        </div>
        <span className={`ponto ${status === 'pronto' ? 'on' : ''}`} aria-hidden="true" />
      </div>
      <div className="palco">
        <div ref={caixa} className="avatar" />
        {status === 'carregando' && <div className="palco-status">{t.carregando}</div>}
        {balao && <div className="balao" aria-live="polite">{balao}</div>}
      </div>
      <div className="assistente-acoes">
        <button type="button" className={`btn btn-primario btn-largo ${ouvindo ? 'ouvindo' : ''}`} onClick={ouvir} aria-pressed={ouvindo}>
          <Mic /> {ouvindo ? t.ouvindo : t.falar}
        </button>
        {!ativo && <button type="button" className="btn btn-link" onClick={ativar}>{t.comecar}</button>}
      </div>
    </section>
  );
}
