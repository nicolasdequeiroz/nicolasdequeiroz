document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', function () {
    const isOpen = menu.classList.toggle('nav-menu--open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
});
