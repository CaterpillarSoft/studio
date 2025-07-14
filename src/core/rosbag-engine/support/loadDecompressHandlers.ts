import type { McapTypes } from '@mcap/core'

let handlersPromise: Promise<McapTypes.DecompressHandlers> | undefined
export async function loadDecompressHandlers(): Promise<McapTypes.DecompressHandlers> {
  return await (handlersPromise ??= _loadDecompressHandlers())
}

async function _loadDecompressHandlers(): Promise<McapTypes.DecompressHandlers> {
  const [decompressZstd] = await Promise.all([
    /**
     * @docs https://github.com/donmccurdy/zstddec-wasm#readme
     * @description 解压zstd
     */
    import('zstddec').then(async ({ ZSTDDecoder }) => {
      const decoder = new ZSTDDecoder()

      await decoder.init()

      return decoder.decode
    }),
    // import('@foxglove/wasm-lz4').then(async (mod) => {
    //   await mod.default.isLoaded
    //   return mod.default
    // }),
    // import('@foxglove/wasm-bz2').then(async mod => await mod.default.init()),
  ])

  return {
    // lz4: (buffer, decompressedSize) => decompressLZ4(buffer, Number(decompressedSize)),

    // bz2: (buffer, decompressedSize) =>
    //   bzip2.decompress(buffer, Number(decompressedSize), { small: false }),

    zstd: (buffer, decompressedSize) => decompressZstd(buffer, Number(decompressedSize)),
  }
}
