/**
 * common.js — Utilitários compartilhados para páginas secundárias
 * (sobre, termos, privacidade)
 */

// ─── FOUC Fix — aplicado via inline script no <head> de cada página ─────────
// Este arquivo complementa o script inline; executa lógica de toggle e scroll.

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
            toggle.textContent = dark ? '☀️' : '🌙';
            toggle.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
            toggle.setAttribute('title', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
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
});
