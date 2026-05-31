import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import skillsRouter from "./skills";
import trainersRouter from "./trainers";
import vendorsRouter from "./vendors";
import requirementsRouter from "./requirements";
import applicationsRouter from "./applications";
import statsRouter from "./stats";
import authRouter from "./auth";
import hireInquiriesRouter from "./hire-inquiries";
import verificationRequestsRouter from "./verification-requests";
import adminUsersRouter from "./admin-users";
import adminExportsRouter from "./admin-exports";
import engagementAgreementsRouter from "./engagement-agreements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sessionRouter);
router.use(skillsRouter);
router.use(trainersRouter);
router.use(vendorsRouter);
router.use(requirementsRouter);
router.use(applicationsRouter);
router.use(statsRouter);
router.use(hireInquiriesRouter);
router.use(verificationRequestsRouter);
router.use(adminUsersRouter);
router.use(adminExportsRouter);
router.use(engagementAgreementsRouter);

export default router;
