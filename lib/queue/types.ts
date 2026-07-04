import { ApplicationData, VerificationResult } from "@/lib/verify"
import { ExtractedLabelData, ConfidenceMap, BoundingBoxMap } from "@/lib/ocr/types"

export interface LabelImage {
  /** Public URL path to the image, e.g. "/demo-labels/hollow-creek.jpg" */
  path: string
  mimeType: string
  side?: "front" | "back" | string
  rawOcrText?: string
}

export type QueueStatus = "pending" | "analyzed" | "resolved"

export interface FieldOverride {
  field: string
  reason: string
  decision?: "approve" | "flag"
}

export interface Resolution {
  decision: "approved" | "rejected"
  overrides: FieldOverride[]
  rejectedFields: string[]
  note: string
  resolvedAt: string
  specialistId?: string
}

export interface OcrData {
  extracted: ExtractedLabelData
  confidence: ConfidenceMap
  boundingBoxes?: BoundingBoxMap
  result: VerificationResult
  analyzedAt: string
}

export interface FieldReviewNote {
  field: string
  note: string
  flagged: boolean
  decision?: "approve" | "reject"
  specialistId: string
  savedAt: string
}

export interface ReviewSession {
  specialistId: string
  startedAt: string
  completedAt?: string
}

export interface ApplicationReviewData {
  sessions: ReviewSession[]
  fieldNotes: FieldReviewNote[]
  resolution: Resolution | null
}

export interface QueueApplication {
  id: string
  applicant: string
  submittedAt: string
  images: LabelImage[]
  applicationData: ApplicationData
  ocrData: OcrData | null
  reviewData: ApplicationReviewData
  status: QueueStatus
}

export interface QueueSummary {
  id: string
  brandName: string
  applicant: string
  submittedAt: string
  status: QueueStatus
  flagCount: number
  overallPass: boolean | null
}
