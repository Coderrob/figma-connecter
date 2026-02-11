import { Button } from '@momentum-design/components/dist/react';
import figma from '@figma/code-connect';

figma.connect('<FIGMA_BUTTON_URL>', {
  // BEGIN GENERATED: props
  props: {
    ariaLabel: figma.string('Aria Label'),
    expanded: figma.boolean('Expanded'),
    headerText: figma.string('Header Text'),
  },
  // END GENERATED: props
  // BEGIN GENERATED: example
  example: props => {
    return <Button {...props} />;
  },
  // END GENERATED: example
});
