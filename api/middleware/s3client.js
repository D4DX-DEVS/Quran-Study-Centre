const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@smithy/node-http-handler");
const fs = require("fs");
const dotenv = require("dotenv");
const sharp = require("sharp");
dotenv.config({ path: ".env" });
const mime = require("mime-types");

const s3 = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 15000,
    socketTimeout: 120000,
  }),
});

exports.getS3Middleware = (fieldNames, doThumbnail = true, compress = true, maxWidth = 1000, deleteFile = true) => {
  return async (req, res, next) => {
    // Keys already pushed to storage by this request, so a failed batch can be rolled back.
    const uploadedKeys = [];

    // Uploads one local file (plus thumbnail / old-file cleanup) and returns its storage keys.
    const uploadFile = async (filePath, ogFilePath = "") => {
      const folder = process.env.DO_SPACES_FOLDER || "";
      const s3Key = folder ? `${folder}/${filePath}` : filePath;

      const isImage = filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") || filePath.endsWith(".png");
      let thumbnailKey = "";
      const shouldCompress = compress && isImage;
      let fileContent;
      let ContentType;

      try {
        if (shouldCompress) {
          fileContent = await sharp(filePath).resize({ width: maxWidth }).png({ quality: 100 }).toBuffer();
          ContentType = mime.lookup(filePath) || "application/octet-stream";
        } else {
          fileContent = fs.readFileSync(filePath);
          ContentType = mime.lookup(filePath) || "application/octet-stream";
        }
      } catch (ee) {
        console.log("error reading file", ee);
        fileContent = fs.readFileSync(filePath);
      }

      // Upload main file — error propagates up so request fails cleanly
      await s3.send(new PutObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: ContentType,
        ACL: "public-read",
      }));
      uploadedKeys.push(s3Key);

      if (doThumbnail && isImage) {
        const lastSlashIndex = s3Key.lastIndexOf("/");
        if (lastSlashIndex !== -1) {
          thumbnailKey = s3Key.slice(0, lastSlashIndex + 1) + "thumbnail/" + s3Key.slice(lastSlashIndex + 1);
        }
        const thumbnailContent = await sharp(filePath).resize({ width: 100 }).png({ quality: 100 }).toBuffer();
        await s3.send(new PutObjectCommand({
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: thumbnailKey,
          Body: thumbnailContent,
          ContentType: "image/png",
          ACL: "public-read",
        }));
        uploadedKeys.push(thumbnailKey);
      }

      if (deleteFile) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }

      if (ogFilePath.length > 0) {
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: ogFilePath,
          }));
        } catch (error) {
          if (error.$metadata?.httpStatusCode !== 404) {
            console.log("Error deleting old object", error);
          }
        }
      }

      return { s3Key, thumbnailKey };
    };

    const processField = async (fieldName) => {
      const filePath = req.body[fieldName];
      const ogFilePath = req.body["old_" + fieldName] || "";

      if (typeof filePath === "undefined" || filePath === null || filePath === "") {
        delete req.body[fieldName];
        delete req.body[fieldName + "Thumbnail"];
        return;
      }

      // Multi-file field: the upload middleware leaves an array of local paths.
      // Order is kept; the field ends up as an array of storage keys.
      if (Array.isArray(filePath)) {
        const keys = [];
        for (const item of filePath) {
          if (typeof item !== "string" || item === "") continue;
          const { s3Key } = await uploadFile(item);
          keys.push(s3Key);
        }
        req.body = { ...req.body, [fieldName]: keys };
        return;
      }

      if (typeof filePath !== "string") {
        console.log(`Invalid filePath for field ${fieldName}:`, filePath);
        delete req.body[fieldName];
        delete req.body[fieldName + "Thumbnail"];
        return;
      }

      const { s3Key, thumbnailKey } = await uploadFile(filePath, ogFilePath);

      if (doThumbnail) {
        req.body = { ...req.body, [fieldName]: s3Key, [fieldName + "Thumbnail"]: thumbnailKey };
      } else {
        req.body = { ...req.body, [fieldName]: s3Key };
      }
    };

    try {
      await Promise.all(fieldNames.map(processField));
      next();
    } catch (error) {
      console.log("DO Spaces upload failed:", error.name, error.message);
      fieldNames.forEach((fieldName) => {
        const value = req.body[fieldName];
        (Array.isArray(value) ? value : [value]).forEach((fp) => {
          if (fp && typeof fp === "string" && fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch (_) {}
          }
        });
      });
      // Roll back anything this request already stored, so a failed batch leaves no orphans.
      await Promise.all(
        uploadedKeys.map((Key) =>
          s3.send(new DeleteObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key })).catch(() => {})
        )
      );
      return res.status(500).json({ success: false, message: "File upload to storage failed. Please try again." });
    }
  };
};
