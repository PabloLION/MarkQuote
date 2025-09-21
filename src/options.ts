export function initializeOptions() {
  const addRuleButton = document.getElementById('add-rule') as HTMLButtonElement;
  const resetRulesButton = document.getElementById('reset-rules') as HTMLButtonElement;
  const saveRulesButton = document.getElementById('save-rules') as HTMLButtonElement;
  const urlMatchPatternInput = document.getElementById('url-match-pattern') as HTMLInputElement;
  const titleMatchPatternInput = document.getElementById('title-match-pattern') as HTMLInputElement;
  const titleReplacementInput = document.getElementById('title-replacement') as HTMLInputElement;
  const rulesListDiv = document.getElementById('rules-list') as HTMLDivElement;
  const statusParagraph = document.getElementById('status') as HTMLParagraphElement;

  interface Rule {
    urlMatch: string;
    titleMatch: string;
    titleReplace: string;
  }

  let rules: Rule[] = [];

  // Load rules from storage
  function loadRules() {
    chrome.storage.sync.get({ titleRules: [] }, (data) => {
      rules = data.titleRules;
      renderRules();
    });
  }

  // Save rules to storage
  function saveRules() {
    chrome.storage.sync.set({ titleRules: rules }, () => {
      statusParagraph.textContent = 'Rules Saved!';
      setTimeout(() => {
        statusParagraph.textContent = '';
      }, 2000);
    });
  }

  // Render rules in the UI
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

    // Add event listeners for remove buttons
    rulesListDiv.querySelectorAll('.remove-rule').forEach(button => {
      button.addEventListener('click', (event) => {
        const index = (event.target as HTMLElement).dataset.index;
        if (index !== undefined) {
          rules.splice(parseInt(index), 1);
          renderRules();
          saveRules(); // Save after removing
        }
      });
    });
  }

  // Event Listeners
  addRuleButton.addEventListener('click', () => {
    const newRule: Rule = {
      urlMatch: urlMatchPatternInput.value,
      titleMatch: titleMatchPatternInput.value,
      titleReplace: titleReplacementInput.value,
    };
    rules.push(newRule);
    renderRules();
    saveRules(); // Save after adding
    // Clear inputs
    urlMatchPatternInput.value = '';
    titleMatchPatternInput.value = '';
    titleReplacementInput.value = '';
  });

  resetRulesButton.addEventListener('click', () => {
    rules = [];
    renderRules();
    saveRules(); // Save after resetting
  });

  saveRulesButton.addEventListener('click', saveRules);

  // Initial load
  loadRules();
}

document.addEventListener('DOMContentLoaded', initializeOptions);