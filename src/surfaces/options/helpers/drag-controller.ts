import type { DragScope } from "../rules-types.js";

type OnReorder = (scope: DragScope, fromIndex: number, toIndex: number) => void;

type DraggingState = {
  scope: DragScope;
  fromIndex: number;
  row: HTMLTableRowElement;
};

export interface RuleDragManager {
  registerRow(row: HTMLTableRowElement, scope: DragScope, signal: AbortSignal): void;
  dispose(): void;
}

interface DragManagerOptions {
  onReorder: OnReorder;
}

export function createRuleDragManager(options: DragManagerOptions): RuleDragManager {
  let draggingState: DraggingState | undefined;

  function handleDragStart(scope: DragScope, row: HTMLTableRowElement, event: DragEvent): void {
    const index = Number.parseInt(row.dataset.index ?? "", 10);
    if (Number.isNaN(index)) {
      event.preventDefault();
      return;
    }

    draggingState = { scope, fromIndex: index, row };
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", String(index));
      event.dataTransfer.setDragImage(row, 0, 0);
      event.dataTransfer.effectAllowed = "move";
    }
    row.classList.add("dragging");
  }

  function handleDragEnd(row: HTMLTableRowElement): void {
    row.classList.remove("dragging");
    draggingState = undefined;
  }

  function handleDragEnter(scope: DragScope, row: HTMLTableRowElement, event: DragEvent): void {
    if (!draggingState || draggingState.scope !== scope) {
      return;
    }
    event.preventDefault();
    row.classList.add("drag-over");
  }

  function handleDragOver(scope: DragScope, event: DragEvent): void {
    if (!draggingState || draggingState.scope !== scope) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(scope: DragScope, row: HTMLTableRowElement, event: DragEvent): void {
    if (!draggingState || draggingState.scope !== scope) {
      return;
    }

    event.preventDefault();
    const targetIndex = Number.parseInt(row.dataset.index ?? "", 10);
    if (Number.isNaN(targetIndex)) {
      row.classList.remove("drag-over");
      if (draggingState) {
        draggingState.row.classList.remove("dragging");
        draggingState = undefined;
      }
      return;
    }

    const fromIndex = draggingState.fromIndex;
    row.classList.remove("drag-over");
    draggingState.row.classList.remove("dragging");
    draggingState = undefined;

    options.onReorder(scope, fromIndex, targetIndex);
  }

  function registerRow(row: HTMLTableRowElement, scope: DragScope, signal: AbortSignal): void {
    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    if (!handle) {
      return;
    }

    handle.addEventListener(
      "dragstart",
      (event) => {
        handleDragStart(scope, row, event);
      },
      { signal },
    );

    handle.addEventListener(
      "dragend",
      () => {
        handleDragEnd(row);
      },
      { signal },
    );

    row.addEventListener(
      "dragenter",
      (event) => {
        handleDragEnter(scope, row, event);
      },
      { signal },
    );

    row.addEventListener(
      "dragover",
      (event) => {
        handleDragOver(scope, event);
      },
      { signal },
    );

    row.addEventListener(
      "dragleave",
      () => {
        row.classList.remove("drag-over");
      },
      { signal },
    );

    row.addEventListener(
      "drop",
      (event) => {
        handleDrop(scope, row, event);
      },
      { signal },
    );
  }

  return {
    registerRow,
    dispose(): void {
      draggingState = undefined;
    },
  };
}
