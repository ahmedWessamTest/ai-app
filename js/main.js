// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  ImageSegmenter,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

// Get DOM elements
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
const webcamPredictions = document.getElementById("webcamPredictions");
const demosSection = document.getElementById("demos");
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";
let runningMode = "VIDEO";
const resultWidthHeigth = 256;

let imageSegmenter;
let labels;

const legendColors = [
  [255, 197, 0, 255], // Vivid Yellow
  [128, 62, 117, 255], // Strong Purple
  [255, 104, 0, 255], // Vivid Orange
  [166, 189, 215, 255], // Very Light Blue
  [193, 0, 32, 255], // Vivid Red
  [206, 162, 98, 255], // Grayish Yellow
  [129, 112, 102, 255], // Medium Gray
  [0, 125, 52, 255], // Vivid Green
  [246, 118, 142, 255], // Strong Purplish Pink
  [0, 83, 138, 255], // Strong Blue
  [255, 112, 92, 255], // Strong Yellowish Pink
  [83, 55, 112, 255], // Strong Violet
  [255, 142, 0, 255], // Vivid Orange Yellow
  [179, 40, 81, 255], // Strong Purplish Red
  [244, 200, 0, 255], // Vivid Greenish Yellow
  [127, 24, 13, 255], // Strong Reddish Brown
  [147, 170, 0, 255], // Vivid Yellowish Green
  [89, 51, 21, 255], // Deep Yellowish Brown
  [241, 58, 19, 255], // Vivid Reddish Orange
  [35, 44, 22, 255], // Dark Olive Green
  [0, 161, 194, 255], // Vivid Blue
];

const createImageSegmenter = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
  );

  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      // تم تحديث الرابط للموديل المتاح حالياً والمستقر
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
      delegate: "GPU",
    },
    runningMode: runningMode,
    outputCategoryMask: true, // سنستخدم الـ Category Mask لتحديد نوع الكائن
    outputConfidenceMasks: false,
  });

  labels = imageSegmenter.getLabels();
  demosSection.classList.remove("invisible");
};
createImageSegmenter();

const imageContainers = document.getElementsByClassName("segmentOnClick");

// Add click event listeners for the img elements.
for (let i = 0; i < imageContainers.length; i++) {
  imageContainers[i]
    .getElementsByTagName("img")[0]
    .addEventListener("click", handleClick);
}

/**
 * Demo 1: Segmented images on click and display results.
 */
let canvasClick;
async function handleClick(event) {
  // Do not segmented if imageSegmenter hasn't loaded
  if (imageSegmenter === undefined) {
    return;
  }
  canvasClick = event.target.parentElement.getElementsByTagName("canvas")[0];
  canvasClick.classList.remove("removed");
  canvasClick.width = event.target.naturalWidth;
  canvasClick.height = event.target.naturalHeight;
  const cxt = canvasClick.getContext("2d");
  cxt.clearRect(0, 0, canvasClick.width, canvasClick.height);
  cxt.drawImage(event.target, 0, 0, canvasClick.width, canvasClick.height);
  event.target.style.opacity = 0;
  // if VIDEO mode is initialized, set runningMode to IMAGE
  if (runningMode === "VIDEO") {
    runningMode = "IMAGE";
    await imageSegmenter.setOptions({
      runningMode: runningMode,
    });
  }

  // imageSegmenter.segment() when resolved will call the callback function.
  imageSegmenter.segment(event.target, callback);
}

function callback(result) {
  const cxt = canvasClick.getContext("2d");
  const { width, height } = result.categoryMask;
  let imageData = cxt.getImageData(0, 0, width, height).data;
  canvasClick.width = width;
  canvasClick.height = height;
  let category = "";
  const mask = result.categoryMask.getAsUint8Array();
  for (let i in mask) {
    if (mask[i] > 0) {
      category = labels[mask[i]];
    }
    const legendColor = legendColors[mask[i] % legendColors.length];
    imageData[i * 4] = (legendColor[0] + imageData[i * 4]) / 2;
    imageData[i * 4 + 1] = (legendColor[1] + imageData[i * 4 + 1]) / 2;
    imageData[i * 4 + 2] = (legendColor[2] + imageData[i * 4 + 2]) / 2;
    imageData[i * 4 + 3] = (legendColor[3] + imageData[i * 4 + 3]) / 2;
  }
  const uint8Array = new Uint8ClampedArray(imageData.buffer);
  const dataNew = new ImageData(uint8Array, width, height);
  cxt.putImageData(dataNew, 0, 0);
  const p = event.target.parentNode.getElementsByClassName("classification")[0];
  p.classList.remove("removed");
  p.innerText = "Category: " + category;
}

// افترض أن عندك متغير للون المختار
let selectedColor = [255, 0, 0, 150]; // أحمر مع شفافية
let currentOpacity = 0.5;
const slider = document.getElementById("opacitySlider");
const opacityLabel = document.getElementById("opacityValue");

window.changeColor = function (rgbArray) {
  selectedColor = rgbArray;
};
slider.oninput = function () {
  currentOpacity = this.value / 100;
  opacityLabel.innerText = this.value + "%";
};
function callbackForVideo(result) {
  // التأكد من وجود البيانات لمنع الـ Error اللي ظهرلك
  if (!result || !result.categoryMask) {
    return;
  }

  const { width, height } = result.categoryMask;
  let imageData = canvasCtx.getImageData(0, 0, width, height).data;

  // سحب القناع كأرقام (0 للخلفية، 1 للشعر، 2 للوجه، إلخ)
  const mask = result.categoryMask.getAsUint8Array();

  for (let i = 0; i < mask.length; i++) {
    // رقم 1 في هذا الموديل يمثل الشعر (Hair)
    if (mask[i] === 1) {
      const j = i * 4;

      // معادلة الدمج (Alpha Blending) لجعل اللون يبدو طبيعياً
      // تدمج بين اللون الأصلي (imageData) واللون المختار (selectedColor)
      imageData[j] =
        selectedColor[0] * currentOpacity + imageData[j] * (1 - currentOpacity);
      imageData[j + 1] =
        selectedColor[1] * currentOpacity +
        imageData[j + 1] * (1 - currentOpacity);
      imageData[j + 2] =
        selectedColor[2] * currentOpacity +
        imageData[j + 2] * (1 - currentOpacity);
    }
  }

  const uint8Array = new Uint8ClampedArray(imageData.buffer);
  const dataNew = new ImageData(uint8Array, width, height);
  canvasCtx.putImageData(dataNew, 0, 0);

  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and segmented it.
********************************************************************/

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Get segmentation from the webcam
let lastWebcamTime = -1;
async function predictWebcam() {
  if (video.currentTime === lastWebcamTime) {
    if (webcamRunning === true) {
      window.requestAnimationFrame(predictWebcam);
    }
    return;
  }
  lastWebcamTime = video.currentTime;
  canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  // Do not segmented if imageSegmenter hasn't loaded
  if (imageSegmenter === undefined) {
    return;
  }
  // if image mode is initialized, create a new segmented with video runningMode
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await imageSegmenter.setOptions({
      runningMode: runningMode,
    });
  }
  let startTimeMs = performance.now();

  // Start segmenting the stream.
  imageSegmenter.segmentForVideo(video, startTimeMs, callbackForVideo);
}

// Enable the live webcam view and start imageSegmentation.
async function enableCam(event) {
  if (imageSegmenter === undefined) {
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE SEGMENTATION";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE SEGMENTATION";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true,
  };

  // Activate the webcam stream.
  video.srcObject = await navigator.mediaDevices.getUserMedia(constraints);
  video.addEventListener("loadeddata", predictWebcam);
}

// If webcam supported, add event listener to button.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}
