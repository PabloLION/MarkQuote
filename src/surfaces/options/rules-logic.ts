import type { RuleConfig, RuleWithFlags } from "./rules-types.js";
import { validateRegex } from "./state.js";

export function filteredRulesInternal<TRule extends RuleWithFlags>(
  config: RuleConfig<TRule>,
): TRule[] {
  const rules = config.getRules();
  const normalized: TRule[] = [];

  rules.forEach((rule, index) => {
    const sanitized = config.sanitize(rule);
    rules[index] = sanitized as TRule;
    if (config.hasContent(sanitized)) {
      normalized.push(sanitized);
    }
  });

  return normalized;
}

export function handleRuleInputChangeFor<TRule extends RuleWithFlags>(
  config: RuleConfig<TRule>,
  target: HTMLInputElement,
): void {
  const index = Number.parseInt(target.dataset.index ?? "", 10);
  const field = target.dataset.field;

  if (!field || Number.isNaN(index)) {
    return;
  }

  const rules = config.getRules();
  const rule = rules[index];

  if (!rule) {
    return;
  }

  const fieldKey = field as keyof TRule;

  if (typeof rule[fieldKey] === "boolean") {
    (rule[fieldKey] as unknown as boolean) = target.checked;
  } else {
    (rule[fieldKey] as unknown as string) = target.value;
  }
}

export function readRuleField<TRule>(rule: TRule, key: string): string {
  const value = (rule as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateRulesFor<TRule extends RuleWithFlags>(
  config: RuleConfig<TRule>,
): ValidationResult {
  const sanitizedRules = filteredRulesInternal(config);
  let valid = true;
  let message: string | undefined;

  config.body.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute("aria-invalid");
  });

  sanitizedRules.forEach((sanitized, index) => {
    const row = config.body.querySelector<HTMLTableRowElement>(`tr[data-index="${index}"]`);
    if (!row) {
      return;
    }

    const { pattern, search, replace } = config.fieldKeys;
    const patternInput = row.querySelector<HTMLInputElement>(`input[data-field="${pattern}"]`);
    const searchInput = row.querySelector<HTMLInputElement>(`input[data-field="${search}"]`);
    const replaceInput = row.querySelector<HTMLInputElement>(`input[data-field="${replace}"]`);

    const patternValue = readRuleField(sanitized, pattern);
    const searchValue = readRuleField(sanitized, search);
    const replaceValue = readRuleField(sanitized, replace);

    if (!patternValue) {
      valid = false;
      message = message ?? config.messages.missingPattern;
      patternInput?.setAttribute("aria-invalid", "true");
    } else if (!validateRegex(patternValue)) {
      valid = false;
      message = message ?? config.messages.invalidPattern;
      patternInput?.setAttribute("aria-invalid", "true");
    }

    if (replaceValue && !searchValue) {
      valid = false;
      message = message ?? config.messages.missingSearchForReplace;
      searchInput?.setAttribute("aria-invalid", "true");
    }

    if (searchValue && !validateRegex(searchValue)) {
      valid = false;
      message = message ?? config.messages.invalidSearch;
      searchInput?.setAttribute("aria-invalid", "true");
    }

    replaceInput?.removeAttribute("aria-invalid");
  });

  return { valid, message };
}

export function moveRule<TRule>(rules: TRule[], fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) {
    return;
  }

  const [rule] = rules.splice(fromIndex, 1);
  rules.splice(toIndex, 0, rule);
}
