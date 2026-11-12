// Reads a photo in the browser: when it was taken, a small copy to show, and
// the faces in it with a template for each. Nothing leaves this device.
import { FACE_API, FACE_MODELS } from "./config.js?v=fc030c5-184013";
import { exifDate } from "./logic.js?v=fc030c5-184013";

let api = null;
let loading = null;

export function loadModels() {
  loading ??= (async () => {
    api = await import(FACE_API);
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri(FACE_MODELS),
      api.nets.faceLandmark68Net.loadFromUri(FACE_MODELS),
      api.nets.faceRecognitionNet.loadFromUri(FACE_MODELS),
    ]);
  })().catch((error) => { loading = null; throw error; });
  return loading;
}

function scaled(source, width, height, longest) {
  const scale = Math.min(1, longest / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
const toBlob = (canvas, quality = 0.82) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

async function digest(file) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readPhoto(file) {
  await loadModels();
  const taken = exifDate(await file.slice(0, 256 * 1024).arrayBuffer()) ?? new Date(file.lastModified || Date.now());
  const hash = await digest(file);
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    const work = scaled(bitmap, width, height, 1280);
    const thumb = await toBlob(scaled(bitmap, width, height, 480));
    const found = await api.detectAllFaces(work, new api.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptors();
    const faces = [];
    for (const item of found) {
      const b = item.detection.box;
      // A square crop with some room around the face, for the circles.
      const side = Math.max(b.width, b.height) * 1.5;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const crop = document.createElement("canvas");
      crop.width = crop.height = 128;
      crop.getContext("2d").drawImage(work, cx - side / 2, cy - side / 2, side, side, 0, 0, 128, 128);
      faces.push({
        box: { x: b.x / work.width, y: b.y / work.height, w: b.width / work.width, h: b.height / work.height },
        desc: Float32Array.from(item.descriptor),
        score: item.detection.score,
        crop: await toBlob(crop, 0.85),
      });
    }
    return { name: file.name, takenAt: taken.getTime(), w: width, h: height, hash, thumb, faces };
  } finally {
    bitmap.close?.();
  }
}
