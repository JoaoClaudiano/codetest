/**
 * app.js — Inicialização da página principal
 * Gerencia: CodeMirror, layout, dark mode, viewport emulator, auto-analyze,
 * scroll-to-top e carregamento de código via URL hash.
 */

(function () {
    // ─── Helpers ─────────────────────────────────────────────────────────────

    function isDarkMode() {
        return document.documentElement.classList.contains('dark');
    }

    function syncBodyDark() {
        document.body.classList.toggle('dark', isDarkMode());
    }

    // ─── CodeMirror — instâncias globais ─────────────────────────────────────

    const theme = isDarkMode() ? 'monokai' : 'default';

    const cmOpts = (mode, extra) => Object.assign({
        theme,
        lineNumbers: true,
        lineWrapping: false,
        matchBrackets: true,
        closeBrackets: true,
        tabSize: 4,
        indentWithTabs: false,
        extraKeys: {
            Tab: cm => cm.execCommand('indentMore'),
            'Ctrl-Space': 'autocomplete'
        }
    }, { mode }, extra);

    /* exported cmHtml, cmCss, cmJs */
    window.cmHtml = CodeMirror(document.getElementById('cmHtml'), cmOpts('htmlmixed', { autoCloseTags: true }));
    window.cmCss  = CodeMirror(document.getElementById('cmCss'),  cmOpts('css'));
    window.cmJs   = CodeMirror(document.getElementById('cmJs'),   cmOpts('javascript'));

    // ─── Restaurar código salvo ───────────────────────────────────────────────

    const saved = localStorage.getItem('savedHTML') || '';
    if (saved) cmHtml.setValue(saved);

    // Carregar via URL hash: #code=<lz-string>
    if (location.hash.startsWith('#code=')) {
        try {
            const raw = location.hash.slice(6);
            const decoded = (typeof LZString !== 'undefined')
                ? LZString.decompressFromEncodedURIComponent(raw)
                : decodeURIComponent(atob(raw));
            if (decoded) {
                cmHtml.setValue(decoded);
                setTimeout(() => analyzeHTML(), 400);
            }
        } catch (_) { /* hash inválido — ignorar */ }
    }

    // ─── Tabs de linguagem ────────────────────────────────────────────────────

    const cmMap = { html: cmHtml, css: cmCss, js: cmJs };

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            document.querySelectorAll('.editor-tab').forEach(t => {
                t.classList.remove('active');
                t.hidden = true;
            });
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            const tab = this.dataset.tab;
            const panel = document.getElementById('editor-' + tab);
            panel.classList.add('active');
            panel.hidden = false;
            // Forçar re-render do CM ao ficar visível
            requestAnimationFrame(() => cmMap[tab].refresh());
        });
    });

    // ─── Layout switcher ─────────────────────────────────────────────────────

    const layoutBtns = document.querySelectorAll('.layout-btn');
    const editorArea = document.getElementById('editorPreviewArea');

    layoutBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            layoutBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            editorArea.className = this.dataset.layout + '-layout';
            localStorage.setItem('layoutPreference', this.dataset.layout);
            setTimeout(() => { cmHtml.refresh(); cmCss.refresh(); cmJs.refresh(); }, 60);
        });
    });

    const savedLayout = localStorage.getItem('layoutPreference') || 'split';
    const layoutBtn   = document.querySelector(`[data-layout="${savedLayout}"]`);
    if (layoutBtn) layoutBtn.click();

    // ─── Dark mode ────────────────────────────────────────────────────────────

    const darkToggle = document.getElementById('darkToggle');

    function updateDarkUI() {
        syncBodyDark();
        const dark = isDarkMode();
        const moonIcon = document.getElementById('iconMoon');
        const sunIcon  = document.getElementById('iconSun');
        if (moonIcon) moonIcon.style.display = dark ? 'none' : '';
        if (sunIcon)  sunIcon.style.display  = dark ? '' : 'none';
        darkToggle.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
        const t = dark ? 'monokai' : 'default';
        cmHtml.setOption('theme', t);
        cmCss.setOption('theme', t);
        cmJs.setOption('theme', t);
    }

    updateDarkUI(); // sincronizar com estado já aplicado no <head>

    darkToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const dark = isDarkMode();
        localStorage.setItem('theme', dark ? 'dark' : 'light');
        updateDarkUI();
    });

    // ─── Viewport emulator ────────────────────────────────────────────────────

    const previewFrame     = document.getElementById('previewFrame');
    const previewContainer = document.getElementById('previewContainer');

    document.querySelectorAll('.viewport-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.viewport-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const w = this.dataset.width;
            if (w === '100%') {
                previewFrame.style.width    = '100%';
                previewContainer.style.overflow = 'hidden';
            } else {
                previewFrame.style.width    = w + 'px';
                previewContainer.style.overflow = 'auto';
            }
        });
    });

    // ─── Auto-analyze (debounce) ──────────────────────────────────────────────

    let autoEnabled  = true;
    let debounceT    = null;

    cmHtml.on('change', () => {
        localStorage.setItem('savedHTML', cmHtml.getValue());
        if (autoEnabled) {
            clearTimeout(debounceT);
            debounceT = setTimeout(() => analyzeHTML(), 700);
        }
    });

    // CSS e JS: atualiza preview E dispara análise da linguagem ativa
    let debounceCSS = null;
    let debounceJS  = null;

    cmCss.on('change', () => {
        clearTimeout(debounceCSS);
        debounceCSS = setTimeout(() => analyzeHTML(), 500);
    });

    cmJs.on('change', () => {
        clearTimeout(debounceJS);
        debounceJS = setTimeout(() => analyzeHTML(), 500);
    });

    // ─── Atalhos de teclado ───────────────────────────────────────────────────

    document.addEventListener('keydown', e => {
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            analyzeHTML();
        } else if (e.key === 's') {
            e.preventDefault();
            exportHTML();
        }
    });

    // ─── Scroll to top ────────────────────────────────────────────────────────

    const scrollBtn = document.getElementById('scrollToTop');
    window.addEventListener('scroll', () => {
        scrollBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
    }, { passive: true });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // ─── Renderizar histórico inicial ─────────────────────────────────────────

    renderHistory();

    // ─── Sincronizar dark mode inicial no body ────────────────────────────────
    syncBodyDark();

    // ─── Footer year ──────────────────────────────────────────────────────────
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ─── Pagination dots ──────────────────────────────────────────────────────

    (function initPageDots() {
        const sections = [
            { el: document.getElementById('editorPreviewArea'), label: 'Editor e Preview' },
            { el: document.querySelector('.results-section'),    label: 'Resultados'       },
            { el: document.querySelector('.history-section'),    label: 'Histórico'        },
        ].filter(function (s) { return s.el; });

        if (sections.length < 2) return;

        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Navegação por seções');
        const ul = document.createElement('ul');
        ul.className = 'page-dots';

        sections.forEach(function (item) {
            const li  = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'page-dot';
            btn.title = item.label;
            btn.setAttribute('aria-label', item.label);
            btn.addEventListener('click', function () {
                item.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                        const idx = sections.findIndex(function (s) { return s.el === entry.target; });
                        if (idx !== -1) {
                            dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
                        }
                    }
                });
            }, { threshold: 0.25 });

            sections.forEach(function (s) { observer.observe(s.el); });
        }
    }());
}());
