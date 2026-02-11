const IT_IDENTIFIER = 'it';
const EACH_PROPERTY = 'each';
const MODIFIER_PROPERTIES = new Set(['only', 'skip', 'todo', 'concurrent']);

const UNWRAP_TYPES = new Set(['ChainExpression', 'ParenthesizedExpression']);

function unwrapExpression(node) {
  let current = node;
  while (current && UNWRAP_TYPES.has(current.type)) {
    current = current.expression;
  }
  return current;
}

function getMemberChain(node) {
  const props = [];
  let current = unwrapExpression(node);
  while (current && current.type === 'MemberExpression' && !current.computed) {
    if (current.property?.type !== 'Identifier') return { root: null, props };
    props.push(current.property.name);
    current = unwrapExpression(current.object);
  }
  return { root: current, props };
}

function isItIdentifier(node) {
  return node?.type === 'Identifier' && node.name === IT_IDENTIFIER;
}

function isItModifierChain(node) {
  const { root, props } = getMemberChain(node);
  if (!isItIdentifier(root)) return false;
  return props.every((prop) => MODIFIER_PROPERTIES.has(prop));
}

function isItEachCallee(node) {
  const { root, props } = getMemberChain(node);
  if (!isItIdentifier(root)) return false;
  if (props.length === 0) return false;
  if (props[0] !== EACH_PROPERTY) return false;
  return props.slice(1).every((prop) => MODIFIER_PROPERTIES.has(prop));
}

function isItEachChain(node) {
  if (!node) return false;
  const current = unwrapExpression(node);
  if (!current) return false;
  if (current.type === 'MemberExpression') {
    return isItEachCallee(current);
  }
  return false;
}

function getTestDescriptionArgument(node) {
  const callee = unwrapExpression(node.callee);
  if (!callee) return null;

  if (callee.type === 'Identifier' && callee.name === IT_IDENTIFIER) {
    return node.arguments?.[0] ?? null;
  }

  if (callee.type === 'MemberExpression' && isItModifierChain(callee)) {
    return node.arguments?.[0] ?? null;
  }

  if (callee.type === 'CallExpression') {
    const innerCallee = unwrapExpression(callee.callee);
    if (innerCallee && isItEachChain(innerCallee)) {
      return node.arguments?.[0] ?? null;
    }
  }

  if (callee.type === 'TaggedTemplateExpression') {
    const tag = unwrapExpression(callee.tag);
    if (tag && isItEachChain(tag)) {
      return node.arguments?.[0] ?? null;
    }
  }

  return null;
}

function getDescriptionText(argument) {
  if (!argument) return null;
  if (argument.type === 'Literal' && typeof argument.value === 'string') {
    return argument.value;
  }
  if (argument.type === 'TemplateLiteral') {
    if (argument.quasis.length === 0) return null;
    const [first] = argument.quasis;
    return first.value?.cooked ?? first.value?.raw ?? null;
  }
  return null;
}

const requireItShouldRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require it(...) test descriptions to start with "should".',
      recommended: false,
    },
    schema: [],
    messages: {
      shouldPrefix: 'Test descriptions for it(...) must start with "should".',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const descriptionArg = getTestDescriptionArgument(node);
        if (!descriptionArg) return;
        const descriptionText = getDescriptionText(descriptionArg);
        if (descriptionText == null) return;
        if (descriptionText.trim().toLowerCase().startsWith('should')) return;
        context.report({
          node: descriptionArg,
          messageId: 'shouldPrefix',
        });
      },
    };
  },
};

export default requireItShouldRule;
