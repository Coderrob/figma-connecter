#!/usr/bin/env node

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
 * CLI Entry Point
 *
 * This is the executable entry point for the figma-connecter CLI tool.
 * It bootstraps the CLI application and handles top-level errors.
 */

import { run } from '../src/cli';

run().catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
