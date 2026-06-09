import { useReducer, useRef, useEffect, useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { convertFileSrc } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { AppSettings } from "../lib/settings";
import type { AppLanguage } from "../lib/i18n";
import type { AppTheme } from "../lib/theme";
import { reducer, initialState } from "../reducer";
import { PlayMode } from "../types";
import { scanFolder, saveMtdt, moveRatedFiles, getFileSize } from "../lib/audio";
import { Play, Settings } from "lucide-react";
import { Header } from "../components/Header";
import { PlayerSidebar } from "../components/PlayerSidebar";
import { PlaylistTable } from "../components/PlaylistTable";
import { DetailPanel } from "../components/DetailPanel";
import { SettingsView } from "./SettingsView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import "../App.css";

const appWindow = getCurrentWebviewWindow();
const SIDEBAR_MIN_WIDTH = 160;
const SIDEBAR_MAX_WIDTH = 480;
type ContentTab = "player" | "settings";

export function PlayerView() {
  const { t, i18n } = useTranslation();
  const { setTheme: setAppTheme } = useTheme();
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
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>("player");
  const [language, setLanguage] = useState<AppLanguage>("ja");
  const [theme, setTheme] = useState<AppTheme>("system");
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFolderRef = useRef<string | null>(null);
  const tracksRef = useRef(state.tracks);
  const visibleTrackIndicesRef = useRef<number[]>([]);
  const syncToggleRef = useRef(syncToggle);
  const sidebarModeRef = useRef(sidebarMode);
  const sidebarWidthRef = useRef(sidebarWidth);
  tracksRef.current = state.tracks;
  syncToggleRef.current = syncToggle;
  sidebarModeRef.current = sidebarMode;
  sidebarWidthRef.current = sidebarWidth;

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

  const handleSidebarResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (sidebarMode !== "open") return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = startWidth + event.clientX - startX;
      setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, nextWidth)));
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [sidebarMode, sidebarWidth]);

  // 起動時に設定を復帰
  useEffect(() => {
    AppSettings.load().then(async (settings) => {
      const { playerView } = settings;
      const v = await playerView.getVolume();
      setVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
      setFolderLibrary(await playerView.getFolderLibrary());
      setRecentFolders(await playerView.getRecentFolders());
      setGoodFolderName(await playerView.getGoodFolderName());
      setBadFolderName(await playerView.getBadFolderName());
      const loadedLanguage = await settings.getLanguage();
      setLanguage(loadedLanguage);
      await i18n.changeLanguage(loadedLanguage);
      const loadedTheme = await settings.getTheme();
      setTheme(loadedTheme);
      setAppTheme(loadedTheme);
      setSyncToggle(await playerView.getSyncToggle());
      const savedSidebarWidth = await playerView.getSidebarWidth();
      if (savedSidebarWidth > 0) {
        setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, savedSidebarWidth)));
        setSidebarMode("open");
      } else {
        setSidebarMode("icon");
      }
      const savedPlayMode = await playerView.getPlayMode();
      dispatch({ type: "SET_PLAY_MODE", mode: savedPlayMode as PlayMode });
      settingsLoadedRef.current = true;
    });
  }, [i18n, setAppTheme]);

  // ボリューム変更を audio に反映し store に保存
  const handleVolumeChange = useCallback(async (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    const settings = await AppSettings.load();
    await settings.playerView.setVolume(v);
  }, []);

  // 現在のフォルダを mtdt.json に保存
  const saveCurrentFolder = useCallback(async () => {
    if (currentFolderRef.current && tracksRef.current.length > 0) {
      await saveMtdt(currentFolderRef.current, tracksRef.current).catch((e) =>
        console.error("saveMtdt failed:", e)
      );
      return true;
    }
    return false;
  }, []);

  // good/bad フォルダ名の変更を保存
  const handleGoodFolderNameChange = useCallback(async (name: string) => {
    setGoodFolderName(name);
    const settings = await AppSettings.load();
    await settings.playerView.setGoodFolderName(name);
  }, []);

  const handleBadFolderNameChange = useCallback(async (name: string) => {
    setBadFolderName(name);
    const settings = await AppSettings.load();
    await settings.playerView.setBadFolderName(name);
  }, []);

  const handleSyncToggleChange = useCallback(async (v: boolean) => {
    setSyncToggle(v);
    const settings = await AppSettings.load();
    await settings.playerView.setSyncToggle(v);
  }, []);

  const handleLanguageChange = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    await i18n.changeLanguage(nextLanguage);
    const settings = await AppSettings.load();
    await settings.setLanguage(nextLanguage);
  }, [i18n]);

  const handleThemeChange = useCallback(async (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    setAppTheme(nextTheme);
    const settings = await AppSettings.load();
    await settings.setTheme(nextTheme);
  }, [setAppTheme]);

  // playMode 変化時に設定保存（設定ロード完了後のみ）
  const settingsLoadedRef = useRef(false);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AppSettings.load().then((s) => s.playerView.setPlayMode(state.playMode));
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
        alert(t("player.conflictMessage", { files: result.conflicts.join("\n") }));
        return;
      }
      if (result.reloadedTracks) {
        dispatch({ type: "SET_TRACKS", tracks: result.reloadedTracks });
      }
    } finally {
      setIsMoving(false);
    }
  }, [goodFolderName, badFolderName, t]);

  // ウィンドウを閉じる前に保存
  useEffect(() => {
    const promise = appWindow.onCloseRequested(async () => {
      await saveCurrentFolder();
      const settings = await AppSettings.load();
      await settings.playerView.setSidebarWidth(
        sidebarModeRef.current === "open" ? sidebarWidthRef.current : 0
      );
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
    const updated = await settings.playerView.pushRecentFolder(folder);
    setRecentFolders(updated);
  }, [saveCurrentFolder]);

  // ライブラリにフォルダを追加（重複排除・名前順）
  const handleAddToLibrary = useCallback(async (folder: string) => {
    setFolderLibrary((prev) => {
      if (prev.includes(folder)) return prev;
      const updated = [...prev, folder].sort((a, b) =>
        a.replace(/\\/g, "/").split("/").pop()!.localeCompare(b.replace(/\\/g, "/").split("/").pop()!)
      );
      AppSettings.load().then((s) => s.playerView.setFolderLibrary(updated));
      return updated;
    });
  }, []);

  // ライブラリからフォルダを削除
  const handleRemoveLibrary = useCallback(async (folder: string) => {
    setFolderLibrary((prev) => {
      const updated = prev.filter((f) => f !== folder);
      AppSettings.load().then((s) => s.playerView.setFolderLibrary(updated));
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
        const updated = await settings.playerView.pushRecentFolder(p);
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

  // キーボード操作（capture: true で各タブのショートカットを切り替える）
  useEffect(() => {
    const isTextInput = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

    const handlePlayerKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyS" && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        saveCurrentFolder().then((saved) => {
          if (saved) toast.success(t("player.saveComplete"));
        });
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

    const handleSettingsKeyDown = (_e: KeyboardEvent) => {
      // 設定タブ固有のショートカットは必要になった時点でここに追加する。
    };

    const handler = (e: KeyboardEvent) => {
      switch (activeContentTab) {
        case "player":
          handlePlayerKeyDown(e);
          break;
        case "settings":
          handleSettingsKeyDown(e);
          break;
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [activeContentTab, getAdjacentVisibleIndex, state.isPlaying, state.currentIndex, saveCurrentFolder, t]);

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
    ? `${currentFolderRef.current.replace(/\\/g, "/").split("/").pop() ?? ""} (${t("player.itemCount", { count: state.tracks.length })})`
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
    <>
      <Dialog open={isLoading} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("common.loading")}</DialogTitle>
            <DialogDescription>{t("player.loadingFolder")}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Dialog open={isMoving} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("common.moving")}</DialogTitle>
            <DialogDescription>{t("player.movingFiles")}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />
      <Tabs value={activeContentTab} onValueChange={(value) => setActiveContentTab(value as ContentTab)} className="flex flex-col h-screen">
        <TabsList className="shrink-0 rounded-none border-b px-2 w-full justify-start h-8">
          <TabsTrigger value="player" className="flex-none"><Play />{t("tabs.player")}</TabsTrigger>
          <TabsTrigger value="settings" className="flex-none"><Settings />{t("tabs.settings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="player" keepMounted className="flex flex-col flex-1 overflow-hidden mt-0">
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
            <PlayerSidebar
              ref={sidebarRef}
              tracks={state.tracks}
              currentIndex={state.currentIndex}
              folderLibrary={folderLibrary}
              recentFolders={recentFolders}
              mode={sidebarMode}
              openWidth={sidebarWidth}
              goodFolderName={goodFolderName}
              badFolderName={badFolderName}
              onModeChange={setSidebarMode}
              onLoadFolder={handleLoadFolder}
              onRemoveLibrary={handleRemoveLibrary}
              onSelect={(index) => dispatch({ type: "SET_CURRENT", index })}
              onMoveGood={() => handleMoveRated("good")}
              onMoveBad={() => handleMoveRated("bad")}
            />
            {sidebarMode === "open" && (
              <div
                className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-border"
                onPointerDown={handleSidebarResizeStart}
                role="separator"
                aria-orientation="vertical"
                aria-label={t("player.sidebarWidth")}
              />
            )}
            <div className="w-px shrink-0 bg-border" />
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
        </TabsContent>
        <TabsContent value="settings" keepMounted className="flex flex-1 overflow-hidden mt-0">
          <SettingsView
            goodFolderName={goodFolderName}
            badFolderName={badFolderName}
            syncToggle={syncToggle}
            language={language}
            theme={theme}
            onGoodFolderNameChange={handleGoodFolderNameChange}
            onBadFolderNameChange={handleBadFolderNameChange}
            onSyncToggleChange={handleSyncToggleChange}
            onLanguageChange={handleLanguageChange}
            onThemeChange={handleThemeChange}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
