import { State, Action, PlayMode } from "./types";

const PLAY_MODE_CYCLE: PlayMode[] = ["stop", "continuous", "repeat"];

export const initialState: State = {
  tracks: [],
  currentIndex: null,
  selectedIndex: null,
  isPlaying: false,
  playMode: "continuous",
  searchQuery: "",
  songInfoTrack: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TRACKS":
      return { ...state, tracks: action.tracks, currentIndex: null, selectedIndex: null, isPlaying: false };
    case "APPEND_TRACKS":
      return { ...state, tracks: [...state.tracks, ...action.tracks] };
    case "SET_CURRENT":
      return { ...state, currentIndex: action.index, selectedIndex: action.index, isPlaying: action.index !== null };
    case "SET_PLAYBACK_TRACK":
      return { ...state, currentIndex: action.index, isPlaying: action.index !== null };
    case "SELECT_TRACK":
      return {
        ...state,
        selectedIndex: action.index,
        currentIndex: action.autoPlay ? action.index : state.currentIndex,
        isPlaying: action.autoPlay ? action.index !== null : state.isPlaying,
      };
    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };
    case "CYCLE_PLAY_MODE": {
      const next = PLAY_MODE_CYCLE[(PLAY_MODE_CYCLE.indexOf(state.playMode) + 1) % PLAY_MODE_CYCLE.length];
      return { ...state, playMode: next };
    }
    case "SET_PLAY_MODE":
      return { ...state, playMode: action.mode };
    case "SET_SEARCH":
      return { ...state, searchQuery: action.query };
    case "UPDATE_DURATION":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, duration: action.duration } : t
        ),
      };
    case "UPDATE_SIZE":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, size: action.size } : t
        ),
      };
    case "SET_GOOD":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, good: !t.good, bad: false, dirty: true } : t
        ),
      };
    case "SET_BAD":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, bad: !t.bad, good: false, dirty: true } : t
        ),
      };
    case "CLEAR_RATING":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, good: false, bad: false, dirty: true } : t
        ),
      };
    case "SET_SONG_INFO_TRACK":
      return { ...state, songInfoTrack: action.track };
    case "UPDATE_TRANSCRIPT":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index
            ? { ...t, transcript: action.transcript, dirty: action.transcript !== t.tempTranscript || t.lyrics !== t.tempLyrics }
            : t
        ),
      };
    case "RESTORE_TRANSCRIPT":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index
            ? { ...t, transcript: t.tempTranscript, dirty: t.lyrics !== t.tempLyrics }
            : t
        ),
      };
    case "MARK_TRACKS_SAVED": {
      const savedPaths = new Set(action.paths);
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          savedPaths.has(t.path) ? { ...t, tempTranscript: t.transcript, tempLyrics: t.lyrics, dirty: false } : t
        ),
      };
    }
    case "UPDATE_DETAIL_LYRICS":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index
            ? { ...t, lyrics: action.lyrics, dirty: t.transcript !== t.tempTranscript || action.lyrics !== t.tempLyrics }
            : t
        ),
      };
    case "RESTORE_LYRICS":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index
            ? { ...t, lyrics: t.tempLyrics, dirty: t.transcript !== t.tempTranscript }
            : t
        ),
      };
    case "UPDATE_LYRICS": {
      // path が一致するプレイリスト内トラックと songInfoTrack の両方を同期更新
      const { lyrics, draftLyrics, syncedLyrics, draftSyncedLyrics } = action;
      const patch = { lyrics, draftLyrics, syncedLyrics, draftSyncedLyrics };
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.path === action.path
            ? {
                ...t,
                ...patch,
                dirty: action.dirty ?? (t.transcript !== t.tempTranscript || lyrics !== t.tempLyrics),
              }
            : t
        ),
        songInfoTrack:
          state.songInfoTrack && state.songInfoTrack.path === action.path
            ? { ...state.songInfoTrack, ...patch, dirty: action.dirty ?? false }
            : state.songInfoTrack,
      };
    }
    default:
      return state;
  }
}
