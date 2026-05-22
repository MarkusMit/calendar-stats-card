type TokenType = 'NUMBER' | 'ENTITY' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'LPAREN' | 'RPAREN' | 'EOF';
interface Token { type: TokenType; numVal?: number; strVal?: string }

function stripDelimiters(expr: string): string {
  return expr.replace(/^\s*\{\{/, '').replace(/\}\}\s*$/, '').trim();
}

function tokenize(expression: string): Token[] {
  const src = stripDelimiters(expression);
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < src.length) {
    if (/\s/.test(src[pos]!)) { pos++; continue; }

    if (/[0-9]/.test(src[pos]!)) {
      const start = pos;
      while (pos < src.length && /[0-9]/.test(src[pos]!)) pos++;
      if (pos < src.length && src[pos] === '.') {
        pos++;
        while (pos < src.length && /[0-9]/.test(src[pos]!)) pos++;
      }
      tokens.push({ type: 'NUMBER', numVal: parseFloat(src.slice(start, pos)) });
      continue;
    }

    if (/[a-zA-Z_]/.test(src[pos]!)) {
      const start = pos;
      while (pos < src.length && /[a-zA-Z0-9_.]/.test(src[pos]!)) pos++;
      tokens.push({ type: 'ENTITY', strVal: src.slice(start, pos) });
      continue;
    }

    const ch = src[pos]!;
    switch (ch) {
      case '+': tokens.push({ type: 'PLUS' }); break;
      case '-': tokens.push({ type: 'MINUS' }); break;
      case '*': tokens.push({ type: 'STAR' }); break;
      case '/': tokens.push({ type: 'SLASH' }); break;
      case '(': tokens.push({ type: 'LPAREN' }); break;
      case ')': tokens.push({ type: 'RPAREN' }); break;
      default: throw new SyntaxError(`Unexpected character '${ch}' in expression`);
    }
    pos++;
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

export function extractEntityIds(expression: string): string[] {
  const ids = new Set<string>();
  for (const tok of tokenize(expression)) {
    if (tok.type === 'ENTITY' && tok.strVal?.includes('.')) ids.add(tok.strVal);
  }
  return [...ids];
}

export function evaluate(expression: string, context: Record<string, number>): number {
  const tokens = tokenize(expression);
  let pos = 0;

  const peek = (): Token => tokens[pos]!;
  const consume = (): Token => tokens[pos++]!;

  function parseExpr(): number {
    let v = parseTerm();
    while (peek().type === 'PLUS' || peek().type === 'MINUS') {
      const op = consume().type;
      const r = parseTerm();
      v = op === 'PLUS' ? v + r : v - r;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseUnary();
    while (peek().type === 'STAR' || peek().type === 'SLASH') {
      const op = consume().type;
      const r = parseUnary();
      if (op === 'SLASH') {
        if (r === 0) throw new RangeError('Division by zero in expression');
        v = v / r;
      } else {
        v = v * r;
      }
    }
    return v;
  }

  function parseUnary(): number {
    if (peek().type === 'MINUS') { consume(); return -parseUnary(); }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const tok = peek();
    if (tok.type === 'NUMBER') { consume(); return tok.numVal!; }
    if (tok.type === 'ENTITY') { consume(); return context[tok.strVal!] ?? 0; }
    if (tok.type === 'LPAREN') {
      consume();
      const v = parseExpr();
      if (peek().type !== 'RPAREN') throw new SyntaxError('Expected )');
      consume();
      return v;
    }
    throw new SyntaxError(`Unexpected token: ${tok.type}`);
  }

  return parseExpr();
}
