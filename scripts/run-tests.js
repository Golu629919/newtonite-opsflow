process.env.NODE_ENV = 'test';

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'node:fs';
import path from 'node:path';

const testDir = path.resolve('tests');
const testFiles = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.js'))
  .map(f => path.join(testDir, f));

console.log(`\n=======================================================`);
console.log(`🧪 Running Newtonite Operational Test Suite (${testFiles.length} suites)`);
console.log(`=======================================================\n`);

const testStream = run({ files: testFiles, concurrency: 1 });

testStream
  .compose(new spec())
  .pipe(process.stdout);

testStream.on('error', (err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

testStream.on('test:fail', () => {
  process.exitCode = 1;
});
