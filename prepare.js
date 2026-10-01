import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BASE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/@{}~^:+-]*$/u;
const FAIL_LEVELS = new Set(['block', 'review', 'never']);

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function nearestExistingPath(candidate) {
  let current = candidate;
  for (;;) {
    try {
      await fs.lstat(current);
      return current;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw new Error(`No existing ancestor for output path: ${candidate}`);
      current = parent;
    }
  }
}

export async function resolveOutput(workspace, requested) {
  if (!requested || requested.includes('\0') || /[\r\n]/u.test(requested)) {
    throw new Error('output must be a non-empty single-line path');
  }
  if (path.isAbsolute(requested) || path.win32.isAbsolute(requested)) {
    throw new Error('output must be relative to the checked-out repository');
  }
  if (path.extname(requested).toLowerCase() !== '.json') {
    throw new Error('output must use a .json extension');
  }

  const workspaceReal = await fs.realpath(path.resolve(workspace));
  const target = path.resolve(workspaceReal, requested);
  if (!isWithin(workspaceReal, target)) {
    throw new Error('output must resolve inside the checked-out repository');
  }

  const existing = await nearestExistingPath(target);
  const existingReal = await fs.realpath(existing);
  if (!isWithin(workspaceReal, existingReal)) {
    throw new Error('output cannot traverse a symlink outside the checked-out repository');
  }
  return target;
}

export async function prepareInputs(environment = process.env) {
  const workspace = environment.GITHUB_WORKSPACE || process.cwd();
  const base = (environment.HL_BASE || 'origin/main').trim();
  const failOn = (environment.HL_FAIL_ON || 'block').trim();
  const requestedOutput = (environment.HL_OUTPUT || 'hostlatch-manifest.json').trim();

  if (!BASE_PATTERN.test(base)) {
    throw new Error('base must be a single Git revision without whitespace or shell metacharacters');
  }
  if (!FAIL_LEVELS.has(failOn)) {
    throw new Error('fail-on must be block, review, or never');
  }

  const outputPath = await resolveOutput(workspace, requestedOutput);
  return { base, failOn, outputPath };
}

export async function writeOutputs(file, values) {
  if (!file) return;
  const lines = Object.entries(values).map(([name, value]) => {
    const text = String(value);
    if (/[\r\n]/u.test(text)) throw new Error(`Action output ${name} must be single-line`);
    return `${name}=${text}\n`;
  }).join('');
  await fs.appendFile(file, lines, 'utf8');
}

export async function main(environment = process.env) {
  const prepared = await prepareInputs(environment);
  await writeOutputs(environment.GITHUB_OUTPUT, {
    base: prepared.base,
    fail_on: prepared.failOn,
    output_path: prepared.outputPath,
  });
  console.log(`HostLatch base: ${prepared.base}`);
  console.log(`HostLatch failure threshold: ${prepared.failOn}`);
  console.log(`HostLatch manifest: ${prepared.outputPath}`);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
