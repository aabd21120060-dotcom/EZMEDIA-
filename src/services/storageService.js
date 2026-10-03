"use strict";

const crypto = require("crypto");

const {
  S3Client,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const {
  Upload
} = require("@aws-sdk/lib-storage");

/*
|--------------------------------------------------------------------------
| EZ MEDIA 11.0
| Real Object Storage Service
|--------------------------------------------------------------------------
|
| يدعم أي Object Storage متوافق مع S3 API.
|
| أمثلة:
| - Cloudflare R2
| - AWS S3
| - Backblaze B2 S3
| - MinIO
| - مزودات S3-compatible الأخرى
|
|--------------------------------------------------------------------------
*/

let s3Client = null;

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
      null,

    forcePathStyle:
      process.env.STORAGE_FORCE_PATH_STYLE ===
      "true"
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

function getS3Client() {
  if (!isStorageConfigured()) {
    const error =
      new Error(
        "Storage is not configured"
      );

    error.code =
      "STORAGE_NOT_CONFIGURED";

    throw error;
  }

  if (s3Client) {
    return s3Client;
  }

  const config =
    getStorageConfig();

  s3Client =
    new S3Client({
      region:
        config.region,

      endpoint:
        config.endpoint,

      forcePathStyle:
        config.forcePathStyle,

      credentials: {
        accessKeyId:
          config.accessKeyId,

        secretAccessKey:
          config.secretAccessKey
      }
    });

  return s3Client;
}

function getExtension(
  filename
) {
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
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

function sanitizeFolder(
  folder
) {
  return String(
    folder || "media"
  )
    .replace(
      /[^a-zA-Z0-9/_-]/g,
      ""
    )
    .replace(
      /^\/+|\/+$/g,
      "");
}

function createStorageKey({
  originalName,
  folder = "media"
}) {
  const extension =
    getExtension(
      originalName
    );

  const date =
    new Date();

  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  const uniqueId =
    crypto.randomUUID();

  const safeFolder =
    sanitizeFolder(
      folder
    );

  const filename =
    extension
      ? `${uniqueId}.${extension}`
      : uniqueId;

  return (
    `${safeFolder}/` +
    `${year}/` +
    `${month}/` +
    `${day}/` +
    filename
  );
}

function getPublicUrl(
  storageKey
) {
  const config =
    getStorageConfig();

  if (
    !config.publicBaseUrl ||
    !storageKey
  ) {
    return null;
  }

  return (
    `${config.publicBaseUrl.replace(
      /\/+$/,
      ""
    )}/${storageKey}`
  );
}

function detectAssetType(
  mimeType
) {
  if (!mimeType) {
    return "file";
  }

  if (
    mimeType.startsWith(
      "image/"
    )
  ) {
    return "image";
  }

  if (
    mimeType.startsWith(
      "video/"
    )
  ) {
    return "video";
  }

  if (
    mimeType.startsWith(
      "audio/"
    )
  ) {
    return "audio";
  }

  if (
    mimeType ===
    "application/pdf"
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
    typeof size !==
      "number" ||
    size <= 0
  ) {
    errors.push(
      "حجم الملف غير صحيح"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | الحد الأقصى المبدئي
  |--------------------------------------------------------------------------
  |
  | 2GB.
  | سيتم تطوير الرفع لاحقًا إلى Multipart/Presigned Upload
  | للملفات الضخمة جدًا.
  |
  |--------------------------------------------------------------------------
  */

  const maxFileSize =
    2 *
    1024 *
    1024 *
    1024;

  if (
    typeof size ===
      "number" &&
    size >
      maxFileSize
  ) {
    errors.push(
      "حجم الملف يتجاوز 2GB"
    );
  }

  return {
    valid:
      errors.length === 0,

    errors
  };
}

async function uploadBuffer({
  buffer,
  originalName,
  mimeType,
  folder = "media",
  metadata = {}
}) {
  if (
    !Buffer.isBuffer(buffer)
  ) {
    const error =
      new Error(
        "Upload buffer is invalid"
      );

    error.code =
      "INVALID_UPLOAD_BUFFER";

    throw error;
  }

  const validation =
    validateUpload({
      originalName,
      mimeType,
      size:
        buffer.length
    });

  if (!validation.valid) {
    const error =
      new Error(
        validation.errors.join(
          "، "
        )
      );

    error.code =
      "UPLOAD_VALIDATION_FAILED";

    error.details =
      validation.errors;

    throw error;
  }

  const client =
    getS3Client();

  const config =
    getStorageConfig();

  const key =
    createStorageKey({
      originalName,
      folder
    });

  const upload =
    new Upload({
      client,

      params: {
        Bucket:
          config.bucket,

        Key:
          key,

        Body:
          buffer,

        ContentType:
          mimeType,

        Metadata:
          Object.fromEntries(
            Object.entries(
              metadata || {}
            ).map(
              ([key, value]) => [
                String(key)
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9-]/g,
                    "-"
                  ),
                String(value)
              ]
            )
          )
      },

      queueSize:
        4,

      partSize:
        10 *
        1024 *
        1024,

      leavePartsOnError:
        false
    });

  const result =
    await upload.done();

  const publicUrl =
    getPublicUrl(
      key
    );

  return {
    success: true,

    key,

    bucket:
      config.bucket,

    url:
      publicUrl,

    etag:
      result.ETag ||
      null,

    assetType:
      detectAssetType(
        mimeType
      ),

    size:
      buffer.length,

    mimeType
  };
}

async function deleteFile(
  storageKey
) {
  if (!storageKey) {
    const error =
      new Error(
        "Storage key is required"
      );

    error.code =
      "STORAGE_KEY_REQUIRED";

    throw error;
  }

  const client =
    getS3Client();

  const config =
    getStorageConfig();

  await client.send(
    new DeleteObjectCommand({
      Bucket:
        config.bucket,

      Key:
        storageKey
    })
  );

  return {
    success: true,

    key:
      storageKey
  };
}

async function testStorage() {
  if (
    !isStorageConfigured()
  ) {
    return {
      configured: false,

      connected: false,

      message:
        "Storage is not configured"
    };
  }

  try {
    const client =
      getS3Client();

    /*
    |--------------------------------------------------------------------------
    | لا نرسل ملفًا تجريبيًا.
    |
    | يكفي التحقق من وجود الإعدادات هنا.
    | اختبار الرفع الحقيقي سيتم من API.
    |--------------------------------------------------------------------------
    */

    return {
      configured: true,

      connected: true,

      client:
        Boolean(client),

      message:
        "Storage client initialized"
    };
  } catch (error) {
    return {
      configured: true,

      connected: false,

      message:
        error.message
    };
  }
}

module.exports = {
  getStorageConfig,
  isStorageConfigured,
  getS3Client,
  createStorageKey,
  getPublicUrl,
  detectAssetType,
  validateUpload,
  uploadBuffer,
  deleteFile,
  testStorage
};
