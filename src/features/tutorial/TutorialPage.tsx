/**
 * Guided first incident: a self-paced, interactive tutorial that walks the
 * user through the real workflow with a fictional case. Progress persists
 * locally so it can be paused and resumed.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icons } from "../../components/Icons";
import { useApp } from "../../app/AppContext";
import { getSetting, setSetting } from "../../storage/repositories";

interface Task {
  id: string;
  title: string;
  text: string;
  to: string;
  doneLabel: string;
}

const TASKS: Task[] = [
  { id: "create", title: "1 · Create the incident", text: "Open the guided wizard. When asked what happened, choose “Injured wildlife”. Leave the species Unknown — it's a valid answer.", to: "/incidents/new", doneLabel: "Created an incident" },
  { id: "observe", title: "2 · Describe what you observed", text: "In step 4, add an observation like “unable to fly” — describe what you see, not a diagnosis.", to: "/incidents/new", doneLabel: "Added an observation" },
  { id: "location", title: "3 · Add the location", text: "In step 3, describe the area (“roadside near the wetland”) and choose Approximate precision.", to: "/incidents/new", doneLabel: "Recorded a location" },
  { id: "hazard", title: "4 · Flag the traffic hazard", text: "In step 5, mark Traffic as a hazard — the report should warn the next person about the road.", to: "/incidents/new", doneLabel: "Flagged a hazard" },
  { id: "status", title: "5 · Change the status", text: "Open your new incident and change the status to “Responder assigned”. Status changes become timeline events.", to: "/incidents", doneLabel: "Changed a status" },
  { id: "handoff", title: "6 · Create the handoff", text: "Use “Transfer / hand off incident” to record the volunteer receiving responsibility.", to: "/incidents", doneLabel: "Recorded a handoff" },
  { id: "timeline", title: "7 · Inspect the timeline", text: "Every step above is now chronological history. Nothing was overwritten.", to: "/incidents", doneLabel: "Reviewed the timeline" },
  { id: "summary", title: "8 · Generate a handoff summary", text: "Open Export and print a shareable summary — notice the location and contact redaction options.", to: "/incidents", doneLabel: "Generated a summary" },
];

export function TutorialPage() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [done, setDone] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSetting<string[]>("tutorial-progress").then((stored) => {
      if (stored) setDone(stored);
      setLoaded(true);
    });
  }, []);

  function markDone(id: string) {
    setDone((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      void setSetting("tutorial-progress", next);
      if (next.length === TASKS.length) showToast("Tutorial complete — well done!");
      return next;
    });
  }

  function restart() {
    setDone([]);
    void setSetting("tutorial-progress", []);
    showToast("Tutorial restarted");
  }

  if (!loaded) return <main className="content" id="main-content" />;

  const scenarioDone = done.length === TASKS.length;

  return (
    <main className="content" id="main-content" style={{ maxWidth: 760 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Guided first incident</h1>
        <button className="btn btn-quiet btn-sm" onClick={restart}>
          <Icons.undo size={14} /> Restart
        </button>
      </div>
      <div className="notice" style={{ marginTop: "var(--space-4)" }}>
        <Icons.help size={18} />
        <span>
          <strong>Your scenario:</strong> you've received a report of a bird sitting beside a road and unable to fly.
          Work through the steps below using the app itself. Progress is saved on this device.
        </span>
      </div>

      <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem", marginTop: "var(--space-4)" }}>
        {done.length} of {TASKS.length} steps done
      </p>

      <div className="stack">
        {TASKS.map((task) => {
          const isDone = done.includes(task.id);
          return (
            <div key={task.id} className="card" style={{ padding: "var(--space-4)", opacity: isDone ? 0.75 : 1 }}>
              <div className="row between">
                <h3 style={{ margin: 0 }}>{task.title}</h3>
                {isDone && <span className="badge open"><Icons.check size={12} /> {task.doneLabel}</span>}
              </div>
              <p style={{ color: "var(--c-ink-soft)", fontSize: "0.92rem", margin: "var(--space-2) 0 var(--space-3)" }}>{task.text}</p>
              <div className="row">
                <Link to={task.to} className="btn btn-secondary btn-sm">Go</Link>
                {!isDone && (
                  <button className="btn btn-ghost btn-sm" onClick={() => markDone(task.id)}>
                    <Icons.check size={14} /> Mark done
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {scenarioDone && (
        <div className="card fade-in" style={{ marginTop: "var(--space-5)", borderColor: "var(--c-primary)" }}>
          <h3 style={{ color: "var(--c-primary)" }}>Tutorial complete</h3>
          <p style={{ color: "var(--c-ink-soft)" }}>
            You've practiced the full workflow: observe, record, hand off, preserve history. You can restart this tutorial any
            time, or try the fictional demo cases in Examples & tutorial.
          </p>
          <div className="row">
            <button className="btn btn-secondary" onClick={restart}>Restart tutorial</button>
            <button className="btn btn-primary" onClick={() => navigate("/examples")}>Explore demo cases</button>
          </div>
        </div>
      )}
    </main>
  );
}
