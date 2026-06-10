import { State, Action, PlayMode } from "./types";

const PLAY_MODE_CYCLE: PlayMode[] = ["stop", "continuous", "repeat"];

export const initialState: State = {
  tracks: [],
  currentIndex: null,
  isPlaying: false,
  playMode: "continuous",
  searchQuery: "",
  songInfoTrack: null,
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
          i === action.index ? { ...t, good: !t.good, bad: false } : t
        ),
      };
    case "SET_BAD":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, bad: !t.bad, good: false } : t
        ),
      };
    case "CLEAR_RATING":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, good: false, bad: false } : t
        ),
      };
    case "SET_SONG_INFO_TRACK":
      return { ...state, songInfoTrack: action.track };
    case "UPDATE_TRANSCRIPT":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, transcript: action.transcript } : t
        ),
      };
    case "RESTORE_TRANSCRIPT":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, transcript: t.tempTranscript } : t
        ),
      };
    case "COMMIT_TRANSCRIPTS_TO_TEMP":
      return {
        ...state,
        tracks: state.tracks.map((t) => ({ ...t, tempTranscript: t.transcript })),
      };
    case "UPDATE_LYRICS":
      // path が一致するプレイリスト内トラックと songInfoTrack の両方を同期更新
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.path === action.path ? { ...t, lyrics: action.lyrics } : t
        ),
        songInfoTrack:
          state.songInfoTrack && state.songInfoTrack.path === action.path
            ? { ...state.songInfoTrack, lyrics: action.lyrics }
            : state.songInfoTrack,
      };
    default:
      return state;
  }
}
