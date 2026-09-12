export interface GmailAttachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  snippet: string;
  attachments?: GmailAttachment[];
}

// ── Single requirement item (one per MPN/product in an email) ──

export interface RequirementItem {
  id: string;                    // unique id per requirement
  referenceMPN: string;          // the MPN/product customer mentioned
  referenceCompany: string;      // brand of the reference product
  type: string;                  // sensor/product type
  sensingDistance: string;
  ipRating: string;
  tempRange: string;
  outputType: string;
  supplyVoltage: string;
  quantity: string;
  targetPrice: string;
  deliveryTimeline: string;
  applicationContext: string;
  additionalNotes: string;       // any extra requirements
}

// ── Full extraction result from one email ──

export interface ExtractionResult {
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  requirements: RequirementItem[];
  summary: string;               // 1-2 line summary of the overall request
}

// Keep backward compat alias
export interface ExtractedSpecs {
  type: string;
  sensingDistance: string;
  ipRating: string;
  tempRange: string;
  outputType: string;
  supplyVoltage: string;
  quantity: string;
  targetPrice: string;
  deliveryTimeline: string;
  referenceProduct: string;
  customerName: string;
  customerCompany: string;
  applicationContext: string;
}

export interface ProductDetails {
  company: string;
  model: string;
  series: string;
  sensing: string;
  ipRating: string;
  tempRange: string;
  output: string;
  voltage: string;
  price: number;
  moq: number;
  warranty: string;
  advantages: string;
}

export interface CatalogProduct extends ProductDetails {
  id: string;
  stock: number;
  warehouse: string;
  createdAt?: string;
}

export interface AIRecommendation {
  company: string;
  model: string;
  series: string;
  sensing: string;
  ipRating: string;
  tempRange: string;
  output: string;
  voltage: string;
  price: number;
  moq: number;
  warranty: string;
  advantages: string;
  matchScore: number;
  reasoning: string;
}

// ── Per-requirement product matches ──

export interface RequirementMatch {
  requirementId: string;           // maps to RequirementItem.id
  referenceMPN: string;
  selectedProduct: ProductDetails | null;
  catalogMatches: AIRecommendation[] | null;
  aiMatches: AIRecommendation[] | null;
}

export type Verdict = "MEETS" | "EXCEEDS" | "GAP" | "CLOSE" | "COMPATIBLE" | "APP-SAFE";

export interface ComparisonRow {
  spec: string;
  customerNeed: string;
  ourValue: string;
  verdict: Verdict;
  note: string;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  totalSaving: number;
  overallScore: number;
}

// ── Per-requirement comparison ──

export interface RequirementComparison {
  requirementId: string;
  referenceMPN: string;
  product: ProductDetails;
  comparison: ComparisonResult;
}

export interface EmailDraft {
  subject: string;
  body: string;
  to: string;
  cc: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardState {
  currentStep: WizardStep;
  selectedEmail: Email | null;
  manualInput: string;
  // New multi-MPN extraction
  extraction: ExtractionResult | null;
  // Legacy single-spec (still used by downstream steps for now)
  extractedSpecs: ExtractedSpecs | null;
  // Per-requirement matches
  requirementMatches: RequirementMatch[];
  productDetails: ProductDetails | null;
  aiRecommendations: AIRecommendation[] | null;
  comparison: ComparisonResult | null;
  emailDraft: EmailDraft | null;
  sentMessageId: string | null;
  startTime: number | null;
  requestId: string | null;
}
