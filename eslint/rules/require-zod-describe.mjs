const DEFAULT_ZOD_NAMES = new Set(['z']);
const SCHEMA_NAME_PATTERN = /Schema$/;

const UNWRAP_TYPES = new Set([
  'ChainExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);

const OBJECT_CALL_NAMES = new Set(['object', 'strictObject']);

function unwrapExpression(node) {
  let current = node;
  while (current && UNWRAP_TYPES.has(current.type)) {
    current = current.expression;
  }
  return current;
}

function getPropertyName(property, sourceCode) {
  if (!property || property.type !== 'Property') return 'property';
  const key = property.key;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal') return String(key.value);
  return sourceCode.getText(key);
}

function isIdentifierNamed(node, names) {
  return node?.type === 'Identifier' && names.has(node.name);
}

function isMemberPropertyNamed(node, name) {
  return (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.property?.type === 'Identifier' &&
    node.property.name === name
  );
}

function isZodObjectCall(node, zodNames) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = unwrapExpression(node.callee);
  if (!callee || callee.type !== 'MemberExpression') return false;
  if (callee.computed || callee.property.type !== 'Identifier') return false;
  if (!OBJECT_CALL_NAMES.has(callee.property.name)) return false;
  const object = unwrapExpression(callee.object);
  return isIdentifierNamed(object, zodNames);
}

function isZodObjectLikeExpression(expr, zodNames) {
  const current = unwrapExpression(expr);
  if (!current) return false;
  if (current.type === 'Identifier') {
    return SCHEMA_NAME_PATTERN.test(current.name);
  }
  if (current.type === 'MemberExpression') {
    if (!current.computed && current.property.type === 'Identifier') {
      if (SCHEMA_NAME_PATTERN.test(current.property.name)) return true;
    }
    return isZodObjectLikeExpression(current.object, zodNames);
  }
  if (current.type === 'CallExpression') {
    if (isZodObjectCall(current, zodNames)) return true;
    const callee = unwrapExpression(current.callee);
    if (callee?.type === 'MemberExpression') {
      return isZodObjectLikeExpression(callee.object, zodNames);
    }
  }
  return false;
}

function hasDescribeCallInChain(node) {
  const current = unwrapExpression(node);
  if (!current) return false;
  if (current.type === 'CallExpression') {
    const callee = unwrapExpression(current.callee);
    if (isMemberPropertyNamed(callee, 'describe')) return true;
    if (callee?.type === 'MemberExpression') {
      return hasDescribeCallInChain(callee.object);
    }
    return false;
  }
  if (current.type === 'MemberExpression') {
    return hasDescribeCallInChain(current.object);
  }
  return false;
}

function checkShapeProperties(objectExpression, context) {
  for (const property of objectExpression.properties) {
    if (property.type !== 'Property') continue;
    if (property.kind && property.kind !== 'init') continue;
    if (property.value == null) continue;
    if (hasDescribeCallInChain(property.value)) continue;

    const name = getPropertyName(property, context.getSourceCode());
    context.report({
      node: property.key,
      messageId: 'missingDescribe',
      data: { name },
    });
  }
}

const requireZodDescribeRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require Zod object properties to include .describe(...) in their schema chain.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          zodNames: {
            type: 'array',
            items: { type: 'string' },
          },
          checkExtend: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingDescribe: 'Zod schema property "{{name}}" must call .describe(...)',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const zodNames = new Set(options.zodNames ?? [...DEFAULT_ZOD_NAMES]);
    const checkExtend = options.checkExtend !== false;

    return {
      CallExpression(node) {
        if (isZodObjectCall(node, zodNames)) {
          const [shape] = node.arguments;
          if (shape && shape.type === 'ObjectExpression') {
            checkShapeProperties(shape, context);
          }
          return;
        }

        if (!checkExtend) return;

        const callee = unwrapExpression(node.callee);
        if (!isMemberPropertyNamed(callee, 'extend')) return;

        const [shape] = node.arguments;
        if (!shape || shape.type !== 'ObjectExpression') return;

        if (callee?.type === 'MemberExpression' && isZodObjectLikeExpression(callee.object, zodNames)) {
          checkShapeProperties(shape, context);
        }
      },
    };
  },
};

export default requireZodDescribeRule;
