import { createContext, useContext } from 'react';
import type { Tour } from './tour';

// Every screen says which tour explains it (<HelpScreen>); the owl plays the one on top:
// the most deeply nested screen, as React nests them (a problem step inside the player,
// inside her screen, inside the home screen), portals included. A screen that has room
// for the owl in its own header puts it there (inline) and the floating one steps aside.

export interface HelpApi {
  register: (key: symbol, entry: { tour: Tour; depth: number; inline: boolean }) => void;
  unregister: (key: symbol) => void;
  /** The tour for what's on screen, and whether it hasn't been played yet */
  current: Tour | null;
  fresh: boolean;
  inline: boolean;
  playing: boolean;
  play: () => void;
}

export const HelpContext = createContext<HelpApi | null>(null);

/** How deep in the screens a component sits (0: outside all of them) */
export const HelpDepth = createContext(0);

export const useHelpApi = () => useContext(HelpContext);
