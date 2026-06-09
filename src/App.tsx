import { useReducer, useRef, useEffect, useCallback, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AppSettings } from "./lib/settings";
import { reducer, initialState } from "./reducer";
import { PlayMode } from "./types";
import { scanFolder, saveMtdt, moveRatedFiles, getFileSize } from "./lib/audio";
import { Header } from "./components/Header";
import { AppSidebar } from "./components/AppSidebar";
import { PlaylistTable } from "./components/PlaylistTable";
import { DetailPanel } from "./components/DetailPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/ui/dialog";
import "./App.css";

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef<HTMLAudioElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [folderLibrary, setFolderLibrary] = useState<string[]>([]);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [goodFolderName, setGoodFolderName] = useState("good");
  const [badFolderName, setBadFolderName] = useState("bad");
  const [syncToggle, setSyncToggle] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"icon" | "open">("icon");
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFolderRef = useRef<string | null>(null);
  const tracksRef = useRef(state.tracks);
  const visibleTrackIndicesRef = useRef<number[]>([]);
  const syncToggleRef = useRef(syncToggle);
  tracksRef.current = state.tracks;
  syncToggleRef.current = syncToggle;

  const getAdjacentVisibleIndex = useCallback((currentIndex: number | null, direction: -1 | 1) => {
    const visibleIndices = visibleTrackIndicesRef.current;
    if (visibleIndices.length === 0) return null;
    if (currentIndex === null) return direction > 0 ? visibleIndices[0] : visibleIndices[visibleIndices.length - 1];
    const position = visibleIndices.indexOf(currentIndex);
    if (position < 0) return direction > 0 ? visibleIndices[0] : visibleIndices[visibleIndices.length - 1];
    const nextPosition = Math.max(0, Math.min(visibleIndices.length - 1, position + direction));
    return visibleIndices[nextPosition];
  }, []);

  const handleVisibleIndicesChange = useCallback((indices: number[]) => {
    visibleTrackIndicesRef.current = indices;
  }, []);

  // 起動時に設定を復帰
  useEffect(() => {
    AppSettings.load().then(async (settings) => {
      const v = await settings.getVolume();
      setVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
      setFolderLibrary(await settings.getFolderLibrary());
      setRecentFolders(await settings.getRecentFolders());
      setGoodFolderName(await settings.getGoodFolderName());
      setBadFolderName(await settings.getBadFolderName());
      setSyncToggle(await settings.getSyncToggle());
      const savedPlayMode = await settings.getPlayMode();
      dispatch({ type: "SET_PLAY_MODE", mode: savedPlayMode as PlayMode });
      settingsLoadedRef.current = true;
    });
  }, []);

  // ボリューム変更を audio に反映し store に保存
  const handleVolumeChange = useCallback(async (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    const settings = await AppSettings.load();
    await settings.setVolume(v);
  }, []);

  // 現在のフォルダを mtdt.json に保存
  const saveCurrentFolder = useCallback(async () => {
    if (currentFolderRef.current && tracksRef.current.length > 0) {
      await saveMtdt(currentFolderRef.current, tracksRef.current).catch((e) =>
        console.error("saveMtdt failed:", e)
      );
    }
  }, []);

  // good/bad フォルダ名の変更を保存
  const handleGoodFolderNameChange = useCallback(async (name: string) => {
    setGoodFolderName(name);
    const settings = await AppSettings.load();
    await settings.setGoodFolderName(name);
  }, []);

  const handleBadFolderNameChange = useCallback(async (name: string) => {
    setBadFolderName(name);
    const settings = await AppSettings.load();
    await settings.setBadFolderName(name);
  }, []);

  const handleSyncToggleChange = useCallback(async (v: boolean) => {
    setSyncToggle(v);
    const settings = await AppSettings.load();
    await settings.setSyncToggle(v);
  }, []);

  // playMode 変化時に設定保存（設定ロード完了後のみ）
  const settingsLoadedRef = useRef(false);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AppSettings.load().then((s) => s.setPlayMode(state.playMode));
  }, [state.playMode]);

  // good/bad ファイルをサブフォルダに移動してリロード
  const handleMoveRated = useCallback(async (rating: "good" | "bad") => {
    const folder = currentFolderRef.current;
    if (!folder) return;
    const subFolderName = rating === "good" ? goodFolderName : badFolderName;
    setIsMoving(true);
    try {
      const result = await moveRatedFiles(folder, tracksRef.current, rating, subFolderName);
      if (!result.ok) {
        alert(`以下のファイルが移動先に既に存在します:\n${result.conflicts.join("\n")}`);
        return;
      }
      if (result.reloadedTracks) {
        dispatch({ type: "SET_TRACKS", tracks: result.reloadedTracks });
      }
    } finally {
      setIsMoving(false);
    }
  }, [goodFolderName, badFolderName]);

  // ウィンドウを閉じる前に保存
  useEffect(() => {
    const promise = appWindow.onCloseRequested(async () => {
      await saveCurrentFolder();
    });
    return () => { promise.then((fn) => fn()); };
  }, [saveCurrentFolder]);

  // フォルダをロードして recentFolders に追加
  const handleLoadFolder = useCallback(async (folder: string) => {
    // フォルダ切り替え前に現在のフォルダを保存
    await saveCurrentFolder();
    // 2秒後にローディングダイアログを表示
    loadingTimerRef.current = setTimeout(() => setIsLoading(true), 2000);
    let tracks: Awaited<ReturnType<typeof scanFolder>> = [];
    try {
      tracks = await scanFolder(folder);
    } catch (e) {
      console.error("scanFolder failed:", folder, e);
    }
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    setIsLoading(false);
    currentFolderRef.current = folder;
    dispatch({ type: "SET_TRACKS", tracks });
    const settings = await AppSettings.load();
    const updated = await settings.pushRecentFolder(folder);
    setRecentFolders(updated);
  }, [saveCurrentFolder]);

  // ライブラリにフォルダを追加（重複排除・名前順）
  const handleAddToLibrary = useCallback(async (folder: string) => {
    setFolderLibrary((prev) => {
      if (prev.includes(folder)) return prev;
      const updated = [...prev, folder].sort((a, b) =>
        a.replace(/\\/g, "/").split("/").pop()!.localeCompare(b.replace(/\\/g, "/").split("/").pop()!)
      );
      AppSettings.load().then((s) => s.setFolderLibrary(updated));
      return updated;
    });
  }, []);

  // ライブラリからフォルダを削除
  const handleRemoveLibrary = useCallback(async (folder: string) => {
    setFolderLibrary((prev) => {
      const updated = prev.filter((f) => f !== folder);
      AppSettings.load().then((s) => s.setFolderLibrary(updated));
      return updated;
    });
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
      const next = getAdjacentVisibleIndex(state.currentIndex, 1);
      if (next !== null && next !== state.currentIndex) {
        dispatch({ type: "SET_CURRENT", index: next });
        return;
      }
    }
    dispatch({ type: "SET_PLAYING", playing: false });
  }, [getAdjacentVisibleIndex, state.playMode, state.currentIndex]);

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

  // D&D — サイドバー上ならライブラリ追加、それ以外はプレイリストロード
  useEffect(() => {
    const promise = appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type !== "drop") return;
      const paths = event.payload.paths;
      const shiftHeld = (event.payload as any).modifiers?.shift ?? false;
      const pos = (event.payload as any).position as { x: number; y: number } | undefined;

      // ドロップ座標がサイドバー内かどうか判定
      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      const onSidebar = sidebarRect && pos
        ? pos.x >= sidebarRect.left && pos.x <= sidebarRect.right
          && pos.y >= sidebarRect.top && pos.y <= sidebarRect.bottom
        : false;

      if (onSidebar) {
        for (const p of paths) {
          await handleAddToLibrary(p);
        }
        return;
      }

      const allTracks = [];
      for (const p of paths) {
        try {
          const tracks = await scanFolder(p);
          allTracks.push(...tracks);
        } catch { /* フォルダでない場合は無視 */ }
      }
      if (allTracks.length === 0) return;

      // 履歴に追加
      const settings = await AppSettings.load();
      for (const p of paths) {
        const updated = await settings.pushRecentFolder(p);
        setRecentFolders(updated);
      }

      if (shiftHeld) {
        dispatch({ type: "APPEND_TRACKS", tracks: allTracks });
      } else {
        dispatch({ type: "SET_TRACKS", tracks: allTracks });
      }
    });
    return () => { promise.then((fn) => fn()); };
  }, [handleAddToLibrary]);

  // キーボード操作（capture: true で全フォーカス状態から横取り）
  useEffect(() => {
    const isTextInput = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

    const handler = (e: KeyboardEvent) => {
      if (e.code === "KeyS" && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        saveCurrentFolder();
        return;
      }
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
        const next = getAdjacentVisibleIndex(state.currentIndex, -1);
        dispatch({ type: "SET_CURRENT", index: next });
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const next = getAdjacentVisibleIndex(state.currentIndex, 1);
        dispatch({ type: "SET_CURRENT", index: next });
      }
      if (e.code === "KeyG" && state.currentIndex !== null) {
        dispatch({ type: "SET_GOOD", index: state.currentIndex });
      }
      if (e.code === "KeyB" && state.currentIndex !== null) {
        dispatch({ type: "SET_BAD", index: state.currentIndex });
      }
      if (e.code === "KeyL") {
        dispatch({ type: "CYCLE_PLAY_MODE" });
      }
      if (e.code === "ArrowLeft" && state.currentIndex !== null) {
        e.preventDefault();
        e.stopPropagation();
        if (syncToggleRef.current) {
          const t = tracksRef.current[state.currentIndex];
          if (t.good) { /* good付きはそのまま */ }
          else if (t.bad) { dispatch({ type: "CLEAR_RATING", index: state.currentIndex }); }
          else { dispatch({ type: "SET_GOOD", index: state.currentIndex }); }
        } else {
          dispatch({ type: "SET_GOOD", index: state.currentIndex });
        }
      }
      if (e.code === "ArrowRight" && state.currentIndex !== null) {
        e.preventDefault();
        e.stopPropagation();
        if (syncToggleRef.current) {
          const t = tracksRef.current[state.currentIndex];
          if (t.bad) { /* bad付きはそのまま */ }
          else if (t.good) { dispatch({ type: "CLEAR_RATING", index: state.currentIndex }); }
          else { dispatch({ type: "SET_BAD", index: state.currentIndex }); }
        } else {
          dispatch({ type: "SET_BAD", index: state.currentIndex });
        }
      }
      if ((e.code === "Delete" || e.code === "Backspace" || e.code === "KeyH" || e.code === "KeyC") && state.currentIndex !== null) {
        dispatch({ type: "CLEAR_RATING", index: state.currentIndex });
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [getAdjacentVisibleIndex, state.isPlaying, state.currentIndex, saveCurrentFolder]);

  const handlePlayPause = () => dispatch({ type: "SET_PLAYING", playing: !state.isPlaying });
  const handlePrev = () => {
    dispatch({ type: "SET_CURRENT", index: getAdjacentVisibleIndex(state.currentIndex, -1) });
  };
  const handleNext = () => {
    dispatch({ type: "SET_CURRENT", index: getAdjacentVisibleIndex(state.currentIndex, 1) });
  };
  const handleSeek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const currentTrack = state.currentIndex !== null ? state.tracks[state.currentIndex] : null;
  const nowPlayingFolder = currentFolderRef.current && state.tracks.length > 0
    ? `${currentFolderRef.current.replace(/\\/g, "/").split("/").pop() ?? ""} (${state.tracks.length}項目)`
    : null;

  // 詳細パネル用のファイルサイズは選択時に取得する
  useEffect(() => {
    if (state.currentIndex === null) return;
    const index = state.currentIndex;
    const track = state.tracks[index];
    if (!track || track.size !== null) return;
    let cancelled = false;
    getFileSize(track.path)
      .then((size) => {
        if (!cancelled) dispatch({ type: "UPDATE_SIZE", index, size });
      })
      .catch((e) => console.error("getFileSize failed:", e));
    return () => { cancelled = true; };
  }, [state.currentIndex, state.tracks]);

  return (
    <div className="flex flex-col h-screen">
      <Dialog open={isLoading} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>読み込み中</DialogTitle>
            <DialogDescription>フォルダを読み込んでいます...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Dialog open={isMoving} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>移動中</DialogTitle>
            <DialogDescription>ファイルを移動しています...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Header
        isPlaying={state.isPlaying}
        playMode={state.playMode}
        currentTime={currentTime}
        duration={currentTrack?.duration ?? 0}
        nowPlayingName={currentTrack?.name ?? null}
        nowPlayingFolder={nowPlayingFolder}
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
        onToggleSidebar={() => setSidebarMode((m) => m === "icon" ? "open" : "icon")}
        onToggleDetailPanel={() => setShowDetailPanel((v) => !v)}
      />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          ref={sidebarRef}
          tracks={state.tracks}
          currentIndex={state.currentIndex}
          folderLibrary={folderLibrary}
          recentFolders={recentFolders}
          mode={sidebarMode}
          goodFolderName={goodFolderName}
          badFolderName={badFolderName}
          onModeChange={setSidebarMode}
          onLoadFolder={handleLoadFolder}
          onRemoveLibrary={handleRemoveLibrary}
          onSelect={(index) => dispatch({ type: "SET_CURRENT", index })}
          onMoveGood={() => handleMoveRated("good")}
          onMoveBad={() => handleMoveRated("bad")}
          onGoodFolderNameChange={handleGoodFolderNameChange}
          onBadFolderNameChange={handleBadFolderNameChange}
          syncToggle={syncToggle}
          onSyncToggleChange={handleSyncToggleChange}
        />
        <PlaylistTable
          tracks={state.tracks}
          currentIndex={state.currentIndex}
          searchQuery={state.searchQuery}
          ref={tableRef}
          onSelect={(index) => dispatch({ type: "SET_CURRENT", index })}
          onVisibleIndicesChange={handleVisibleIndicesChange}
        />
        <div
          className="shrink-0 overflow-hidden transition-all duration-200 border-l"
          style={{ width: showDetailPanel ? "16rem" : "0" }}
        >
          <DetailPanel
            track={currentTrack}
            onSetGood={() => state.currentIndex !== null && dispatch({ type: "SET_GOOD", index: state.currentIndex })}
            onSetBad={() => state.currentIndex !== null && dispatch({ type: "SET_BAD", index: state.currentIndex })}
          />
        </div>
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
