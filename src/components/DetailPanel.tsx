import { useState, useEffect } from "react";
import { Track } from "@/types";
import { formatSize, formatDuration } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { LyricsSearchButton } from "@/components/LyricsSearchButton";
import { ThumbsUp, ThumbsDown, Pencil, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  track: Track | null;
  currentIndex: number | null;
  onSetGood: () => void;
  onSetBad: () => void;
  onEditSongInfo: () => void;
  onTranscriptChange: (index: number, transcript: string) => void;
  onLyricsChange: (index: number, lyrics: string) => void;
  onLyricsSearch: (title: string, artist: string) => void;
  onUseGeniusChange: (v: boolean) => void;
  onUseLrclibChange: (v: boolean) => void;
  onUseYtmusicChange: (v: boolean) => void;
  onGenerateTranscript: () => void;
  onRestoreTranscript: () => void;
  onRestoreLyrics: () => void;
  canGenerateTranscript: boolean;
  canRestoreTranscript: boolean;
  canRestoreLyrics: boolean;
  lyricsSearchDisabled: boolean;
  geniusDisabled: boolean;
  useGenius: boolean;
  useLrclib: boolean;
  useYtmusic: boolean;
  isGeneratingTranscript: boolean;
};

export function DetailPanel({ track, currentIndex, onSetGood, onSetBad, onEditSongInfo, onTranscriptChange, onLyricsChange, onLyricsSearch, onUseGeniusChange, onUseLrclibChange, onUseYtmusicChange, onGenerateTranscript, onRestoreTranscript, onRestoreLyrics, canGenerateTranscript, canRestoreTranscript, canRestoreLyrics, lyricsSearchDisabled, geniusDisabled, useGenius, useLrclib, useYtmusic, isGeneratingTranscript }: Props) {
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState(track?.transcript ?? "");
  const [lyrics, setLyrics] = useState(track?.lyrics ?? "");

  // トラックが切り替わったら textarea をリセット
  useEffect(() => {
    setTranscript(track?.transcript ?? "");
    setLyrics(track?.lyrics ?? "");
  }, [currentIndex, track?.transcript, track?.lyrics]);

  if (!track) {
    return (
      <div className="w-full min-w-0 p-4 text-sm text-muted-foreground">
        {t("details.selectFile")}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 p-4 text-sm space-y-3">
      <div className="flex gap-2">
        <Button
          variant={track.good ? "default" : "ghost"}
          size="icon"
          onClick={onSetGood}
          title={t("common.good")}
        >
          <ThumbsUp className="w-4 h-4" />
        </Button>
        <Button
          variant={track.bad ? "default" : "ghost"}
          size="icon"
          onClick={onSetBad}
          title={t("common.bad")}
        >
          <ThumbsDown className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEditSongInfo}
          title={t("tabs.songInfo")}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      </div>
      <div>
        <p className="break-all">{track.name}</p>
      </div>
      <div className="flex items-baseline gap-1 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">{t("details.size")}:</span>
        <span className="truncate">{track.size === null ? t("details.loading") : formatSize(track.size)}</span>
      </div>
      <div className="flex items-baseline gap-1 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">{t("details.duration")}:</span>
        <span className="truncate">{formatDuration(track.duration)}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
          <p className="text-xs text-muted-foreground shrink-0">{t("details.transcript")}</p>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-xs min-w-0"
              disabled={!canGenerateTranscript || isGeneratingTranscript}
              onClick={onGenerateTranscript}
            >
              {isGeneratingTranscript ? t("details.generating") : t("details.transcribeWithAi")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={!canRestoreTranscript || isGeneratingTranscript}
              onClick={onRestoreTranscript}
              title={t("details.restoreTranscript")}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <textarea
          value={transcript}
          rows={6}
          onChange={(e) => {
            setTranscript(e.target.value);
            if (currentIndex !== null) onTranscriptChange(currentIndex, e.target.value);
          }}
          className="block w-full min-w-0 resize-none rounded-xs border bg-transparent p-2 text-sm font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          spellCheck={false}
        />
      </div>
      {(track.lyrics || track.syncedLyrics || track.ttml) && (
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
            <p className="text-xs text-muted-foreground shrink-0">{t("details.lyrics")}</p>
            <div className="flex items-center gap-1">
              <LyricsSearchButton
                size="sm"
                disabled={lyricsSearchDisabled}
                geniusDisabled={geniusDisabled}
                useGenius={useGenius}
                useLrclib={useLrclib}
                useYtmusic={useYtmusic}
                defaultTitle={track.title || track.name.replace(/\.[^.]+$/, "")}
                defaultArtist={track.artist}
                onSearch={onLyricsSearch}
                onUseGeniusChange={onUseGeniusChange}
                onUseLrclibChange={onUseLrclibChange}
                onUseYtmusicChange={onUseYtmusicChange}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={!canRestoreLyrics}
                onClick={onRestoreLyrics}
                title={t("details.restoreTranscript")}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <textarea
            value={lyrics}
            rows={6}
            onChange={(e) => {
              setLyrics(e.target.value);
              if (currentIndex !== null) onLyricsChange(currentIndex, e.target.value);
            }}
            className="block w-full min-w-0 resize-none rounded-xs border bg-transparent p-2 text-sm font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            spellCheck={false}
          />
          {track.syncedLyrics && <p className="w-full max-w-full whitespace-pre-wrap break-all">{track.syncedLyrics}</p>}
          {track.ttml && <p className="w-full max-w-full whitespace-pre-wrap break-all">{track.ttml}</p>}
        </div>
      )}
    </div>
  );
}
