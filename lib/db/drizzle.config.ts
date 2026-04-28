import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.EC2_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("No database connection found. Set EC2_DATABASE_URL or DATABASE_URL.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
