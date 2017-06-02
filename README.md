# Builtins.is and Builtins.typeof

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

This proposal introduces a new `Builtins` built-in object that exposes methods
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

### `Builtins`

The `Builtins` object is the `%Builtins%` intrinsic object and the initial
value of the `Builtins` property of the `global` object. The `Builtins`
object is an ordinary object.

The value of the `[[Prototype]]` internal slot of the `Builtins` object is
the intrinsic object `%ObjectPrototype%`.

The `Builtins` object is not a function object. It does not have a
`[[Construct]]` internal method; it is not possible to use the `Builtins`
object as a constructor with the `new` operator. The `Builtins' object also
does not have a `[[Call]]` internal method; it is not possible to invoke the
`Builtins` object as a function.

#### `Builtins.is(value1[, value2])`

When called with a single argument, the `Builtins.is()` function returns `true`
if the given value is detectable as a built-in object or has an object that is
detectable as a built-in within its prototype chain. For instance:

```js
Builtins.is(Date);                               // true
Builtins.is(vm.runInNewContext('Date'))          // true

const m = {};
Object.setPrototypeOf(m, Date);
Builtins.is(m);                                  // true

Date = {};
Builtins.is(Date);                               // false
```

When called with two arguments, the `Builtins.is()` returns `true` if both
given values are the same built-in object, even across realms. For instance:

```js
Builtins.is(Date, vm.runInNewContext('Date'));     // true
Builtins.is(Date, vm.runInNewContext('Number'));   // false
Builtins.is(Date, vm.runInNewContext('{}'));       // false
Builtins.is({}, vm.runInNewContext('{}'));         // false

const m = {}
Object.setPrototypeOf(m, Date);
vm.runInNewContext('Builtins.is(m, Date)', { m }); // true

Date = {};
Builtins.is(Date, vm.runInNewContext('Date'));     // false
```

Note: Cross-realm equivalence of built-ins is based entirely on comparing the
values of the `Symbol.builtin` properties for the two objects.

Host environments that introduce new host specific global or built-in objects
may return `true` if the value is one of the host specific built-ins.

The `Builtins.is()` function must return `false` if any of the given values are
not detectable as built-in objects, or are not the same built-in object.

Note that the `Symbol.builtin' symbol may be modified on an object to control
whether it is detectable as a built-in.

```js
Date[Symbol.builtin] = undefined;
Builtins.is(Date);                                  // false
```

#### `Builtins.typeof(arg)`

When the `typeof()` function is called with argument `arg`:

* If `arg` has a constructor with a `Symbol.builtin` property with a string
  value, return the value of `Symbol.builtin`
* Otherwise return the value of `typeof arg`.

For example:

```js
Builtins.typeof([]);                             // 'Array'
Builtins.typeof(new ArrayBuffer());              // 'ArrayBuffer'
Builtins.typeof(async function foo() {});        // 'AsyncFunction'
Builtins.typeof(new Boolean());                  // 'Boolean'
Builtins.typeof(new DataView(buffer));           // 'DataView'
Builtins.typeof(new Date());                     // 'Date'
Builtins.typeof(new Error());                    // 'Error'
Builtins.typeof(new EvalError());                // 'EvalError'
Builtins.typeof(new Float32Array());             // 'Float32Array'
Builtins.typeof(new Float64Array());             // 'Float64Array'
Builtins.typeof((function*() {})());             // 'Generator'
Builtins.typeof(function*() {});                 // 'GeneratorFunction'
Builtins.typeof(new Int16Array());               // 'Int16Array'
Builtins.typeof(new Int32Array());               // 'Int32Array'
Builtins.typeof(new Int8Array());                // 'Int8Array'
Builtins.typeof(new InternalError());            // 'InternalError'
Builtins.typeof(new Intl.Collator());            // 'Collator'
Builtins.typeof(new Intl.DateTimeFormat());      // 'DateTimeFormat'
Builtins.typeof(new Intl.NumberFormat());        // 'NumberFormat'
Builtins.typeof(new Map());                      // 'Map'
Builtins.typeof(new Number());                   // 'Number'
Builtins.typeof(new Promise(() => {}));          // 'Promise'
Builtins.typeof(new RangeError());               // 'RangeError'
Builtins.typeof(new ReferenceError());           // 'ReferenceError'
Builtins.typeof(new RegExp(''));                 // 'RegExp'
Builtins.typeof(new Set());                      // 'Set'
Builtins.typeof(new SharedArrayBuffer());        // 'SharedArrayBuffer'
Builtins.typeof(new String());                   // 'String'
Builtins.typeof(new SyntaxError());              // 'SyntaxError'
Builtins.typeof(new TypeError());                // 'TypeError'
Builtins.typeof(new URIError());                 // 'URIError'
Builtins.typeof(new Uint16Array());              // 'Uint16Array'
Builtins.typeof(new Uint32Array());              // 'Uint32Array'
Builtins.typeof(new Uint8Array());               // 'Uint8Array'
Builtins.typeof(new Uint8ClampedArray());        // 'Uint8ClampedArray'
Builtins.typeof(new WeakMap());                  // 'WeakMap'
Builtins.typeof(new WeakSet());                  // 'WeatSet'
Builtins.typeof(new WebAssembly.Module());       // 'Module'
Builtins.typeof(new WebAssembly.Instance());     // 'Instance'
Builtins.typeof(new WebAssembly.Memory());       // 'Memory'
Builtins.typeof(new WebAssembly.Table());        // 'Table'
Builtins.typeof(new WebAssembly.CompileError()); // 'CompileError'
Builtins.typeof(new WebAssembly.LinkError());    // 'LinkError'
Builtins.typeof(new WebAssembly.RuntimeError()); // 'RuntimeError'
Builtins.typeof(null);                           // 'null'
Builtins.typeof(undefined);                      // 'undefined'
Builtins.typeof({});                             // 'object'
Builtins.typeof(true);                           // 'boolean'
Builtins.typeof(1);                              // 'number'
Builtins.typeof('test');                         // 'string'
Builtins.typeof(Symbol('foo'));                  // 'symbol'
Builtins.typeof(function() {});                  // 'function'
```

The `Builtins.typeof()` method would operate consistently on cross-realm
objects:

For instance, in Node.js:

```js
Builtins.typeof(vm.runInNewContext('new Date()')); // 'Date'
```

Host environments that introduce new host specific global or built-in objects
may return additional implementation defined values. For instance, a
hypothetical host environment that offers `URL` as a built-in global may return
the value `'URL'` in response to
`Builtins.typeof(new URL('http://example.org'))`.

If the given `arg` is an `Object` with a built-in within its prototype chain,
then `Builtins.typeof()` must return the name of the built-in. For instance:

```js
class MyArray extends Uint8Array {}
const myArray = new MyArray();
Builtins.typeof(myArray);            // 'Uint8Array'
```

This should also work across realms:

```js
class MyArray extends Uint8Array {}
const myArray = new MyArray();
vm.runInNewContext('Builtins.typeof(myArray)', { myArray }); // 'Uint8Array'
```

The `Builtins.typeof()` method will not throw an exception.

### `Symbol.builtin`

The `Symbol.builtin` is used by to configure by the environment to configure the
name returned for a built-in using the `Builtins.typeof()` function.

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

Builtins.is(Foo);               // True
Builtins.typeof(new Foo());     // 'Foo'
```

An object is detectable as a built-in if it, or it's constructor has, as either
an own or inherited property, a `Symbol.builtin` property whose value is a
string.

```js
class MyArray extends Uint8Array {
  static get [Symbol.builtin]() { return undefined; }
}
const myArray = new MyArray();
Builtins.typeof(myArray);                // 'object'
```

```js
const m = {};
Object.setPrototypeOf(m, Date);
Builtins.is(m);                          // true

m[Symbol.builtin] = undefined;
Builtins.is(m);                          // false
```

By default, the `Symbol.builtin` property is `[[Configurable]]: true` and
`[[Enumerable]]: false`.

### `Proxy.isProxy(value)`

Returns `true` if `value` is a Proxy exotic object.

### Internal Slot Alternative

As an alternative to using `Symbol.builtin` as the mechanism for detecting
whether an object is a built-in or not, all built-in objects could have a
`[[Builtin]]` internal slot.

For `Builtins.is(value)`, `true` would be returned if `value` has the
`[[Builtin]]` internal slot with a string value.

For `Builtins.is(value1, value2)`, `true` would be returned if both values have
the `[[Builtin]]` internal slot with strictly equal string values.

For `Builtins.typeof(value)`, the value of the `[[Builtin]]` internal slot for
`value.constructor`, or any object in the prototype chain for
`value.constructor', is returned. If there is no `value.constructor`, or the
`value.constructor` prototype chain does not have a `[[Builtin]]` internal slot,
the value of `typeof value` is returned.

### Notes

* Using the `Symbol.builtin` approach means that any object can lie about being
  a built-in by setting the `Symbol.builtin` property to whatever value it
  wants. That is by design.

* Why have a separate `Proxy.isProxy()` function? For the simple reason that
  `Proxy` objects do not act like anything else. The use case justifying
  `Proxy.isProxy()` is that, when debugging code, it can often be necessary
  to know if the an object of interest is a Proxy or not.

* The `Builtins` property on the `global` object is set initially to the
  `Builtins` object. This property is `[[Configurable]]: true` and
  `[[Enumerable]]: true`.

* Both the `Builtins.is` and `Builtins.typeof` properties are
  [[Configurable]]: true` and `[[Enumerable]]: true`

* If `Foo` is a built-in, `Builtins.typeof(Foo) === 'object'` and
  `Builtins.typeof(Foo.prototype) === 'object'` unless the prototype just
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
    * `Builtins.is(undefined) === false` ?
    * `Builtins.is(null) === false` ?
    * `Builtins.is(1) === false` ?  // Basically, should any primitives be
      detectable as built-ins?

## Example

```js
function formatValue(value) {
  switch (Builtins.typeof(value)) {
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