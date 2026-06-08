import React from "react";
import { useLocation } from "wouter";

function hasExpiredDeadlineBanner() {
  return Array.from(document.querySelectorAll("main div, main span")).some((node) =>
    node.textContent?.includes("Application deadline has passed"),
  );
}

function hasExistingApplicationState() {
  return Array.from(document.querySelectorAll("main div, main p, main span")).some((node) => {
    const text = node.textContent?.trim().toLowerCase() || "";
    return (
      text === "application submitted" ||
      text === "you withdrew this application" ||
      text === "application not selected" ||
      text.includes("the vendor will review")
    );
  });
}

function patchAppliedRequirementUi() {
  if (!hasExistingApplicationState()) return;

  const main = document.querySelector("main");
  if (!main) return;

  for (const node of Array.from(main.querySelectorAll("button"))) {
    if (node.textContent?.trim() === "Apply Now") {
      node.textContent = "Already Applied";
      node.setAttribute("disabled", "true");
      node.setAttribute("aria-disabled", "true");
      node.classList.add("pointer-events-none", "opacity-60");
    }
  }

  for (const node of Array.from(main.querySelectorAll("span"))) {
    const text = node.textContent || "";
    if (text.includes("Apply soon!")) {
      node.textContent = text.replace("Apply soon!", "You have already applied.");
    }
  }
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

function patchRequirementsLocationFilter() {
  const locationInput = document.querySelector<HTMLInputElement>('input#location');
  if (!locationInput) return;

  const query = locationInput.value.trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll<HTMLElement>('a[href^="/requirements/"]'));

  for (const cardLink of cards) {
    const container = cardLink.parentElement as HTMLElement | null;
    if (!container) continue;

    const text = cardLink.textContent?.toLowerCase() || "";
    const shouldShow = !query || text.includes(query);
    container.style.display = shouldShow ? "" : "none";
  }
}

export function RequirementDeadlineDomGuard() {
  const [location] = useLocation();

  React.useEffect(() => {
    if (!location.startsWith("/requirements")) return;

    const patch = () => {
      if (location === "/requirements") patchRequirementsLocationFilter();
      if (location.startsWith("/requirements/")) {
        patchExpiredRequirementUi();
        patchAppliedRequirementUi();
      }
    };

    patch();
    const observer = new MutationObserver(() => patch());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const locationInput = document.querySelector<HTMLInputElement>('input#location');
    locationInput?.addEventListener("input", patch);

    return () => {
      observer.disconnect();
      locationInput?.removeEventListener("input", patch);
    };
  }, [location]);

  return null;
}
