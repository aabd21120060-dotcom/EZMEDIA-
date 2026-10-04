"use strict";

const crypto = require("crypto");

const {
  S3Client,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListObjectsV2Command
} = require("@aws-sdk/client-s3");

const {
  getSignedUrl
} = require("@aws-sdk/s3-request-presigner");


function createS3StorageAdapter(
  options = {}
) {

  const {
    logger = console,

    endpoint =
      options.endpoint ||
      process.env.STORAGE_ENDPOINT,

    region =
      options.region ||
      process.env.STORAGE_REGION ||
      "auto",

    bucket =
      options.bucket ||
      process.env.STORAGE_BUCKET,

    accessKeyId =
      options.accessKeyId ||
      process.env.STORAGE_ACCESS_KEY,

    secretAccessKey =
      options.secretAccessKey ||
      process.env.STORAGE_SECRET_KEY,

    forcePathStyle =
      options.forcePathStyle ??
      (
        process.env.STORAGE_FORCE_PATH_STYLE ===
        "true"
      ),

    signedUrlSeconds =
      Number(
        options.signedUrlSeconds ||
        process.env.STORAGE_SIGNED_URL_SECONDS ||
        1800
      ),

    maxUploadPartSize =
      Number(
        options.maxUploadPartSize ||
        process.env.STORAGE_MAX_UPLOAD_PART_SIZE ||
        104857600
      )
  } = options;


  const state = {

    initialized: false,

    configured: Boolean(
      endpoint &&
      bucket &&
      accessKeyId &&
      secretAccessKey
    ),

    connected: false,

    statistics: {
      uploads: 0,
      downloads: 0,
      deletes: 0,
      copies: 0,
      multipartUploads: 0,
      multipartParts: 0,
      bytesUploaded: 0,
      bytesDownloaded: 0
    }

  };


  const client =
    state.configured
      ? new S3Client({

          region,

          endpoint,

          forcePathStyle,

          credentials: {
            accessKeyId,
            secretAccessKey
          }

        })
      : null;


  function now() {
    return new Date()
      .toISOString();
  }


  function sha256(
    value
  ) {
    return crypto
      .createHash("sha256")
      .update(
        String(value)
      )
      .digest("hex");
  }


  function sanitizeObjectKey(
    objectKey
  ) {

    if (!objectKey) {
      throw new Error(
        "objectKey is required"
      );
    }

    const normalized =
      String(objectKey)
        .replace(
          /\\/g,
          "/"
        )
        .replace(
          /^\/+/,
          ""
        );

    if (
      normalized.includes(
        ".."
      )
    ) {
      throw new Error(
        "Invalid object key"
      );
    }

    return normalized;
  }


  function requireConfigured() {

    if (!state.configured) {

      const error =
        new Error(
          "S3 storage provider is not configured"
        );

      error.code =
        "STORAGE_NOT_CONFIGURED";

      error.statusCode =
        503;

      throw error;
    }

  }


  async function initialize() {

    if (state.initialized) {
      return getStatus();
    }

    if (!state.configured) {

      state.initialized =
        true;

      return getStatus();
    }


    try {

      await client.send(
        new HeadBucketCommand({
          Bucket: bucket
        })
      );

      state.connected =
        true;

      state.initialized =
        true;

      logger.log(
        "[CODE84.1] S3 storage connected:",
        bucket
      );

    } catch (error) {

      state.initialized =
        true;

      state.connected =
        false;

      logger.error(
        "[CODE84.1] S3 connection failed:",
        error.message
      );

    }

    return getStatus();
  }


  async function healthCheck() {

    requireConfigured();

    try {

      await client.send(
        new HeadBucketCommand({
          Bucket: bucket
        })
      );

      state.connected =
        true;

      return {
        ok: true,

        provider:
          "s3-compatible",

        bucket,

        region,

        endpoint,

        connected: true,

        timestamp:
          now()
      };

    } catch (error) {

      state.connected =
        false;

      return {
        ok: false,

        provider:
          "s3-compatible",

        bucket,

        connected: false,

        error:
          error.message,

        timestamp:
          now()
      };

    }
  }


  /* ============================================================
     PRESIGNED UPLOAD
  ============================================================ */

  async function createPresignedUpload(
    input = {}
  ) {

    requireConfigured();

    const objectKey =
      sanitizeObjectKey(
        input.objectKey
      );

    const contentType =
      input.contentType ||
      "application/octet-stream";

    const expiresIn =
      Number(
        input.expiresIn ||
        signedUrlSeconds
      );


    const command =
      new PutObjectCommand({

        Bucket:
          bucket,

        Key:
          objectKey,

        ContentType:
          contentType,

        Metadata:
          input.metadata ||
          {}

      });


    const uploadUrl =
      await getSignedUrl(
        client,
        command,
        {
          expiresIn
        }
      );


    return {

      ok: true,

      method:
        "PUT",

      uploadUrl,

      objectKey,

      bucket,

      expiresIn,

      contentType,

      headers: {
        "Content-Type":
          contentType
      },

      timestamp:
        now()

    };

  }


  /* ============================================================
     PRESIGNED DOWNLOAD
  ============================================================ */

  async function createPresignedDownload(
    input = {}
  ) {

    requireConfigured();

    const objectKey =
      sanitizeObjectKey(
        input.objectKey
      );

    const expiresIn =
      Number(
        input.expiresIn ||
        signedUrlSeconds
      );


    const command =
      new GetObjectCommand({

        Bucket:
          bucket,

        Key:
          objectKey,

        ResponseContentDisposition:
          input.downloadName
            ? `attachment; filename="${String(
                input.downloadName
              ).replace(
                /"/g,
                ""
              )}"`
            : undefined

      });


    const downloadUrl =
      await getSignedUrl(
        client,
        command,
        {
          expiresIn
        }
      );


    return {

      ok: true,

      downloadUrl,

      objectKey,

      bucket,

      expiresIn,

      timestamp:
        now()

    };

  }


  /* ============================================================
     HEAD OBJECT
  ============================================================ */

  async function headObject(
    objectKey
  ) {

    requireConfigured();

    objectKey =
      sanitizeObjectKey(
        objectKey
      );


    const result =
      await client.send(
        new HeadObjectCommand({

          Bucket:
            bucket,

          Key:
            objectKey

        })
      );


    return {

      ok: true,

      objectKey,

      contentLength:
        Number(
          result.ContentLength ||
          0
        ),

      contentType:
        result.ContentType ||
        null,

      etag:
        result.ETag ||
        null,

      lastModified:
        result.LastModified ||
        null,

      metadata:
        result.Metadata ||
        {},

      checksumSHA256:
        result.ChecksumSHA256 ||
        null

    };

  }


  /* ============================================================
     DIRECT UPLOAD
  ============================================================ */

  async function uploadBuffer(
    input = {}
  ) {

    requireConfigured();

    const objectKey =
      sanitizeObjectKey(
        input.objectKey
      );

    if (!input.body) {
      throw new Error(
        "body is required"
      );
    }


    const body =
      input.body;


    const contentLength =
      Number(
        input.contentLength ??
        (
          Buffer.isBuffer(body)
            ? body.length
            : 0
        )
      );


    const command =
      new PutObjectCommand({

        Bucket:
          bucket,

        Key:
          objectKey,

        Body:
          body,

        ContentType:
          input.contentType ||
          "application/octet-stream",

        ContentLength:
          contentLength ||
          undefined,

        Metadata:
          input.metadata ||
          {}

      });


    const result =
      await client.send(
        command
      );


    state.statistics
      .uploads++;

    state.statistics
      .bytesUploaded +=
      contentLength;


    return {

      ok: true,

      objectKey,

      bucket,

      etag:
        result.ETag ||
        null,

      checksumSHA256:
        result.ChecksumSHA256 ||
        null,

      contentLength,

      timestamp:
        now()

    };

  }


  /* ============================================================
     DELETE
  ============================================================ */

  async function deleteObject(
    objectKey
  ) {

    requireConfigured();

    objectKey =
      sanitizeObjectKey(
        objectKey
      );


    await client.send(
      new DeleteObjectCommand({

        Bucket:
          bucket,

        Key:
          objectKey

      })
    );


    state.statistics
      .deletes++;


    return {

      ok: true,

      objectKey,

      deleted: true,

      timestamp:
        now()

    };

  }


  /* ============================================================
     COPY
  ============================================================ */

  async function copyObject(
    input = {}
  ) {

    requireConfigured();

    const sourceKey =
      sanitizeObjectKey(
        input.sourceKey
      );

    const destinationKey =
      sanitizeObjectKey(
        input.destinationKey
      );


    const copySource =
      `${bucket}/${sourceKey}`;


    const result =
      await client.send(
        new CopyObjectCommand({

          Bucket:
            bucket,

          Key:
            destinationKey,

          CopySource:
            copySource

        })
      );


    state.statistics
      .copies++;


    return {

      ok: true,

      sourceKey,

      destinationKey,

      etag:
        result.CopyObjectResult
          ?.ETag ||
        null,

      timestamp:
        now()

    };

  }


  /* ============================================================
     MULTIPART UPLOAD — CREATE
  ============================================================ */

  async function createMultipartUpload(
    input = {}
  ) {

    requireConfigured();

    const objectKey =
      sanitizeObjectKey(
        input.objectKey
      );


    const command =
      new CreateMultipartUploadCommand({

        Bucket:
          bucket,

        Key:
          objectKey,

        ContentType:
          input.contentType ||
          "application/octet-stream",

        Metadata:
          input.metadata ||
          {}

      });


    const result =
      await client.send(
        command
      );


    state.statistics
      .multipartUploads++;


    return {

      ok: true,

      uploadId:
        result.UploadId,

      objectKey,

      bucket,

      timestamp:
        now()

    };

  }


  /* ============================================================
     MULTIPART — SIGN PART
  ============================================================ */

  async function createMultipartPartUrl(
    input = {}
  ) {

    requireConfigured();

    const objectKey =
      sanitizeObjectKey(
        input.objectKey
      );

    const uploadId =
      String(
        input.uploadId ||
        ""
      );

    const partNumber =
      Number(
        input.partNumber
      );


    if (!uploadId) {
      throw new Error(
        "uploadId is required"
      );
    }


    if (
      !Number.isInteger(
        partNumber
      ) ||
      partNumber < 1 ||
      partNumber > 10000
    ) {
      throw new Error(
        "Invalid multipart part number"
      );
    }


    const command =
      new UploadPartCommand({

        Bucket:
          bucket,

        Key:
          objectKey,

        UploadId:
          uploadId,

        PartNumber:
          partNumber

      });


    const url =
      await getSignedUrl(
        client,
        command,
        {
          expiresIn:
            signedUrlSeconds
        }
      );


    return {

      ok: true,

      method:
        "PUT",

      url,

      uploadId,

      partNumber,

      objectKey,

      expiresIn:
        signedUrlSeconds

    };

  }


  /* ============================================================
     MULTIPART — COMPLETE
  ============================================================ */

  async function completeMultipartUpload(
    input = {}
  ) {

    requireConfigured();

    const objectKey =
      sanitizeObjectKey(
        input.objectKey
      );

    const uploadId =
      String(
        input.uploadId ||
        ""
      );

    const parts =
      Array.isArray(
        input.parts
      )
        ? input.parts
        : [];


    if (!uploadId) {
      throw new Error(
        "uploadId is required"
      );
    }


    if (!parts.length) {
      throw new Error(
        "Multipart parts are required"
      );
    }


    const normalizedParts =
      parts
        .map(
          part => ({

            PartNumber:
              Number(
                part.PartNumber ??
                part.partNumber
              ),

            ETag:
              part.ETag ??
              part.etag

          })
        )
        .sort(
          (
            a,
            b
          ) =>
            a.PartNumber -
            b.PartNumber
        );


    const command =
      new CompleteMultipartUploadCommand({

        Bucket:
          bucket,

        Key:
          objectKey,

        UploadId:
          uploadId,

        MultipartUpload: {
          Parts:
            normalizedParts
        }

      });


    const result =
      await client.send(
        command
      );


    state.statistics
      .multipartParts +=
      normalizedParts.length;


    return {

      ok: true,

      objectKey,

      uploadId,

      etag:
        result.ETag ||
        null,

      location:
        result.Location ||
        null,

      parts:
        normalizedParts,

      timestamp:
        now()

    };

  }


  /* ============================================================
     MULTIPART — ABORT
  ============================================================ */

  async function abortMultipartUpload(
    input = {}
  ) {

    requireConfigured();

    const objectKey =
      sanitizeObjectKey(
        input.objectKey
      );

    const uploadId =
      String(
        input.uploadId ||
        ""
      );


    if (!uploadId) {
      throw new Error(
        "uploadId is required"
      );
    }


    await client.send(
      new AbortMultipartUploadCommand({

        Bucket:
          bucket,

        Key:
          objectKey,

        UploadId:
          uploadId

      })
    );


    return {

      ok: true,

      aborted: true,

      objectKey,

      uploadId,

      timestamp:
        now()

    };

  }


  /* ============================================================
     LIST OBJECTS
  ============================================================ */

  async function listObjects(
    input = {}
  ) {

    requireConfigured();

    const prefix =
      input.prefix
        ? sanitizeObjectKey(
            input.prefix
          )
        : undefined;


    const maxKeys =
      Math.min(
        Number(
          input.maxKeys ||
          1000
        ),
        1000
      );


    const result =
      await client.send(
        new ListObjectsV2Command({

          Bucket:
            bucket,

          Prefix:
            prefix,

          MaxKeys:
            maxKeys,

          ContinuationToken:
            input.continuationToken ||
            undefined

        })
      );


    return {

      ok: true,

      bucket,

      prefix:
        prefix ||
        null,

      objects:
        (
          result.Contents ||
          []
        ).map(
          object => ({

            key:
              object.Key,

            size:
              Number(
                object.Size ||
                0
              ),

            etag:
              object.ETag ||
              null,

            lastModified:
              object.LastModified ||
              null

          })
        ),

      isTruncated:
        Boolean(
          result.IsTruncated
        ),

      nextContinuationToken:
        result.NextContinuationToken ||
        null

    };

  }


  /* ============================================================
     STATUS
  ============================================================ */

  function getStatus() {

    return {

      service:
        "S3-Compatible Storage Adapter",

      code:
        "CODE 84.1",

      provider:
        "s3-compatible",

      configured:
        state.configured,

      connected:
        state.connected,

      endpoint:
        endpoint ||
        null,

      bucket:
        bucket ||
        null,

      region,

      forcePathStyle,

      signedUrlSeconds,

      maxUploadPartSize,

      statistics:
        {
          ...state.statistics
        },

      timestamp:
        now()

    };

  }


  return {

    initialize,

    healthCheck,

    getStatus,

    createPresignedUpload,

    createPresignedDownload,

    uploadBuffer,

    headObject,

    deleteObject,

    copyObject,

    createMultipartUpload,

    createMultipartPartUrl,

    completeMultipartUpload,

    abortMultipartUpload,

    listObjects,

    sha256

  };

}


module.exports = {
  createS3StorageAdapter
};
