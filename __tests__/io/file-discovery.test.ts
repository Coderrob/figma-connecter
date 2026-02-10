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
 * @fileoverview Tests for file discovery module.
 */

import fs, { type Dirent, type Stats } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  COMPONENT_SUFFIX,
  DEFAULT_EXCLUDE_DIRS,
  discoverComponentFiles,
  type FileDiscoveryFileSystem,
  isComponentFile,
} from '../../src/io/file-discovery';

/**
 * Creates a mock Stats object.
 */
const createMockStats = (isDir: boolean): Stats =>
  ({
    isDirectory: () => isDir,
    isFile: () => !isDir,
  }) as Stats;

/**
 * Creates a mock Dirent object.
 */
const createMockDirent = (name: string, isDir: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
  }) as Dirent;

describe('isComponentFile', () => {
  describe('positive cases', () => {
    it('should return true for .component.ts file', () => {
      expect(isComponentFile('button.component.ts')).toBe(true);
    });

    it('should return true for full path with .component.ts', () => {
      expect(isComponentFile('/path/to/button.component.ts')).toBe(true);
    });

    it('should return true for uppercase extension', () => {
      expect(isComponentFile('Button.COMPONENT.TS')).toBe(true);
    });
  });

  describe('negative cases', () => {
    it('should return false for .ts file without component suffix', () => {
      expect(isComponentFile('button.ts')).toBe(false);
    });

    it('should return false for .component.tsx file', () => {
      expect(isComponentFile('button.component.tsx')).toBe(false);
    });

    it('should return false for .component.js file', () => {
      expect(isComponentFile('button.component.js')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isComponentFile('')).toBe(false);
    });
  });
});

describe('discoverComponentFiles', () => {
  let mockFileSystem: FileDiscoveryFileSystem;
  let mockExistsSync: jest.Mock;
  let mockStatSync: jest.Mock;
  let mockReaddirSync: jest.Mock;

  beforeEach(() => {
    mockExistsSync = jest.fn();
    mockStatSync = jest.fn();
    mockReaddirSync = jest.fn();

    mockFileSystem = {
      existsSync: mockExistsSync,
      statSync: mockStatSync,
      readdirSync: mockReaddirSync,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('positive cases', () => {
    it('should discover single component file when given a file path', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(false));

      const result = discoverComponentFiles('/src/button.component.ts', {
        fileSystem: mockFileSystem,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filePath: '/src/button.component.ts',
        fileName: 'button.component.ts',
        componentName: 'button',
      });
      expect(mockExistsSync).toHaveBeenCalledTimes(1);
      expect(mockExistsSync).toHaveBeenCalledWith('/src/button.component.ts');
    });

    it('should discover multiple component files in directory', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync.mockReturnValueOnce([
        createMockDirent('button.component.ts', false),
        createMockDirent('input.component.ts', false),
        createMockDirent('other.ts', false),
      ]);

      const result = discoverComponentFiles('/src/components', {
        fileSystem: mockFileSystem,
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.componentName).sort()).toEqual(['button', 'input']);
      expect(mockReaddirSync).toHaveBeenCalledTimes(1);
      expect(mockReaddirSync).toHaveBeenCalledWith('/src/components');
    });

    it('should discover files recursively when option is enabled', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync
        .mockReturnValueOnce([createMockDirent('button', true), createMockDirent('index.ts', false)])
        .mockReturnValueOnce([createMockDirent('button.component.ts', false)]);

      const result = discoverComponentFiles('/src/components', {
        recursive: true,
        fileSystem: mockFileSystem,
      });

      expect(result).toHaveLength(1);
      expect(result[0].componentName).toBe('button');
      expect(mockReaddirSync).toHaveBeenCalledTimes(2);
      expect(mockReaddirSync).toHaveBeenNthCalledWith(1, '/src/components');
      expect(mockReaddirSync).toHaveBeenNthCalledWith(2, '/src/components/button');
    });
  });

  describe('negative cases', () => {
    it('should return empty array for empty path', () => {
      const result = discoverComponentFiles('', { fileSystem: mockFileSystem });

      expect(result).toEqual([]);
      expect(mockExistsSync).toHaveBeenCalledTimes(0);
    });

    it('should return empty array for non-existent path', () => {
      mockExistsSync.mockReturnValueOnce(false);

      const result = discoverComponentFiles('/non/existent', {
        fileSystem: mockFileSystem,
      });

      expect(result).toEqual([]);
      expect(mockExistsSync).toHaveBeenCalledTimes(1);
      expect(mockExistsSync).toHaveBeenCalledWith('/non/existent');
    });

    it('should return empty array when file does not match pattern', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(false));

      const result = discoverComponentFiles('/src/button.ts', {
        fileSystem: mockFileSystem,
      });

      expect(result).toEqual([]);
    });

    it('should return empty array for empty directory', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync.mockReturnValueOnce([]);

      const result = discoverComponentFiles('/src/components', {
        fileSystem: mockFileSystem,
      });

      expect(result).toEqual([]);
      expect(mockReaddirSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should excludes node_modules directory by default', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync.mockReturnValueOnce([
        createMockDirent('button.component.ts', false),
        createMockDirent('node_modules', true),
      ]);

      const result = discoverComponentFiles('/src', {
        recursive: true,
        fileSystem: mockFileSystem,
      });

      expect(result).toHaveLength(1);
      expect(mockReaddirSync).toHaveBeenCalledTimes(1);
    });

    it('should excludes dist directory by default', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync.mockReturnValueOnce([
        createMockDirent('button.component.ts', false),
        createMockDirent('dist', true),
      ]);

      const result = discoverComponentFiles('/src', {
        recursive: true,
        fileSystem: mockFileSystem,
      });

      expect(result).toHaveLength(1);
      expect(mockReaddirSync).toHaveBeenCalledTimes(1);
    });

    it('should respect custom exclude directories', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync.mockReturnValueOnce([
        createMockDirent('button.component.ts', false),
        createMockDirent('custom-exclude', true),
      ]);

      const result = discoverComponentFiles('/src', {
        recursive: true,
        excludeDirs: ['custom-exclude'],
        fileSystem: mockFileSystem,
      });

      expect(result).toHaveLength(1);
      expect(mockReaddirSync).toHaveBeenCalledTimes(1);
    });

    it('should do not recurse when recursive option is false', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync.mockReturnValueOnce([
        createMockDirent('nested', true),
        createMockDirent('button.component.ts', false),
      ]);

      const result = discoverComponentFiles('/src', {
        recursive: false,
        fileSystem: mockFileSystem,
      });

      expect(result).toHaveLength(1);
      expect(mockReaddirSync).toHaveBeenCalledTimes(1);
    });

    it('should sort results by file path', () => {
      mockExistsSync.mockReturnValueOnce(true);
      mockStatSync.mockReturnValueOnce(createMockStats(true));
      mockReaddirSync.mockReturnValueOnce([
        createMockDirent('z-component.component.ts', false),
        createMockDirent('a-component.component.ts', false),
        createMockDirent('m-component.component.ts', false),
      ]);

      const result = discoverComponentFiles('/src', { fileSystem: mockFileSystem });

      expect(result.map((r) => r.componentName)).toEqual(['a-component', 'm-component', 'z-component']);
    });

    it('should use the default filesystem when no provider is supplied', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-connecter-'));
      const componentPath = path.join(tempDir, 'demo.component.ts');
      fs.writeFileSync(componentPath, 'export class Demo {}', 'utf8');

      const result = discoverComponentFiles(tempDir);

      expect(result.some((file) => file.filePath === componentPath)).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});

describe('constants', () => {
  it('should export expected COMPONENT_SUFFIX', () => {
    expect(COMPONENT_SUFFIX).toBe('.component.ts');
  });

  it('should export expected DEFAULT_EXCLUDE_DIRS', () => {
    expect(DEFAULT_EXCLUDE_DIRS).toContain('node_modules');
    expect(DEFAULT_EXCLUDE_DIRS).toContain('dist');
  });
});
