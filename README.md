# Builtin.is and Builtin.typeof

## Motivation

There are a number of situations where existing type checking using `instanceof`
can be problematic. For instance:

```js
$ ./node
> (new Date()) instanceof Date
true
> (vm.runInNewContext('new Date()')) instanceof Date
false
```

In this case, both statements return valid `Date` objects. However, because
the second is created in a separate realm, it is not recognized as a `Date` in
the current realm, despite operating appropriately in every other respect.

In other cases, `instanceof` does not provide adequate granularity, such as
checking if a given argument is an unsigned 16-bit integer vs. a signed 32-bit
integer.

This proposal introduces a new `Builtin` built-in object that exposes methods
that allow reliable cross-realm type checking for ECMAScript built-ins.

## Prior art

Node.js has relied on such checks, in part, to reliably determine types for
debugging, inspection and display formatting purposes in the `util.format()`
and `util.inspect()` APIs. In addition, the `is` package on npm (which
implements similar type checks) currently has roughly 33k+ downloads per day.

Node.js can (and has) implement these functions in a host-specific manner as
part of the Node.js API but the preference would be towards having these kind
of type checks be a regular part of the language API.

For example:

```js
$ ./node
> util.isDate(new Date())
true
> util.isDate(vm.runInNewContext('new Date()'))
true
> vm.runInNewContext('new Date()') instanceof Date
false
```

## Proposed API

### Identifying an Object as a Built-in

There are two potential approaches that would work equally well across realms:

* Using a new `@@builtin` symbol (`Symbol.builtin`) to mark built-ins
* Using a new `[[Builtin]]` internal slot to mark built-ins

We would need to decide which is the best approach.

#### `Symbol.builtin`

The `Symbol.builtin` is used by to configure by the environment to configure the
name returned for a built-in using the `Builtin.typeof()` function.

```js
console.log(Date[Symbol.builtin]);    // 'Date'
console.log(Set[Symbol.builtin]);     // 'Set'
```

Generally, the `Symbol.builtin` property is set by the host environment to
allow built-ins to be detectable. It may also be used by users to allow an
object to masquerade as a built-in:

```js
class Foo {}
Foo[Symbol.builtin] = 'Foo';

Builtin.is(Foo);               // True
Builtin.typeof(new Foo());     // 'Foo'
```

An object is detectable as a built-in if it, or it's constructor has, as either
an own or inherited property, a `Symbol.builtin` property whose value is a
string.

```js
class MyArray extends Uint8Array {
  static get [Symbol.builtin]() { return undefined; }
}
const myArray = new MyArray();
Builtin.typeof(myArray);                // 'object'
```

```js
const m = {};
Object.setPrototypeOf(m, Date);
Builtin.is(m);                          // true

m[Symbol.builtin] = undefined;
Builtin.is(m);                          // false
```

By default, the `Symbol.builtin` property is `[[Configurable]]: true` and
`[[Enumerable]]: false`.

#### `[[Builtin]]` internal slot

As an alternative to using `Symbol.builtin` as the mechanism for detecting
whether an object is a built-in or not, all built-in objects could have a
`[[Builtin]]` internal slot.

For `Builtin.is(value)`, `true` would be returned if `value` has the
`[[Builtin]]` internal slot with a string value.

For `Builtin.is(value1, value2)`, `true` would be returned if both values have
the `[[Builtin]]` internal slot with strictly equal string values.

For `Builtin.typeof(value)`, the value of the `[[Builtin]]` internal slot for
`value.constructor`, or any object in the prototype chain for
`value.constructor', is returned. If there is no `value.constructor`, or the
`value.constructor` prototype chain does not have a `[[Builtin]]` internal slot,
the value of `typeof value` is returned.

### `Builtin`

The `Builtin` object is the `%Builtin%` intrinsic object and the initial
value of the `Builtin` property of the `global` object. The `Builtin`
object is an ordinary object.

The value of the `[[Prototype]]` internal slot of the `Builtin` object is
the intrinsic object `%ObjectPrototype%`.

The `Builtin` object is not a function object. It does not have a
`[[Construct]]` internal method; it is not possible to use the `Builtin`
object as a constructor with the `new` operator. The `Builtin' object also
does not have a `[[Call]]` internal method; it is not possible to invoke the
`Builtin` object as a function.

#### `Builtin.is(value1[, value2])`

When called with a single argument, the `Builtin.is()` function returns `true`
if the given value is detectable as a built-in object.

```js
Builtin.is(Date);                               // true
Builtin.is(vm.runInNewContext('Date'))          // true

const m = {};
Object.setPrototypeOf(m, Date);
Builtin.is(m);                                  // false

const n = new Date();
Builtin.is(n);                                  // false

Date = {};
Builtin.is(Date);                               // false
```

When called with two arguments, the `Builtin.is()` returns `true` if both
given values are the same built-in object, even across realms. For instance:

```js
Builtin.is(Date, vm.runInNewContext('Date'));     // true
Builtin.is(Date, vm.runInNewContext('Number'));   // false
Builtin.is(Date, vm.runInNewContext('{}'));       // false
Builtin.is({}, vm.runInNewContext('{}'));         // false

Date = {};
Builtin.is(Date, vm.runInNewContext('Date'));     // false
```

Note: Cross-realm equivalence of built-ins is based entirely on comparing the
values of the `Symbol.builtin` properties (or `[[Builtin]]` internal slot if
we go that direction instead) for the two objects.

Host environments that introduce new host specific global or built-in objects
may return `true` if the value is one of the host specific built-ins.

The `Builtin.is()` function must return `false` if any of the given values are
not detectable as built-in objects, or are not the same built-in object.

Note that, if we go with the Symbol approach, the `Symbol.builtin' symbol may
be modified on an object to control whether it is detectable as a built-in.

```js
Date[Symbol.builtin] = undefined;
Builtin.is(Date);                                  // false
```

#### `Builtin.typeof(arg)`

When the `typeof()` function is called with argument `arg`:

* If we go with the `Symbol.builtin` approach:
  * If `arg` has a constructor with a `Symbol.builtin` property with a string
    value, return the value of `Symbol.builtin`.
* If we go with the `[[Builtin]]` internal slot approach:
  * If `arg` has a constructor, or any object in that constructor's prototype
    chain, has `[[Builtin]]` internal slot with a string value, return the value
    of `[[Builtin]]` 
* Otherwise return the value of `typeof arg`.

For example:

```js
Builtin.typeof([]);                             // 'Array'
Builtin.typeof(new ArrayBuffer());              // 'ArrayBuffer'
Builtin.typeof(async function foo() {});        // 'AsyncFunction'
Builtin.typeof(new Boolean());                  // 'Boolean'
Builtin.typeof(new DataView(buffer));           // 'DataView'
Builtin.typeof(new Date());                     // 'Date'
Builtin.typeof(new Error());                    // 'Error'
Builtin.typeof(new EvalError());                // 'EvalError'
Builtin.typeof(new Float32Array());             // 'Float32Array'
Builtin.typeof(new Float64Array());             // 'Float64Array'
Builtin.typeof((function*() {})());             // 'Generator'
Builtin.typeof(function*() {});                 // 'GeneratorFunction'
Builtin.typeof(new Int16Array());               // 'Int16Array'
Builtin.typeof(new Int32Array());               // 'Int32Array'
Builtin.typeof(new Int8Array());                // 'Int8Array'
Builtin.typeof(new InternalError());            // 'InternalError'
Builtin.typeof(new Intl.Collator());            // 'Collator'
Builtin.typeof(new Intl.DateTimeFormat());      // 'DateTimeFormat'
Builtin.typeof(new Intl.NumberFormat());        // 'NumberFormat'
Builtin.typeof(new Map());                      // 'Map'
Builtin.typeof(new Number());                   // 'Number'
Builtin.typeof(new Promise(() => {}));          // 'Promise'
Builtin.typeof(new RangeError());               // 'RangeError'
Builtin.typeof(new ReferenceError());           // 'ReferenceError'
Builtin.typeof(new RegExp(''));                 // 'RegExp'
Builtin.typeof(new Set());                      // 'Set'
Builtin.typeof(new SharedArrayBuffer());        // 'SharedArrayBuffer'
Builtin.typeof(new String());                   // 'String'
Builtin.typeof(new SyntaxError());              // 'SyntaxError'
Builtin.typeof(new TypeError());                // 'TypeError'
Builtin.typeof(new URIError());                 // 'URIError'
Builtin.typeof(new Uint16Array());              // 'Uint16Array'
Builtin.typeof(new Uint32Array());              // 'Uint32Array'
Builtin.typeof(new Uint8Array());               // 'Uint8Array'
Builtin.typeof(new Uint8ClampedArray());        // 'Uint8ClampedArray'
Builtin.typeof(new WeakMap());                  // 'WeakMap'
Builtin.typeof(new WeakSet());                  // 'WeatSet'
Builtin.typeof(new WebAssembly.Module());       // 'Module'
Builtin.typeof(new WebAssembly.Instance());     // 'Instance'
Builtin.typeof(new WebAssembly.Memory());       // 'Memory'
Builtin.typeof(new WebAssembly.Table());        // 'Table'
Builtin.typeof(new WebAssembly.CompileError()); // 'CompileError'
Builtin.typeof(new WebAssembly.LinkError());    // 'LinkError'
Builtin.typeof(new WebAssembly.RuntimeError()); // 'RuntimeError'
Builtin.typeof(null);                           // 'null'
Builtin.typeof(undefined);                      // 'undefined'
Builtin.typeof({});                             // 'object'
Builtin.typeof(true);                           // 'boolean'
Builtin.typeof(1);                              // 'number'
Builtin.typeof('test');                         // 'string'
Builtin.typeof(Symbol('foo'));                  // 'symbol'
Builtin.typeof(function() {});                  // 'function'
```

The `Builtin.typeof()` method would operate consistently on cross-realm
objects:

For instance, in Node.js:

```js
Builtin.typeof(vm.runInNewContext('new Date()')); // 'Date'
```

Host environments that introduce new host specific global or built-in objects
may return additional implementation defined values. For instance, a
hypothetical host environment that offers `URL` as a built-in global may return
the value `'URL'` in response to
`Builtin.typeof(new URL('http://example.org'))`.

If the given `arg` is an `Object` with a built-in within its prototype chain,
then `Builtin.typeof()` must return the name of the built-in. For instance:

```js
class MyArray extends Uint8Array {}
const myArray = new MyArray();
Builtin.typeof(myArray);            // 'Uint8Array'
```

This should also work across realms:

```js
class MyArray extends Uint8Array {}
const myArray = new MyArray();
vm.runInNewContext('Builtin.typeof(myArray)', { myArray }); // 'Uint8Array'
```

The `Builtin.typeof()` method will not throw an exception.

### `Proxy.isProxy(value)`

Returns `true` if `value` is a Proxy exotic object.

### Notes

* Using the `Symbol.builtin` approach means that any object can lie about being
  a built-in by setting the `Symbol.builtin` property to whatever value it
  wants. That is by design.

* Why have a separate `Proxy.isProxy()` function? For the simple reason that
  `Proxy` objects do not act like anything else. The use case justifying
  `Proxy.isProxy()` is that, when debugging code, it can often be necessary
  to know if the an object of interest is a Proxy or not.

* The `Builtin` property on the `global` object is set initially to the
  `Builtin` object. This property is `[[Configurable]]: true` and
  `[[Enumerable]]: true`.

* Both the `Builtin.is` and `Builtin.typeof` properties are
  [[Configurable]]: true` and `[[Enumerable]]: true`

* If `Foo` is a built-in, `Builtin.typeof(Foo) === 'object'` and
  `Builtin.typeof(Foo.prototype) === 'object'` unless the prototype just
  happens to also be a built-in.

* All of the built-in objects would be assigned a default initial value for
  either the `Symbol.builtin` property or the `[[Builtin]]` internal slot
  (depending on the approach take) equal to the name of the object.
    * `Array[Symbol.builtin] = 'Array'`
    * `ArrayBuffer[Symbol.builtin] = 'ArrayBuffer'`
    * `AsyncFunction[Symbol.builtin] = 'AsyncFunction'`
    * `Atomics[Symbol.builtin] = 'Atomics'`
    * `Boolean[Symbol.builtin] = 'Boolean'`
    * `DataView[Symbol.builtin] = 'DataView'`
    * `Date[Symbol.builtin] = 'Date'`
    * `Error[Symbol.builtin] = 'Error'`
    * `EvalError[Symbol.builtin] = 'EvalError'`
    * `Float32Array[Symbol.builtin] = 'Float32Array'`
    * `Float64Array[Symbol.builtin] = 'Float64Array'`
    * `Generator[Symbol.builtin] = 'Generator'`
    * `GeneratorFunction[Symbol.builtin] = 'GeneratorFunction'`
    * `Int16Array[Symbol.builtin] = 'Int16Array'`
    * `Int32Array[Symbol.builtin] = 'Int32Array'`
    * `Int8Array[Symbol.builtin] = 'Int8Array'`
    * `InternalError[Symbol.builtin] = 'InternalError'`
    * `Intl[Symbol.builtin] = 'Intl'`
    * `Intl.Collator[Symbol.builtin] = 'Collator'`
    * `Intl.DateTimeFormat[Symbol.builtin] = 'DateTimeFormat'`
    * `Intl.NumberFormat[Symbol.builtin] = 'NumberFormat'`
    * `JSON[Symbol.builtin] = 'JSON'`
    * `Map[Symbol.builtin] = 'Map'`
    * `Math[Symbol.builtin] = 'Math'`
    * `NaN[Symbol.builtin] = 'NaN'`
    * `Number[Symbol.builtin] = 'Number'`
    * `Promise[Symbol.builtin] = 'Promise'`
    * `RangeError[Symbol.builtin] = 'RangeError'`
    * `ReferenceError[Symbol.builtin] = 'ReferenceError'`
    * `Reflect[Symbol.builtin] = 'Reflect'`
    * `RegExp[Symbol.builtin] = 'RegExp'`
    * `Set[Symbol.builtin] = 'Set'`
    * `SharedArrayBuffer[Symbol.builtin] = 'SharedArrayBuffer'`
    * `String[Symbol.builtin] = 'String'`
    * `SyntaxError[Symbol.builtin] = 'SyntaxError'`
    * `TypeError[Symbol.builtin] = 'TypeError'`
    * `URIError[Symbol.builtin] = 'URIError'`
    * `Uint16Array[Symbol.builtin] = 'Uint16Array'`
    * `Uint32Array[Symbol.builtin] = 'Uint32Array'`
    * `Uint8Array[Symbol.builtin] = 'Uint8Array'`
    * `Uint8ClampedArray[Symbol.builtin] = 'Uint8ClampedArray'`
    * `WeakMap[Symbol.builtin] = 'WeakMap'`
    * `WeatSet[Symbol.builtin] = 'WeatSet'`
    * `WebAssembly[Symbol.builtin] = 'WebAssembly'`
    * `WebAssembly.Module[Symbol.builtin] = 'Module'`
    * `WebAssembly.Instance[Symbol.builtin] = 'Instance'`
    * `WebAssembly.Memory[Symbol.builtin] = 'Memory'`
    * `WebAssembly.Table[Symbol.builtin] = 'Table'`
    * `WebAssembly.CompileError[Symbol.builtin] = 'CompileError'`
    * `WebAssembly.LinkError[Symbol.builtin] = 'LinkError'`
    * `WebAssembly.RuntimeError[Symbol.builtin] = 'RuntimeError'`

## Questions

1. Should:
    * `Builtin.is(undefined) === false` ?
    * `Builtin.is(null) === false` ?
    * `Builtin.is(1) === false` ?  // Basically, should any primitives be
      detectable as built-ins?

## Example

```js
function formatValue(value) {
  switch (Builtin.typeof(value)) {
    case 'Date':
      return formatDate(value);
    case 'Array':
      return formatArray(value);
    case 'RegExp':
      return formatRegExp(value);
    /** ... **/
  }
}
```