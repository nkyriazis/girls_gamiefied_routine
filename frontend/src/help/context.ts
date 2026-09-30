import { createContext, useContext, useEffect, useState } from 'react';
import type { Tour } from './tours';

// Every screen says which tour explains it (useHelp); the owl plays the one on top.
// A screen that has room for the owl in its own header puts it there (inline) and
// the floating one steps aside.

export interface HelpApi {
  register: (key: symbol, tour: Tour, inline: boolean) => void;
  unregister: (key: symbol) => void;
  /** The tour for what's on screen, and whether it hasn't been played yet */
  current: Tour | null;
  fresh: boolean;
  inline: boolean;
  playing: boolean;
  play: () => void;
}

export const HelpContext = createContext<HelpApi | null>(null);

export const useHelpApi = () => useContext(HelpContext);

/** This screen's tour while it's mounted (null: none now). Memoize the tour. */
export function useHelp(tour: Tour | null, { inline = false } = {}) {
  const help = useContext(HelpContext);
  const [key] = useState(() => Symbol('help'));
  const register = help?.register, unregister = help?.unregister;
  useEffect(() => {
    if (!register || !unregister || !tour) return;
    register(key, tour, inline);
    return () => unregister(key);
  }, [register, unregister, key, tour, inline]);
}
