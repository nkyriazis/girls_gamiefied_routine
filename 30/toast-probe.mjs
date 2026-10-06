// Issue #30: do the chore toasts (top right, where the Install button also sits) cover a side button?
// A toast comes from a server event (a chore confirmed, rejected or expired) and stays 5 s. This
// puts 1, 2, then 3 toasts in .toast-container with the same markup and classes Dashboard.tsx
// renders, so they take the real CSS, and after each one asks whether a tap at each side button's
// centre still hits that button.
export async function probeToasts(page, pause, { shotAt = {}, tag, size } = {}) {
  const out = [];
  for (let n = 1; n <= 3; n++) {
    await page.evaluate(() => {
      const kid = document.querySelector('.dock-name')?.textContent ?? 'Ηλέκτρα';
      const t = document.createElement('div');
      t.className = 'toast toast-rejected probe-toast';
      t.innerHTML = `<span class="toast-icon">✗</span><span class="toast-text">${kid}: «Τακτοποίηση Δωματίου» απορρίφθηκε</span>`;
      document.querySelector('.toast-container').appendChild(t);
    });
    await pause(250);
    out.push(await page.evaluate(n => {
      const toasts = [...document.querySelectorAll('.toast-container .toast')].map(t => t.getBoundingClientRect());
      const stackBottom = Math.max(...toasts.map(b => b.bottom));
      return {
        toasts: n,
        toastHeights: toasts.map(b => +b.height.toFixed(1)),
        stackBottom: +stackBottom.toFixed(1),
        fabs: [...document.querySelectorAll('.daily-exercises-fab, .chores-fab, .bonus-fab, .exercise-fab')].map(f => {
          const b = f.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { fab: f.className, top: +b.top.toFixed(1), clearOfToasts: +(b.top - stackBottom).toFixed(1), tapHitsIt: !!hit && f.contains(hit), hit: hit ? String(hit.className) : null };
        }),
      };
    }, n));
    if (shotAt[n]) await page.screenshot({ path: `${tag}-toasts${n}-${size}.png` });
  }
  await page.evaluate(() => document.querySelectorAll('.probe-toast').forEach(t => t.remove()));
  await pause(250);
  return out;
}

export const toastLine = probes => probes.map(p =>
  `${p.toasts} toast${p.toasts > 1 ? 's' : ''} (to y ${p.stackBottom}): ${p.fabs.filter(f => !f.tapHitsIt).map(f => f.fab.split(' ')[0]).join(', ') || 'no button'} covered`).join('; ');
