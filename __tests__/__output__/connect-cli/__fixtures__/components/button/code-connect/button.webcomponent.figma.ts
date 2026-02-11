// @ts-ignore
import figma, { html } from '@figma/code-connect/html';

figma.connect('<FIGMA_BUTTON_URL>', {
  // BEGIN GENERATED: props
  props: {
    ariaLabel: figma.string('Aria Label'),
    expanded: figma.boolean('Expanded'),
    headerText: figma.string('Header Text'),
  },
  // END GENERATED: props
  // BEGIN GENERATED: example
  example: props => html`<mdc-button
    aria-label="${props.ariaLabel}"
    ?expanded=${props.expanded}
    header-text="${props.headerText}"
  ></mdc-button>`,
  // END GENERATED: example
  imports: ["import '@momentum-design/components/button';"],
});
