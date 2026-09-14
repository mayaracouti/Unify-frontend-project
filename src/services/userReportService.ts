import { customApiCall } from "../api/customApi";
import type {
  ReportCreateRequest,
  ReportReasonOptionResponse,
  ReportResponse,
} from "../types/report";

const REPORTS_ENDPOINT = "/users/reports";

let cachedReasons: ReportReasonOptionResponse[] | null = null;

export const userReportService = {
  createReport(payload: ReportCreateRequest) {
    return customApiCall.post<ReportResponse, ReportCreateRequest>(
      REPORTS_ENDPOINT,
      payload,
      { requiresAuth: true, suppressErrorToast: true }
    );
  },

  /** Lista estática: cache simples em módulo evita uma chamada por abertura do modal. */
  async listReasons() {
    if (cachedReasons) {
      return cachedReasons;
    }

    const reasons = await customApiCall.get<ReportReasonOptionResponse[]>(
      `${REPORTS_ENDPOINT}/reasons`,
      undefined,
      { requiresAuth: true }
    );
    cachedReasons = reasons;
    return reasons;
  },

  clearReasonsCache() {
    cachedReasons = null;
  },
};
