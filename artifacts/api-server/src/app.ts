import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { AccountDeactivatedError, UnauthenticatedError } from "./lib/session";

const app: Express = express();

// Trust the first proxy hop (nginx in front of the api-server) so that
// `req.ip` resolves to the real client address from X-Forwarded-For
// instead of 127.0.0.1. This makes captured signature evidence (IP/UA)
// trustworthy and not directly spoofable by clients.
app.set("trust proxy", 1);

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

app.use("/api", router);

/**
 * Global error handler — catches AccountDeactivatedError thrown by
 * getActiveUserId and returns 403. Express 5 propagates async throws
 * from route handlers automatically.
 */
app.use(
  "/api",
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AccountDeactivatedError) {
      res.status(403).json({
        error: "account_deactivated",
        message: "Your account has been deactivated. Please contact support.",
      });
      return;
    }
    if (err instanceof UnauthenticatedError) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    logger.error(err, "Unhandled route error");
    res.status(500).json({ error: "internal_server_error" });
  },
);

export default app;
