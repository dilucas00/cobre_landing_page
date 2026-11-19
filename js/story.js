/* Cobre — a história contada pelo scroll (GSAP + ScrollTrigger + ScrollToPlugin).
   Capítulos ("faixas"), barra de navegação, véus de leitura, navegação suave por âncora
   e o menu tracklist do celular. Publica em window.Cobre o que a cena 3D precisa. */
(() => {
'use strict';
const { gsap, ScrollTrigger, ScrollToPlugin } = window;
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });       // a barra de endereço do celular não recalcula a página
const mq = matchMedia('(max-width: 760px)');
const isMob = () => mq.matches;
if (location.search.includes('dev')) gsap.ticker.lagSmoothing(0);   // só para testes em render por software

const TAU = Math.PI * 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const story = document.getElementById('story');
const sections = [...story.querySelectorAll('[data-cam]')];

/* ===================== HUD + revelação do texto ===================== */
let activeSide = 'l';
const hudN = document.getElementById('hudN'), hudName = document.getElementById('hudName');
const dock = document.getElementById('dock'), tkInd = document.getElementById('tkInd'), dlBtn = document.getElementById('dlBtn');
const tks = [...document.querySelectorAll('.tk')].map(a => { const [lo, hi = lo] = a.dataset.ch.split('-').map(Number); return { a, lo, hi }; });
let curCh = -1;
/* faixa atual: número, nome, link ativo (a pílula de cobre desliza até ele) e o equalizador do "tocando agora" */
function setChapter(i) {
  if (i === curCh) return;
  curCh = i;
  hudN.textContent = String(i + 1).padStart(2, '0');
  hudName.textContent = sections[i].dataset.name;
  if (!reduce) gsap.fromTo(hudName, { y: 7, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
  dock.classList.toggle('playing', i >= 2 && i <= sections.length - 2);   // agulha no disco
  dlBtn.classList.toggle('on', i === sections.length - 1);
  const hit = tks.find(t => i >= t.lo && i <= t.hi);
  tks.forEach(t => t === hit ? t.a.setAttribute('aria-current', 'true') : t.a.removeAttribute('aria-current'));
  if (!hit) { gsap.to(tkInd, { opacity: 0, duration: 0.35, ease: 'power2.out', overwrite: true }); return; }
  const to = { x: hit.a.offsetLeft, width: hit.a.offsetWidth, opacity: 1 };
  if (reduce || +gsap.getProperty(tkInd, 'opacity') < 0.05) gsap.set(tkInd, to);
  else gsap.to(tkInd, { ...to, duration: 0.6, ease: 'power3.out', overwrite: true });
}
/* ao sair do hero a barra vira pílula flutuante */
ScrollTrigger.create({ start: 60, end: 'max', onToggle: s => dock.classList.toggle('float', s.isActive) });
sections.forEach((sec, i) => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle: self => { if (self.isActive) { activeSide = sec.dataset.side; setChapter(i); } }
  });
  if (reduce) return;
  const panel = sec.querySelector('.panel');
  const isLast = i === sections.length - 1;
  if (i === 0) {                                   // hero: só sai, conforme a vitrola começa a se mover
    gsap.to([panel, sec.querySelector('.cue')], { opacity: 0, y: -70, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom 25%', scrub: true } });
    return;
  }
  // um capítulo por vez: entra, segura no centro da tela, sai antes do próximo chegar.
  // só opacity/transform: o texto continua no fluxo e acessível ao teclado.
  const mob = isMob();
  const t = gsap.timeline({ scrollTrigger: { trigger: panel, start: mob ? 'top 100%' : 'top 88%', end: isLast ? (mob ? 'top 45%' : 'top 30%') : (mob ? 'bottom 14%' : 'bottom 24%'), scrub: 0.6 } });
  t.fromTo(panel, { opacity: 0, y: 70 }, { opacity: 1, y: 0, ease: 'power2.out', duration: isLast ? 1 : 0.32 });
  if (!isLast) t.to(panel, { opacity: 1, duration: 0.36 }).to(panel, { opacity: 0, y: -70, ease: 'power2.in', duration: 0.32 });
});

/* ===================== navegação por âncora =====================
   O texto e a câmera de cada faixa ficam completos no CENTRO da seção, não no topo.
   O clique leva esse centro ao meio da tela numa rolagem longa e suave: a duração cresce
   com a distância, então de "Início" a "Como funciona" a câmera passeia pelas faixas. */
const centerOf = sec => sec === sections[0] ? 0 : Math.round(sec.offsetTop + sec.offsetHeight / 2 - innerHeight / 2);
const sectionFor = el => el.matches('[data-cam]') ? el : (el.closest('[data-cam]') || el.querySelector('[data-cam]'));
sections.forEach(s => { s.tabIndex = -1; });
function glideTo(sec, instant) {
  const y = centerOf(sec), dist = Math.abs(y - scrollY);
  const land = () => sec.focus({ preventScroll: true });   // leitor de tela e teclado continuam dali
  if (instant || reduce) { gsap.killTweensOf(window); scrollTo(0, y); land(); return; }
  gsap.to(window, {
    scrollTo: { y, autoKill: true },                       // a roda do mouse ou o toque interrompem na hora
    duration: gsap.utils.clamp(1.2, 3.6, 0.9 + (dist / innerHeight) * 0.3),
    ease: 'power2.inOut', overwrite: true, onComplete: land
  });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const target = document.querySelector(a.getAttribute('href'));
  const sec = target && sectionFor(target);
  if (!sec) return;
  e.preventDefault();                                     // sem # no endereço: recarregar volta ao início
  glideTo(sec);
});
/* ao carregar: recarregar começa sempre do início; um link externo com #downloads abre centralizado */
ScrollTrigger.clearScrollMemory('manual');               // o ScrollTrigger também guardava a posição e a restaurava
const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
const linked = location.hash && navType !== 'reload' && document.querySelector(location.hash);
const linkedSec = linked && sectionFor(linked);
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
const startY = () => linkedSec ? centerOf(linkedSec) : 0;  // sem mover o foco: nada de anel
scrollTo(0, startY());
addEventListener('load', () => { ScrollTrigger.clearScrollMemory('manual'); scrollTo(0, startY()); ScrollTrigger.update(); }, { once: true });

/* ===================== celular: tracklist do lado A =====================
   O menu lista as 11 faixas; a atual leva o equalizador. Tocar numa faixa fecha o menu e desliza até ela. */
const menuBtn = document.getElementById('menuBtn'), sheet = document.getElementById('sheet'), sheetList = document.getElementById('sheetList');
sheetList.innerHTML = sections.map((s, i) =>
  `<li><a href="#${s.id}" data-i="${i}"><span class="tn">${String(i + 1).padStart(2, '0')}</span><span>${s.dataset.name}</span><span class="eqb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></a></li>`).join('');
let menuOpen = false;
function setMenu(open, instant) {
  if (open === menuOpen) return;
  menuOpen = open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Fechar faixas' : 'Abrir faixas');
  document.documentElement.classList.toggle('menu-open', open);
  if (open) {
    sheet.hidden = false;
    sheetList.querySelectorAll('a').forEach(a => +a.dataset.i === curCh ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
    gsap.set(sheet, { autoAlpha: 1 });            // visível já: o foco precisa entrar no menu neste quadro
    if (!reduce) {                                 // o fade usa só opacity
      gsap.fromTo(sheet, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      gsap.fromTo(sheetList.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.03, ease: 'power3.out', delay: 0.05 });
    }
    (sheetList.querySelector('[aria-current]') || sheetList.querySelector('a')).focus({ preventScroll: true });
  } else {
    const hide = () => { sheet.hidden = true; };
    if (reduce || instant) { gsap.set(sheet, { autoAlpha: 0 }); hide(); }
    else gsap.to(sheet, { autoAlpha: 0, duration: 0.25, ease: 'power2.in', onComplete: hide });
    if (!instant) menuBtn.focus({ preventScroll: true });
  }
}
menuBtn.addEventListener('click', () => setMenu(!menuOpen));
sheet.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false, true); });   // fecha antes do deslize começar
addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) setMenu(false); });
mq.addEventListener('change', () => { if (!mq.matches) setMenu(false, true); });

/* véu de leitura: escurece o lado do texto na mesma medida em que o texto aparece */
const scrims = { l: document.getElementById('scrimL'), r: document.getElementById('scrimR'), c: document.getElementById('scrimC'), b: document.getElementById('scrimB') };
const panels = sections.map(s => [s.dataset.side, s.querySelector('.panel')]);
gsap.ticker.add(() => {
  const o = { l: 0, r: 0, c: 0, b: 0 }, side = k => isMob() ? 'b' : k;
  if (reduce) o[side(activeSide)] = 1;               // sem animação: só o véu do capítulo atual
  else for (const [sd, p] of panels) { const k = side(sd); o[k] = Math.max(o[k], +gsap.getProperty(p, 'opacity')); }
  for (const k in scrims) scrims[k].style.opacity = o[k].toFixed(3);
});
/* sulco de progresso: preenchimento + agulha luminosa acompanham o lado A inteiro */
const grooveFill = document.getElementById('hudBar'), needle = document.getElementById('needle');
ScrollTrigger.create({ trigger: story, start: 'top top', end: 'bottom bottom', onUpdate: st => {
  grooveFill.style.transform = 'scaleX(' + st.progress + ')'; needle.style.left = (st.progress * 100) + '%';
} });
setChapter(0);
if (!reduce) gsap.from('#inicio .rv', { autoAlpha: 0, y: 40, filter: 'brightness(.5)', duration: 1.2, stagger: 0.12, ease: 'power3.out', delay: 0.35 });

/* o que a cena 3D (scene.js) usa */
window.Cobre = { story, sections, reduce, isMob, TAU };
})();
