import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldDescription, FieldGroup, FieldLegend, FieldSet, FieldTitle, FieldSeparator } from "@/components/ui/field";
import type { AppLanguage } from "@/lib/i18n";
import type { AppTheme } from "@/lib/theme";

type Section = "general" | "player" | "lyrics";

const SHORTCUTS = [
  { key: "settings.shortcutKeys.space", descKey: "settings.shortcutDescriptions.space" },
  { key: "↑ / ↓", descKey: "settings.shortcutDescriptions.upDown" },
  { key: "← / →", descKey: "settings.shortcutDescriptions.leftRight" },
  { key: "← / G", descKey: "settings.shortcutDescriptions.good" },
  { key: "→ / B", descKey: "settings.shortcutDescriptions.bad" },
  { key: "Del / Backspace / H / C", descKey: "settings.shortcutDescriptions.clear" },
  { key: "L", descKey: "settings.shortcutDescriptions.playMode" },
  { key: "Ctrl+F", descKey: "settings.shortcutDescriptions.search" },
  { key: "Ctrl+S", descKey: "settings.shortcutDescriptions.save" },
  { key: "Esc", descKey: "settings.shortcutDescriptions.escape" },
];

type Props = {
  goodFolderName: string;
  badFolderName: string;
  syncToggle: boolean;
  language: AppLanguage;
  theme: AppTheme;
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  onGoodFolderNameChange: (name: string) => void;
  onBadFolderNameChange: (name: string) => void;
  onSyncToggleChange: (v: boolean) => void;
  onLanguageChange: (language: AppLanguage) => void;
  onThemeChange: (theme: AppTheme) => void;
  onLlmBaseUrlChange: (baseUrl: string) => void;
  onLlmModelChange: (model: string) => void;
  onLlmApiKeyChange: (apiKey: string) => void;
  geniusApiKey: string;
  onGeniusApiKeyChange: (apiKey: string) => void;
};

export function SettingsView({ goodFolderName, badFolderName, syncToggle, language, theme, llmBaseUrl, llmModel, llmApiKey, onGoodFolderNameChange, onBadFolderNameChange, onSyncToggleChange, onLanguageChange, onThemeChange, onLlmBaseUrlChange, onLlmModelChange, onLlmApiKeyChange, geniusApiKey, onGeniusApiKeyChange }: Props) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("general");

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* セクションリスト（左） */}
      <div className="flex flex-col gap-0.5 p-2 w-28 shrink-0 border-r">
        {(["general", "player", "lyrics"] as Section[]).map((s) => (
          <Button
            key={s}
            variant={section === s ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start text-xs h-7"
            onClick={() => setSection(s)}
          >
            {t(`settings.sections.${s}`)}
          </Button>
        ))}
      </div>

      {/* コンテンツ（右） */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        {section === "general" && (
          <FieldGroup>
            <Field orientation="horizontal">
              <div className="flex-1">
                <FieldTitle>{t("settings.language")}</FieldTitle>
                <FieldDescription>{t("settings.languageDescription")}</FieldDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={language === "ja" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onLanguageChange("ja")}
                >
                  {t("settings.japanese")}
                </Button>
                <Button
                  variant={language === "en" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onLanguageChange("en")}
                >
                  {t("settings.english")}
                </Button>
              </div>
            </Field>
            <Field orientation="horizontal">
              <div className="flex-1">
                <FieldTitle>{t("settings.theme")}</FieldTitle>
                <FieldDescription>{t("settings.themeDescription")}</FieldDescription>
              </div>
              <div className="flex gap-1">
                {(["light", "dark", "system"] as AppTheme[]).map((value) => (
                  <Button
                    key={value}
                    variant={theme === value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => onThemeChange(value)}
                  >
                    {t(`settings.${value}`)}
                  </Button>
                ))}
              </div>
            </Field>
            <FieldSeparator></FieldSeparator>
            <FieldSet>
              <FieldLegend variant="label">{t("settings.llm")}</FieldLegend>
              <FieldDescription>{t("settings.llmDescription")}</FieldDescription>
              <Field>
                <FieldTitle>{t("settings.llmBaseUrl")}</FieldTitle>
                <FieldDescription>{t("settings.llmBaseUrlDescription")}</FieldDescription>
                <Input
                  className="h-7 text-xs"
                  value={llmBaseUrl}
                  placeholder="http://localhost:8888/v1"
                  onChange={(e) => onLlmBaseUrlChange(e.target.value)}
                />
              </Field>
              <Field>
                <FieldTitle>{t("settings.llmModel")}</FieldTitle>
                <FieldDescription>{t("settings.llmModelDescription")}</FieldDescription>
                <Input
                  className="h-7 text-xs"
                  value={llmModel}
                  onChange={(e) => onLlmModelChange(e.target.value)}
                />
              </Field>
              <Field>
                <FieldTitle>{t("settings.llmApiKey")}</FieldTitle>
                <Input
                  className="h-7 text-xs"
                  value={llmApiKey}
                  type="password"
                  onChange={(e) => onLlmApiKeyChange(e.target.value)}
                />
              </Field>
            </FieldSet>
          </FieldGroup>
        )}
        {section === "lyrics" && (
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">{t("settings.lyrics")}</FieldLegend>
              <FieldDescription>{t("settings.lyricsDescription")}</FieldDescription>
              <Field>
                <FieldTitle>{t("settings.geniusApiKey")}</FieldTitle>
                <Input
                  className="h-7 text-xs"
                  value={geniusApiKey}
                  type="password"
                  onChange={(e) => onGeniusApiKeyChange(e.target.value)}
                />
              </Field>
            </FieldSet>
          </FieldGroup>
        )}
        {section === "player" && (
          <FieldGroup>
            {/* 移動先フォルダ名 */}
            <FieldSet>
              <FieldLegend variant="label">{t("settings.destinationFolderName")}</FieldLegend>
              <Field orientation="horizontal">
                <FieldTitle className="w-10 shrink-0">Good</FieldTitle>
                <Input
                  className="h-7 text-xs"
                  value={goodFolderName}
                  onChange={(e) => onGoodFolderNameChange(e.target.value)}
                />
              </Field>
              <Field orientation="horizontal">
                <FieldTitle className="w-10 shrink-0">Bad</FieldTitle>
                <Input
                  className="h-7 text-xs"
                  value={badFolderName}
                  onChange={(e) => onBadFolderNameChange(e.target.value)}
                />
              </Field>
            </FieldSet>

            {/* 同期トグル */}
            <Field orientation="horizontal">
              <div className="flex-1">
                <FieldTitle>{t("settings.syncToggle")}</FieldTitle>
                <FieldDescription>{t("settings.syncToggleDescription")}</FieldDescription>
              </div>
              <Switch checked={syncToggle} onCheckedChange={onSyncToggleChange} />
            </Field>
            <FieldSeparator></FieldSeparator>
            {/* ショートカットキー */}
            <FieldSet>
              <FieldLegend variant="label">{t("settings.shortcuts")}</FieldLegend>
              {SHORTCUTS.map(({ key, descKey }) => (
                <Field key={key} orientation="horizontal">
                  <FieldTitle className="w-48 shrink-0 font-mono">{key.includes(".") ? t(key) : key}</FieldTitle>
                  <FieldDescription className="whitespace-pre-line">{t(descKey)}</FieldDescription>
                </Field>
              ))}
            </FieldSet>
          </FieldGroup>
        )}
      </div>
    </div>
  );
}
