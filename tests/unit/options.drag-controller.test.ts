import { describe, expect, it, vi } from "vitest";

import { createRuleDragManager } from "../../src/surfaces/options/helpers/drag-controller.js";

describe("rule drag manager", () => {
  function createRow(index: number | null): HTMLTableRowElement {
    const row = document.createElement("tr");
    if (index !== null) {
      row.dataset.index = String(index);
    }
    const handle = document.createElement("button");
    handle.className = "drag-handle";
    handle.draggable = true;
    row.append(handle);
    return row;
  }

  function makeDataTransferStub() {
    return {
      setData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
  }

  function dispatchDragEvent(
    target: EventTarget,
    type: string,
    init?: { dataTransfer?: Record<string, unknown> },
  ): DragEvent {
    const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    if (init?.dataTransfer) {
      Object.defineProperty(event, "dataTransfer", {
        configurable: true,
        value: init.dataTransfer,
      });
    }
    target.dispatchEvent(event);
    return event;
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

  it("clears drag state when the drop target index is missing", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const sourceRow = createRow(0);
    const targetRow = createRow(null);
    manager.registerRow(sourceRow, "title", controller.signal);
    manager.registerRow(targetRow, "title", controller.signal);

    const handle = sourceRow.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");
    expect(sourceRow.classList.contains("dragging")).toBe(true);

    dispatchDragEvent(targetRow, "dragenter");
    expect(targetRow.classList.contains("drag-over")).toBe(true);

    dispatchDragEvent(targetRow, "drop");

    expect(targetRow.classList.contains("drag-over")).toBe(false);
    expect(sourceRow.classList.contains("dragging")).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("prevents drag start when the row index is missing", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(null);
    manager.registerRow(row, "title", controller.signal);

    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    const event = dispatchDragEvent(handle as HTMLButtonElement, "dragstart");
    expect(event.defaultPrevented).toBe(true);
    expect(row.classList.contains("dragging")).toBe(false);
  });

  it("populates dataTransfer metadata during drag start", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(2);
    manager.registerRow(row, "title", controller.signal);
    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    const dataTransfer = makeDataTransferStub();
    const event = dispatchDragEvent(handle as HTMLButtonElement, "dragstart", { dataTransfer });

    expect(event.defaultPrevented).toBe(false);
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "2");
    expect(dataTransfer.setDragImage).toHaveBeenCalledWith(row, 0, 0);
    expect(dataTransfer.effectAllowed).toBe("move");
    expect(row.classList.contains("dragging")).toBe(true);
  });

  it("toggles visual state classes during drag lifecycle", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const sourceRow = createRow(0);
    const targetRow = createRow(1);
    manager.registerRow(sourceRow, "title", controller.signal);
    manager.registerRow(targetRow, "title", controller.signal);

    const handle = sourceRow.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");
    expect(sourceRow.classList.contains("dragging")).toBe(true);

    const enterEvent = dispatchDragEvent(targetRow, "dragenter");
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(targetRow.classList.contains("drag-over")).toBe(true);

    dispatchDragEvent(targetRow, "dragleave");
    expect(targetRow.classList.contains("drag-over")).toBe(false);

    dispatchDragEvent(handle as HTMLButtonElement, "dragend");
    expect(sourceRow.classList.contains("dragging")).toBe(false);
  });

  it("ignores dragover events when no drag operation is active", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "title", controller.signal);

    const overEvent = dispatchDragEvent(row, "dragover");
    expect(overEvent.defaultPrevented).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("updates dropEffect during dragover when dataTransfer is present", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "title", controller.signal);
    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    dispatchDragEvent(handle as HTMLButtonElement, "dragstart", {
      dataTransfer: makeDataTransferStub(),
    });

    const overTransfer = makeDataTransferStub();
    const overEvent = dispatchDragEvent(row, "dragover", { dataTransfer: overTransfer });
    expect(overEvent.defaultPrevented).toBe(true);
    expect(overTransfer.dropEffect).toBe("move");
  });

  it("ignores drag events that cross scopes", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const titleRow = createRow(0);
    const urlRow = createRow(1);
    manager.registerRow(titleRow, "title", controller.signal);
    manager.registerRow(urlRow, "url", controller.signal);

    const handle = titleRow.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");

    const enterEvent = dispatchDragEvent(urlRow, "dragenter");
    expect(enterEvent.defaultPrevented).toBe(false);
    expect(urlRow.classList.contains("drag-over")).toBe(false);

    dispatchDragEvent(urlRow, "drop");
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("skips rows without drag handles", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = document.createElement("tr");
    manager.registerRow(row, "title", controller.signal);

    expect(() => dispatchDragEvent(row, "dragenter")).not.toThrow();
  });

  it("clears dragging state on dispose", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "title", controller.signal);

    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();
    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");
    expect(row.classList.contains("dragging")).toBe(true);

    manager.dispose();
    expect(() => dispatchDragEvent(row, "drop")).not.toThrow();
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("removes listeners when the registration signal aborts", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "title", controller.signal);
    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    controller.abort();

    const event = dispatchDragEvent(handle as HTMLButtonElement, "dragstart");
    expect(event.defaultPrevented).toBe(false);
    expect(row.classList.contains("dragging")).toBe(false);
  });

  it("releases drag-over flair when row is removed", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const sourceRow = createRow(0);
    const targetRow = createRow(1);
    manager.registerRow(sourceRow, "title", controller.signal);
    manager.registerRow(targetRow, "title", controller.signal);

    const handle = sourceRow.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");
    dispatchDragEvent(targetRow, "dragenter");
    expect(targetRow.classList.contains("drag-over")).toBe(true);

    targetRow.remove();
    dispatchDragEvent(targetRow, "dragleave");

    expect(targetRow.classList.contains("drag-over")).toBe(false);
  });

  it("allows dispose to be called multiple times", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "title", controller.signal);

    manager.dispose();
    expect(() => manager.dispose()).not.toThrow();
  });

  it("clears dragging state when disposed mid-drag", () => {
    const onReorder = vi.fn();
    const manager = createRuleDragManager({ onReorder });
    const controller = new AbortController();

    const row = createRow(0);
    manager.registerRow(row, "title", controller.signal);
    const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
    expect(handle).not.toBeNull();

    dispatchDragEvent(handle as HTMLButtonElement, "dragstart");
    manager.dispose();

    const dropEvent = dispatchDragEvent(row, "drop");
    expect(dropEvent.defaultPrevented).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
    expect(row.classList.contains("dragging")).toBe(false);
  });
});
