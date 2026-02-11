import { Button } from '@momentum-design/components/dist/react';
import figma from '@figma/code-connect';

figma.connect('<FIGMA_BASE_URL>', {
  // BEGIN GENERATED: props
  props: {
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
