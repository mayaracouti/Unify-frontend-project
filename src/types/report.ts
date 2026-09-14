export type ReportReason =
  | "FAKE_PROFILE"
  | "HARASSMENT"
  | "INAPPROPRIATE_CONTENT"
  | "SCAM"
  | "HATE_SPEECH"
  | "OTHER";

export type UserReportStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export interface ReportReasonOptionResponse {
  value: ReportReason;
  description: string;
}

export interface ReportCreateRequest {
  reportedUserId: string;
  reportedPostId?: string | null;
  reason: ReportReason;
  description?: string | null;
}

export interface ReportResponse {
  id: string;
  reportedUserId: string;
  reportedPostId: string | null;
  reason: ReportReason;
  description: string | null;
  status: UserReportStatus;
  createdAt: string;
}
