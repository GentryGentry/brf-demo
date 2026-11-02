// Year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Sticky nav (only meaningful on start page; harmless elsewhere)
const nav = document.getElementById('nav');
const onScroll = () => {
  if (!nav) return;
  if (window.scrollY > 40) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile menu
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Stäng meny' : 'Öppna meny');
  });
  navLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      document.body.classList.remove('menu-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Mark current page link as active
const path = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('[data-nav]').forEach(a => {
  const href = a.getAttribute('href');
  if (href === path) a.classList.add('active');
});

// Reveal on scroll
const reveal = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      reveal.unobserve(e.target);
    }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));

// Contact form
const form = document.getElementById('contactForm');
if (form) {
  const success = document.getElementById('formSuccess');
  const setError = (field, msg) => {
    field.classList.toggle('invalid', !!msg);
    field.querySelector('[data-err]').textContent = msg || '';
  };
  const validators = {
    name:    v => v.trim().length < 2 ? 'Ange ditt namn' : '',
    email:   v => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Ange en giltig e-postadress' : '',
    subject: v => v.trim().length < 2 ? 'Ange ett ämne' : '',
    message: v => v.trim().length < 10 ? 'Skriv minst 10 tecken' : '',
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    Object.entries(validators).forEach(([name, fn]) => {
      const input = form.elements[name];
      const field = input.closest('.field');
      const msg = fn(input.value);
      setError(field, msg);
      if (msg) ok = false;
    });
    if (ok) {
      success.classList.add('show');
      form.reset();
      setTimeout(() => success.classList.remove('show'), 6000);
    }
  });
  Object.keys(validators).forEach(name => {
    const input = form.elements[name];
    input.addEventListener('blur', () => {
      const field = input.closest('.field');
      if (field.classList.contains('invalid')) {
        const fn = validators[name];
        const msg = fn(input.value);
        field.classList.toggle('invalid', !!msg);
        field.querySelector('[data-err]').textContent = msg || '';
      }
    });
  });
}
