/**
 * Copyright (c) 2026 Robert Lindley
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Tests for CLI validators.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateConfigPath, validateGlobalOptions, validatePathOption } from '../../src/cli/validators';

describe('cli validators', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-connecter-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('validateGlobalOptions', () => {
    it('should throw when verbose and quiet are both enabled', () => {
      expect(() => validateGlobalOptions({ verbose: true, quiet: true })).toThrow(
        'Cannot use --verbose and --quiet together.',
      );
    });

    it('should do not throw for compatible options', () => {
      expect(() => validateGlobalOptions({ verbose: true, quiet: false })).not.toThrow();
    });
  });

  describe('validatePathOption', () => {
    it('should throw when path is empty', () => {
      expect(() => validatePathOption('')).toThrow('Missing required value for --path.');
    });

    it('should throw when path is whitespace', () => {
      expect(() => validatePathOption('   ')).toThrow('Missing required value for --path.');
    });

    it('should include custom option names in error messages', () => {
      expect(() => validatePathOption('', '--config')).toThrow('Missing required value for --config.');
    });

    it('should throw when path does not exist', () => {
      expect(() => validatePathOption(path.join(tempDir, 'missing.ts'))).toThrow('Path not found');
    });

    it('should allow directory paths', () => {
      const dirPath = path.join(tempDir, 'components');
      fs.mkdirSync(dirPath);

      const resolved = validatePathOption(dirPath);
      expect(resolved).toBe(path.resolve(dirPath));
    });

    it('should return an absolute path when the file exists', () => {
      const filePath = path.join(tempDir, 'component.component.ts');
      fs.writeFileSync(filePath, 'export const foo = 1;', 'utf8');

      const resolved = validatePathOption(filePath);
      expect(resolved).toBe(path.resolve(filePath));
    });
  });

  describe('validateConfigPath', () => {
    it('should return undefined when no value is provided', () => {
      expect(validateConfigPath()).toBeUndefined();
    });

    it('should throw when config path does not exist', () => {
      expect(() => validateConfigPath(path.join(tempDir, 'missing.json'))).toThrow('Config file not found');
    });

    it('should throw when config path is not a file', () => {
      const dirPath = path.join(tempDir, 'config-dir');
      fs.mkdirSync(dirPath);

      expect(() => validateConfigPath(dirPath)).toThrow('Config path is not a file');
    });

    it('should return resolved path for valid config file', () => {
      const configPath = path.join(tempDir, 'tsconfig.json');
      fs.writeFileSync(configPath, '{"compilerOptions": {}}', 'utf8');

      expect(validateConfigPath(configPath)).toBe(path.resolve(configPath));
    });
  });
});
