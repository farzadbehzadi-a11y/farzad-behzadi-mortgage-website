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

  if (window.lucide) window.lucide.createIcons();

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
