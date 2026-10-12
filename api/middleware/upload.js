const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

// `fields` entries are either a plain field name (one file, as before) or an
// object for a multi-file field:
//   { name, maxCount, imageOnly, allowedExtensions, maxFileSize }
// A multi-file field leaves its uploaded paths in `req.body[name]` as an array.
const normalizeField = (field) => (typeof field === "string" ? { name: field, maxCount: 1 } : { maxCount: 1, ...field });

const removeFile = (filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch (_) {}
};

const getUploadMiddleware = (folderPath, fields = []) => {
  const fieldConfigs = fields.map(normalizeField);
  const singleNames = fieldConfigs.filter((f) => f.maxCount <= 1).map((f) => f.name);
  const multiConfigs = new Map(fieldConfigs.filter((f) => f.maxCount > 1).map((f) => [f.name, f]));

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      cb(null, folderPath);
    },
    filename: function (req, file, cb) {
      if (multiConfigs.has(file.fieldname)) {
        // Several files can arrive in the same millisecond, so the timestamp alone is not unique.
        const ext = path.extname(file.originalname).toLowerCase();
        const newFile = `${file.fieldname}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
        return cb(null, newFile);
      }

      const ext = file.originalname.substring(file.originalname.lastIndexOf("."));
      const newFile = file.fieldname + "-" + Date.now() + ext;
      const filePath = folderPath + "/" + newFile;

      // Only set the field if it's not already set or if it's empty
      if (!req.body[file.fieldname] || req.body[file.fieldname] === "") {
        req.body[file.fieldname] = filePath;
      }

      cb(null, newFile);
    },
  });

  const upload = multer({ storage: storage });

  // Create an array of field objects based on the 'fields' parameter
  const uploadFields = fieldConfigs.map((config) => ({
    name: config.name,
    maxCount: config.maxCount,
  }));

  const uploadMiddleware = upload.fields(uploadFields);

  // Rejects the whole request when any file in a multi-file field breaks its
  // rules, so a bad batch never leaves half of it saved.
  const validateMultiFields = async (req) => {
    for (const [name, config] of multiConfigs) {
      for (const file of (req.files && req.files[name]) || []) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (config.allowedExtensions && !config.allowedExtensions.includes(ext)) {
          return `${file.originalname}: unsupported file type. Allowed: ${config.allowedExtensions.join(", ")}`;
        }
        if (config.maxFileSize && file.size > config.maxFileSize) {
          return `${file.originalname}: file is larger than ${Math.round(config.maxFileSize / (1024 * 1024))}MB`;
        }
        if (config.imageOnly) {
          try {
            await sharp(file.path).metadata();
          } catch (_) {
            return `${file.originalname}: not a valid image`;
          }
        }
      }
    }
    return null;
  };

  const discardAllFiles = (req) => {
    Object.values(req.files || {}).forEach((list) => list.forEach((file) => removeFile(file.path)));
  };

  return (req, res, next) => {
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        discardAllFiles(req);
        if (err.code === "LIMIT_UNEXPECTED_FILE" && multiConfigs.has(err.field)) {
          return res.status(400).json({
            success: false,
            message: `You can upload up to ${multiConfigs.get(err.field).maxCount} images at a time.`,
          });
        }
        return next(err);
      }

      const problem = await validateMultiFields(req);
      if (problem) {
        discardAllFiles(req);
        return res.status(400).json({ success: false, message: problem });
      }

      for (const name of multiConfigs.keys()) {
        const uploaded = ((req.files && req.files[name]) || []).map((file) => folderPath + "/" + file.filename);
        if (uploaded.length) {
          req.body[name] = uploaded;
        } else {
          delete req.body[name];
        }
      }

      // Clean up the request body - remove any fields that are not strings or are empty
      singleNames.forEach((fieldName) => {
        const value = req.body[fieldName];
        if (value && typeof value !== "string") {
          // If it's not a string, remove it
          delete req.body[fieldName];
        } else if (value === "" || value === null || value === undefined) {
          // If it's empty, remove it
          delete req.body[fieldName];
        }
      });

      next();
    });
  };
};

module.exports = getUploadMiddleware;
