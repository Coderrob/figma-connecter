const DEFAULT_IGNORE_CLASS_NAMES = [];

function getClassName(node) {
  if (node.id && node.id.type === 'Identifier') {
    return node.id.name;
  }
  return 'AnonymousClass';
}

function hasImplements(node) {
  return Array.isArray(node.implements) && node.implements.length > 0;
}

function shouldSkipClass(node, ignoredClassNames, checkAbstract) {
  if (!checkAbstract && node.abstract === true) {
    return true;
  }

  const className = getClassName(node);
  return ignoredClassNames.has(className);
}

const requireClassImplementsInterfaceRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require class definitions to implement at least one interface to enforce interface-driven design.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          checkAbstract: { type: 'boolean' },
          ignoreClassNames: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingImplements:
        'Class "{{name}}" must implement at least one interface (for example, `implements I{{name}}`).',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const checkAbstract = options.checkAbstract === true;
    const ignoredClassNames = new Set(options.ignoreClassNames ?? DEFAULT_IGNORE_CLASS_NAMES);

    return {
      ClassDeclaration(node) {
        if (shouldSkipClass(node, ignoredClassNames, checkAbstract)) {
          return;
        }

        if (!hasImplements(node)) {
          context.report({
            data: { name: getClassName(node) },
            messageId: 'missingImplements',
            node: node.id ?? node,
          });
        }
      },
      ClassExpression(node) {
        if (shouldSkipClass(node, ignoredClassNames, checkAbstract)) {
          return;
        }

        if (!hasImplements(node)) {
          context.report({
            data: { name: getClassName(node) },
            messageId: 'missingImplements',
            node: node.id ?? node,
          });
        }
      },
    };
  },
};

export default requireClassImplementsInterfaceRule;
