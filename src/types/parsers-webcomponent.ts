import type ts from "typescript";
import type { Result } from "../core/result";
import type {
  ExtractionResult,
  ComponentModel,
  ClassSource,
  TagNameResult,
  EventDescriptor,
} from "../core/types";

export interface TagNameResolution {
  readonly tagName: string;
  readonly source: import("../core/types").TagNameSource;
  readonly warnings: readonly string[];
}

export interface TagNameResolverOptions {
  readonly classDeclaration?: ts.ClassDeclaration;
  readonly componentDir: string;
  readonly componentFilePath: string;
  readonly className?: string;
  readonly astData?: import("../parsers/webcomponent/ast-visitor").ASTVisitorResult;
}

export interface WebComponentParseResult extends Result<
  ComponentModel | undefined
> {
  readonly classSource?: ClassSource;
  readonly tagNameResult?: TagNameResult;
}

export interface InheritanceResolution {
  readonly chain: readonly ts.ClassLikeDeclaration[];
  readonly warnings: readonly string[];
  readonly unresolved: readonly string[];
}

export interface InheritanceContext {
  readonly checker: ts.TypeChecker;
  readonly strict?: boolean;
}

export type EventExtractionResult = ExtractionResult<EventDescriptor>;

export interface EventExtractionContext {
  readonly astData: import("../parsers/webcomponent/ast-visitor").ASTVisitorResult;
}
