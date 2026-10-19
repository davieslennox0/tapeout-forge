// Ported from packages/cli/src/expr.ts (same tiny self-contained logic, duplicated here so
// apps/web stays a pure static bundle with no dependency on @forgeout/cli's Node-oriented
// package). Variables are lowercase letters; operators & | ^ ! ().
export function parseExprVars(expr: string): string[] {
  const vars = new Set<string>();
  for (const ch of expr) if (/[a-z]/.test(ch)) vars.add(ch);
  return Array.from(vars).sort();
}
function tokenize(expr: string): string[] {
  return expr.match(/[a-z]|[&|^!()]/g) ?? [];
}
class Parser {
  tokens: string[]; pos = 0; env: Record<string, number>;
  constructor(tokens: string[], env: Record<string, number>) { this.tokens = tokens; this.env = env; }
  peek() { return this.tokens[this.pos]; }
  next() { const t = this.tokens[this.pos]; if (t === undefined) throw new Error('expr: unexpected end of input'); this.pos++; return t; }
  parseOr(): number { let v = this.parseXor(); while (this.peek() === '|') { this.next(); v = v | this.parseXor(); } return v; }
  parseXor(): number { let v = this.parseAnd(); while (this.peek() === '^') { this.next(); v = v ^ this.parseAnd(); } return v; }
  parseAnd(): number { let v = this.parseNot(); while (this.peek() === '&') { this.next(); v = v & this.parseNot(); } return v; }
  parseNot(): number {
    if (this.peek() === '!') { this.next(); return this.parseNot() ? 0 : 1; }
    if (this.peek() === '(') { this.next(); const v = this.parseOr(); if (this.next() !== ')') throw new Error("expr: expected ')'"); return v; }
    const t = this.next();
    if (!/^[a-z]$/.test(t)) throw new Error(`expr: expected variable, got '${t}'`);
    if (!(t in this.env)) throw new Error(`expr: unbound variable '${t}'`);
    return this.env[t];
  }
}
export function evalExpr(expr: string, env: Record<string, number>): number {
  const tokens = tokenize(expr);
  const p = new Parser(tokens, env);
  const v = p.parseOr();
  if (p.pos !== tokens.length) throw new Error(`expr: trailing input at token ${p.pos}`);
  return v ? 1 : 0;
}
export function exprToRows(expr: string): { vars: string[]; rows: number[] } {
  const vars = parseExprVars(expr);
  const n = vars.length;
  const rows: number[] = [];
  for (let x = 0; x < 1 << n; x++) {
    const env: Record<string, number> = {};
    for (let i = 0; i < n; i++) env[vars[i]] = (x >> i) & 1;
    rows.push(evalExpr(expr, env));
  }
  return { vars, rows };
}
