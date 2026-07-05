import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    const dummy = Buffer.alloc(aBuf.length);
    timingSafeEqual(aBuf, dummy);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function adminAuth(expectedToken) {
  const configured = typeof expectedToken === "string" && expectedToken.length > 0;

  return function (req, res, next) {
    if (!configured) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const headerToken = req.headers && req.headers["x-admin-token"];
    const queryToken = req.query && req.query.admin_token;

    let provided;
    if (headerToken !== undefined && headerToken !== "") {
      provided = headerToken;
    } else if (queryToken !== undefined && queryToken !== "") {
      provided = queryToken;
    } else {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!safeEqual(provided, expectedToken)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  };
}