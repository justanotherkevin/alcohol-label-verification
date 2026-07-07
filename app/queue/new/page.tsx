"use client";

import { useRouter } from "next/navigation";
import { useIdentity } from "@/components/AppShell";
import { ApplicationCreationFlow } from "@/components/ApplicationCreationFlow";

export default function NewApplicationPage() {
  const { specialist, requestLogin } = useIdentity();
  const router = useRouter();

  if (!specialist) {
    return (
      <div className="max-h-screen flex items-center justify-center px-8">
        <div className="bg-surface-card border border-outline rounded-2xl p-8 text-center max-w-sm">
          <p className="text-base text-on-surface-muted mb-6">
            You&apos;re not signed in as a specialist.
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

  return (
    <ApplicationCreationFlow
      heading="Create Application"
      subheading="Log a new application on behalf of an importer or producer — e.g. a paper or phone submission received outside the normal intake channels."
      initialApplicantName=""
      applicantNameEditable={true}
      submitLabel="Create Application"
      onSubmitted={(id) => router.push(`/queue/${id}`)}
    />
  );
}
