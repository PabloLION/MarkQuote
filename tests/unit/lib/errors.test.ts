import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getErrorMessage,
  isTransientDisconnectError,
  logDebug,
  logError,
  logInfo,
  logWarn,
} from "../../../src/lib/errors.js";

describe("lib/errors", () => {
  describe("isTransientDisconnectError", () => {
    it("returns true for Error with disconnect message", () => {
      const error = new Error("Receiving end does not exist.");
      expect(isTransientDisconnectError(error)).toBe(true);
    });

    it("returns true for string with disconnect message", () => {
      expect(isTransientDisconnectError("Receiving end does not exist.")).toBe(true);
    });

    it("returns true for partial message containing disconnect text", () => {
      const error = new Error("Could not establish connection. Receiving end does not exist.");
      expect(isTransientDisconnectError(error)).toBe(true);
    });

    it("returns false for unrelated Error", () => {
      const error = new Error("Some other error");
      expect(isTransientDisconnectError(error)).toBe(false);
    });

    it("returns false for unrelated string", () => {
      expect(isTransientDisconnectError("Some other error")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isTransientDisconnectError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isTransientDisconnectError(undefined)).toBe(false);
    });

    it("returns false for object without message", () => {
      expect(isTransientDisconnectError({ code: 123 })).toBe(false);
    });
  });

  describe("getErrorMessage", () => {
    it("extracts message from Error instance", () => {
      const error = new Error("Test error message");
      expect(getErrorMessage(error)).toBe("Test error message");
    });

    it("returns string directly", () => {
      expect(getErrorMessage("Direct string message")).toBe("Direct string message");
    });

    it("converts objects using String() to call toString()", () => {
      expect(getErrorMessage({ code: 123 })).toBe("[object Object]");
    });

    it("converts objects with custom toString()", () => {
      const customError = { toString: () => "custom error message" };
      expect(getErrorMessage(customError)).toBe("custom error message");
    });

    it("converts arrays using String()", () => {
      expect(getErrorMessage([1, 2, 3])).toBe("1,2,3");
    });

    it("handles null", () => {
      expect(getErrorMessage(null)).toBe("null");
    });

    it("handles undefined", () => {
      expect(getErrorMessage(undefined)).toBe("undefined");
    });

    it("handles numbers", () => {
      expect(getErrorMessage(42)).toBe("42");
    });
  });

  describe("logging functions", () => {
    beforeEach(() => {
      vi.spyOn(console, "debug").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("logDebug", () => {
      it("logs with prefix and message", () => {
        logDebug("Test message");
        expect(console.debug).toHaveBeenCalledWith("[MarkQuote]", "Test message");
      });

      it("logs with prefix, message, and meta", () => {
        logDebug("Test message", { key: "value" });
        expect(console.debug).toHaveBeenCalledWith("[MarkQuote]", "Test message", { key: "value" });
      });
    });

    describe("logInfo", () => {
      it("logs with prefix and message", () => {
        logInfo("Test message");
        expect(console.info).toHaveBeenCalledWith("[MarkQuote]", "Test message");
      });

      it("logs with prefix, message, and meta", () => {
        logInfo("Test message", { key: "value" });
        expect(console.info).toHaveBeenCalledWith("[MarkQuote]", "Test message", { key: "value" });
      });
    });

    describe("logWarn", () => {
      it("logs with prefix and message", () => {
        logWarn("Test message");
        expect(console.warn).toHaveBeenCalledWith("[MarkQuote]", "Test message");
      });

      it("logs with prefix, message, and meta", () => {
        logWarn("Test message", { key: "value" });
        expect(console.warn).toHaveBeenCalledWith("[MarkQuote]", "Test message", { key: "value" });
      });
    });

    describe("logError", () => {
      it("logs with prefix and message only", () => {
        logError("Test message");
        expect(console.error).toHaveBeenCalledWith("[MarkQuote]", "Test message");
      });

      it("logs with prefix, message, and error", () => {
        const error = new Error("Oops");
        logError("Test message", error);
        expect(console.error).toHaveBeenCalledWith("[MarkQuote]", "Test message", error);
      });

      it("logs with prefix, message, error, and meta", () => {
        const error = new Error("Oops");
        logError("Test message", error, { context: "test" });
        expect(console.error).toHaveBeenCalledWith("[MarkQuote]", "Test message", error, {
          context: "test",
        });
      });

      it("logs with prefix, message, and meta (no error)", () => {
        logError("Test message", undefined, { context: "test" });
        expect(console.error).toHaveBeenCalledWith("[MarkQuote]", "Test message", {
          context: "test",
        });
      });
    });
  });
});
