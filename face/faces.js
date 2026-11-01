// Face search for Client Photos. All of this runs in the browser: admin uploads read faces on
// the photographer's computer, and a client's selfie is compared on their own phone.
import * as faceapi from "./face-api.esm.js";

const MODELS = "/face/models";
const PACK = 254; // a face is 128 small numbers; each is stored as one byte

// How close two faces must be. Checked on real wedding photos: the same person scored up to
// about 0.41 and strangers from about 0.41. A selfie differs more from a wedding photo, so when
// nothing passes the first test the search tries the second one and says it isn't sure.
export const SAME_PERSON = 0.42;
export const MAYBE_SAME = 0.5;

const SAME_FACE = 0.25; // one person seen twice in a photo, where its quarters overlap
const MOST_FACES = 40; // in one photo

let loading;

// Uploads use the larger detector, which finds more faces. A selfie has one big face,
// so phones use the small one and download about 6 MB less.
function prepare(thorough) {
  loading ??= (async () => {
    await faceapi.tf.ready();
    await Promise.all([
      (thorough ? faceapi.nets.ssdMobilenetv1 : faceapi.nets.tinyFaceDetector).loadFromUri(MODELS),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS),
    ]);
  })();
  return loading;
}

function apart(a, b) {
  let sum = 0;
  for (let i = 0; i < 128; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// The detector shrinks every picture, which loses the small faces in a big group photo,
// so uploads read each quarter of the photo as well as the whole of it.
function quarters(image) {
  const width = Math.round(image.width * 0.6), height = Math.round(image.height * 0.6);
  return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, -x * (image.width - width), -y * (image.height - height));
    return canvas;
  });
}

// Takes a canvas and returns one entry for each face found, largest first
export async function readFaces(image, { thorough = false } = {}) {
  await prepare(thorough);
  const options = thorough
    ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: MOST_FACES })
    : new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
  const found = [];
  for (const part of thorough ? [image, ...quarters(image)] : [image]) {
    found.push(...await faceapi.detectAllFaces(part, options).withFaceLandmarks().withFaceDescriptors());
  }
  const faces = [];
  found.sort((a, b) => b.detection.box.area - a.detection.box.area).forEach(({ descriptor }) => {
    if (!faces.some(face => apart(face, descriptor) < SAME_FACE)) faces.push(descriptor);
  });
  return faces.slice(0, MOST_FACES);
}

export function packFaces(faces) {
  const bytes = new Int8Array(faces.length * 128);
  faces.forEach((face, n) => face.forEach((v, i) => {
    bytes[n * 128 + i] = Math.max(-127, Math.min(127, Math.round(v * PACK)));
  }));
  return btoa(String.fromCharCode(...new Uint8Array(bytes.buffer)));
}

export function unpackFaces(text) {
  const bytes = Int8Array.from(atob(text), c => c.charCodeAt(0));
  const faces = [];
  for (let n = 0; n < bytes.length; n += 128) faces.push(bytes.subarray(n, n + 128));
  return faces;
}

// A packed face against a selfie: smaller means more alike
export function distance(packed, face) {
  let sum = 0;
  for (let i = 0; i < 128; i++) sum += (packed[i] / PACK - face[i]) ** 2;
  return Math.sqrt(sum);
}
