import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../mobile');
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(resolve(dir, entry.name)) : entry.name.endsWith('.tsx') ? [resolve(dir, entry.name)] : []);
}
const sources = [...files(resolve(root, 'app')), ...files(resolve(root, 'components'))];
function parse(path: string) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function tags(path: string) {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) found.push(node.tagName.getText());
    ts.forEachChild(node, visit);
  };
  visit(parse(path)); return found;
}

describe('permanent input surface inventory', () => {
  it('requires an explicit inventory update for every new native or web input surface', () => {
    const inputs = sources.flatMap(path => {
      const count = tags(path).filter(tag => /(?:TextInput|^input$|^textarea$)/.test(tag)).length;
      return count ? [`${relative(root, path)}: ${count}`] : [];
    }).sort();
    expect(inputs).toEqual([
      'app/(settings)/delete-account.tsx: 1',
      'app/(settings)/planned-treat.tsx: 2',
      'components/caloriebank/DailyBankTargetInput.tsx: 1',
      'components/caloriebank/GoalConfigurationForm.tsx: 1',
      'components/caloriebank/ManualEstimateEditor.tsx: 1',
      'components/caloriebank/StepPlanningCards.tsx: 2',
    ]);
  });

  it('follows imported form components from every route and rejects inputs outside a keyboard-safe host', () => {
    function unsafeInputs(path: string, chain: string[] = []): string[] {
      if (chain.includes(path)) return [];
      const source = parse(path), imports = new Map<string, string>();
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const spec = statement.moduleSpecifier.text;
        if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
        const base = spec.startsWith('@/') ? resolve(root, spec.slice(2)) : resolve(dirname(path), spec);
        const target = [base + '.tsx', resolve(base, 'index.tsx')].find(existsSync);
        if (!target) continue;
        if (statement.importClause?.name) imports.set(statement.importClause.name.text, target);
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) imports.set(item.name.text, target);
      }
      // Onboarding composes stageContent before its final JSX return. Track an
      // expression only when every JSX use is inside the safe scroll owner.
      const safeExpressions = new Set<string>(), unsafeExpressions = new Set<string>();
      const collect = (node: ts.Node, safe = false) => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'KeyboardSafeScrollView') safe = true;
        if (ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression)) {
          (safe ? safeExpressions : unsafeExpressions).add(node.expression.text);
        }
        ts.forEachChild(node, child => collect(child, safe));
      };
      collect(source);
      const errors: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && safeExpressions.has(node.name.text) && !unsafeExpressions.has(node.name.text)) return;
        const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
        if (opening) {
          const tag = opening.tagName.getText();
          if (tag === 'KeyboardSafeScrollView') return;
          if (tag === 'PlaceholderScreen' && opening.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText() === 'keyboardAware' && !prop.initializer)) return;
          if (/(?:TextInput|^input$|^textarea$)/.test(tag)) errors.push(relative(root, path));
          const target = imports.get(tag);
          if (target) errors.push(...unsafeInputs(target, [...chain, path]));
        }
        ts.forEachChild(node, visit);
      };
      visit(source); return errors;
    }
    for (const route of files(resolve(root, 'app'))) expect(unsafeInputs(route), relative(root, route)).toEqual([]);
  });

  it('prevents competing keyboard owners and per-screen timed keyboard scrolling', () => {
    for (const path of sources) {
      const source = readFileSync(path, 'utf8');
      expect(source, relative(root, path)).not.toMatch(/<KeyboardAvoidingView|scrollResponderScrollNativeHandleToKeyboard/);
      if (!path.endsWith('KeyboardSafeScrollView.tsx')) expect(source, relative(root, path)).not.toContain('automaticallyAdjustKeyboardInsets');
    }
  });
});
