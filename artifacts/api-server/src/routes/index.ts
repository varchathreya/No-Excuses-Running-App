import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import calendarRouter from "./calendar";
import quotesRouter from "./quotes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(calendarRouter);
router.use(quotesRouter);

export default router;
