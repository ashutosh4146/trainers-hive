import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import router from "./routes";
import { logger } from "./lib/logger";
import { AccountDeactivatedError, UnauthenticatedError } from "./lib/session";
import { db, applicationsTable, engagementAgreementsTable, requirementsTable } from "@workspace/db";

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

function hasDisclosedFee(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0;
}

async function requirementFeeIsDisclosed(applicationId: string): Promise<boolean> {
  const [appRow] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, applicationId))
    .limit(1);
  if (!appRow) return true;

  const [reqRow] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, appRow.requirementId))
    .limit(1);
  if (!reqRow) return true;

  const fee = appRow.proposedRate ?? (reqRow.budget > 0 ? reqRow.budget : null);
  return hasDisclosedFee(fee);
}

async function requireDisclosedAgreementFee(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method === "GET") {
      const match = req.path.match(/^\/applications\/([^/]+)\/agreement$/);
      if (match) {
        const applicationId = decodeURIComponent(match[1]!);
        if (!(await requirementFeeIsDisclosed(applicationId))) {
          res.status(409).json({
            error: "fee_required",
            message: "Agreement cannot be created until the commercial amount is disclosed.",
          });
          return;
        }
      }
    }

    if (req.method === "PATCH") {
      const match = req.path.match(/^\/agreements\/([^/]+)$/);
      if (match && Object.prototype.hasOwnProperty.call(req.body ?? {}, "agreedFee") && !hasDisclosedFee(req.body.agreedFee)) {
        res.status(400).json({
          error: "fee_required",
          message: "Agreement fee must be disclosed before agreement terms can be saved.",
        });
        return;
      }
    }

    if (req.method === "POST") {
      const match = req.path.match(/^\/agreements\/([^/]+)\/submit$/);
      if (match) {
        const agreementId = decodeURIComponent(match[1]!);
        const [agreement] = await db
          .select({ agreedFee: engagementAgreementsTable.agreedFee })
          .from(engagementAgreementsTable)
          .where(eq(engagementAgreementsTable.id, agreementId))
          .limit(1);

        if (agreement && !hasDisclosedFee(agreement.agreedFee)) {
          res.status(409).json({
            error: "fee_required",
            message: "Agreement cannot be submitted until the commercial amount is disclosed.",
          });
          return;
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", requireDisclosedAgreementFee);

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
