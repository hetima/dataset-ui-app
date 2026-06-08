import { State, Action, PlayMode } from "./types";

const PLAY_MODE_CYCLE: PlayMode[] = ["stop", "continuous", "repeat"];

export const initialState: State = {
  tracks: [],
  currentIndex: null,
  isPlaying: false,
  playMode: "continuous",
  searchQuery: "",
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TRACKS":
      return { ...state, tracks: action.tracks, currentIndex: null, isPlaying: false };
    case "APPEND_TRACKS":
      return { ...state, tracks: [...state.tracks, ...action.tracks] };
    case "SET_CURRENT":
      return { ...state, currentIndex: action.index, isPlaying: action.index !== null };
    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };
    case "CYCLE_PLAY_MODE": {
      const next = PLAY_MODE_CYCLE[(PLAY_MODE_CYCLE.indexOf(state.playMode) + 1) % PLAY_MODE_CYCLE.length];
      return { ...state, playMode: next };
    }
    case "SET_SEARCH":
      return { ...state, searchQuery: action.query };
    case "UPDATE_DURATION":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, duration: action.duration } : t
        ),
      };
    default:
      return state;
  }
}
