/**
 * analyze-js.js — Motor de análise estática de JavaScript
 * Detecta problemas de qualidade, segurança e boas práticas.
 */

/* exported analyzeJSCode */
function analyzeJSCode(js) {
    if (!js || !js.trim()) {
        return { score: 100, issues: [], totalChecks: 10, lang: 'JS' };
    }

    let score = 100;
    const issues = [];
    const lines = js.split('\n');
    const TOTAL_CHECKS = 10;

    // Remove comentários e strings para evitar falsos positivos
    const stripped = js
        .replace(/\/\*[\s\S]*?\*\//g, '/* */')
        .replace(/\/\/.*/g, '//')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    function findLine(pattern) {
        for (let i = 0; i < lines.length; i++) {
            if (typeof pattern === 'string'
                ? lines[i].includes(pattern)
                : pattern.test(lines[i])) {
                return i + 1;
            }
        }
        return null;
    }

    // 1. eval() — risco crítico de segurança
    if (/\beval\s*\(/.test(stripped)) {
        score -= 15;
        issues.push({
            type: 'error', lang: 'JS',
            title: 'eval() detectado \u2014 risco de segurança (XSS)',
            message: 'eval() executa código arbitrário, expõe XSS, impede otimizações do engine e dificulta debugging.',
            fix: 'Nunca use eval(). Use JSON.parse() para dados JSON ou refatore para funções diretas.',
            line: findLine(/\beval\s*\(/)
        });
    }

    // 2. document.write() — legado e perigoso
    if (/document\.write\s*\(/.test(stripped)) {
        score -= 10;
        issues.push({
            type: 'error', lang: 'JS',
            title: 'document.write() é legado e perigoso',
            message: 'document.write() bloqueia o parser HTML, sobrescreve o DOM após carregamento e é um vetor de XSS.',
            fix: 'Use document.createElement(), insertAdjacentHTML() ou element.textContent',
            line: findLine(/document\.write\s*\(/)
        });
    }

    // 3. console.* deixados no código
    const consoleCount = (stripped.match(/\bconsole\.(log|warn|error|info|debug)\s*\(/g) || []).length;
    if (consoleCount > 0) {
        score -= 5;
        issues.push({
            type: 'warning', lang: 'JS',
            title: `${consoleCount} chamada${consoleCount > 1 ? 's' : ''} de console.* no código`,
            message: 'Chamadas de console devem ser removidas em código de produção — expõem informações internas.',
            fix: 'Remova console.log() ou use uma biblioteca de logging com níveis configuráveis',
            line: findLine(/\bconsole\.(log|warn|error|info|debug)\s*\(/)
        });
    }

    // 4. var em vez de let/const
    const varCount = (stripped.match(/\bvar\s+[a-zA-Z_$]/g) || []).length;
    if (varCount > 0) {
        score -= 5;
        issues.push({
            type: 'warning', lang: 'JS',
            title: `${varCount} declaração${varCount > 1 ? 'ões' : ''} com var`,
            message: 'var tem escopo de função e sofre hoisting, causando bugs sutis. Use const e let (ES6+).',
            fix: 'const nome = valor;  (imutável)  ou  let contador = 0;  (mutável)',
            line: findLine(/\bvar\s+[a-zA-Z_$]/)
        });
    }

    // 5. Igualdade solta == em vez de ===
    const looseEqCount = (stripped.match(/(?<![=!<>])={2}(?!=)/g) || []).length;
    if (looseEqCount > 0) {
        score -= 5;
        issues.push({
            type: 'warning', lang: 'JS',
            title: `${looseEqCount} comparação${looseEqCount > 1 ? 'ões' : ''} com == (igualdade solta)`,
            message: '== realiza coerção de tipo implícita, causando bugs: 0 == false → true, "" == false → true.',
            fix: 'Use === e !== para todas as comparações (igualdade estrita)',
            line: findLine(/(?<![=!<>])==(?!=)/)
        });
    }

    // 6. .innerHTML = (risco de XSS)
    const innerHTMLCount = (stripped.match(/\.innerHTML\s*=(?!=)/g) || []).length;
    if (innerHTMLCount > 0) {
        score -= 8;
        issues.push({
            type: 'error', lang: 'JS',
            title: `${innerHTMLCount} atribuição${innerHTMLCount > 1 ? 'ões' : ''} a .innerHTML`,
            message: 'Atribuir dados não sanitizados a innerHTML é uma vulnerabilidade XSS grave.',
            fix: 'Use element.textContent para texto puro, ou sanitize com DOMPurify antes de usar innerHTML',
            line: findLine(/\.innerHTML\s*=(?!=)/)
        });
    }

    // 7. alert/confirm/prompt (bloqueantes e má UX)
    const dialogCount = (stripped.match(/\b(alert|confirm|prompt)\s*\(/g) || []).length;
    if (dialogCount > 0) {
        score -= 5;
        issues.push({
            type: 'warning', lang: 'JS',
            title: `${dialogCount} diálogo${dialogCount > 1 ? 's' : ''} nativo${dialogCount > 1 ? 's' : ''} (alert/confirm/prompt)`,
            message: 'Diálogos nativos bloqueiam a thread principal e são desativados em iframes e alguns navegadores.',
            fix: 'Use modais personalizados ou bibliotecas como SweetAlert2/Notyf',
            line: findLine(/\b(alert|confirm|prompt)\s*\(/)
        });
    }

    // 8. setTimeout/setInterval com string de código (equivalente a eval)
    if (/set(?:Timeout|Interval)\s*\(\s*['"`]/.test(stripped)) {
        score -= 8;
        issues.push({
            type: 'error', lang: 'JS',
            title: 'setTimeout/setInterval com string de código',
            message: 'Passar strings para setTimeout/setInterval equivale a eval() — mesmos riscos de segurança.',
            fix: "setTimeout(() => { minhaFuncao(); }, 1000);  \u2014 use arrow function",
            line: findLine(/set(?:Timeout|Interval)\s*\(\s*['"`]/)
        });
    }

    // 9. new XMLHttpRequest (sugere Fetch API moderna)
    if (/new\s+XMLHttpRequest\s*\(/.test(stripped)) {
        score -= 3;
        issues.push({
            type: 'warning', lang: 'JS',
            title: 'XMLHttpRequest \u2014 considere a Fetch API moderna',
            message: 'XMLHttpRequest é verboso e orientado a callbacks. A Fetch API é mais simples e baseada em Promises.',
            fix: "fetch('/api/dados').then(r => r.json()).then(data => { /* ... */ });",
            line: findLine(/new\s+XMLHttpRequest\s*\(/)
        });
    }

    // 10. Instrução with (deprecada, proibida em strict mode)
    if (/\bwith\s*\(/.test(stripped)) {
        score -= 10;
        issues.push({
            type: 'error', lang: 'JS',
            title: "Instrução with detectada",
            message: 'with modifica o escopo dinamicamente, tornando o código imprevisível e impossível de otimizar. É proibida em strict mode.',
            fix: 'Atribua o objeto a uma variável e acesse suas propriedades diretamente',
            line: findLine(/\bwith\s*\(/)
        });
    }

    score = Math.max(0, Math.min(100, score));
    return { score: score, issues: issues, totalChecks: TOTAL_CHECKS, lang: 'JS' };
}
