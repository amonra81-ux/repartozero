// Emblema: genera 36 raggi attorno al centro (i "canali" che irradiano dal nodo)
const rays = document.querySelector('.emblem .rays');
if (rays) {
  const cx = 200, cy = 200, rIn = 132, rOut = 150;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', cx + Math.cos(a) * rIn);
    l.setAttribute('y1', cy + Math.sin(a) * rIn);
    l.setAttribute('x2', cx + Math.cos(a) * rOut);
    l.setAttribute('y2', cy + Math.sin(a) * rOut);
    rays.appendChild(l);
  }
}

// Reparto Zero — JS minimo: menu mobile + lingua (segnaposto)
document.querySelector('.burger')?.addEventListener('click', () => {
  document.querySelector('.nav')?.classList.toggle('open');
});
// chiudi menu al click su una voce
document.querySelectorAll('.nav a').forEach(a =>
  a.addEventListener('click', () => document.querySelector('.nav')?.classList.remove('open'))
);
// toggle IT/EN (per ora solo visivo — la traduzione EN si aggiunge dopo)
document.querySelectorAll('.lang button').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.lang button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  })
);
