// Shared screen helpers. This file gathers them into one import; each lives in js/ui/:
//   ui/dom.js       $ and $$, movie labels, and the navigation hub screens use to reach each other
//   ui/sheet.js     bottom sheets, confirmations, and keeping sheets above the iPhone keyboard
//   ui/toast.js     short messages at the bottom of the screen
//   ui/swipe.js     swipe to delete on list rows
//   ui/controls.js  rating icons, dice, segmented controls, die-size chips

export { $, $$, movieLabel, nav } from './ui/dom.js';
export { openSheet, closeSheet, swapSheet, confirmSheet, typedConfirm, initSheets } from './ui/sheet.js';
export { toast } from './ui/toast.js';
export { attachSwipe } from './ui/swipe.js';
export { ratingIcons, dieHTML, syncSeg, dieChips, wireChips } from './ui/controls.js';
// Text and date helpers used to live here; they're in util.js now and still reachable from ui.js.
export { esc, fmtDate } from './util.js';
