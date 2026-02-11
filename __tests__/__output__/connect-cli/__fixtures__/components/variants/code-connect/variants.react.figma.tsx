import { Variants } from '@momentum-design/components/dist/react';
import figma from '@figma/code-connect';

figma.connect('<FIGMA_VARIANTS_URL>', {
  // BEGIN GENERATED: props
  props: {
    count: figma.string('Count'),
    disabled: figma.boolean('Disabled'),
    label: figma.string('Label'),
    options: figma.string('Options'),
    variant: figma.enum('Variant', {
      'Primary': "primary",
      'Secondary': "secondary",
      'Tertiary': "tertiary",
    }),
  },
  // END GENERATED: props
  // BEGIN GENERATED: example
  example: props => {
    return <Variants {...props} />;
  },
  // END GENERATED: example
});
