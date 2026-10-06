// The look of the selected answer box, shared by the problem player's calc line and its
// numbers step (#52): one cyan ring with a glow and a slight lift. Cyan is used nowhere else
// on these steps (gold already means the operation and «what we seek», green found, red
// wrong), and nothing blinks. The browser's own focus outline and hover border are off on
// these boxes, and the focus outline on the keys and chips around them (.answer-key), so the
// selected box carries the only mark.
export const ANSWER_BOX_CSS = `
  .answer-box { color: inherit; font-family: inherit; cursor: pointer; line-height: 1.2;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s, translate 0.15s; }
  .answer-box:focus, .answer-box:focus-visible { outline: none; }
  .answer-box:not(.focused):hover { border-color: rgba(255,255,255,0.25); }
  .answer-box.focused { opacity: 1; border-color: #22d3ee; background-color: rgba(34,211,238,0.14); translate: 0 -3px;
    box-shadow: 0 0 0 3px rgba(34,211,238,0.35), 0 0 18px rgba(34,211,238,0.55); }
  .answer-box:disabled { cursor: default; }
  .answer-key:focus, .answer-key:focus-visible { outline: none; }
`;

/** A short shake: this box can't take that input. (Web Animations: leaves no inline style behind.) */
export function wiggle(el: HTMLElement | null | undefined) {
  el?.animate(
    [0, -7, 7, -5, 5, -2, 0].map(px => ({ transform: `translateX(${px}px)` })),
    { duration: 380, easing: 'ease-in-out' },
  );
}
