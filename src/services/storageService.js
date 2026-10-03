"use strict";

/*
|--------------------------------------------------------------------------
| EZ MEDIA 11.0
| Storage Service
|--------------------------------------------------------------------------
|
| طبقة موحدة للتخزين.
|
| الهدف:
| - عدم ربط بقية المنصة بمزود تخزين واحد.
| - دعم S3-compatible storage.
| - تجهيز المنصة مستقبلًا لـ:
|   AWS S3
|   Cloudflare R2
|   Backblaze B2
|   وأي مزود متوافق مع S3.
|
| ملاحظة:
| المتغيرات السرية لا توضع داخل الكود.
| سيتم إعدادها في Railway في المرحلة الأخيرة.
|
|--------------------------------------------------------------------------
*/

const crypto = require("crypto");

function getStorageConfig() {
  return {
    endpoint:
      process.env.STORAGE_ENDPOINT || null,

    region:
      process.env.STORAGE_REGION ||
      "auto",

    bucket:
      process.env.STORAGE_BUCKET || null,

    accessKeyId:
      process.env.STORAGE_ACCESS_KEY_ID ||
      null,

    secretAccessKey:
      process.env.STORAGE_SECRET_ACCESS_KEY ||
      null,

    publicBaseUrl:
      process.env.STORAGE_PUBLIC_BASE_URL ||
      null
  };
}

function isStorageConfigured() {
  const config =
    getStorageConfig();

  return Boolean(
    config.endpoint &&
    config.bucket &&
    config.accessKeyId &&
    config.secretAccessKey
  );
}

function createStorageKey({
  originalName,
  folder = "media"
}) {
  const extension =
    getExtension(originalName);

  const date =
    new Date();

  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getUTCDate()
    ).padStart(2, "0");

  const uniqueId =
    crypto.randomUUID();

  const safeFolder =
    String(folder)
      .replace(/[^a-zA-Z0-9/_-]/g, "")
      .replace(/^\/+|\/+$/g, "");

  const filename =
    extension
      ? `${uniqueId}.${extension}`
      : uniqueId;

  return `${safeFolder}/${year}/${month}/${day}/${filename}`;
}

function getExtension(filename) {
  if (!filename) {
    return "";
  }

  const cleanName =
    String(filename)
      .split("?")[0]
      .split("#")[0];

  const parts =
    cleanName.split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getPublicUrl(storageKey) {
  const config =
    getStorageConfig();

  if (
    !config.publicBaseUrl ||
    !storageKey
  ) {
    return null;
  }

  return `${config.publicBaseUrl.replace(/\/+$/, "")}/${storageKey}`;
}

function detectAssetType(mimeType) {
  if (!mimeType) {
    return "file";
  }

  if (
    mimeType.startsWith("image/")
  ) {
    return "image";
  }

  if (
    mimeType.startsWith("video/")
  ) {
    return "video";
  }

  if (
    mimeType.startsWith("audio/")
  ) {
    return "audio";
  }

  if (
    mimeType.startsWith("application/pdf")
  ) {
    return "document";
  }

  return "file";
}

function validateUpload({
  originalName,
  mimeType,
  size
}) {
  const errors = [];

  if (!originalName) {
    errors.push(
      "اسم الملف مطلوب"
    );
  }

  if (!mimeType) {
    errors.push(
      "نوع الملف مطلوب"
    );
  }

  if (
    typeof size !== "number" ||
    size <= 0
  ) {
    errors.push(
      "حجم الملف غير صحيح"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | الحدود الأولية
  |--------------------------------------------------------------------------
  |
  | سيتم نقل الحدود لاحقًا إلى إعدادات المنصة.
  |
  */

  const maxFileSize =
    2 * 1024 * 1024 * 1024;

  if (
    typeof size === "number" &&
    size > maxFileSize
  ) {
    errors.push(
      "حجم الملف يتجاوز الحد المسموح"
    );
  }

  return {
    valid:
      errors.length === 0,

    errors
  };
}

async function uploadFile() {
  /*
  |--------------------------------------------------------------------------
  | هذه الطبقة هي نقطة التكامل مع Object Storage.
  |
  | لا ننفذ رفعًا وهميًا.
  | إذا لم يتم إعداد التخزين الحقيقي، نعيد حالة واضحة.
  |--------------------------------------------------------------------------
  */

  if (!isStorageConfigured()) {
    const error =
      new Error(
        "Storage is not configured"
      );

    error.code =
      "STORAGE_NOT_CONFIGURED";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | سيتم وضع تنفيذ S3 PutObject هنا بعد تثبيت
  | مزود التخزين الفعلي واعتماد بيانات الاتصال.
  |--------------------------------------------------------------------------
  */

  const error =
    new Error(
      "Storage upload adapter is not initialized"
    );

  error.code =
    "STORAGE_ADAPTER_NOT_INITIALIZED";

  throw error;
}

async function deleteFile() {
  if (!isStorageConfigured()) {
    const error =
      new Error(
        "Storage is not configured"
      );

    error.code =
      "STORAGE_NOT_CONFIGURED";

    throw error;
  }

  const error =
    new Error(
      "Storage delete adapter is not initialized"
    );

  error.code =
    "STORAGE_ADAPTER_NOT_INITIALIZED";

  throw error;
}

module.exports = {
  getStorageConfig,
  isStorageConfigured,
  createStorageKey,
  getPublicUrl,
  detectAssetType,
  validateUpload,
  uploadFile,
  deleteFile
};
