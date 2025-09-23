type Rule = {
  urlMatch: string;
  titleMatch: string;
  titleReplace: string;
};

export function initializeOptions(): () => void {
  const addRuleButtonElement = document.getElementById('add-rule');
  const resetRulesButtonElement = document.getElementById('reset-rules');
  const saveRulesButtonElement = document.getElementById('save-rules');
  const urlMatchPatternInputElement = document.getElementById('url-match-pattern');
  const titleMatchPatternInputElement = document.getElementById('title-match-pattern');
  const titleReplacementInputElement = document.getElementById('title-replacement');
  const rulesListElement = document.getElementById('rules-list');
  const statusParagraphElement = document.getElementById('status');

  if (
    !(addRuleButtonElement instanceof HTMLButtonElement) ||
    !(resetRulesButtonElement instanceof HTMLButtonElement) ||
    !(saveRulesButtonElement instanceof HTMLButtonElement) ||
    !(urlMatchPatternInputElement instanceof HTMLInputElement) ||
    !(titleMatchPatternInputElement instanceof HTMLInputElement) ||
    !(titleReplacementInputElement instanceof HTMLInputElement) ||
    !(rulesListElement instanceof HTMLDivElement) ||
    !(statusParagraphElement instanceof HTMLParagraphElement)
  ) {
    console.warn('Options UI is missing expected elements; aborting initialization.');
    return () => {};
  }

  const addRuleButton = addRuleButtonElement;
  const resetRulesButton = resetRulesButtonElement;
  const saveRulesButton = saveRulesButtonElement;
  const urlMatchPatternInput = urlMatchPatternInputElement;
  const titleMatchPatternInput = titleMatchPatternInputElement;
  const titleReplacementInput = titleReplacementInputElement;
  const rulesListDiv = rulesListElement;
  const statusParagraph = statusParagraphElement;

  const storageArea = chrome?.storage?.sync;

  if (!storageArea) {
    console.warn('chrome.storage.sync is not available; options page will not persist data.');
    return () => {};
  }

  let rules: Rule[] = [];
  const abortController = new AbortController();
  const { signal } = abortController;
  let statusResetTimeout: ReturnType<typeof setTimeout> | undefined;

  function clearStatusAfterDelay() {
    if (statusResetTimeout) {
      clearTimeout(statusResetTimeout);
    }
    statusResetTimeout = setTimeout(() => {
      statusParagraph.textContent = '';
    }, 2000);
  }

  async function loadRules() {
    try {
      const data = await storageArea.get({ titleRules: [] });
      if (Array.isArray(data.titleRules)) {
        rules = data.titleRules as Rule[];
      } else {
        rules = [];
      }
      renderRules();
    } catch (error) {
      console.error('Failed to load rules from storage.', error);
      rules = [];
      renderRules();
      statusParagraph.textContent = 'Failed to load existing rules.';
      clearStatusAfterDelay();
    }
  }

  function renderRules() {
    rulesListDiv.innerHTML = '';
    rules.forEach((rule, index) => {
      const ruleDiv = document.createElement('div');
      ruleDiv.className = 'rule-row';
      ruleDiv.innerHTML = `
        <input type="text" value="${rule.urlMatch}" disabled>
        <input type="text" value="${rule.titleMatch}" disabled>
        <input type="text" value="${rule.titleReplace}" disabled>
        <button class="remove-rule" data-index="${index}">X</button>
      `;
      rulesListDiv.appendChild(ruleDiv);
    });

    rulesListDiv.querySelectorAll('.remove-rule').forEach((button) => {
      button.addEventListener(
        'click',
        (event) => {
          const index = (event.target as HTMLElement).dataset.index;
          if (index !== undefined) {
            rules.splice(parseInt(index, 10), 1);
            renderRules();
            void saveRules();
          }
        },
        { signal },
      );
    });
  }

  async function saveRules() {
    try {
      await storageArea.set({ titleRules: rules });
      statusParagraph.textContent = 'Rules Saved!';
    } catch (error) {
      console.error('Failed to save rules to storage.', error);
      statusParagraph.textContent = 'Failed to save rules.';
    }
    clearStatusAfterDelay();
  }

  addRuleButton.addEventListener(
    'click',
    () => {
      const newRule: Rule = {
        urlMatch: urlMatchPatternInput.value,
        titleMatch: titleMatchPatternInput.value,
        titleReplace: titleReplacementInput.value,
      };
      rules.push(newRule);
      renderRules();
      void saveRules();
      urlMatchPatternInput.value = '';
      titleMatchPatternInput.value = '';
      titleReplacementInput.value = '';
    },
    { signal },
  );

  resetRulesButton.addEventListener(
    'click',
    () => {
      rules = [];
      renderRules();
      void saveRules();
    },
    { signal },
  );

  saveRulesButton.addEventListener(
    'click',
    () => {
      void saveRules();
    },
    { signal },
  );

  void loadRules();

  return () => {
    abortController.abort();
    rules = [];
    if (statusResetTimeout) {
      clearTimeout(statusResetTimeout);
    }
  };
}
