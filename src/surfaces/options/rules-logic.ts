import { markInvalidField } from "./dom.js";
import type { RuleConfig, RuleFieldDescriptor, RuleWithFlags } from "./rules-types.js";
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
): boolean {
  const index = Number.parseInt(target.dataset.index ?? "", 10);
  const field = target.dataset.field;

  if (!field || Number.isNaN(index)) {
    return false;
  }

  const rules = config.getRules();
  if (index < 0 || index >= rules.length) {
    return false;
  }
  const rule = rules[index];

  if (!rule) {
    return false;
  }

  const fieldKey = field as keyof TRule;
  let changed = false;

  if (field === "continueMatching") {
    const nextValue = !target.checked;
    if (rule[fieldKey] !== nextValue) {
      (rule[fieldKey] as unknown as boolean) = nextValue;
      changed = true;
    }
  } else if (field === "enabled") {
    const nextValue = target.checked;
    const previous = rule[fieldKey] !== false;
    if (previous !== nextValue) {
      (rule[fieldKey] as unknown as boolean) = nextValue;
      target.closest<HTMLTableRowElement>("tr")?.classList.toggle("rule-disabled", !nextValue);
      changed = true;
    }
  } else {
    const descriptor = findFieldDescriptor(config.fields, field);
    if (!descriptor) {
      return false;
    }

    const preserveLeadingWhitespace = descriptor.trimLeading === false;
    const nextValue = preserveLeadingWhitespace ? target.value : target.value.trimStart();
    const previousValue = readRuleField(rule, field);

    if (previousValue !== nextValue) {
      setRuleField(rule, field, nextValue);
      target.value = nextValue;
      changed = true;
    }
  }

  target.removeAttribute("aria-invalid");
  return changed;
}

export function readRuleField<TRule>(rule: TRule, key: string): string {
  const value = (rule as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function setRuleField<TRule>(rule: TRule, key: string, value: string): void {
  (rule as Record<string, unknown>)[key] = value;
}

function findFieldDescriptor<TRule extends RuleWithFlags>(
  fields: RuleFieldDescriptor<TRule>[],
  key: string,
): RuleFieldDescriptor<TRule> | undefined {
  return fields.find((descriptor) => descriptor.key === key);
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateRulesFor<TRule extends RuleWithFlags>(
  config: RuleConfig<TRule>,
): ValidationResult {
  filteredRulesInternal(config);
  const rules = config.getRules();
  let valid = true;
  let message: string | undefined;

  config.body.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute("aria-invalid");
  });

  rules.forEach((sanitized, index) => {
    if (!config.hasContent(sanitized)) {
      return;
    }

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
      if (patternInput) {
        markInvalidField(patternInput);
      }
    } else if (!validateRegex(patternValue)) {
      valid = false;
      message = message ?? config.messages.invalidPattern;
      if (patternInput) {
        markInvalidField(patternInput);
      }
    }

    if (replaceValue && !searchValue) {
      valid = false;
      message = message ?? config.messages.missingSearchForReplace;
      if (searchInput) {
        markInvalidField(searchInput);
      }
    }

    if (searchValue && !validateRegex(searchValue)) {
      valid = false;
      message = message ?? config.messages.invalidSearch;
      if (searchInput) {
        markInvalidField(searchInput);
      }
    }

    replaceInput?.removeAttribute("aria-invalid");
  });

  return { valid, message };
}

export function moveRule<TRule>(rules: TRule[], fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) {
    return;
  }

  if (fromIndex < 0 || toIndex < 0 || fromIndex >= rules.length || toIndex >= rules.length) {
    return;
  }

  const [rule] = rules.splice(fromIndex, 1);
  let insertIndex = toIndex;
  if (fromIndex < toIndex) {
    // When moving an item forward in the list we already removed one element, so clamp the
    // insertion point to the new array length to avoid leaving a sparse gap at the end.
    insertIndex = Math.min(insertIndex, rules.length);
  }
  rules.splice(insertIndex, 0, rule);
}
