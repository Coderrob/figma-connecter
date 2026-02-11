// @ts-ignore
import figma, { html } from '@figma/code-connect/html';

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
  example: props => html`<my-variants
    count="${props.count}"
    ?disabled=${props.disabled}
    label="${props.label}"
    options="${props.options}"
    variant="${props.variant}"
  ></my-variants>`,
  // END GENERATED: example
  imports: ["import '@momentum-design/components/variants';"],
});
