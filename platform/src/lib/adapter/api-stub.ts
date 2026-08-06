/**
 * T-004. API-адаптер: стаб-скелет с сигнатурами PlatformDataAdapter.
 *
 * В P0 реальный API не подключён (DATA_ADAPTER по умолчанию = mock).
 * При DATA_ADAPTER=api каждый метод бросает ApiAdapterNotConnectedError —
 * UI видит честное error-состояние «источник данных временно недоступен»,
 * а не молча фейковые данные.
 *
 * Сигнатуры совпадают с mock-адаптером: замена одной строки env без правок
 * компонентов (DATA-CONTRACTS §3, §6).
 */

import type {
  Comment,
  CommentInput,
  CustomerRequest,
  CustomerRequestSummary,
  Decision,
  DecisionInput,
  DraftInput,
  HomeSummary,
  OperationalTask,
  OrganizationSummary,
  ResearchRecord,
  Role,
  SaveResult,
  SubmissionInput,
  SubmissionResult,
  TechnologyDossier,
  TechnologySummary,
  UgtMethodology,
  WorkspaceSnapshot,
} from "../types.ts";
import type {
  ListQuery,
  Page,
  PlatformDataAdapter,
  QueueQuery,
  VisibilityScope,
} from "./types.ts";
import { ApiAdapterNotConnectedError } from "./errors.ts";

export class ApiAdapterStub implements PlatformDataAdapter {
  /** Базовый URL будущего API (зарезервирован для этапа интеграции). */
  readonly baseUrl: string;

  constructor(baseUrl = "/api/v1") {
    this.baseUrl = baseUrl;
  }

  private notConnected(method: keyof PlatformDataAdapter): never {
    throw new ApiAdapterNotConnectedError(method);
  }

  async getHomeSummary(): Promise<HomeSummary> {
    return this.notConnected("getHomeSummary");
  }

  async listTechnologies(_query: ListQuery): Promise<Page<TechnologySummary>> {
    return this.notConnected("listTechnologies");
  }

  async getTechnology(
    _id: string,
    _scope: VisibilityScope
  ): Promise<TechnologyDossier | null> {
    return this.notConnected("getTechnology");
  }

  async listCustomerRequests(
    _query: ListQuery
  ): Promise<Page<CustomerRequestSummary>> {
    return this.notConnected("listCustomerRequests");
  }

  async getCustomerRequest(
    _id: string,
    _scope: VisibilityScope
  ): Promise<CustomerRequest | null> {
    return this.notConnected("getCustomerRequest");
  }

  async listOrganizations(
    _query: ListQuery
  ): Promise<Page<OrganizationSummary>> {
    return this.notConnected("listOrganizations");
  }

  async listResearch(_query: ListQuery): Promise<Page<ResearchRecord>> {
    return this.notConnected("listResearch");
  }

  async getResearch(
    _id: string,
    _scope: VisibilityScope
  ): Promise<ResearchRecord | null> {
    return this.notConnected("getResearch");
  }

  async getUgtMethodology(): Promise<UgtMethodology> {
    return this.notConnected("getUgtMethodology");
  }

  async getWorkspace(_role: Role): Promise<WorkspaceSnapshot> {
    return this.notConnected("getWorkspace");
  }

  async getOperationsQueue(
    _query: QueueQuery
  ): Promise<Page<OperationalTask>> {
    return this.notConnected("getOperationsQueue");
  }

  async saveDraft(_input: DraftInput): Promise<SaveResult> {
    return this.notConnected("saveDraft");
  }

  async submitForReview(_input: SubmissionInput): Promise<SubmissionResult> {
    return this.notConnected("submitForReview");
  }

  async addComment(_input: CommentInput): Promise<Comment> {
    return this.notConnected("addComment");
  }

  async recordDecision(_input: DecisionInput): Promise<Decision> {
    return this.notConnected("recordDecision");
  }
}
