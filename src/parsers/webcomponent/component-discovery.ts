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

import ts from 'typescript';

import { ClassDiscoveryMethod } from '../../core/types';
import type { ClassSource } from '../../core/types';

import type { ASTVisitorResult } from './ast-visitor';

export interface ComponentDiscoveryResult {
  readonly classDeclaration: ts.ClassDeclaration;
  readonly source: ClassSource;
}

/**
 * Checks whether a class declaration is a default export.
 *
 * @param node - Class declaration to inspect.
 * @returns True when the class is exported as default.
 */
const isDefaultExportedClass = (node: ts.ClassDeclaration): boolean => {
  const modifiers = node.modifiers ?? [];
  const hasDefault = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  const hasExport = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  return hasDefault && hasExport;
};

/**
 * Discovers the primary component class from pre-collected AST data.
 *
 * @param astData - Pre-collected AST data from unified visitor.
 * @returns Discovery result or null when no class is found.
 */
export const discoverComponentClass = (astData: ASTVisitorResult): ComponentDiscoveryResult | null => {
  const classes = astData.classDeclarations;
  if (classes.length === 0) {
    return null;
  }

  // Check for default exported class
  const directDefault = classes.find(isDefaultExportedClass);
  if (directDefault) {
    return {
      classDeclaration: directDefault,
      source: {
        discoveryMethod: ClassDiscoveryMethod.DefaultExport,
        filePath: '',
      },
    };
  }

  // Check for named export assigned as default
  const { defaultExport } = astData;
  const statement = defaultExport ? ({ expression: defaultExport } as ts.ExportAssignment) : undefined;

  if (statement && ts.isIdentifier(statement.expression)) {
    const exportName = statement.expression.text;
    const matched = classes.find((node) => node.name?.text === exportName);
    if (matched) {
      return {
        classDeclaration: matched,
        source: {
          discoveryMethod: ClassDiscoveryMethod.DefaultExport,
          filePath: '',
        },
      };
    }
  }

  // Use pre-collected decorators and JSDoc tags
  const customElement = classes.find((node) => {
    const decorators = astData.classDecorators.get(node) ?? [];
    return decorators.some((decorator) => {
      if (!ts.isCallExpression(decorator.expression)) {
        return false;
      }
      const expr = decorator.expression.expression;
      if (ts.isIdentifier(expr)) {
        return expr.text === 'customElement';
      }
      if (ts.isPropertyAccessExpression(expr)) {
        return expr.name.text === 'customElement';
      }
      return false;
    });
  });
  if (customElement) {
    return {
      classDeclaration: customElement,
      source: {
        discoveryMethod: ClassDiscoveryMethod.CustomElement,
        filePath: '',
      },
    };
  }

  const jsdocTagged = classes.find((node) => {
    const tags = astData.classJSDocTags.get(node) ?? [];
    return tags.some((tag) => tag.tagName.text === 'tagname');
  });
  if (jsdocTagged) {
    return {
      classDeclaration: jsdocTagged,
      source: {
        discoveryMethod: ClassDiscoveryMethod.TagnameJSDoc,
        filePath: '',
      },
    };
  }

  return {
    classDeclaration: classes[0],
    source: {
      discoveryMethod: ClassDiscoveryMethod.FirstClass,
      filePath: '',
    },
  };
};
