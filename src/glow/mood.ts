import { createContext, useContext } from "react";
import type { Mood } from "./tokens";

/**
 * The screen-level light on top of every card's own look (spec 2.1, Moods): Today takes its moment's, the Sleep tab is
 * always night, everything else day.
 */
const MoodContext = createContext<Mood>("day");
export const MoodProvider = MoodContext.Provider;
export const useMood = () => useContext(MoodContext);
