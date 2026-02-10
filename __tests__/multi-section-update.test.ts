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

import { GeneratedSectionName, GeneratedSectionPayload } from '../src/core/types';
import { applyGeneratedSectionUpdates } from '../src/io/section-updater';

describe('applyGeneratedSectionUpdates', () => {
  it('should handle multiple sequential section updates correctly', () => {
    const originalContent = `import { AlertChip } from '@momentum-design/components/dist/react';
import figma from '@figma/code-connect';

figma.connect('<FIGMA_ALERTCHIP_URL>', {
  // BEGIN GENERATED: props
  props: {
    disabled: figma.boolean('Disabled'),
  },
  // END GENERATED: props
  // BEGIN GENERATED: example
  example: props => {
    return <AlertChip {...props} />;
  },
  // END GENERATED: example
});
`;

    const sections: GeneratedSectionPayload[] = [
      {
        name: GeneratedSectionName.Props,
        content: `  props: {
    disabled: figma.boolean('Disabled'),
    label: figma.string('Label'),
  },`,
        markers: {
          start: '// BEGIN GENERATED: props',
          end: '// END GENERATED: props',
        },
      },
      {
        name: GeneratedSectionName.Example,
        content: `  example: props => {
    return <AlertChip label="Updated" {...props} />;
  },`,
        markers: {
          start: '// BEGIN GENERATED: example',
          end: '// END GENERATED: example',
        },
      },
    ];

    const result = applyGeneratedSectionUpdates(originalContent, sections);

    expect(result).not.toBeNull();
    expect(result).toContain("label: figma.string('Label')");
    expect(result).toContain('return <AlertChip label="Updated" {...props} />');
    expect(result).not.toContain('// END GENERATED: props  // BEGIN GENERATED: example');
    expect(result).not.toContain('// END GENERATED: props  example:');

    // Verify markers are on separate lines
    const lines = result!.split('\n');
    const endPropsLine = lines.findIndex((line) => line.trim() === '// END GENERATED: props');
    const beginExampleLine = lines.findIndex((line) => line.trim() === '// BEGIN GENERATED: example');

    expect(endPropsLine).toBeGreaterThan(-1);
    expect(beginExampleLine).toBeGreaterThan(-1);
    expect(beginExampleLine).toBe(endPropsLine + 1);
  });
});
