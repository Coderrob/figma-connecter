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
 * @fileoverview Tests for tag name resolution.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import ts from "typescript";

import { resolveTagName } from "../../../src/parsers/webcomponent/tagname-resolver";

describe("resolveTagName", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should resolve tag name from JSDoc @tagname", () => {
    const source = `
      /**
       * @tagname my-jsdoc
       */
      export class JSDocComponent {}
    `;
    const sourceFile = ts.createSourceFile(
      "component.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const classDeclaration = sourceFile.statements.find(ts.isClassDeclaration);
    const result = resolveTagName({
      classDeclaration,
      componentDir: "/tmp/jsdoc",
      componentFilePath: "/tmp/jsdoc/component.component.ts",
      className: "JSDocComponent",
    });

    expect(result.tagName).toBe("my-jsdoc");
    expect(result.source).toBe("jsdoc");
  });

  it("should resolve tag name via register() with re-exported constants", () => {
    const componentDir = "/components/widget";
    const indexPath = path.resolve(path.join(componentDir, "index.ts"));
    const constantsPath = path.resolve(path.join(componentDir, "constants.ts"));
    const widgetConstantsPath = path.resolve(
      path.join(componentDir, "widget.constants.ts"),
    );
    const namespaceConstantsPath = path.resolve(
      componentDir,
      "../../utils/tag-name/constants.ts",
    );

    const fileMap = new Map<string, string>([
      [
        indexPath,
        `
        import Widget from './widget.component';
        import { TAG_NAME } from './constants';
        Widget.register(TAG_NAME);
        `,
      ],
      [
        constantsPath,
        `
        export { TAG_NAME } from './widget.constants';
        `,
      ],
      [
        widgetConstantsPath,
        `
        import utils from '../../utils/tag-name';
        export const TAG_NAME = utils.constructTagName('widget');
        `,
      ],
      [
        namespaceConstantsPath,
        `
        const NAMESPACE = {
          PREFIX: 'mdc',
          SEPARATOR: '-',
        };
        export default { NAMESPACE };
        `,
      ],
    ]);

    jest
      .spyOn(fs, "existsSync")
      .mockImplementation((p: fs.PathLike) =>
        fileMap.has(path.resolve(p.toString())),
      );
    jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((p: fs.PathOrFileDescriptor) => {
        const key = path.resolve(p.toString());
        const contents = fileMap.get(key);
        if (!contents) {
          throw new Error(`Missing mock for ${key}`);
        }
        return contents;
      });

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "widget.component.ts"),
      className: "Widget",
    });

    expect(result.tagName).toBe("mdc-widget");
    expect(result.source).toBe("index-ts");
  });

  it("should resolve tag name from constants fallback when ./constants.ts is missing", () => {
    const componentDir = "/components/fallback";
    const indexPath = path.resolve(path.join(componentDir, "index.ts"));
    const fallbackConstantsPath = path.resolve(
      path.join(componentDir, "fallback.constants.ts"),
    );
    const namespaceConstantsPath = path.resolve(
      componentDir,
      "../../utils/tag-name/constants.ts",
    );

    const fileMap = new Map<string, string>([
      [
        indexPath,
        `
        import Fallback from './fallback.component';
        import { TAG_NAME } from './constants';
        Fallback.register(TAG_NAME);
        `,
      ],
      [
        fallbackConstantsPath,
        `
        import utils from '../../utils/tag-name';
        export const TAG_NAME = utils.constructTagName('fallback');
        `,
      ],
      [
        namespaceConstantsPath,
        `
        const NAMESPACE = {
          PREFIX: 'mdc',
          SEPARATOR: '-',
        };
        export default { NAMESPACE };
        `,
      ],
    ]);

    jest
      .spyOn(fs, "existsSync")
      .mockImplementation((p: fs.PathLike) =>
        fileMap.has(path.resolve(p.toString())),
      );
    jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((p: fs.PathOrFileDescriptor) => {
        const key = path.resolve(p.toString());
        const contents = fileMap.get(key);
        if (!contents) {
          throw new Error(`Missing mock for ${key}`);
        }
        return contents;
      });

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "fallback.component.ts"),
      className: "Fallback",
    });

    expect(result.tagName).toBe("mdc-fallback");
    expect(result.source).toBe("index-ts");
  });

  it("should fall back to filename when no tag name hints exist", () => {
    const result = resolveTagName({
      componentDir: "/tmp/unknown",
      componentFilePath: "/tmp/unknown/example.component.ts",
      className: "Example",
    });

    expect(result.tagName).toBe("example");
    expect(result.source).toBe("filename");
  });

  it("should resolve tag names for button fixture component", () => {
    const fixtureDir = path.resolve(
      __dirname,
      "../../../__fixtures__/components/button",
    );

    const buttonResult = resolveTagName({
      componentDir: fixtureDir,
      componentFilePath: path.join(fixtureDir, "button.component.ts"),
      className: "Button",
    });

    expect(buttonResult.tagName).toBe("mdc-button");
    expect(buttonResult.source).toBe("index-ts");
  });

  it("should resolve tag name from aliased constants", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "alias");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import AliasComponent from './alias.component';
        import { TAG_NAME as COMPONENT_TAG } from './constants';
        AliasComponent.register(COMPONENT_TAG);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export const TAG_NAME = 'my-alias';",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "alias.component.ts"),
      className: "AliasComponent",
    });

    expect(result.tagName).toBe("my-alias");
    expect(result.source).toBe("index-ts");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve constructTagName without namespace constants", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "widget");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Widget from './widget.component';
        import { TAG_NAME } from './constants';
        Widget.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      `
        export const TAG_NAME = constructTagName('Widget');
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "widget.component.ts"),
      className: "Widget",
    });

    expect(result.tagName).toBe("widget");
    expect(result.source).toBe("index-ts");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should fall back when tag name import is non-relative", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "nonrelative");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from '@scope/constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(result.source).toBe("filename");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should fall back when JSDoc tagname is empty", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const source = `
      /**
       * @tagname
       */
      export class EmptyTagComponent {}
    `;
    const sourceFile = ts.createSourceFile(
      "component.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const classDeclaration = sourceFile.statements.find(ts.isClassDeclaration);

    const result = resolveTagName({
      classDeclaration,
      componentDir: tempDir,
      componentFilePath: path.join(tempDir, "empty-tag.component.ts"),
      className: "EmptyTagComponent",
    });

    expect(result.tagName).toBe("empty-tag");
    expect(result.source).toBe("filename");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should read JSDoc tags with inline link content", () => {
    const source = `
      /**
       * @tagname my-link {@link Foo}
       */
      export class LinkComponent {}
    `;
    const sourceFile = ts.createSourceFile(
      "link.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const classDeclaration = sourceFile.statements.find(ts.isClassDeclaration);

    const result = resolveTagName({
      classDeclaration,
      componentDir: "/tmp/link",
      componentFilePath: "/tmp/link/link.component.ts",
      className: "LinkComponent",
    });

    expect(result.tagName).toContain("my-link");
    expect(result.source).toBe("jsdoc");
  });

  it("should warn when tag name identifier cannot be resolved", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "unresolved");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        const TAG_NAME = getTagName();
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Unable to resolve tag name identifier"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle missing files in tag name imports", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "missing");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './missing';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Unable to resolve tag name identifier"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve tag names from a single constants file fallback", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "singleton");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "only.constants.ts"),
      "export const TAG_NAME = 'my-only';",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("my-only");
    expect(result.source).toBe("index-ts");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve tag names through export chains and handle cycles", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "chain");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export { TAG_NAME } from './forward';",
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "forward.ts"),
      `
        export * from './final';
        export { OTHER } from './final';
        export { TAG_NAME } from './local';
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "final.ts"),
      "export { TAG_NAME } from './constants';",
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "local.ts"),
      `
        const INTERNAL = 'my-forward';
        export { INTERNAL as TAG_NAME };
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("my-forward");
    expect(result.source).toBe("index-ts");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve tag name from a literal register call", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "literal");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        Component.register('my-literal');
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("my-literal");
    expect(result.source).toBe("index-ts");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve tag names through export star re-exports", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "export-star");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export * from './values';",
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "values.ts"),
      "export const TAG_NAME = 'my-star';",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("my-star");
    expect(result.source).toBe("index-ts");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should warn when register receives unsupported expressions", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "unsupported");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        Component.register(getTagName());
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Unsupported register()"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should skip named exports that do not match the tag name", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "no-match");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export { OTHER } from './values';",
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "values.ts"),
      "export const OTHER = 'my-other';",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Unable to resolve tag name identifier"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should fall back when no register call exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "no-register");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      "export const value = 1;",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(result.source).toBe("filename");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should warn when register is missing a tag name argument", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "missing-arg");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        Component.register();
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("did not include a tag name argument"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should warn when tag name identifier is not declared or imported", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "missing-identifier");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Unable to resolve tag name identifier"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should ignore imports that do not include the tag name identifier", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "unmatched-import");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { OTHER } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      'export const OTHER = "my-other";',
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Unable to resolve tag name identifier"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should ignore non-string import specifiers", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "invalid-import");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from moduleName;
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should ignore namespace constants when separators are missing", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "namespace");
    const namespaceDir = path.resolve(componentDir, "../../utils/tag-name");
    fs.mkdirSync(componentDir, { recursive: true });
    fs.mkdirSync(namespaceDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      `
        import utils from '../../utils/tag-name';
        export const TAG_NAME = utils.constructTagName('Widget');
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(namespaceDir, "constants.ts"),
      "export const PREFIX = 'mdc';",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("widget");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve tag names from property access constructTagName calls", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "property-access");
    const namespaceDir = path.resolve(componentDir, "../../utils/tag-name");
    fs.mkdirSync(componentDir, { recursive: true });
    fs.mkdirSync(namespaceDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      `
        import utils from '../../utils/tag-name';
        export const TAG_NAME = utils.constructTagName('access');
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(namespaceDir, "constants.ts"),
      `
        export const PREFIX = 'mdc';
        export const SEPARATOR = '-';
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("access");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return null when constants directory scan fails", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "scan-fail");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    const readdirSpy = jest.spyOn(fs, "readdirSync").mockImplementation(() => {
      throw new Error("readdir failed");
    });

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    readdirSpy.mockRestore();

    expect(result.tagName).toBe("component");
    expect(result.source).toBe("filename");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should skip export declarations with non-string module specifiers", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "invalid-export");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export { TAG_NAME } from moduleName;",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve aliased export names from re-exports", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "alias-export");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      'export { INTERNAL as TAG_NAME } from "./values";',
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "values.ts"),
      'export const INTERNAL = "my-alias-export";',
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("my-alias-export");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should select the first register call when receiver is not an identifier", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "receiver-call");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        function getComponent() { return { register() {} }; }
        getComponent().register('my-receiver');
      `,
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "NonMatching",
    });

    expect(result.tagName).toBe("my-receiver");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should fall back to the first register call when className is missing", () => {
    const componentDir = "/components/no-classname";
    const indexPath = path.resolve(path.join(componentDir, "index.ts"));

    const fileMap = new Map<string, string>([
      [
        indexPath,
        `
        export class FirstComponent {}
        export class SecondComponent {}
        FirstComponent.register('my-first');
        SecondComponent.register('my-second');
        `,
      ],
    ]);

    jest
      .spyOn(fs, "existsSync")
      .mockImplementation((p: fs.PathLike) =>
        fileMap.has(path.resolve(p.toString())),
      );
    jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((p: fs.PathOrFileDescriptor) => {
        const key = path.resolve(p.toString());
        const contents = fileMap.get(key);
        if (!contents) {
          throw new Error(`Missing mock for ${key}`);
        }
        return contents;
      });

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
    });

    expect(result.tagName).toBe("my-first");
    expect(result.source).toBe("index-ts");
  });

  it("should return null when export target paths cannot be resolved", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "missing-export");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export { TAG_NAME } from './missing';",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Unable to resolve tag name identifier"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should handle export targets that cannot be read", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "unreadable-export");
    fs.mkdirSync(componentDir, { recursive: true });

    const constantsPath = path.join(componentDir, "constants.ts");
    const valuesPath = path.join(componentDir, "values.ts");

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      constantsPath,
      'export { TAG_NAME } from "./values";',
      "utf8",
    );
    fs.writeFileSync(
      valuesPath,
      'export const TAG_NAME = "my-unreadable";',
      "utf8",
    );

    const realReadFileSync = fs.readFileSync.bind(fs);
    const readSpy = jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((filePath) => {
        if (filePath.toString() === valuesPath) {
          throw new Error("read error");
        }
        return realReadFileSync(filePath.toString(), "utf8");
      });

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    readSpy.mockRestore();

    expect(result.tagName).toBe("component");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should ignore local exports that cannot be resolved", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "local-export");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export { TAG_NAME };",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should skip non-relative export module paths", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "non-relative-export");
    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(
      path.join(componentDir, "index.ts"),
      `
        import Component from './component.component';
        import { TAG_NAME } from './constants';
        Component.register(TAG_NAME);
      `,
      "utf8",
    );

    fs.writeFileSync(
      path.join(componentDir, "constants.ts"),
      "export { TAG_NAME } from '@scope/constants';",
      "utf8",
    );

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    expect(result.tagName).toBe("component");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should fall back when index file cannot be read", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-connecter-"));
    const componentDir = path.join(tempDir, "read-error");
    fs.mkdirSync(componentDir, { recursive: true });

    const indexPath = path.join(componentDir, "index.ts");
    fs.writeFileSync(
      indexPath,
      `
        import Component from './component.component';
        Component.register('my-read-error');
      `,
      "utf8",
    );

    const readFileSpy = jest
      .spyOn(fs, "readFileSync")
      .mockImplementation(() => {
        throw new Error("read error");
      });

    const result = resolveTagName({
      componentDir,
      componentFilePath: path.join(componentDir, "component.component.ts"),
      className: "Component",
    });

    readFileSpy.mockRestore();

    expect(result.tagName).toBe("component");
    expect(result.source).toBe("filename");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
