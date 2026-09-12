"use client";

import { createContext, useContext } from "react";
import type {
  WizardState, WizardStep, Email, ExtractedSpecs, ExtractionResult,
  ProductDetails, AIRecommendation, RequirementMatch, ComparisonResult, EmailDraft
} from "@/types";

export const initialWizardState: WizardState = {
  currentStep: 1,
  selectedEmail: null,
  manualInput: "",
  extraction: null,
  extractedSpecs: null,
  requirementMatches: [],
  productDetails: null,
  aiRecommendations: null,
  comparison: null,
  emailDraft: null,
  sentMessageId: null,
  startTime: null,
  requestId: null,
};

export type WizardAction =
  | { type: "SET_STEP"; step: WizardStep }
  | { type: "SELECT_EMAIL"; email: Email }
  | { type: "SET_MANUAL_INPUT"; text: string }
  | { type: "SET_EXTRACTION"; extraction: ExtractionResult }
  | { type: "SET_EXTRACTED_SPECS"; specs: ExtractedSpecs }
  | { type: "SET_REQUIREMENT_MATCHES"; matches: RequirementMatch[] }
  | { type: "UPDATE_REQUIREMENT_MATCH"; match: RequirementMatch }
  | { type: "SET_PRODUCT_DETAILS"; product: ProductDetails }
  | { type: "SET_AI_RECOMMENDATIONS"; recommendations: AIRecommendation[] }
  | { type: "SET_COMPARISON"; comparison: ComparisonResult }
  | { type: "SET_EMAIL_DRAFT"; draft: EmailDraft }
  | { type: "SET_SENT"; messageId: string }
  | { type: "SET_REQUEST_ID"; requestId: string }
  | { type: "START_TIMER" }
  | { type: "RESET" };

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SELECT_EMAIL":
      return { ...state, selectedEmail: action.email, startTime: state.startTime ?? Date.now() };
    case "SET_MANUAL_INPUT":
      return { ...state, manualInput: action.text, startTime: state.startTime ?? Date.now() };
    case "SET_EXTRACTION":
      return { ...state, extraction: action.extraction };
    case "SET_EXTRACTED_SPECS":
      return { ...state, extractedSpecs: action.specs };
    case "SET_REQUIREMENT_MATCHES":
      return { ...state, requirementMatches: action.matches };
    case "UPDATE_REQUIREMENT_MATCH": {
      const matches = state.requirementMatches.map((m) =>
        m.requirementId === action.match.requirementId ? action.match : m
      );
      return { ...state, requirementMatches: matches };
    }
    case "SET_PRODUCT_DETAILS":
      return { ...state, productDetails: action.product };
    case "SET_AI_RECOMMENDATIONS":
      return { ...state, aiRecommendations: action.recommendations };
    case "SET_COMPARISON":
      return { ...state, comparison: action.comparison };
    case "SET_EMAIL_DRAFT":
      return { ...state, emailDraft: action.draft };
    case "SET_SENT":
      return { ...state, sentMessageId: action.messageId };
    case "SET_REQUEST_ID":
      return { ...state, requestId: action.requestId };
    case "START_TIMER":
      return { ...state, startTime: Date.now() };
    case "RESET":
      return initialWizardState;
    default:
      return state;
  }
}

interface WizardContextType {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export const WizardContext = createContext<WizardContextType | null>(null);

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
