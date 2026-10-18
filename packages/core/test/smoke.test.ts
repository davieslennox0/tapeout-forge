import { describe, it, expect } from "vitest";
import { CORE_VERSION } from "../src/index.js";

describe("smoke", () => {
  it("package loads", () => {
    expect(CORE_VERSION).toBe("0.0.1");
  });
});
