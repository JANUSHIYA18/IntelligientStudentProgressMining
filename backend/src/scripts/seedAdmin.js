import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";

const ADMIN_USERNAME = "janushiya@admin.in";
const DEFAULT_PASSWORD = "123456";

const seed = async () => {
  await connectDB();
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  await User.updateOne(
    { username: ADMIN_USERNAME },
    {
      $set: {
        name: "Janushiya",
        username: ADMIN_USERNAME,
        email: ADMIN_USERNAME,
        password: hashedPassword,
        role: "Admin",
        studentId: null,
        teacherId: null,
        isActive: true
      }
    },
    { upsert: true }
  );

  console.log(`Admin user ready: ${ADMIN_USERNAME} / ${DEFAULT_PASSWORD}`);
  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
