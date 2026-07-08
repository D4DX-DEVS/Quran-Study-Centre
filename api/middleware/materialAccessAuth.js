const jwt = require("jsonwebtoken");
const asyncHandler = require("./async");

// Verifies the short-lived token issued by materialAccess.verify — not a
// User session, just a claim that the caller proved knowledge of one area's
// password. Pins req.materialArea/req.materialDistrict so downstream queries
// can never be pointed at a different area.
exports.protectMaterialAccess = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "No token available to access this route" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.scope !== "material-access" || !decoded.areaId) {
      return res.status(401).json({ success: false, message: "Not authorized to access this route" });
    }
    req.materialArea = decoded.areaId;
    req.materialDistrict = decoded.districtId;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authorized to access this route" });
  }
});
