import type { TitleRule, UrlRule } from "../../options-schema.js";

export type DragScope = "title" | "url";

export type StringFieldKey<TRule> = {
  [TKey in keyof TRule]: TRule[TKey] extends string ? TKey : never;
}[keyof TRule];

export interface RuleFieldDescriptor<TRule> {
  key: StringFieldKey<TRule> & string;
  placeholder: string;
  trimLeading?: boolean;
}

export interface RuleFieldKeys<TRule> {
  pattern: StringFieldKey<TRule> & string;
  search: StringFieldKey<TRule> & string;
  replace: StringFieldKey<TRule> & string;
}

export interface RuleMessages {
  missingPattern: string;
  invalidPattern: string;
  missingSearchForReplace: string;
  invalidSearch: string;
  cleared: string;
  removed: string;
}

export type RuleWithFlags = { continueMatching: boolean; enabled: boolean };

export interface RuleConfig<TRule extends RuleWithFlags> {
  scope: DragScope;
  getRules: () => TRule[];
  setRules: (next: TRule[]) => void;
  body: HTMLTableSectionElement;
  clearButton: HTMLButtonElement;
  confirmClearButton: HTMLButtonElement;
  clearStatusElement: HTMLElement;
  saveButton: HTMLButtonElement;
  unsavedIndicator: HTMLElement;
  fields: RuleFieldDescriptor<TRule>[];
  fieldKeys: RuleFieldKeys<TRule>;
  createEmpty: () => TRule;
  sanitize: (rule: TRule) => TRule;
  hasContent: (rule: TRule) => boolean;
  messages: RuleMessages;
}

export type TitleRuleConfig = RuleConfig<TitleRule>;
export type UrlRuleConfig = RuleConfig<UrlRule>;
