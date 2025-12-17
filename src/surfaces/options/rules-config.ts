import type { TitleRule, UrlRule } from "../../options-schema.js";
import type { OptionsContext } from "./context.js";
import type {
  DragScope,
  RuleConfig,
  RuleFieldDescriptor,
  RuleFieldKeys,
  RuleMessages,
} from "./rules-types.js";
import { sanitizeTitleRule, sanitizeUrlRule } from "./state.js";

export interface BuiltRuleConfigs {
  title: RuleConfig<TitleRule>;
  url: RuleConfig<UrlRule>;
}

/**
 * Helper to get the appropriate rule config based on scope.
 * Eliminates the common `scope === "title" ? configs.title : configs.url` pattern.
 */
export function getConfigForScope(
  configs: BuiltRuleConfigs,
  scope: DragScope,
): RuleConfig<TitleRule> | RuleConfig<UrlRule> {
  return scope === "title" ? configs.title : configs.url;
}

export function buildRuleConfigs(context: OptionsContext): BuiltRuleConfigs {
  const { dom } = context;

  const titleConfig: RuleConfig<TitleRule> = {
    scope: "title",
    getRules: () => context.draft.titleRules,
    setRules: (next) => {
      context.draft.titleRules = next;
    },
    body: dom.titleRulesBody,
    clearButton: dom.clearTitleRulesButton,
    confirmClearButton: dom.confirmClearTitleRulesButton,
    clearStatusElement: dom.titleClearStatusElement,
    saveButton: dom.saveTitleRuleButton,
    unsavedIndicator: dom.titleUnsavedIndicator,
    fields: [
      { key: "urlPattern", placeholder: "URL pattern" },
      { key: "titleSearch", placeholder: "Title search" },
      { key: "titleReplace", placeholder: "Title replace", trimLeading: false },
      { key: "comment", placeholder: "Comment (optional)", trimLeading: false },
    ] satisfies RuleFieldDescriptor<TitleRule>[],
    fieldKeys: {
      pattern: "urlPattern",
      search: "titleSearch",
      replace: "titleReplace",
    } satisfies RuleFieldKeys<TitleRule>,
    createEmpty: () => ({
      urlPattern: "",
      titleSearch: "",
      titleReplace: "",
      comment: "",
      continueMatching: false,
      enabled: true,
    }),
    sanitize: sanitizeTitleRule,
    hasContent: (rule) => Boolean(rule.urlPattern || rule.titleSearch || rule.titleReplace),
    messages: {
      missingPattern: "URL pattern is required when defining a title rule.",
      invalidPattern: "One or more title rule URL patterns are invalid regex expressions.",
      missingSearchForReplace:
        "Provide a title search pattern before specifying a title replacement.",
      invalidSearch: "One or more title search patterns are invalid regex expressions.",
      cleared: "All title rules cleared.",
      removed: "Title rule removed.",
    } satisfies RuleMessages,
  };

  const urlConfig: RuleConfig<UrlRule> = {
    scope: "url",
    getRules: () => context.draft.urlRules,
    setRules: (next) => {
      context.draft.urlRules = next;
    },
    body: dom.urlRulesBody,
    clearButton: dom.clearUrlRulesButton,
    confirmClearButton: dom.confirmClearUrlRulesButton,
    clearStatusElement: dom.urlClearStatusElement,
    saveButton: dom.saveUrlRuleButton,
    unsavedIndicator: dom.urlUnsavedIndicator,
    fields: [
      { key: "urlPattern", placeholder: "URL pattern" },
      { key: "urlSearch", placeholder: "URL search" },
      { key: "urlReplace", placeholder: "URL replace", trimLeading: false },
      { key: "comment", placeholder: "Comment (optional)", trimLeading: false },
    ] satisfies RuleFieldDescriptor<UrlRule>[],
    fieldKeys: {
      pattern: "urlPattern",
      search: "urlSearch",
      replace: "urlReplace",
    } satisfies RuleFieldKeys<UrlRule>,
    createEmpty: () => ({
      urlPattern: "",
      urlSearch: "",
      urlReplace: "",
      comment: "",
      continueMatching: false,
      enabled: true,
    }),
    sanitize: sanitizeUrlRule,
    hasContent: (rule) => Boolean(rule.urlPattern || rule.urlSearch || rule.urlReplace),
    messages: {
      missingPattern: "URL pattern is required when defining a URL rule.",
      invalidPattern: "One or more URL rule URL patterns are invalid regex expressions.",
      missingSearchForReplace: "Provide a URL search pattern before specifying a URL replacement.",
      invalidSearch: "One or more URL search patterns are invalid regex expressions.",
      cleared: "All URL rules cleared.",
      removed: "URL rule removed.",
    } satisfies RuleMessages,
  };

  return { title: titleConfig, url: urlConfig };
}
