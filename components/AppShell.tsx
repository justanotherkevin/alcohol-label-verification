"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import ApplicantNav from "@/components/ApplicantNav";
import {
  getCurrentSpecialist,
  clearCurrentSpecialist,
  StoredSpecialist,
} from "@/lib/queue/specialist";
import {
  getCurrentApplicant,
  clearCurrentApplicant,
  StoredApplicant,
} from "@/lib/queue/applicant";

interface IdentityContextValue {
  specialist: StoredSpecialist | null;
  applicant: StoredApplicant | null;
  requestLogin: () => void;
}

const IdentityContext = createContext<IdentityContextValue>({
  specialist: null,
  applicant: null,
  requestLogin: () => {},
});

export function useIdentity() {
  return useContext(IdentityContext);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [specialist, setSpecialist] = useState<StoredSpecialist | null>(null);
  const [applicant, setApplicant] = useState<StoredApplicant | null>(null);
  const [showModal, setShowModal] = useState(false);

  const refreshIdentity = useCallback(() => {
    const s = getCurrentSpecialist();
    const a = getCurrentApplicant();
    setSpecialist(s);
    setApplicant(a);
    return { s, a };
  }, []);

  useEffect(() => {
    const { s, a } = refreshIdentity();
    if (!s && !a) setShowModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRequestLogin() {
    setShowModal(true);
  }

  function handleLogout() {
    clearCurrentSpecialist();
    clearCurrentApplicant();
    setSpecialist(null);
    setApplicant(null);
    setShowModal(true);
  }

  function handleModalClose(role: "specialist" | "applicant") {
    refreshIdentity();
    setShowModal(false);
    if (role === "applicant") {
      router.push("/apply");
    } else if (pathname === "/apply") {
      router.push("/");
    }
  }

  // Applicants get a chrome-free view everywhere (no specialist sidebar/nav) —
  // they only ever use "/" (their own applications) and "/apply" (submission).
  const hideSidebar = pathname === "/apply" || !!applicant;

  return (
    <IdentityContext.Provider
      value={{ specialist, applicant, requestLogin: handleRequestLogin }}>
      {showModal && (
        <LoginModal
          dismissible={!!(specialist || applicant)}
          onClose={handleModalClose}
        />
      )}
      {hideSidebar ?
        <main className="flex-1 max-h-screen flex flex-col">
          {applicant && (
            <ApplicantNav
              applicant={applicant}
              onSwitchUser={handleRequestLogin}
              onLogout={handleLogout}
            />
          )}
          <div className="flex-1">{children}</div>
        </main>
      : <>
          <Sidebar
            onRequestLogin={handleRequestLogin}
            onLogout={handleLogout}
            specialist={specialist}
          />
          <main className="ml-64 flex-1 max-h-screen">{children}</main>
        </>
      }
    </IdentityContext.Provider>
  );
}
