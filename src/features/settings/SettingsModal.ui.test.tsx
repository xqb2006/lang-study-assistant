import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AiProviderProfile } from "../ai/types";

vi.mock("../ai/AiProfileControls", () => ({
  AiProfileControls: () => <div>配置列表</div>,
}));
vi.mock("../ai/AiModelEditor", () => ({
  AiModelEditor: () => <div>模型编辑器</div>,
}));

import { SettingsModal } from "./SettingsModal";

afterEach(() => cleanup());

const profile: AiProviderProfile = {
  id: "profile-1",
  name: "主要服务",
  baseUrl: "https://api.example.com/v1",
  apiKey: "plain-key",
  chatModel: "",
  translationModel: "model-a",
  models: ["model-a"],
};

function renderModal() {
  const actions = {
    onClose: vi.fn(),
    onDiscardAiChanges: vi.fn(),
    onProfileChange: vi.fn(),
  };
  render(
    <SettingsModal
      activeProfileId="profile-1"
      aiProfiles={[profile]}
      aiProvider={profile}
      aiRequest={null}
      aiTestResult={null}
      discoveredModels={[]}
      modelDraft=""
      onActivateProfile={vi.fn()}
      onAddModel={vi.fn()}
      onChatModelChange={vi.fn()}
      onClose={actions.onClose}
      onCreateProfile={vi.fn()}
      onDefaultModelChange={vi.fn()}
      onDeleteProfile={vi.fn()}
      onDiscoverModels={vi.fn()}
      onDiscardAiChanges={actions.onDiscardAiChanges}
      onModelDraftChange={vi.fn()}
      onProfileChange={actions.onProfileChange}
      onSavedModelsChange={vi.fn()}
      onSaveAi={vi.fn()}
      onSelectProfile={vi.fn()}
      onTestAi={vi.fn()}
      savedModels={["model-a"]}
      settingsError=""
    />,
  );
  return actions;
}

describe("SettingsModal", () => {
  test("delegates AI profile changes to the settings workspace", async () => {
    const actions = renderModal();
    fireEvent.change(screen.getByDisplayValue(profile.name), { target: { value: "backup-service" } });

    expect(actions.onProfileChange).toHaveBeenCalledWith({ ...profile, name: "backup-service" });
  });

  test("区分右上角关闭和放弃当前 AI 草稿", async () => {
    const user = userEvent.setup();
    const actions = renderModal();
    await screen.findByText("配置列表");
    const closeButtons = screen.getAllByRole("button", { name: "关闭" });
    await user.click(closeButtons[1]);
    await user.click(closeButtons[0]);

    expect(actions.onDiscardAiChanges).toHaveBeenCalledOnce();
    expect(actions.onClose).toHaveBeenCalledOnce();
  });
});