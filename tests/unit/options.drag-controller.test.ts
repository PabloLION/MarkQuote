import { describe, expect, it, vi } from "vitest";
import { createRuleDragManager } from "../../src/surfaces/options/helpers/drag-controller.js";

describe("rule drag manager", () => {
  function createRow(index: number): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.dataset.index = String(index);
    const handle = document.createElement("button");
    handle.className = "drag-handle";
    handle.draggable = true;
    row.append(handle);
    return row;
  }

  function dispatchDragEvent(target: EventTarget, type: string): void {
    const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    target.dispatchEvent(event);
  }

  it("reorders rows when drop occurs", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "title", controller.signal);

    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();
    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");

    const targetRow = row;
    targetRow.dataset.index = "1";
    dispatchDragEvent(targetRow, "dragenter");
    dispatchDragEvent(targetRow, "dragover");
    dispatchDragEvent(targetRow, "drop");

    expect(onReorder).toHaveBeenCalledWith("title", 0, 1);
  });

  it("ignores drops when indices are invalid", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "url", controller.signal);

    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();
    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");

    row.dataset.index = "not-a-number";
    dispatchDragEvent(row, "drop");

    expect(onReorder).not.toHaveBeenCalled();
  });
});
