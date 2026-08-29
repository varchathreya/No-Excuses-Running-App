import { Router, type IRouter } from "express";

const quotes = [
  "No perfect days. Just the next one.",
  "Small steps still move you forward.",
  "Consistency is a quiet kind of strength.",
  "Start where you are. Build from there.",
  "Your future self is built by today's choices.",
  "Progress does not need to be loud.",
  "Make it easy to begin, then keep going.",
  "A gentle start is still a start.",
  "Show up for the version of you that is growing.",
  "The goal is not perfect. The goal is present.",
  "One session can change the shape of a week.",
  "Build the habit before you build the miles.",
  "Patient work becomes durable progress.",
  "You do not have to rush what you want to keep.",
  "Today only asks for today's effort.",
  "Quiet feet. Calm mind. Keep moving.",
  "Strength grows in the repetitions nobody sees.",
  "A little momentum is enough to begin.",
  "Let consistency do the heavy lifting.",
  "You are allowed to take this one step at a time.",
  "The next right action is usually small.",
  "Keep the promise small enough to keep.",
  "Better is built, not wished for.",
  "Your pace is allowed to be your pace.",
  "Training is practice in returning.",
  "Every careful session counts.",
  "Do less, consistently, and let it compound.",
  "The work is working, even when it feels ordinary.",
  "You can be a beginner and still be committed.",
  "Start gently. Finish proud.",
  "A steady rhythm beats a dramatic beginning.",
  "Recovery is part of the work.",
  "Your body learns from what you repeat.",
  "You are not behind. You are building.",
  "Make room for progress to take its time.",
  "The win is keeping the next promise.",
  "Today is a chance to practice patience.",
  "Strong habits are made of ordinary days.",
  "Keep showing up for the process, not the applause.",
  "A calm session is a successful session.",
  "You do not need more motivation; you need one next step.",
  "Protect the habit by respecting the recovery.",
  "Form first. Speed later.",
  "The smallest useful action is still useful.",
  "You are becoming someone who follows through.",
  "There is strength in starting again.",
  "Let today's effort be enough.",
  "Progress has room for pauses.",
  "Trust the plan, then take the next step.",
  "Resilience is built one repeat at a time.",
];

const quotesRouter: IRouter = Router();

quotesRouter.get("/quotes/daily", (req, res) => {
  const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const index = ((dayNumber % quotes.length) + quotes.length) % quotes.length;
  return res.json({ quote: quotes[index], index });
});

export default quotesRouter;