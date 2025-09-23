type Rule = {
  urlMatch: string;
  titleMatch: string;
  titleReplace: string;
};

export function initializeOptions(): () => void {
  const addRuleButton = document.getElementById('add-rule') as HTMLButtonElement | null;
  const resetRulesButton = document.getElementById('reset-rules') as HTMLButtonElement | null;
  const saveRulesButton = document.getElementById('save-rules') as HTMLButtonElement | null;
  const urlMatchPatternInput = document.getElementById(
    'url-match-pattern',
  ) as HTMLInputElement | null;
  const titleMatchPatternInput = document.getElementById(
    'title-match-pattern',
  ) as HTMLInputElement | null;
  const titleReplacementInput = document.getElementById(
    'title-replacement',
  ) as HTMLInputElement | null;
  const rulesListDiv = document.getElementById('rules-list') as HTMLDivElement | null;
  const statusParagraph = document.getElementById('status') as HTMLParagraphElement | null;

  if (
    !addRuleButton ||
    !resetRulesButton ||
    !saveRulesButton ||
    !urlMatchPatternInput ||
    !titleMatchPatternInput ||
    !titleReplacementInput ||
    !rulesListDiv ||
    !statusParagraph
  ) {
    console.warn('Options UI is missing expected elements; aborting initialization.');
    return () => {};
  }

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
