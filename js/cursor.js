document.addEventListener("DOMContentLoaded", function() {
    if (window.matchMedia("(max-width: 768px), (hover: none), (pointer: coarse)").matches) {
        return;
    }

    // Adiciona classe no body para esconder a setinha via CSS
    document.body.classList.add('custom-cursor-active');

    // Cria a bolinha via JS (assim ela não existe fisicamente no editor)
    const cursor = document.createElement('div');
    cursor.classList.add('custom-cursor-ball');
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0, isFirstMove = true;

    // Movimento
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Só torna a bolinha visível (opacity 1) após o primeiro movimento
        if(isFirstMove) { 
            cursor.classList.add('visible'); 
            isFirstMove = false; 
        }
    });

    // Hover
    // '.drift-wall[data-hovering]': mural do Feed — o quadro erguido não é o alvo do hit-test.
    const hoverTargets = ['a', 'button', 'input[type="submit"]', '.carousel-link-wrapper', '.drift-wall[data-hovering]'];
    const targetSelector = hoverTargets.join(', ');

    // Loop de Animação. Com conteúdo que anda sob o mouse parado (o mural do Feed,
    // o carrossel), mouseover/mouseout não disparam: a cada ~120ms conferimos o que
    // está sob o ponteiro para o estado "hover" nunca ficar preso ou atrasado.
    let lastCheck = 0;
    function animateCursor(ts) {
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
        if (!isFirstMove && ts - lastCheck > 120) {
            lastCheck = ts;
            const el = document.elementFromPoint(mouseX, mouseY);
            // [data-grab]: o crachá (lanyard) da Sobre marca quando o mouse está sobre ele.
            cursor.classList.toggle('hovered', !!(el && el.closest(targetSelector)) || !!document.querySelector('[data-grab]'));
        }
        requestAnimationFrame(animateCursor);
    }
    requestAnimationFrame(animateCursor);

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(targetSelector)) cursor.classList.add('hovered');
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest(targetSelector)) cursor.classList.remove('hovered');
    });
    
    // Dialogs modais ficam na "top layer", acima de tudo — inclusive da
    // bolinha no <body>. Enquanto um estiver aberto, a bolinha mora nele.
    const syncLayer = () => {
        const open = document.querySelector('dialog[open]');
        const host = open || document.body;
        if (cursor.parentElement !== host) host.appendChild(cursor);
    };
    new MutationObserver(syncLayer).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['open'],
    });

    // Saiu da janela? Esconde.
    document.addEventListener('mouseleave', () => cursor.classList.remove('visible'));
    document.addEventListener('mouseenter', () => cursor.classList.add('visible'));
});