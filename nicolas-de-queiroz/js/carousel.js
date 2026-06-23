document.addEventListener("DOMContentLoaded", function() {
    
    let currentIdx = 0;
    let theta = 0;
    let numItems = 0;
    let autoPlayInterval = null;
    let introTimeout = null;
    
    const isMobile = window.innerWidth < 768;
    let baseTilt = isMobile ? -10 : 0;

    function initCarousel() {
        const sourceList = document.getElementById('cms-list');
        const targetContainer = document.getElementById('carousel-target');
        const wrapper = document.getElementById('mouse-wrapper');
        const scene = document.getElementById('scene');

        if (!sourceList) return;

        // Extração
        const rawItems = Array.from(sourceList.children);
        const validItems = rawItems.filter(el => el.tagName === 'DIV' || el.tagName === 'A');

        if (validItems.length > 0 && targetContainer.children.length === 0) {
            validItems.forEach(yItem => {
                const img = yItem.querySelector('img') || yItem.querySelector('#cms-image');
                const link = yItem.tagName === 'A' ? yItem : yItem.querySelector('a');

                if (img) {
                    const card = document.createElement('div');
                    card.classList.add('carousel-item');
                    const linkWrapper = document.createElement(link ? 'a' : 'div');
                    linkWrapper.classList.add('carousel-link-wrapper');
                    if (link && link.href) {
                        linkWrapper.href = link.href;
                        if(link.target) linkWrapper.target = link.target;
                    }
                    const newImg = img.cloneNode(true);
                    newImg.removeAttribute('id');
                    newImg.className = ''; newImg.style.cssText = ''; 
                    
                    linkWrapper.appendChild(newImg);
                    card.appendChild(linkWrapper);
                    targetContainer.appendChild(card);
                }
            });
        }

        const items = targetContainer.querySelectorAll('.carousel-item');
        if (items.length === 0) return;

        numItems = items.length;
        theta = 360 / numItems;

        function updateLayout() {
            // MUDANÇA AQUI: Raio ajustado para 240px no mobile (proporcional ao card menor)
            let radius = window.innerWidth < 768 ? 240 : 750;
            items.forEach((item, index) => {
                const angle = theta * index;
                item.style.transform = `rotateY(${angle}deg) translateZ(${radius}px)`;
            });
        }
        updateLayout();
        window.addEventListener('resize', updateLayout);

        function rotate() {
            const angle = currentIdx * -theta;
            targetContainer.style.transform = `rotateY(${angle}deg)`;
            if(scene) {
                scene.style.transition = 'transform 0.6s ease-out';
                scene.style.transform = `rotateX(${baseTilt}deg)`; 
            }
        }

        // Autoplay Logic
        function stopAutoPlay() {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            if (introTimeout) clearTimeout(introTimeout);
            autoPlayInterval = null;
        }
        function startAutoPlayLoop() {
            stopAutoPlay();
            autoPlayInterval = setInterval(() => { currentIdx++; rotate(); }, 5000);
        }
        
        // Intro Animation
        function runIntroAnimation() {
            targetContainer.style.transition = 'transform 2.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
            targetContainer.style.transform = `rotateY(-360deg)`;
            currentIdx = numItems; 
            introTimeout = setTimeout(() => {
                targetContainer.style.transition = 'transform 1s cubic-bezier(0.19, 1, 0.22, 1)';
                startAutoPlayLoop();
            }, 2600);
        }
        setTimeout(runIntroAnimation, 100);

        // Inputs
        let acc = 0;
        wrapper.addEventListener('wheel', (e) => {
            stopAutoPlay();
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; 
            if (e.target.closest('.mouse-tracing-wrapper')) e.preventDefault();
            acc += e.deltaY;
            if (acc > 40) { currentIdx++; acc = 0; rotate(); }
            else if (acc < -40) { currentIdx--; acc = 0; rotate(); }
        }, { passive: false });

        let startX = 0, startY = 0, isDrag = false;
        
        wrapper.addEventListener('touchstart', (e) => {
            stopAutoPlay();
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDrag = true;
            targetContainer.style.transition = 'none';
            if(scene) scene.style.transition = 'none';
        }, { passive: true });

        wrapper.addEventListener('touchmove', (e) => {
            if (!isDrag) return;
            stopAutoPlay();
            
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            
            const diffX = startX - currentX;
            const diffY = startY - currentY;
            
            const visualAngle = (currentIdx * -theta) - (diffX * 0.5);
            
            const tiltSensitivity = 0.3;
            let dynamicTilt = baseTilt + (diffY * tiltSensitivity);
            dynamicTilt = Math.max(-40, Math.min(30, dynamicTilt));

            targetContainer.style.transform = `rotateY(${visualAngle}deg)`;
            if(scene) scene.style.transform = `rotateX(${dynamicTilt}deg)`;
            
        }, { passive: true });

        wrapper.addEventListener('touchend', (e) => {
            isDrag = false;
            targetContainer.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
            if(scene) scene.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
            
            const diff = startX - e.changedTouches[0].clientX;
            if (diff > 50) currentIdx++; else if (diff < -50) currentIdx--;
            
            rotate();
        });

        // Mouse Tracing (Desktop)
        if (window.matchMedia("(hover: hover) and (min-width: 768px)").matches) {
            wrapper.addEventListener('mousemove', (e) => {
                const r = wrapper.getBoundingClientRect();
                const xP = ((e.clientX - r.left) / r.width - 0.5) * 2;
                const yP = ((e.clientY - r.top) / r.height - 0.5) * 2;
                if(scene) scene.style.transform = `rotateX(${yP * -8}deg) rotateY(${xP * 12}deg) translateX(${xP * 30}px) translateY(${yP * 20}px)`;
            });
            wrapper.addEventListener('mouseleave', () => {
                if(scene) scene.style.transform = `rotateX(0deg) rotateY(0deg) translateX(0px) translateY(0px)`;
            });
        }
    }

    initCarousel();
});