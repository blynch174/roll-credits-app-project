// Settings → Send Feedback: a quick note for the developers. It lands in Admin Tools → Feedback.

import * as cloud from '../cloud.js';
import * as store from '../store.js';
import { APP_VERSION } from '../sync.js';
import { $, toast, openSheet, closeSheet } from '../ui.js';

let draft = ''; // kept if sending fails, so nothing typed is lost

const platform = () => {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
};

export function feedbackSheet() {
  openSheet({
    title: 'Send Feedback',
    body: `<label class="field"><span class="label">What should we fix or add?</span>
      <textarea id="fb-text" rows="5" maxlength="2000" placeholder="Something broken, confusing, or missing…"></textarea></label>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: () => { draft = $('#fb-text').value; closeSheet(); } },
      {
        label: 'Send', kind: 'primary', id: 'fb-go', onClick: async (s) => {
          const text = $('#fb-text', s).value.trim();
          if (!text) return $('#fb-text', s).focus();
          const btn = $('#fb-go', s);
          btn.disabled = true;
          btn.textContent = 'Sending…';
          try {
            const fb = await cloud.init();
            if (!fb) throw new Error('offline');
            await cloud.sendFeedback({
              text: text.slice(0, 2000), appVersion: APP_VERSION.slice(0, 20), platform: platform().slice(0, 20),
              screen: `${window.innerWidth}×${window.innerHeight}`.slice(0, 20), theme: store.themeId().slice(0, 40),
            });
          } catch (e) {
            btn.disabled = false;
            btn.textContent = 'Send';
            draft = text;
            return toast("Couldn't send. Check your connection and try again.");
          }
          draft = '';
          closeSheet();
          toast('Thanks! Feedback sent.');
        },
      },
    ],
  });
  const ta = $('#fb-text');
  ta.value = draft;
  ta.focus();
}
