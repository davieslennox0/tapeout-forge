import { describe, it, expect } from "vitest";
import { exprToRows, evalExpr } from "../src/expr.js";

describe("expr", () => {
  it("parses majority as a&b|a&c|b&c and matches the known truth table", () => {
    const { vars, rows } = exprToRows("a&b|a&c|b&c");
    expect(vars).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([0, 0, 0, 1, 0, 1, 1, 1]);
  });

  it("supports NOT and parens", () => {
    expect(evalExpr("!(a&b)", { a: 1, b: 1 })).toBe(0);
    expect(evalExpr("!(a&b)", { a: 1, b: 0 })).toBe(1);
  });

  it("supports XOR", () => {
    expect(evalExpr("a^b", { a: 1, b: 1 })).toBe(0);
    expect(evalExpr("a^b", { a: 1, b: 0 })).toBe(1);
  });
});
