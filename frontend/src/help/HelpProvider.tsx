import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpContext, useHelpApi, type HelpApi } from './context';
import { isSeen, playTour } from './runTour';
import type { Tour } from './tours';

// The owl: always in a corner of the kids' screens, explaining whatever is on top.
// Until a screen's tour has been played, it wiggles and offers to show.

type Entry = { tour: Tour; inline: boolean; seq: number };
let seq = 0;

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<Map<symbol, Entry>>(new Map());
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0); // re-reads what has been seen

  const register = useCallback((key: symbol, tour: Tour, inline: boolean) => {
    setEntries(prev => new Map(prev).set(key, { tour, inline, seq: ++seq }));
  }, []);
  const unregister = useCallback((key: symbol) => {
    setEntries(prev => { const next = new Map(prev); next.delete(key); return next; });
  }, []);

  // The top layer wins; on the same layer, the screen that opened last
  const top = [...entries.values()].sort((a, b) => b.tour.layer - a.tour.layer || b.seq - a.seq)[0] ?? null;
  const current = top?.tour ?? null;

  const play = useCallback(() => {
    if (!current) return;
    setPlaying(true);
    playTour(current, () => { setPlaying(false); setPlayed(n => n + 1); });
  }, [current]);

  const value = useMemo<HelpApi>(() => ({
    register, unregister, current, playing, play,
    inline: !!top?.inline,
    // `played` makes this recompute once a tour ends
    fresh: !!current && played >= 0 && !isSeen(current.id),
  }), [register, unregister, current, top?.inline, playing, play, played]);

  return (
    <HelpContext.Provider value={value}>
      {children}
      {current && !top?.inline && <HelpButton />}
    </HelpContext.Provider>
  );
};

/** The owl button. Floating by default; `inline` sits in a screen's own header. */
export const HelpButton: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const help = useHelpApi();
  const tourId = help?.current?.id;
  const fresh = !!help?.fresh && !help.playing;
  // "Να σου δείξω;" for a while when a screen is new to her; the wiggle stays
  const [offerFor, setOfferFor] = useState<string | null>(null);
  useEffect(() => {
    if (!fresh || !tourId) return;
    const show = setTimeout(() => setOfferFor(tourId), 900);
    const hide = setTimeout(() => setOfferFor(null), 12000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [fresh, tourId]);
  if (!help?.current || (inline !== help.inline)) return null;
  const offer = fresh && offerFor === tourId;

  return (
    <div className={`help-anchor ${inline ? 'inline' : 'floating'}`}>
      <motion.button
        type="button"
        className={`help-btn ${fresh ? 'fresh' : ''}`}
        aria-label="Βοήθεια"
        onClick={help.play}
        whileTap={{ scale: 0.9 }}
        animate={fresh ? { rotate: [0, -14, 12, -8, 6, 0], y: [0, -6, 0, -3, 0, 0] } : { rotate: 0, y: 0 }}
        transition={fresh ? { duration: 1.1, repeat: Infinity, repeatDelay: 2.2 } : { duration: 0.2 }}
      >
        <span className="help-btn-owl" aria-hidden>🦉</span>
        <span className="help-btn-q" aria-hidden>{fresh ? '!' : '?'}</span>
      </motion.button>
      <AnimatePresence>
        {offer && (
          <motion.button
            type="button"
            className="help-offer"
            onClick={help.play}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', bounce: 0.45 }}
          >
            Να σου δείξω; 👀
          </motion.button>
        )}
      </AnimatePresence>
      <style>{`
        .help-anchor { position: relative; display: flex; align-items: center; }
        .help-anchor.floating { position: fixed; left: 1.5rem; bottom: 1.6rem; z-index: 7000; }
        .help-anchor.inline { margin-right: 1rem; }
        .help-btn { position: relative; width: 64px; height: 64px; min-width: 64px; padding: 0; border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.85); cursor: pointer; display: grid; place-items: center;
          background: radial-gradient(circle at 35% 30%, #b8b8ff, #6c63ff 55%, #3f37c9);
          box-shadow: 0 4px 18px rgba(108, 99, 255, 0.55); -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        .help-anchor.inline .help-btn { width: 52px; height: 52px; min-width: 52px; border-width: 2px; }
        .help-btn.fresh { box-shadow: 0 0 0 0 rgba(255, 214, 10, 0.7), 0 4px 18px rgba(108, 99, 255, 0.55); animation: help-glow 2s infinite; }
        .help-btn-owl { font-size: 2.2rem; line-height: 1; }
        .help-anchor.inline .help-btn-owl { font-size: 1.8rem; }
        .help-btn-q { position: absolute; top: -6px; right: -6px; min-width: 1.5rem; height: 1.5rem; border-radius: 1rem;
          background: #ffd60a; color: #2a1a00; font-weight: 900; font-size: 1rem; display: grid; place-items: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
        .help-offer { position: absolute; white-space: nowrap; font-size: 1.1rem; font-weight: bold; color: #2a1a00; cursor: pointer;
          background: linear-gradient(135deg, #ffd60a, #fb8500); border: none; border-radius: 1.2rem; padding: 0.55rem 1rem;
          box-shadow: 0 6px 20px rgba(0,0,0,0.45); }
        .help-anchor.floating .help-offer { left: calc(100% + 14px); transform-origin: left center; }
        .help-anchor.floating .help-offer::before { content: ''; position: absolute; right: 100%; top: 50%; margin-top: -8px;
          border: 8px solid transparent; border-right-color: #fdb814; }
        .help-anchor.inline .help-offer { top: calc(100% + 12px); right: -0.5rem; transform-origin: top right; z-index: 10; }
        .help-anchor.inline .help-offer::before { content: ''; position: absolute; bottom: 100%; right: 1.6rem;
          border: 8px solid transparent; border-bottom-color: #fcc40f; }
        @keyframes help-glow { 0% { box-shadow: 0 0 0 0 rgba(255,214,10,0.7), 0 4px 18px rgba(108,99,255,0.55); }
          70% { box-shadow: 0 0 0 16px rgba(255,214,10,0), 0 4px 18px rgba(108,99,255,0.55); }
          100% { box-shadow: 0 0 0 0 rgba(255,214,10,0), 0 4px 18px rgba(108,99,255,0.55); } }
      `}</style>
    </div>
  );
};
