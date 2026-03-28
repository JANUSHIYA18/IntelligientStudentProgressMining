import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized: token missing" });

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: "Unauthorized: invalid user" });

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized: invalid token" });
  }
};
