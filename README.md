# Builtin.is and Builtin.typeOf

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

## Requirements

What is needed?

* Mechanism for reliably determining if any given object is a built-in or is an
  instance of a built-in, even across realms.
* Mechanism for reliably determining if objects from different realms correspond
  to the same built-in (e.g. `Date` from one realm is the same built-in as
  `Date` from a second realm).
* Avoid introducing new, or changing existing, language syntax.
* Allow host environments to insert new built-ins.
* Allow user code objects to masquerade as built-ins.

## Proposed API

### Identifying an Object as a Built-in

An object is identified as a built-in using:

* A new `[[Builtin]]` internal slot to mark built-ins
* A new `@@builtin` symbol (`Symbol.builtin`) property whose value is a function
  whose default behavior is to provide the value of the `[[Builtin]]` internal
  slot.

#### `[[Builtin]]` internal slot

Intrinsic objects listed in the table below have a `[[Builtin]]` internal slot
with the given string value. Intrinsic objects not listed in the table do *not*
have the `[[Builtin]]` internal slot.

| Intrinsic Name        | Builtin Name          |
| --------------------- | --------------------- |
| `%Array%`             | `'Array'`             |
| `%ArrayBuffer%`       | `'ArrayBuffer'`       |
| `%AsyncFunction%`     | `'AsyncFunction'`     |
| `%Atomics%`           | `'Atomics'`           |
| `%Boolean%`           | `'Boolean'`           |
| `%DataView%`          | `'DataView'`          |
| `%Date%`              | `'Date'`              |
| `%Error%`             | `'Error'`             |
| `%EvalError%`         | `'EvalError'`         |
| `%Float32Array%`      | `'Float32Array'`      |
| `%Float64Array%`      | `'Float64Array'`      |
| `%Function%`          | `'function'`          |
| `%GeneratorFunction%` | `'GeneratorFunction'` |
| `%Int8Array%`         | `'Int8Array'`         |
| `%Int16Array%`        | `'Int16Array'`        |
| `%Int32Array%`        | `'Int32Array'`        |
| `%JSON%`              | `'JSON'`              |
| `%Map%`               | `'Map'`               |
| `%Math%`              | `'Math'`              |
| `%Number%`            | `'Number'`            |
| `%Object%`            | `'object'`            |
| `%Promise%`           | `'Promise'`           |
| `%Proxy%`             | `'Proxy'`             |
| `%RangeError%`        | `'RangeError'`        |
| `%ReferenceError%`    | `'ReferenceError'`    |
| `%Reflect%`           | `'Reflect'`           |
| `%RegExp%`            | `'RegExp'`            |
| `%Set%`               | `'Set'`               |
| `%SharedArrayBuffer%` | `'SharedArrayBuffer'` |
| `%String%`            | `'String'`            |
| `%Symbol%`            | `'symbol'`            |
| `%SyntaxError%`       | `'SyntaxError'`       |
| `%TypeError%`         | `'TypeError'`         |
| `%Uint8Array%`        | `'Uint8Array'`        |
| `%Uint8ClampedArray%` | `'Uint8ClampedArray'` |
| `%Uint16Array%`       | `'Uint16Array'`       |
| `%Uint32Array%`       | `'Uint32Array'`       |
| `%URIError%`          | `'URIError'`          |
| `%WeakMap%`           | `'WeakMap'`           |
| `%WeakSet%`           | `'WeakSet'`           |

*Note*: Currently, intrinsic prototype objects such as `%DatePrototype%`
intentionally do *not* have a `[[Builtin]]` internal slot. The effect of this
is such that `Builtin.typeOf(new Date())` would return `'Date'`,
`Builtin.typeOf(Object.getPrototypeOf(new Date()))` would return `'object'`,
despite `%DatePrototype%` being an intrinsic object. The justification for
this is that it is not yet clear if intrinsic prototype objects *need* to be
identifiable as built-ins.

In addition, all built-in non-constructor functions and methods have a
`[[Builtin]]` internal slot equal to the name of the function. These are used
to allow using `Builtin.is()` to determine if two function/method instances
represent the same intrinsic function or method.

For instance,

```js
Builtin.is(eval, vm.runInNewContext('eval'));                // true
Builtin.is(Object.prototype.toString,
           vm.runInNewContext('Object.prototype.toString')); // true
```

#### `Symbol.builtin`

The initial value of the `@@builtin` own property for all intrinsic objects
having a `[[Builtin]]` internal slot is the same function that returns the
value of the `[[Builtin]]` internal slot. Intrinsic objects that do not have
the `[[Builtin]]` internal slot do not have an initial value for the `@@builtin`
own property.

```js
const builtIn1 = Date[Symbol.builtin];
const builtIn2 = Uint8Array[Symbol.builtin];
const same = builtIn1 === builtIn2;         // true
```

An object is detectable as a built-in if it has the `@@builtin` own property.

An object is detectable as an *instance* of a built-in if its constructor has a
`@@builtin` property as either an own or inherited property.

```js
class Foo {
  static [Symbol.builtin]() {
    return 'Foo';
  }
}
class Bar extends Foo {}

Builtin.typeOf(new Foo());     // 'Foo'

Builtin.typeOf(new Bar());     // 'Foo'
```

Setting the `@@builtin` property to a non-function value makes the object,
or instances of the object, no longer detectable as built-ins:

```js
Builtin.typeOf(new Uint8Array(0));      // 'Uint8Array'

Uint8Array[Symbol.builtin] = undefined;

Builtin.typeOf(new Uint8Array(0));      // 'object'
```

The `@@builtin` property has the attributes:

* `[[Configurable]]: true`
* `[[Enumerable]]: false`
* `[[Writable]]: true`

### Abstract Operations

#### `GetBuiltinValue`

The abstract operation `GetBuiltinValue` with argument `object` performs the
following steps:

* Let `fn` be `? GetMethod(object, @@builtin)`.
* If `fn` is `undefined`, return `undefined`.
* Let `value` be `? Call(fn, object)`.
* If `value` is `undefined`, return `undefined`.
* Return `? ToString(value)`.

#### `GetOwnBuiltinValue`

The abstract operation `GetOwnBuiltinValue` with argument `object` performs the
following steps:

* Let `hasProperty` be `? HasOwnProperty(object, @@builtin)`.
* If `hasProperty` is `false`, return `undefined`.
* Return `? GetBuiltinValue(object)`.
 
### `Builtin`

The `Builtin` object is the `%Builtin%` intrinsic object and the initial
value of the `Builtin` property of the `global` object. The `Builtin`
object is an ordinary object.

The value of the `[[Prototype]]` internal slot of the `Builtin` object is
the intrinsic object `%ObjectPrototype%`.

The `Builtin` object is not a function object. It does not have a
`[[Construct]]` internal method; it is not possible to use the `Builtin`
object as a constructor with the `new` operator. The `Builtin` object also
does not have a `[[Call]]` internal method; it is not possible to invoke the
`Builtin` object as a function.

#### `Builtin.is(value1, value2)`

When called with arguments `value1` and `value2`:

* If `Type(value1)` is not `Object` return `false`.
* Let `V1` be `? GetOwnBuiltinValue(value1)`.
* If `V1` is `undefined`, return `false`.
* If `value2` is `undefined`, return `false`.
* If `Type(value2)` is not `Object`, return `false`.
* Let `V2` be `? GetOwnBuiltinValue(value2)`.
* Let `same` be the result of performing Strict Equality Comparison `V1 === V2`.
* Return `same`

The `Builtin.is()` function returns `true` if both of the given values have a
`@@builtin` own property function that each returns values that, after coercion
to a string, are strictly equal to one another. Otherwise, return `false`.

```js
Builtin.is(Date, vm.runInNewContext('Date'));     // true
Builtin.is(Date, vm.runInNewContext('Number'));   // false
Builtin.is(Date, vm.runInNewContext('{}'));       // false
Builtin.is({}, vm.runInNewContext('{}'));         // false

Date = {};
Builtin.is(Date, vm.runInNewContext('Date'));     // false
```

Note that user code may modify the `@@builtin` own property on any object:

```js
Date[Symbol.builtin] = undefined;
Builtin.is(Date, vm.runInNewContext('Date'));     // false
```

By default, the `Builtin.is()` function will not throw an exception. It is
possible for `Builtin.is()` to throw if a user-provided `@@builtin` function
throws or returns a value that cannot be coerced to a string (e.g. `Symbol`
values).

#### `Builtin.typeOf(arg)`

When the `typeOf()` function is called with argument `arg`:

* If `Type(arg)` is `Object`, then:
  * Let `C` be `? Get(arg, "constructor")`.
  * If `C` is not `undefined`, then:
    * Let `V` be `? GetBuiltinValue(C)`.
    * If `V` is not `undefined`, return `V`.
* Return `typeof arg`.

For example:

```js
Builtin.typeOf([]);                             // 'Array'
Builtin.typeOf(new ArrayBuffer());              // 'ArrayBuffer'
Builtin.typeOf(async function foo() {});        // 'AsyncFunction'
Builtin.typeOf(new Boolean());                  // 'Boolean'
Builtin.typeOf(new DataView(buffer));           // 'DataView'
Builtin.typeOf(new Date());                     // 'Date'
Builtin.typeOf(new Error());                    // 'Error'
Builtin.typeOf(new EvalError());                // 'EvalError'
Builtin.typeOf(new Float32Array());             // 'Float32Array'
Builtin.typeOf(new Float64Array());             // 'Float64Array'
Builtin.typeOf(function() {});                  // 'function'
Builtin.typeOf(function*() {});                 // 'GeneratorFunction'
Builtin.typeOf(new Int16Array());               // 'Int16Array'
Builtin.typeOf(new Int32Array());               // 'Int32Array'
Builtin.typeOf(new Int8Array());                // 'Int8Array'
Builtin.typeOf(new InternalError());            // 'InternalError'
Builtin.typeOf(new Intl.Collator());            // 'Collator'
Builtin.typeOf(new Intl.DateTimeFormat());      // 'DateTimeFormat'
Builtin.typeOf(new Intl.NumberFormat());        // 'NumberFormat'
Builtin.typeOf(new Map());                      // 'Map'
Builtin.typeOf(new Number());                   // 'Number'
Builtin.typeOf(new Object());                   // 'object'
Builtin.typeOf(new Promise(() => {}));          // 'Promise'
Builtin.typeOf(new RangeError());               // 'RangeError'
Builtin.typeOf(new ReferenceError());           // 'ReferenceError'
Builtin.typeOf(new RegExp(''));                 // 'RegExp'
Builtin.typeOf(new Set());                      // 'Set'
Builtin.typeOf(new SharedArrayBuffer());        // 'SharedArrayBuffer'
Builtin.typeOf(new String());                   // 'String'
Builtin.typeOf(new SyntaxError());              // 'SyntaxError'
Builtin.typeOf(new TypeError());                // 'TypeError'
Builtin.typeOf(new URIError());                 // 'URIError'
Builtin.typeOf(new Uint16Array());              // 'Uint16Array'
Builtin.typeOf(new Uint32Array());              // 'Uint32Array'
Builtin.typeOf(new Uint8Array());               // 'Uint8Array'
Builtin.typeOf(new Uint8ClampedArray());        // 'Uint8ClampedArray'
Builtin.typeOf(new WeakMap());                  // 'WeakMap'
Builtin.typeOf(new WeakSet());                  // 'WeatSet'
Builtin.typeOf(new WebAssembly.Module());       // 'Module'
Builtin.typeOf(new WebAssembly.Instance());     // 'Instance'
Builtin.typeOf(new WebAssembly.Memory());       // 'Memory'
Builtin.typeOf(new WebAssembly.Table());        // 'Table'
Builtin.typeOf(new WebAssembly.CompileError()); // 'CompileError'
Builtin.typeOf(new WebAssembly.LinkError());    // 'LinkError'
Builtin.typeOf(new WebAssembly.RuntimeError()); // 'RuntimeError'
Builtin.typeOf(null);                           // 'null'
Builtin.typeOf(undefined);                      // 'undefined'
Builtin.typeOf({});                             // 'object'
Builtin.typeOf(true);                           // 'boolean'
Builtin.typeOf(1);                              // 'number'
Builtin.typeOf('test');                         // 'string'
Builtin.typeOf(Symbol('foo'));                  // 'symbol'
Builtin.typeOf(function() {});                  // 'function'


class MyArray extends Uint8Array {}
const myArray = new MyArray();
Builtin.typeOf(myArray);                        // 'Uint8Array'

vm.runInNewContext('Builtin.typeOf(myArray)', { myArray }); // 'Uint8Array'
```

By default, the `Builtin.typeOf()` function will not throw an exception. It is
possible for `Builtin.typeOf()` to throw if a user-provided `@@builtin` function
throws or returns a value that cannot be coerced to a string (e.g. `Symbol`
values).

*Note*: Because of the nature of `Proxy` instances, it is not possible for
`Builtin.typeOf(proxyObj)` to ever return `'Proxy'`.

### `Proxy.isProxy(value)`

Returns `true` if `value` is a Proxy exotic object, otherwise return `false`.

The `Proxy.isProxy()` function will not throw an exception.

*Note*: Due to the security issues around `Proxy`, host environments should be
allowed to provide an option for forcing `Proxy.isProxy(value)` to always
return `false`. For instance, Node.js could hypothetically provide a
command-line argument like `--disable-isproxy`.

### Notes

* Adding a new `%Builtin%` intrinsic object can be avoided by adding functions
  to an existing intrinisic, for instance `Object.isBuiltin()` or
  `Object.typeOf()`.

* Using `@@builtin` means that any object can lie about being a built-in by
  setting the `@@builtin` own property to whatever value it wants. This is by
  design. Polyfills/shims and secure-realm code, for example, must be able to
  create builtins, remove them, or replace builtins that are noncompliant - as
  such, a shim (that runs before other code) must be able to create its own
  builtin replacement and truly masquerade as if it were the original builtin.

* Why have a separate `Proxy.isProxy()` function? For the simple reason that
  `Proxy` objects do not act like anything else. The use case justifying
  `Proxy.isProxy()` is that, when debugging, it can often be necessary
  to know if the an object of interest is a Proxy or not.

* The `Builtin` property on the `global` object is set initially to the
  `Builtin` object. This property has the attributes:
  * `[[Configurable]]: true`
  * `[[Enumerable]]: true`
  * `[[Writable]]: true`

* The `Builtin.is`, `Builtin.typeOf`, and `Proxy.isProxy` properties have
  the attributes:
  * `[[Configurable]]: true`
  * `[[Enumerable]]: true`
  * `[[Writable]]: true`

## Examples

```js
function formatValue(value) {
  switch (Builtin.typeOf(value)) {
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

```js
const val = vm.runInNewContext('Date');
if (Builtin.is(val, Date)) {
  /** ... **/
} else if (Builtin.is(val, Math)) {
  /** ... **/
}
```

Because the value of `@@builtin` is a function, the original implementation can
be captured, cached, and restored later:

```js
const origDateBuiltin = Date[Symbol.builtin];
Date[Symbol.builtin] = undefined;

Builtin.is(Date, vm.runInNewContext('Date'));  // false
Builtin.typeOf(Date);                          // 'object'

origDateBuiltin.call(Date);                    // 'Date'

Date[Symbol.builtin] = origDateBuiltin;

Builtin.is(Date, vm.runInNewContext('Date'));  // true
Builtin.typeOf(Date);                          // 'Date'
```

*Note*: The behavior of the initial `@@builtin` function is to return the value
of the `this` objects `[[Builtin]]` internal slot if one exists. Accordingly,
it is possible to grab a reference to the function once and use it on multiple
objects:

```js
const origBuiltin = Date[Symbol.builtin];
Uint8Array[Symbol.builtin] = origBuiltin;

class Foo {}
Foo[Symbol.builtin] = origBuiltin;

Date[Symbol.builtin]();                                  // 'Date'
Uint8Array[Symbol.builtin]();                            // 'Uint8Array'
Foo[Symbol.builtin]();                                   // undefined

Builtin.is(Date, vm.runInNewContext('Date'));            // true
Builtin.is(Uint8Array, vm.runInNewContext('Uin8Array')); // true

Builtin.typeOf(new Date());                              // 'Date'
Builtin.typeOf(new Uint8Array());                        // 'Uint8Array'
Builtin.typeOf(new Foo());                               // 'object'
```
