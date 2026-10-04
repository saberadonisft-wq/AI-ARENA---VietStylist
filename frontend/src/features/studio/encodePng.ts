const workerSource = `self.onmessage = async ({ data }) => {
  try {
    const canvas = new OffscreenCanvas(data.width, data.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No worker canvas");
    context.putImageData(new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height), 0, 0);
    self.postMessage({ blob: await canvas.convertToBlob({ type: "image/png" }) });
  } catch { self.postMessage({ failed: true }); }
};`;

function encodeOnCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error("Không mã hóa được ảnh PNG."));
  }, "image/png"));
}

// Transfer the final pixels without resampling. A dedicated worker avoids the
// main-thread idle encoder being starved by a modal's animated backdrop.
export async function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return encodeOnCanvas(canvas);
  let worker: Worker | undefined;
  let url: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không khởi tạo được bộ mã hóa PNG.");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    worker = new Worker(url);
    return await new Promise<Blob>((resolve, reject) => {
      worker!.onmessage = ({ data }) => data.blob instanceof Blob ? resolve(data.blob) : reject(new Error("PNG worker unavailable"));
      worker!.onerror = event => { event.preventDefault(); reject(new Error("PNG worker unavailable")); };
      worker!.onmessageerror = () => reject(new Error("PNG worker response failed"));
      timer = setTimeout(() => reject(new Error("PNG worker timed out")), 15000);
      worker!.postMessage({ width: canvas.width, height: canvas.height, pixels: pixels.data.buffer }, [pixels.data.buffer]);
    });
  } catch {
    clearTimeout(timer);
    worker?.terminate();
    // Older browsers and restrictive worker policies keep a functional export.
    return await encodeOnCanvas(canvas);
  } finally {
    clearTimeout(timer);
    worker?.terminate();
    if (url) URL.revokeObjectURL(url);
  }
}
