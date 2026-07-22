// One-off fix: every hall-ticket PDF was uploaded to DO Spaces without
// ACL: "public-read" (bug in the original hallTicket.js upload code, fixed
// going forward), so download links 403 with AccessDenied. This patches the
// ACL on every already-uploaded object in place — no PDF regeneration needed.
// Usage: node scripts/fix-hall-ticket-acl.js

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env");
const raw = fs.readFileSync(envPath, "utf8");
raw.split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) return;
  let val = m[2];
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!(m[1] in process.env)) process.env[m[1]] = val;
});

const mongoose = require("mongoose");
const { S3Client, PutObjectAclCommand } = require("@aws-sdk/client-s3");
const HallTicket = require("../models/hallTicket.js");

const s3 = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

const CONCURRENCY = 8;

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected:", mongoose.connection.host);

  let tickets = await HallTicket.find({ status: "generated", pdfUrl: { $ne: null } }).select("pdfUrl");
  console.log(`${tickets.length} tickets with a pdfUrl to fix.`);

  const limit = parseInt(process.argv[2], 10);
  if (limit) {
    tickets = tickets.slice(0, limit);
    console.log(`--limit passed, only fixing first ${tickets.length}.`);
  }

  const cdnPrefix = process.env.DO_SPACES_CDN_ENDPOINT + "/";
  let cursor = 0;
  let done = 0;
  let failed = 0;

  const worker = async () => {
    while (cursor < tickets.length) {
      const t = tickets[cursor++];
      // Stored pdfUrl carries a "?v=<timestamp>" cache-buster; the S3 object
      // key does NOT include it. Strip the query (and any decode) so the ACL
      // is applied to the real object instead of a nonexistent "...pdf?v=" key.
      const key = t.pdfUrl.startsWith(cdnPrefix)
        ? decodeURIComponent(t.pdfUrl.slice(cdnPrefix.length).split("?")[0])
        : null;
      if (!key) {
        failed++;
        console.error(`Unrecognized pdfUrl format for ${t._id}: ${t.pdfUrl}`);
        continue;
      }
      try {
        await s3.send(new PutObjectAclCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key: key, ACL: "public-read" }));
        done++;
      } catch (err) {
        failed++;
        console.error(`Failed to set ACL for ${key}:`, err.message);
      }
      if ((done + failed) % 500 === 0) console.log(`Progress: ${done + failed}/${tickets.length}`);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. ${done} fixed, ${failed} failed, ${tickets.length} total.`);

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
