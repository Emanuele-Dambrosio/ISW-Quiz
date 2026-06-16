import { z } from "zod";

export const imageAssetSchema = z.object({
  id: z.string().min(1),
  originalUrl: z.string().nullable().optional(),
  localPath: z.string().min(1),
  sha256: z.string().min(1),
  alt: z.string().optional().default(""),
});

export const optionSchema = z.object({
  id: z.string().min(1),
  textHtml: z.string(),
  textPlain: z.string(),
  images: z.array(imageAssetSchema).default([]),
  isCorrect: z.boolean(),
});

export const appearanceSchema = z.object({
  examId: z.string().min(1),
  questionNumber: z.number().int().positive().nullable().optional(),
  optionOrder: z.array(z.string()).default([]),
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  keywords: z.array(z.string()).default([]),
});

export const categoryPredictionSchema = z.object({
  categoryId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  method: z.string().min(1),
});

export const examSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sourceUrl: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  canonicalHash: z.string().min(1),
  textHtml: z.string(),
  textPlain: z.string(),
  images: z.array(imageAssetSchema).default([]),
  options: z.array(optionSchema).min(2),
  explanationHtml: z.string().nullable().optional(),
  categoryPredictions: z.array(categoryPredictionSchema).default([]),
  appearances: z.array(appearanceSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const questionBankSchema = z.object({
  version: z.number().int().positive(),
  exams: z.array(examSchema).default([]),
  categories: z.array(categorySchema).default([]),
  questions: z.array(questionSchema).default([]),
});

export type QuestionBank = z.infer<typeof questionBankSchema>;
