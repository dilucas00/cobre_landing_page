/* Cobre — demos interativos dos recursos (capas, equalizador, chips).
   Independe do 3D: funciona mesmo sem WebGL. */
'use strict';
(() => {
  const circ = document.getElementById('circles');
  circ.innerHTML = ['#c9773f','#6b2d12','#2d4a6b','#7a2d5a','#2d6b4a','#d9b04a']
    .map(c => `<button type="button" style="background:radial-gradient(circle at 35% 30%,${c},#111)" aria-label="Capa de exemplo"></button>`).join('');
  document.getElementById('eq').innerHTML = [40,55,70,50,35,60,75,45]
    .map(v => `<input type="range" min="0" max="100" value="${v}" aria-label="Banda do equalizador (demonstração)">`).join('');
  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { chip.parentNode.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); chip.classList.add('on'); }
    const cv = e.target.closest('.circles button');
    if (cv) { cv.parentNode.querySelectorAll('button').forEach(x => x.classList.remove('s')); cv.classList.add('s'); }
  });
})();
