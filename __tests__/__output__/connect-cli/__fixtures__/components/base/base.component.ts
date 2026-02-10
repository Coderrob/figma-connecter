const property = (_options?: unknown) => () => undefined;

class BaseComponent {
  static register(_tag: string): void {}
}

export default class Button extends BaseComponent {
  @property({ type: Boolean, reflect: true })
  expanded = false;

  @property({ type: String, attribute: 'header-text' })
  headerText?: string;
}
