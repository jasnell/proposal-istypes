'use strict';

const Builtin = require('./polyfill');
const assert = require('assert');

// Verify normal builtins
assert.strictEqual(Builtin.typeOf(Date), 'function');
assert.strictEqual(Builtin.typeOf(new Date()), 'Date');
assert.strictEqual(Builtin.typeOf(Reflect), 'object');

class M {
  static [Symbol.builtin]() {
    return 'M';
  }
};

class N {}

// Verify that a class with @@builtin is reported as a builtin
assert.strictEqual(Builtin.typeOf(new M()), 'M');
assert.strictEqual(Builtin.typeOf(M), 'function');

// Verify that a class without @@builtin is not reported as a builtin
assert.strictEqual(Builtin.typeOf(new N()), 'object');
assert.strictEqual(Builtin.typeOf(N), 'function');

// Verify that we can mask a built-in
Date[Symbol.builtin] = undefined;
assert.strictEqual(Builtin.typeOf(new Date()), 'object');
