import { useCallback, useEffect, useState } from "react";
import { appInvoke } from "../../services/appInvoke";
import type { ContentLanguage } from "../languages";
import type { DisplayLanguage } from "../../i18n/ui";

type ProjectPreferences = { defaultLearningLanguage: ContentLanguage; displayLanguage: DisplayLanguage };

export function useProjectPreferences(setNotice: (message: string) => void) {
  const [defaultLearningLanguage, setDefaultLearningLanguage] = useState<ContentLanguage>("en");
  const [displayLanguage, setDisplayLanguage] = useState<DisplayLanguage>("zh-CN");

  useEffect(() => {
    void appInvoke<ProjectPreferences>("get_project_preferences")
      .then((preferences) => {
        setDefaultLearningLanguage(preferences.defaultLearningLanguage);
        setDisplayLanguage(preferences.displayLanguage);
      })
      .catch(() => undefined);
  }, []);

  const saveDefaultLearningLanguage = useCallback(async (language: ContentLanguage) => {
    try {
      const preferences = await appInvoke<ProjectPreferences>("save_project_preferences", {
        input: { defaultLearningLanguage: language, displayLanguage },
      });
      setDefaultLearningLanguage(preferences.defaultLearningLanguage);
      setNotice("已保存项目默认学习语言；之后新建书籍会自动使用它");
    } catch (error) {
      setNotice(`保存项目默认学习语言失败：${String(error)}`);
    }
  }, [setNotice]);

  const saveDisplayLanguage = useCallback(async (language: DisplayLanguage) => {
    try {
      const preferences = await appInvoke<ProjectPreferences>("save_project_preferences", {
        input: { defaultLearningLanguage, displayLanguage: language },
      });
      setDisplayLanguage(preferences.displayLanguage);
      setNotice("界面显示语言已保存");
    } catch (error) {
      setNotice(`保存界面显示语言失败：${String(error)}`);
    }
  }, [defaultLearningLanguage, setNotice]);

  return { defaultLearningLanguage, displayLanguage, saveDefaultLearningLanguage, saveDisplayLanguage };
}
