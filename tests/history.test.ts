import { describe, expect, it } from "vitest";
import { formatBytes, textDiff } from "../src/history";

describe("document comparison", () => {
  it("marks added and removed words while preserving shared context", () => {
    expect(textDiff("Payment due in thirty days", "Payment due in forty five days")).toEqual([
      { kind: "same", text: "Payment due in" },
      { kind: "removed", text: "thirty" },
      { kind: "added", text: "forty five" },
      { kind: "same", text: "days" }
    ]);
  });

  it("handles empty snapshots", () => {
    expect(textDiff("", "First draft")).toEqual([{ kind: "added", text: "First draft" }]);
  });
});

describe("archive metadata", () => {
  it("formats byte counts for people", () => {
    expect(formatBytes(100)).toBe("100 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});
