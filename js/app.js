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
        tabSize: 4,
        indentWithTabs: false,
        extraKeys: { Tab: cm => cm.execCommand('indentMore') }
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
        darkToggle.textContent = dark ? '☀️' : '🌙';
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

    let autoEnabled  = false;
    let debounceT    = null;
    const btnAuto    = document.getElementById('btnAutoAnalyze');

    btnAuto.addEventListener('click', () => {
        autoEnabled = !autoEnabled;
        btnAuto.setAttribute('aria-pressed', String(autoEnabled));
        btnAuto.title = autoEnabled ? 'Auto-análise ativa (clique para desativar)' : 'Ativar análise automática';
        btnAuto.style.opacity = autoEnabled ? '1' : '0.6';
        if (autoEnabled) showToast('⚡ Análise automática ativada');
    });

    cmHtml.on('change', () => {
        localStorage.setItem('savedHTML', cmHtml.getValue());
        if (autoEnabled) {
            clearTimeout(debounceT);
            debounceT = setTimeout(() => analyzeHTML(), 700);
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
}());
