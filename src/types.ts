export type Track = {
  path: string;
  name: string;
  duration: number; // 秒
  size: number;     // バイト
  good: boolean;
  bad: boolean;
  transcript: string;
};

export type PlayMode = "stop" | "continuous" | "repeat";

export type State = {
  tracks: Track[];
  currentIndex: number | null;
  isPlaying: boolean;
  playMode: PlayMode;
  searchQuery: string;
};

export type Action =
  | { type: "SET_TRACKS"; tracks: Track[] }
  | { type: "APPEND_TRACKS"; tracks: Track[] }
  | { type: "SET_CURRENT"; index: number | null }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "CYCLE_PLAY_MODE" }
  | { type: "SET_PLAY_MODE"; mode: PlayMode }
  | { type: "SET_SEARCH"; query: string }
  | { type: "UPDATE_DURATION"; index: number; duration: number }
  | { type: "SET_GOOD"; index: number }
  | { type: "SET_BAD"; index: number }
  | { type: "CLEAR_RATING"; index: number };
