import React from "react";
import { useLocation } from "wouter";

function hasExpiredDeadlineBanner() {
  return Array.from(document.querySelectorAll("main div, main span")).some((node) =>
    node.textContent?.includes("Application deadline has passed"),
  );
}

function patchExpiredRequirementUi() {
  if (!hasExpiredDeadlineBanner()) return;

  const main = document.querySelector("main");
  if (!main) return;

  for (const node of Array.from(main.querySelectorAll("button"))) {
    if (node.textContent?.trim() === "Apply Now") {
      node.textContent = "Deadline Passed";
      node.setAttribute("disabled", "true");
      node.setAttribute("aria-disabled", "true");
      node.classList.add("pointer-events-none", "opacity-60");
    }
  }

  for (const node of Array.from(main.querySelectorAll("span, div"))) {
    const text = node.textContent?.trim().toLowerCase();
    if (text === "open") {
      node.textContent = "Expired";
      node.classList.remove("bg-primary", "text-primary-foreground");
      node.classList.add("bg-secondary", "text-secondary-foreground");
      break;
    }
  }
}

export function RequirementDeadlineDomGuard() {
  const [location] = useLocation();

  React.useEffect(() => {
    if (!location.startsWith("/requirements/")) return;

    patchExpiredRequirementUi();
    const observer = new MutationObserver(() => patchExpiredRequirementUi());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [location]);

  return null;
}
