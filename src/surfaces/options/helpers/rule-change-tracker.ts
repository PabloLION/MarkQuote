import type { TitleRule, UrlRule } from "../../../options-schema.js";
import { getConfigForScope } from "../rules-config.js";
import type { DragScope, RuleConfig, RuleWithFlags } from "../rules-types.js";

type RuleConfigMap = {
  title: RuleConfig<TitleRule>;
  url: RuleConfig<UrlRule>;
};

type DirtyFlags = Record<DragScope, boolean>;
type SavingFlags = Record<DragScope, boolean>;

export interface RuleChangeTracker {
  markDirty(scope: DragScope): void;
  setDirty(scope: DragScope, dirty: boolean): void;
  setSaving(scope: DragScope | undefined, saving: boolean): void;
  rememberSaveButtonLabels(): void;
  isDirty(scope: DragScope): boolean;
  isSaving(scope: DragScope): boolean;
}

function ensureButtonLabel<TRule extends RuleWithFlags>(config: RuleConfig<TRule>): void {
  if (!config.saveButton.dataset.label) {
    /* v8 ignore next - test DOM always has textContent; fallback handles stripped HTML in production */
    config.saveButton.dataset.label = config.saveButton.textContent ?? "Save changes";
  }
}

function restoreButtonLabel(config: RuleConfig<TitleRule> | RuleConfig<UrlRule>): void {
  /* v8 ignore next - ensureButtonLabel always sets dataset.label before this; fallback handles race conditions */
  const label = config.saveButton.dataset.label ?? "Save changes";
  config.saveButton.textContent = label;
}

function applySavingState(
  config: RuleConfig<TitleRule> | RuleConfig<UrlRule>,
  scope: DragScope,
  saving: boolean,
  dirtyState: DirtyFlags,
  savingState: SavingFlags,
): void {
  savingState[scope] = saving;

  if (saving) {
    config.saveButton.dataset.loading = "true";
    config.saveButton.disabled = true;
    config.saveButton.textContent = "Saving…";
    return;
  }

  delete config.saveButton.dataset.loading;
  restoreButtonLabel(config);
  config.saveButton.disabled = !dirtyState[scope];
}

export function createRuleChangeTracker(configs: RuleConfigMap): RuleChangeTracker {
  const dirtyState: DirtyFlags = { title: false, url: false };
  const savingState: SavingFlags = { title: false, url: false };

  function setDirty(scope: DragScope, dirty: boolean): void {
    dirtyState[scope] = dirty;
    const config = getConfigForScope(configs, scope);

    config.unsavedIndicator.hidden = !dirty;
    if (!savingState[scope]) {
      config.saveButton.disabled = !dirty;
    }
  }

  function markDirty(scope: DragScope): void {
    if (!dirtyState[scope]) {
      setDirty(scope, true);
    }
  }

  function setSaving(scope: DragScope | undefined, saving: boolean): void {
    if (!scope) {
      setSaving("title", saving);
      setSaving("url", saving);
      return;
    }

    applySavingState(getConfigForScope(configs, scope), scope, saving, dirtyState, savingState);
  }

  function rememberSaveButtonLabels(): void {
    ensureButtonLabel(configs.title);
    ensureButtonLabel(configs.url);
  }

  function isDirty(scope: DragScope): boolean {
    return dirtyState[scope];
  }

  function isSaving(scope: DragScope): boolean {
    return savingState[scope];
  }

  return {
    markDirty,
    setDirty,
    setSaving,
    rememberSaveButtonLabels,
    isDirty,
    isSaving,
  };
}
