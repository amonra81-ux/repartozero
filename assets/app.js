// ===== Reparto Zero — lingua IT/EN funzionante =====
const langButtons = document.querySelectorAll('.lang button');

function setLang(lang){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-en]').forEach(el => {
    if (!el.dataset.it) el.dataset.it = el.textContent;        // salva l'italiano la prima volta
    el.textContent = (lang === 'en') ? el.dataset.en : el.dataset.it;
  });
  langButtons.forEach(b => b.classList.toggle('on', b.textContent.trim().toLowerCase() === lang));
}

langButtons.forEach(b =>
  b.addEventListener('click', () => setLang(b.textContent.trim().toLowerCase()))
);

// ===== menu mobile =====
document.querySelector('.burger')?.addEventListener('click', () => {
  document.querySelector('.nav')?.classList.toggle('open');
});
document.querySelectorAll('.nav a').forEach(a =>
  a.addEventListener('click', () => document.querySelector('.nav')?.classList.remove('open'))
);
