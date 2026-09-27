(() => {
  const TRACK_ID = 'homepageProductRailTrack';
  const RAIL_ID = 'homepageProductRail';
  const SPEED_PX_PER_SECOND = 18;

  function initHomepageCarousel() {
    const track = document.getElementById(TRACK_ID);
    const rail = document.getElementById(RAIL_ID);
    const main = document.querySelector('main');
    if (!track || !rail || track.dataset.marqueeReady === '1') return;

    track.dataset.marqueeReady = '1';

    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animation = null;
    let rebuilding = false;
    let rebuildFrame = 0;

    function positionRailBeforeCollections() {
      const collections = main?.querySelector('[data-home-module="COLLECTIONS"]');
      if (collections && collections.previousElementSibling !== rail) {
        main.insertBefore(rail, collections);
      }
    }

    function ensureViewport() {
      if (track.parentElement?.classList.contains('home-product-rail-viewport')) {
        return track.parentElement;
      }
      const viewport = document.createElement('div');
      viewport.className = 'home-product-rail-viewport';
      track.parentNode.insertBefore(viewport, track);
      viewport.appendChild(track);
      return viewport;
    }

    function originals() {
      return Array.from(
        track.querySelectorAll('.product-card:not([data-home-carousel-clone="1"])')
      );
    }

    function removeClones() {
      track.querySelectorAll('[data-home-carousel-clone="1"]').forEach(node => node.remove());
    }

    function makeClone(card) {
      const clone = card.cloneNode(true);
      clone.dataset.homeCarouselClone = '1';
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      clone.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(el => {
        el.setAttribute('tabindex', '-1');
      });
      return clone;
    }

    function stopAnimation() {
      if (animation) {
        animation.cancel();
        animation = null;
      }
      track.style.transform = '';
    }

    function startAnimation(cycleWidth) {
      stopAnimation();
      if (reducedMotion || cycleWidth <= 0) return;

      const duration = Math.max(14000, Math.round((cycleWidth / SPEED_PX_PER_SECOND) * 1000));

      animation = track.animate(
        [
          { transform: 'translate3d(0,0,0)' },
          { transform: `translate3d(-${cycleWidth}px,0,0)` }
        ],
        {
          duration,
          iterations: Infinity,
          easing: 'linear'
        }
      );
    }

    function rebuild() {
      if (rebuilding) return;
      rebuilding = true;
      observer.disconnect();
      stopAnimation();
      removeClones();
      positionRailBeforeCollections();
      ensureViewport();

      const cards = originals();

      if (cards.length > 1) {
        cards.forEach(card => track.appendChild(makeClone(card)));

        requestAnimationFrame(() => {
          const first = cards[0];
          const firstClone = track.querySelector('[data-home-carousel-clone="1"]');
          const cycleWidth = first && firstClone
            ? firstClone.offsetLeft - first.offsetLeft
            : 0;

          startAnimation(cycleWidth);
          observer.observe(track, { childList: true });
          rebuilding = false;
        });
        return;
      }

      observer.observe(track, { childList: true });
      rebuilding = false;
    }

    function scheduleRebuild() {
      cancelAnimationFrame(rebuildFrame);
      rebuildFrame = requestAnimationFrame(rebuild);
    }

    const observer = new MutationObserver(mutations => {
      if (rebuilding) return;
      const externalChange = mutations.some(mutation => {
        const changed = [...mutation.addedNodes, ...mutation.removedNodes];
        return changed.some(node =>
          node.nodeType === 1 &&
          !node.matches?.('[data-home-carousel-clone="1"]')
        );
      });
      if (externalChange) scheduleRebuild();
    });

    const mainObserver = new MutationObserver(positionRailBeforeCollections);

    observer.observe(track, { childList: true });
    if (main) mainObserver.observe(main, { childList: true });

    positionRailBeforeCollections();
    ensureViewport();
    rebuild();

    window.addEventListener('resize', scheduleRebuild, { passive: true });

    window.addEventListener('pagehide', () => {
      stopAnimation();
      observer.disconnect();
      mainObserver.disconnect();
      cancelAnimationFrame(rebuildFrame);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomepageCarousel, { once: true });
  } else {
    initHomepageCarousel();
  }
})();
