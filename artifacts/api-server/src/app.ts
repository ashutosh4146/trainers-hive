import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { verifyIdToken } from "./lib/firebase";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Deactivated-account guard.
 * For every Firebase-authenticated request (Bearer token present), look up the
 * user and refuse access when their account has been deactivated by an admin.
 * Requests that use the shared demo session (no token) are not checked here —
 * those accounts are managed separately via admin tooling.
 */
app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = await verifyIdToken(token);
    const email = decoded.email;
    if (email) {
      const [user] = await db
        .select({ id: usersTable.id, deactivatedAt: usersTable.deactivatedAt })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (user?.deactivatedAt) {
        res.status(403).json({
          error: "account_deactivated",
          message: "Your account has been deactivated. Please contact support.",
        });
        return;
      }
    }
  } catch {
    // Invalid/expired token — let the route handle it
  }
  next();
});

app.use("/api", router);

export default app;
