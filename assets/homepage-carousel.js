(() => {
  const TRACK_ID = 'homepageProductRailTrack';
  const AUTOPLAY_MS = 3800;
  const INTERACTION_PAUSE_MS = 8000;

  function initHomepageCarousel() {
    const track = document.getElementById(TRACK_ID);
    if (!track || track.dataset.autoCarouselReady === '1') return;

    track.dataset.autoCarouselReady = '1';

    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let timer = null;
    let resumeTimer = null;
    let paused = false;

    const cards = () => Array.from(track.querySelectorAll('.product-card'));

    function stepDistance() {
      const first = cards()[0];
      if (!first) return 0;
      const styles = getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      return first.getBoundingClientRect().width + gap;
    }

    function canAutoplay() {
      return !reducedMotion &&
        !paused &&
        !document.hidden &&
        cards().length > 1 &&
        track.scrollWidth > track.clientWidth + 8;
    }

    function advance() {
      if (!canAutoplay()) return;
      const distance = stepDistance();
      if (!distance) return;

      const nearEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - distance * 0.6;

      track.scrollTo({
        left: nearEnd ? 0 : track.scrollLeft + distance,
        behavior: 'smooth'
      });
    }

    function start() {
      if (timer || reducedMotion) return;
      timer = window.setInterval(advance, AUTOPLAY_MS);
    }

    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    function pauseForInteraction() {
      paused = true;
      stop();
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        paused = false;
        start();
      }, INTERACTION_PAUSE_MS);
    }

    track.addEventListener('pointerdown', pauseForInteraction, { passive: true });
    track.addEventListener('touchstart', pauseForInteraction, { passive: true });
    track.addEventListener('wheel', pauseForInteraction, { passive: true });
    track.addEventListener('focusin', pauseForInteraction);
    track.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover:hover)').matches) {
        paused = true;
        stop();
      }
    });
    track.addEventListener('mouseleave', () => {
      if (window.matchMedia('(hover:hover)').matches) {
        paused = false;
        start();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (!paused) start();
    });

    const observer = new MutationObserver(() => {
      if (cards().length > 1) start();
    });
    observer.observe(track, { childList: true });

    if (cards().length > 1) start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomepageCarousel, { once: true });
  } else {
    initHomepageCarousel();
  }
})();
