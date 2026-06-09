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

function hasActiveAgreementState() {
  return Array.from(document.querySelectorAll("main div, main p, main span, main button")).some((node) => {
    const text = node.textContent?.trim().toLowerCase() || "";
    return (
      text.includes("agreement active") ||
      text.includes("signed by both parties") ||
      text.includes("agreement signed")
    );
  });
}

function patchApplySoonBannerForActiveAgreement() {
  if (!hasActiveAgreementState()) return;

  const main = document.querySelector("main");
  if (!main) return;

  for (const span of Array.from(main.querySelectorAll("span"))) {
    const text = span.textContent || "";
    if (!text.includes("Apply soon!")) continue;

    const banner = span.closest<HTMLElement>(
      "div.border-orange-200, div.dark\\:border-orange-800, div.bg-orange-50, div.dark\\:bg-orange-950\\/30",
    );

    if (banner) {
      banner.style.display = "none";
      banner.setAttribute("data-th-hidden-apply-soon", "true");
    } else {
      span.textContent = text.replace("Apply soon!", "Engagement is already active.");
    }
  }
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

function isMobileNumberInput(input: HTMLInputElement) {
  const id = input.id;
  const aria = input.getAttribute("aria-label") || "";
  const placeholder = input.getAttribute("placeholder") || "";
  const nearbyText = input.closest("div")?.textContent || "";
  return /mobile number/i.test(`${id} ${aria} ${placeholder} ${nearbyText}`);
}

function sanitizeMobileInput(input: HTMLInputElement) {
  if (!isMobileNumberInput(input)) return;
  const clean = input.value.replace(/\D/g, "").slice(0, 15);
  if (input.value === clean) return;
  input.value = clean;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function patchMobileInputs() {
  if (!window.location.pathname.startsWith("/profile")) return;
  for (const input of Array.from(document.querySelectorAll<HTMLInputElement>("input"))) {
    sanitizeMobileInput(input);
  }
}

export function RequirementDeadlineDomGuard() {
  const [location] = useLocation();

  React.useEffect(() => {
    const shouldWatchRequirements = location.startsWith("/requirements");
    const shouldWatchProfile = location === "/profile";
    if (!shouldWatchRequirements && !shouldWatchProfile) return;

    const patch = () => {
      if (location === "/requirements") patchRequirementsLocationFilter();
      if (location.startsWith("/requirements/")) {
        patchExpiredRequirementUi();
        patchAppliedRequirementUi();
        patchApplySoonBannerForActiveAgreement();
      }
      if (location === "/profile") patchMobileInputs();
    };

    const handleInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) sanitizeMobileInput(target);
      patch();
    };

    patch();
    const observer = new MutationObserver(() => patch());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    document.addEventListener("input", handleInput, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("input", handleInput, true);
    };
  }, [location]);

  return null;
}
