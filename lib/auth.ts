import { betterAuth } from "better-auth";
import { db } from "@/lib/db";

export const auth = betterAuth({
  appName: "LiveOn",
  database: db,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
});
