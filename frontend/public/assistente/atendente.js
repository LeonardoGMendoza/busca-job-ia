// Atendente 3D que fala (mesma técnica do StudentMedical/VinaCare: TalkingHead + boca sincronizada com a voz do aparelho).
import { TalkingHead } from './talkinghead/talkinghead.mjs';
import { LipsyncPt_br } from './talkinghead/lipsync-pt_br.mjs';

const AVATAR = {
  url: new URL('avatars/avaturn.glb', document.baseURI).href, body: 'F', avatarMood: 'happy', lipsyncLang: 'pt_br',
  retarget: { Hips: { y: 0.03 }, Spine: { y: 0.02 }, Spine1: { y: 0.02, z: 0.01 }, Spine2: { y: 0.02, z: 0.01 }, Neck: { z: 0.02, y: 0.01 }, Head: { z: 0.02 }, LeftShoulder: { rx: -0.5 }, RightShoulder: { rx: -0.5 }, scaleToHipsLevel: 1.0 },
  baseline: { headRotateX: -0.05, eyeBlinkLeft: 0.15, eyeBlinkRight: 0.15 }
};

function tempos(texto) {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  const wtimes = [], wdurations = [];
  let t = 120;
  for (const w of palavras) {
    const n = w.replace(/[^\p{L}\p{N}]/gu, '').length || 1;
    const d = Math.max(170, n * 72);
    wtimes.push(t); wdurations.push(d);
    t += d + (/[.,!?;:]$/.test(w) ? 260 : 50);
  }
  return { palavras, wtimes, wdurations, total: t + 200 };
}

export class Atendente {
  constructor(caixa) {
    this.head = new TalkingHead(caixa, {
      lipsyncModules: [], lipsyncLang: 'pt_br', cameraView: 'upper', avatarMood: 'happy', modelFPS: 30,
      cameraRotateEnable: false, cameraZoomEnable: false, cameraPanEnable: false
    });
    this.head.lipsync['pt_br'] = new LipsyncPt_br();
  }

  async carregar(onProgresso) {
    await this.head.showAvatar(AVATAR, onProgresso);
    this.head.setView('upper');
  }

  liberarAudio() { try { this.head.audioCtx.resume(); } catch (e) {} }
  acenar() { try { this.head.playGesture('handup', 2); } catch (e) {} }
  joinha() { try { this.head.playGesture('thumbup', 2); } catch (e) {} }

  _maos(on) {
    clearInterval(this._timer);
    if (on) this._timer = setInterval(() => { try { this.head.speakWithHands(0, 0.7); } catch (e) {} }, 1600);
  }

  parar() {
    this._maos(false);
    try { this.head.stopSpeaking(); } catch (e) {}
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // fala com a voz do aparelho e mexe a boca no mesmo ritmo
  falar(texto, vozInfo) {
    const tm = tempos(texto), ctx = this.head.audioCtx;
    const labios = () => {
      try {
        const mudo = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * tm.total / 1000), ctx.sampleRate);
        this.head.speakAudio({ audio: mudo, words: tm.palavras, wtimes: tm.wtimes, wdurations: tm.wdurations }, { lipsyncLang: 'pt_br' });
      } catch (e) {}
    };
    return new Promise((ok) => {
      let fim = false, comecou = false;
      const acabar = () => { if (!fim) { fim = true; this._maos(false); ok(); } };
      this._maos(true);
      if (!('speechSynthesis' in window)) { labios(); setTimeout(acabar, tm.total); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(vozInfo.dito || texto);
      u.lang = vozInfo.lang; u.rate = 0.97; u.volume = 1;
      if (vozInfo.voz) u.voice = vozInfo.voz;
      u.onstart = () => { if (!comecou) { comecou = true; labios(); } };
      u.onend = acabar; u.onerror = acabar;
      setTimeout(() => { if (!comecou) { comecou = true; labios(); } }, 700);
      setTimeout(acabar, tm.total + 4000);
      speechSynthesis.speak(u);
    });
  }
}
