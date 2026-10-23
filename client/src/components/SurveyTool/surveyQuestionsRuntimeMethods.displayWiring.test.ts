import fs from 'fs';
import path from 'path';

const read = (fileName: string) => fs.readFileSync(path.join(__dirname, fileName), 'utf8');
const bindingsOf = (block: string) =>
  [...block.matchAll(/^ {4}([A-Za-z_$][A-Za-z0-9_$]*),$/gm)].map((match) => match[1]);

// Helpers that another runtime creates inside the runtime methods are not part of the shared
// context, so dependent runtimes only receive them when they are passed explicitly.
const runtimeProducedHelpers = (source: string) => {
  const multiLine = [
    ...source.matchAll(/\n {2}const \{((?:\n {4}[A-Za-z_$][A-Za-z0-9_$]*,)+)\n {2}\} = create[A-Za-z]+Runtime\(/g),
  ].flatMap((match) => bindingsOf(`${match[1]}\n`));
  const singleLine = [...source.matchAll(/\n {2}const \{ ([^}]+) \} = create[A-Za-z]+Runtime\(/g)].flatMap((match) =>
    match[1].split(',').map((name) => name.trim()),
  );
  return new Set([...multiLine, ...singleLine]);
};

describe('surveyQuestionsRuntimeMethods helper wiring', () => {
  const methods = read('surveyQuestionsRuntimeMethods.tsx');
  const runtimes = [...methods.matchAll(/\} = (create[A-Za-z]+Runtime)\(\{/g)].map((match) => match[1]);
  it.each(runtimes)('passes every runtime-created helper that %s uses', (factory) => {
    const stem = factory.replace(/^createS/, 's');
    const extension = fs.existsSync(path.join(__dirname, `${stem}.tsx`)) ? 'tsx' : 'ts';
    const display = read(`${stem}.${extension}`);
    const displayStart = display.indexOf('  const {');
    const needed = bindingsOf(display.slice(displayStart, display.indexOf('} = ', displayStart)));

    const callStart = methods.indexOf(`} = ${factory}({`);
    const call = methods.slice(callStart, methods.indexOf('\n  });', callStart));
    const passed = new Set([...call.matchAll(/^ {4}([A-Za-z_$][A-Za-z0-9_$]*)[,:(]/gm)].map((match) => match[1]));
    const produced = runtimeProducedHelpers(methods);

    expect(needed.length).toBeGreaterThan(0);
    expect(callStart).toBeGreaterThan(-1);
    expect(needed.filter((name) => produced.has(name) && !passed.has(name))).toEqual([]);
  });
});
