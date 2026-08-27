import { settingsT, type DisplayLanguage } from "../../i18n/ui";
import type { AiProviderProfile } from "./types";

export function AiProfileControls({
  profiles,
  selectedProfileId,
  activeProfileId,
  onSelect,
  onCreate,
  onActivate,
  onDelete,
  displayLanguage = "zh-CN",
}: {
  profiles: AiProviderProfile[];
  selectedProfileId: string;
  activeProfileId: string;
  onSelect: (profileId: string) => void;
  onCreate: () => void;
  onActivate: () => void;
  onDelete: () => void;
  displayLanguage?: DisplayLanguage;
}) {
  return (
    <div className="provider-profile-controls">
      <div className="provider-profile-list" aria-label={settingsT(displayLanguage, "savedProfiles")}>
        {profiles.map((profile) => (
          <button className={profile.id === selectedProfileId ? "active" : undefined} type="button" onClick={() => onSelect(profile.id)} key={profile.id}>
            <span>{profile.name}</span>
            <small>{profile.id === activeProfileId ? settingsT(displayLanguage, "active") : settingsT(displayLanguage, "modelCount", { count: profile.models.length })}</small>
          </button>
        ))}
      </div>
      <div className="model-row">
        <button className="secondary-button" type="button" onClick={onCreate}>{settingsT(displayLanguage, "newProfile")}</button>
        <button className="secondary-button" type="button" onClick={onActivate} disabled={!selectedProfileId || selectedProfileId === activeProfileId}>{settingsT(displayLanguage, "setActive")}</button>
        <button className="secondary-button danger-button" type="button" onClick={onDelete} disabled={profiles.length === 0}>{settingsT(displayLanguage, "deleteCurrent")}</button>
      </div>
    </div>
  );
}
