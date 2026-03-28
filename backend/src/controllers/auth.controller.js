import { User } from "../models/User.js";
import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { SystemSetting } from "../models/SystemSetting.js";
import { generateToken } from "../utils/generateToken.js";
import { created, fail, ok } from "../utils/apiResponse.js";
import { env } from "../config/env.js";

const ADMIN_USERNAME = "janushiya@admin.in";

const resolveUserIdentity = async (user) => {
  if (!user) return null;
  let resolvedName = user.name;

  if (user.role === "Faculty" && user.teacherId) {
    const teacher = await Teacher.findOne({ teacherId: user.teacherId }).select("name").lean();
    if (teacher?.name) resolvedName = teacher.name;
  }

  if (user.role === "Student" && user.studentId) {
    const student = await Student.findOne({ studentId: user.studentId }).select("name").lean();
    if (student?.name) resolvedName = student.name;
  }

  return {
    id: user._id,
    name: resolvedName,
    username: user.username,
    role: user.role,
    studentId: user.studentId,
    teacherId: user.teacherId
  };
};

const verifyGoogleIdToken = async (idToken) => {
  if (!env.googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on server");
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!response.ok) return null;
  const tokenInfo = await response.json();

  const issuer = String(tokenInfo.iss || "");
  const audience = String(tokenInfo.aud || "");
  const expiresAt = Number(tokenInfo.exp || 0);
  const now = Math.floor(Date.now() / 1000);
  const emailVerified = String(tokenInfo.email_verified || "").toLowerCase() === "true";

  if (!["accounts.google.com", "https://accounts.google.com"].includes(issuer)) return null;
  if (audience !== env.googleClientId) return null;
  if (expiresAt <= now) return null;
  if (!emailVerified) return null;

  return {
    email: String(tokenInfo.email || "").toLowerCase().trim(),
    name: String(tokenInfo.name || "").trim(),
    picture: String(tokenInfo.picture || "").trim()
  };
};

export const register = async (req, res) => {
  try {
    const { name, username, email, password, role = "Student", studentId = null, teacherId = null } = req.body;
    if (!name || !username || !password) return fail(res, 400, "name, username and password are required");

    const normalizedRole = ["Admin", "Faculty", "Student"].includes(role) ? role : "Student";
    const normalizedUsername = username.toLowerCase().trim();

    const exists = await User.findOne({ username: normalizedUsername });
    if (exists) return fail(res, 409, "Username already exists");

    const user = await User.create({
      name,
      username: normalizedUsername,
      email: email?.toLowerCase().trim() || normalizedUsername,
      password,
      role: normalizedRole,
      studentId,
      teacherId
    });

    return created(res, { id: user._id, username: user.username, role: user.role }, "User registered");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const login = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return fail(res, 400, "username, password and role are required");

    const rawIdentifier = String(username || "").trim();
    const identifier = rawIdentifier.toLowerCase();

    if (role === "Student" && !(/^[^@\s]+@student\.in$/i.test(identifier) || /^stu[0-9ab]+$/i.test(rawIdentifier))) {
      return fail(res, 401, "Invalid credentials");
    }

    if (role === "Faculty" && !(/^[^@\s]+@teacher\.in$/i.test(identifier) || /^tch[0-9ab]+$/i.test(rawIdentifier))) {
      return fail(res, 401, "Invalid credentials");
    }

    if (role === "Admin" && identifier !== ADMIN_USERNAME) {
      return fail(res, 401, "Invalid credentials");
    }

    if (!["Admin", "Faculty", "Student"].includes(role)) {
      return fail(res, 400, "Invalid role");
    }

    const userQuery = { role, isActive: true };
    if (role === "Student" && /^stu[0-9ab]+$/i.test(rawIdentifier)) {
      userQuery.studentId = rawIdentifier.toUpperCase();
    } else if (role === "Faculty" && /^tch[0-9ab]+$/i.test(rawIdentifier)) {
      userQuery.teacherId = rawIdentifier.toUpperCase();
    } else {
      userQuery.username = identifier;
    }

    const user = await User.findOne(userQuery);
    if (!user) return fail(res, 401, "Invalid credentials");

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) return fail(res, 401, "Invalid credentials");

    let resolvedName = user.name;
    if (role === "Student") {
      if (!user.studentId) return fail(res, 401, "Invalid credentials");
      const student = await Student.findOne({ studentId: user.studentId }).select("name").lean();
      if (!student) return fail(res, 401, "Invalid credentials");
      if (student.name) resolvedName = student.name;
    }

    if (role === "Faculty") {
      if (!user.teacherId) return fail(res, 401, "Invalid credentials");
      const teacher = await Teacher.findOne({ teacherId: user.teacherId }).select("name").lean();
      if (!teacher) return fail(res, 401, "Invalid credentials");
      if (teacher.name) resolvedName = teacher.name;
    }

    const token = generateToken({ userId: user._id, role: user.role });
    const resolvedUser = {
      id: user._id,
      name: resolvedName,
      username: user.username,
      role: user.role,
      studentId: user.studentId,
      teacherId: user.teacherId
    };
    void ActivityLog.create({
      actorUserId: user._id,
      actorName: resolvedUser.name || user.name,
      role: user.role,
      type: "login",
      action: `${user.role} login`,
      details: `${user.username} logged in`
    }).catch(() => null);

    return ok(
      res,
      {
        token,
        user: resolvedUser
      },
      "Login successful"
    );
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) return fail(res, 400, "idToken is required");
    if (!["Admin", "Faculty", "Student"].includes(role)) return fail(res, 400, "Invalid role");

    const settings = await SystemSetting.findOne();
    if (settings && settings.googleSignInEnabled === false) {
      return fail(res, 403, "Google Sign-In is disabled by admin");
    }

    const googleProfile = await verifyGoogleIdToken(idToken);
    if (!googleProfile || !googleProfile.email) {
      return fail(res, 401, "Invalid Google token");
    }

    const user = await User.findOne({
      email: googleProfile.email,
      role,
      isActive: true
    });

    if (!user) {
      return fail(res, 401, "No active account is linked to this Google email for selected role");
    }

    let resolvedName = user.name;
    if (role === "Student") {
      if (!user.studentId) return fail(res, 401, "Invalid student account mapping");
      const student = await Student.findOne({ studentId: user.studentId }).select("name").lean();
      if (!student) return fail(res, 401, "Invalid student account mapping");
      if (student.name) resolvedName = student.name;
    }

    if (role === "Faculty") {
      if (!user.teacherId) return fail(res, 401, "Invalid faculty account mapping");
      const teacher = await Teacher.findOne({ teacherId: user.teacherId }).select("name").lean();
      if (!teacher) return fail(res, 401, "Invalid faculty account mapping");
      if (teacher.name) resolvedName = teacher.name;
    }

    const token = generateToken({ userId: user._id, role: user.role });

    const resolvedUser = {
      id: user._id,
      name: resolvedName,
      username: user.username,
      role: user.role,
      studentId: user.studentId,
      teacherId: user.teacherId
    };
    void ActivityLog.create({
      actorUserId: user._id,
      actorName: resolvedUser.name || user.name,
      role: user.role,
      type: "login",
      action: `${user.role} Google login`,
      details: `${user.email || user.username} logged in via Google OAuth`
    }).catch(() => null);

    return ok(
      res,
      {
        token,
        user: {
          ...resolvedUser,
          picture: googleProfile.picture || null
        }
      },
      "Google login successful"
    );
  } catch (error) {
    return fail(res, 500, error.message);
  }
};

export const me = async (req, res) => {
  const resolvedUser = await resolveUserIdentity(req.user);
  return ok(res, resolvedUser || req.user);
};
