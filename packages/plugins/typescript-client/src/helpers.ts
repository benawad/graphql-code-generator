import { getFieldType } from 'graphql-codegen-typescript-common';
import { SafeString } from 'handlebars';

import {
  Field,
  Operation,
  SelectionSetFragmentSpread,
  SelectionSetInlineFragment,
  Fragment
} from 'graphql-codegen-core';

export function shouldHavePrefix(field: Field, options: Handlebars.HelperOptions) {
  const config = options.data.root.config || {};
  const nonPrefixable = field.isEnum || field.isUnion || field.isScalar;

  return config.noNamespaces === true && !isPrimitiveType(field, options) && !nonPrefixable;
}

export function isPrimitiveType(type: Field, options: Handlebars.HelperOptions) {
  return options.data.root.primitives[type.type];
}

function nameFragment(
  convert: (str: string) => string,
  prefix: string,
  fragment: SelectionSetFragmentSpread | SelectionSetInlineFragment,
  noNamespaces: boolean
) {
  if (isFragmentSpread(fragment)) {
    return convert(fragment.fragmentName) + (noNamespaces ? '' : '.') + 'Fragment';
  }

  return (noNamespaces ? convert(prefix) : '') + fragment.name;
}

function isFragmentSpread(
  fragment: SelectionSetFragmentSpread | SelectionSetInlineFragment
): fragment is SelectionSetFragmentSpread {
  return fragment.isFragmentSpread;
}

export function fragments(convert: (str: string) => string) {
  return (operation: Operation, prefix: string, fragments: Fragment[], options: Handlebars.HelperOptions): string => {
    const config = options.data.root.config || {};
    const noNamespaces = config.noNamespaces === true;
    const fragmentsByType: {
      [type: string]: Array<string>;
    } = {};

    operation.inlineFragments.forEach(fragment => {
      const type = fragment.onType;

      if (!fragmentsByType[type]) {
        fragmentsByType[type] = [];
      }
      fragmentsByType[type].push(nameFragment(convert, prefix, fragment, noNamespaces));
    });

    operation.fragmentsSpread.forEach(fragment => {
      const def = fragments.find(f => f.name === fragment.fragmentName);

      if (!fragmentsByType[def.onType]) {
        fragmentsByType[def.onType] = [];
      }
      fragmentsByType[def.onType].push(nameFragment(convert, prefix, fragment, noNamespaces));
    });

    const mergedFragments = Object.values(fragmentsByType)
      // (F1 & F1)
      .map(names => {
        const joined = names.join(' & ');

        return names.length > 1 ? `(${joined})` : joined;
      })
      // (F1 & F2) | (F3 & F4)
      .join(' | ');

    const output: string[] = [];

    if (mergedFragments && operation.hasFields) {
      output.push(' & ');
    }

    if (Object.keys(fragmentsByType).length > 1) {
      output.push(`(${mergedFragments})`);
    } else {
      output.push(mergedFragments);
    }

    return output.join('');
  };
}

export function convertedFieldType(convert) {
  return (field: Field, prefix: string, options: Handlebars.HelperOptions) => {
    const config = options.data.root.config || {};
    let realType = '';
    const primitiveType = isPrimitiveType(field, options);

    if (shouldHavePrefix(field, options)) {
      realType = convert(prefix);

      if (config.noNamespaces) {
        realType += field.type;
      }
    } else if (primitiveType) {
      realType = primitiveType;
    } else {
      realType = convert(field.type);
    }

    return new SafeString(getFieldType(field, realType, options));
  };
}
