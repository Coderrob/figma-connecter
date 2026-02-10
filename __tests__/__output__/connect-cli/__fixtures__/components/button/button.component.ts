const property = (_options?: unknown) => () => undefined;

import BaseComponent from '../base/base.component';

export default class Button extends BaseComponent {
  @property({ type: String, attribute: 'aria-label', reflect: true })
  ariaLabel?: string;
}
