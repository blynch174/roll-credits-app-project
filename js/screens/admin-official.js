// Admin tools → Official festivals: edit drafts of the festivals everyone gets, then publish them.
// Drafts are edited in the normal Edit festival screen (store.openDraft points it at the draft).
// Nothing reaches users until Publish.

import * as store from '../store.js';
import * as cloud from '../cloud.js';
import * as official from '../official.js';
import {
  BUILT_IN_FESTIVALS, RATING_ICONS, SWATCHES, SHELVES, shelfName, buildBuiltInFestival, tablesFromFestival, categoriesFromTables, makeCategory,
} from '../defaults.js';
import { iconSVG } from '../icons.js';
import { $, $$, esc, toast, nav, openSheet, closeSheet, confirmSheet, syncSeg } from '../ui.js';

let pubs = [];
let drafts = [];
let saveTimer = null;
let saving = null;
let draftStatus = '';

const ago = (ms) => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const who = (email) => (email ? email.split('@')[0] : 'someone');

// ---------- The list in Admin tools ----------

export async function renderOfficialSection() {
  const box = $('#official-admin');
  if (!box) return;
  box.innerHTML = '<p class="hint">Loading…</p>';
  try {
    [pubs, drafts] = await Promise.all([cloud.listOfficial(), cloud.listDrafts()]);
  } catch (e) {
    box.innerHTML = `<p class="hint">${esc(cloud.errorText(e))}</p>`;
    return;
  }
  const ids = new Set([...pubs.map((p) => p.id), ...drafts.map((d) => d.id)]);
  const missing = BUILT_IN_FESTIVALS.filter((d) => !ids.has(d.id));
  const rows = [
    ...pubs.map((p) => ({ id: p.id, name: p.name, icon: p.icon, pub: p, draft: drafts.find((d) => d.id === p.id) })),
    ...drafts.filter((d) => !pubs.some((p) => p.id === d.id)).map((d) => ({ id: d.id, name: d.name, icon: d.icon, pub: null, draft: d })),
  ];
  box.innerHTML = `
    ${missing.length ? `
      <div class="card admin-soon">
        <p class="sheet-text">${pubs.length ? `${missing.length} built-in festival${missing.length === 1 ? ' isn’t' : 's aren’t'} published yet.` : 'Start by publishing the festivals already built into the app. Nothing changes for anyone; they become editable here.'}</p>
        <button type="button" class="btn primary small" id="of-import">Publish ${missing.length === BUILT_IN_FESTIVALS.length ? 'the built-in festivals' : missing.map((d) => d.name).join(', ')}</button>
      </div>` : ''}
    <ul class="official-list">
      ${rows.map((r) => `
        <li>
          <button type="button" class="official-row" data-edit="${esc(r.id)}">
            <span class="fest-icon small">${iconSVG(r.icon)}</span>
            <span class="or-text">
              <b>${esc(r.name)}</b>
              <small>${r.pub ? `Published ${esc(ago(r.pub.publishedAt))}${r.pub.hidden ? ' · Hidden' : ''}` : 'Not published yet'}${r.draft ? ` · Draft by ${esc(who(r.draft.updatedBy))}, ${esc(ago(r.draft.updatedAt))}` : ''}</small>
            </span>
            <span class="or-go">Edit</span>
          </button>
        </li>`).join('')}
    </ul>
    <button type="button" class="btn ghost" id="of-new">+ New Official Festival</button>`;
  const imp = $('#of-import');
  if (imp) imp.addEventListener('click', () => importBuiltIns(missing));
  $$('[data-edit]', box).forEach((b) => b.addEventListener('click', () => openDraftEditor(b.dataset.edit)));
  $('#of-new').addEventListener('click', newFestivalSheet);
}

async function importBuiltIns(defs) {
  const btn = $('#of-import');
  if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
  try {
    for (const def of defs) {
      const order = BUILT_IN_FESTIVALS.indexOf(def);
      // Published as revision 1 = exactly what's built into the app, so nobody sees an update.
      await cloud.publishOfficial(def.id, {
        name: def.name, icon: def.icon, tables: tablesFromFestival(buildBuiltInFestival(def)),
        rev: 1, kind: 'fix', message: '', hidden: false, order, shelf: def.shelf || '', blurb: def.blurb || '',
      });
    }
    toast('Built-in festivals published. Tap one to edit it.');
  } catch (e) {
    toast(cloud.errorText(e));
  }
  official.refresh();
  renderOfficialSection();
}

function newFestivalSheet() {
  let icon = 'star';
  const sheet = openSheet({
    title: 'New official festival',
    body: `
      <label class="field"><span class="label">Name</span><input id="nf-name" type="text" maxlength="40" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" placeholder="Thanksgiving, Summer Blockbusters…"></label>
      <div class="field"><span class="label">Rating icon</span>
        <div class="icon-grid" id="nf-icon">${RATING_ICONS.map((n) => `<button type="button" class="icon-pick ${n === icon ? 'on' : ''}" data-i="${n}" aria-label="${n}">${iconSVG(n)}</button>`).join('')}</div>
      </div>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Create Draft', kind: 'primary', onClick: async (s) => {
          const name = $('#nf-name', s).value.trim();
          if (!name) return toast('Give it a name.');
          const taken = new Set([...pubs.map((p) => p.id), ...drafts.map((d) => d.id), ...BUILT_IN_FESTIVALS.map((d) => d.id), ...store.festivals().map((f) => f.id)]);
          let id = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'festival';
          if (taken.has(id)) { let n = 2; while (taken.has(`${id}-${n}`)) n++; id = `${id}-${n}`; }
          const cats = SWATCHES.slice(0, 6).map((sw, i) => makeCategory(i === 5 ? 'Wild Card' : `Category ${i + 1}`, i === 5 ? 'slate' : sw.id, 12));
          const tables = tablesFromFestival({ mode: 'two', categoryDie: 6, categories: cats });
          try {
            await cloud.saveDraft(id, { name, icon, tables, baseRev: 0 });
          } catch (e) {
            return toast(cloud.errorText(e));
          }
          closeSheet();
          drafts.push({ id, name, icon, tables, baseRev: 0, updatedAt: Date.now(), updatedBy: cloud.currentUser().email });
          openDraftEditor(id);
        },
      },
    ],
  });
  $('#nf-icon', sheet).addEventListener('click', (e) => {
    const b = e.target.closest('.icon-pick'); if (!b) return;
    icon = b.dataset.i;
    $$('#nf-icon .icon-pick', sheet).forEach((x) => x.classList.toggle('on', x === b));
  });
}

// ---------- Editing a draft ----------

export function openDraftEditor(id) {
  const pub = pubs.find((p) => p.id === id) || null;
  const d = drafts.find((x) => x.id === id) || null;
  const src = d || pub;
  if (!src) return toast('Couldn’t find that festival.');
  const fest = {
    id: 'draft:' + id,
    officialId: id,
    name: src.name,
    icon: src.icon,
    builtIn: false,
    mode: src.tables.mode,
    categoryDie: src.tables.categoryDie,
    freshSince: null,
    categories: categoriesFromTables(src.tables),
    draftInfo: {
      baseRev: pub ? pub.rev : 0,
      published: !!pub,
      hidden: pub ? pub.hidden : false,
      order: pub ? pub.order : pubs.length + 10,
      updatedBy: d ? d.updatedBy : '',
      updatedAt: d ? d.updatedAt : 0,
      hasDraft: !!d,
    },
  };
  draftStatus = d ? `Draft · last edited by ${who(d.updatedBy)}, ${ago(d.updatedAt)}` : pub ? 'No changes yet' : 'Draft';
  store.openDraft(fest, scheduleSave);
  nav.go('edit', { part: 'tables', keepDraft: true });
}

function scheduleSave(fest) {
  fest.draftInfo.hasDraft = true;
  setStatus('Saving draft…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(fest), 1000);
}

function saveNow(fest) {
  clearTimeout(saveTimer);
  saveTimer = null;
  saving = cloud.saveDraft(fest.officialId, {
    name: fest.name, icon: fest.icon, tables: tablesFromFestival(fest), baseRev: fest.draftInfo.baseRev,
  })
    .then(() => {
      fest.draftInfo.updatedBy = cloud.currentUser().email;
      fest.draftInfo.updatedAt = Date.now();
      setStatus('Draft saved');
    })
    .catch((e) => setStatus(`Couldn’t save the draft: ${cloud.errorText(e)}`))
    .finally(() => { saving = null; });
  return saving;
}

function setStatus(text) {
  draftStatus = text;
  const el = $('#draft-status');
  if (el) el.textContent = text;
}

async function flush() {
  const f = store.currentDraft();
  if (saveTimer && f) await saveNow(f);
  else if (saving) await saving;
}

// Navigating away (tab bar, festival menu): save what's pending and close the draft.
export function leaveDraft() {
  flush();
  store.closeDraft();
}

export async function closeDraftEditor() {
  await flush();
  store.closeDraft();
  nav.go('admin');
}

// The Festival settings tab while editing a draft.
export function draftSettingsHTML(f) {
  const info = f.draftInfo;
  return `
    <p class="draft-status" id="draft-status">${esc(draftStatus)}</p>
    <button type="button" class="row-btn" id="btn-look"><span>Name &amp; Rating Icon</span></button>
    <button type="button" class="row-btn" id="btn-dice"><span>Festival Dice</span></button>
    <button type="button" class="row-btn accent" id="btn-publish"><span>Publish…</span></button>
    ${info.published ? '<button type="button" class="row-btn" id="btn-shelf"><span>Library Shelf</span></button>' : ''}
    ${info.published ? `<button type="button" class="row-btn" id="btn-hide"><span>${info.hidden ? 'Unhide' : 'Hide from Library'}</span></button>` : ''}
    ${info.hasDraft ? '<button type="button" class="row-btn danger" id="btn-discard"><span>Discard Draft</span></button>' : ''}`;
}

export function wireDraftSettings(f) {
  $('#btn-publish').addEventListener('click', () => publishSheet(f));
  const shelfBtn = $('#btn-shelf');
  if (shelfBtn) shelfBtn.addEventListener('click', () => shelfSheet(f));
  const hide = $('#btn-hide');
  if (hide) hide.addEventListener('click', async () => {
    const to = !f.draftInfo.hidden;
    try {
      await cloud.setOfficialHidden(f.officialId, to);
      f.draftInfo.hidden = to;
      toast(to ? `${f.name} is hidden from the Festival Library.` : `${f.name} is visible again.`);
      official.refresh();
      nav.render();
    } catch (e) {
      toast(cloud.errorText(e));
    }
  });
  const discard = $('#btn-discard');
  if (discard) discard.addEventListener('click', () => confirmSheet(
    'Discard this draft?',
    f.draftInfo.published ? 'Your unpublished changes are thrown away. The published version stays as it is.' : 'This festival was never published, so it’s deleted.',
    'Discard',
    async () => {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (saving) await saving;
      try {
        await cloud.deleteDraft(f.officialId);
      } catch (e) {
        return toast(cloud.errorText(e));
      }
      store.closeDraft();
      nav.go('admin');
      toast('Draft discarded.');
    },
    true
  ));
}

const bundled = (id) => BUILT_IN_FESTIVALS.find((d) => d.id === id) || {};

// Where this festival sits in the Festival Library, and its one-line description there.
function shelfSheet(f) {
  const pub = official.get(f.officialId) || pubs.find((p) => p.id === f.officialId) || {};
  const cur = pub.shelf || bundled(f.officialId).shelf || '';
  const blurb = pub.blurb || bundled(f.officialId).blurb || '';
  openSheet({
    title: 'Library Shelf',
    body: `
      <label class="field"><span class="label">Shelf</span>
        <select id="sh-shelf">${SHELVES.map((s) => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field"><span class="label">Description</span>
        <input id="sh-blurb" type="text" maxlength="120" enterkeyhint="done" value="${esc(blurb)}" placeholder="One short line"></label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      {
        label: 'Save', kind: 'primary', onClick: async (s) => {
          const shelf = $('#sh-shelf', s).value;
          try {
            await cloud.setOfficialShelf(f.officialId, { shelf, blurb: $('#sh-blurb', s).value.trim() });
          } catch (e) {
            return toast(cloud.errorText(e));
          }
          closeSheet();
          official.refresh();
          toast(`${f.name} is on the ${shelfName(shelf)} shelf.`);
        },
      },
    ],
  });
}

function publishSheet(f) {
  const info = f.draftInfo;
  let kind = 'version';
  const sheet = openSheet({
    title: `Publish ${f.name}`,
    body: `
      ${info.published ? `
        <div class="field"><span class="label">What kind of update?</span>
          <div class="seg" id="p-kind">
            <button type="button" data-value="version">New Version</button>
            <button type="button" data-value="fix">Quick Fix</button>
          </div>
          <p class="hint" id="p-hint"></p>
        </div>` : ''}
      <label class="field" id="p-msg-wrap"><span class="label">Message <em>(optional)</em></span>
        <textarea id="p-msg" maxlength="200" placeholder="${esc(f.name)} just dropped some new picks!"></textarea></label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: closeSheet },
      { label: 'Publish', kind: 'primary', id: 'p-go', onClick: (s) => publish(f, kind, $('#p-msg', s).value.trim(), s) },
    ],
  });
  const update = () => {
    const seg = $('#p-kind', sheet);
    if (!seg) return;
    syncSeg(seg, kind);
    $('#p-hint', sheet).textContent = kind === 'version' ? 'Announced with your message.' : 'No announcement.';
    $('#p-msg-wrap', sheet).hidden = kind === 'fix';
  };
  const seg = $('#p-kind', sheet);
  if (seg) seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    kind = b.dataset.value; update();
  });
  update();
}

async function publish(f, kind, message, sheet) {
  const btn = $('#p-go', sheet);
  btn.disabled = true;
  btn.textContent = 'Publishing…';
  clearTimeout(saveTimer);
  saveTimer = null;
  if (saving) await saving;
  const info = f.draftInfo;
  let latest = null;
  try {
    latest = (await cloud.listOfficial()).find((p) => p.id === f.officialId) || null;
    await cloud.publishOfficial(f.officialId, {
      name: f.name,
      icon: f.icon,
      tables: tablesFromFestival(f),
      rev: (latest ? latest.rev : 0) + 1,
      kind: info.published ? kind : 'version',
      message: kind === 'fix' && info.published ? '' : message,
      hidden: latest ? latest.hidden : false,
      order: latest ? latest.order : info.order,
      shelf: latest ? latest.shelf : (bundled(f.officialId).shelf || ''),
      blurb: latest ? latest.blurb : (bundled(f.officialId).blurb || ''),
    });
    await cloud.deleteDraft(f.officialId).catch(() => {});
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Publish';
    return toast(cloud.errorText(e));
  }
  closeSheet();
  store.closeDraft();
  await official.refresh();
  nav.go('admin');
  toast(`${f.name} is published.`);
}
