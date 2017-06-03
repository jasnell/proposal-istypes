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
* A new `@@builtin` symbol (`Symbol.builtin`) property whose default behavior
  is to provide the value of the `[[Builtin]]` internal slot.

#### `[[Builtin]]` internal slot

All built-ins, with the exception of the intrinsic object `%ObjectPrototype%`,
would have a `[[Builtin]]` internal slot with a string value identifying the
name of the built-in. For instance, for the `%Math%` intrinsic object, the
value of `[[Builtin]]` is `'Math'`.

For `%TypedArray%` intrinsic objects, the value of `[[Builtin]]` is equal to
the value of `[[TypedArrayName]]`. For instance, for a `%TypedArray%` with
`[[TypedArrayName]]` `'Uint8Array'`, the value of `[[Builtin]]` is
`'Uint8Array'`.

#### `Symbol.builtin`

The initial value of the `@@builtin` own property is the value of the
`[[Builtin]]` internal slot, or `undefined` if the object does not have
a `[[Builtin]]` internal slot.

An object is detectable as a built-in if it has the `@@builtin` own property.

An object is detectable as an instance of a built-in if its constructor has a
`@@builtin` property as either an own or inherited property.

```js
class Foo {}
class Bar extends Foo {}

Foo[Symbol.builtin] = 'Foo';

Builtin.is(Foo);               // true, Symbol.builtin is an own property
Builtin.typeof(new Foo());     // 'Foo'

Builtin.is(Bar);               // false, Symbol.builtin is inherited
Builtin.typeof(new Bar());     // 'Foo'
```

Setting the `@@builtin` property to a non-string value makes the object,
or instances of the object, no longer detectable as built-ins:

```js
Builtin.is(Uint8Array);                 // true
Builtin.typeof(new Uint8Array(0));      // 'Uint8Array'

Uint8Array[Symbol.builtin] = undefined;

Builtin.is(Uint8Array);                 // false
Builtin.typeof(new Uint8Array(0));      // 'object'
```

The `@@builtin` property has the attributes:

* `[[Configurable]]: true`
* `[[Enumerable]]: false`
* `[[Writable]]: true`

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

#### `Builtin.is(value1[, value2])`

When called with arguments `value1` and `value2`:

* If `Type(value1)` is not `Object` return `false`.
* Let `B` be `? value1.[[GetOwnProperty]](@@builtin)`.
* If `B` is `undefined`, return `false`.
* Let `V1` be `? GET(value1, @@builtin)`.
* If `Type(V1)` is not `String`, return `false`.
* If `value2` is `undefined`, return `true`.
* If `Type(value2)` is not `Object`, return `false`.
* Let `B` be `? value2.[[GetOwnProperty]](@@builtin)`.
* If `B` is `undefined`, return `false`.
* Let `V2` be `? GET(value2, @@builtin)`.
* If `Type(V2)` is not `String`, return `false`.
* Let `same` be the result of performing Strict Equality Comparison `V1 === V2`.
* Return `same`

When called with a single argument, the `Builtin.is()` function returns `true`
if the given value has the `@@builtin` own property:

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

When called with two arguments, the `Builtin.is()` function returns `true` if
both given values have the `@@builtin` own property and the value of both
`@@builtin` own properties are strictly equal to one another. Otherwise,
return `false`.

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
Builtin.is(Date);                                  // false
```

The `Builtin.is()` function will not throw an exception.

#### `Builtin.typeof(arg)`

When the `typeof()` function is called with argument `arg`:

* If `Type(arg)` is `Object`, then:
  * Let `C` be `? Get(arg, "constructor")`.
  * If `C` is not `undefined`, then:
    * Let `B` be `? C.[[Get]](@@builtin)`
    * If `Type(B)` is `String`, return `B`
* Return `typeof arg`.

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


class MyArray extends Uint8Array {}
const myArray = new MyArray();
Builtin.typeof(myArray);                        // 'Uint8Array'

vm.runInNewContext('Builtin.typeof(myArray)', { myArray }); // 'Uint8Array'
```

The `Builtin.typeof()` function will not throw an exception.

### `Proxy.isProxy(value)`

Returns `true` if `value` is a Proxy exotic object, otherwise return `false`.

The `Proxy.isProxy()` function will not throw an exception.

### Notes

* Using `@@builtin` means that any object can lie about being a built-in by
  setting the `@@builtin` own property to whatever value it wants. This is by
  design.

* Why have a separate `Proxy.isProxy()` function? For the simple reason that
  `Proxy` objects do not act like anything else. The use case justifying
  `Proxy.isProxy()` is that, when debugging, it can often be necessary
  to know if the an object of interest is a Proxy or not.

* The `Builtin` property on the `global` object is set initially to the
  `Builtin` object. This property has the attributes:
  * `[[Configurable]]: true`
  * `[[Enumerable]]: true`
  * `[[Writable]]: true`

* The `Builtin.is`, `Builtin.typeof`, and `Proxy.isProxy` properties have
  the attributes:
  * `[[Configurable]]: true`
  * `[[Enumerable]]: true`
  * `[[Writable]]: true`

* All of the built-in objects would be assigned a default initial value for
  the `[[Builtin]]` internal slot. These become the initial value of the
  `@@builtin` own property for each object.
    * `Array.[[Builtin]] = 'Array'`
    * `ArrayBuffer.[[Builtin]] = 'ArrayBuffer'`
    * `AsyncFunction.[[Builtin]] = 'AsyncFunction'`
    * `Atomics.[[Builtin]] = 'Atomics'`
    * `Boolean.[[Builtin]] = 'Boolean'`
    * `Builtint.[[Builtin]] = 'Builtin'`
    * `DataView.[[Builtin]] = 'DataView'`
    * `Date.[[Builtin]] = 'Date'`
    * `Error.[[Builtin]] = 'Error'`
    * `EvalError.[[Builtin]] = 'EvalError'`
    * `Float32Array.[[Builtin]] = 'Float32Array'`
    * `Float64Array.[[Builtin]] = 'Float64Array'`
    * `Generator.[[Builtin]] = 'Generator'`
    * `GeneratorFunction.[[Builtin]] = 'GeneratorFunction'`
    * `Int16Array.[[Builtin]] = 'Int16Array'`
    * `Int32Array.[[Builtin]] = 'Int32Array'`
    * `Int8Array.[[Builtin]] = 'Int8Array'`
    * `InternalError.[[Builtin]] = 'InternalError'`
    * `Intl.[[Builtin]] = 'Intl'`
      * `Intl.Collator.[[Builtin]] = 'Collator'`
      * `Intl.DateTimeFormat.[[Builtin]] = 'DateTimeFormat'`
      * `Intl.NumberFormat.[[Builtin]] = 'NumberFormat'`
    * `JSON.[[Builtin]] = 'JSON'`
    * `Map.[[Builtin]] = 'Map'`
    * `Math.[[Builtin]] = 'Math'`
    * `NaN.[[Builtin]] = 'NaN'`
    * `Number.[[Builtin]] = 'Number'`
    * `Promise.[[Builtin]] = 'Promise'`
    * `RangeError.[[Builtin]] = 'RangeError'`
    * `ReferenceError.[[Builtin]] = 'ReferenceError'`
    * `Reflect.[[Builtin]] = 'Reflect'`
    * `RegExp.[[Builtin]] = 'RegExp'`
    * `Set.[[Builtin]] = 'Set'`
    * `SharedArrayBuffer.[[Builtin]] = 'SharedArrayBuffer'`
    * `String.[[Builtin]] = 'String'`
    * `SyntaxError.[[Builtin]] = 'SyntaxError'`
    * `TypeError.[[Builtin]] = 'TypeError'`
    * `URIError.[[Builtin]] = 'URIError'`
    * `Uint16Array.[[Builtin]] = 'Uint16Array'`
    * `Uint32Array.[[Builtin]] = 'Uint32Array'`
    * `Uint8Array.[[Builtin]] = 'Uint8Array'`
    * `Uint8ClampedArray.[[Builtin]] = 'Uint8ClampedArray'`
    * `WeakMap.[[Builtin]] = 'WeakMap'`
    * `WeatSet.[[Builtin]] = 'WeatSet'`

## Examples

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

```js
const val = vm.runInNewContext('Date');
if (Builtin.is(val, Date)) {
  /** ... **/
} else if (Builtin.is(val, Math)) {
  /** ... **/
}
```
