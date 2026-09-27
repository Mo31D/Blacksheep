(() => {
  const TRACK_ID = 'homepageProductRailTrack';
  const RAIL_ID = 'homepageProductRail';
  const SPEED = 18; // px per second
  const RESUME_DELAY = 900;

  function initHomepageMarquee() {
    const track = document.getElementById(TRACK_ID);
    const rail = document.getElementById(RAIL_ID);
    if (!track || !rail || track.dataset.nativeMarqueeReady === '1') return;

    track.dataset.nativeMarqueeReady = '1';

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    let viewport = track.parentElement?.classList.contains('home-product-rail-viewport')
      ? track.parentElement
      : null;

    if (!viewport) {
      viewport = document.createElement('div');
      viewport.className = 'home-product-rail-viewport';
      track.parentNode.insertBefore(viewport, track);
      viewport.appendChild(track);
    }

    let cycleWidth = 0;
    let raf = 0;
    let last = 0;
    let interacting = false;
    let resumeTimer = 0;
    let rebuilding = false;
    let logicalOffset = 0;

    const isClone = node => node?.nodeType === 1 && node.matches?.('[data-home-carousel-clone="1"]');

    function originals() {
      return [...track.querySelectorAll('.product-card:not([data-home-carousel-clone="1"])')];
    }

    function removeClones() {
      track.querySelectorAll('[data-home-carousel-clone="1"]').forEach(node => node.remove());
    }

    function cloneCard(card) {
      const clone = card.cloneNode(true);
      clone.dataset.homeCarouselClone = '1';
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      clone.querySelectorAll('[tabindex]').forEach(el => el.setAttribute('tabindex', '-1'));
      return clone;
    }

    function normalise(force = false) {
      if (!cycleWidth || interacting) return;
      const x = viewport.scrollLeft;
      if (x >= cycleWidth * 2) viewport.scrollLeft = x - cycleWidth;
      else if (x < cycleWidth * 0.25 && force) viewport.scrollLeft = x + cycleWidth;
    }

    function rebuild() {
      if (rebuilding) return;
      rebuilding = true;
      observer.disconnect();

      if (cycleWidth > 0) {
        logicalOffset = ((viewport.scrollLeft - cycleWidth) % cycleWidth + cycleWidth) % cycleWidth;
      } else {
        logicalOffset = 0;
      }

      removeClones();
      const cards = originals();
      cycleWidth = 0;

      if (cards.length > 1) {
        const before = document.createDocumentFragment();
        const after = document.createDocumentFragment();
        cards.forEach(card => before.appendChild(cloneCard(card)));
        cards.forEach(card => after.appendChild(cloneCard(card)));
        track.prepend(before);
        track.append(after);

        requestAnimationFrame(() => {
          const all = [...track.querySelectorAll('.product-card')];
          const firstMiddle = all[cards.length];
          const firstAfter = all[cards.length * 2];
          if (firstMiddle && firstAfter) {
            cycleWidth = firstAfter.offsetLeft - firstMiddle.offsetLeft;
            viewport.scrollLeft = cycleWidth + Math.min(logicalOffset, Math.max(0, cycleWidth - 1));
          }
          observer.observe(track, { childList: true });
          rebuilding = false;
        });
        return;
      }

      observer.observe(track, { childList: true });
      rebuilding = false;
    }

    const observer = new MutationObserver(mutations => {
      if (rebuilding) return;
      const external = mutations.some(m =>
        [...m.addedNodes, ...m.removedNodes].some(node => node.nodeType === 1 && !isClone(node))
      );
      if (external) rebuild();
    });

    function pause() {
      interacting = true;
      clearTimeout(resumeTimer);
    }

    function resume() {
      clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        interacting = false;
        normalise(true);
        last = performance.now();
      }, RESUME_DELAY);
    }

    viewport.addEventListener('pointerdown', pause, { passive: true });
    viewport.addEventListener('pointerup', resume, { passive: true });
    viewport.addEventListener('pointercancel', resume, { passive: true });
    viewport.addEventListener('touchstart', pause, { passive: true });
    viewport.addEventListener('touchend', resume, { passive: true });
    viewport.addEventListener('touchcancel', resume, { passive: true });
    viewport.addEventListener('wheel', () => { pause(); resume(); }, { passive: true });

    function tick(now) {
      if (!last) last = now;
      const dt = Math.min(now - last, 50);
      last = now;

      if (!reducedMotion && !interacting && !document.hidden && cycleWidth > 0) {
        viewport.scrollLeft += SPEED * (dt / 1000);
        normalise(false);
      }
      raf = requestAnimationFrame(tick);
    }

    document.addEventListener('visibilitychange', () => {
      last = performance.now();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(rebuild, 250);
    }, { passive: true });

    observer.observe(track, { childList: true });
    rebuild();
    raf = requestAnimationFrame(tick);

    window.addEventListener('pagehide', () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      clearTimeout(resumeTimer);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomepageMarquee, { once: true });
  } else {
    initHomepageMarquee();
  }
})();
