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
 * @fileoverview Shared test fixtures for figma-connecter tests.
 * Provides factory functions for creating test data with sensible defaults.
 */

import ts from 'typescript';

import type { IConnectCommandOptions } from '../../src/commands/connect/types';
import {
  type IAttributeDescriptor,
  type IComponentModel,
  type IConnectOptions,
  type IEmitterOptions,
  type EmitterTarget,
  type IEventDescriptor,
  FigmaPropertyType,
  type IGenerationReport,
  GenerationStatus,
  type IPropertyDescriptor,
  PropertyVisibility,
} from '../../src/core/types';
import { createMemoryIoAdapter } from '../../src/io/adapter';
import type { IPipelineContext } from '../../src/pipeline/context';

/**
 * Creates a mock IPropertyDescriptor with default values.
 * @param overrides - Partial property values to override defaults.
 */
export const createMockProperty = (overrides: Partial<IPropertyDescriptor> = {}): IPropertyDescriptor => ({
  name: 'testProperty',
  attribute: 'test-property',
  type: FigmaPropertyType.String,
  tsType: 'string',
  reflect: false,
  defaultValue: null,
  doc: null,
  visibility: PropertyVisibility.Public,
  ...overrides,
});

/**
 * Creates a mock IAttributeDescriptor with default values.
 * @param overrides - Partial attribute values to override defaults.
 */
export const createMockAttribute = (overrides: Partial<IAttributeDescriptor> = {}): IAttributeDescriptor => ({
  name: 'test-attribute',
  propertyName: 'testAttribute',
  type: FigmaPropertyType.String,
  reflect: false,
  defaultValue: null,
  doc: null,
  ...overrides,
});

/**
 * Creates a mock IEventDescriptor with default values.
 * @param overrides - Partial event values to override defaults.
 */
export const createMockEvent = (overrides?: Partial<IEventDescriptor>): IEventDescriptor => ({
  name: 'test-event',
  reactHandler: 'onTestEvent',
  detailType: null,
  ...overrides,
});

/**
 * Creates a mock IComponentModel with default values.
 * @param overrides - Partial component values to override defaults.
 */
export const createMockComponentModel = (overrides?: Partial<IComponentModel>): IComponentModel => ({
  className: 'TestComponent',
  tagName: 'my-test',
  filePath: '/test/components/test.component.ts',
  componentDir: '/test/components',
  props: [],
  attributes: [],
  events: [],
  importPath: '@test/components',
  ...overrides,
});

/**
 * Creates a mock IConnectOptions with default values.
 * @param overrides - Partial options to override defaults.
 */
export const createMockConnectOptions = (overrides?: Partial<IConnectOptions>): IConnectOptions => ({
  inputPath: '/test/components',
  recursive: false,
  dryRun: false,
  force: false,
  emitTargets: ['webcomponent'] as unknown as EmitterTarget[],
  strict: false,
  ...overrides,
});

/**
 * Creates an empty IGenerationReport for testing.
 */
export const createMockReport = (): IGenerationReport => ({
  status: GenerationStatus.Success,
  created: [],
  updated: [],
  unchanged: [],
  warnings: [],
  errors: [],
  durationMs: 0,
});

/**
 * Sample TypeScript source code for a minimal Web Component.
 */
export const MINIMAL_COMPONENT_SOURCE = `
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('my-minimal')
export class MinimalComponent extends LitElement {
  render() {
    return html\`<slot></slot>\`;
  }
}
`;

/**
 * Sample TypeScript source code for a Web Component with properties.
 */
export const COMPONENT_WITH_PROPS_SOURCE = `
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * A test component with properties.
 * @tagname my-with-props
 */
@customElement('my-with-props')
export class ComponentWithProps extends LitElement {
  /**
   * The label text displayed in the component.
   */
  @property({ type: String })
  label: string = '';

  /**
   * Whether the component is disabled.
   */
  @property({ type: Boolean, reflect: true })
  disabled: boolean = false;

  /**
   * The numeric value.
   */
  @property({ type: Number })
  value: number = 0;

  render() {
    return html\`<span>\${this.label}</span>\`;
  }
}
`;

/**
 * Sample TypeScript source code for a Web Component with events.
 */
export const COMPONENT_WITH_EVENTS_SOURCE = `
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-with-events')
export class ComponentWithEvents extends LitElement {
  @property({ type: Boolean })
  checked: boolean = false;

  /**
   * Fired when the checked state changes.
   * @event change
   */
  private handleClick() {
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { checked: this.checked },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html\`<button @click=\${this.handleClick}>Toggle</button>\`;
  }
}
`;

/**
 * Sample TypeScript source code for a Web Component with inheritance.
 */
export const COMPONENT_WITH_INHERITANCE_SOURCE = `
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export class BaseComponent extends LitElement {
  @property({ type: String })
  baseProperty: string = '';
}

@customElement('my-child')
export class ChildComponent extends BaseComponent {
  @property({ type: String })
  childProperty: string = '';

  render() {
    return html\`<div>\${this.baseProperty} \${this.childProperty}</div>\`;
  }
}
`;

/**
 * Sample TypeScript source code for a Web Component with mixins.
 */
export const COMPONENT_WITH_MIXINS_SOURCE = `
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

type Constructor<T = {}> = new (...args: any[]) => T;

function DisabledMixin<T extends Constructor<LitElement>>(Base: T) {
  return class extends Base {
    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;
  };
}

@customElement('my-with-mixin')
export class ComponentWithMixin extends DisabledMixin(LitElement) {
  @property({ type: String })
  label: string = '';

  render() {
    return html\`<button ?disabled=\${this.disabled}>\${this.label}</button>\`;
  }
}
`;

/**
 * Creates a mock IEmitterOptions with default values.
 * @param overrides - Partial options to override defaults.
 */
export const createMockEmitterOptions = (overrides?: Partial<IEmitterOptions>): IEmitterOptions => ({
  dryRun: false,
  baseImportPath: undefined,
  ...overrides,
});

/**
 * Creates a mock IConnectCommandOptions with default values.
 * @param overrides - Partial options to override defaults.
 */
export const createMockConnectCommandOptions = (overrides?: Partial<IConnectCommandOptions>): IConnectCommandOptions => ({
  path: './components',
  recursive: false,
  dryRun: false,
  emit: 'webcomponent',
  strict: false,
  continueOnError: false,
  ...overrides,
});

/**
 * Creates TypeScript compiler options with sensible defaults for testing.
 * @param overrides - Partial options to override defaults.
 */
export const createMockCompilerOptions = (overrides?: Partial<ts.CompilerOptions>): ts.CompilerOptions => ({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  experimentalDecorators: true,
  noLib: true,
  ...overrides,
});

/**
 * Creates a TypeScript source file from source code for testing.
 * @param source - Source code string.
 * @param fileName - Optional file name (defaults to 'test.ts').
 * @param compilerOptions - Optional compiler options.
 */
export const createMockSourceFile = (
  source: string,
  fileName?: string,
  compilerOptions?: ts.CompilerOptions,
): ts.SourceFile => {
  const resolvedFileName = fileName ?? 'test.ts';
  const options = createMockCompilerOptions(compilerOptions);

  const sourceFile = ts.createSourceFile(
    resolvedFileName,
    source,
    options.target ?? ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );

  const host = ts.createCompilerHost(options, true);
  host.getSourceFile = (requestedFileName) => (requestedFileName === resolvedFileName ? sourceFile : undefined);
  host.fileExists = (requestedFileName) => requestedFileName === resolvedFileName;
  host.readFile = (requestedFileName) => (requestedFileName === resolvedFileName ? source : undefined);
  host.getDefaultLibFileName = () => 'lib.d.ts';

  const program = ts.createProgram([resolvedFileName], options, host);

  return program.getSourceFile(resolvedFileName) ?? sourceFile;
};

/**
 * Creates a TypeScript program with source file and type checker for testing.
 * @param source - Source code string.
 * @param fileName - Optional file name (defaults to 'test.ts').
 * @param compilerOptions - Optional compiler options.
 */
export const createMockProgram = (
  source: string,
  fileName?: string,
  compilerOptions?: ts.CompilerOptions,
): { program: ts.Program; sourceFile: ts.SourceFile; checker: ts.TypeChecker } => {
  const resolvedFileName = fileName ?? 'test.ts';
  const options = createMockCompilerOptions(compilerOptions);

  const sourceFile = ts.createSourceFile(
    resolvedFileName,
    source,
    options.target ?? ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );

  const host = ts.createCompilerHost(options, true);
  host.getSourceFile = (requestedFileName) => (requestedFileName === resolvedFileName ? sourceFile : undefined);
  host.fileExists = (requestedFileName) => requestedFileName === resolvedFileName;
  host.readFile = (requestedFileName) => (requestedFileName === resolvedFileName ? source : undefined);
  host.getDefaultLibFileName = () => 'lib.d.ts';

  const program = ts.createProgram([resolvedFileName], options, host);

  return {
    program,
    sourceFile: program.getSourceFile(resolvedFileName) ?? sourceFile,
    checker: program.getTypeChecker(),
  };
};

/**
 * Creates a mock IPipelineContext with default values.
 * @param overrides - Partial context to override defaults.
 */
export const createMockPipelineContext = (overrides?: Partial<IPipelineContext>): IPipelineContext => ({
  checker: {} as ts.TypeChecker,
  emitters: [],
  parser: {} as any,
  dryRun: false,
  strict: false,
  force: false,
  sourceFileMap: new Map(),
  continueOnError: false,
  io: createMemoryIoAdapter(),
  ...overrides,
});
