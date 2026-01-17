import {
  ImageSegmenter,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const webcamButton = document.getElementById("webcamButton");
const opacitySlider = document.getElementById("opacitySlider");
const opacityVal = document.getElementById("opacityVal");

let imageSegmenter;
let webcamRunning = false;
let selectedColor = [139, 69, 19]; // بني افتراضي
let currentOpacity = 0.6;

// تحديث الشفافية من السلايدر
opacitySlider.oninput = function () {
  currentOpacity = this.value / 100;
  opacityVal.innerText = this.value + "%";
};

// تحديث اللون المختار
window.updateColor = function (rgb) {
  selectedColor = rgb;
};

// تحميل الموديل
const setupSegmenter = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
  );
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    outputCategoryMask: true,
  });
  console.log("Model Loaded");
};
setupSegmenter();

// تشغيل الكاميرا
// ... (نفس التعريفات في البداية)

webcamButton.addEventListener("click", async () => {
  if (!imageSegmenter) {
    alert("برجاء الانتظار حتى تحميل الموديل...");
    return;
  }

  if (webcamRunning) {
    webcamRunning = false;
    webcamButton.innerText = "تشغيل الكاميرا";
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
  } else {
    // إعدادات الموبايل
    const constraints = {
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      webcamRunning = true;
      webcamButton.innerText = "إيقاف الكاميرا";
      video.addEventListener("loadeddata", predictWebcam);
    } catch (err) {
      alert("خطأ: تأكد من تشغيل الموقع عبر HTTPS وإعطاء إذن الكاميرا.");
      console.error(err);
    }
  }
});

let lastVideoTime = -1;
async function predictWebcam() {
  if (video.currentTime === lastVideoTime) {
    if (webcamRunning) window.requestAnimationFrame(predictWebcam);
    return;
  }
  lastVideoTime = video.currentTime;

  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  // إرسال الفريم للموديل
  const startTimeMs = performance.now();
  imageSegmenter.segmentForVideo(video, startTimeMs, (result) => {
    processSegmentation(result);
  });

  if (webcamRunning) window.requestAnimationFrame(predictWebcam);
}

function processSegmentation(result) {
  const { width, height } = result.categoryMask;
  // رسم الصورة الأصلية من الكاميرا أولاً
  canvasCtx.drawImage(video, 0, 0, width, height);

  let imageDataObj = canvasCtx.getImageData(0, 0, width, height);
  let pixels = imageDataObj.data;
  const mask = result.categoryMask.getAsUint8Array();

  for (let i = 0; i < mask.length; i++) {
    // رقم 1 في الموديل ده هو الشعر
    if (mask[i] === 1) {
      const rIdx = i * 4;

      // معادلة الدقة (Luminosity Blending):
      // بنحسب سطوع البكسل الأصلي عشان نحافظ على شكل الخصلة
      const originalR = pixels[rIdx];
      const originalG = pixels[rIdx + 1];
      const originalB = pixels[rIdx + 2];

      const brightness = (originalR + originalG + originalB) / 3;
      const lightFactor = brightness / 128; // معامل الإضاءة

      // دمج اللون المختار مع مراعاة تفاصيل الخصلة الأصلية
      pixels[rIdx] =
        selectedColor[0] * lightFactor * currentOpacity +
        originalR * (1 - currentOpacity);
      pixels[rIdx + 1] =
        selectedColor[1] * lightFactor * currentOpacity +
        originalG * (1 - currentOpacity);
      pixels[rIdx + 2] =
        selectedColor[2] * lightFactor * currentOpacity +
        originalB * (1 - currentOpacity);
    }
  }

  canvasCtx.putImageData(imageDataObj, 0, 0);
}
const colorItems = document.querySelectorAll(".color-item");
colorSlider.addEventListener("scroll", () => {
  let closestItem = null;
  let minDistance = Infinity;
  const centerX =
    colorSlider.getBoundingClientRect().left + colorSlider.offsetWidth / 2;

  colorItems.forEach((item) => {
    const itemCenter = item.getBoundingClientRect().left + item.offsetWidth / 2;
    const distance = Math.abs(centerX - itemCenter);

    if (distance < minDistance) {
      minDistance = distance;
      closestItem = item;
    }
    item.style.transform = "scale(1)"; // تصغير الألوان البعيدة
  });

  if (closestItem) {
    closestItem.style.transform = "scale(1.3)"; // تكبير اللون اللي في النص
    const colorData = JSON.parse(closestItem.getAttribute("data-color"));
    selectedColor = colorData; // تحديث اللون المطبق على الشعر فوراً
  }
});
