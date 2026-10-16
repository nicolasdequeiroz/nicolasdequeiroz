// "Próximo projeto": toca o vídeo do case em loop enquanto o bloco está na tela e
// pausa ao sair. O arquivo só é carregado quando o bloco se aproxima; até lá (e
// com "reduzir movimento") fica o poster. No celular usa a versão vertical, se houver.
(function () {
  const videos = document.querySelectorAll("video.work-next-media[data-src]");
  if (!videos.length || !("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const mobile = window.matchMedia("(max-width: 767px)");
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (!video.getAttribute("src")) {
            video.src = (mobile.matches && video.dataset.srcMobile) || video.dataset.src;
          }
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    },
    { rootMargin: "200px 0px" }
  );
  videos.forEach((video) => io.observe(video));
})();
