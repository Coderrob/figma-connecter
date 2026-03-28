import type { IResult } from "@/src/core/result";
import type {
  IExtractionResult,
  IComponentModel,
  IClassSource,
  ITagNameResult,
  TagNameSource,
  IEventDescriptor,
} from "@/src/core/types";
import type { IASTVisitorResult } from "@/src/parsers/webcomponent/ast-visitor";
import type ts from "typescript";

export interface ITagNameResolution {
  readonly tagName: string;
  readonly source: TagNameSource;
  readonly warnings: readonly string[];
}

export interface ITagNameResolverOptions {
  readonly classDeclaration?: ts.ClassDeclaration;
  readonly componentDir: string;
  readonly componentFilePath: string;
  readonly className?: string;
  readonly astData?: IASTVisitorResult;
}

export interface IWebComponentParseResult extends IResult<
  IComponentModel | undefined
> {
  readonly classSource?: IClassSource;
  readonly tagNameResult?: ITagNameResult;
}

export interface IInheritanceResolution {
  readonly chain: readonly ts.ClassLikeDeclaration[];
  readonly warnings: readonly string[];
  readonly unresolved: readonly string[];
}

export interface IInheritanceContext {
  readonly checker: ts.TypeChecker;
  readonly strict?: boolean;
}

export type EventExtractionResult = IExtractionResult<IEventDescriptor>;

export interface IEventExtractionContext {
  readonly astData: IASTVisitorResult;
}
