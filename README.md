# `Is*` Types

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
the second is created in a separate context, it is not properly recognized as
a `Date` in the current context, despite operating appropriately in every
other respect.

In other cases, `instanceof` does not provide adequate granularity, such as
checking if a given argument is an unsigned 16-bit integer vs. a signed 32-bit
integer.

This proposal introduces a number of additional `is{Type}` methods that are
similar to the existing `Array.isArray()` function. These allow for reliable
`instanceof` type checking.

Node.js uses such checks, in part, in order to reliably determine a values
type for debugging, inspection and display formatting purposes in the
`util.format()` and `util.inspect()` APIs. In addition, the `is` package on
npm (which implements similar type checks) currently has roughly 33k+ downloads
per day.

Node.js can (and has) implement these functions in a host-specific manner as
part of the Node.js API but the preference would be towards having these kind
of type checks be a regular part of the language API.

## Example

```js
$ ./node
> Date.isDate(new Date())
true
> Date.isDate(vm.runInNewContext('new Date()'))
true
```

## API

Each of the various `is*` methods return `true` if the given `arg` matches
the condition and `false` otherwise.

### `ArrayBuffer.isArrayBuffer(arg)`

Returns `true` if `arg` is an instance of `ArrayBuffer`.

### `Boolean.isBoolean(arg)`

Returns `true` if `arg` is either an instance of `Boolean` or a boolean
primitive.

### `Date.isDate(arg)`

Returns `true` if `arg` is an instance of `Date`.

### `Error.isError(arg)`

Returns `true` if `arg` is an instance of `Error`.

### `Function.isFunction(arg)`

Returns `true` if `arg` is an instance of `Function`.

### `Function.isGeneratorFunction(arg)`

Returns `true` if `arg` is a Generator Function.

### `Function.isGeneratorObject(arg)`

Returns `true` if `arg` is a Generator Object.

### `Map.isMap(arg)`

Returns `true` if `arg` is an instance of `Map`.

### `Map.isMapIterator(arg)`

Returns `true` if `arg` is an instance of a `Map` iterator.

### `Number.isNumber(arg)`

Returns `true` if `arg` is either an instance of `Number` or a number primitive.

### `Number.isInt8(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is an 8-bit
signed integer in the range `-2^7 <= arg <= -2^7-1`.

### `Number.isInt16(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is a 16-bit
signed integer in the range `-2^15 <= arg <= -2^15-1`.

### `Number.isInt32(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is a 32-bit
signed integer in the range `-2^31 <= arg <= -2^31-1`.

### `Number.isInt64(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is a 64-bit
signed integer in the range `-2^63 <= arg <= -2^63-1`.

### `Number.isUint8(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is an 8-bit
unsigned integer in the range `0 <= arg <= 2^8 − 1`.

### `Number.isUint16(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is a 16-bit
unsigned integer in the range `0 <= arg <= 2^16 − 1`.

### `Number.isUint32(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is a 32-bit
unsigned integer in the range `0 <= arg <= 2^32 − 1`.

### `Number.isUint64(arg)`

Returns `true` if `Number.isNumber(arg)` is `true` and `arg` is a 64-bit
unsigned integer in the range `0 <= arg <= 2^64 − 1`.

### `Object.isObject(arg)`

Returns `true` if `arg` is an instance of `Object`.

### `Promise.isPromise(arg)`

Returns `true` if `arg` is an instance of `Promise`.

### `Proxy.isProxy(arg)`

Returns `true` if `arg` is a `Proxy` object.

*Note*: While noting the fact that `Proxy` objects are intended to be
transparent, there are certain debugging and inspection use cases where a
developer needs to know if they are working with a `Proxy` object.

### `RegExp.isRegExp(arg)`

Returns `true` if `arg` is an instance of `RegExp`.

### `Set.isSet(arg)`

Returns `true` if `arg` is an instance of `Set`.

### `Set.isSetIterator(arg)`

Returns `true` if `arg` is an instance of a `Set` iterator.

### `Set.isSharedArrayBuffer(arg)`

Returns `true` if `arg` is an instance of `SharedArrayBuffer`.

### `String.isString(arg)`

Returns `true` if `arg` is either a `String` object or a string primitive.

### `Symbol.isSymbol(arg)`

Returns `true` if `arg` is a `Symbol`.

### `[TypedArray].isTypedArray(arg)`

Returns `true` if `arg` is an instance of a Typed Array.

### `[TypedArray].isInt8Array(arg)`

Returns `true` if `arg` is an instance of `Int8Array`.

### `[TypedArray].isInt16Array(arg)`

Returns `true` if `arg` is an instance of `Int16Array`.

### `[TypedArray].isInt32Array(arg)`

Returns `true` if `arg` is an instance of `Int32Array`.

### `[TypedArray].isUint8Array(arg)`

Returns `true` if `arg` is an instance of `Uint8Array`.

### `[TypedArray].isUint8ClampedArray(arg)`

Returns `true` if `arg` is an instance of `UintClamped8Array`.

### `[TypedArray].isUint16Array(arg)`

Returns `true` if `arg` is an instance of `UInt16Array`.

### `[TypedArray].isUint32Array(arg)`

Returns `true` if `arg` is an instance of `Uint32Array`.

### `[TypedArray].isFloat32Array(arg)`

Returns `true` if `arg` is an instance of `Float32Array`.

### `[TypedArray].isFloat64Array(arg)`

Returns `true` if `arg` is an instance of `Float64Array`.

### `WeakMap.isWeakMap(arg)`

Returns `true` if `arg` is an instance of `WeakMap`.

### `WeakSet.isWeakSet(arg)`

Returns `true` if `arg` is an instance of `WeakSet`.

### `Intl.Collator.isCollator(arg)`

Returns `true` if `arg` is an instance of `Intl.Collator`.

### `Intl.DateTimeFormat.isDateTimeFormat(arg)`

Returns `true` if `arg` is an instance of `Intl.DateTimeFormat`.

### `Intl.NumberFormat.isNumberFormat(arg)`

Returns `true` if `arg` is an instance of `Intl.NumberFormat`.
