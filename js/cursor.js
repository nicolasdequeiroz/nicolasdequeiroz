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

    // Loop de Animação
    function animateCursor() {
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover
    const hoverTargets = ['a', 'button', 'input[type="submit"]', '.carousel-link-wrapper'];
    const targetSelector = hoverTargets.join(', ');

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(targetSelector)) cursor.classList.add('hovered');
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest(targetSelector)) cursor.classList.remove('hovered');
    });
    
    // Saiu da janela? Esconde.
    document.addEventListener('mouseleave', () => cursor.classList.remove('visible'));
    document.addEventListener('mouseenter', () => cursor.classList.add('visible'));
});