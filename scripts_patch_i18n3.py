import io

def edit(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    misses = []
    for a, b in pairs:
        if a not in s:
            misses.append(a[:60])
            continue
        s = s.replace(a, b)
    if misses: print("MISS", path, misses)
    io.open(path, "w", encoding="utf-8", newline="\n").write(s)

# ---- guidance.ts: key-based steps ----
edit("src/features/tutorial/tourStepsTypes.ts", [
  ('''  title: string;
  text: string;''',
   '''  /** translation keys (guidance namespace) resolved at render time */
  titleKey?: string;
  textKey?: string;
  /** literal fallbacks (demo data / fictional content may stay literal) */
  title?: string;
  text?: string;'''),
])

# guidance.ts: swap literals for keys
g = io.open("src/features/tutorial/guidance.ts", encoding="utf-8").read()
import re
mapping = {
  "interface-home": ("tourHomeTitle", "tourHomeTextR", "tourHomeTextP"),
  "interface-report": ("tourReportTitleR", "tourReportTextR", "tourReportTextP"),
  "interface-reports": ("tourReportsTitleR", "tourReportsTextR", "tourReportsTextP"),
  "interface-search": ("tourSearchTitle", "tourSearchTextR", "tourSearchTextP"),
  "interface-filters": ("tourFiltersTitle", "tourFiltersText", None),
  "interface-report-header": (None, None, None),
  "interface-timeline": ("tourTimelineTitle", "tourTimelineText", None),
  "interface-guide": ("tourGuideTitle", "tourGuideTextR", "tourGuideTextP"),
  "interface-settings": ("tourSettingsTitle", "tourSettingsText", None),
}
# Replace title:/text: literals with keys in the interface tour builder
def keyify(step_id, title_key, text_key):
    global g
    i = g.find(f'id: "{step_id}"')
    if i == -1: print("miss step", step_id); return
    if title_key:
        g = g[:i] + re.sub(r'title: "[^"]*"(', f'titleKey: "{title_key}"(', g[i:], count=1)
    # text depends on workspace: replace the two-branch text with textKeyR/P
    if text_key:
        j = g.find("text:", i)
        # find the ternary or literal text for this step and replace with textKey pattern
        end = g.find("},", j)
        seg = g[j:end]
        if 'reporter ?' in seg or '? "' in seg or 'reporter\n' in seg:
            nk = text_key.replace("TextR", "TextP")
            g = g[:j] + f'textKeyR: "{text_key}",\n      textKeyP: "{nk}",' + g[end:]
        else:
            g = g[:j] + f'textKey: "{text_key}",' + g[end:]

for sid, (tk, tr, tp) in mapping.items():
    if tk: keyify(sid, tk, tr)
# add missing keys for steps not covered
g = g.replace('''      id: "interface-report-header",
      tourId: "incident-header",
      title: reporter ? "A report" : "An incident",''','''      id: "interface-report-header",
      tourId: "incident-header",
      titleKey: "tourHomeTitle",''')
io.open("src/features/tutorial/guidance.ts", "w", encoding="utf-8", newline="\n").write(g)
print("guidance keyified (manual review needed)")

# ---- SpotlightTour: render via keys ----
edit("src/features/tutorial/SpotlightTour.tsx", [
  ('import { useNavigate } from "react-router-dom";',
   'import { useNavigate } from "react-router-dom";\nimport { useTranslation } from "react-i18next";'),
  ('''  const generationRef = useRef(0);
  const calloutHeadingRef = useRef<HTMLHeadingElement>(null);
  const nav = useNavigate();''',
   '''  const generationRef = useRef(0);
  const calloutHeadingRef = useRef<HTMLHeadingElement>(null);
  const nav = useNavigate();
  const { t } = useTranslation("guidance");'''),
  ('''        <p className="spotlight-step-count">Step {index + 1} of {steps.length}</p>''',
   '''        <p className="spotlight-step-count">{t("stepOf", { current: index + 1, total: steps.length })}</p>'''),
  ('''            <h3 ref={calloutHeadingRef} tabIndex={-1} className="spotlight-heading">We couldn't find this part of the interface.</h3>
            <p>It may not be available in your current workspace. You can retry, skip this step, or exit the tour.</p>''',
   '''            <h3 ref={calloutHeadingRef} tabIndex={-1} className="spotlight-heading">{t("failedTitle")}</h3>
            <p>{t("failedBody")}</p>'''),
  ('''            {busy && <p className="spotlight-opening" role="status">Opening…</p>}''',
   '''            {busy && <p className="spotlight-opening" role="status">{t("opening")}</p>}'''),
  ('''              <button className="btn btn-quiet btn-sm" onClick={onFinish}>Exit</button>
              <span style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={() => runStep(index, ++generationRef.current)}>Retry</button>''',
   '''              <button className="btn btn-quiet btn-sm" onClick={onFinish}>{t("guideExit")}</button>
              <span style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={() => runStep(index, ++generationRef.current)}>{t("retry", { ns: "common" })}</button>'''),
  ('''            <h3 ref={calloutHeadingRef} tabIndex={-1} className="spotlight-heading">{step.title}</h3>
            <p>{step.text}</p>''',
   '''            <h3 ref={calloutHeadingRef} tabIndex={-1} className="spotlight-heading">{step.titleKey ? t(step.titleKey) : step.title}</h3>
            <p>{step.textKeyR ? t(step.textKeyR) : step.textKey ? t(step.textKey) : step.text}</p>'''),
  ('''              <button className="btn btn-quiet btn-sm" onClick={onFinish}>Exit</button>
              <span style={{ flex: 1 }} />
              {index > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setIndex((i) => Math.max(0, i - 1))}>Back</button>
              )}
              {index < steps.length - 1 ? (
                <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => i + 1)}>Next</button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={onFinish}>Finish</button>
              )}''',
   '''              <button className="btn btn-quiet btn-sm" onClick={onFinish}>{t("guideExit")}</button>
              <span style={{ flex: 1 }} />
              {index > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setIndex((i) => Math.max(0, i - 1))}>{t("back", { ns: "common" })}</button>
              )}
              {index < steps.length - 1 ? (
                <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => i + 1)}>{t("next", { ns: "common" })}</button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={onFinish}>{t("finish", { ns: "common" })}</button>
              )}'''),
  ('''              {index < steps.length - 1 && (
                <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}>Skip step</button>
              )}''',
   '''              {index < steps.length - 1 && (
                <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}>{t("skipStep", { ns: "common" })}</button>
              )}'''),
  ('''                {step.action.label}''',
   '''                {step.action.labelKey ? t(step.action.labelKey) : step.action.label}'''),
])

# action labels -> keys
edit("src/features/tutorial/guidance.ts", [
  ('action: { label: reporter ? "Open my reports" : "Open Incidents", to: "/incidents", advance: true },',
   'action: { labelKey: "openMyReports", to: "/incidents", advance: true },'),
])
edit("src/features/tutorial/tourStepsTypes.ts", [
  ('''export interface TourAction {
  label: string;''',
   '''export interface TourAction {
  label?: string;
  labelKey?: string;'''),
])

# demo tour steps keys
edit("src/features/tutorial/guidance.ts", [
  ('''      id: "demo-what",
      tourId: "incident-header",
      title: "This is a fictional demo incident",
      text: "Demo cases open in the same workspace as real incidents, but stay clearly labeled as fictional.",''',
   '''      id: "demo-what",
      tourId: "incident-header",
      titleKey: "demoTitle1",
      textKey: "demoText1",'''),
  ('''      id: "demo-explore",
      tourId: "tab-timeline",
      title: "Explore it freely",
      text: "You can explore its timeline, status and handoff information exactly like a real case.",''',
   '''      id: "demo-explore",
      tourId: "tab-timeline",
      titleKey: "demoTitle2",
      textKey: "demoText2",'''),
  ('''      id: "demo-isolation",
      tourId: "demo-banner",
      title: "Nothing mixes with your reports",
      text: "Nothing here enters your real reports unless you choose “Copy into my workspace” back on the examples page.",''',
   '''      id: "demo-isolation",
      tourId: "demo-banner",
      titleKey: "demoTitle3",
      textKey: "demoText3",'''),
])

# buildMainTourSteps (tourSteps.ts) literals -> keys (it builds generic tour)
edit("src/features/tutorial/tourSteps.ts", [
  ('title: "Home",', 'titleKey: "tourHomeTitle",'),
  ('title: "Create incident",', 'titleKey: "tourReportTitleP",'),
  ('title: "Incidents",', 'titleKey: "tourReportsTitleP",'),
  ('title: "Search",', 'titleKey: "tourSearchTitle",'),
  ('title: "Filters",', 'titleKey: "tourFiltersTitle",'),
  ('title: "Timeline",', 'titleKey: "tourTimelineTitle",'),
  ('title: "People & handoffs",', 'titleKey: "tourHomeTitle",'),
  ('title: "Transfer / hand off",', 'titleKey: "tourHomeTitle",'),
  ('title: "Export",', 'titleKey: "tourExportTitleP",'),
  ('title: "Settings",', 'titleKey: "tourSettingsTitle",'),
])
print("done")
