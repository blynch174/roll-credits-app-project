// Settings → My Streaming Services. Optional: nothing changes until someone picks their services. Then their
// matches are marked on movie cards and Popcorn Pick offers "My Services Only".

import * as store from '../store.js';
import * as streaming from '../streaming.js';
import { refreshWatch } from '../movieinfo.js';
import { $, esc, toast, openSheet, closeSheet } from '../ui.js';

export function servicesSheet(after) {
  streaming.load().then(() => {
    const all = streaming.allProviders();
    if (!all.length) return toast("Streaming info isn't available yet. Try again after the next catalog update.");
    const chosen = new Set(streaming.myServices());
    let q = '';
    const sheet = openSheet({
      title: 'My Streaming Services',
      body: `
        <p class="sheet-sub">Pick the services you have. Movie cards will point them out, and Popcorn Pick can stick to them.</p>
        <input type="search" id="sv-q" placeholder="Search services" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search">
        <div class="sv-grid" id="sv-grid"></div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
        { label: 'Clear All', kind: 'ghost', onClick: () => { chosen.clear(); draw(); } },
        {
          label: 'Save',
          kind: 'primary',
          onClick: () => {
            store.setSetting('myServices', [...chosen]);
            closeSheet();
            refreshWatch();
            toast(chosen.size ? `${chosen.size} service${chosen.size === 1 ? '' : 's'} saved.` : 'My Services is off.');
            after && after();
          },
        },
      ],
    });
    const grid = $('#sv-grid', sheet);
    function draw() {
      const shown = all.filter((p) => chosen.has(p.id) || !q || p.name.toLowerCase().includes(q));
      const list = q ? shown : shown.filter((p, i) => chosen.has(p.id) || i < 40);
      grid.innerHTML = list.map((p) => `
        <button type="button" class="sv-item${chosen.has(p.id) ? ' on' : ''}" data-id="${p.id}" aria-pressed="${chosen.has(p.id)}">
          ${p.logo ? `<img src="${p.logo}" alt="" loading="lazy" onerror="this.remove()">` : '<span class="sv-blank"></span>'}
          <span>${esc(p.name)}</span>
        </button>`).join('') || '<p class="hint">No services match.</p>';
    }
    draw();
    $('#sv-q', sheet).addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('.sv-item');
      if (!b) return;
      const id = +b.dataset.id;
      if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
      b.classList.toggle('on', chosen.has(id));
      b.setAttribute('aria-pressed', String(chosen.has(id)));
    });
  });
}
