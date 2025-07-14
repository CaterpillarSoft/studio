export class BlobReadable {
  public constructor(private file: Blob) {}
  public async size(): Promise<bigint> {
    return BigInt(this.file.size)
  }

  public async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    if (offset + size > this.file.size) {
      throw new Error(
        `Read of ${size} bytes at offset ${offset} exceeds file size ${this.file.size}`,
      )
    }
    return new Uint8Array(
      await this.file.slice(Number(offset), Number(offset + size)).arrayBuffer(),
    )
  }
}
