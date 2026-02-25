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
 * @fileoverview Tests for path utilities.
 */

import path from 'node:path';

import {
  buildCodeConnectFilePath,
  normalizedBasename,
  normalizePath,
  resolveDistReactImportPath,
} from '../../src/utils/paths';

describe('normalizePath', () => {
  it('should return empty string for empty input', () => {
    expect(normalizePath('')).toBe('');
  });

  it('should normalize to absolute POSIX path', () => {
    const input = path.join('some', 'dir', 'file.ts');
    const normalized = normalizePath(input);

    expect(normalized).toContain('/');
    expect(normalized).not.toContain('\\');
    expect(normalized).toContain('some/dir/file.ts');
  });
});

describe('normalizedBasename', () => {
  it('should return the last path segment', () => {
    expect(normalizedBasename('/src/components/button')).toBe('button');
  });

  it('should return the file name for a file path', () => {
    expect(normalizedBasename('/src/components/button/button.component.ts')).toBe(
      'button.component.ts',
    );
  });

  it('should handle paths with backslashes', () => {
    const result = normalizedBasename('src\\components\\button');
    expect(result).toBe('button');
  });
});

describe('buildCodeConnectFilePath', () => {
  it('should build code-connect output path', () => {
    const result = buildCodeConnectFilePath(
      '/src/components/button',
      'button.react.figma.tsx',
    );
    expect(result).toBe('/src/components/button/code-connect/button.react.figma.tsx');
  });

  it('should normalise backslashes in the component dir', () => {
    const result = buildCodeConnectFilePath(
      'src\\components\\button',
      'button.webcomponent.figma.ts',
    );
    expect(result).toContain('code-connect/button.webcomponent.figma.ts');
    expect(result).not.toContain('\\');
  });
});

describe('resolveDistReactImportPath', () => {
  it('should resolve relative path from code-connect to dist/react', () => {
    const result = resolveDistReactImportPath(
      '/packages/components/src/components/button',
    );
    expect(result).toBe('../../../../dist/react');
  });

  it('should prefix with ./ when there is no src/ marker', () => {
    const result = resolveDistReactImportPath('/button');
    expect(result.startsWith('../') || result.startsWith('./')).toBe(true);
    expect(result).toContain('dist/react');
  });

  it('should always return a path that starts with . or ..', () => {
    const result = resolveDistReactImportPath('/src/components/button');
    expect(result.startsWith('.') || result.startsWith('../')).toBe(true);
  });
});
