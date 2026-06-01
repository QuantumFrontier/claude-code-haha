import { beforeEach, describe, expect, mock, test } from 'bun:test'

type ProcessorMode = 'metadata' | 'throw'

let processorMode: ProcessorMode = 'metadata'
let resizeCalls: Array<{ width: number; height: number }> = []

const originalPngDimensions = { width: 1394, height: 4404, format: 'png' }

mock.module('../src/tools/FileReadTool/imageProcessor.js', () => ({
  getImageProcessor: async () => {
    if (processorMode === 'throw') {
      throw new Error('image processor unavailable')
    }

    return (_input: Buffer) => {
      const instance = {
        metadata: async () => originalPngDimensions,
        resize: (width: number, height: number) => {
          resizeCalls.push({ width, height })
          return instance
        },
        jpeg: () => instance,
        png: () => instance,
        webp: () => instance,
        toBuffer: async () => Buffer.from('resized-image'),
      }
      return instance
    }
  },
}))

const { maybeResizeAndDownsampleImageBuffer } = await import(
  '../src/utils/imageResizer.js'
)

function makePngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(32)
  buffer[0] = 0x89
  buffer[1] = 0x50
  buffer[2] = 0x4e
  buffer[3] = 0x47
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

beforeEach(() => {
  processorMode = 'metadata'
  resizeCalls = []
})

describe('maybeResizeAndDownsampleImageBuffer', () => {
  test('passes through a tall screenshot when bytes are already within API limits', async () => {
    const imageBuffer = Buffer.alloc(1024, 1)

    const result = await maybeResizeAndDownsampleImageBuffer(
      imageBuffer,
      imageBuffer.length,
      'png',
    )

    expect(result.buffer).toBe(imageBuffer)
    expect(result.mediaType).toBe('png')
    expect(resizeCalls).toEqual([])
    expect(result.dimensions).toEqual({
      originalWidth: 1394,
      originalHeight: 4404,
      displayWidth: 1394,
      displayHeight: 4404,
    })
  })

  test('falls back to the original tall screenshot if local image processing is unavailable', async () => {
    processorMode = 'throw'
    const imageBuffer = makePngHeader(1394, 4404)

    const result = await maybeResizeAndDownsampleImageBuffer(
      imageBuffer,
      imageBuffer.length,
      'png',
    )

    expect(result.buffer).toBe(imageBuffer)
    expect(result.mediaType).toBe('png')
  })
})
