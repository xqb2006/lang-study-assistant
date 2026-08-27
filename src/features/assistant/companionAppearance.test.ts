import { beforeEach, describe, expect, test } from "vitest";
import { frameStyle, loadAssistantSettings, loadAssistantStore, saveAssistantStore, type CompanionSprite } from "./companionAppearance";

beforeEach(() => window.localStorage.clear());

describe("companionAppearance", () => {
  test("兼容旧版 Emoji 桌宠配置，并使用无精灵图回退", () => {
    window.localStorage.setItem("reading-assistant-helper-settings", JSON.stringify({
      avatar: "🦉",
      name: "语法猫头鹰",
      theme: "night",
      personality: "coach",
    }));

    expect(loadAssistantSettings()).toMatchObject({
      avatar: "🦉",
      name: "语法猫头鹰",
      sprite: null,
    });
  });

  test("preserves multiple assistant profiles and the active profile", () => {
    const initial = loadAssistantStore();
    const custom = { ...initial.profiles[0], id: "custom", name: "我的助手", personaPrompt: "请使用简洁语气。" };
    saveAssistantStore({ profiles: [initial.profiles[0], custom], activeProfileId: custom.id });

    const loaded = loadAssistantStore();
    expect(loaded.activeProfileId).toBe("custom");
    expect(loaded.profiles).toHaveLength(2);
    expect(loaded.profiles.find((profile) => profile.id === "custom")).toMatchObject({
      name: "我的助手",
      personaPrompt: "请使用简洁语气。",
    });
  });

  test("将精灵图的状态映射为正确的背景坐标", () => {
    const sprite: CompanionSprite = {
      filePath: "C:\\appearance\\cat.png",
      fileName: "cat.png",
      columns: 3,
      rows: 2,
      frames: { idle: 0, happy: 1, thinking: 2, sleepy: 3, talking: 4, drag: 5 },
    };

    expect(frameStyle(sprite, "blob:cat", "talking")).toEqual(expect.objectContaining({
      backgroundPosition: "50% 100%",
      backgroundSize: "300% 200%",
    }));
  });
  test("clamps and preserves the saved companion size", () => {
    const initial = loadAssistantStore();
    saveAssistantStore({ profiles: [{ ...initial.profiles[0], size: 180 }], activeProfileId: initial.profiles[0].id });
    expect(loadAssistantSettings().size).toBe(180);

    saveAssistantStore({ profiles: [{ ...initial.profiles[0], size: 999 }], activeProfileId: initial.profiles[0].id });
    expect(loadAssistantSettings().size).toBe(220);
  });

});