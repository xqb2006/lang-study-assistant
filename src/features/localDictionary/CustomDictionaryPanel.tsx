import type { CustomDictionaryStatus, ResourceType } from "./types";
import { resourceT, type DisplayLanguage } from "../../i18n/ui";
import { resourceLanguageLabel, wordNetT } from "./wordNetUi";

const typeKeys: Record<ResourceType, "typeDictionary" | "typeWordlist" | "typeTerminology" | "typeExamples"> = { dictionary: "typeDictionary", wordlist: "typeWordlist", terminology: "typeTerminology", examples: "typeExamples" };

export function languageResourceLabel(language: string, displayLanguage: DisplayLanguage) {
  return resourceLanguageLabel(language, displayLanguage, resourceT(displayLanguage, "languageOther"));
}

export function CustomDictionaryPanel({ dictionaries, installing, onImport, onImportWordNet, onRename, onToggle, onDelete, displayLanguage }: {
  dictionaries: CustomDictionaryStatus[];
  installing: boolean;
  onImport: () => void;
  onImportWordNet: () => void;
  onRename: (dictionary: CustomDictionaryStatus) => void;
  onToggle: (dictionary: CustomDictionaryStatus) => void;
  onDelete: (dictionary: CustomDictionaryStatus) => void;
  displayLanguage: DisplayLanguage;
}) {
  const groups = dictionaries.reduce<Record<string, CustomDictionaryStatus[]>>((result, dictionary) => {
    (result[dictionary.language] ??= []).push(dictionary);
    return result;
  }, {});
  const groupedDictionaries = Object.entries(groups);
  const typeLabel = (value: string) => resourceT(displayLanguage, typeKeys[value as ResourceType] ?? "typeDictionary");
  const directionLabel = (dictionary: CustomDictionaryStatus) => `${languageResourceLabel(dictionary.language, displayLanguage)} → ${dictionary.definitionLanguage ? languageResourceLabel(dictionary.definitionLanguage, displayLanguage) : resourceT(displayLanguage, "definitionUnspecified")}`;

  return (
    <article className="dictionary-package custom-dictionary-package">
      <div>
        <b>{resourceT(displayLanguage, "myResources")}</b>
        <small>{resourceT(displayLanguage, "myResourcesHint")}</small>
      </div>
      <span>{dictionaries.length ? resourceT(displayLanguage, "resourceCount", { count: dictionaries.length }) : resourceT(displayLanguage, "notImported")}</span>
      <button className="secondary-button" type="button" disabled={installing} onClick={onImport}>{installing ? resourceT(displayLanguage, "analyzingImport") : resourceT(displayLanguage, "chooseFile")}</button><button className="text-button" type="button" disabled={installing} onClick={onImportWordNet}>{wordNetT(displayLanguage, "importDirectory")}</button>
      {groupedDictionaries.length > 0 && <div className="custom-dictionary-list">{groupedDictionaries.map(([lookupLanguage, entries]) => <section className="resource-language-group" key={lookupLanguage}><b>{languageResourceLabel(lookupLanguage, displayLanguage)}</b>{entries.map((dictionary) => <div className="custom-dictionary-item" key={dictionary.id}><span><strong>{dictionary.name}</strong><small>{directionLabel(dictionary)} · {typeLabel(dictionary.resourceType)} · {dictionary.entryCount.toLocaleString()} {resourceT(displayLanguage, "entrySuffix")}</small><small className={dictionary.enabled ? "resource-status enabled" : "resource-status"}>{dictionary.enabled ? resourceT(displayLanguage, "enabled") : resourceT(displayLanguage, "disabled")}</small></span><div><button className="text-button" type="button" onClick={() => onToggle(dictionary)}>{dictionary.enabled ? resourceT(displayLanguage, "disable") : resourceT(displayLanguage, "enable")}</button><button className="text-button" type="button" onClick={() => onRename(dictionary)}>{resourceT(displayLanguage, "rename")}</button><button className="text-button danger-text" type="button" onClick={() => onDelete(dictionary)}>{resourceT(displayLanguage, "delete")}</button></div></div>)}</section>)}</div>}
    </article>
  );
}
