/**
 * Values of the contants below are a (more or less) informed guesses and not guaranteed to be accurate.
 */
const COMPRESSED_POINTER_SIZE = 4 // Pointers use 4 bytes (also on 64-bit systems) due to pointer compression
export const OBJECT_BASE_SIZE = 3 * COMPRESSED_POINTER_SIZE // 3 compressed pointers
// Arrays have an additional length property (1 pointer) and a backing store header (2 pointers)
// See https://stackoverflow.com/a/70550693.
const ARRAY_BASE_SIZE = OBJECT_BASE_SIZE + 3 * COMPRESSED_POINTER_SIZE
const TYPED_ARRAY_BASE_SIZE = 25 * COMPRESSED_POINTER_SIZE // byteLength, byteOffset, ..., see https://stackoverflow.com/a/45808835
const SMALL_INTEGER_SIZE = COMPRESSED_POINTER_SIZE // Small integers (up to 31 bits), pointer tagging
const HEAP_NUMBER_SIZE = 8 + 2 * COMPRESSED_POINTER_SIZE // 4-byte map pointer + 8-byte payload + property pointer
const MAX_NUM_FAST_PROPERTIES = 1020

/**
 * Estimate the size in bytes of an arbitrary object or primitive.
 * @param obj Object or primitive to estimate the size for
 * @returns Estimated size in bytes
 */
export function estimateObjectSize(obj: unknown): number {
  // catches null and undefined
  // typeof null == "object"
  if (obj == undefined) {
    return SMALL_INTEGER_SIZE
  }
  switch (typeof obj) {
    case 'undefined':
    case 'boolean': {
      return SMALL_INTEGER_SIZE
    }
    case 'number': {
      return Number.isInteger(obj) ? SMALL_INTEGER_SIZE : HEAP_NUMBER_SIZE
    }
    case 'bigint': {
      return HEAP_NUMBER_SIZE
    }
    case 'string': {
      // The string length is rounded up to the next multiple of 4.
      return COMPRESSED_POINTER_SIZE + OBJECT_BASE_SIZE + Math.ceil(obj.length / 4) * 4
    }
    case 'object': {
      if (Array.isArray(obj)) {
        return (
          COMPRESSED_POINTER_SIZE
          + ARRAY_BASE_SIZE
          + Object.values(obj).reduce((acc, val) => acc + estimateObjectSize(val), 0)
        )
      }
      else if (ArrayBuffer.isView(obj)) {
        return TYPED_ARRAY_BASE_SIZE + obj.byteLength
      }
      else if (obj instanceof Set) {
        return (
          COMPRESSED_POINTER_SIZE
          + OBJECT_BASE_SIZE
          + Array.from(obj.values()).reduce((acc, val) => acc + estimateObjectSize(val), 0)
        )
      }
      else if (obj instanceof Map) {
        return (
          COMPRESSED_POINTER_SIZE
          + OBJECT_BASE_SIZE
          + Array.from(obj.entries()).reduce(
            (acc, [key, val]) => acc + estimateObjectSize(key) + estimateObjectSize(val),
            0,
          )
        )
      }

      let propertiesSize = 0
      const numProps = Object.keys(obj).length
      if (numProps > MAX_NUM_FAST_PROPERTIES) {
        // If there are too many properties, V8 stores Objects in dictionary mode (slow properties)
        // with each object having a self-contained dictionary. This dictionary contains the key, value
        // and details of properties. Below we estimate the size of this additional dictionary. Formula
        // adapted from
        // medium.com/@bpmxmqd/v8-engine-jsobject-structure-analysis-and-memory-optimization-ideas-be30cfcdcd16
        const propertiesDictSize
          = 16 + 5 * 8 + 2 ** Math.ceil(Math.log2((numProps + 2) * 1.5)) * 3 * 4
        // In return, properties are no longer stored in the properties array, so we subtract that.
        propertiesSize = propertiesDictSize - numProps * COMPRESSED_POINTER_SIZE
      }

      const valuesSize = Object.values(obj).reduce((acc, val) => acc + estimateObjectSize(val), 0)
      return OBJECT_BASE_SIZE + propertiesSize + valuesSize
    }
    case 'symbol':
    case 'function': {
      throw new Error(`Can't estimate size of type '${typeof obj}'`)
    }
  }
  console.error(`Can't estimate size of type '${typeof obj}'`)
  return SMALL_INTEGER_SIZE
}
