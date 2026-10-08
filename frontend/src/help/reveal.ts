// driver.js brings a step's widget into the window's view, never into the view of a list that
// scrolls inside the page: a widget below such a list's edge stays clipped while the bubble points
// at it (on her own screen, «Κι άλλο πρόβλημα» under three extra problems left with ✕, #67, at
// 1280×800). So before each step the lists it sits in scroll, nearest first, just enough to show
// it; the page itself never moves (only boxes that scroll: `.dashboard` is overflow: clip, #30).

type Edges = Pick<DOMRect, 'top' | 'bottom'>;

/** How far a list scrolls (down positive) to show `el` with `pad` around it, top first if it can't fit. */
export function revealBy(el: Edges, box: Edges, pad = 12): number {
  if (el.top - pad < box.top) return el.top - pad - box.top;
  if (el.bottom + pad > box.bottom) return Math.min(el.bottom + pad - box.bottom, el.top - pad - box.top);
  return 0;
}

export function revealInLists(el: Element) {
  for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
    const { overflowY } = getComputedStyle(box);
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue;
    const by = revealBy(el.getBoundingClientRect(), box.getBoundingClientRect());
    if (by) box.scrollTop += by;
  }
}
