// Swipe to delete (and optionally swipe right for a second action) on list rows.

// Rows look like: <li class="swipe-row"><button class="swipe-del">Delete</button><button class="watched-item">...</button></li>
// Swipe a row left to reveal Delete; swipe far enough and it deletes on its own, like Mail.
const REVEAL = 92; // px the row stays open
let openRow = null;

function setX(item, x, animate) {
  item.style.transition = animate ? 'transform .2s ease-out' : 'none';
  item.style.transform = x ? `translateX(${x}px)` : '';
}

function closeOpenRow(except) {
  if (openRow && openRow !== except) {
    setX(openRow, 0, true);
    openRow.closest('.swipe-row').classList.remove('open');
    openRow = null;
  }
}

// onRight (optional): a full swipe to the right calls it (e.g. "move to watched"). Rows then need a .swipe-right underlay.
export function attachSwipe(list, onDelete, onRight = null) {
  if (list.dataset.swipe) return;
  list.dataset.swipe = '1';
  let item = null,
    startX = 0,
    startY = 0,
    baseX = 0,
    dx = 0,
    mode = null; // mode: null | 'swipe' | 'scroll'

  list.addEventListener('pointerdown', (e) => {
    const it = e.target.closest('.swipe-item');
    if (!it || (e.pointerType === 'mouse' && e.button !== 0)) return;
    closeOpenRow(it);
    item = it;
    startX = e.clientX;
    startY = e.clientY;
    baseX = it === openRow ? -REVEAL : 0;
    dx = 0;
    mode = null;
  });

  list.addEventListener('pointermove', (e) => {
    if (!item) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!mode) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      mode = Math.abs(mx) > Math.abs(my) ? 'swipe' : 'scroll';
      if (mode === 'swipe') {
        item.setPointerCapture && item.setPointerCapture(e.pointerId);
        item.closest('.swipe-row').classList.add('swiping');
      }
    }
    if (mode !== 'swipe') return;
    dx = onRight && baseX === 0 ? baseX + mx : Math.min(0, baseX + mx);
    item.closest('.swipe-row').classList.toggle('to-right', dx > 0);
    setX(item, dx, false);
  });

  const end = () => {
    if (!item) return;
    const it = item;
    item = null;
    const row = it.closest('.swipe-row');
    row.classList.remove('swiping');
    if (mode !== 'swipe') return;
    it.dataset.justSwiped = '1'; // stop the tap that ends a swipe from opening the movie
    setTimeout(() => delete it.dataset.justSwiped, 50);
    const w = it.offsetWidth;
    if (onRight && dx > w * 0.45) {
      setX(it, w + 20, true);
      row.classList.add('removing');
      setTimeout(() => onRight(it.dataset.id), 180);
      if (openRow === it) openRow = null;
    } else if (dx > 0) {
      setX(it, 0, true);
      setTimeout(() => row.classList.remove('to-right'), 200);
    } else if (dx < -w * 0.55) {
      setX(it, -w - 20, true);
      row.classList.add('removing');
      setTimeout(() => onDelete(it.dataset.id), 180);
      openRow = null;
    } else if (dx < -REVEAL / 2) {
      setX(it, -REVEAL, true);
      row.classList.add('open');
      openRow = it;
    } else {
      setX(it, 0, true);
      row.classList.remove('open');
      if (openRow === it) openRow = null;
    }
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);

  // Tapping the revealed Delete button.
  list.addEventListener(
    'click',
    (e) => {
      const del = e.target.closest('.swipe-del');
      if (del) {
        const it = del.closest('.swipe-row').querySelector('.swipe-item');
        openRow = null;
        onDelete(it.dataset.id);
        return;
      }
      const it = e.target.closest('.swipe-item');
      if (!it) return;
      if (it.dataset.justSwiped) {
        e.stopImmediatePropagation(); // the click that ends a swipe isn't a tap
      } else if (it === openRow) {
        e.stopImmediatePropagation(); // a tap on an open row just closes it
        closeOpenRow();
      }
    },
    true,
  );
}
