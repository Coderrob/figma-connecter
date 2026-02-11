// @ts-ignore
import figma, { html } from '@figma/code-connect/html';

figma.connect('<FIGMA_BASE_URL>', {
  // BEGIN GENERATED: props
  props: {
    expanded: figma.boolean('Expanded'),
    headerText: figma.string('Header Text'),
  },
  // END GENERATED: props
  // BEGIN GENERATED: example
  example: props => html`<mdc-base
    ?expanded=${props.expanded}
    header-text="${props.headerText}"
  ></mdc-base>`,
  // END GENERATED: example
  imports: ["import '@momentum-design/components/base';"],
});
