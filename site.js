(() => {
  'use strict';

  // Navigation remains visible without JavaScript; only collapse after setup.
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-menu');
  if (toggle && menu) {
    document.documentElement.classList.add('has-menu');
    function closeMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    menu.addEventListener('click', event => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });
    const mobile = window.matchMedia('(max-width: 760px)');
    mobile.addEventListener('change', closeMenu);
    document.addEventListener('click', event => {
      if (!event.target.closest('.site-header')) closeMenu();
    });
  }

  // Dark is the default; a visitor's choice is remembered on this device.
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  function applyTheme(theme) {
    // Swap every colour at once: hover transitions would otherwise fade some elements late.
    const html = document.documentElement;
    html.classList.add('theme-changing');
    html.dataset.theme = theme;
    void html.offsetHeight;
    html.classList.remove('theme-changing');
    if (themeColor) themeColor.content = theme === 'dark' ? '#08182a' : '#003364';
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.title = label;
  }
  if (themeToggle) {
    themeToggle.hidden = false;
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('fb-theme', next); } catch (e) {}
    });
  }

  if (window.lucide) window.lucide.createIcons();

  // A review strip that glides continuously, looping through one hidden copy of the cards. It pauses
  // for keyboard focus, touch, drag or the arrows, when off-screen or in a background tab, and when
  // the visitor presses pause. Reduced-motion visitors get a still, scroll-snap carousel instead.
  async function initReviews() {
    const section = document.getElementById('testimonials');
    if (!section) return;
    const track = section.querySelector('[data-reviews-track]');
    const template = document.getElementById('review-card-template');
    const previous = section.querySelector('[data-reviews-prev]');
    const next = section.querySelector('[data-reviews-next]');
    const position = section.querySelector('[data-reviews-position]');
    const autoplayButton = section.querySelector('[data-reviews-autoplay]');
    const controls = section.querySelector('[data-reviews-controls]');
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

    function safeUrl(value) {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : '';
      } catch { return ''; }
    }

    let data;
    try {
      const response = await fetch('reviews.json');
      if (!response.ok) throw new Error('Reviews unavailable');
      data = await response.json();
      if (!data || typeof data !== 'object') data = {};
    } catch { data = {}; }
    const reviews = (Array.isArray(data.reviews) ? data.reviews : [])
      .filter(review => review && typeof review.author === 'string' && review.author.trim()
        && typeof review.quote === 'string' && review.quote.trim());
    const preview = reviews.length === 0;
    if (preview && !isLocal) return;
    if (preview) {
      section.querySelector('[data-reviews-preview]').hidden = false;
      ['a first home', 'a refinance', 'a mortgage renewal', 'self-employed income', 'ongoing support'].forEach(topic => {
        reviews.push({ author: 'Client testimonial placeholder', quote: `An approved client review about ${topic} will appear here.`, source: 'Preview only' });
      });
    }

    reviews.forEach((review, index) => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.setAttribute('aria-label', `${index + 1} of ${reviews.length}`);
      card.querySelector('.review-quote').textContent = review.quote.trim();
      card.querySelector('.review-name').textContent = review.author.trim();
      card.querySelector('.review-avatar').textContent = preview ? '—' : review.author.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('');
      card.querySelector('.review-source').textContent = review.source === 'Google' ? (review.excerpt ? 'Google review excerpt' : 'Google review') : preview ? 'Preview only' : 'Client testimonial';
      if (Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5) {
        const rating = card.querySelector('.testimonial-rating');
        rating.hidden = false;
        rating.setAttribute('aria-label', `${review.rating} out of 5 stars`);
        rating.firstElementChild.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      }
      const originalUrl = safeUrl(review.url);
      if (originalUrl) {
        const link = card.querySelector('.review-original');
        link.href = originalUrl;
        link.hidden = false;
        link.setAttribute('aria-label', `Read ${review.author.trim()}’s original review (opens in a new tab)`);
      }
      track.appendChild(card);
    });
    const googleUrl = safeUrl(data.googleReviewsUrl);
    if (googleUrl && !preview) {
      const link = section.querySelector('[data-google-reviews-link]');
      link.href = googleUrl;
      link.hidden = false;
    }
    section.hidden = false;
    const cards = Array.from(track.children);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const marquee = !reduced.matches && cards.length > 1;
    if (marquee) {
      // One decorative copy of every card, so the strip can loop without a visible jump.
      cards.forEach(card => {
        const copy = card.cloneNode(true);
        copy.classList.add('is-clone');
        copy.setAttribute('aria-hidden', 'true');
        copy.removeAttribute('aria-label');
        copy.inert = true;
        copy.querySelectorAll('a, button').forEach(element => element.setAttribute('tabindex', '-1'));
        track.appendChild(copy);
      });
      track.classList.add('is-marquee');
    }
    const allCards = Array.from(track.children);
    const loopWidth = () => (marquee ? allCards[cards.length].offsetLeft - cards[0].offsetLeft : 0);

    function update() {
      const max = track.scrollWidth - track.clientWidth;
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
      controls.hidden = max <= 2;
      const bounds = track.getBoundingClientRect();
      const visible = allCards.map((card, index) => ({ card, index: index % cards.length })).filter(({ card }) => {
        const rect = card.getBoundingClientRect();
        return rect.right > bounds.left + 12 && rect.left < bounds.right - 12;
      });
      if (visible.length) {
        const first = visible[0].index + 1;
        const last = visible[visible.length - 1].index + 1;
        position.textContent = first === last ? `${first} of ${cards.length}` : `${first}–${last} of ${cards.length}`;
      }
    }
    function move(direction) {
      const step = cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
      track.scrollBy({ left: step * direction, behavior: reduced.matches ? 'auto' : 'smooth' });
    }
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('keydown', event => {
      if (event.target !== track) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        track.scrollTo({ left: event.key === 'Home' ? 0 : track.scrollWidth, behavior: reduced.matches ? 'auto' : 'smooth' });
      }
    });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();

    const SPEED_PX_PER_SECOND = 36;
    const RESUME_AFTER_MS = 5000;
    let frame = 0;
    let lastTime = 0;
    let offset = 0;
    let gliding = false;
    let stoppedByVisitor = false;
    let focused = false;
    let onScreen = false;
    let interactedAt = 0;
    function canGlide() {
      return marquee && !reduced.matches && !stoppedByVisitor && !focused && onScreen
        && !document.hidden && !controls.hidden && Date.now() - interactedAt >= RESUME_AFTER_MS;
    }
    function step(time) {
      frame = window.requestAnimationFrame(step);
      const active = canGlide();
      if (active && !gliding) { offset = track.scrollLeft; lastTime = time; }
      if (active !== gliding) {
        gliding = active;
        // The moving counter would flood screen readers, so it only announces while still.
        position.setAttribute('aria-live', active ? 'off' : 'polite');
      }
      if (!active) return;
      offset += Math.min(time - lastTime, 64) * SPEED_PX_PER_SECOND / 1000;
      lastTime = time;
      const loop = loopWidth();
      if (loop > 0 && offset >= loop) offset -= loop;
      track.scrollLeft = offset;
    }
    function syncAutoplay() {
      if (autoplayButton) {
        autoplayButton.hidden = !marquee || reduced.matches || controls.hidden;
        const label = stoppedByVisitor ? 'Play automatic scrolling' : 'Pause automatic scrolling';
        autoplayButton.setAttribute('aria-label', label);
        autoplayButton.title = label;
        autoplayButton.dataset.state = stoppedByVisitor ? 'paused' : 'playing';
      }
      if (!frame && marquee && !reduced.matches) frame = window.requestAnimationFrame(step);
      if (frame && reduced.matches) { window.cancelAnimationFrame(frame); frame = 0; }
    }
    if (autoplayButton) autoplayButton.addEventListener('click', () => {
      stoppedByVisitor = !stoppedByVisitor;
      interactedAt = 0;
      syncAutoplay();
    });
    // Hovering doesn't pause it: the cursor often rests over this full-width strip while the page is
    // read. Keyboard focus, a swipe or drag, a sideways scroll or the arrows pause it for a moment.
    section.addEventListener('focusin', event => {
      focused = event.target !== autoplayButton && event.target.matches(':focus-visible');
    });
    section.addEventListener('focusout', event => { if (!section.contains(event.relatedTarget)) focused = false; });
    ['pointerdown', 'touchstart'].forEach(type => track.addEventListener(type, () => { interactedAt = Date.now(); }, { passive: true }));
    track.addEventListener('wheel', event => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) interactedAt = Date.now();
    }, { passive: true });
    [previous, next].forEach(button => button.addEventListener('click', () => { interactedAt = Date.now(); }));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { onScreen = entries.some(entry => entry.isIntersecting); }, { threshold: 0.2 }).observe(track);
    } else onScreen = true;
    reduced.addEventListener('change', syncAutoplay);
    window.addEventListener('resize', syncAutoplay, { passive: true });
    syncAutoplay();
  }

  initReviews();

  // Subtle entrance motion. Content stays visible without JavaScript or with reduced motion.
  function initMotion() {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const groups = ['.credentials', '.lender-content', '.section-heading', '.services-grid', '.process-list', '.results-grid',
      '.testimonials-track', '.about-copy', '.advisor-details', '.contact-copy', '.consultation-form'];
    const targets = [];
    groups.forEach(selector => document.querySelectorAll(selector).forEach(group => {
      const staggered = group.matches('.credentials, .services-grid, .process-list, .results-grid');
      const items = staggered ? Array.from(group.children) : [group];
      items.forEach((item, index) => {
        item.classList.add('reveal');
        item.style.setProperty('--reveal-delay', `${Math.min(index, 4) * 90}ms`);
        targets.push(item);
      });
    }));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach(target => observer.observe(target));
    document.documentElement.classList.add('motion');
  }

  initMotion();

  // Contact form
  function initContact() {
    const form = document.getElementById('fb-contact-form');
    const btn = document.getElementById('fb-submit');
    const statusEl = document.getElementById('fb-form-status');
    if (!form || !btn) return;

    function showSent() {
      btn.removeAttribute('aria-busy');
      btn.classList.add('sent');
      if (statusEl) statusEl.textContent = 'Your enquiry has been sent. Farzad will be in touch shortly.';
      btn.innerHTML = '';
      const ic = document.createElement('i');
      ic.setAttribute('data-lucide', 'check-circle-2');
      ic.style.width = '18px'; ic.style.height = '18px';
      const span = document.createElement('span');
      span.textContent = "Sent. I'll be in touch shortly";
      btn.appendChild(ic); btn.appendChild(span);
      if (window.lucide && window.lucide.createIcons) {
        try { window.lucide.createIcons(); } catch (err) {}
      }
      if (statusEl) statusEl.className = 'form-status is-success';
    }

    function showError() {
      btn.disabled = false;
      btn.dataset.sending = '';
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Book a consultation';
      if (statusEl) {
        statusEl.className = 'form-status is-error';
        statusEl.textContent = "Something went wrong. Please call or email us directly.";
      }
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (btn.dataset.done || btn.dataset.sending === '1') return;
      btn.dataset.sending = '1';
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Sending your enquiry…';
      if (statusEl) statusEl.textContent = '';

      const formData = new FormData(form);
      const payload = {
        fullName: (formData.get('name') || '').toString().trim(),
        email: (formData.get('email') || '').toString().trim(),
        phone: (formData.get('phone') || '').toString().trim(),
        message: (formData.get('message') || '').toString().trim(),
        consent: formData.get('consent') === 'yes',
        consentText: 'I agree that Farzad Behzadi, of RTC Mortgage Brokerage, may contact me by phone, text or email about this enquiry — including by an automated assistant — and that calls may be recorded.',
        consentAt: new Date().toISOString()
      };

      // The /api/contact serverless function only exists on hosts like Vercel.
      // On static hosting (or localhost) it 404s, so fall back to posting
      // straight to the n8n webhook, which allows cross-origin requests.
      // Localhost uses n8n's test webhook (requires "Listen for test event"
      // active in the n8n editor) so local runs never touch production data.
      const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const WEBHOOK_URL = isLocalhost
        ? 'https://farzadbehzadi.app.n8n.cloud/webhook-test/contact-form'
        : 'https://farzadbehzadi.app.n8n.cloud/webhook/contact-form';
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      };

      async function sendLead() {
        try {
          const response = await fetch('/api/contact', requestOptions);
          if (response.ok) return;
        } catch (err) {}
        const direct = await fetch(WEBHOOK_URL, requestOptions);
        if (!direct.ok) throw new Error('Webhook failed with status ' + direct.status);
      }

      try {
        await sendLead();
        btn.dataset.done = '1';
        showSent();
        form.reset();
      } catch (err) {
        showError();
      }
    });
  }

  initContact();
})();
