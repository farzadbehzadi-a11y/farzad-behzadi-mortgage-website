(() => {
  'use strict';

  // Live search over the document cards. Without JavaScript every card stays visible.
  const input = document.querySelector('[data-library-search]');
  const results = document.querySelector('[data-library-results]');
  const empty = document.querySelector('[data-library-empty]');
  const cards = Array.from(document.querySelectorAll('[data-doc]'));
  const categories = Array.from(document.querySelectorAll('[data-category]'));
  const groups = Array.from(document.querySelectorAll('.library-group'));
  const navLinks = Array.from(document.querySelectorAll('.library-links a'));
  const total = cards.length;
  const normalise = value => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
  const index = new Map(cards.map(card => [card, normalise(card.textContent)]));
  const linkFor = new Map(navLinks.map(link => [link.getAttribute('href').slice(1), link]));
  let openBeforeSearch = null;

  function filter() {
    const terms = normalise(input.value).split(' ').filter(Boolean);
    let shown = 0;
    cards.forEach(card => {
      const match = terms.every(term => index.get(card).includes(term));
      card.hidden = !match;
      const link = linkFor.get(card.id);
      if (link) link.hidden = !match;
      if (match) shown += 1;
    });
    categories.forEach(category => { category.hidden = !category.querySelector('[data-doc]:not([hidden])'); });
    groups.forEach(group => {
      const visible = group.querySelectorAll('.library-links a:not([hidden])').length;
      group.hidden = visible === 0;
      group.querySelector('.library-count').textContent = visible;
    });
    if (terms.length) {
      if (!openBeforeSearch) openBeforeSearch = groups.filter(group => group.open);
      groups.forEach(group => { group.open = true; });
    } else if (openBeforeSearch) {
      groups.forEach(group => { group.open = openBeforeSearch.includes(group); });
      openBeforeSearch = null;
    }
    empty.hidden = shown !== 0;
    results.textContent = terms.length ? `${shown} of ${total} documents` : `${total} documents`;
  }

  if (input) {
    input.addEventListener('input', filter);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && input.value) { input.value = ''; filter(); }
    });
  }

  // Mark the chosen document in the sidebar and open its group, including on page load with a hash.
  function markCurrent(id) {
    navLinks.forEach(link => link.removeAttribute('aria-current'));
    const link = linkFor.get(id);
    if (!link) return;
    link.setAttribute('aria-current', 'true');
    const group = link.closest('details');
    if (group) group.open = true;
  }
  navLinks.forEach(link => link.addEventListener('click', () => markCurrent(link.getAttribute('href').slice(1))));
  window.addEventListener('hashchange', () => markCurrent(decodeURIComponent(location.hash.slice(1))));
  if (location.hash) markCurrent(decodeURIComponent(location.hash.slice(1)));
  else if (window.matchMedia('(min-width: 901px)').matches && groups[0]) groups[0].open = true;
})();
