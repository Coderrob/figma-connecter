// @ts-ignore
import figma, { html } from '@figma/code-connect/html';

figma.connect('<FIGMA_STANDALONE_URL>', {
  // BEGIN GENERATED: props
  props: {},
  // END GENERATED: props
  // BEGIN GENERATED: example
  example: () => html`<mdc-standalone></mdc-standalone>`,
  // END GENERATED: example
  imports: ["import '@momentum-design/components/standalone';"],
});
