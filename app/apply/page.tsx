"use client";

import { useState } from "react";
import Link from "next/link";
import { useIdentity } from "@/components/AppShell";
import { ApplicationCreationFlow } from "@/components/ApplicationCreationFlow";

export default function ApplyPage() {
  const { applicant, requestLogin } = useIdentity();
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  function handleSubmitAnother() {
    setSubmittedId(null);
    setResetKey((k) => k + 1);
  }

  if (!applicant) {
    return (
      <div className="max-h-screen flex items-center justify-center px-8">
        <div className="bg-surface-card border border-outline rounded-2xl p-8 text-center max-w-sm">
          <p className="text-base text-on-surface-muted mb-6">
            You&apos;re not signed in as an applicant.
          </p>
          <button
            onClick={requestLogin}
            className="px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (submittedId) {
    return (
      <div className="max-h-screen px-8 py-8 max-w-5xl mx-auto">
        <div className="bg-surface-card border border-outline rounded-2xl p-10 text-center shadow-sm max-w-xl mx-auto">
          <span className="inline-flex items-center justify-center size-16 rounded-full bg-bp-success-surface border border-bp-success-border mb-4">
            <span className="material-symbols-outlined text-bp-success text-4xl">
              assignment_turned_in
            </span>
          </span>
          <h2
            className="text-2xl font-bold text-on-surface mb-3"
            style={{ fontFamily: "var(--font-inter)" }}>
            Application submitted
          </h2>
          <p className="text-base text-on-surface-muted mb-2">
            Waiting for a reviewer to review this application.
          </p>
          <p className="text-sm font-mono text-on-surface-dim mb-8 bg-surface-dim px-4 py-2 rounded-lg inline-block">
            {submittedId}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={handleSubmitAnother}
              className="px-5 py-3 text-base font-semibold border-2 border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary">
              Submit another
            </button>
            <Link
              href="/"
              className="px-5 py-3 text-base font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer focus:outline-2 focus:outline-offset-2 focus:outline-primary inline-block">
              View my applications
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ApplicationCreationFlow
      key={resetKey}
      heading="Submit a COLA Application"
      subheading={`Signed in as ${applicant.name}`}
      initialApplicantName={applicant.name}
      applicantNameEditable={false}
      onSubmitted={setSubmittedId}
    />
  );
}
