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
 * Emitters Index
 *
 * Re-exports all emitter implementations and utilities.
 *
 * @module emitters
 */
export * from './types';

export type { EmitterFactoryOptions } from './factory';
export {
  createEmitter,
  createEmitters,
  getAllEmitterMetadata,
  getEmitterMetadata,
  listEmitterTargets,
} from './factory';
export * from './figma-react';
export * from './figma-webcomponent';
export type { Emitter, EmitterContext, EmitterResult } from './types';
