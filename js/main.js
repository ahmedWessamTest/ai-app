import {
  ImageSegmenter,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const colorSlider = document.getElementById("colorSlider");
const btnStart = document.getElementById("btn-start");
const opacitySlider = document.getElementById("opacitySlider");

let imageSegmenter;
let selectedColor = [139, 69, 19];
let currentOpacity = 0.5;
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let isProcessing = false;

// في دالة init المحدثة
async function init() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
        delegate: isMobile ? "CPU" : "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: true,
    });

    // تغيير نص الزرار بعد التحميل
    btnStart.innerText = "ابدأ التجربة";
    btnStart.disabled = false; // تفعيل الزرار
    console.log("Model is ready!");
  } catch (error) {
    console.error("فشل تحميل الموديل:", error);
    btnStart.innerText = "حدث خطأ في التحميل";
  }
}
init();

// 2. إدارة الكاميرا
btnStart.onclick = async () => {
  const constraints = {
    video: { facingMode: "user", width: isMobile ? 480 : 640 },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  btnStart.style.display = "none";
  video.addEventListener("loadeddata", predictWebcam);
};

// 3. كشف اللون المختار في نص الشريط (WhatsApp Style)
colorSlider.onscroll = () => {
  const items = document.querySelectorAll(".color-item");
  const center =
    colorSlider.getBoundingClientRect().left + colorSlider.offsetWidth / 2;
  items.forEach((item) => {
    const itemCenter = item.getBoundingClientRect().left + item.offsetWidth / 2;
    if (Math.abs(center - itemCenter) < 30) {
      selectedColor = JSON.parse(item.dataset.color);
      item.style.transform = "scale(1.2)";
    } else {
      item.style.transform = "scale(1)";
    }
  });
};

opacitySlider.oninput = (e) => (currentOpacity = e.target.value / 100);

// 4. المعالجة الأساسية
async function predictWebcam() {
  if (!imageSegmenter) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }
  if (isProcessing) {
    window.requestAnimationFrame(predictWebcam);
    return;
  }

  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  isProcessing = true;
  const startTimeMs = performance.now();

  imageSegmenter.segmentForVideo(video, startTimeMs, (result) => {
    renderHair(result);
    isProcessing = false;
  });

  window.requestAnimationFrame(predictWebcam);
}

function renderHair(result) {
  const mask = result.categoryMask.getAsUint8Array();
  const { width, height } = result.categoryMask;

  // رسم الكاميرا
  canvasCtx.save();
  canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

  let imgData = canvasCtx.getImageData(
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );
  let pixels = imgData.data;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) {
      // منطقة الشعر
      const j = i * 4;

      // معادلة Soft Blending للحفاظ على الخصلات
      const brightness = (pixels[j] + pixels[j + 1] + pixels[j + 2]) / 3;
      const ratio = brightness / 255;

      // دمج اللون مع لمعة الشعر الأصلية
      pixels[j] =
        selectedColor[0] * ratio * currentOpacity +
        pixels[j] * (1 - currentOpacity);
      pixels[j + 1] =
        selectedColor[1] * ratio * currentOpacity +
        pixels[j + 1] * (1 - currentOpacity);
      pixels[j + 2] =
        selectedColor[2] * ratio * currentOpacity +
        pixels[j + 2] * (1 - currentOpacity);
    }
  }

  canvasCtx.putImageData(imgData, 0, 0);
  canvasCtx.restore();
}
