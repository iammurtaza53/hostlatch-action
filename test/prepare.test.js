import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareInputs, resolveOutput, writeOutputs } from '../prepare.js';

async function withWorkspace(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hostlatch-action-'));
  try {
    return await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('defaults are safe and deterministic', async () => withWorkspace(async (root) => {
  const result = await prepareInputs({ GITHUB_WORKSPACE: root });
  assert.equal(result.base, 'origin/main');
  assert.equal(result.failOn, 'block');
  assert.equal(result.outputPath, path.join(await fs.realpath(root), 'hostlatch-manifest.json'));
}));

test('accepts supported custom inputs', async () => withWorkspace(async (root) => {
  const result = await prepareInputs({
    GITHUB_WORKSPACE: root,
    HL_BASE: 'HEAD~2',
    HL_FAIL_ON: 'review',
    HL_OUTPUT: '.hostlatch/result.json',
  });
  assert.equal(result.base, 'HEAD~2');
  assert.equal(result.failOn, 'review');
  assert.equal(result.outputPath, path.join(await fs.realpath(root), '.hostlatch', 'result.json'));
}));

test('rejects invalid thresholds and unsafe base expressions', async () => withWorkspace(async (root) => {
  await assert.rejects(
    prepareInputs({ GITHUB_WORKSPACE: root, HL_FAIL_ON: 'critical' }),
    /fail-on must be block, review, or never/u,
  );
  await assert.rejects(
    prepareInputs({ GITHUB_WORKSPACE: root, HL_BASE: 'main; echo unsafe' }),
    /base must be a single Git revision/u,
  );
}));

test('rejects output paths outside the workspace or without JSON extension', async () => withWorkspace(async (root) => {
  await assert.rejects(resolveOutput(root, '../manifest.json'), /inside the checked-out repository/u);
  await assert.rejects(resolveOutput(root, 'manifest.txt'), /\.json extension/u);
  await assert.rejects(resolveOutput(root, path.resolve(root, 'manifest.json')), /must be relative/u);
}));

test('writes GitHub outputs without dependencies', async () => withWorkspace(async (root) => {
  const output = path.join(root, 'github-output.txt');
  await writeOutputs(output, { base: 'origin/main', fail_on: 'never' });
  assert.equal(await fs.readFile(output, 'utf8'), 'base=origin/main\nfail_on=never\n');
}));
