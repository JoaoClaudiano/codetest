/**
 * analyze-css.js — Motor de análise de CSS
 * Analisa código CSS puro e retorna score + lista de issues com linha.
 */

/* exported analyzeCSSCode */
function analyzeCSSCode(css) {
    if (!css || !css.trim()) {
        return { score: 100, issues: [], totalChecks: 10, lang: 'CSS' };
    }

    let score = 100;
    const issues = [];
    const lines = css.split('\n');
    const TOTAL_CHECKS = 10;

    // Remove comentários e strings para evitar falsos positivos na análise
    const stripped = css
        .replace(/\/\*[\s\S]*?\*\//g, '/* */')
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

    // 1. !important em excesso (>3 usos)
    const importantCount = (css.match(/!important/gi) || []).length;
    if (importantCount > 3) {
        score -= 8;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `!important usado ${importantCount}\u00d7 \u2014 especificidade excessiva`,
            message: 'Abuso de !important indica conflitos de especificidade. Refatore os seletores para evitar a necessidade.',
            fix: 'Aumente a especificidade do seletor em vez de usar !important',
            line: findLine('!important')
        });
    }

    // 2. @import (bloqueia carregamento paralelo)
    const importCount = (stripped.match(/@import\b/g) || []).length;
    if (importCount > 0) {
        score -= 6;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `@import bloqueia carregamento paralelo (${importCount} ocorr\u00eancia${importCount > 1 ? 's' : ''})`,
            message: '@import CSS carrega folhas em s\u00e9rie, aumentando o tempo total de carregamento da p\u00e1gina.',
            fix: 'Use <link rel="stylesheet"> no HTML ou concatene os arquivos CSS no build',
            line: findLine(/@import\b/)
        });
    }

    // 3. Seletor universal aplicado a tudo
    if (/\*\s*\{/.test(stripped)) {
        score -= 5;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: 'Seletor universal * aplicado a todos os elementos',
            message: '* {} aplica estilos indiscriminadamente e pode causar problemas de performance e heran\u00e7a inesperada.',
            fix: 'Use :root para vari\u00e1veis globais ou box-sizing: border-box com reset espec\u00edfico',
            line: findLine(/\*\s*\{/)
        });
    }

    // 4. font-size com px (prejudica acessibilidade)
    const pxFontCount = (stripped.match(/font-size\s*:\s*\d+px/gi) || []).length;
    if (pxFontCount > 0) {
        score -= 5;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `font-size com px (${pxFontCount} ocorr\u00eancia${pxFontCount > 1 ? 's' : ''})`,
            message: 'px ignora as prefer\u00eancias de tamanho de fonte do usu\u00e1rio definidas no navegador, prejudicando acessibilidade.',
            fix: 'Use rem: 1rem \u2248 16px padr\u00e3o. Exemplo: font-size: 1rem; ou font-size: 0.875rem;',
            line: findLine(/font-size\s*:\s*\d+px/i)
        });
    }

    // 5. Regras CSS vazias (c\u00f3digo morto)
    const emptyRuleCount = (stripped.match(/[^{}]+\{\s*\}/g) || []).length;
    if (emptyRuleCount > 0) {
        score -= 4;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `${emptyRuleCount} regra${emptyRuleCount > 1 ? 's' : ''} CSS vazia${emptyRuleCount > 1 ? 's' : ''}`,
            message: 'Seletores sem declara\u00e7\u00f5es s\u00e3o c\u00f3digo morto que aumenta o tamanho do arquivo sem efeito.',
            fix: 'Remova os blocos de regras sem declara\u00e7\u00f5es',
            line: findLine(/\{\s*\}/)
        });
    }

    // 6. z-index muito alto (>= 1000)
    const zIndexValues = stripped.match(/z-index\s*:\s*(-?\d+)/gi) || [];
    const highZ = zIndexValues.find(function (m) {
        return parseInt((m.match(/-?\d+/) || ['0'])[0], 10) >= 1000;
    });
    if (highZ) {
        const val = parseInt((highZ.match(/-?\d+/) || ['0'])[0], 10);
        score -= 3;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `z-index excessivo (${val})`,
            message: 'z-index \u2265 1000 geralmente indica layout quebrado. Mantenha valores entre 1 e 99.',
            fix: 'Crie um sistema de z-index com vari\u00e1veis CSS: --z-modal: 200; --z-dropdown: 100;',
            line: findLine(/z-index\s*:\s*[1-9]\d{3,}/)
        });
    }

    // 7. Propriedades vendor sem vers\u00e3o padr\u00e3o
    const vpRegex = /(?:-webkit-|-moz-|-ms-|-o-)([a-z][a-z-]+)\s*:/gi;
    let vpMatch;
    const propsWithoutStandard = [];
    const strippedLines = stripped.split('\n');
    while ((vpMatch = vpRegex.exec(stripped)) !== null) {
        const prop = vpMatch[1].toLowerCase();
        if (propsWithoutStandard.indexOf(prop) !== -1) continue;
        // Verificar se existe vers\u00e3o padr\u00e3o (linha que come\u00e7a com a propriedade sem prefixo)
        const hasStandard = strippedLines.some(function (line) {
            return new RegExp('^\\s*' + prop.replace(/-/g, '\\-') + '\\s*:', 'i').test(line);
        });
        if (!hasStandard) {
            propsWithoutStandard.push(prop);
        }
    }
    if (propsWithoutStandard.length > 0) {
        const propList = propsWithoutStandard.slice(0, 3).join(', ');
        score -= 4;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `Prefixo vendor sem propriedade padr\u00e3o (${propsWithoutStandard.length} propr.)`,
            message: `"${propList}" t\u00eam prefixo de fabricante mas faltam as vers\u00f5es padr\u00e3o correspondentes.`,
            fix: 'Declare sempre a propriedade padr\u00e3o junto da prefixada: transform: valor; -webkit-transform: valor;',
            line: findLine(/(?:-webkit-|-moz-|-ms-|-o-)[a-z]/)
        });
    }

    // 8. Cores hardcoded em excesso sem vari\u00e1veis CSS
    const colorMatches = stripped.match(/#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(/g) || [];
    const hasCustomProps = /var\s*\(/.test(stripped);
    if (colorMatches.length > 8 && !hasCustomProps) {
        score -= 4;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `${colorMatches.length} cores hardcoded sem vari\u00e1veis CSS`,
            message: 'Muitas cores fixas dificultam manuten\u00e7\u00e3o e impossibilitam temas din\u00e2micos.',
            fix: ':root { --cor-primaria: #2563eb; } e use: color: var(--cor-primaria);',
            line: findLine(/#[0-9a-fA-F]{3,8}\b/)
        });
    }

    // 9. M\u00faltiplos elementos posicionados sem nenhum z-index
    const positionedCount = (stripped.match(/position\s*:\s*(fixed|absolute)/gi) || []).length;
    const zIndexDeclaredCount = (stripped.match(/z-index\s*:/gi) || []).length;
    if (positionedCount >= 2 && zIndexDeclaredCount === 0) {
        score -= 3;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `${positionedCount} elementos posicionados sem nenhum z-index`,
            message: 'M\u00faltiplos elementos position fixed/absolute sem z-index podem causar sobreposi\u00e7\u00e3o inesperada.',
            fix: 'Defina z-index expl\u00edcito para todos os elementos posicionados',
            line: findLine(/position\s*:\s*(fixed|absolute)/i)
        });
    }

    // 10. Seletores com especificidade excessiva (4+ n\u00edveis de descendentes)
    const ruleBlocks = stripped.match(/[^{}]+\{/g) || [];
    const deepSelectors = ruleBlocks.filter(function (block) {
        const selector = block.replace('{', '').trim().split(',')[0].trim();
        if (selector.startsWith('@')) return false;
        // Contar espa\u00e7os que representam descend\u00eancia (excluir combinadores >, ~, +)
        return (selector.match(/\s+(?![>~+])/g) || []).length >= 4;
    });
    if (deepSelectors.length > 0) {
        score -= 4;
        issues.push({
            type: 'warning', lang: 'CSS',
            title: `${deepSelectors.length} seletor${deepSelectors.length > 1 ? 'es' : ''} com especificidade excessiva (4+ n\u00edveis)`,
            message: 'Seletores muito longos criam depend\u00eancias fr\u00e1geis na estrutura HTML e s\u00e3o dif\u00edceis de sobrescrever.',
            fix: 'Prefira metodologias como BEM: .bloco__elemento--modificador {}',
            line: null
        });
    }

    score = Math.max(0, Math.min(100, score));
    return { score: score, issues: issues, totalChecks: TOTAL_CHECKS, lang: 'CSS' };
}
