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
if the given value is either a built-in object or has a built-in object within
its prototype chain. For instance:

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

Host environments that introduce new host specific global or built-in objects
may return `true` if the value is one of the host specific built-ins.

The `Builtins.is()` function must return `false` if any of the given values are
not built-in objects, or are not the same built-in object. (*TODO*: Need a
better definition of "same").

#### `Builtins.typeof(arg)`

When the `typeof()` function is called with argument `arg`:

* If `arg` is an instance of a built-in constructor object, the name of the
  built-ins constructor is returned;
* Otherwise the value of `typeof arg` is returned.

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
Builtins.typeof(new Proxy({}, {}));              // 'Proxy'
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

### `Symbol.isBuiltinDetectable`

The `Symbol.isBuiltinDetectable` is used to configure if an object should be
detectable as a built-in using either the `Builtins.is()` or `Builtins.typeof()`
functions.

The `Symbol.isBuiltinDetectable` can be defined as an own or inherited
property and its value is a `boolean`.

```js
class MyArray extends Uint8Array {
  static get [Symbol.isBuiltinDetectable]() { return false; }
}
const myArray = new MyArray();
Builtins.typeof(myArray);                // 'object'
```

```js
const m = {};
Object.setPrototypeOf(m, Date);
Builtins.is(m);                          // true

m[Symbol.isBuiltinDetectable] = false;
Builtins.is(m);                          // false
```
