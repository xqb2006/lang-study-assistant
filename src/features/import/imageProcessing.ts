import { readFile } from "@tauri-apps/plugin-fs";

function getImageMimeType(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

export async function readImportImage(path: string) {
  const bytes = await readFile(path);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(new Blob([bytes], { type: getImageMimeType(path) }));
  });
}

export async function processImportImage(
  data: string,
  options: { rotation?: number; trimWhitespace?: boolean } = {},
) {
  const { rotation = 0, trimWhitespace = false } = options;
  return await new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSourceEdge = 2000;
      const sourceScale = Math.min(1, maxSourceEdge / Math.max(image.width, image.height));
      const imageWidth = Math.max(1, Math.round(image.width * sourceScale));
      const imageHeight = Math.max(1, Math.round(image.height * sourceScale));
      const sideways = Math.abs(rotation) % 180 === 90;
      const source = document.createElement("canvas");
      source.width = sideways ? imageHeight : imageWidth;
      source.height = sideways ? imageWidth : imageHeight;
      const context = source.getContext("2d");
      if (!context) {
        reject(new Error("无法处理图片"));
        return;
      }
      context.translate(source.width / 2, source.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);

      let left = 0;
      let top = 0;
      let width = source.width;
      let height = source.height;
      if (trimWhitespace && width > 80 && height > 80) {
        const pixels = context.getImageData(0, 0, width, height).data;
        const isInk = (column: number, row: number) => {
          const index = (row * width + column) * 4;
          return (
            pixels[index + 3] > 30 &&
            (pixels[index] < 242 || pixels[index + 1] < 242 || pixels[index + 2] < 242)
          );
        };
        const rowHasInk = (row: number) => {
          for (let column = 0; column < width; column += 8) {
            if (isInk(column, row)) return true;
          }
          return false;
        };
        const columnHasInk = (column: number) => {
          for (let row = 0; row < height; row += 8) {
            if (isInk(column, row)) return true;
          }
          return false;
        };
        while (top < height / 4 && !rowHasInk(top)) top += 4;
        while (height - 1 > top + height / 2 && !rowHasInk(height - 1)) height -= 4;
        while (left < width / 4 && !columnHasInk(left)) left += 4;
        while (width - 1 > left + width / 2 && !columnHasInk(width - 1)) width -= 4;
      }

      const output = document.createElement("canvas");
      const maxRecognitionEdge = 1800;
      const outputScale = Math.min(1, maxRecognitionEdge / Math.max(width - left, height - top));
      output.width = Math.max(1, Math.round((width - left) * outputScale));
      output.height = Math.max(1, Math.round((height - top) * outputScale));
      output
        .getContext("2d")
        ?.drawImage(
          source,
          left,
          top,
          width - left,
          height - top,
          0,
          0,
          output.width,
          output.height,
        );
      resolve(output.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => reject(new Error("无法加载图片"));
    image.src = data;
  });
}
