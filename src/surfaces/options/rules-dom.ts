export function createInputCell(
  field: string,
  index: number,
  value: string,
  label: string,
): HTMLTableCellElement {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = "text";
  input.dataset.index = String(index);
  input.dataset.field = field;
  input.placeholder = label;
  input.value = value;
  cell.append(input);
  return cell;
}

export function createCheckboxCell(
  field: string,
  index: number,
  checked: boolean,
  ariaLabel: string,
): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.classList.add("toggle-cell");

  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.index = String(index);
  input.dataset.field = field;
  input.checked = checked;
  input.setAttribute("aria-label", ariaLabel);

  cell.append(input);
  return cell;
}

export function createRemoveCell(index: number, scope: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.index = String(index);
  button.dataset.scope = scope;
  button.dataset.action = "remove";
  button.classList.add("danger");
  button.textContent = "Remove";
  cell.append(button);
  return cell;
}

export function createHandleCell(scope: string, _index: number): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.classList.add("reorder-cell");

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("drag-handle");
  button.draggable = true;
  button.setAttribute(
    "aria-label",
    scope === "title" ? "Drag to reorder title rule" : "Drag to reorder URL rule",
  );
  // Static markup for the drag handle glyph; safe because it never incorporates user data.
  button.innerHTML = '<span aria-hidden="true">⋮⋮</span>';

  cell.append(button);
  return cell;
}
