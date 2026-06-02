import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { AccountDeactivatedError, UnauthenticatedError } from "./lib/session";

const app: Express = express();

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

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", message: "Too many requests, please slow down." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", message: "Too many auth attempts, please try again later." },
});

app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);

app.use("/api", router);

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
