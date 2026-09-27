(() => {
  const TRACK_ID = 'homepageProductRailTrack';
  const RAIL_ID = 'homepageProductRail';
  const SPEED_PX_PER_SECOND = 18;

  function initHomepageCarousel() {
    const track = document.getElementById(TRACK_ID);
    const rail = document.getElementById(RAIL_ID);
    const main = document.querySelector('main');
    if (!track || !rail || track.dataset.continuousCarouselReady === '1') return;

    track.dataset.continuousCarouselReady = '1';

    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      track.dataset.continuousCarousel = 'reduced';
      return;
    }

    track.dataset.continuousCarousel = 'on';

    let cycleWidth = 0;
    let frame = 0;
    let lastTime = 0;
    let rebuilding = false;

    function positionRailBeforeCollections() {
      const collections = main?.querySelector('[data-home-module="COLLECTIONS"]');
      if (!collections || collections.previousElementSibling === rail) return;
      main.insertBefore(rail, collections);
    }

    function removeClones() {
      track.querySelectorAll('[data-home-carousel-clone="1"]').forEach(node => node.remove());
    }

    function prepareClone(card) {
      const clone = card.cloneNode(true);
      clone.dataset.homeCarouselClone = '1';
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('tabindex');
      clone.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(el => {
        el.setAttribute('tabindex', '-1');
      });
      return clone;
    }

    function rebuildLoop() {
      if (rebuilding) return;
      rebuilding = true;
      observer.disconnect();

      removeClones();
      positionRailBeforeCollections();

      const originals = Array.from(
        track.querySelectorAll('.product-card:not([data-home-carousel-clone="1"])')
      );

      cycleWidth = 0;

      if (originals.length > 1) {
        const firstOriginal = originals[0];
        originals.forEach(card => track.appendChild(prepareClone(card)));
        const firstClone = track.querySelector('[data-home-carousel-clone="1"]');
        if (firstClone) {
          cycleWidth = firstClone.offsetLeft - firstOriginal.offsetLeft;
        }
      }

      if (cycleWidth > 0 && track.scrollLeft >= cycleWidth) {
        track.scrollLeft %= cycleWidth;
      }

      observer.observe(track, { childList: true });
      rebuilding = false;
    }

    const observer = new MutationObserver(mutations => {
      const externalChange = mutations.some(mutation =>
        Array.from(mutation.addedNodes).some(node =>
          node.nodeType === 1 && !node.matches?.('[data-home-carousel-clone="1"]')
        ) ||
        Array.from(mutation.removedNodes).some(node =>
          node.nodeType === 1 && !node.matches?.('[data-home-carousel-clone="1"]')
        )
      );
      if (externalChange) requestAnimationFrame(rebuildLoop);
    });

    const mainObserver = new MutationObserver(() => {
      positionRailBeforeCollections();
    });

    function tick(now) {
      if (!lastTime) lastTime = now;
      const delta = Math.min(now - lastTime, 50);
      lastTime = now;

      if (cycleWidth > 0 && !document.hidden) {
        track.scrollLeft += SPEED_PX_PER_SECOND * (delta / 1000);
        if (track.scrollLeft >= cycleWidth) {
          track.scrollLeft -= cycleWidth;
        }
      }

      frame = requestAnimationFrame(tick);
    }

    observer.observe(track, { childList: true });
    if (main) mainObserver.observe(main, { childList: true });
    positionRailBeforeCollections();
    rebuildLoop();
    frame = requestAnimationFrame(tick);

    window.addEventListener('pagehide', () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      mainObserver.disconnect();
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomepageCarousel, { once: true });
  } else {
    initHomepageCarousel();
  }
})();
