const jwt = require("jsonwebtoken");
const asyncHandler = require("./async");
const User = require("../models/user");

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  let role;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(" ")[1];
    role = req.headers.authorization.split(" ")[2];
    // Set token from cookie
  }
  if (!token) {
    // return next(new ErrorResponse("Not authorized to access this route", 401));
    return res.status(401).json({
      success: false,
      message: "No token available to authorized to access this route",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).populate("userType");
    // console.log(token, req.user);
    next();
  } catch (err) {
    // return next(new ErrorResponse("Not authorized to access this route two ", 401));
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req?.user?.userType?.role)) {
      // return next(
      //   new ErrorResponse(
      //     `User role ${req.user?.userType?.role} is not authorized to access this route`,
      //     403
      //   )
      // );
      return res.status(403).json({
        success: false,
        message: `User role ${req.user?.userType?.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Like `protect`, but never rejects: a valid token populates req.user, anything
// else (no token, bad token, deleted user) just continues as an anonymous
// caller. For public endpoints that also serve staff — the front-end's API
// helpers always send an Authorization header, even for signed-out visitors.
exports.optionalProtect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer")) {
    const token = header.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).populate("userType");
        if (user) req.user = user;
      } catch (_) {
        // Expired / malformed token — treat as anonymous.
      }
    }
  }
  next();
});

// Block specific roles (e.g. the low-privilege "Student" login) from routes
// that are staff-only, without having to enumerate every staff role.
exports.denyRoles = (...roles) => {
  return (req, res, next) => {
    if (roles.includes(req?.user?.userType?.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this route",
      });
    }
    next();
  };
};
