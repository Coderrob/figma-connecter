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
 * Web Component Parser Index
 *
 * Re-exports parser implementation and supporting utilities.
 *
 * @module parsers/webcomponent
 */

export { parseWebComponent, WebComponentParser } from "./parser";

export { discoverComponentClass } from "./component-discovery";
export { extractPropertyDecorators } from "./decorator-extractor";
export { extractEvents, extractEventsFromChain } from "./event-extractor";
export { resolveInheritanceChain } from "./inheritance-resolver";
export { resolveTagName } from "./tagname-resolver";
