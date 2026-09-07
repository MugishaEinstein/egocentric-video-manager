import { describe, expect, it } from "vitest";
import { hasActionableRejectionComment, isMinimum1080p } from "./validation";

describe("video submission validation", () => {
  it("accepts 1920x1080 and higher resolutions", () => {
    expect(isMinimum1080p(1920, 1080)).toBe(true);
    expect(isMinimum1080p(3840, 2160)).toBe(true);
  });

  it("rejects recordings below the 1080p minimum", () => {
    expect(isMinimum1080p(1919, 1080)).toBe(false);
    expect(isMinimum1080p(1920, 1079)).toBe(false);
  });

  it("requires a useful rejection comment", () => {
    expect(hasActionableRejectionComment("Too dark")).toBe(false);
    expect(hasActionableRejectionComment("Reshoot with brighter front lighting and a stable frame.")).toBe(true);
  });
});
