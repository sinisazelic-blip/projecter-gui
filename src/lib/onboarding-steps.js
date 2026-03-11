/**
 * First-run onboarding tour steps (EN).
 * path: exact pathname or base path for matching
 * pathRegex: if set, step is shown when pathname matches this regex (overrides path)
 * target: data-onboarding value to highlight (null = no highlight)
 */
export const ONBOARDING_STEPS = [
  {
    path: "/dashboard",
    target: null,
    title: "Welcome to Fluxa",
    body: "This short tour will show you the main areas: Deals, creating a deal, budget & items, Projects (PP), and Finance. You can skip anytime.",
    nextLabel: "Start tour",
    skipLabel: "Skip tour",
  },
  {
    path: "/dashboard",
    target: "desk",
    title: "Your desk",
    body: "From here you access Deals, Strategic Core®, and Projects. We'll highlight each in turn.",
    nextLabel: "Next",
    skipLabel: "Skip tour",
  },
  {
    path: "/dashboard",
    target: "deals",
    title: "Deals",
    body: "Deals are your opportunities and leads. Click here to open the list and create your first deal.",
    nextLabel: "Go to Deals",
    skipLabel: "Skip tour",
  },
  {
    path: "/inicijacije",
    pathExact: true,
    target: "new-deal",
    title: "Create a deal",
    body: "Use this button to create a new deal. You'll set client, deadline, and then add budget items.",
    nextLabel: "Next",
    skipLabel: "Skip tour",
  },
  {
    path: "/inicijacije",
    pathRegex: /^\/inicijacije(\/[^/]+)?$/,
    target: "deal-stavke",
    title: "Budget & line items",
    body: "Here you manage the budget and line items for the deal. You can add items from the price list or enter custom ones.",
    bodyOnList: "Open any deal from the list to see the budget section. Then click Next.",
    nextLabel: "Back to dashboard",
    nextLabelOnList: "Next",
    skipLabel: "Skip tour",
  },
  {
    path: "/dashboard",
    target: "pp",
    title: "Projects (PP)",
    body: "Once a deal is won, open it as a project here. Projects track phases, costs, and invoicing.",
    nextLabel: "Next",
    skipLabel: "Skip tour",
  },
  {
    path: "/dashboard",
    target: "profit",
    title: "Finance & Profit",
    body: "Invoicing, bank statements, reports, and profit analysis live here. Expand this section to explore.",
    nextLabel: "Next",
    skipLabel: "Skip tour",
  },
  {
    path: "/dashboard",
    target: null,
    title: "You're all set",
    body: "You've seen the main areas. You can always use the dashboard to jump to Deals, Projects, or Finance.",
    nextLabel: "Finish",
    skipLabel: null,
  },
];

export function getStepPathMatch(step, pathname) {
  if (step.pathRegex) return step.pathRegex.test(pathname);
  if (step.pathExact) return pathname === step.path;
  return pathname === step.path || pathname.startsWith(step.path + "/");
}

export function getStepForPath(pathname, stepIndex) {
  const steps = ONBOARDING_STEPS;
  if (stepIndex < 0 || stepIndex >= steps.length) return null;
  const step = steps[stepIndex];
  return getStepPathMatch(step, pathname) ? step : null;
}
