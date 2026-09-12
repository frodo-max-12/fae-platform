"use client";

import { motion } from "framer-motion";
import { Mail, ScanSearch, Package, FileEdit, Send, Check } from "lucide-react";
import type { WizardStep } from "@/types";

const iconMap = {
  1: Mail,
  2: ScanSearch,
  3: Package,
  4: FileEdit,
  5: Send,
};

const stepLabels = ["Inbox", "Requirements", "Product & Compare", "Draft", "Send"];

export default function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  return (
    <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4">
      {[1, 2, 3, 4, 5].map((step) => {
        const Icon = iconMap[step as WizardStep];
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.15 : 1,
                  backgroundColor: isCompleted ? "#059669" : isActive ? "#1d4ed8" : "#e2e8f0",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="relative w-11 h-11 rounded-full flex items-center justify-center shadow-sm"
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-blue-400 opacity-30"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                {isCompleted ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`} />
                )}
              </motion.div>
              <span
                className={`mt-2 text-xs font-semibold tracking-wide ${
                  isActive ? "text-blue-700" : isCompleted ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {stepLabels[step - 1]}
              </span>
            </div>
            {step < 5 && (
              <div className="flex-1 mx-2 mt-[-20px]">
                <div className="h-[2px] bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: isCompleted ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
