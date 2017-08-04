'use strict';

// Note: this polyfill is currently limited from working completely across
// platforms

const kSymbol = Symbol('Symbol.builtin');
const kBuiltin = Symbol('[[Builtin]]');
const { isAsyncFunction } = process.binding('util');

Object.defineProperty(Symbol, 'builtin', {
  enumerable: false,
  configurable: false,
  value: kSymbol
});

function GetBuiltinValue(value) {
  if (value === null)
    return;
  const fn = value[kSymbol];
  if (fn === undefined) return;
  const val = fn.call(value);
  if (val === undefined) return;
  return `${val}`;
}

function GetOwnBuiltinValue(value) {
  if (value === null)
    return;
  if (!Object.getOwnPropertyDescriptor(value, kSymbol))
    return;
  return GetBuiltinValue(value);
}

function builtin() {
  if (typeof this !== 'object' && typeof this !== 'function')
    throw new TypeError('Method invoked on a value that is not an object');
  return this[kBuiltin];
}

const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = (function*() {}).constructor;

const labels = [
  Array, 'Array',
  ArrayBuffer, 'ArrayBuffer',
  AsyncFunction, 'AsyncFunction',
  Boolean, 'Boolean',
  DataView, 'DataView',
  Date, 'Date',
  Error, 'Error',
  EvalError, 'EvalError',
  Float32Array, 'Float32Array',
  Float64Array, 'Float64Array',
  Function, 'function',
  GeneratorFunction, 'GeneratorFunction',
  Int8Array, 'Int8Array',
  Int16Array, 'Int16Array',
  Int32Array, 'Int32Array',
  JSON, 'JSON',
  Map, 'Map',
  Math, 'Math',
  Number, 'Number',
  Object, 'object',
  Promise, 'Promise',
  Proxy, 'Proxy',
  RangeError, 'RangeError',
  ReferenceError, 'ReferenceError',
  Reflect, 'Reflect',
  RegExp, 'RegExp',
  Set, 'Set',
  String, 'String',
  Symbol, 'Symbol',
  SyntaxError, 'SyntaxError',
  TypeError, 'TypeError',
  Uint8Array, 'Uint8Array',
  Uint8ClampedArray, 'Uint8ClampedArray',
  Uint16Array, 'Uint16Array',
  Uint32Array, 'Uint32Array',
  URIError, 'URIError',
  WeakMap, 'WeakMap',
  WeakSet, 'WeakSet'
];
for (let n = 0; n < labels.length; n = n + 2) {
  Object.defineProperties(labels[n], {
    [kBuiltin]: {
      enumerable: false,
      configurable: false,
      value: labels[n + 1]
    },
    [kSymbol]: {
      enumerable: false,
      configurable: true,
      writable: true,
      value: builtin
    }});
}

if (typeof Atomics !== 'undefined') {
  Object.defineProperties(Atomics, {
    [kBuiltin]: {
      enumerable: false,
      configurable: false,
      value: 'Atomics'
    },
    [kSymbol]: {
      enumerable: false,
      configurable: true,
      writable: true,
      value: builtin
    }});
}

if (typeof SharedArrayBuffer !== 'undefined') {
  Object.defineProperties(SharedArrayBuffer, {
    [kBuiltin]: {
      enumerable: false,
      configurable: false,
      value: 'SharedArrayBuffer'
    },
    [kSymbol]: {
      enumerable: false,
      configurable: true,
      writable: true,
      value: builtin
    }});
}

function _is(value1, value2) {
  if (typeof value1 !== 'object' && typeof value1 !== 'function')
    return false;
  const v1 = GetOwnBuiltinValue(value1);
  if (v1 === undefined)
    return false;
  if (value2 === undefined)
    return false;
  if (typeof value2 !== 'object' && typeof value1 !== 'function')
    return false;
  const v2 = GetOwnBuiltinValue(value2);
  return v1 === v2;
}

function _typeof(value) {
  if (typeof value === 'object' || typeof value === 'function') {
    const ctor = value.constructor;
    if (ctor !== undefined) {
      const val = GetBuiltinValue(ctor);
      if (val !== undefined)
        return val;
    }
  }
  return typeof value;
}

Object.defineProperty(builtin, 'name', { value: '@@builtin' });
Object.defineProperty(_is, 'name', { value: 'is' });
Object.defineProperty(_typeof, 'name', { value: 'typeof' });

const Builtin = {};
Object.defineProperties(Builtin, {
  'is': {
    enumerable: false,
    configurable: true,
    writable: true,
    value: _is
  },
  'typeOf': {
    enumerable: false,
    configurable: true,
    writable: true,
    value: _typeof
  }
});

module.exports = Builtin;
