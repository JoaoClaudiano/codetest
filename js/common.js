/**
 * common.js — Utilitários compartilhados para páginas secundárias
 * (sobre, termos, privacidade, como-usar)
 */

const SVG_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const SVG_SUN  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

document.addEventListener('DOMContentLoaded', function () {
    // Sincronizar body.dark com html.dark (definido pelo script inline no head)
    if (document.documentElement.classList.contains('dark')) {
        document.body.classList.add('dark');
    }

    // Dark mode toggle
    const toggle = document.getElementById('darkToggle');
    if (toggle) {
        const updateToggle = () => {
            const dark = document.body.classList.contains('dark');
            toggle.innerHTML = dark ? SVG_SUN : SVG_MOON;
            toggle.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
            toggle.setAttribute('title',      dark ? 'Ativar modo claro' : 'Ativar modo escuro');
        };
        updateToggle();

        toggle.addEventListener('click', function () {
            document.body.classList.toggle('dark');
            document.documentElement.classList.toggle('dark');
            const isDark = document.body.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateToggle();
        });
    }

    // Scroll to top button
    const topBtn = document.getElementById('topBtn');
    if (topBtn) {
        window.addEventListener('scroll', function () {
            topBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
        }, { passive: true });
        topBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Auto-update copyright year
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ─── Pagination dots ──────────────────────────────────────────────────────
    (function initPageDots() {
        const sections = document.querySelectorAll('.page-content > section');
        if (sections.length < 2) return;

        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Navegação por seções');
        const ul = document.createElement('ul');
        ul.className = 'page-dots';

        sections.forEach(function (section, i) {
            const h2 = section.querySelector('h2');
            const label = (h2 && h2.textContent.trim()) || ('Seção ' + (i + 1));
            if (!section.id) section.id = 'section-' + i;

            const li  = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'page-dot';
            btn.title = label;
            btn.setAttribute('aria-label', label);
            btn.addEventListener('click', function () {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            li.appendChild(btn);
            ul.appendChild(li);
        });

        nav.appendChild(ul);
        document.body.appendChild(nav);

        const dots = ul.querySelectorAll('.page-dot');
        if (dots[0]) dots[0].classList.add('active');

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        const idx = Array.from(sections).indexOf(entry.target);
                        if (idx !== -1) {
                            dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
                        }
                    }
                });
            }, { threshold: 0.3 });

            sections.forEach(function (s) { observer.observe(s); });
        }
    }());
});
