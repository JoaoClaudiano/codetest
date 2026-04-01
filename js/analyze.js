/**
 * analyze.js — Motor de análise, exportação, compartilhamento e histórico
 * Utiliza DOMParser para análise real do HTML (sem regex frágeis).
 */

// ─── Console JS embutido ─────────────────────────────────────────────────────

/**
 * Retorna o código do interceptor de console a ser injetado no iframe.
 * Captura console.log/warn/error/info/debug, erros de script e
 * promises não tratadas, enviando via postMessage para o pai.
 */
function _getConsoleInterceptorCode() {
    return '(function(){'
        + 'var _p=function(l,a){'
        +   'var m=Array.prototype.slice.call(a).map(function(x){'
        +     'if(x===null)return"null";'
        +     'if(x===undefined)return"undefined";'
        +     'try{return typeof x==="object"?JSON.stringify(x,null,2):String(x);}'
        +     'catch(e){return"[objeto não serializável]";}'
        +   '});'
        +   'window.parent.postMessage({__codetest:true,level:l,message:m.join(" ")},\"*\");'
        + '};'
        + '["log","warn","error","info","debug"].forEach(function(m){'
        +   'var o=console[m].bind(console);'
        +   'console[m]=function(){o.apply(console,arguments);_p(m,arguments);};'
        + '});'
        + 'window.addEventListener("error",function(e){'
        +   'var loc=e.lineno?"(linha "+e.lineno+(e.colno?", col "+e.colno:"")+")":"";'
        +   'window.parent.postMessage({__codetest:true,level:"error",'
        +     'message:(e.message||"Erro desconhecido")+" "+loc},\"*\");'
        + '});'
        + 'window.addEventListener("unhandledrejection",function(e){'
        +   'var r=e.reason;'
        +   'var msg=r?(r.message||String(r)):"Promise rejeitada sem motivo";'
        +   'window.parent.postMessage({__codetest:true,level:"error",'
        +     'message:"Promise não tratada: "+msg},\"*\");'
        + '});'
        + '}());';
}

/** Limpa o painel do console JS. */
function clearJsConsole() {
    var output = document.getElementById('jsConsoleOutput');
    var badge  = document.getElementById('jsConsoleBadge');
    if (output) output.innerHTML = '<p class="js-console-empty">Sem saída. Execute JavaScript para ver os resultados.</p>';
    if (badge)  { badge.textContent = ''; badge.hidden = true; }
}

/** Adiciona uma linha ao console JS embutido. */
function _appendConsoleMessage(level, message) {
    var output = document.getElementById('jsConsoleOutput');
    var badge  = document.getElementById('jsConsoleBadge');
    if (!output) return;

    var empty = output.querySelector('.js-console-empty');
    if (empty) empty.remove();

    var line = document.createElement('div');
    line.className = 'js-console-line js-console-' + level;

    var icon = document.createElement('span');
    icon.className = 'js-console-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = level === 'error' ? '✖' : level === 'warn' ? '⚠' : level === 'info' ? 'ℹ' : '›';

    var text = document.createElement('span');
    text.className = 'js-console-text';
    text.textContent = message;

    line.appendChild(icon);
    line.appendChild(text);
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;

    if (badge) {
        var count = output.querySelectorAll('.js-console-line').length;
        badge.textContent = count;
        badge.hidden = false;
    }
}

// Escutar mensagens vindas do iframe de preview
window.addEventListener('message', function (e) {
    if (!e.data || e.data.__codetest !== true) return;
    var frame = document.getElementById('previewFrame');
    if (frame && e.source !== frame.contentWindow) return;
    _appendConsoleMessage(e.data.level || 'log', e.data.message || '');
});

// ─── Acesso ao editor (CodeMirror ou textarea fallback) ─────────────────────

function getEditorHTML() {
    if (typeof cmHtml !== 'undefined') return cmHtml.getValue();
    const ta = document.getElementById('htmlInput');
    return ta ? ta.value : '';
}

function setEditorHTML(val) {
    if (typeof cmHtml !== 'undefined') { cmHtml.setValue(val); return; }
    const ta = document.getElementById('htmlInput');
    if (ta) ta.value = val;
}

function getEditorCSS() {
    if (typeof cmCss !== 'undefined') return cmCss.getValue();
    return '';
}

function getEditorJS() {
    if (typeof cmJs !== 'undefined') return cmJs.getValue();
    return '';
}

/**
 * Combina as três abas (HTML + CSS + JS) em um documento completo.
 * Usado para exportação e validação W3C (sem injeção de console).
 */
function buildFullHTML() {
    const html = getEditorHTML().trim();
    const css  = getEditorCSS().trim();
    const js   = getEditorJS().trim();

    // Documento completo: injetar CSS/JS nas posições corretas
    if (html.toLowerCase().includes('<html') || html.toUpperCase().startsWith('<!DOCTYPE')) {
        let combined = html;
        if (css) {
            const tag = `<style>\n${css}\n</style>`;
            combined = combined.includes('</head>')
                ? combined.replace('</head>', tag + '\n</head>')
                : tag + '\n' + combined;
        }
        if (js) {
            const tag = `<script>\n${js}\n<\/script>`;
            combined = combined.includes('</body>')
                ? combined.replace('</body>', tag + '\n</body>')
                : combined + '\n' + tag;
        }
        return combined;
    }

    // Trecho parcial: envolver em documento mínimo
    const stylePart  = css ? `<style>\n${css}\n</style>\n` : '';
    const scriptPart = js  ? `\n<script>\n${js}\n<\/script>` : '';
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${stylePart}</head>
<body>
${html}${scriptPart}
</body>
</html>`;
}

/**
 * Constrói o HTML para o preview injetando o interceptor de console.
 * Use apenas para srcdoc do iframe — NÃO para exportação ou W3C.
 */
function buildPreviewHTML() {
    const full = buildFullHTML();
    if (!full) return '';
    const interceptorTag = '<script>' + _getConsoleInterceptorCode() + '<\/script>';
    if (full.includes('<head>')) {
        return full.replace('<head>', '<head>\n' + interceptorTag);
    }
    const headMatch = full.match(/<head[^>]*>/i);
    if (headMatch) {
        return full.replace(headMatch[0], headMatch[0] + '\n' + interceptorTag);
    }
    return interceptorTag + '\n' + full;
}

/**
 * Atualiza apenas o iframe de preview (sem rodar análise completa).
 * Chamado nos debounces de CSS e JS.
 */
function updatePreview() {
    const preview = document.getElementById('previewFrame');
    if (!preview) return;
    clearJsConsole();
    const html = buildPreviewHTML();
    preview.srcdoc = html || '<div style="padding:20px;color:#666;font-family:sans-serif">Nenhum código para visualizar</div>';
}

// ─── Análise principal ───────────────────────────────────────────────────────

function analyzeHTML() {
    const preview  = document.getElementById('previewFrame');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsActions   = document.getElementById('resultsActions');

    // Atualizar preview com interceptor de console embutido
    clearJsConsole();
    const previewHTML = buildPreviewHTML();
    preview.srcdoc = previewHTML || '<div style="padding:20px;color:#666;font-family:sans-serif">Nenhum código para visualizar</div>';

    // Detectar aba ativa para decidir o que analisar
    const activeTab = (function () {
        const btn = document.querySelector('.tab-btn.active');
        return btn ? (btn.dataset.tab || 'html') : 'html';
    }());

    if (activeTab === 'css') {
        const rawCSS = getEditorCSS();
        if (!rawCSS.trim()) {
            resultsContainer.innerHTML = `
                <div class="result-item warning">
                    <div class="result-item-header"><span class="result-badge warning">⚠️ Aviso</span><h3>Editor CSS vazio</h3></div>
                    <p>Escreva CSS na aba CSS para analisar.</p>
                </div>`;
            if (resultsActions) resultsActions.style.display = 'none';
            return;
        }
        const analysis = analyzeCSSCode(rawCSS);
        displayResults(analysis);
        if (resultsActions) resultsActions.style.display = 'flex';
        return;
    }

    if (activeTab === 'js') {
        const rawJS = getEditorJS();
        if (!rawJS.trim()) {
            resultsContainer.innerHTML = `
                <div class="result-item warning">
                    <div class="result-item-header"><span class="result-badge warning">⚠️ Aviso</span><h3>Editor JS vazio</h3></div>
                    <p>Escreva JavaScript na aba JS para analisar.</p>
                </div>`;
            if (resultsActions) resultsActions.style.display = 'none';
            return;
        }
        const analysis = analyzeJSCode(rawJS);
        displayResults(analysis);
        if (resultsActions) resultsActions.style.display = 'flex';
        return;
    }

    // Aba HTML (padrão)
    const rawHTML = getEditorHTML();
    if (!rawHTML.trim()) {
        resultsContainer.innerHTML = `
            <div class="result-item warning">
                <div class="result-item-header"><span class="result-badge warning">⚠️ Aviso</span><h3>Editor vazio</h3></div>
                <p>Cole algum código HTML para análise.</p>
            </div>`;
        if (resultsActions) resultsActions.style.display = 'none';
        return;
    }

    const analysis = performAnalysis(rawHTML);
    displayResults(analysis);
    saveToHistory(rawHTML, analysis.score);
    renderHistory();
    if (resultsActions) resultsActions.style.display = 'flex';
    localStorage.setItem('savedHTML', rawHTML);
}

// ─── Motor de análise com DOMParser ─────────────────────────────────────────

function performAnalysis(html) {
    let score = 100;
    const issues = [];
    const TOTAL_CHECKS = 17;
    const htmlLines = html.split('\n');

    function findLine(pattern) {
        for (var i = 0; i < htmlLines.length; i++) {
            if (typeof pattern === 'string'
                ? htmlLines[i].includes(pattern)
                : pattern.test(htmlLines[i])) {
                return i + 1;
            }
        }
        return null;
    }

    // Parse DOM real — sem regex frágeis
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');

    // 1. DOCTYPE
    if (!html.trimStart().toUpperCase().startsWith('<!DOCTYPE')) {
        score -= 15;
        issues.push({ type: 'error', lang: 'HTML', line: 1, title: 'DOCTYPE Ausente',
            message: 'Adicione <!DOCTYPE html> na primeira linha do documento.',
            fix: '<!DOCTYPE html>' });
    }

    // 2. Charset
    const charsetMeta = doc.querySelector('meta[charset]');
    const charset = charsetMeta ? charsetMeta.getAttribute('charset').toUpperCase() : null;
    if (!charset) {
        score -= 10;
        issues.push({ type: 'error', lang: 'HTML', line: findLine(/charset/i), title: 'Charset não definido',
            message: 'Declare a codificação do documento para evitar problemas com caracteres especiais.',
            fix: '<meta charset="UTF-8">' });
    } else if (charset !== 'UTF-8') {
        score -= 5;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/charset/i), title: `Charset "${charset}" não recomendado`,
            message: 'Use charset="UTF-8" para máxima compatibilidade.',
            fix: '<meta charset="UTF-8">' });
    }

    // 3. Viewport
    if (!doc.querySelector('meta[name="viewport"]')) {
        score -= 8;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/viewport/i), title: 'Viewport ausente',
            message: 'Essencial para páginas responsivas em dispositivos móveis.',
            fix: '<meta name="viewport" content="width=device-width, initial-scale=1.0">' });
    }

    // 4. Title
    const titleEl = doc.querySelector('title');
    if (!titleEl || !titleEl.textContent.trim()) {
        score -= 12;
        issues.push({ type: 'error', lang: 'HTML', line: findLine(/<title/i), title: 'Título ausente',
            message: 'A tag <title> é obrigatória e essencial para SEO.',
            fix: '<title>Título Descritivo da Página</title>' });
    } else {
        const len = titleEl.textContent.trim().length;
        if (len < 5) {
            score -= 5;
            issues.push({ type: 'warning', lang: 'HTML', line: findLine(/<title/i), title: 'Título muito curto',
                message: `Título tem ${len} caracteres. Recomendado: entre 30 e 60.`,
                fix: '<title>Título Descritivo da Página</title>' });
        } else if (len > 60) {
            score -= 3;
            issues.push({ type: 'warning', lang: 'HTML', line: findLine(/<title/i), title: 'Título muito longo',
                message: `Título tem ${len} caracteres. O Google exibe até ~60 nos resultados.`,
                fix: null });
        }
    }

    // 5. Meta description
    const descMeta = doc.querySelector('meta[name="description"]');
    if (!descMeta || !descMeta.getAttribute('content')) {
        score -= 8;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/meta.*description/i), title: 'Meta description ausente',
            message: 'Importante para SEO: aparece nos resultados do Google abaixo do título.',
            fix: '<meta name="description" content="Descrição clara da página (até 160 caracteres)">' });
    } else {
        const len = descMeta.getAttribute('content').trim().length;
        if (len > 160) {
            score -= 2;
            issues.push({ type: 'warning', lang: 'HTML', line: findLine(/meta.*description/i), title: 'Meta description longa',
                message: `Descrição tem ${len} caracteres. O Google exibe até ~160.`,
                fix: null });
        }
    }

    // 6. Imagens sem ALT
    doc.querySelectorAll('img').forEach((img, i) => {
        if (!img.hasAttribute('alt')) {
            score -= 6;
            const src = (img.getAttribute('src') || '?').substring(0, 40);
            issues.push({ type: 'error', lang: 'HTML', line: findLine(new RegExp('<img[^>]*' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 20), 'i')), title: `Imagem ${i + 1} sem atributo ALT`,
                message: `"${src}…" — o alt é essencial para acessibilidade e indexação.`,
                fix: 'alt="Descrição da imagem"' });
        }
    });

    // 7. Tags semânticas
    const semanticTags = ['header','nav','main','article','section','aside','footer'];
    const hasSemantic  = semanticTags.some(t => doc.querySelector(t));
    if (!hasSemantic && doc.querySelectorAll('div').length > 3) {
        score -= 5;
        issues.push({ type: 'warning', lang: 'HTML', line: null, title: 'Poucas tags semânticas',
            message: 'Use header, nav, main, article, section, footer para melhorar acessibilidade e SEO.',
            fix: '<header>, <nav>, <main>, <article>, <footer>' });
    }

    // 8. Links externos sem rel="noopener"
    doc.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href') || '';
        if ((href.startsWith('http://') || href.startsWith('https://')) &&
            !link.getAttribute('rel')?.includes('noopener')) {
            score -= 3;
            issues.push({ type: 'warning', lang: 'HTML', line: findLine(new RegExp(href.substring(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')), title: 'Link externo sem rel="noopener"',
                message: `"${href.substring(0, 50)}…" — links externos sem noopener são um risco de segurança (tabnabbing).`,
                fix: 'rel="noopener noreferrer"' });
        }
    });

    // 9. Atributo lang na tag <html>
    const htmlEl = doc.querySelector('html');
    if (!htmlEl || !htmlEl.getAttribute('lang')) {
        score -= 5;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/<html/i), title: 'Idioma não declarado',
            message: 'O atributo lang é importante para acessibilidade (leitores de tela) e SEO.',
            fix: '<html lang="pt-BR">' });
    }

    // 10. Hierarquia de headings
    const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    if (headings.length > 1) {
        let last = 0, hierarchyError = false;
        headings.forEach(h => {
            const lv = parseInt(h.tagName[1], 10);
            if (last > 0 && lv > last + 1) hierarchyError = true;
            last = lv;
        });
        if (hierarchyError) {
            score -= 5;
            issues.push({ type: 'warning', lang: 'HTML', line: null, title: 'Hierarquia de headings incorreta',
                message: 'Não pule níveis (ex: h1 → h3 sem h2). Isso prejudica acessibilidade e SEO.',
                fix: 'Use h1 → h2 → h3 em sequência' });
        }
    }

    // 11. Múltiplos H1
    const h1Count = doc.querySelectorAll('h1').length;
    if (h1Count > 1) {
        score -= 5;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/<h1/i), title: `${h1Count} tags H1 encontradas`,
            message: 'Cada página deve ter apenas um <h1> para melhor SEO e estrutura semântica.',
            fix: 'Mantenha apenas um <h1> por página' });
    }

    // 12. Links sem texto acessível
    let emptyLinks = 0;
    doc.querySelectorAll('a').forEach(link => {
        const text = link.textContent.trim();
        const hasLabel = link.hasAttribute('aria-label') || link.hasAttribute('aria-labelledby');
        const hasImgAlt = link.querySelector('img[alt]');
        if (!text && !hasLabel && !hasImgAlt) emptyLinks++;
    });
    if (emptyLinks > 0) {
        score -= 4;
        issues.push({ type: 'error', lang: 'HTML', line: findLine(/<a\s/i), title: `${emptyLinks} link(s) sem texto acessível`,
            message: 'Links sem texto visível ou aria-label são inacessíveis para leitores de tela.',
            fix: '<a href="..." aria-label="Descrição do destino">Texto</a>' });
    }

    // 13. Campos de formulário sem label
    let unlabeled = 0;
    doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select')
        .forEach(field => {
            const id  = field.getAttribute('id');
            const ok  = field.hasAttribute('aria-label') ||
                        field.hasAttribute('aria-labelledby') ||
                        (id && doc.querySelector(`label[for="${id}"]`));
            if (!ok) unlabeled++;
        });
    if (unlabeled > 0) {
        score -= 5;
        issues.push({ type: 'error', lang: 'HTML', line: findLine(/<input|<textarea|<select/i), title: `${unlabeled} campo(s) de formulário sem label`,
            message: 'Campos sem <label> ou aria-label são inacessíveis.',
            fix: '<label for="campoId">Nome do campo</label>' });
    }

    // 14. Estilos inline excessivos
    const inlineCount = doc.querySelectorAll('[style]').length;
    if (inlineCount > 3) {
        score -= 3;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/style="/i), title: `${inlineCount} elementos com estilo inline`,
            message: 'Estilos inline dificultam manutenção e reutilização. Prefira classes CSS.',
            fix: 'Mova os estilos para uma regra CSS' });
    }

    // 15. Tags obsoletas (HTML5)
    const deprecated = ['font', 'center', 'marquee', 'blink', 'strike'];
    const found = deprecated.filter(t => doc.querySelector(t));
    if (found.length > 0) {
        score -= 4;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(new RegExp('<(' + found.join('|') + ')', 'i')), title: 'Tags obsoletas encontradas',
            message: `${found.map(t => `<${t}>`).join(', ')} estão descontinuadas no HTML5.`,
            fix: 'Use CSS para estilização em vez de tags de apresentação' });
    }

    // 16. Favicon
    if (!doc.querySelector('link[rel*="icon"]')) {
        score -= 2;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/rel.*icon/i), title: 'Favicon não definido',
            message: 'Adicione um favicon para melhorar a identidade visual e reconhecimento da página.',
            fix: '<link rel="icon" href="/favicon.ico">' });
    }

    // 17. Open Graph básico
    if (!doc.querySelector('meta[property="og:title"]')) {
        score -= 2;
        issues.push({ type: 'warning', lang: 'HTML', line: findLine(/og:title/i), title: 'Open Graph não configurado',
            message: 'Tags og: melhoram a aparência ao compartilhar links em redes sociais.',
            fix: '<meta property="og:title" content="Título da Página">' });
    }

    score = Math.max(0, Math.min(100, score));
    return { score, issues, totalChecks: TOTAL_CHECKS, lang: 'HTML' };
}

// ─── Exibição de resultados ──────────────────────────────────────────────────

function displayResults({ score, issues, lang }) {
    const container  = document.getElementById('resultsContainer');
    const colorClass = score >= 90 ? 'success' : score >= 70 ? 'warning' : 'error';
    const errors     = issues.filter(i => i.type === 'error').length;
    const warnings   = issues.filter(i => i.type === 'warning').length;
    const langLabel  = lang || 'HTML';

    const scoreLabel = score >= 90 ? 'Excelente!' : score >= 70 ? 'Pode melhorar' : 'Precisa atenção';
    const emptyMsg   = langLabel === 'CSS' ? 'CSS impecável!' : langLabel === 'JS' ? 'JavaScript impecável!' : 'HTML Perfeito!';
    const emptyDesc  = langLabel === 'CSS' ? 'Seu CSS segue todas as boas práticas verificadas. Parabéns!'
                     : langLabel === 'JS'  ? 'Seu JavaScript segue todas as boas práticas verificadas. Parabéns!'
                     : 'Seu código segue todas as boas práticas verificadas. Parabéns!';

    let html = `
        <div class="result-score ${colorClass}">
            <div class="score-circle">
                <span class="score-value">${score}</span>
                <span class="score-max">/100</span>
            </div>
            <div class="score-summary">
                <strong>${scoreLabel}</strong>
                <span>${errors} erro(s) · ${warnings} aviso(s) <span class="result-lang-badge result-lang-${langLabel.toLowerCase()}">${langLabel}</span></span>
            </div>
        </div>`;

    if (issues.length === 0) {
        html += `
            <div class="result-item success">
                <div class="result-item-header"><span class="result-badge success"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Sucesso</span><h3>${emptyMsg}</h3></div>
                <p>${emptyDesc}</p>
            </div>`;
    } else {
        // Erros primeiro, depois avisos
        const sorted = [...issues].sort((a, b) =>
            a.type === 'error' && b.type !== 'error' ? -1 :
            a.type !== 'error' && b.type === 'error' ? 1 : 0);

        sorted.forEach(issue => {
            const badge = issue.type === 'error'
                ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Erro'
                : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Aviso';
            const fixHtml = issue.fix
                ? `<div class="result-fix"><code>${esc(issue.fix)}</code></div>`
                : '';
            const issueLang = issue.lang || langLabel;
            const lineBadge = issue.line
                ? `<span class="result-line-badge">linha ${issue.line}</span>`
                : '';
            const langBadge = `<span class="result-lang-badge result-lang-${issueLang.toLowerCase()}">${issueLang}</span>`;
            html += `
                <div class="result-item ${issue.type}">
                    <div class="result-item-header">
                        <span class="result-badge ${issue.type}">${badge}</span>
                        <h3>${issue.title}</h3>
                        <span class="result-meta">${langBadge}${lineBadge}</span>
                    </div>
                    <p>${issue.message}</p>
                    ${fixHtml}
                </div>`;
        });
    }

    container.innerHTML = html;
}

function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Histórico ───────────────────────────────────────────────────────────────

function saveToHistory(html, score) {
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    history.unshift({
        html: html.substring(0, 2000),
        preview: html.trim().substring(0, 100).replace(/\s+/g, ' '),
        score,
        date: new Date().toISOString()
    });
    if (history.length > 10) history.length = 10;
    localStorage.setItem('analysisHistory', JSON.stringify(history));
}

function renderHistory() {
    const container = document.getElementById('historyContainer');
    if (!container) return;
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');

    if (history.length === 0) {
        container.innerHTML = '<p class="history-empty">Nenhuma análise realizada ainda.</p>';
        return;
    }

    container.innerHTML = history.map((item, i) => {
        const date = new Date(item.date).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
        const cls = item.score >= 90 ? 'success' : item.score >= 70 ? 'warning' : 'error';
        return `
            <div class="history-item" role="button" tabindex="0"
                 onclick="restoreFromHistory(${i})"
                 onkeydown="if(event.key==='Enter'||event.key===' ')restoreFromHistory(${i})"
                 title="Clique para restaurar este código">
                <span class="history-score ${cls}">${item.score}/100</span>
                <span class="history-preview">${esc(item.preview)}</span>
                <span class="history-date">${date}</span>
            </div>`;
    }).join('');
}

function restoreFromHistory(index) {
    const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    if (!history[index]) return;
    setEditorHTML(history[index].html + (history[index].html.length >= 2000 ? '\n<!-- ... código truncado ... -->' : ''));
    setTimeout(() => analyzeHTML(), 200);
}

function clearHistory() {
    if (!confirm('Limpar todo o histórico de análises?')) return;
    localStorage.removeItem('analysisHistory');
    renderHistory();
}

// ─── Funções utilitárias ─────────────────────────────────────────────────────

function loadExample() {
    setEditorHTML(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exemplo — Boas Práticas HTML5</title>
    <meta name="description" content="Página de exemplo com todas as boas práticas de HTML5.">
    <meta property="og:title" content="Exemplo de Página HTML5">
    <meta property="og:description" content="Demonstração de código HTML bem estruturado.">
    <link rel="icon" href="/favicon.ico">
    <style>
        body {
            font-family: -apple-system, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .card {
            background: rgba(255,255,255,0.92);
            color: #333;
            padding: 25px;
            border-radius: 12px;
            margin-top: 20px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        }
        .card a { color: #4361ee; }
    </style>
</head>
<body>
    <header>
        <h1>✨ Exemplo de HTML Válido</h1>
        <p>Código com todas as boas práticas de 2026</p>
    </header>

    <main>
        <article class="card">
            <h2>O que este exemplo inclui</h2>
            <ul>
                <li>DOCTYPE HTML5 correto</li>
                <li>Meta tags essenciais (charset, viewport, description, og:)</li>
                <li>Tags semânticas: header, main, article, footer</li>
                <li>Imagem com atributo alt descritivo</li>
                <li>Link externo com rel="noopener noreferrer"</li>
                <li>Favicon definido</li>
            </ul>

            <img src="https://picsum.photos/400/180?grayscale"
                 alt="Imagem de paisagem em preto e branco"
                 width="400" height="180"
                 loading="lazy">

            <p>Saiba mais em
                <a href="https://developer.mozilla.org/pt-BR/docs/Web/HTML"
                   target="_blank" rel="noopener noreferrer">MDN Web Docs</a>.
            </p>
        </article>
    </main>

    <footer>
        <p>Criado com ❤️ para a comunidade dev • © 2026</p>
    </footer>
</body>
</html>`);
    setTimeout(() => analyzeHTML(), 300);
}

function clearEditor() {
    setEditorHTML('');
    if (typeof cmCss !== 'undefined') cmCss.setValue('');
    if (typeof cmJs  !== 'undefined') cmJs.setValue('');
    document.getElementById('previewFrame').srcdoc = '';
    document.getElementById('resultsContainer').innerHTML = `
        <div class="result-placeholder">
            <p>Cole seu código HTML e clique em <strong>Analisar</strong> para ver os resultados.</p>
        </div>`;
    const ra = document.getElementById('resultsActions');
    if (ra) ra.style.display = 'none';
    localStorage.removeItem('savedHTML');
}

function pasteCode() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        alert('Seu navegador não suporta leitura da área de transferência.');
        return;
    }
    navigator.clipboard.readText().then(function (text) {
        if (!text) return;
        const activeTab = document.querySelector('.tab-btn.active');
        const tab = activeTab ? activeTab.dataset.tab : 'html';
        let cm;
        if (tab === 'css' && typeof cmCss !== 'undefined') {
            cmCss.setValue(text);
            cm = cmCss;
        } else if (tab === 'js' && typeof cmJs !== 'undefined') {
            cmJs.setValue(text);
            cm = cmJs;
        } else {
            setEditorHTML(text);
            cm = typeof cmHtml !== 'undefined' ? cmHtml : null;
        }
        if (cm) {
            cm.setCursor(0, 0);
            cm.scrollTo(0, 0);
        }
        const lines = text.split('\n').length;
        showToast('✅ ' + lines + ' linha' + (lines !== 1 ? 's' : '') + ' coladas! Pressione Ctrl+Enter para analisar.');
    }).catch(function () {
        alert('Não foi possível acessar a área de transferência. Verifique as permissões do navegador.');
    });
}

function formatCode() {
    const val = getEditorHTML().trim();
    if (!val) return;
    const formatted = val
        .replace(/>\s*</g, '>\n<')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .join('\n');
    setEditorHTML(formatted);
}

function insertTemplate() {
    setEditorHTML(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Título da Página</title>
    <meta name="description" content="Descrição da página para SEO.">
    <meta property="og:title" content="Título da Página">
    <meta property="og:description" content="Descrição para redes sociais.">
    <link rel="icon" href="/favicon.ico">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <header>
        <h1>Título Principal</h1>
        <nav>
            <a href="/">Início</a>
        </nav>
    </header>

    <main>
        <section>
            <h2>Seção Principal</h2>
            <p>Conteúdo da sua página aqui.</p>
        </section>
    </main>

    <footer>
        <p>© 2026 Seu Site</p>
    </footer>
</body>
</html>`);
}

/** Abre preview em nova aba usando Blob URL (sem document.write — sem risco de XSS). */
function openFullscreen() {
    const html = buildFullHTML();
    if (!html.trim()) { alert('Cole algum código HTML primeiro.'); return; }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
    else URL.revokeObjectURL(url);
}

/** Exporta o HTML como arquivo .html para download. */
function exportHTML() {
    const html = buildFullHTML();
    if (!html.trim()) { alert('Nada para exportar. Cole algum código HTML primeiro.'); return; }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'pagina.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Comprime o código e gera um link compartilhável via URL hash. */
function shareCode() {
    const html = getEditorHTML();
    if (!html.trim()) { alert('Cole algum código HTML para compartilhar.'); return; }

    const compressed = (typeof LZString !== 'undefined')
        ? LZString.compressToEncodedURIComponent(html)
        : btoa(encodeURIComponent(html));

    const shareURL = `${location.origin}${location.pathname}#code=${compressed}`;

    if (shareURL.length > 8000) {
        alert('O código é grande demais para URL. Use o botão Exportar para salvar como arquivo.');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareURL)
            .then(() => showToast('🔗 Link copiado! Cole em qualquer lugar para compartilhar.'))
            .catch(() => prompt('Copie o link:', shareURL));
    } else {
        prompt('Copie o link:', shareURL);
    }
}

/** Abre o W3C Validator com o código copiado para a área de transferência. */
function validateW3C() {
    const html = buildFullHTML();
    if (!html.trim()) { alert('Cole algum código HTML para validar.'); return; }
    const doOpen = () => window.open('https://validator.w3.org/nu/#textarea', '_blank', 'noopener');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(html)
            .then(() => { doOpen(); showToast('✅ Código copiado! Cole no campo de texto do W3C Validator (Ctrl+V).'); })
            .catch(() => { doOpen(); showToast('Aberto o W3C Validator. Cole o código manualmente.'); });
    } else {
        doOpen();
    }
}

// ─── Toast de notificação ────────────────────────────────────────────────────

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('toast-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('toast-visible'), 3500);
}
