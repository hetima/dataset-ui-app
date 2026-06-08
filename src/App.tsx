import { useReducer, useRef, useEffect, useCallback, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AppSettings } from "./lib/settings";
import { reducer, initialState } from "./reducer";
import { scanFolder } from "./lib/audio";
import { Header } from "./components/Header";
import { PlaylistTable } from "./components/PlaylistTable";
import { DetailPanel } from "./components/DetailPanel";
import "./App.css";

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef<HTMLAudioElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  // 起動時にボリュームを復帰
  useEffect(() => {
    AppSettings.load().then(async (settings) => {
      const v = await settings.getVolume();
      setVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
    });
  }, []);

  // ボリューム変更を audio に反映し store に保存
  const handleVolumeChange = useCallback(async (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    const settings = await AppSettings.load();
    await settings.setVolume(v);
  }, []);

  // 再生中トラックの変化に追従して audio src を更新
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.currentIndex === null) {
      audio.pause();
      return;
    }
    const track = state.tracks[state.currentIndex];
    if (!track) return;
    audio.src = convertFileSrc(track.path);
    if (state.isPlaying) audio.play().catch(() => {});
  }, [state.currentIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [state.isPlaying]);

  // 再生終了イベント
  const handleEnded = useCallback(() => {
    if (state.playMode === "repeat" && state.currentIndex !== null) {
      audioRef.current?.play().catch(() => {});
      return;
    }
    if (state.playMode === "continuous") {
      const next = state.currentIndex !== null ? state.currentIndex + 1 : null;
      if (next !== null && next < state.tracks.length) {
        dispatch({ type: "SET_CURRENT", index: next });
        return;
      }
    }
    dispatch({ type: "SET_PLAYING", playing: false });
  }, [state.playMode, state.currentIndex, state.tracks.length]);

  // loadedmetadata で duration を取得して state を更新
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || state.currentIndex === null) return;
    dispatch({ type: "UPDATE_DURATION", index: state.currentIndex, duration: audio.duration });
  }, [state.currentIndex]);

  // timeupdate
  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(audioRef.current?.currentTime ?? 0);
  }, []);

  // D&D
  useEffect(() => {
    const promise = appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type !== "drop") return;
      const paths = event.payload.paths;
      const shiftHeld = (event.payload as any).modifiers?.shift ?? false;
      const allTracks = [];
      for (const p of paths) {
        try {
          const tracks = await scanFolder(p);
          allTracks.push(...tracks);
        } catch {
          // フォルダでない場合などは無視
        }
      }
      if (allTracks.length === 0) return;
      if (shiftHeld) {
        dispatch({ type: "APPEND_TRACKS", tracks: allTracks });
      } else {
        dispatch({ type: "SET_TRACKS", tracks: allTracks });
      }
    });
    return () => { promise.then((fn) => fn()); };
  }, []);

  // キーボード操作（capture: true で全フォーカス状態から横取り）
  useEffect(() => {
    const isTextInput = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

    const handler = (e: KeyboardEvent) => {
      if (e.code === "KeyF" && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchRef.current) {
          tableRef.current?.focus();
        } else {
          searchRef.current?.focus();
        }
        return;
      }
      if (isTextInput(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: "SET_PLAYING", playing: !state.isPlaying });
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const next = state.currentIndex !== null ? Math.max(0, state.currentIndex - 1) : 0;
        dispatch({ type: "SET_CURRENT", index: next });
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const next = state.currentIndex !== null
          ? Math.min(state.tracks.length - 1, state.currentIndex + 1)
          : 0;
        dispatch({ type: "SET_CURRENT", index: next });
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [state.isPlaying, state.currentIndex, state.tracks.length]);

  const handlePlayPause = () => dispatch({ type: "SET_PLAYING", playing: !state.isPlaying });
  const handlePrev = () => {
    if (state.currentIndex !== null && state.currentIndex > 0) {
      dispatch({ type: "SET_CURRENT", index: state.currentIndex - 1 });
    }
  };
  const handleNext = () => {
    if (state.currentIndex !== null && state.currentIndex < state.tracks.length - 1) {
      dispatch({ type: "SET_CURRENT", index: state.currentIndex + 1 });
    }
  };
  const handleSeek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const currentTrack = state.currentIndex !== null ? state.tracks[state.currentIndex] : null;

  return (
    <div className="flex flex-col h-screen">
      <Header
        isPlaying={state.isPlaying}
        playMode={state.playMode}
        currentTime={currentTime}
        duration={currentTrack?.duration ?? 0}
        nowPlayingName={currentTrack?.name ?? null}
        searchQuery={state.searchQuery}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        searchRef={searchRef}
        onCyclePlayMode={() => dispatch({ type: "CYCLE_PLAY_MODE" })}
        onSeek={handleSeek}
        onSearchChange={(q) => dispatch({ type: "SET_SEARCH", query: q })}
        onSearchEscapeToTable={() => tableRef.current?.focus()}
        volume={volume}
        onVolumeChange={handleVolumeChange}
      />
      <div className="flex flex-1 overflow-hidden">
        <PlaylistTable
          tracks={state.tracks}
          currentIndex={state.currentIndex}
          searchQuery={state.searchQuery}
          ref={tableRef}
          onSelect={(index) => dispatch({ type: "SET_CURRENT", index })}
        />
        <DetailPanel track={currentTrack} />
      </div>
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />
    </div>
  );
}
