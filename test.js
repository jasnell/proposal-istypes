'use strict';

const Builtin = require('./polyfill');
const assert = require('assert');

// Verify normal builtins
assert.strictEqual(Builtin.typeof(Date), 'function');
assert.strictEqual(Builtin.typeof(new Date()), 'Date');
assert.strictEqual(Builtin.typeof(Reflect), 'object');

class M {
  static [Symbol.builtin]() {
    return 'M';
  }
};

class N {}

// Verify that a class with @@builtin is reported as a builtin
assert.strictEqual(Builtin.typeof(new M()), 'M');
assert.strictEqual(Builtin.typeof(M), 'function');

// Verify that a class without @@builtin is not reported as a builtin
assert.strictEqual(Builtin.typeof(new N()), 'object');
assert.strictEqual(Builtin.typeof(N), 'function');

// Verify that we can mask a built-in
Date[Symbol.builtin] = undefined;
assert.strictEqual(Builtin.typeof(new Date()), 'object');
