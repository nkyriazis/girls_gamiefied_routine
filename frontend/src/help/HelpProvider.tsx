import React, { useCallback, useContext, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api';
import { useGame } from '../context/GameContext';
import { help } from './anchors';
import { sound } from '../sound/sfx';
import { HelpContext, HelpCovered, HelpDepth, useHelpApi, type HelpApi } from './context';
import { playTour, stopTour } from './runTour';
import { seenId, type Tour } from './tour';

// The owl: always in a corner of the screen, explaining whatever is on top. Until a
// screen's tour has been played, it wiggles and offers to show. What has been played is
// server state (AppState.helpSeen), so it's the same on every device and per kid.

type Entry = { tour: Tour; depth: number; inline: boolean; seq: number };
let seq = 0;

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { helpSeen } = useGame();
  const [entries, setEntries] = useState<Map<symbol, Entry>>(new Map());
  // The tour playing, by id (null: none)
  const [playing, setPlaying] = useState<string | null>(null);
  // Played here but maybe not on the server yet (offline, or its STATE hasn't come back)
  const [playedHere, setPlayedHere] = useState<string[]>([]);
  const seen = useMemo(() => new Set([...(helpSeen ?? []), ...playedHere]), [helpSeen, playedHere]);

  const register = useCallback((key: symbol, entry: Omit<Entry, 'seq'>) => {
    setEntries(prev => new Map(prev).set(key, { ...entry, seq: ++seq }));
  }, []);
  const unregister = useCallback((key: symbol) => {
    setEntries(prev => { const next = new Map(prev); next.delete(key); return next; });
  }, []);

  // The deepest screen wins; between siblings, the one that opened last
  const top = [...entries.values()].sort((a, b) => b.depth - a.depth || b.seq - a.seq)[0] ?? null;
  const current = top?.tour ?? null;
  const currentId = current ? seenId(current.id, current.user) : null;

  const play = useCallback(() => {
    if (!current) return;
    const started = playTour(current, {
      seen: id => seen.has(id),
      onEnd: played => {
        setPlaying(null);
        if (!played.length) return;
        setPlayedHere(prev => [...prev, ...played]);
        api.markHelpSeen(played).catch(err => console.warn('Help: not remembered on the server', err));
      },
    });
    if (started) setPlaying(seenId(current.id, current.user));
  }, [current, seen]);

  // Something else came on top while a tour played (a routine over the store): that tour
  // stops, not counted as played, and the owl offers to explain what is on top now
  useEffect(() => {
    if (playing && playing !== currentId) stopTour();
  }, [playing, currentId]);

  const value = useMemo<HelpApi>(() => ({
    register, unregister, current, playing: !!playing, play,
    inline: !!top?.inline,
    fresh: !!current && !seen.has(seenId(current.id, current.user)),
  }), [register, unregister, current, top?.inline, playing, play, seen]);

  return (
    <HelpContext.Provider value={value}>
      {children}
      {current && !top?.inline && <HelpButton />}
    </HelpContext.Provider>
  );
};

/**
 * A screen the owl can explain. Wrap the screen's content; nested screens (a drawer in the
 * home screen, a problem in the player) sit deeper and win while they're open. `tour`
 * null: nothing to explain right now, but the screens inside still count as nested.
 * Under a <HelpCover covered> it explains nothing either: something else is on top.
 */
export const HelpScreen: React.FC<{ tour: Tour | null; inline?: boolean; children: React.ReactNode }> = ({ tour, inline = false, children }) => {
  const helpApi = useContext(HelpContext);
  const depth = useContext(HelpDepth) + 1;
  const covered = useContext(HelpCovered);
  const [key] = useState(() => Symbol('help'));
  const register = helpApi?.register, unregister = helpApi?.unregister;
  // A tour is known by its id: the same id is the same tour, whatever object carries it
  const tourKey = tour ? `${seenId(tour.id, tour.user)}` : null;
  const latestTour = useEffectEvent(() => tour);
  useEffect(() => {
    const t = latestTour();
    if (!register || !unregister || !tourKey || !t || covered) return;
    register(key, { tour: t, depth, inline });
    return () => unregister(key);
  }, [register, unregister, key, tourKey, depth, inline, covered]);
  return <HelpDepth.Provider value={depth}>{children}</HelpDepth.Provider>;
};

/** The screens inside are covered by something on top (routines over the store): the owl leaves them be */
export const HelpCover: React.FC<{ covered: boolean; children: React.ReactNode }> = ({ covered, children }) => (
  <HelpCovered.Provider value={covered}>{children}</HelpCovered.Provider>
);

/** The owl button. Floating by default; `inline` sits in a screen's own header. */
export const HelpButton: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const helpApi = useHelpApi();
  const tourId = helpApi?.current ? seenId(helpApi.current.id, helpApi.current.user) : undefined;
  const fresh = !!helpApi?.fresh && !helpApi.playing;
  // "Να σου δείξω;" for a while when a screen is new; the wiggle stays
  const [offerFor, setOfferFor] = useState<string | null>(null);
  useEffect(() => {
    if (!fresh || !tourId) return;
    const show = setTimeout(() => setOfferFor(tourId), 900);
    const hide = setTimeout(() => setOfferFor(null), 12000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [fresh, tourId]);
  if (!helpApi?.current || inline !== helpApi.inline) return null;
  const offer = fresh && offerFor === tourId;

  return (
    <div className={`help-anchor ${inline ? 'inline' : 'floating'}`}>
      <motion.button
        type="button"
        className={`help-btn ${fresh ? 'fresh' : ''}`}
        aria-label="Βοήθεια"
        onClick={helpApi.play}
        {...sound('owl')}
        whileTap={{ scale: 0.9 }}
        animate={fresh ? { rotate: [0, -14, 12, -8, 6, 0], y: [0, -6, 0, -3, 0, 0] } : { rotate: 0, y: 0 }}
        transition={fresh ? { duration: 1.1, repeat: Infinity, repeatDelay: 2.2 } : { duration: 0.2 }}
        {...help('help.owl')}
      >
        <span className="help-btn-owl" aria-hidden>🦉</span>
        <span className="help-btn-q" aria-hidden>{fresh ? '!' : '?'}</span>
      </motion.button>
      <AnimatePresence>
        {offer && (
          <motion.button
            type="button"
            className="help-offer"
            {...sound('owl')}
            onClick={helpApi.play}
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
        .help-anchor.floating { position: fixed; left: 1.5rem; bottom: 1.6rem; z-index: var(--z-owl); }
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
