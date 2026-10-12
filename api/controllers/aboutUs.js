const { default: mongoose } = require("mongoose");
const AboutUs = require("../models/aboutUsPage");

// ---- Homepage story gallery -------------------------------------------------
// The story used to be one image (`landingStoryImage`). It is now an ordered
// list (`landingStoryImages`). Records saved before the change only carry the
// single field, so every read goes through getStoryImages().
const MAX_STORY_IMAGES = 12;

const toStringList = (value) => {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch (_) {
      list = list ? [list] : [];
    }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((item) => typeof item === "string" && item.trim() !== ""))];
};

const getStoryImages = (doc) => {
  const list = toStringList(doc && doc.landingStoryImages);
  if (list.length) return list;
  return doc && typeof doc.landingStoryImage === "string" && doc.landingStoryImage ? [doc.landingStoryImage] : [];
};

// Works out the story image fields to store for one create/update request and
// strips the request-only helper fields from `body`. `current` is the saved
// record (null on create). Returns:
//   null            the request does not touch the story images — stored gallery stays as is
//   { error }       the request is not acceptable
//   { fields }      story fields to merge into the update
// Request fields:
//   landingStoryImages      JSON list of the already-saved images to keep (sent by the admin screen)
//   landingStoryImageFiles  newly uploaded images, already pushed to storage by the S3 middleware
//   landingStoryImage       legacy single upload — appended, never replaces the gallery
//   removeLandingStoryImage legacy "clear the image" flag
const resolveStoryImages = (body, current) => {
  const hasKeepList = body.landingStoryImages !== undefined;
  const uploaded = toStringList(body.landingStoryImageFiles);
  const legacyUpload = typeof body.landingStoryImage === "string" ? body.landingStoryImage : "";
  const legacyRemove = body.removeLandingStoryImage === true || body.removeLandingStoryImage === "true";
  const keepRaw = body.landingStoryImages;
  const saved = getStoryImages(current);

  delete body.landingStoryImageFiles;
  delete body.landingStoryImages;
  delete body.landingStoryImage;
  delete body.removeLandingStoryImage;

  if (!hasKeepList && !uploaded.length && !legacyUpload && !legacyRemove) return null;

  let images = saved;
  if (hasKeepList) {
    // Only images that are really saved on this record can be kept.
    const savedSet = new Set(saved);
    images = toStringList(keepRaw).filter((item) => savedSet.has(item));
  } else if (legacyRemove) {
    images = [];
  }
  images = [...new Set([...images, ...uploaded, ...(legacyUpload ? [legacyUpload] : [])])];

  if (images.length > MAX_STORY_IMAGES) {
    return { error: `A maximum of ${MAX_STORY_IMAGES} homepage story images is allowed.` };
  }

  return { fields: { landingStoryImages: images, landingStoryImage: images[0] || "" } };
};

// @desc      CREATE NEW aboutUs
// @route     POST /api/v1/about-us
// @access    protect

exports.createAboutUs = async (req, res) => {
  try {
    const story = resolveStoryImages(req.body, null);
    if (story && story.error) {
      return res.status(400).json({ success: false, message: story.error });
    }
    if (story) Object.assign(req.body, story.fields);

    const newAboutUs = await AboutUs.create(req.body);
    res.status(200).json({ success: true, message: "AboutUs created successfully", data: newAboutUs });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      GET ALL AboutUs
// @route     GET /api/v1/about-us
// @access    public
exports.getAboutUs = async (req, res) => {
  try {
    const { id, skip, limit, searchkey } = req.query;

    const query = searchkey ? { ...req.filter, title: { $regex: searchkey, $options: "i" } } : req.filter;

    const [totalCount, filterCount, data] = await Promise.all([
      parseInt(skip) === 0 && AboutUs.countDocuments(),
      parseInt(skip) === 0 && AboutUs.countDocuments(query),
      AboutUs.find(query)
        .skip(parseInt(skip) || 0)
        .limit(parseInt(limit) || 50)
        .sort({ _id: -1 }),
    ]);

    // Records saved before the gallery existed only hold `landingStoryImage`;
    // hand every client one consistent list.
    const response = data.map((doc) => {
      const row = doc.toJSON();
      row.landingStoryImages = getStoryImages(row);
      return row;
    });

    res.status(200).json({ success: true, message: "Retrieved all AboutUs ", response, count: data.length, totalCount: totalCount || 0, filterCount: filterCount || 0 });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      UPDATE SPECIFIC AboutUs
// @route     PUT /api/v1/about-us/:id
// @access    protect
const REMOVAL_FLAGS = {
  removeImage: "image",
  removeLandingMainbanner: "landingMainbanner",
  removeWelcomeImage: "welcomeImage",
};

exports.updateAboutUs = async (req, res) => {
  try {
    const update = { ...req.body };
    Object.entries(REMOVAL_FLAGS).forEach(([flag, field]) => {
      const shouldRemove = update[flag] === true || update[flag] === "true";
      delete update[flag];
      if (shouldRemove && !update[field]) {
        update[field] = "";
      }
    });

    const current = await AboutUs.findById(update.id).lean();
    if (!current) {
      return res.status(404).json({ success: false, message: " AboutUs not found" });
    }

    const story = resolveStoryImages(update, current);
    if (story && story.error) {
      return res.status(400).json({ success: false, message: story.error });
    }
    if (story) Object.assign(update, story.fields);

    const aboutUs = await AboutUs.findByIdAndUpdate(update.id, update, {
      new: true,
    });

    if (!aboutUs) {
      return res.status(404).json({ success: false, message: " AboutUs not found" });
    }

    res.status(200).json({ success: true, message: "AboutUs updated successfully", data: aboutUs });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      DELETE SPECIFIC AboutUs
// @route     DELETE /api/v1/about-us/:id
// @access    protect
exports.deleteAboutUs = async (req, res) => {
  try {
    const aboutUs = await AboutUs.findByIdAndDelete(req.query.id);

    if (!aboutUs) {
      return res.status(404).json({ success: false, message: "AboutUs not found" });
    }

    res.status(200).json({ success: true, message: "AboutUs deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      GET CUSTOMER TYPE
// @route     GET /api/v1/about-us/select
// @access    public
exports.select = async (req, res) => {
  try {
    const items = await AboutUs.find({}, { _id: 0, id: "$_id", value: "$title" });
    return res.status(200).send(items);
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// exported for tests
exports._internals = { resolveStoryImages, getStoryImages, MAX_STORY_IMAGES };
