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

import type { ComponentModel, EmitResult, EmitterOptions, EmitterTarget } from '../core/types';

/**
 * Context for emitter operations, containing model and emitter options.
 */
export interface EmitterContext {
  readonly model: ComponentModel;
  readonly options: EmitterOptions;
}

/**
 * Emitters transform a component model into a file payload.
 */
export interface Emitter {
  readonly target: EmitterTarget;
  emit(emitterContext: EmitterContext): EmitResult;
}

/**
 * Result type for emitter operations.
 */
export type EmitterResult = EmitResult;
