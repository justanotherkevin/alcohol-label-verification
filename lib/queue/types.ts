import { ApplicationData, VerificationResult } from "@/lib/verify"
import { ExtractedLabelData, ConfidenceMap, BoundingBoxMap } from "@/lib/ocr/types"

export interface LabelImage {
  base64: string
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
}

export interface QueueAnalysis {
  extracted: ExtractedLabelData
  confidence: ConfidenceMap
  boundingBoxes?: BoundingBoxMap
  result: VerificationResult
  analyzedAt: string
}

export interface QueueApplication {
  id: string
  brandName: string
  applicant: string
  submittedAt: string
  applicationData: ApplicationData
  images: LabelImage[]
  status: QueueStatus
  analysis: QueueAnalysis | null
  resolution: Resolution | null
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
