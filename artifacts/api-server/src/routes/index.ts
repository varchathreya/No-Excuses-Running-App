import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarRouter from "./calendar";
import quotesRouter from "./quotes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarRouter);
router.use(quotesRouter);

export default router;
