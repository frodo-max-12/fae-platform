"use client";

import { useReducer, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Home, Loader2 } from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import StepIndicator from "@/components/StepIndicator";
import Step1Intake from "@/components/Step1Intake";
import Step2Extract from "@/components/Step2Extract";
import Step3Product from "@/components/Step3Product";
import Step5Draft from "@/components/Step5Draft";
import Step6Send from "@/components/Step6Send";
import { WizardContext, wizardReducer, initialWizardState } from "@/lib/store";
import { STEPS } from "@/lib/constants";
import type { WizardStep, ExtractionResult, ComparisonResult, EmailDraft } from "@/types";

const stepComponents: Record<number, React.ComponentType> = {
  1: Step1Intake,
  2: Step2Extract,
  3: Step3Product,
  4: Step5Draft,
  5: Step6Send,
};

const statusToStep: Record<string, WizardStep> = {
  intake: 2,
  extracted: 3,
  compared: 4,
  draft: 5,
  sent: 5,
};

function WizardInner() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("id");
  const currentStepInfo = STEPS[state.currentStep - 1];
  const StepComponent = stepComponents[state.currentStep];
  const canGoBack = state.currentStep > 1;

  // ── Resume saved inquiry when /wizard?id=<requestId> is visited ──
  useEffect(() => {
    if (!resumeId) return;

    (async () => {
      try {
        const res = await fetch(`/api/requests?id=${resumeId}`);
        if (!res.ok) return;
        const { request } = await res.json();
        if (!request) return;

        dispatch({ type: "SET_REQUEST_ID", requestId: request.id });

        // Rehydrate the raw email so Step1 / downstream see the context
        if (request.rawEmail) {
          dispatch({
            type: "SELECT_EMAIL",
            email: {
              id: request.id,
              from: request.customerEmail || "restored-inquiry",
              subject: "Restored inquiry",
              body: request.rawEmail,
              date: request.createdAt,
              snippet: request.rawEmail.slice(0, 100),
            },
          });
        }

        // Rehydrate extraction (Step 2 guards on state.extraction, won't re-call)
        if (request.extractedSpecs) {
          try {
            const extraction = JSON.parse(request.extractedSpecs) as ExtractionResult;
            dispatch({ type: "SET_EXTRACTION", extraction });
            if (extraction.requirements?.length > 0) {
              const first = extraction.requirements[0];
              dispatch({
                type: "SET_EXTRACTED_SPECS",
                specs: {
                  type: first.type,
                  sensingDistance: first.sensingDistance,
                  ipRating: first.ipRating,
                  tempRange: first.tempRange,
                  outputType: first.outputType,
                  supplyVoltage: first.supplyVoltage,
                  quantity: first.quantity,
                  targetPrice: first.targetPrice,
                  deliveryTimeline: first.deliveryTimeline,
                  referenceProduct: first.referenceMPN,
                  customerName: extraction.customerName,
                  customerCompany: extraction.customerCompany,
                  applicationContext: first.applicationContext,
                },
              });
            }
          } catch {}
        }

        // Rehydrate comparison (Step 4 guards on state.comparison, won't re-call)
        if (request.comparison) {
          try {
            const comparison = JSON.parse(request.comparison) as ComparisonResult;
            dispatch({ type: "SET_COMPARISON", comparison });
          } catch {}
        }

        // Rehydrate email draft (Step 5 guards on state.emailDraft?.body, won't re-call)
        if (request.emailDraft) {
          try {
            const draft = JSON.parse(request.emailDraft) as EmailDraft;
            dispatch({ type: "SET_EMAIL_DRAFT", draft });
          } catch {}
        }

        if (request.sentAt) {
          dispatch({ type: "SET_SENT", messageId: "restored" });
        }

        // Jump to the step where the user paused
        const step = statusToStep[request.status] || 1;
        dispatch({ type: "SET_STEP", step });
      } catch (e) {
        console.warn("[wizard] resume failed:", (e as Error).message);
      }
    })();
  }, [resumeId]);

  return (
    <WizardContext value={{ state, dispatch }}>
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-slate-200">
            <div className="px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {canGoBack && (
                  <button
                    onClick={() => dispatch({ type: "SET_STEP", step: (state.currentStep - 1) as WizardStep })}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h1 className="text-lg font-extrabold text-slate-800">
                    Step {state.currentStep}: {currentStepInfo.title}
                  </h1>
                  <p className="text-xs text-slate-400">{currentStepInfo.subtitle}</p>
                </div>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
            </div>

            {/* Step Indicator */}
            <div className="px-8 pb-4">
              <StepIndicator currentStep={state.currentStep} />
            </div>
          </div>

          {/* Step Content */}
          <div className="px-8 py-8 max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={state.currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </WizardContext>
  );
}

export default function WizardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}>
      <WizardInner />
    </Suspense>
  );
}
