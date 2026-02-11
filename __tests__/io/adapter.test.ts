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
 * @fileoverview Tests for IO adapter module.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createMemoryIoAdapter, MemoryIoAdapter, nodeIoAdapter } from '../../src/io/adapter';

describe('nodeIoAdapter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('exists', () => {
    it('should return true for existing files', () => {
      const filePath = path.join(tempDir, 'existing.txt');
      fs.writeFileSync(filePath, 'content', 'utf8');

      expect(nodeIoAdapter.exists(filePath)).toBe(true);
    });

    it('should return false for non-existent files', () => {
      const filePath = path.join(tempDir, 'missing.txt');

      expect(nodeIoAdapter.exists(filePath)).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file contents as UTF-8', () => {
      const filePath = path.join(tempDir, 'file.txt');
      fs.writeFileSync(filePath, 'test content', 'utf8');

      const content = nodeIoAdapter.readFile(filePath);

      expect(content).toBe('test content');
    });

    it('should throw when reading non-existent file', () => {
      const filePath = path.join(tempDir, 'missing.txt');

      expect(() => nodeIoAdapter.readFile(filePath)).toThrow();
    });
  });

  describe('writeFile', () => {
    it('should write file contents as UTF-8', () => {
      const filePath = path.join(tempDir, 'output.txt');

      nodeIoAdapter.writeFile(filePath, 'new content');

      expect(fs.readFileSync(filePath, 'utf8')).toBe('new content');
    });

    it('should create parent directories when they do not exist', () => {
      const filePath = path.join(tempDir, 'nested', 'deep', 'file.txt');

      nodeIoAdapter.writeFile(filePath, 'nested content');

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe('nested content');
    });

    it('should overwrite existing files', () => {
      const filePath = path.join(tempDir, 'existing.txt');
      fs.writeFileSync(filePath, 'old content', 'utf8');

      nodeIoAdapter.writeFile(filePath, 'updated content');

      expect(fs.readFileSync(filePath, 'utf8')).toBe('updated content');
    });
  });
});

describe('MemoryIoAdapter', () => {
  describe('constructor', () => {
    it('should initialize with empty files when no initial files provided', () => {
      const adapter = new MemoryIoAdapter();

      expect(adapter.getFiles().size).toBe(0);
    });

    it('should initialize with object of initial files', () => {
      const adapter = new MemoryIoAdapter({
        '/file1.ts': 'content1',
        '/file2.ts': 'content2',
      });

      expect(adapter.getFiles().size).toBe(2);
      expect(adapter.readFile('/file1.ts')).toBe('content1');
      expect(adapter.readFile('/file2.ts')).toBe('content2');
    });

    it('should initialize with Map of initial files', () => {
      const initialFiles = new Map<string, string>([
        ['/map-file1.ts', 'map-content1'],
        ['/map-file2.ts', 'map-content2'],
      ]);
      const adapter = new MemoryIoAdapter(initialFiles);

      expect(adapter.getFiles().size).toBe(2);
      expect(adapter.readFile('/map-file1.ts')).toBe('map-content1');
      expect(adapter.readFile('/map-file2.ts')).toBe('map-content2');
    });
  });

  describe('exists', () => {
    it('should return true for files that exist in memory', () => {
      const adapter = new MemoryIoAdapter({ '/exists.ts': 'content' });

      expect(adapter.exists('/exists.ts')).toBe(true);
    });

    it('should return false for files that do not exist in memory', () => {
      const adapter = new MemoryIoAdapter();

      expect(adapter.exists('/missing.ts')).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file contents from memory', () => {
      const adapter = new MemoryIoAdapter({ '/file.ts': 'memory content' });

      const content = adapter.readFile('/file.ts');

      expect(content).toBe('memory content');
    });

    it('should throw error when reading non-existent file', () => {
      const adapter = new MemoryIoAdapter();

      expect(() => adapter.readFile('/missing.ts')).toThrow('File not found: /missing.ts');
    });
  });

  describe('writeFile', () => {
    it('should write file contents to memory', () => {
      const adapter = new MemoryIoAdapter();

      adapter.writeFile('/new.ts', 'new content');

      expect(adapter.readFile('/new.ts')).toBe('new content');
    });

    it('should overwrite existing files in memory', () => {
      const adapter = new MemoryIoAdapter({ '/existing.ts': 'old' });

      adapter.writeFile('/existing.ts', 'updated');

      expect(adapter.readFile('/existing.ts')).toBe('updated');
    });
  });

  describe('getFiles', () => {
    it('should return readonly map of stored files', () => {
      const adapter = new MemoryIoAdapter({
        '/file1.ts': 'content1',
        '/file2.ts': 'content2',
      });

      const files = adapter.getFiles();

      expect(files.size).toBe(2);
      expect(files.get('/file1.ts')).toBe('content1');
      expect(files.get('/file2.ts')).toBe('content2');
    });

    it('should reflect changes after writeFile', () => {
      const adapter = new MemoryIoAdapter();

      adapter.writeFile('/dynamic.ts', 'dynamic content');
      const files = adapter.getFiles();

      expect(files.size).toBe(1);
      expect(files.get('/dynamic.ts')).toBe('dynamic content');
    });
  });
});

describe('createMemoryIoAdapter', () => {
  it('should create a new MemoryIoAdapter instance with no initial files', () => {
    const adapter = createMemoryIoAdapter();

    expect(adapter).toBeInstanceOf(MemoryIoAdapter);
    expect(adapter.getFiles().size).toBe(0);
  });

  it('should create a new MemoryIoAdapter instance with initial files from object', () => {
    const adapter = createMemoryIoAdapter({
      '/file.ts': 'content',
    });

    expect(adapter).toBeInstanceOf(MemoryIoAdapter);
    expect(adapter.readFile('/file.ts')).toBe('content');
  });

  it('should create a new MemoryIoAdapter instance with initial files from Map', () => {
    const initialFiles = new Map([
      ['/map-file.ts', 'map-content'],
    ]);
    const adapter = createMemoryIoAdapter(initialFiles);

    expect(adapter).toBeInstanceOf(MemoryIoAdapter);
    expect(adapter.readFile('/map-file.ts')).toBe('map-content');
  });
});
