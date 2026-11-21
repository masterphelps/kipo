import { jsxs as u, jsx as n, Fragment as ge } from "react/jsx-runtime";
import { useAppApi as wt, useAppInfo as On } from "@kirocrew/app-sdk";
import { useState as W, useCallback as Ae, useEffect as U, useRef as pe, useLayoutEffect as En, useMemo as nn } from "react";
import { Btn as Se, Badge as Mt, MarkdownRenderer as ut } from "@kirocrew/app-sdk/ui";
import { X as Nn, FolderGit2 as on, FolderOpen as Wn, MessageSquare as rn, ChevronRight as pt, Plus as Mn, FolderPlus as Hn, MoreHorizontal as Ht, ExternalLink as Pt, EyeOff as Pn, Trash2 as Dt, Map as Dn, PanelRight as Ln } from "lucide-react";
import { createPortal as Bn } from "react-dom";
const jn = "/apps/kipo/api";
class ht extends Error {
  constructor(t, i, r) {
    super(i), this.name = "BackendError", this.status = t, this.code = r;
  }
}
async function re(e, t = "GET", i) {
  let r;
  try {
    r = await fetch(`${jn}${e}`, {
      method: t,
      credentials: "include",
      headers: i === void 0 ? void 0 : { "Content-Type": "application/json" },
      body: i === void 0 ? void 0 : JSON.stringify(i)
    });
  } catch {
    throw new ht(0, "Couldn't reach the KiPo backend. Is the app running?", null);
  }
  const s = await r.text();
  let g;
  if (s.trim())
    try {
      g = JSON.parse(s);
    } catch {
      g = void 0;
    }
  if (!r.ok) {
    const d = g ?? {}, f = typeof d.error == "string" && d.error ? d.error : `The KiPo backend answered ${r.status}.`;
    throw new ht(r.status, f, typeof d.code == "string" ? d.code : null);
  }
  return g;
}
const ke = (e, t) => {
  const [i, r] = e.split("/");
  return `/initiatives/${encodeURIComponent(i)}/${encodeURIComponent(r)}/${t}`;
}, le = {
  getConfig: () => re("/config"),
  putConfig: (e) => re("/config", "PUT", e),
  discoverRepos: () => re("/repos/discover"),
  addRepo: (e) => re("/repos", "POST", { path: e }),
  removeRepo: (e) => re("/repos/remove", "POST", { slug: e }),
  browse: (e) => re(e ? `/browse?path=${encodeURIComponent(e)}` : "/browse"),
  listInitiatives: () => re("/initiatives"),
  startInitiative: (e) => re("/initiatives", "POST", e),
  getInitiative: (e, t) => re(ke(e, t)),
  // Next along the path, or `to` a later column.
  advance: (e, t, i, r = null) => re(`${ke(e, t)}/advance`, "POST", { force: i, to: r }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (e, t, i) => re(`${ke(e, t)}/session`, "POST", { skill: null, ticket: null, mode: null, ...i }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (e, t, i) => re(`${ke(e, t)}/sessions/started`, "POST", { key: i }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (e, t, i) => re(`${ke(e, t)}/sessions/closed`, "POST", { keys: i }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (e, t, i) => re(`${ke(e, t)}/sessions/activity`, "POST", { activity: i }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (e, t, i, r, s) => re(`${ke(e, t)}/sessions/woken`, "POST", { key: i, stall: r, why: s }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (e, t, i) => re(`${ke(e, t)}/skill`, "POST", { skill: i }),
  listSessions: () => re("/sessions"),
  tree: (e = !1) => re(e ? "/tree?completed=1" : "/tree"),
  // A background session's recent transcript, when the dashboard never opened
  // it as a page (so the embedded chat would be empty).
  sessionTail: (e, t = 60) => re(
    `/sessions/tail?slot=${encodeURIComponent(e)}&limit=${t}`
  ),
  // The green dot: on the sidebar or off. Nothing changes on GitHub.
  setOnSidebar: (e, t, i, r) => re("/sidebar", "POST", { repo: e, number: t, kind: i, on: r }),
  // Off the sidebar and back; nothing changes on GitHub.
  hide: (e, t) => re(`${ke(e, t)}/hide`, "POST", {}),
  unhide: (e, t) => re(`${ke(e, t)}/unhide`, "POST", {}),
  removeInitiative: (e, t) => re(`${ke(e, t)}/remove`, "POST", {}),
  ticket: (e, t, i) => re(`${ke(e, t)}/tickets/${i}`),
  frontier: (e, t) => re(`${ke(e, t)}/frontier`),
  doc: (e, t, i) => re(`${ke(e, t)}/doc?href=${encodeURIComponent(i)}`)
};
function be(e) {
  return e instanceof Error ? e.message : String(e);
}
const ft = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, qn = {
  intake: "A raw issue, request or refactor candidate nobody has shaped yet.",
  shape: "Open questions: a wayfinder map, a prototype, research, a questionnaire waiting on someone.",
  grill: "An interview in progress. It updates GLOSSARY.md and adds ADRs.",
  plan: "A spec and the tickets that hang off it, with their blocking links.",
  build: "Tickets being built, or a branch with commits.",
  review: "A PR is open: the agent reviews it, fixes what it finds and merges it.",
  done: "Merged. /retro turns what went wrong into checks, standards and agent instructions."
}, kt = {
  "setup-matt-pocock-skills": "Set up this repo for the skills: tracker, triage labels, docs layout. Once per repo.",
  "ask-matt": "Ask which skill or flow fits this situation.",
  triage: "Move a raw issue through triage to an agent-ready brief.",
  "improve-codebase-architecture": "Survey the codebase for deepening opportunities; picking one becomes an idea for Grill.",
  wayfinder: "Chart a map of decision tickets for an effort too big to see through, then work them one at a time.",
  "to-questionnaire": "Write a questionnaire for someone else who holds the answers.",
  handoff: "Write a portable handoff file, for a new directory, harness or person.",
  teach: "Learn a concept over several sessions, using this folder as the workspace.",
  "grill-with-docs": "Interview you about the idea, keeping GLOSSARY.md and ADRs up to date.",
  "grill-me": "The same interview, without writing anything to the repo.",
  "wait-what": "Re-explain the last message in plain words.",
  "to-spec": "Turn the conversation into a spec.",
  "to-tickets": "Split the spec into tracer-bullet tickets with blocking links.",
  implement: "Build one ticket, test-first, then review it.",
  "implement-spec": "Build every unblocked ticket in parallel on one integration branch, then one review.",
  retro: "Look back and turn lessons into checks, coding standards and agent instructions.",
  "writing-for-agents": "Write or edit skills, AGENTS.md and CLAUDE.md.",
  research: "Investigate a question against primary sources and leave a cited note.",
  prototype: "Throwaway code to answer one design question.",
  grilling: "The interview itself.",
  "domain-modeling": "Sharpen the domain language: GLOSSARY.md and ADRs.",
  "codebase-design": "Design the module shape: depth, seams, interfaces.",
  tdd: "Red, green, refactor, one slice at a time.",
  "diagnosing-bugs": "A tight feedback loop on a hard bug, then a fix with a regression test.",
  wizard: "A guided script for steps only you can do.",
  "code-review": "Review the diff against the coding standards and the spec.",
  pr: "Write the PR body: the change, evidence it works, and how reversible it is."
}, Gn = ["intake", "decide", "deliver", "done"], Kn = { intake: "Intake", decide: "Decide", deliver: "Deliver", done: "Done" }, _n = {
  intake: ["intake"],
  decide: ["shape", "grill", "plan"],
  deliver: ["build", "review"],
  done: ["done"]
}, Fn = (e) => Gn.find((t) => _n[t].includes(e)) ?? "intake", y = {
  body: 13,
  small: 12,
  tiny: 11,
  title: 15
}, it = {
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: y.body,
  width: "100%",
  minWidth: 0
}, q = { color: "var(--muted)" }, ve = { color: "var(--text-strong, var(--text))", fontWeight: 600 };
function Ke({ children: e }) {
  return e ? /* @__PURE__ */ n(
    "div",
    {
      role: "alert",
      style: {
        background: "var(--danger-subtle)",
        color: "var(--danger-text)",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: y.body
      },
      children: e
    }
  ) : null;
}
function sn({ path: e }) {
  return /* @__PURE__ */ n(
    "code",
    {
      title: e,
      style: {
        background: "var(--bg-elevated)",
        color: "var(--text)",
        fontSize: y.tiny,
        borderRadius: 4,
        padding: "1px 5px",
        wordBreak: "break-all",
        fontFamily: "var(--font-mono, ui-monospace, monospace)"
      },
      children: e
    }
  );
}
function Lt({ children: e, onClick: t, disabled: i, primary: r, danger: s, title: g }) {
  const d = r ? "var(--accent)" : s ? "var(--danger-subtle)" : "var(--bg-elevated)", f = r ? "var(--accent-fg, #fff)" : s ? "var(--danger-text)" : "var(--text)";
  return /* @__PURE__ */ n(
    "button",
    {
      type: "button",
      onClick: t,
      disabled: i,
      title: g,
      style: {
        height: 28,
        padding: "0 12px",
        flexShrink: 0,
        alignSelf: "center",
        whiteSpace: "nowrap",
        fontSize: y.body,
        fontWeight: r ? 600 : 500,
        lineHeight: "28px",
        borderRadius: 6,
        border: r ? "1px solid transparent" : "1px solid var(--border)",
        background: d,
        color: f,
        cursor: i ? "default" : "pointer",
        opacity: i ? 0.5 : 1
      },
      children: e
    }
  );
}
function at({ title: e, aside: t, children: i, defaultOpen: r = !0 }) {
  const [s, g] = W(r);
  return /* @__PURE__ */ u("section", { style: { borderTop: "1px solid var(--border)" }, children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        onClick: () => g((d) => !d),
        "aria-expanded": s,
        style: {
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          fontSize: y.small
        },
        children: [
          /* @__PURE__ */ n("span", { "aria-hidden": !0, style: { ...q, width: 10, fontSize: 9 }, children: s ? "▾" : "▸" }),
          /* @__PURE__ */ n("span", { style: ve, children: e }),
          /* @__PURE__ */ n("span", { style: { flex: 1 } }),
          t != null && /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.tiny }, children: t })
        ]
      }
    ),
    s && /* @__PURE__ */ n("div", { style: { padding: "0 12px 10px 28px", fontSize: y.body }, children: i })
  ] });
}
function Bt(e) {
  const t = Date.parse(e);
  if (Number.isNaN(t)) return "";
  const i = Math.max(0, Math.round((Date.now() - t) / 1e3));
  if (i < 60) return "just now";
  const r = Math.round(i / 60);
  if (r < 60) return `${r} min ago`;
  const s = Math.round(r / 60);
  if (s < 24) return `${s} h ago`;
  const g = Math.round(s / 24);
  return g < 30 ? `${g} d ago` : new Date(t).toLocaleDateString();
}
function gt({ kind: e, map: t }) {
  if (e !== "map" && !t) return null;
  const i = e === "map";
  return /* @__PURE__ */ u(
    "span",
    {
      title: i ? `Wayfinder map #${t ?? ""}, shown as it stands` : `Runs on wayfinder map #${t}`,
      style: {
        flexShrink: 0,
        fontSize: 10,
        lineHeight: "15px",
        padding: "0 5px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        border: `1px solid ${i ? "var(--accent)" : "var(--border)"}`,
        color: i ? "var(--accent)" : "var(--muted)"
      },
      children: [
        i ? "Map" : "map",
        t ? ` #${t}` : ""
      ]
    }
  );
}
function ln({ busy: e, onAdd: t, actionLabel: i = "Add" }) {
  var c;
  const [r, s] = W(null), [g, d] = W(""), f = Ae(async (p) => {
    d("");
    try {
      s(await le.browse(p));
    } catch (o) {
      d(be(o));
    }
  }, []);
  return U(() => {
    f();
  }, [f]), /* @__PURE__ */ u(
    "div",
    {
      className: "rounded-md p-3 mb-3",
      style: { background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ n(Ke, { children: g }),
        r ? /* @__PURE__ */ u(ge, { children: [
          /* @__PURE__ */ u("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ n(Se, { disabled: !r.parent, onClick: () => r.parent && f(r.parent), children: "Up" }),
            /* @__PURE__ */ n(sn, { path: r.path }),
            ((c = r.here) == null ? void 0 : c.slug) && /* @__PURE__ */ u(Se, { primary: !0, disabled: e === r.path, onClick: () => t(r.path), children: [
              i,
              " this folder"
            ] })
          ] }),
          /* @__PURE__ */ u("ul", { className: "flex flex-col max-h-72 overflow-y-auto", children: [
            r.folders.map((p) => /* @__PURE__ */ u("li", { className: "flex items-center gap-2 py-1", children: [
              /* @__PURE__ */ n(
                "button",
                {
                  type: "button",
                  className: "text-sm text-left flex-1 truncate hover:underline",
                  style: { background: "transparent", color: "var(--text)" },
                  onClick: () => f(p.path),
                  children: p.name
                }
              ),
              p.repo && (p.slug ? /* @__PURE__ */ u(ge, { children: [
                /* @__PURE__ */ n(Mt, { variant: "aim", children: p.slug }),
                /* @__PURE__ */ n(Se, { primary: !0, disabled: e === p.path, onClick: () => t(p.path), children: i })
              ] }) : /* @__PURE__ */ n(Mt, { variant: "muted", children: "no GitHub remote" }))
            ] }, p.path)),
            r.folders.length === 0 && /* @__PURE__ */ n("li", { className: "text-sm text-muted", children: "No folders here." })
          ] })
        ] }) : /* @__PURE__ */ n("p", { className: "text-sm text-muted", children: "Opening your home folder…" })
      ]
    }
  );
}
function Jn({ onAdded: e, onClose: t }) {
  const [i, r] = W(null), [s, g] = W(""), [d, f] = W(!1), [c, p] = W(null);
  U(() => {
    let a = !0;
    return le.tree().then((l) => {
      a && r(l.available);
    }).catch((l) => {
      a && (r([]), g(be(l)));
    }), () => {
      a = !1;
    };
  }, []), U(() => {
    const a = (l) => {
      l.key === "Escape" && t();
    };
    return window.addEventListener("keydown", a), () => window.removeEventListener("keydown", a);
  }, [t]);
  const o = async (a) => {
    p(a), g("");
    try {
      await le.addRepo(a), e(), t();
    } catch (l) {
      g(be(l));
    } finally {
      p(null);
    }
  };
  return /* @__PURE__ */ n(
    "div",
    {
      role: "presentation",
      onClick: t,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh"
      },
      children: /* @__PURE__ */ u(
        "div",
        {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Add a repo",
          onClick: (a) => a.stopPropagation(),
          style: {
            width: "min(560px, calc(100vw - 48px))",
            maxHeight: "72vh",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 16px 48px rgba(0,0,0,.5)"
          },
          children: [
            /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
              /* @__PURE__ */ u("div", { style: { flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ n("div", { style: { ...ve, fontSize: y.body }, children: "Add a repo" }),
                /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.tiny, marginTop: 1 }, children: "It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed." })
              ] }),
              /* @__PURE__ */ n(
                "button",
                {
                  type: "button",
                  onClick: t,
                  "aria-label": "Close",
                  style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "inline-flex" },
                  children: /* @__PURE__ */ n(Nn, { size: 15 })
                }
              )
            ] }),
            /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 14px" }, children: [
              /* @__PURE__ */ n(Ke, { children: s }),
              i === null && /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small, padding: "6px 6px" }, children: "Looking for checkouts on this Mac…" }),
              i !== null && i.length > 0 && !d && /* @__PURE__ */ n("div", { style: { display: "flex", flexDirection: "column" }, children: i.slice(0, 12).map((a) => /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  disabled: !!c,
                  onClick: () => void o(a.path),
                  title: a.path,
                  onMouseEnter: (l) => {
                    l.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.06))";
                  },
                  onMouseLeave: (l) => {
                    l.currentTarget.style.background = "transparent";
                  },
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 8px",
                    borderRadius: 6,
                    background: "transparent",
                    color: "var(--text)",
                    cursor: c ? "default" : "pointer",
                    textAlign: "left"
                  },
                  children: [
                    /* @__PURE__ */ n(on, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    /* @__PURE__ */ n("span", { style: { flex: 1, minWidth: 0, fontSize: y.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: c === a.path ? "Adding…" : a.slug }),
                    a.maps > 0 && /* @__PURE__ */ u("span", { style: { ...q, fontSize: y.tiny, flexShrink: 0 }, children: [
                      a.maps,
                      " open map",
                      a.maps === 1 ? "" : "s"
                    ] })
                  ]
                },
                a.path
              )) }),
              i !== null && i.length === 0 && !d && /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small, padding: "6px 6px" }, children: "No un-added checkouts found under your home folder. Browse for one:" }),
              d ? /* @__PURE__ */ n("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ n(ln, { busy: c, onAdd: (a) => void o(a) }) }) : /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  onClick: () => f(!0),
                  onMouseEnter: (a) => {
                    a.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.06))";
                  },
                  onMouseLeave: (a) => {
                    a.currentTarget.style.background = "transparent";
                  },
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 8px",
                    borderRadius: 6,
                    marginTop: 4,
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                    fontSize: y.small
                  },
                  children: [
                    /* @__PURE__ */ n(Wn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    "Browse for a folder…"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ n("div", { style: { display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderTop: "1px solid var(--border)" }, children: /* @__PURE__ */ n(Se, { onClick: t, children: "Cancel" }) })
          ]
        }
      )
    }
  );
}
const an = "kipo.layout.v1";
function jt() {
  try {
    return JSON.parse(localStorage.getItem(an) || "{}");
  } catch {
    return {};
  }
}
function cn(e, t, i, r) {
  const s = Ae((c) => Math.round(Math.min(r, Math.max(i, c))), [i, r]), [g, d] = W(() => {
    const c = jt()[e];
    return s(typeof c == "number" ? c : t);
  });
  U(() => {
    const c = jt();
    c[e] = g;
    try {
      localStorage.setItem(an, JSON.stringify(c));
    } catch {
    }
  }, [e, g]);
  const f = Ae((c) => {
    d((p) => s(typeof c == "function" ? c(p) : c));
  }, [s]);
  return [g, f];
}
function dn({ direction: e, onDrag: t, onReset: i, label: r }) {
  const s = pe(null), [g, d] = W(!1), [f, c] = W(!1), p = e === "vertical", o = (I) => p ? I.clientX : I.clientY;
  U(() => {
    if (!g) return;
    const I = (j) => {
      if (s.current == null) return;
      const L = o(j), K = L - s.current;
      K && (s.current = L, t(K));
    }, M = () => {
      s.current = null, d(!1);
    };
    return window.addEventListener("pointermove", I), window.addEventListener("pointerup", M), window.addEventListener("pointercancel", M), () => {
      window.removeEventListener("pointermove", I), window.removeEventListener("pointerup", M), window.removeEventListener("pointercancel", M);
    };
  }, [g, t]);
  const a = (I) => {
    I.preventDefault(), s.current = o(I), d(!0);
  }, l = (I) => {
    const M = I.shiftKey ? 40 : 10, j = p ? "ArrowLeft" : "ArrowUp", L = p ? "ArrowRight" : "ArrowDown";
    I.key === j && (I.preventDefault(), t(-M)), I.key === L && (I.preventDefault(), t(M));
  }, S = g || f, G = p ? { width: 9, margin: "0 -4px", cursor: "col-resize", alignSelf: "stretch" } : { height: 9, margin: "-4px 0", cursor: "row-resize", width: "100%" };
  return /* @__PURE__ */ u(
    "div",
    {
      role: "separator",
      "aria-orientation": p ? "vertical" : "horizontal",
      "aria-label": r,
      tabIndex: 0,
      title: `${r}. Drag to resize, double-click to reset.`,
      onPointerDown: a,
      onPointerEnter: () => c(!0),
      onPointerLeave: () => c(!1),
      onDoubleClick: i,
      onKeyDown: l,
      style: { ...G, flexShrink: 0, position: "relative", zIndex: 2, touchAction: "none", display: "flex", justifyContent: "center", alignItems: "center" },
      children: [
        /* @__PURE__ */ n(
          "span",
          {
            "aria-hidden": !0,
            style: p ? { width: S ? 3 : 1, height: "100%", borderRadius: 2, background: S ? "var(--accent)" : "var(--border)", transition: "width .1s" } : { height: S ? 3 : 1, width: "100%", borderRadius: 2, background: S ? "var(--accent)" : "var(--border)", transition: "height .1s" }
          }
        ),
        /* @__PURE__ */ n("span", { "aria-hidden": !0, style: {
          position: "absolute",
          borderRadius: 3,
          background: S ? "var(--accent)" : "var(--border)",
          ...p ? { width: 5, height: 28, top: "calc(50% - 14px)" } : { height: 5, width: 28, left: "calc(50% - 14px)" }
        } }),
        g && /* @__PURE__ */ n("div", { style: { position: "fixed", inset: 0, zIndex: 9999, cursor: p ? "col-resize" : "row-resize" } })
      ]
    }
  );
}
function Yn(e, t, i = 0.75) {
  const [r, s] = cn(e, 0, 0, 4e3), g = pe(null), d = Ae((c) => {
    const p = Math.round(window.innerHeight * i);
    s((o) => {
      var l;
      const a = o || ((l = g.current) == null ? void 0 : l.offsetHeight) || t;
      return Math.max(t, Math.min(p, a + c));
    });
  }, [t, i, s]), f = r ? { flex: `0 0 ${r}px`, minHeight: 0, overflowY: "auto" } : { flex: "0 1 auto", minHeight: 0, maxHeight: `${Math.round(i * 100)}%`, overflowY: "auto" };
  return { ref: g, style: f, onDrag: d, reset: () => s(0) };
}
const xt = "kipo.cache.v2:";
try {
  for (let e = localStorage.length - 1; e >= 0; e--) {
    const t = localStorage.key(e);
    t && t.startsWith("kipo.cache.") && !t.startsWith(xt) && localStorage.removeItem(t);
  }
} catch {
}
const rt = /* @__PURE__ */ new Map();
function Ve(e) {
  if (rt.has(e)) return rt.get(e);
  try {
    const t = localStorage.getItem(xt + e);
    if (t == null) return null;
    const i = JSON.parse(t);
    return rt.set(e, i), i;
  } catch {
    return null;
  }
}
function Ze(e, t) {
  rt.set(e, t);
  try {
    localStorage.setItem(xt + e, JSON.stringify(t));
  } catch {
  }
}
const Un = "KiPo", qt = "kipo.sessionsFiled.v2", Qn = (e) => {
  var i;
  const t = (e == null ? void 0 : e.id) ?? ((i = e == null ? void 0 : e.folder) == null ? void 0 : i.id);
  if (!t) throw new Error("the sidebar didn't return the new folder");
  return t;
};
async function un(e, t, i, r) {
  const s = await e.get("/api/chat/folders"), g = s == null ? void 0 : s.find((d) => d.name === t && (d.parent_id || null) === i);
  return g ? g.id : Qn(await e.post("/api/chat/folders", {
    name: t,
    ...i ? { parent_id: i } : {},
    ...r ? { icon: r } : {}
  }));
}
const Xn = (e) => un(e, Un, null, "⚗️"), Vn = (e) => e.split("/").pop() || e;
async function pn(e, t) {
  const i = await Xn(e);
  try {
    return await un(e, Vn(t), i);
  } catch {
    return i;
  }
}
async function Zn(e) {
  if (localStorage.getItem(qt)) return;
  const { byRepo: t } = await le.listSessions(), i = /* @__PURE__ */ new Map();
  for (const { repo: r } of t ?? [])
    i.has(r) || i.set(r, await pn(e, r));
  await Promise.all((t ?? []).map(
    ({ slot: r, repo: s }) => e.patch(`/api/chat/slots/${encodeURIComponent(r)}/folder`, { folder_id: i.get(s) }).catch(() => {
    })
    // a session that was closed or deleted is simply skipped
  )), localStorage.setItem(qt, (/* @__PURE__ */ new Date()).toISOString());
}
const hn = {
  position: "fixed",
  zIndex: 99999,
  background: "var(--bg-elevated, #2a2a2a)",
  border: "1px solid var(--border, rgba(255,255,255,0.15))",
  borderRadius: 6,
  boxShadow: "0 4px 12px var(--shadow, rgba(0,0,0,0.5))"
};
function fn(e, t, i) {
  const r = pe(null), [s, g] = W({ x: e, y: t });
  return En(() => {
    const d = r.current;
    if (!d) return;
    const f = d.getBoundingClientRect();
    g({
      x: e + f.width > window.innerWidth ? Math.max(0, e - f.width) : e,
      y: t + f.height > window.innerHeight ? Math.max(0, t - f.height) : t
    });
  }, [e, t]), U(() => {
    const d = (p) => {
      r.current && !r.current.contains(p.target) && i();
    }, f = (p) => {
      p.key === "Escape" && i();
    }, c = setTimeout(() => {
      window.addEventListener("mousedown", d, !0), window.addEventListener("keydown", f, !0), window.addEventListener("blur", i);
    }, 50);
    return () => {
      clearTimeout(c), window.removeEventListener("mousedown", d, !0), window.removeEventListener("keydown", f, !0), window.removeEventListener("blur", i);
    };
  }, [i]), { ref: r, pos: s };
}
function Gt({ x: e, y: t, items: i, onClose: r }) {
  const { ref: s, pos: g } = fn(e, t, r);
  return U(() => {
    var d, f;
    (f = (d = s.current) == null ? void 0 : d.querySelector("[role=menuitem]")) == null || f.focus();
  }, [s]), /* @__PURE__ */ n("div", { ref: s, role: "menu", style: { ...hn, left: g.x, top: g.y, padding: "4px 0", minWidth: 160 }, children: i.map((d, f) => {
    if ("separator" in d)
      return /* @__PURE__ */ n("div", { role: "separator", style: { height: 1, background: "var(--border, rgba(255,255,255,0.15))", margin: "2px 0" } }, `sep-${f}`);
    const c = d.icon, p = () => {
      r(), d.onSelect();
    };
    return /* @__PURE__ */ n(
      "div",
      {
        role: "menuitem",
        tabIndex: 0,
        onClick: (o) => {
          o.stopPropagation(), p();
        },
        onKeyDown: (o) => {
          (o.key === "Enter" || o.key === " ") && (o.preventDefault(), p());
        },
        onMouseEnter: (o) => {
          o.currentTarget.style.background = "rgba(255,255,255,0.1)";
        },
        onMouseLeave: (o) => {
          o.currentTarget.style.background = "transparent";
        },
        style: {
          padding: "6px 16px",
          fontSize: 12,
          cursor: "pointer",
          outline: "none",
          color: d.danger ? "var(--danger, #f38ba8)" : "var(--text, #e0e0e0)"
        },
        children: /* @__PURE__ */ u("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ n("span", { style: { width: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.85 }, children: c ? /* @__PURE__ */ n(c, { size: 13 }) : null }),
          d.label
        ] })
      },
      d.label
    );
  }) });
}
function ct({ x: e, y: t, title: i, children: r, action: s, onConfirm: g, onClose: d }) {
  const { ref: f, pos: c } = fn(e, t, d);
  return /* @__PURE__ */ u(
    "div",
    {
      ref: f,
      role: "alertdialog",
      "aria-label": i,
      style: { ...hn, left: c.x, top: c.y, padding: "12px 14px", width: 280 },
      children: [
        /* @__PURE__ */ n("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e0e0e0)", lineHeight: 1.35 }, children: i }),
        r && /* @__PURE__ */ n("div", { style: { fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6, lineHeight: 1.45 }, children: r }),
        /* @__PURE__ */ u("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ n(Se, { onClick: d, children: "Cancel" }),
          /* @__PURE__ */ n(Se, { danger: !0, onClick: () => {
            d(), g();
          }, children: s })
        ] })
      ]
    }
  );
}
const eo = {
  Gr: "Gr = Grilling: a decision ticket, settled by an interview with you (HITL)",
  Pr: "Pr = Prototype: a decision ticket, settled by building something throwaway to react to",
  Rs: "Rs = Research: a decision ticket, settled by an agent reading primary sources",
  Tk: "Tk = Task: a decision-side ticket of plain work on the wayfinder map",
  Bd: "Bd = Build: a spec ticket that ships code (Deliver)",
  Is: "Is = Issue: the source issue, or a plain follow-up filed on the map"
}, Fe = {
  you: "HITL = human in the loop: open, unblocked, and it needs a person",
  afk: "Agent (AFK = away from keyboard): open, unblocked, and an agent can take it on its own",
  building: "In progress: an agent is building it",
  review: "In review: its pull request is open",
  blocked: "Blocked: waiting on a ticket that is still open",
  done: "Done: closed",
  fog: "Fog: in scope but not yet specified — listed in the map's Not yet specified section, not a ticket yet"
}, mt = {
  HITL: Fe.you,
  AFK: Fe.afk,
  Agent: Fe.afk,
  PR: "PR = pull request on GitHub",
  Fog: Fe.fog,
  Decide: "Decide: the wayfinder map — decision tickets that settle what to build",
  Deliver: "Deliver: the spec tickets — the work that ships it",
  Origin: "Origin: the issue the effort started from",
  "hand-over": "Hand-over: the spec tickets were cut from the decided wayfinder map",
  spec: "Spec tickets: the build tickets cut from the spec, labelled kipo:<effort number>",
  kipo: "kipo:<n>: the label that ties a ticket to effort #<n>",
  map: "Wayfinder map: the issue that lists the effort’s decision tickets and its fog"
}, to = (e) => [eo[e.code], Fe[e.state]].filter(Boolean).join(`
`);
function no({ term: e, title: t, children: i }) {
  return /* @__PURE__ */ n(
    "abbr",
    {
      title: t ?? (e ? mt[e] : void 0),
      style: { textDecoration: "underline dotted", textDecorationColor: "color-mix(in srgb, currentColor 45%, transparent)", textUnderlineOffset: 2, cursor: "help" },
      children: i
    }
  );
}
const E = {
  done: { label: "done", color: "#3fae6a", text: "#7fd39a" },
  review: { label: "in review", color: "#a78bfa", text: "#a78bfa" },
  building: { label: "building", color: "#60a5fa", text: "#60a5fa" },
  you: { label: "HITL", color: "#f5b14c", text: "#f5b14c" },
  afk: { label: "agent", color: "#2dd4bf", text: "#2dd4bf" },
  blocked: { label: "blocked", color: "#c2615b", text: "#e08a85" },
  fog: { label: "fog", color: "transparent", text: "var(--muted)" }
};
function Kt({ tile: e, onClick: t, size: i = 34, open: r, status: s, bare: g, numberOnly: d, width: f }) {
  const c = E[e.state], p = e.state !== "blocked", o = e.state === "done", a = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((S) => `#${S}`).join(", ")}` : `#${e.number} ${e.title}: ${c.label}`;
  return /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      onClick: t,
      title: `${a}${s === "running" ? " · agent working" : s === "attention" ? " · needs you: a trust prompt or question" : s === "waiting" ? " · awaiting input" : ""}

${to(e)}`,
      "aria-current": r ? "true" : void 0,
      style: {
        position: "relative",
        width: f ?? i,
        height: d ? i : i + 6,
        flexShrink: 0,
        borderRadius: 6,
        padding: 0,
        outline: r ? "2px solid var(--text-strong, #fff)" : void 0,
        outlineOffset: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: t ? "pointer" : "default",
        fontWeight: d ? 700 : 800,
        fontSize: d ? 11 : 13,
        fontVariantNumeric: "tabular-nums",
        background: o ? "rgba(63,174,106,.22)" : p ? c.color : "transparent",
        color: o ? "#7fd39a" : p ? "#14121c" : "var(--muted)",
        border: p ? "1px solid transparent" : `1.5px solid ${c.color}`
      },
      children: [
        d ? e.number : /* @__PURE__ */ u(ge, { children: [
          !g && /* @__PURE__ */ n("span", { style: { position: "absolute", top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }, children: e.number }),
          e.code
        ] }),
        s && // Inside the tile's top-right corner, in the tile's own text color so it
        // reads on every tile color: pulsing while the agent works or needs
        // you (trust prompt, question), steady when merely waiting.
        /* @__PURE__ */ n(
          "span",
          {
            className: s === "running" || s === "attention" ? "kipo-pulse" : void 0,
            style: {
              position: "absolute",
              top: d ? 2 : 4,
              right: d ? 2 : 4,
              width: d ? 5 : 6,
              height: d ? 5 : 6,
              borderRadius: 999,
              background: "currentColor"
            }
          }
        )
      ]
    }
  );
}
async function oo(e, t, i, r, s, g) {
  let d;
  try {
    d = await pn(e, t);
  } catch {
    d = void 0;
  }
  const f = await e.post("/api/chat/slots", {
    name: i,
    title: s,
    ...d ? { folder_id: d } : {},
    // The app's own agent for this session (the conductor); the default agent otherwise.
    ...g ? { agent: g } : {}
  }), c = (f == null ? void 0 : f.key) || i;
  return await e.post("/api/chat?ws=1", { slot: c, message: r }), c;
}
const gn = "kipo.closedSessions.v1", _e = (e) => !!e && St().has(e);
function St() {
  try {
    return new Set(JSON.parse(localStorage.getItem(gn) || "[]"));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function yt(e) {
  const t = St();
  t.add(e);
  try {
    localStorage.setItem(gn, JSON.stringify([...t].slice(-500)));
  } catch {
  }
}
async function _t(e, t) {
  try {
    await e.del(`/api/chat/slots/${encodeURIComponent(t)}`);
  } catch (i) {
    if (!/404|not.?found/i.test(String((i == null ? void 0 : i.message) ?? i))) return !1;
  }
  return yt(t), !0;
}
async function Ft(e, t, i) {
  const r = St(), s = [];
  for (const g of t)
    if (!(!g || g === i)) {
      if (r.has(g)) {
        s.push(g);
        continue;
      }
      try {
        const d = await e.get(`/api/chat/slots/${encodeURIComponent(g)}?limit=1`);
        if (d != null && d.running) continue;
        await e.del(`/api/chat/slots/${encodeURIComponent(g)}`), yt(g), s.push(g);
      } catch (d) {
        /404|not.?found/i.test(String((d == null ? void 0 : d.message) ?? d)) && (yt(g), s.push(g));
      }
    }
  return s;
}
const io = [
  { id: "intake", label: "Intake", skill: "kipo-intake", matt: ["setup-matt-pocock-skills", "ask-matt", "triage", "improve-codebase-architecture"], what: "Set the repo up, triage the issue, pick a start" },
  { id: "shape", label: "Shape", skill: "kipo-shape", matt: ["wayfinder", "research", "prototype", "to-questionnaire"], any: ["handoff", "teach"], what: "Huge, foggy: chart the map, work its decision tickets" },
  { id: "grill", label: "Grill", skill: "kipo-grill", matt: ["grill-with-docs", "grill-me", "grilling", "domain-modeling"], any: ["wait-what"], what: "An idea: interview until it's sharp" },
  { id: "plan", label: "Plan", skill: "kipo-plan", matt: ["to-spec", "to-tickets", "codebase-design"], what: "Hand-over: spec, then tickets" },
  { id: "build", label: "Build", skill: "kipo-build", matt: ["implement", "implement-spec", "tdd", "diagnosing-bugs", "wizard"], what: "One ticket per session, test-first, open a PR" },
  { id: "review", label: "Review", skill: "kipo-review", matt: ["code-review", "pr"], what: "Review, then merge by Merge Danger" },
  { id: "done", label: "Done", skill: "kipo-done", matt: ["retro", "writing-for-agents"], what: "Retro the run, tidy the docs" }
], ro = (e) => e.state === "done" ? "done" : e.source ? "intake" : e.state === "review" ? "review" : e.type === "build" ? "build" : e.type === "grilling" ? "grill" : "shape";
function so(e) {
  const t = (o, a = 0) => o.you ? { color: E.you.color, active: !0 } : o.blocked ? { color: E.blocked.color, active: !0 } : o.building ? { color: E.building.color, active: !0 } : o.afk ? { color: E.afk.color, active: !0 } : o.review ? { color: E.review.color, active: !0 } : a ? { color: "var(--muted)", active: !0 } : o.done ? { color: E.done.color, active: !1 } : { color: null, active: !1 }, i = [
    { id: "intake", ...t(e.intake) },
    { id: "shape", ...t(e.shape, e.fog) },
    { id: "grill", ...t(e.grill) },
    {
      id: "plan",
      ...e.specCut ? { color: E.done.color, active: !1 } : e.handover ? { color: E.you.color, active: !0 } : { color: null, active: !1 }
    },
    { id: "build", ...t(e.build) },
    {
      id: "review",
      ...e.prs.open ? { color: E.review.color, active: !0 } : e.prs.merged ? { color: E.done.color, active: !1 } : { color: null, active: !1 }
    },
    {
      id: "done",
      ...e.landed ? e.retro ? { color: E.done.color, active: !1 } : { color: E.you.color, active: !0 } : { color: null, active: !1 }
    }
  ], r = { intake: "Intake", shape: "Shape", grill: "Grill", plan: "Plan", build: "Build", review: "Review", done: "Done" }, s = [...i].reverse().find((o) => o.active), g = s ? r[s.id] : e.total || e.prs.merged ? "Done" : "—", d = e.intake.you + e.shape.you + e.grill.you + e.build.you + (e.handover ? 1 : 0) + (e.landed && !e.retro ? 1 : 0), f = e.shape.building + e.grill.building + e.build.building + e.intake.building, c = e.shape.afk + e.grill.afk + e.build.afk + e.intake.afk, p = [
    e.doneTiles ? `${e.doneTiles}/${e.total} done` : "",
    d ? `${d} HITL` : "",
    f ? `${f} in agents` : "",
    c ? `${c} ready` : "",
    e.prs.open ? `${e.prs.open} PR${e.prs.open === 1 ? "" : "s"}` : "",
    e.fog ? `${e.fog} fog` : ""
  ].filter(Boolean);
  return { segs: i, front: g, bits: p.slice(0, 4).join(" · ") };
}
function lo({ glance: e }) {
  return /* @__PURE__ */ n("span", { style: { display: "flex", gap: 2, height: 5 }, "aria-hidden": !0, children: e.segs.map((t) => /* @__PURE__ */ n("span", { title: t.id, style: {
    flex: 1,
    borderRadius: 3,
    background: t.color ?? "transparent",
    border: t.color ? "1px solid transparent" : "1px solid var(--border)",
    opacity: t.color && !t.active ? 0.75 : 1
  } }, t.id)) });
}
const Qe = ["intake", "shape", "grill", "plan", "build", "review", "done"], ao = { idea: "grill", small: "grill", huge: "shape", issue: "intake", bug: "build" }, co = { idea: "an idea", small: "small", huge: "huge", issue: "an issue", bug: "a bug" }, Jt = {
  intake: "source issues",
  shape: "map tickets",
  grill: "questions",
  plan: "spec → tickets",
  build: "tickets",
  review: "PRs",
  done: "merged · retro"
}, et = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Ye = (e, t) => ({ n: e, color: E[t].color });
function uo(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function po({ detail: e, statuses: t, activity: i, busy: r, autopilot: s, selectedKey: g, embedded: d, compact: f, onAutopilot: c, onOpenTile: p, onOpenConversation: o, onSelectConductor: a, onJumpQuestions: l, onHandover: S, onReview: G, onRetro: I, onClose: M }) {
  var ye, Re, Ee, Ne, nt;
  const [j, L] = W(!1), K = (m) => {
    var V, Y;
    return m ? (((Y = (V = e.sessionStates) == null ? void 0 : V[m]) == null ? void 0 : Y.decisions) ?? []).filter((_) => !_.answer).length : 0;
  }, Q = (((Re = ((ye = e.sessionStates) == null ? void 0 : ye.conductor) ?? e.state) == null ? void 0 : Re.decisions) ?? []).filter((m) => !m.answer).length, N = (m) => ({ label: m === 1 ? "1 question" : `${m} questions`, color: E.you.color }), O = e.frontier, x = (O == null ? void 0 : O.tiles) ?? [], R = (Ee = O == null ? void 0 : O.fogItems) != null && Ee.length ? O.fogItems : (O == null ? void 0 : O.fogLeft) ?? [], oe = !((Ne = O == null ? void 0 : O.fogItems) != null && Ne.length) && !!((nt = O == null ? void 0 : O.fogLeft) != null && nt.length), ie = new Map(Qe.map((m) => [m, []]));
  for (const m of x) ie.get(ro(m)).push(m);
  const ae = (m) => m.source ? "intake" : m.type === "build" ? "build" : m.type === "grilling" ? "grill" : "shape", X = new Map(Qe.map((m) => [m, []]));
  for (const m of x) X.get(ae(m)).push(m);
  const $ = ao[e.start] ?? "grill", B = Qe.indexOf($), C = X.get("build"), ne = e.artifacts.find((m) => m.label === "Spec" || m.label.startsWith("Spec")), b = e.prs.filter((m) => m.state === "OPEN"), w = e.prs.filter((m) => m.state === "MERGED"), F = x.filter((m) => m.state === "done").length, J = !!e.sessions.done, he = (m) => {
    var je;
    const V = m.state !== "done" ? K(m.sessionKey) : 0, Y = t[m.number], _ = Y === "attention" ? ((je = i == null ? void 0 : i[m.number]) == null ? void 0 : je.needs) ?? null : null, Be = Y === "running" || Y === "attention", fe = Y === "attention" || V > 0 || m.state === "you";
    return {
      key: `t${m.number}`,
      number: m.number,
      title: m.title,
      tile: m,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: V ? N(V) : _ === "approval" ? { label: "trust prompt", color: E.you.color } : _ === "input" ? { label: "asking", color: E.you.color } : { label: E[m.state].label, color: m.state === "done" ? E.done.text : E[m.state].color, solid: m.state === "you" || m.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Be || fe,
      attention: fe,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Be ? i == null ? void 0 : i[m.number] : void 0,
      questions: V,
      selKeys: [`build-t${m.number}`, `shape-t${m.number}`, `review-t${m.number}`]
    };
  }, H = (m) => {
    const V = (Y) => m.filter((_) => _.state === Y).length;
    return { done: V("done"), you: V("you"), afk: V("afk"), building: V("building"), review: V("review"), blocked: V("blocked") };
  }, we = (m) => {
    const V = ["you", "building", "afk", "review", "blocked", "done"];
    return [...m].sort((Y, _) => V.indexOf(Y.state) - V.indexOf(_.state) || Y.number - _.number);
  }, Pe = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, Te = (m) => {
    const V = e.sessions[m];
    if (!V || _e(V)) return [];
    const Y = K(m);
    return [{
      key: `conv-${m}`,
      title: Pe[m] ?? "Its conversation",
      chip: Y ? N(Y) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => o(m),
      questions: Y,
      selKeys: [m]
    }];
  }, xe = Qe.map((m) => {
    const V = X.get(m), Y = Te(m === "build" ? "build-spec" : m);
    if (m === "plan") {
      if (C.length || ne)
        return { id: m, state: "full", count: /* @__PURE__ */ u(ge, { children: [
          /* @__PURE__ */ n("b", { style: ve, children: "1 spec" }),
          " → ",
          C.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: E.done.color }], rows: Y };
      if (O != null && O.handover)
        return {
          id: m,
          state: "live",
          count: /* @__PURE__ */ n("b", { style: { color: E.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: E.you.color }],
          rows: Y,
          // Once the conversation exists, its row above is the way back in.
          action: Y.length ? void 0 : { label: "Write the spec", onClick: S }
        };
      const se = x.filter((ue) => ue.lane === "decide" && ue.state !== "done").length;
      return { id: m, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${se || "the"} decision${se === 1 ? "" : "s"}${R.length ? ` and ${R.length} fog` : ""}`, segments: [], rows: Y };
    }
    if (m === "review")
      return !b.length && !w.length && !Y.length ? { id: m, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: m,
        state: b.length ? "live" : "full",
        count: /* @__PURE__ */ u(ge, { children: [
          /* @__PURE__ */ u("b", { style: ve, children: [
            w.length,
            " merged"
          ] }),
          b.length ? /* @__PURE__ */ u(ge, { children: [
            " · ",
            b.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: w.length, color: E.done.color }, { n: b.length, color: E.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...Y, ...b.map((se) => {
          const ue = se.tickets[0];
          return {
            key: `pr${se.number}`,
            number: se.number,
            title: se.title,
            chip: { label: "open", color: E.review.color },
            ...ue != null ? { onOpen: () => o(`review-t${ue}`), selKeys: [`review-t${ue}`] } : { url: se.url }
          };
        })],
        action: b.length && !Y.length ? { label: "Review the PRs", onClick: G } : void 0
      };
    if (m === "done") {
      const se = !!(O != null && O.landed), ue = se && J && e.kind !== "map";
      return {
        id: m,
        state: F ? se ? "live" : "full" : "queued",
        count: F ? /* @__PURE__ */ u(ge, { children: [
          /* @__PURE__ */ u("b", { style: ve, children: [
            F,
            " of ",
            x.length
          ] }),
          " · ",
          J ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: F ? void 0 : "closes when the retro runs",
        segments: [{ n: F, color: E.done.color }, { n: Math.max(0, x.length - F), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...Y, ...x.filter((Ce) => Ce.state === "done").sort((Ce, lt) => Ce.number - lt.number).map(he)],
        action: se && !J ? { label: "Run /retro", onClick: I } : ue ? j ? { label: "Close the effort and its issue?", onClick: () => {
          L(!1), M();
        }, confirm: () => L(!1) } : { label: "Close effort", onClick: () => L(!0) } : void 0
      };
    }
    if (!V.length && !(m === "shape" && R.length) && !Y.length)
      return Qe.indexOf(m) < B ? { id: m, state: "skipped", count: `entered at ${et[$]}`, segments: [], rows: [] } : m === "build" ? { id: m, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: m, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const _ = H(V), Be = _.you + _.afk + _.building + _.review + _.blocked > 0 || !V.length && Y.length > 0, fe = [];
    m === "grill" ? (_.done && fe.push(`${_.done} answered`), _.you && fe.push(`${_.you} waiting`)) : (_.done && fe.push(`${_.done} done`), _.you && fe.push(`${_.you} HITL`)), _.building && fe.push(`${_.building} in agents`), _.afk && fe.push(`${_.afk} ready`), _.review && fe.push(`${_.review} in review`), _.blocked && fe.push(`${_.blocked} blocked`);
    const je = [Ye(_.done, "done"), Ye(_.building, "building"), Ye(_.review, "review"), Ye(_.you, "you"), Ye(_.afk, "afk"), Ye(_.blocked, "blocked")];
    m === "shape" && R.length && je.push({ n: R.length, color: "transparent", dashed: !0 });
    const qe = [...Y, ...we(V.filter((se) => se.state !== "done")).map(he)];
    return m === "shape" && R.forEach((se, ue) => qe.push({
      key: `fog${ue}`,
      title: fo(se),
      chip: oe ? { label: "left unspecified", color: E.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: m,
      state: Be ? "live" : "full",
      count: /* @__PURE__ */ u(ge, { children: [
        fe.map((se, ue) => ue === 0 ? /* @__PURE__ */ n("b", { style: ve, children: se }, se) : /* @__PURE__ */ u("span", { children: [
          " · ",
          se
        ] }, se)),
        m === "shape" && R.length ? /* @__PURE__ */ u("span", { children: [
          " · ",
          R.length,
          " fog"
        ] }) : null
      ] }),
      segments: je,
      rows: qe
    };
  }), We = (m) => m.state === "live", De = xe.reduce((m, V, Y) => We(V) ? Y : m, -1), Le = De >= 0 ? xe[De] : null, $e = H(x), Oe = x.length, v = [
    { n: $e.building, label: "in agents", color: E.building.color },
    { n: $e.review, label: "in review", color: E.review.color },
    { n: $e.you, label: "HITL", color: E.you.color },
    { n: $e.afk, label: "ready", color: E.afk.color },
    { n: $e.blocked, label: "blocked", color: E.blocked.color },
    { n: R.length, label: "fog", color: "var(--muted)" }
  ].filter((m) => m.n > 0), [te, me] = W(() => new Set(Le ? [Le.id] : [])), ce = (m) => me((V) => {
    const Y = new Set(V);
    return Y.has(m) ? Y.delete(m) : Y.add(m), Y;
  }), Me = Q + xe.reduce((m, V) => m + V.rows.reduce((Y, _) => Y + (_.questions ?? 0), 0), 0), ze = Object.values(i ?? {}).filter((m) => m && (m.needs === "approval" || m.needs === "input")).length, He = g === "conductor", de = !!e.sessions.conductor && !_e(e.sessions.conductor), Ie = f ? 10 : 16;
  return /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, ...d ? {} : { height: "100%" } }, children: [
    /* @__PURE__ */ u("div", { style: { padding: `10px ${Ie}px 9px`, borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ u("span", { style: { ...q, fontSize: y.tiny, flex: 1 }, children: [
          "entered at ",
          et[$],
          " (",
          co[e.start] ?? e.start,
          ")"
        ] }),
        !d && /* @__PURE__ */ n("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: y.tiny, whiteSpace: "nowrap" }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ n("div", { style: { fontSize: y.small, marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }, children: Oe > 0 ? /* @__PURE__ */ u(ge, { children: [
        /* @__PURE__ */ u("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ u("b", { style: { color: E.done.text }, children: [
            $e.done,
            " of ",
            Oe
          ] }),
          " ",
          /* @__PURE__ */ n("span", { style: q, children: "done" })
        ] }),
        v.map((m) => /* @__PURE__ */ u("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ n("b", { style: { color: m.color }, children: m.n }),
          " ",
          /* @__PURE__ */ n("span", { style: q, children: m.label })
        ] }, m.label))
      ] }) : /* @__PURE__ */ n("span", { style: q, children: R.length ? `${R.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
      (Me > 0 || ze > 0) && /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          onClick: l,
          className: ze > 0 ? "kipo-pulse" : void 0,
          title: ze > 0 ? "A session is stopped on a trust prompt or an ask: open it to allow or answer" : "Jump to the next conversation with open questions; answer them on the right",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 6,
            padding: "2px 9px",
            borderRadius: 99,
            background: E.you.color,
            color: "#14121c",
            fontSize: y.tiny,
            fontWeight: 700,
            cursor: "pointer",
            border: 0
          },
          children: [
            uo(Me, ze),
            " →"
          ]
        }
      ),
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          "aria-pressed": s,
          onClick: () => c(!s),
          title: "When a ticket closes and frees the next Deliver ticket an agent can take, KiPo starts it. Runs while this effort is open in KiPo.",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            padding: 0,
            marginTop: 5,
            cursor: "pointer",
            fontSize: y.tiny,
            color: s ? E.afk.text : "var(--muted)"
          },
          children: [
            /* @__PURE__ */ n(
              "span",
              {
                "aria-hidden": !0,
                className: s ? "kipo-pulse" : void 0,
                style: { width: 7, height: 7, borderRadius: 999, background: s ? E.afk.color : "var(--muted)" }
              }
            ),
            "Autopilot ",
            s ? "on" : "off",
            ": freed agent tickets ",
            s ? "start on their own" : "wait for you"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { style: d ? void 0 : { flex: 1, minHeight: 0, overflowY: "auto" }, children: [
      /* @__PURE__ */ n("div", { style: { padding: `9px ${Ie}px`, borderBottom: "1px solid var(--border)" }, children: /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          onClick: a,
          title: "The conductor runs this effort: it watches the frontier, dispatches conversations and asks you in one batch. This is where you talk.",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            textAlign: "left",
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: y.small,
            fontWeight: 700,
            border: "1px solid var(--accent)",
            background: He ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: He ? "var(--accent-fg, #fff)" : "var(--accent)"
          },
          children: [
            /* @__PURE__ */ n(rn, { size: 14, "aria-hidden": !0, style: { flexShrink: 0 } }),
            /* @__PURE__ */ n("span", { style: { flex: 1 }, children: "Conductor" }),
            Q > 0 ? /* @__PURE__ */ n("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${He ? "var(--accent-fg, #fff)" : E.you.color}`,
              color: He ? "var(--accent-fg, #fff)" : E.you.color
            }, children: Q === 1 ? "1 question" : `${Q} questions` }) : /* @__PURE__ */ n("span", { style: { fontSize: y.tiny, fontWeight: 400, opacity: 0.75 }, children: de ? "conversation" : "not started" })
          ]
        }
      ) }),
      xe.map((m) => /* @__PURE__ */ n(
        ho,
        {
          s: m,
          busy: r,
          open: te.has(m.id),
          selectedKey: g,
          compact: f,
          onToggle: () => ce(m.id),
          onOpenTile: p
        },
        m.id
      )),
      /* @__PURE__ */ u("div", { style: { display: "flex", gap: 12, alignItems: "center", padding: `9px ${Ie}px`, fontSize: y.tiny, color: "var(--muted)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ n(Xe, { color: E.done.color, label: "done" }),
        /* @__PURE__ */ n(Xe, { color: E.building.color, label: "in agents" }),
        /* @__PURE__ */ n(Xe, { color: E.you.color, label: "HITL" }),
        /* @__PURE__ */ n(Xe, { color: E.afk.color, label: "ready" }),
        /* @__PURE__ */ n(Xe, { color: E.blocked.color, label: "blocked" })
      ] })
    ] })
  ] });
}
function Xe({ color: e, label: t }) {
  return /* @__PURE__ */ u("span", { children: [
    /* @__PURE__ */ n("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, background: e, marginRight: 4, verticalAlign: -1 } }),
    t
  ] });
}
function ho({ s: e, open: t, busy: i, selectedKey: r, compact: s, onToggle: g, onOpenTile: d }) {
  const f = e.state === "skipped" || e.state === "queued", c = e.rows.length > 0 || !!e.action, p = io.find((l) => l.id === e.id), o = e.segments.reduce((l, S) => l + S.n, 0), a = e.rows.reduce((l, S) => l + (S.questions ?? 0), 0);
  return /* @__PURE__ */ u("div", { style: {
    borderBottom: "1px solid var(--border)",
    background: t ? "var(--bg-elevated)" : void 0,
    borderLeft: t ? `2px solid ${E.you.color}` : "2px solid transparent"
  }, children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        onClick: c ? g : void 0,
        "aria-expanded": c ? t : void 0,
        title: p ? `${et[e.id]} · ${p.skill}
${p.what}` : void 0,
        style: {
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: s ? "8px 10px 9px 6px" : "8px 16px 9px 10px",
          background: "transparent",
          color: "var(--text)",
          cursor: c ? "pointer" : "default",
          opacity: f ? 0.55 : 1
        },
        children: [
          /* @__PURE__ */ u("span", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
            /* @__PURE__ */ n(pt, { size: 12, "aria-hidden": !0, style: {
              flexShrink: 0,
              alignSelf: "center",
              color: "var(--muted)",
              transform: t ? "rotate(90deg)" : void 0,
              transition: "transform .12s",
              visibility: c ? "visible" : "hidden"
            } }),
            /* @__PURE__ */ n(
              "span",
              {
                style: { width: s ? 48 : 56, flexShrink: 0, fontSize: y.small, fontWeight: 700, color: f ? "var(--muted)" : "var(--text-strong, var(--text))" },
                title: s ? Jt[e.id] : void 0,
                children: et[e.id]
              }
            ),
            !s && /* @__PURE__ */ n("span", { style: { width: 92, flexShrink: 0, fontSize: 10, color: "var(--muted)" }, children: Jt[e.id] }),
            /* @__PURE__ */ u("span", { style: { flex: 1, textAlign: "right", fontSize: y.small, minWidth: 0 }, children: [
              a > 0 && /* @__PURE__ */ n("span", { style: {
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: ".03em",
                textTransform: "uppercase",
                padding: "1px 6px",
                borderRadius: 99,
                border: `1px solid ${E.you.color}`,
                color: E.you.color,
                whiteSpace: "nowrap",
                marginRight: 6
              }, children: a === 1 ? "1 question" : `${a} questions` }),
              e.count
            ] })
          ] }),
          o > 0 && /* @__PURE__ */ n("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((l) => l.n > 0).map((l, S) => /* @__PURE__ */ n("span", { style: { flex: l.n, background: l.color, ...l.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, S)) }),
          e.ghost && /* @__PURE__ */ n("span", { style: { display: "block", fontSize: y.tiny, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }, children: e.ghost })
        ]
      }
    ),
    t && c && /* @__PURE__ */ u("div", { style: { margin: s ? "0 10px 10px 8px" : "0 16px 10px 14px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }, children: [
      e.action && /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: e.rows.length ? "1px solid var(--border)" : void 0 }, children: [
        /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.tiny, flex: 1 }, children: e.action.confirm ? "" : `${et[e.id]}'s next step` }),
        /* @__PURE__ */ n(Lt, { primary: !0, disabled: i, onClick: e.action.onClick, children: e.action.label }),
        e.action.confirm && /* @__PURE__ */ n(Lt, { disabled: i, onClick: e.action.confirm, children: "Cancel" })
      ] }),
      e.rows.map((l) => {
        var M;
        const S = () => {
          l.onOpen ? l.onOpen() : l.tile ? d(l.tile) : l.url && window.open(l.url, "_blank", "noreferrer");
        }, G = !!l.onOpen || !!l.tile || !!l.url, I = !!r && !!((M = l.selKeys) != null && M.includes(r));
        return /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            onClick: G ? S : void 0,
            disabled: !G,
            title: l.tile ? `#${l.number} ${l.title}
${Fe[l.tile.state]}
Click to open its session` : l.onOpen ? `${l.title}
Click to open this conversation` : l.title,
            style: {
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 10px",
              borderTop: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: y.small,
              background: I ? "var(--bg-elevated)" : "transparent",
              boxShadow: I ? "inset 2px 0 0 var(--accent)" : void 0,
              cursor: G ? "pointer" : "default"
            },
            onMouseEnter: (j) => {
              G && !I && (j.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (j) => {
              j.currentTarget.style.background = I ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ u("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: l.number != null ? `#${l.number}` : l.onOpen ? /* @__PURE__ */ n(rn, { size: 11, "aria-hidden": !0 }) : "☁" }),
                /* @__PURE__ */ n("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: l.title }),
                l.pulse && /* @__PURE__ */ n("span", { className: "kipo-pulse", style: {
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: l.attention ? E.you.color : E.building.color,
                  flexShrink: 0
                } }),
                /* @__PURE__ */ n(
                  "span",
                  {
                    className: l.attention ? "kipo-pulse" : void 0,
                    style: {
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".03em",
                      textTransform: "uppercase",
                      padding: "1px 6px",
                      borderRadius: 99,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      color: l.chip.solid ? "#14121c" : l.chip.color,
                      background: l.chip.solid ? l.chip.color : "transparent",
                      border: l.chip.solid ? "1px solid transparent" : `1px solid ${l.chip.color}`
                    },
                    children: l.chip.label
                  }
                )
              ] }),
              l.live && /* @__PURE__ */ u(
                "span",
                {
                  title: l.live.line ?? void 0,
                  style: {
                    display: "block",
                    marginTop: 3,
                    paddingLeft: 50,
                    fontSize: y.tiny,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  },
                  children: [
                    /* @__PURE__ */ n("span", { style: { color: E.building.color }, children: go(l.live.at) }),
                    l.live.line ? /* @__PURE__ */ u(ge, { children: [
                      " · ",
                      l.live.line
                    ] }) : null
                  ]
                }
              )
            ]
          },
          l.key
        );
      })
    ] })
  ] });
}
const fo = (e) => e.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
function go(e) {
  const t = e ? Date.parse(e) : NaN;
  if (Number.isNaN(t)) return "running";
  const i = Math.round((Date.now() - t) / 6e4);
  return i < 1 ? "just now" : i < 60 ? `${i}m` : `${Math.round(i / 60)}h`;
}
const mn = "kipo.rail.repoOpen", mo = () => {
  try {
    return JSON.parse(localStorage.getItem(mn) || "{}");
  } catch {
    return {};
  }
};
function yo({ stage: e }) {
  return /* @__PURE__ */ n("span", { style: {
    flexShrink: 0,
    fontSize: 10,
    lineHeight: "15px",
    padding: "0 6px",
    borderRadius: 999,
    border: "1px solid var(--accent)",
    color: "var(--accent)",
    whiteSpace: "nowrap"
  }, children: Kn[e] });
}
function bo({ width: e, items: t, repos: i, error: r, notice: s, selected: g, spineSlot: d, onNew: f, onAddRepo: c, onRemoveRepo: p, onRestore: o, onSelect: a, onHide: l, onRemove: S, onCollapse: G }) {
  const [I, M] = W(""), [j, L] = W(null), [K, Q] = W(!0);
  U(() => {
    Q(!0);
  }, [g]);
  const [N, O] = W(null), x = Ae(() => O(null), []), [R, oe] = W(null), [ie, ae] = W(mo);
  U(() => {
    localStorage.setItem(mn, JSON.stringify(ie));
  }, [ie]);
  const X = (C) => ie[C] !== !1, $ = I.trim().toLowerCase(), B = nn(() => {
    const C = /* @__PURE__ */ new Map();
    for (const b of t ?? []) {
      const w = C.get(b.repo) ?? [];
      w.push(b), C.set(b.repo, w);
    }
    const ne = (i ?? []).map((b) => b.slug);
    for (const b of C.keys()) ne.includes(b) || ne.push(b);
    return ne.map((b) => {
      const w = (i ?? []).find((H) => H.slug === b) ?? { slug: b, path: "", hidden: [] }, F = C.get(b) ?? [], J = !$ || b.toLowerCase().includes($), he = J ? F : F.filter((H) => H.title.toLowerCase().includes($));
      return { meta: w, rows: he, show: !$ || J || he.length > 0 };
    }).filter((b) => b.show);
  }, [t, i, $]);
  return /* @__PURE__ */ u(
    "nav",
    {
      "aria-label": "Efforts",
      style: {
        width: e,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--bg)",
        color: "var(--text)"
      },
      children: [
        /* @__PURE__ */ u("div", { style: { padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 8 }, children: [
          /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }, children: [
            /* @__PURE__ */ n(Se, { primary: !0, onClick: f, children: /* @__PURE__ */ u("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ n(Mn, { size: 14 }),
              "New effort"
            ] }) }),
            /* @__PURE__ */ n("span", { title: "Add a repo: it joins this sidebar with all its maps and efforts under it", children: /* @__PURE__ */ n(Se, { onClick: c, children: /* @__PURE__ */ u("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ n(Hn, { size: 14 }),
              "Add repo"
            ] }) }) })
          ] }),
          /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ n(
              "input",
              {
                value: I,
                onChange: (C) => M(C.target.value),
                placeholder: "Filter efforts",
                "aria-label": "Filter efforts",
                style: { ...it, fontSize: y.small, padding: "4px 8px", flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ n(
              "button",
              {
                type: "button",
                onClick: G,
                title: "Fold the effort list away",
                "aria-label": "Fold the effort list away",
                style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: 14, flexShrink: 0 },
                children: "«"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 6px 8px" }, children: [
          r && /* @__PURE__ */ n("div", { style: { color: "var(--danger-text)", fontSize: y.small, padding: "4px 6px" }, children: r }),
          !r && s && /* @__PURE__ */ n("div", { style: { color: "#f5b14c", fontSize: y.tiny, padding: "4px 6px", lineHeight: 1.4 }, children: s }),
          t === null && !r && /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small, padding: "4px 6px" }, children: "Loading…" }),
          t !== null && !B.length && /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small, padding: "4px 6px" }, children: $ ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          B.map((C) => {
            const ne = X(C.meta.slug) || !!$, b = C.meta.slug.split("/").pop() ?? C.meta.slug;
            return /* @__PURE__ */ u("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ u(
                "div",
                {
                  onContextMenu: (w) => {
                    w.preventDefault(), oe({ slug: C.meta.slug, x: w.clientX, y: w.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => L(`repo:${C.meta.slug}`),
                  onPointerLeave: () => L((w) => w === `repo:${C.meta.slug}` ? null : w),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 6,
                    padding: "3px 4px",
                    background: j === `repo:${C.meta.slug}` ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ u(
                      "button",
                      {
                        type: "button",
                        onClick: () => ae((w) => ({ ...w, [C.meta.slug]: !ne })),
                        "aria-expanded": ne,
                        title: C.meta.path || C.meta.slug,
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          flex: 1,
                          minWidth: 0,
                          background: "transparent",
                          color: "var(--text)",
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left"
                        },
                        children: [
                          /* @__PURE__ */ n(pt, { size: 11, "aria-hidden": !0, style: {
                            flexShrink: 0,
                            color: "var(--muted)",
                            transition: "transform .12s",
                            transform: ne ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ n(on, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ n("span", { style: { fontSize: y.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: b }),
                          /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.tiny, flexShrink: 0 }, children: C.rows.length || (ne ? "" : "0") })
                        ]
                      }
                    ),
                    (j === `repo:${C.meta.slug}` || (R == null ? void 0 : R.slug) === C.meta.slug) && /* @__PURE__ */ n(
                      "button",
                      {
                        type: "button",
                        "aria-label": `More for ${C.meta.slug}`,
                        "aria-haspopup": "menu",
                        title: "More",
                        onClick: (w) => {
                          w.stopPropagation();
                          const F = w.currentTarget.getBoundingClientRect();
                          oe({ slug: C.meta.slug, x: F.left, y: F.bottom + 2, confirm: !1 });
                        },
                        style: {
                          width: 22,
                          height: 18,
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          color: "var(--muted)",
                          cursor: "pointer",
                          padding: 0,
                          flexShrink: 0
                        },
                        children: /* @__PURE__ */ n(Ht, { size: 13 })
                      }
                    )
                  ]
                }
              ),
              ne && !C.rows.length && /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              ne && C.rows.length > 0 && /* @__PURE__ */ n("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: C.rows.map((w) => {
                const F = `${w.repo}#${w.number}`, J = F === g, he = J && !!d && K;
                return /* @__PURE__ */ u(
                  "div",
                  {
                    style: {
                      position: "relative",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "var(--bg)",
                      // The open map glows; the rest sit as quiet cards.
                      border: `1px solid ${J ? "var(--accent)" : "var(--border)"}`,
                      boxShadow: J ? "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)" : void 0
                    },
                    onContextMenu: (H) => {
                      H.preventDefault(), O({ key: F, item: w, x: H.clientX, y: H.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => L(F),
                    onPointerLeave: () => L((H) => H === F ? null : H),
                    children: [
                      /* @__PURE__ */ u(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            J ? Q((H) => !H) : a(w);
                          },
                          "aria-current": J ? "page" : void 0,
                          "aria-expanded": J && d ? K : void 0,
                          title: J ? K ? "Fold this effort's stations away" : "Show this effort's stations" : void 0,
                          style: {
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 8px",
                            cursor: "pointer",
                            background: J ? "var(--bg-elevated)" : "transparent",
                            color: "var(--text)"
                          },
                          children: [
                            /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                              /* @__PURE__ */ n(pt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: he ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ u("span", { style: { ...J ? ve : {}, flex: 1, minWidth: 0, fontSize: y.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ u("span", { style: { ...q, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  w.number
                                ] }),
                                " ",
                                w.title
                              ] })
                            ] }),
                            (() => {
                              var we;
                              if (he)
                                return /* @__PURE__ */ u("div", { style: { ...q, fontSize: y.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ n(gt, { kind: w.kind, map: w.mapIssue }),
                                  /* @__PURE__ */ n("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: w.repo.split("/").pop() }),
                                  /* @__PURE__ */ n("span", { style: { flexShrink: 0 }, children: Bt(w.updatedAt) })
                                ] });
                              const H = (we = w.frontier) != null && we.stations ? so(w.frontier.stations) : null;
                              return /* @__PURE__ */ u(ge, { children: [
                                H && /* @__PURE__ */ n("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ n(lo, { glance: H }) }),
                                /* @__PURE__ */ u("div", { style: { ...q, fontSize: y.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ n(gt, { kind: w.kind, map: w.mapIssue }),
                                  !H && /* @__PURE__ */ n(yo, { stage: w.stage ?? Fn(w.column) }),
                                  /* @__PURE__ */ n(
                                    "span",
                                    {
                                      title: H ? `${H.bits || H.front}

${mt.HITL}
${mt.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: H ? H.bits || H.front : w.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ n("span", { style: { flexShrink: 0 }, children: Bt(w.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (j === F || J || (N == null ? void 0 : N.key) === F) && /* @__PURE__ */ n(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${w.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: (H) => {
                            H.stopPropagation();
                            const we = H.currentTarget.getBoundingClientRect();
                            O({ key: F, item: w, x: we.left, y: we.bottom + 2, confirm: !1 });
                          },
                          onMouseEnter: (H) => {
                            H.currentTarget.style.background = "rgba(255,255,255,0.1)";
                          },
                          onMouseLeave: (H) => {
                            H.currentTarget.style.background = "transparent";
                          },
                          style: {
                            position: "absolute",
                            top: 5,
                            right: 5,
                            width: 22,
                            height: 20,
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "transparent",
                            color: "var(--text-muted, var(--muted))",
                            cursor: "pointer",
                            padding: 0
                          },
                          children: /* @__PURE__ */ n(Ht, { size: 14 })
                        }
                      ),
                      he && /* @__PURE__ */ n("div", { ref: d, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  F
                );
              }) }),
              ne && C.meta.hidden.length > 0 && /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  onClick: () => o(C.meta.slug, C.meta.hidden),
                  title: `Removed from the sidebar: #${C.meta.hidden.join(", #")}. Click to restore them.`,
                  style: {
                    ...q,
                    fontSize: y.tiny,
                    background: "transparent",
                    cursor: "pointer",
                    padding: "3px 6px 2px 24px",
                    textAlign: "left"
                  },
                  children: [
                    C.meta.hidden.length,
                    " removed · restore"
                  ]
                }
              )
            ] }, C.meta.slug);
          })
        ] }),
        N && !N.confirm && /* @__PURE__ */ n(Gt, { x: N.x, y: N.y, onClose: x, items: [
          { label: "Open on GitHub", icon: Pt, onSelect: () => window.open(N.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: Pn, danger: !0, onSelect: () => O({ ...N, confirm: "hide" }) },
          ...N.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: Dt, danger: !0, onSelect: () => O({ ...N, confirm: "remove" }) }
          ]
        ] }),
        (N == null ? void 0 : N.confirm) === "hide" && /* @__PURE__ */ n(
          ct,
          {
            x: N.x,
            y: N.y,
            onClose: x,
            action: "Remove",
            title: `Remove "${N.item.title}" from the sidebar?`,
            onConfirm: () => l(N.item),
            children: N.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (N == null ? void 0 : N.confirm) === "remove" && /* @__PURE__ */ n(
          ct,
          {
            x: N.x,
            y: N.y,
            onClose: x,
            action: "Close it",
            title: `Close "${N.item.title}" as not planned?`,
            onConfirm: () => S(N.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        R && !R.confirm && /* @__PURE__ */ n(Gt, { x: R.x, y: R.y, onClose: () => oe(null), items: [
          { label: "Open on GitHub", icon: Pt, onSelect: () => window.open(`https://github.com/${R.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: Dt, danger: !0, onSelect: () => oe({ ...R, confirm: !0 }) }
        ] }),
        (R == null ? void 0 : R.confirm) && /* @__PURE__ */ n(
          ct,
          {
            x: R.x,
            y: R.y,
            onClose: () => oe(null),
            action: "Remove",
            title: `Remove ${R.slug} from KiPo?`,
            onConfirm: () => p(R.slug),
            children: "Its efforts and maps leave the sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back."
          }
        )
      ]
    }
  );
}
function vo({ items: e, selected: t, onNew: i, onSelect: r, onExpand: s }) {
  const g = (f) => {
    var p;
    const c = (p = f.frontier) == null ? void 0 : p.counts;
    return c ? c.you ? "#f5b14c" : c.afk ? "#2dd4bf" : c.building || c.review ? "#60a5fa" : c.done ? "#3fae6a" : "var(--muted)" : "var(--muted)";
  }, d = { width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return /* @__PURE__ */ u("nav", { "aria-label": "Efforts", style: { width: 44, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", borderRight: "1px solid var(--border)", background: "var(--bg)", minHeight: 0 }, children: [
    /* @__PURE__ */ n(
      "button",
      {
        type: "button",
        onClick: s,
        title: "Show the effort list",
        "aria-label": "Show the effort list",
        style: { ...d, background: "transparent", color: "var(--muted)", fontSize: 14 },
        children: "»"
      }
    ),
    /* @__PURE__ */ n(
      "button",
      {
        type: "button",
        onClick: i,
        title: "New effort",
        "aria-label": "New effort",
        style: { ...d, background: "var(--accent)", color: "var(--accent-fg, #fff)", fontWeight: 700, fontSize: 16, borderRadius: 999 },
        children: "+"
      }
    ),
    /* @__PURE__ */ n("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 6, scrollbarWidth: "none" }, children: (e ?? []).map((f) => {
      const c = `${f.repo}#${f.number}`, p = c === t;
      return /* @__PURE__ */ n(
        "button",
        {
          type: "button",
          onClick: () => r(f),
          title: `${f.title} (${f.repo.split("/").pop()})`,
          "aria-current": p ? "page" : void 0,
          style: { ...d, background: p ? "var(--bg-elevated)" : "transparent", border: p ? "1px solid var(--border)" : "1px solid transparent", flexShrink: 0 },
          children: /* @__PURE__ */ n("span", { style: { width: 10, height: 10, borderRadius: 3, background: g(f) } })
        },
        c
      );
    }) })
  ] });
}
const Yt = [
  { id: "idea", title: "An idea", hint: "Grill it, spec and ticket it, build it.", begins: "a grilling: an interview that sharpens the idea. Then the spec and tickets, then the build." },
  { id: "small", title: "A small change", hint: "Grill briefly, then build in the same session.", begins: "a short grilling, then the build in the same conversation. No spec or tickets." },
  { id: "huge", title: "A huge effort", hint: "Too many unknowns: map the decisions first.", begins: "a wayfinder map. Its decision tickets fill the Decide lane." },
  { id: "issue", title: "An incoming issue", hint: "Triage it until an agent can pick it up.", begins: "triaging the issue. Once an agent can take it, it moves to the Deliver lane." },
  { id: "bug", title: "A hard bug", hint: "Diagnose it with a tight loop, then fix it.", begins: "a diagnosis: a command that goes red on the bug, then the fix." }
], ot = (e) => /* @__PURE__ */ n("span", { style: { ...ve, fontSize: y.body, display: "block", marginBottom: 6 }, children: e }), wo = (e) => {
  const t = e.trim().match(/(?:issues\/|#)?(\d+)\s*$/);
  return t ? Number(t[1]) : null;
};
function ko({ onStarted: e, onCancel: t }) {
  const [i, r] = W(""), [s, g] = W(null), [d, f] = W(""), [c, p] = W(!1), [o, a] = W(!1), [l, S] = W("idea"), [G, I] = W(""), [M, j] = W(!1), [L, K] = W("");
  U(() => {
    le.discoverRepos().then((x) => g(
      x.repos.filter((R) => R.slug && !R.worktree).sort((R, oe) => Number(oe.configured) - Number(R.configured) || R.name.localeCompare(oe.name))
    )).catch((x) => {
      K(be(x)), g([]);
    });
  }, []);
  const Q = (x) => {
    p(!1), f(x), s && !s.some((R) => R.path === x) && g([...s, { path: x, name: x.split("/").pop() || x, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, N = async () => {
    const x = l === "issue" && G.trim() ? wo(G) : null;
    if (l === "issue" && G.trim() && x == null) {
      K("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !x) {
      K("Say what you want to do first.");
      return;
    }
    if (!d) {
      K("Choose which project this is for.");
      return;
    }
    j(!0), K("");
    try {
      e(await le.startInitiative({
        path: d,
        description: i.trim() || `Issue #${x}`,
        start: l,
        worktree: o,
        sourceIssue: x
      }));
    } catch (R) {
      K(be(R)), j(!1);
    }
  }, O = Yt.find((x) => x.id === l);
  return /* @__PURE__ */ u("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ u("div", { children: [
      /* @__PURE__ */ n("div", { style: { ...ve, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ n(Ke, { children: L }),
    /* @__PURE__ */ u("label", { children: [
      ot("What do you want to do?"),
      /* @__PURE__ */ n(
        "textarea",
        {
          value: i,
          onChange: (x) => r(x.target.value),
          rows: 3,
          autoFocus: !0,
          placeholder: "e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share",
          style: { ...it, resize: "vertical", lineHeight: 1.45 }
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { children: [
      ot("Which project is this for?"),
      /* @__PURE__ */ u(
        "select",
        {
          value: d,
          onChange: (x) => x.target.value === "__pick" ? p(!0) : f(x.target.value),
          style: it,
          disabled: s === null,
          children: [
            /* @__PURE__ */ n("option", { value: "", children: s === null ? "Looking for your projects…" : "Choose a project…" }),
            s == null ? void 0 : s.map((x) => /* @__PURE__ */ n("option", { value: x.path, children: x.slug ?? x.name }, x.path)),
            /* @__PURE__ */ n("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      d && /* @__PURE__ */ u("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ n("div", { children: /* @__PURE__ */ n(sn, { path: d }) }),
        /* @__PURE__ */ u("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: y.body }, children: [
          /* @__PURE__ */ n("input", { type: "checkbox", checked: o, onChange: (x) => a(x.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ u("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ n("span", { style: q, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      c && /* @__PURE__ */ n("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ n(ln, { busy: null, onAdd: Q, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ u("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ n("legend", { style: { padding: 0 }, children: ot("Where does this start?") }),
      /* @__PURE__ */ n("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: Yt.map((x) => {
        const R = l === x.id;
        return /* @__PURE__ */ u(
          "label",
          {
            style: {
              display: "block",
              padding: "8px 10px 9px",
              cursor: "pointer",
              borderRadius: 8,
              border: `1px solid ${R ? "var(--accent)" : "var(--border)"}`,
              background: R ? "var(--accent-subtle, var(--bg-elevated))" : "var(--card, var(--bg))",
              color: "var(--text)"
            },
            children: [
              /* @__PURE__ */ n(
                "input",
                {
                  type: "radio",
                  name: "start",
                  checked: R,
                  onChange: () => S(x.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ n("div", { style: { ...ve, fontSize: y.body }, children: x.title }),
              /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small, marginTop: 3, lineHeight: 1.4 }, children: x.hint })
            ]
          },
          x.id
        );
      }) }),
      /* @__PURE__ */ u("div", { style: { ...q, fontSize: y.small, marginTop: 8 }, children: [
        "Starts with ",
        O.begins
      ] })
    ] }),
    l === "issue" && /* @__PURE__ */ u("label", { children: [
      ot("Which issue? (optional)"),
      /* @__PURE__ */ n(
        "input",
        {
          value: G,
          onChange: (x) => I(x.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: it
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ n(Se, { primary: !0, disabled: M, onClick: N, children: M ? "Starting…" : "Start the conversation" }),
      t && /* @__PURE__ */ n(Se, { onClick: t, children: "Never mind" })
    ] }),
    /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small, lineHeight: 1.5 }, children: "Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo." })
  ] });
}
const Ut = 6, Ge = (e, t) => (e.blockers ?? e.blockedBy).filter((i) => t.has(i) && i !== e.number);
function xo(e, t) {
  const i = new Map(e.map((l) => [l.number, l])), r = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), g = (l) => {
    if (r.has(l.number)) return r.get(l.number);
    if (s.has(l.number)) return 0;
    s.add(l.number);
    const S = Ge(l, i), G = S.length ? 1 + Math.max(...S.map((I) => g(i.get(I)))) : 0;
    return s.delete(l.number), r.set(l.number, G), G;
  };
  e.forEach(g);
  const d = e.length ? Math.max(...e.map((l) => r.get(l.number))) + 1 : 0, f = t ? [e.filter((l) => l.lane === "decide"), e.filter((l) => l.lane !== "decide")] : [e], c = /* @__PURE__ */ new Map(), p = [];
  let o = 0, a = null;
  return f.forEach((l, S) => {
    if (!l.length) return;
    t && S === 1 && o > 0 && (a = o, o += 0.6);
    let G = 0;
    const I = [];
    for (let M = 0; M < d; M++) {
      const j = l.filter((K) => r.get(K.number) === M), L = (K) => {
        const Q = Ge(K, i).map((N) => c.get(N)).filter((N) => N !== void 0);
        return Q.length ? Q.reduce((N, O) => N + O, 0) / Q.length : K.number / 1e3;
      };
      j.sort((K, Q) => L(K) - L(Q) || K.number - Q.number), j.forEach((K, Q) => c.set(K.number, o + Q)), I.push(j), G = Math.max(G, j.length);
    }
    I.forEach((M, j) => {
      const L = (G - M.length) / 2;
      M.forEach((K, Q) => {
        const N = o + Q + L;
        c.set(K.number, N), p.push({ tile: K, col: j, row: N });
      });
    }), o += G;
  }), { placed: p, cols: d, rows: o, split: a };
}
function So({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: s, labeled: g, bands: d, highlight: f, dimOthers: c = !0, down: p }) {
  const o = pe(null), [a, l] = W(0), [S, G] = W(null);
  if (U(() => {
    const v = o.current;
    if (!v) return;
    const te = new ResizeObserver(() => l(v.clientWidth));
    return te.observe(v), l(v.clientWidth), () => te.disconnect();
  }, []), !e.length) return null;
  const I = new Map(e.map((v) => [v.number, v])), M = /* @__PURE__ */ new Set();
  for (const v of e) for (const te of Ge(v, I))
    M.add(te), M.add(v.number);
  const j = e.length > 1 ? e.filter((v) => !M.has(v.number)) : [], L = j.length ? e.filter((v) => M.has(v.number)) : e, { placed: K, cols: Q, rows: N, split: O } = xo(L, !!d), x = 30, R = !!p && !d, oe = d ? 52 : 0, ie = R ? 12 : d ? 64 : g ? 40 : 48, ae = i > 0 && !R ? Math.min(i, 4) : 0, X = ae ? ie + x : 0, $ = R ? Math.max(1, N) : Q, B = a && $ ? Math.floor((a - 2 - 2 * Ut - oe - X - ($ - 1) * ie) / $) : 168, C = g ? Math.max(R ? 120 : 110, Math.min(d ? 240 : R ? 260 : 200, B)) : x, ne = x + 6, b = R ? 30 : g ? 10 : 8, w = L.length ? Q : 0, F = R ? (L.length ? $ * (C + ie) - ie : 0) + 2 : oe + (w ? w * (C + ie) - ie : 0) + X + 2, J = O ?? N, he = R ? w : Math.max(N, ae), H = (v) => 1 + v * (ne + b), we = L.length || ae ? H(he) - b + 1 : 0, Pe = new Map(K.map((v) => [v.tile.number, R ? { x: 1 + v.row * (C + ie), y: H(v.col) } : { x: oe + 1 + v.col * (C + ie), y: H(v.row) }])), Te = /* @__PURE__ */ new Set();
  if (t != null) {
    Te.add(t);
    const v = I.get(t);
    v && Ge(v, I).forEach((te) => Te.add(te)), e.forEach((te) => {
      Ge(te, I).includes(t) && Te.add(te.number);
    });
  }
  const xe = S != null && I.has(S) ? new Set(bt(e, S).map((v) => v.number)) : null, We = (v) => xe ? xe.has(v) : (f ? f.has(v) : !0) && (t == null || !c || Te.has(v)), De = (v) => v.state === "you" || v.state === "afk", Le = (v) => De(v) && v.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${E[v.state].color}` : void 0, $e = [];
  for (const v of L) for (const te of Ge(v, I)) $e.push({ from: I.get(te), to: v });
  const Oe = O != null ? H(O) + 0.3 * (ne + b) - b / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ u("div", { ref: o, style: { overflowX: "auto", padding: Ut, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ u("div", { style: { position: "relative", width: F, height: we, minWidth: F }, children: [
        /* @__PURE__ */ u("svg", { width: F, height: we, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ n("defs", { children: /* @__PURE__ */ n("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ n("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          Oe != null && /* @__PURE__ */ n("line", { x1: 0, x2: F, y1: Oe, y2: Oe, stroke: "var(--border)", strokeDasharray: "2 4" }),
          $e.map(({ from: v, to: te }) => {
            const me = Pe.get(v.number), ce = Pe.get(te.number);
            if (!me || !ce) return null;
            const Me = v.state === "done", ze = xe ? xe.has(v.number) && xe.has(te.number) : t != null && (v.number === t || te.number === t), He = xe ? !ze : t != null && c && !ze || !We(v.number) || !We(te.number), de = R ? (() => {
              const Ie = me.x + x / 2, ye = me.y + ne + 2, Re = ce.x + x / 2, Ee = ce.y - 2, Ne = (ye + Ee) / 2;
              return `M${Ie},${ye} C${Ie},${Ne} ${Re},${Ne} ${Re},${Ee}`;
            })() : (() => {
              const Ie = me.x + C + 2, ye = me.y + ne / 2, Re = ce.x - 2, Ee = ce.y + ne / 2, Ne = (Ie + Re) / 2;
              return `M${Ie},${ye} C${Ne},${ye} ${Ne},${Ee} ${Re},${Ee}`;
            })();
            return /* @__PURE__ */ n(
              "path",
              {
                d: de,
                fill: "none",
                stroke: ze ? "var(--text)" : "var(--muted)",
                strokeWidth: ze ? 1.6 : 1.2,
                strokeDasharray: Me ? "3 3" : void 0,
                opacity: He ? 0.15 : Me ? 0.45 : 0.8,
                markerEnd: "url(#kipo-arrow)"
              },
              `${v.number}-${te.number}`
            );
          })
        ] }),
        d && K.length > 0 && ["decide", "deliver"].map((v) => {
          const te = K.filter((ce) => v === "decide" ? ce.tile.lane === "decide" : ce.tile.lane !== "decide").map((ce) => ce.row);
          if (!te.length) return null;
          const me = (Math.min(...te) + Math.max(...te)) / 2;
          return /* @__PURE__ */ n("span", { style: { position: "absolute", left: 0, top: H(me) + ne / 2 - 8, fontSize: y.tiny, fontWeight: 600, color: "var(--muted)" }, children: v === "decide" ? "Decide" : "Deliver" }, v);
        }),
        K.map(({ tile: v }) => {
          const te = Pe.get(v.number);
          return /* @__PURE__ */ u(
            "div",
            {
              onPointerEnter: () => G(v.number),
              onPointerLeave: () => G((me) => me === v.number ? null : me),
              style: {
                position: "absolute",
                left: te.x,
                top: te.y,
                width: C,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: We(v.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ n(
                  "span",
                  {
                    title: Le(v) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: Le(v), display: "inline-flex" },
                    children: /* @__PURE__ */ n(Kt, { tile: v, size: x, onClick: () => r(v), open: v.number === t, status: s == null ? void 0 : s[v.number] })
                  }
                ),
                g && /* @__PURE__ */ n(
                  "button",
                  {
                    type: "button",
                    onClick: () => r(v),
                    title: v.title,
                    style: {
                      flex: 1,
                      minWidth: 0,
                      background: "transparent",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--text)",
                      fontSize: y.tiny,
                      lineHeight: 1.3,
                      fontWeight: v.number === t ? 600 : 400,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    },
                    children: v.title
                  }
                )
              ]
            },
            v.number
          );
        }),
        Array.from({ length: ae }).map((v, te) => /* @__PURE__ */ n(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: oe + 1 + w * (C + ie),
              top: H(Math.max(0, (J - ae) / 2) + te),
              width: x,
              height: ne,
              borderRadius: 6,
              border: "1.5px dashed var(--border)",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 600
            },
            children: "?"
          },
          `fog-${te}`
        ))
      ] }),
      j.length > 0 && /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: oe }, children: [
        /* @__PURE__ */ n("span", { style: { fontSize: y.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        j.map((v) => /* @__PURE__ */ n("span", { style: { opacity: We(v.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: Le(v) }, children: /* @__PURE__ */ n(Kt, { tile: v, size: x, onClick: () => r(v), open: v.number === t, status: s == null ? void 0 : s[v.number] }) }, v.number))
      ] }),
      /* @__PURE__ */ u("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: y.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: oe }, children: [
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ n("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ n("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2" }) }),
          " still blocks"
        ] }),
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ n("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ n("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2", strokeDasharray: "3 3", opacity: ".6" }) }),
          " blocker closed"
        ] }),
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ n("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, boxShadow: `0 0 0 1.5px ${E.you.color}`, marginRight: 5 } }),
          "frontier: open and unblocked"
        ] }),
        i > 0 && /* @__PURE__ */ n("span", { children: "? not yet specified" })
      ] })
    ] })
  );
}
function bt(e, t) {
  const i = new Map(e.map((f) => [f.number, f]));
  if (!i.has(t)) return [];
  const r = /* @__PURE__ */ new Set([t]), s = [t];
  for (; s.length; ) {
    const f = i.get(s.pop());
    for (const c of f ? Ge(f, i) : []) r.has(c) || (r.add(c), s.push(c));
  }
  const g = /* @__PURE__ */ new Set([t]), d = [t];
  for (; d.length; ) {
    const f = d.pop();
    for (const c of e)
      !g.has(c.number) && Ge(c, i).includes(f) && (g.add(c.number), r.add(c.number), d.push(c.number));
  }
  return e.filter((f) => r.has(f.number));
}
function $o(e) {
  if (!e) return "";
  const t = Math.max(0, (Date.now() - new Date(e).getTime()) / 1e3);
  return t < 60 ? "just now" : t < 3600 ? `${Math.floor(t / 60)}m ago` : t < 86400 ? `${Math.floor(t / 3600)}h ago` : `${Math.floor(t / 86400)}d ago`;
}
function Io({ slot: e, active: t, ended: i }) {
  const [r, s] = W(null), [g, d] = W(""), f = pe(null), c = pe(!0);
  return U(() => {
    let p = !0;
    const o = () => le.sessionTail(e, 60).then((l) => {
      p && (s(l.events), d(""));
    }).catch((l) => {
      p && d(be(l));
    });
    if (o(), !t || i) return () => {
      p = !1;
    };
    const a = setInterval(o, 4e3);
    return () => {
      p = !1, clearInterval(a);
    };
  }, [e, t, i]), U(() => {
    var p;
    c.current && ((p = f.current) == null || p.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ n("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: E.building.color, flexShrink: 0 } }),
      /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.tiny, lineHeight: 1.4 }, children: i ? /* @__PURE__ */ u(ge, { children: [
        "This session has ended — a read-only record of what it did, from its transcript. Its slot ",
        /* @__PURE__ */ n("code", { style: { fontSize: y.tiny }, children: e }),
        " is closed in Kiro."
      ] }) : /* @__PURE__ */ u(ge, { children: [
        "Running in the background — read-only progress from its transcript. To chat with it, open ",
        /* @__PURE__ */ n("code", { style: { fontSize: y.tiny }, children: e }),
        " in Kiro's session window."
      ] }) })
    ] }),
    /* @__PURE__ */ u(
      "div",
      {
        onScroll: (p) => {
          const o = p.currentTarget;
          c.current = o.scrollHeight - o.scrollTop - o.clientHeight < 40;
        },
        style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", scrollbarWidth: "thin" },
        children: [
          /* @__PURE__ */ n(Ke, { children: g }),
          r === null && !g && /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small }, children: "Reading its transcript…" }),
          r !== null && r.length === 0 && !g && /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.small }, children: "No steps recorded yet." }),
          /* @__PURE__ */ n("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: (r ?? []).map((p, o) => /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            /* @__PURE__ */ u("span", { style: { ...q, fontSize: y.tiny, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ n("span", { style: { fontWeight: 700, color: p.role === "user" ? E.you.text : "var(--muted)" }, children: p.role === "user" ? "You" : "Agent" }),
              p.ts && /* @__PURE__ */ n("span", { children: $o(p.ts) })
            ] }),
            p.tool ? /* @__PURE__ */ n("span", { style: { fontSize: y.small, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: p.text }) : /* @__PURE__ */ n("div", { style: { fontSize: y.body, lineHeight: 1.5 }, children: /* @__PURE__ */ n(ut, { content: p.text }) })
          ] }, o)) }),
          /* @__PURE__ */ n("div", { ref: f })
        ]
      }
    )
  ] });
}
const Qt = 2 * 60 * 60 * 1e3, st = /* @__PURE__ */ new Map(), Ro = (e, t) => {
  const i = st.get(`${e}:${t}`);
  return i && Date.now() - i >= Qt && st.delete(`${e}:${t}`), !!i && Date.now() - i < Qt;
};
function Co({ state: e, slotKey: t, settled: i, onError: r, onSize: s, bottomOffset: g = 122 }) {
  const d = wt();
  for (const b of (e == null ? void 0 : e.decisions) ?? []) b.answer && t && st.delete(`${t}:${b.id}`);
  const f = i || !t ? [] : (e == null ? void 0 : e.decisions.filter((b) => !b.answer && !Ro(t, b.id))) ?? [], [c, p] = W({}), [o, a] = W(0), [l, S] = W(!1), [G, I] = W(!1), M = f.map((b) => b.id).join(","), j = pe(M);
  U(() => {
    j.current !== M && (j.current = M, a(0), p({}), M && I(!1));
  }, [M]);
  const L = pe(null), K = Ae((b) => {
    var F;
    if ((F = L.current) == null || F.disconnect(), L.current = null, !b) {
      s == null || s(0);
      return;
    }
    const w = () => s == null ? void 0 : s(b.offsetHeight);
    w(), L.current = new ResizeObserver(w), L.current.observe(b);
  }, [s]);
  if (!f.length || !t) return null;
  if (G) return /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      className: "kipo-pulse",
      onClick: () => I(!1),
      title: "Open the questions waiting on you",
      style: {
        position: "absolute",
        right: 16,
        bottom: g + 4,
        zIndex: 6,
        cursor: "pointer",
        borderRadius: 99,
        padding: "4px 12px",
        fontSize: y.small,
        fontWeight: 600,
        border: `1px solid ${E.you.color}`,
        color: E.you.text,
        background: "var(--bg-elevated)",
        boxShadow: "0 4px 14px rgba(0,0,0,.35)"
      },
      children: [
        f.length,
        " question",
        f.length === 1 ? "" : "s",
        " →"
      ]
    }
  );
  const Q = Math.min(o, f.length - 1), N = f[Q], O = f.filter((b) => (c[b.id] ?? "").trim()), x = Q === 0, R = Q === f.length - 1, oe = (c[N.id] ?? "") !== "" && !N.options.includes(c[N.id] ?? ""), ie = f.filter((b) => b.recommended), ae = (b) => p((w) => ({ ...w, [N.id]: b })), X = async (b = c) => {
    const w = f.filter((H) => (b[H.id] ?? "").trim());
    if (!w.length) return;
    const F = f.filter((H) => !(b[H.id] ?? "").trim()), J = w.map((H, we) => `${we + 1}. ${H.title} (${H.id}): ${b[H.id].trim()}`), he = [
      `My answers to your ${w.length === 1 ? "question" : `${w.length} questions`}:`,
      "",
      ...J,
      "",
      F.length ? `Still open, I'll answer later: ${F.map((H) => H.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
    ].join(`
`);
    S(!0);
    try {
      await d.post("/api/chat?ws=1", { slot: t, message: he });
      for (const H of w) st.set(`${t}:${H.id}`, Date.now());
      p({}), a(0);
    } catch (H) {
      r(`Couldn't send your answers: ${be(H)}`);
    } finally {
      S(!1);
    }
  }, $ = () => {
    const b = { ...c };
    for (const w of ie) b[w.id] = w.recommended;
    p(b), X(b);
  }, B = (b) => /* @__PURE__ */ n("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${b ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: b && /* @__PURE__ */ n("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), C = (b) => {
    const w = c[N.id] === b;
    return /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": w,
        disabled: l,
        onClick: () => ae(b),
        onMouseEnter: (F) => {
          w || (F.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (F) => {
          w || (F.currentTarget.style.background = "transparent");
        },
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          width: "100%",
          textAlign: "left",
          padding: "7px 10px",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: y.small,
          lineHeight: 1.4,
          border: `1px solid ${w ? "var(--accent)" : "var(--border)"}`,
          background: w ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
          color: "var(--text)"
        },
        children: [
          B(w),
          /* @__PURE__ */ n("span", { style: { flex: 1, minWidth: 0 }, children: b }),
          b === N.recommended && /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      b
    );
  }, ne = (b, w, F) => /* @__PURE__ */ n(
    "button",
    {
      type: "button",
      disabled: w,
      onClick: F,
      style: {
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 10px",
        color: w ? "var(--muted)" : "var(--text)",
        cursor: w ? "default" : "pointer",
        fontSize: y.small,
        opacity: w ? 0.5 : 1
      },
      children: b
    }
  );
  return /* @__PURE__ */ u(
    "div",
    {
      ref: K,
      role: "dialog",
      "aria-label": `Question ${Q + 1} of ${f.length}`,
      style: {
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: g,
        zIndex: 6,
        width: "min(680px, calc(100% - 24px))",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.45)",
        padding: "10px 14px 11px"
      },
      children: [
        /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }, children: [
          /* @__PURE__ */ n("span", { style: { fontSize: y.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: E.you.text }, children: f.length === 1 ? "Question" : `Question ${Q + 1} of ${f.length}` }),
          f.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ n("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: f.map((b, w) => /* @__PURE__ */ n(
            "span",
            {
              title: b.title,
              onClick: () => a(w),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (c[b.id] ?? "").trim() ? E.you.color : w === Q ? "var(--text)" : "var(--border)"
              }
            },
            b.id
          )) }),
          /* @__PURE__ */ n("span", { style: { flex: 1 } }),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              onClick: () => I(!0),
              title: "Tuck the questions away and get the chat box back",
              style: {
                background: "transparent",
                border: "none",
                padding: "0 2px",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: y.tiny
              },
              children: "Hide"
            }
          )
        ] }),
        /* @__PURE__ */ n("div", { style: { ...ve, fontSize: y.body, marginBottom: 8, lineHeight: 1.4 }, children: N.title }),
        /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
          N.options.map(C),
          /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px" }, children: [
            B(oe),
            /* @__PURE__ */ n(
              "input",
              {
                value: oe ? c[N.id] ?? "" : "",
                onChange: (b) => ae(b.target.value),
                disabled: l,
                placeholder: "Something else…",
                "aria-label": `Another answer to: ${N.title}`,
                style: {
                  flex: 1,
                  minWidth: 0,
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: y.small,
                  border: `1px solid ${oe ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: "5px 10px",
                  outline: "none"
                }
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          f.length > 1 && ne("‹ Back", x, () => a(Q - 1)),
          !R && ne("Next ›", !1, () => a(Q + 1)),
          /* @__PURE__ */ n("span", { style: { flex: 1 } }),
          f.length > 1 && /* @__PURE__ */ u("span", { style: { ...q, fontSize: y.tiny }, children: [
            O.length,
            " of ",
            f.length,
            " answered"
          ] }),
          ie.length > 0 && /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              disabled: l,
              onClick: $,
              title: f.length > 1 ? `Answer all ${ie.length} with their recommendation and send` : "Take the recommendation and send",
              style: {
                background: "transparent",
                border: `1px solid ${E.you.color}`,
                borderRadius: 6,
                padding: "3px 10px",
                color: E.you.text,
                cursor: l ? "default" : "pointer",
                fontSize: y.small,
                whiteSpace: "nowrap",
                opacity: l ? 0.5 : 1
              },
              children: f.length > 1 ? "Accept all recommendations" : "Accept recommendation"
            }
          ),
          /* @__PURE__ */ n(Se, { primary: !0, disabled: !O.length || l, onClick: () => void X(), children: l ? "Sending…" : O.length > 1 ? `Submit ${O.length} answers` : "Submit" })
        ] })
      ]
    }
  );
}
const To = {
  grilling: "Grill",
  prototype: "Prototype",
  research: "Research",
  task: "Task",
  build: "Build",
  issue: "Issue"
}, dt = {
  MERGED: { label: "merged", color: "var(--ok, #3fb950)" },
  OPEN: { label: "open", color: "var(--accent)" },
  CLOSED: { label: "closed", color: "var(--muted)" }
};
function Xt({ color: e, text: t, children: i }) {
  return /* @__PURE__ */ n("span", { style: { fontSize: y.tiny, padding: "1px 8px", borderRadius: 999, border: `1px solid ${e}`, color: t, whiteSpace: "nowrap" }, children: i });
}
function zo({ detail: e, tile: t }) {
  const [i, r] = W(null), [s, g] = W("");
  U(() => {
    let o = !0;
    return r(null), g(""), le.ticket(e.repo, e.number, t.number).then((a) => {
      o && r(a);
    }).catch((a) => {
      o && g(be(a));
    }), () => {
      o = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const d = e.prs.filter((o) => t.prs.includes(o.number)), f = t.state === "done", c = E[t.state];
  let p;
  return f ? p = d.some((o) => o.state === "MERGED") ? "Closed: its PR merged." : "Closed." : t.state === "review" ? p = "Its PR is open. The effort's Review merges it once it's clean." : t.state === "blocked" ? p = `Waiting on ${t.blockedBy.map((o) => `#${o}`).join(", ")}. It can start once those close.` : t.state === "building" ? p = "An agent is working on it." : t.who === "you" ? p = /* @__PURE__ */ u(ge, { children: [
    /* @__PURE__ */ n(no, { term: "HITL", children: "HITL" }),
    ": it needs you. Start it to open its conversation."
  ] }) : p = "An agent can take it on its own.", /* @__PURE__ */ u("div", { children: [
    /* @__PURE__ */ u("div", { style: { padding: "14px 16px" }, children: [
      /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ u("span", { style: { ...q, fontSize: y.small }, children: [
          "#",
          t.number,
          " · ",
          To[t.type]
        ] }),
        /* @__PURE__ */ n("span", { title: Fe[t.state], style: { cursor: "help", display: "inline-flex" }, children: /* @__PURE__ */ n(Xt, { color: c.color === "transparent" ? "var(--border)" : c.color, text: c.text, children: c.label }) }),
        /* @__PURE__ */ n("span", { style: { flex: 1 } }),
        /* @__PURE__ */ n("a", { href: t.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: y.small }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ n("div", { style: { ...ve, fontSize: y.title, marginTop: 4, lineHeight: 1.35 }, children: t.title }),
      /* @__PURE__ */ n("div", { style: { fontSize: y.small, marginTop: 5, lineHeight: 1.45 }, children: p })
    ] }),
    d.length > 0 && /* @__PURE__ */ n(at, { title: d.length === 1 ? "Pull request" : "Pull requests", children: /* @__PURE__ */ n("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: d.map((o) => {
      var a, l, S;
      return /* @__PURE__ */ u(
        "a",
        {
          href: o.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: y.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ n(Xt, { color: ((a = dt[o.state]) == null ? void 0 : a.color) ?? "var(--border)", text: ((l = dt[o.state]) == null ? void 0 : l.color) ?? "var(--muted)", children: ((S = dt[o.state]) == null ? void 0 : S.label) ?? o.state }),
            /* @__PURE__ */ u("span", { style: { color: "var(--accent)" }, children: [
              "#",
              o.number
            ] }),
            /* @__PURE__ */ n("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: o.title })
          ]
        },
        o.number
      );
    }) }) }),
    f && /* @__PURE__ */ n(at, { title: "How it ended", aside: i != null && i.lastComment ? `latest of ${i.comments} comment${i.comments === 1 ? "" : "s"}` : void 0, children: s ? /* @__PURE__ */ n(Ke, { children: s }) : i ? i.lastComment ? /* @__PURE__ */ n("div", { style: { fontSize: y.body, lineHeight: 1.55 }, children: /* @__PURE__ */ n(ut, { content: i.lastComment.body }) }) : /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.small }, children: "Closed with no comment." }) : /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.small }, children: "Loading…" }) }),
    /* @__PURE__ */ n(at, { title: f ? "What it asked" : "What it asks", defaultOpen: !f, children: s ? /* @__PURE__ */ n(Ke, { children: s }) : i ? i.body.trim() ? /* @__PURE__ */ n("div", { style: { fontSize: y.body, lineHeight: 1.55 }, children: /* @__PURE__ */ n(ut, { content: i.body }) }) : /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.small }, children: "No description." }) : /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.small }, children: "Loading…" }) })
  ] });
}
const Ao = (e) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ""}@${e.at}`;
function Oo(e, t, i, r, s = {}) {
  const g = [], d = [], f = new Set(s.unstarted ?? []), c = (a, l) => {
    const S = l ? r[l] : void 0;
    if (S)
      return a.replace === S || l && f.has(l) ? S : null;
  }, p = (a, l) => l ? { ...a, replace: l } : a, o = (a) => (s.prs ?? []).some((l) => l.state === "OPEN" && ((l.tickets ?? []).includes(a) || (l.refs ?? []).includes(a)));
  for (const a of e) {
    const l = Ao(a);
    if (!(t(l) || g.includes(l))) {
      if (g.push(l), a.ticket != null) {
        const S = i.find((I) => I.number === a.ticket);
        if (!S) continue;
        const G = a.skill === "kipo-review";
        if ((S.state === "done" || S.state === "blocked") && !(G && o(S.number))) continue;
        if (G) {
          const I = c(a, `review-t${S.number}`);
          I !== null && d.push(p({ id: l, kind: "review", t: S.number }, I));
        } else {
          const I = c(a, S.sessionKey);
          I !== null && d.push(p({ id: l, kind: "tile", tile: S, skill: a.skill && !a.skill.startsWith("kipo-") ? a.skill : null }, I));
        }
      } else if (a.stage) {
        const S = c(a, a.stage);
        S !== null && d.push(p({ id: l, kind: "stage", column: a.stage, skill: a.skill && a.skill !== `kipo-${a.stage}` ? a.skill : null }, S));
      }
    }
  }
  return { fresh: g, starts: d };
}
const Eo = (e) => `[KiPo] Carry on: ${e}. Re-read your ticket, its PR and comments, and your state file, then continue from where you stopped; report when you finish or block.`, No = (e, t) => `[KiPo] Woke ${e}: ${t}`;
function Wo(e) {
  var i;
  if (!e) return null;
  const t = (i = e.messages) == null ? void 0 : i[e.messages.length - 1];
  return {
    at: (t == null ? void 0 : t.ts) || null,
    running: typeof e.running == "boolean" ? e.running : null,
    agent: t != null && t.role ? t.role !== "user" && t.role !== "system" : null
  };
}
const Mo = (e) => e.filter((t) => t.status === "open" && t.key !== "conductor");
function Ho(e, t, i) {
  return e.filter((r) => {
    var s;
    return ((s = r.stall) == null ? void 0 : s.state) === "stalled" && r.key !== "conductor" && r.slot !== t && !i(`${r.key}/${r.stall.id}`);
  });
}
const Vt = (e) => e.kind === "ticket" ? `build-t${e.t}` : e.kind === "spec" ? "build-spec" : e.kind === "decision" ? `shape-t${e.t}` : e.kind === "review" ? `review-t${e.t}` : e.kind === "stage" ? e.column : "conductor";
function Po({ repo: e, number: t, active: i, autoStart: r, spineHost: s, spineCompact: g, onRemoved: d, onChanged: f }) {
  var Ct, Tt, zt, At, Ot, Et;
  const c = wt(), p = `effort:${e}#${t}`, [o, a] = W(() => Ve(p)), [l, S] = W(""), [G, I] = W(""), [M, j] = W(() => Ve(`${p}:focus`) ?? { kind: "column" });
  U(() => {
    Ze(`${p}:focus`, M);
  }, [p, M]);
  const [L, K] = W(!1), [Q, N] = W(!1), O = Yn("chain", 100, 0.75), x = Ae(() => {
    le.getInitiative(e, t).then((h) => {
      a(h), Ze(p, h), S("");
    }).catch((h) => S(be(h)));
  }, [e, t, p]);
  U(() => {
    if (x(), !i) return;
    const h = setInterval(x, 5e3);
    return () => clearInterval(h);
  }, [x, i]);
  const R = o == null ? void 0 : o.column;
  U(() => {
    I("");
  }, [R, M]);
  const oe = pe(R);
  U(() => {
    if (R === void 0 || oe.current === R) {
      oe.current = R;
      return;
    }
    const h = oe.current !== void 0;
    oe.current = R, h && j({ kind: "column" });
  }, [R]);
  const ie = o ? Vt(M) : null, ae = o && ie ? o.sessions[ie] ?? null : null, X = ae && !_e(ae) ? ae : null, $ = o && M.kind === "ticket" ? o.tickets.find((h) => h.number === M.t) ?? null : null, B = async (h = null, k, Z = !0, D = !1) => {
    if (!o) return;
    const T = k ?? M;
    K(!0), I("");
    try {
      const P = T.kind === "ticket" ? { column: "build", ticket: T.t, skill: h ?? "implement" } : T.kind === "spec" ? { column: "build", mode: "implement-spec", skill: h ?? "implement-spec" } : T.kind === "decision" ? { column: "shape", ticket: T.t, skill: h } : T.kind === "review" ? { column: "review", ticket: T.t, skill: h } : T.kind === "stage" ? { column: T.column, skill: h } : { column: o.column, mode: "conductor" }, z = await le.startSession(e, t, D ? { ...P, replace: !0 } : P), A = T.kind === "ticket" ? `${o.title}: #${T.t}` : T.kind === "spec" ? `${o.title}: implement-spec` : T.kind === "decision" ? `${o.title}: decision #${T.t}` : T.kind === "review" ? `${o.title}: review #${T.t}` : T.kind === "stage" ? `${o.title}: ${ft[T.column]}` : `${o.title}: conductor`;
      z.existing ? await c.post("/api/chat?ws=1", { slot: z.slotName, message: z.seed }) : await oo(c, e, z.slotName, z.seed, A, z.agent), z.key && await le.sessionStarted(e, t, z.key).catch(() => le.sessionStarted(e, t, z.key)).catch(() => {
      }), k && Z && j(k), Z && (x(), f());
    } catch (P) {
      I(
        P instanceof ht && P.code === "ticket_blocked" ? P.message : `Couldn't start the conversation: ${be(P)}`
      );
    } finally {
      K(!1);
    }
  }, C = (h) => h.lane === "deliver" ? { kind: "ticket", t: h.number } : { kind: "decision", t: h.number }, ne = (h) => h.lane === "deliver" ? "implement" : h.type === "research" ? "research" : h.type === "prototype" ? "prototype" : h.type === "issue" ? "triage" : null, [b, w] = W(null), F = (h) => {
    j(C(h));
  }, J = o != null && o.frontier && (M.kind === "ticket" || M.kind === "decision") ? o.frontier.tiles.find((h) => h.number === M.t) ?? null : null, [he, H] = W({}), [we, Pe] = W({}), [Te, xe] = W(null);
  U(() => {
    let h = !0;
    const k = () => (tt(), c.get("/api/chat/slots").then((D) => {
      h && Array.isArray(D) && xe(new Set(D.filter((T) => T.key).map((T) => T.key)));
    }).catch(() => {
    }));
    if (k(), !i) return () => {
      h = !1;
    };
    const Z = setInterval(k, 5e3);
    return () => {
      h = !1, clearInterval(Z);
    };
  }, [c, i]);
  const We = X && !(Te !== null && !Te.has(X)) ? X : null;
  U(() => {
    jo(We);
  }, [We]);
  const De = nn(
    () => {
      var h;
      return (((h = o == null ? void 0 : o.frontier) == null ? void 0 : h.tiles) ?? []).filter((k) => k.sessionKey && (o == null ? void 0 : o.sessions[k.sessionKey]));
    },
    [o]
  );
  U(() => {
    if (!De.length) {
      H({}), Pe({});
      return;
    }
    let h = !0;
    const k = (T) => {
      const P = (T == null ? void 0 : T.content) ?? (T == null ? void 0 : T.text), z = typeof P == "string" ? P : Array.isArray(P) ? P.map((ee) => typeof ee == "string" ? ee : (ee == null ? void 0 : ee.text) ?? "").join(" ") : null, A = z == null ? void 0 : z.replace(/\s+/g, " ").trim();
      return A ? A.slice(0, 140) : null;
    }, Z = async () => {
      let T = /* @__PURE__ */ new Map();
      try {
        const P = await c.get("/api/chat/slots");
        h && Array.isArray(P) && (T = new Map(P.filter((z) => z.key).map((z) => [z.key, z])));
      } catch {
      }
      Promise.all(De.map((P) => {
        const z = o.sessions[P.sessionKey], A = T.get(z);
        return c.get(`/api/chat/slots/${encodeURIComponent(z)}?limit=1`).then((ee) => {
          var Wt;
          const Je = (Wt = ee == null ? void 0 : ee.messages) == null ? void 0 : Wt[ee.messages.length - 1], Rn = (A == null ? void 0 : A.pending_approval) ?? (ee == null ? void 0 : ee.pending_approval), Cn = (A == null ? void 0 : A.needs_input) ?? (ee == null ? void 0 : ee.needs_input), Tn = (A == null ? void 0 : A.running) ?? (ee == null ? void 0 : ee.running), Nt = Rn ? "approval" : Cn ? "input" : null, zn = { at: (Je == null ? void 0 : Je.ts) ?? null, line: Je && Je.role !== "user" ? k(Je) : null, needs: Nt }, An = Nt ? "attention" : Tn ? "running" : P.state === "done" ? null : "waiting";
          return [P.number, An, zn];
        }).catch(() => null);
      })).then((P) => {
        if (!h) return;
        const z = {}, A = {};
        for (const ee of P)
          ee && (ee[1] && (z[ee[0]] = ee[1]), A[ee[0]] = ee[2]);
        H(z), Pe(A);
      });
    };
    if (Z(), !i) return () => {
      h = !1;
    };
    const D = setInterval(Z, 5e3);
    return () => {
      h = !1, clearInterval(D);
    };
  }, [c, De, i, o]);
  const Le = async (h) => {
    for (let k = 0; k < h.length; k++)
      w(`Starting ${k + 1} of ${h.length}…`), await B(ne(h[k]), C(h[k]), !1);
    w(null), x(), f();
  }, $e = `kipo.autopilot:${e}#${t}`, [Oe, v] = W(() => localStorage.getItem($e) === "1"), te = (h) => {
    v(h), localStorage.setItem($e, h ? "1" : "0");
  }, me = pe(/* @__PURE__ */ new Set());
  U(() => {
    if (!Oe || !i || b || !(o != null && o.frontier)) return;
    const h = o.frontier.tiles.filter((k) => k.lane === "deliver" && k.state === "afk" && !k.sessionKey && !me.current.has(k.number));
    h.length && (h.forEach((k) => me.current.add(k.number)), Le(h));
  }, [Oe, i, b, o]);
  const ce = `kipo.dispatched:${e}#${t}`, Me = pe(/* @__PURE__ */ new Set()), ze = (h) => {
    Me.current.delete(h);
    try {
      const k = JSON.parse(localStorage.getItem(ce) || "[]");
      localStorage.setItem(ce, JSON.stringify(k.filter((Z) => Z !== h)));
    } catch {
    }
  };
  U(() => {
    var T, P;
    if (!i || L || b || !(o != null && o.frontier)) return;
    const h = ((P = (T = o.sessionStates) == null ? void 0 : T.conductor) == null ? void 0 : P.dispatch) ?? [];
    let k = [];
    try {
      k = JSON.parse(localStorage.getItem(ce) || "[]");
    } catch {
      k = [];
    }
    const { fresh: Z, starts: D } = Oo(
      h,
      (z) => k.includes(z) || Me.current.has(z),
      o.frontier.tiles,
      o.sessions,
      { prs: [...o.prs, ...o.refPrs ?? []], unstarted: _o(o) }
    );
    if (Z.length) {
      for (const z of Z)
        Me.current.add(z), k.push(z);
      try {
        localStorage.setItem(ce, JSON.stringify(k.slice(-300)));
      } catch {
      }
      D.length && (async () => {
        for (const z of D) {
          if (z.replace && !tn(o, z.replace) && !await _t(c, z.replace)) {
            ze(z.id);
            continue;
          }
          const A = !!z.replace;
          z.kind === "tile" ? await B(z.skill ?? ne(z.tile), C(z.tile), !1, A) : z.kind === "review" ? await B(null, { kind: "review", t: z.t }, !1, A) : await B(z.skill, { kind: "stage", column: z.column }, !1, A);
        }
        x(), f();
      })();
    }
  }, [i, L, b, o]);
  const He = `kipo.restarted:${e}#${t}`;
  U(() => {
    if (!i || L || b || !(o != null && o.closing)) return;
    let h = [];
    try {
      h = JSON.parse(localStorage.getItem(He) || "[]");
    } catch {
      h = [];
    }
    const Z = o.closing.filter((P) => P.started === !1 && P.key !== "conductor" && !h.includes(P.slot)).map((P) => [P, Fo(P.key)]).find(([, P]) => P);
    if (!Z) return;
    const [D, T] = Z;
    try {
      localStorage.setItem(He, JSON.stringify([...h, D.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var z;
      if (!tn(o, D.slot) && !await _t(c, D.slot)) return;
      const P = (z = o.frontier) == null ? void 0 : z.tiles.find((A) => (T.kind === "ticket" || T.kind === "decision") && A.number === T.t);
      await B(P ? ne(P) : null, T, !1, !0), x(), f();
    })();
  }, [i, L, b, o]);
  const de = o != null && o.sessions.conductor && !_e(o.sessions.conductor) ? o.sessions.conductor : null, Ie = ((o == null ? void 0 : o.closing) ?? []).filter((h) => {
    var k;
    return ((k = h.stall) == null ? void 0 : k.state) === "stuck";
  }).map((h) => h.key), ye = o != null && o.frontier ? JSON.stringify({
    t: o.frontier.tiles.map((h) => [h.number, h.state]),
    p: o.prs.map((h) => [h.number, h.state]),
    ...Ie.length ? { s: Ie } : {}
  }) : "";
  U(() => {
    if (!ye || !de || !i) return;
    const h = `kipo.conductorSaw:${e}#${t}`, k = localStorage.getItem(h);
    if (k === ye) return;
    if (k === null) {
      localStorage.setItem(h, ye);
      return;
    }
    const Z = [];
    try {
      const D = JSON.parse(k), T = JSON.parse(ye), P = new Map(D.t), z = new Map(D.p);
      for (const [A, ee] of T.t) P.get(A) !== ee && Z.push(`#${A} ${P.get(A) ?? "new"} → ${ee}`);
      for (const [A, ee] of T.p) z.get(A) !== ee && Z.push(`PR #${A} ${(z.get(A) ?? "new").toLowerCase()} → ${ee.toLowerCase()}`);
      for (const A of T.s ?? []) (D.s ?? []).includes(A) || Z.push(`${A} stuck (woken twice, no answer)`);
    } catch {
    }
    (async () => {
      try {
        const D = await c.get(`/api/chat/slots/${encodeURIComponent(de)}?limit=1`);
        if (D != null && D.running) return;
        await c.post("/api/chat?ws=1", {
          slot: de,
          message: `[KiPo] Frontier changed${Z.length ? `: ${Z.slice(0, 12).join("; ")}` : ""}. Run the frontier and carry on.`
        }), localStorage.setItem(h, ye);
      } catch {
      }
    })();
  }, [ye, de, i]), U(() => {
    const h = o == null ? void 0 : o.reports;
    if (!h || !de || !i) return;
    const k = `kipo.reportsSent:${e}#${t}`, Z = Number(localStorage.getItem(k) || "0"), D = h.reports.filter((T) => T.id > Math.max(Z, h.read));
    D.length && (async () => {
      try {
        const T = await c.get(`/api/chat/slots/${encodeURIComponent(de)}?limit=1`);
        if (T != null && T.running) return;
        const P = (A) => {
          var ee;
          return `${A.event}: ${A.text}${(ee = A.items) != null && ee.length ? ` (${A.items.join("; ")})` : ""}`;
        }, z = D.length === 1 ? `[KiPo] Report from ${D[0].from}: ${P(D[0])}` : `[KiPo] Reports from the sessions:
${D.slice(-12).map((A) => `- ${A.from} ${P(A)}`).join(`
`)}`;
        await c.post("/api/chat?ws=1", { slot: de, message: `${z}
Run the frontier and carry on.` }), localStorage.setItem(k, String(D[D.length - 1].id));
      } catch {
      }
    })();
  }, [o, de, i]);
  const Re = (h, k) => {
    if (o) {
      if (o.sessions[h]) {
        j({ kind: "stage", column: h });
        return;
      }
      B(k, { kind: "stage", column: h });
    }
  }, Ee = () => Re("plan", "to-spec"), Ne = () => Re("review", null), nt = () => Re("done", "retro"), m = async () => {
    if (o) {
      N(!0), I("");
      try {
        o.column !== "done" && await le.advance(e, t, !0, "done"), await le.advance(e, t, !0, null), await Ft(c, Object.values(o.sessions), null), d();
      } catch (h) {
        I(`Couldn't close it: ${be(h)}`), N(!1);
      }
    }
  }, V = pe(!1);
  U(() => {
    if (!(o != null && o.closing) || !i || V.current) return;
    const h = o.closing.filter((k) => k.status === "closable");
    h.length && (V.current = !0, Ft(c, h.map((k) => k.slot), X).then((k) => {
      const Z = h.filter((D) => k.includes(D.slot)).map((D) => D.key);
      return Z.length ? le.sessionsClosed(e, t, Z).then(() => x()) : void 0;
    }).catch(() => {
    }).finally(() => {
      V.current = !1;
    }));
  }, [c, o, i, X]);
  const Y = JSON.stringify(Mo((o == null ? void 0 : o.closing) ?? []).filter((h) => !_e(h.slot)).map((h) => [h.key, h.slot]));
  U(() => {
    const h = JSON.parse(Y);
    if (!i || !h.length) return;
    let k = !0;
    const Z = () => {
      Promise.all(h.map(
        ([T, P]) => c.get(`/api/chat/slots/${encodeURIComponent(P)}?limit=1`).then((z) => [T, Wo(z)]).catch(() => null)
      )).then((T) => {
        if (!k) return;
        const P = Object.fromEntries(T.filter((z) => z && z[1]).map((z) => [z[0], z[1]]));
        Object.keys(P).length && le.sessionsActivity(e, t, P).catch(() => {
        });
      });
    };
    Z();
    const D = setInterval(Z, 3e4);
    return () => {
      k = !1, clearInterval(D);
    };
  }, [c, Y, i, e, t]);
  const _ = `kipo.woke:${e}#${t}`, Be = `kipo.wokeNotes:${e}#${t}`, fe = pe(!1);
  U(() => {
    if (!(o != null && o.closing) || !i || fe.current) return;
    let h = [];
    try {
      h = JSON.parse(localStorage.getItem(_) || "[]");
    } catch {
      h = [];
    }
    let k = [];
    try {
      k = JSON.parse(localStorage.getItem(Be) || "[]");
    } catch {
      k = [];
    }
    const Z = Ho(o.closing, X, (D) => h.includes(D)).filter((D) => !_e(D.slot));
    !Z.length && !(k.length && de) || (fe.current = !0, (async () => {
      for (const D of Z) {
        const T = D.stall;
        try {
          const P = await c.get(`/api/chat/slots/${encodeURIComponent(D.slot)}?limit=1`);
          if (P != null && P.running) continue;
          await c.post("/api/chat?ws=1", { slot: D.slot, message: Eo(T.why) }), h = [...h, `${D.key}/${T.id}`].slice(-300), localStorage.setItem(_, JSON.stringify(h)), k = [...k, No(D.key, T.why)], localStorage.setItem(Be, JSON.stringify(k)), await le.sessionsWoken(e, t, D.key, T.id ?? "", T.why);
        } catch {
        }
      }
      if (k.length && de)
        try {
          const D = await c.get(`/api/chat/slots/${encodeURIComponent(de)}?limit=1`);
          D != null && D.running || (await c.post("/api/chat?ws=1", { slot: de, message: `${k.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(Be, "[]"));
        } catch {
        }
      Z.length && x();
    })().finally(() => {
      fe.current = !1;
    }));
  }, [c, o, i, X, de]);
  const je = pe(!1);
  if (U(() => {
    !r || je.current || !o || (je.current = !0, o.sessions[o.column] || B());
  }, [r, o]), !o)
    return /* @__PURE__ */ n("div", { style: { flex: 1, padding: 24 }, children: l ? /* @__PURE__ */ n(Ke, { children: l }) : /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.body }, children: "Loading…" }) });
  const qe = ie ? ((Ct = o.sessionStates) == null ? void 0 : Ct[ie]) ?? null : o.state, se = (qe == null ? void 0 : qe.skillsUsed) ?? [], ue = (h) => (h == null ? void 0 : h.decisions.filter((k) => !k.answer).length) ?? 0, Ce = [];
  ue(((Tt = o.sessionStates) == null ? void 0 : Tt.conductor) ?? o.state) && Ce.push({ kind: "column" });
  for (const h of ((zt = o.frontier) == null ? void 0 : zt.tiles) ?? [])
    h.state === "done" || !h.sessionKey || !ue((At = o.sessionStates) == null ? void 0 : At[h.sessionKey]) || Ce.push(h.sessionKey.startsWith("review-t") ? { kind: "review", t: h.number } : h.lane === "deliver" ? { kind: "ticket", t: h.number } : { kind: "decision", t: h.number });
  for (const h of ["plan", "review", "done", "intake", "shape", "grill"])
    o.sessions[h] && ue((Ot = o.sessionStates) == null ? void 0 : Ot[h]) && Ce.push({ kind: "stage", column: h });
  o.sessions["build-spec"] && ue((Et = o.sessionStates) == null ? void 0 : Et["build-spec"]) && Ce.push({ kind: "spec" });
  const lt = () => {
    if (!Ce.length) return;
    const h = Ce.findIndex((k) => Vt(k) === ie);
    j(Ce[(h + 1) % Ce.length]);
  }, $t = pe(null), bn = () => {
    var h, k;
    try {
      (k = (h = $t.current) == null ? void 0 : h.contentWindow) == null || k.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [Ue, vn] = W(!1), [It, wn] = W(0), kn = Ae((h) => wn((k) => Math.abs(k - h) > 4 ? h : k), []), [Rt, xn] = W(128), Sn = Ae((h) => xn((k) => Math.abs(k - h) > 4 ? h : k), []), $n = J ? J.state === "done" : !!ae && _e(ae), In = M.kind === "column" ? qe ?? o.state : qe;
  return /* @__PURE__ */ u("div", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ n("style", { children: "@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}" }),
    /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", minWidth: 0 }, children: [
      /* @__PURE__ */ u("span", { style: { ...ve, fontSize: y.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, title: o.title, children: [
        "#",
        o.number,
        " ",
        o.title
      ] }),
      (o.kind === "map" || o.mapIssue) && /* @__PURE__ */ n(
        "a",
        {
          href: `https://github.com/${o.repo}/issues/${o.kind === "map" ? o.number : o.mapIssue}`,
          target: "_blank",
          rel: "noreferrer",
          title: "Open the wayfinder map on GitHub",
          style: { textDecoration: "none", display: "inline-flex" },
          children: /* @__PURE__ */ n(gt, { kind: o.kind, map: o.kind === "map" ? o.number : o.mapIssue })
        }
      ),
      /* @__PURE__ */ n("span", { style: { flex: 1 } }),
      /* @__PURE__ */ n("span", { style: { ...q, fontSize: y.tiny, whiteSpace: "nowrap" }, title: o.repoPath, children: o.repo })
    ] }),
    G && /* @__PURE__ */ n("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ n(Ke, { children: G }) }),
    (() => {
      var z;
      const h = /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ n("span", { style: { ...X ? q : ve, fontSize: X ? y.small : y.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: J ? `#${J.number}${X ? "" : ` ${J.title}`}` : M.kind === "column" ? "Conductor" : o.title }),
        X && se.length > 0 && /* @__PURE__ */ n(Ko, { skills: se }),
        /* @__PURE__ */ n("span", { style: { flex: 1 } }),
        J && (o.frontier ? bt(o.frontier.tiles, J.number).length > 1 : !1) && /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            onClick: () => vn((A) => !A),
            "aria-pressed": Ue,
            title: "Show or hide this ticket's map — what it waits on and what it unblocks",
            "aria-label": "Show or hide the map",
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              background: Ue ? "var(--bg-elevated)" : "transparent",
              color: Ue ? "var(--text)" : "var(--muted)",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: y.small,
              border: `1px solid ${Ue ? "var(--border)" : "transparent"}`
            },
            children: [
              /* @__PURE__ */ n(Dn, { size: 14 }),
              " Map"
            ]
          }
        ),
        X && /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            onClick: bn,
            title: "Show or hide the side panel — browser, Changes, Terminal, Subagents",
            "aria-label": "Show or hide the side panel",
            style: {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              flexShrink: 0
            },
            onMouseEnter: (A) => {
              A.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))", A.currentTarget.style.color = "var(--text)";
            },
            onMouseLeave: (A) => {
              A.currentTarget.style.background = "transparent", A.currentTarget.style.color = "var(--muted)";
            },
            children: /* @__PURE__ */ n(Ln, { size: 15 })
          }
        )
      ] }), k = J && (J.state === "you" || J.state === "afk"), Z = !!X && Te !== null && !Te.has(X), D = X && Z ? /* @__PURE__ */ n(Io, { slot: X, active: i, ended: !0 }) : X ? (
        // The card sits `composerH` up, so the transcript must clear the
        // composer, the card, and a gap above it.
        /* @__PURE__ */ n(
          qo,
          {
            slotKey: X,
            frameRef: $t,
            padBottom: It ? Rt + It + 24 : 0,
            onComposerH: Sn
          },
          X
        )
      ) : J ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          k && /* @__PURE__ */ u("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ n(Se, { primary: !0, disabled: L, onClick: () => B(ne(J)), children: L ? "Starting…" : ((z = yn[J.type]) == null ? void 0 : z.action) ?? "Start this ticket" }),
            en(J, null).map((A) => /* @__PURE__ */ u(
              "button",
              {
                type: "button",
                disabled: L,
                onClick: () => B(A.skill),
                title: kt[A.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: L ? "default" : "pointer", fontSize: y.small },
                children: [
                  "/",
                  A.skill,
                  " ",
                  /* @__PURE__ */ n("span", { style: q, children: A.label })
                ]
              },
              A.skill
            ))
          ] }),
          /* @__PURE__ */ n(zo, { detail: o, tile: J })
        ] })
      ) : /* @__PURE__ */ n(
        Go,
        {
          detail: o,
          focus: M,
          ticket: $,
          tile: null,
          starting: L,
          onStart: () => B(null),
          alternatives: en(null, M.kind === "column" ? o.column : null),
          onSkill: (A) => B(A)
        }
      ), T = J && o.frontier ? bt(o.frontier.tiles, J.number) : [], P = s ? Bn(
        /* @__PURE__ */ n(
          po,
          {
            detail: o,
            statuses: he,
            activity: we,
            busy: Q || L || !!b,
            autopilot: Oe,
            selectedKey: ie,
            embedded: !0,
            compact: g,
            onAutopilot: te,
            onOpenTile: F,
            onOpenConversation: (A) => j(A === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(A) ? { kind: "review", t: Number(A.slice(8)) } : { kind: "stage", column: A }),
            onSelectConductor: () => j({ kind: "column" }),
            onJumpQuestions: lt,
            onHandover: Ee,
            onReview: Ne,
            onRetro: nt,
            onClose: m
          }
        ),
        s
      ) : null;
      return /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        P,
        /* @__PURE__ */ u("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          h,
          J && T.length > 1 && Ue && /* @__PURE__ */ u(ge, { children: [
            /* @__PURE__ */ u("div", { ref: O.ref, style: { ...O.style }, children: [
              /* @__PURE__ */ n("div", { style: { padding: "6px 16px 0", fontSize: y.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ n(So, { tiles: T, focus: J.number, onOpen: F, labeled: !0, dimOthers: !1, statuses: he, down: !0 })
            ] }),
            /* @__PURE__ */ n(
              dn,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: O.onDrag,
                onReset: O.reset
              }
            )
          ] }),
          /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            D,
            /* @__PURE__ */ n(Co, { state: In, slotKey: X, settled: $n, onError: I, onSize: kn, bottomOffset: Rt + 10 }, X ?? "none")
          ] })
        ] })
      ] });
    })()
  ] });
}
function Zt(e) {
  const t = (g) => typeof g == "string" && /(^|_)kipo-/.test(g), i = (g) => g === e || g.endsWith(`_${e}`), r = (g) => t(g) ? g : g && typeof g == "object" && t(g.key) ? g.key : null, s = (g) => {
    let d = !1;
    if (Array.isArray(g))
      for (let f = g.length - 1; f >= 0; f--) {
        const c = r(g[f]);
        c !== null && !i(c) ? (g.splice(f, 1), d = !0) : s(g[f]) && (d = !0);
      }
    else if (g && typeof g == "object")
      for (const f of Object.values(g)) s(f) && (d = !0);
    return d;
  };
  for (const g of [window.localStorage, window.sessionStorage])
    try {
      for (const d of Object.keys(g)) {
        const f = g.getItem(d);
        if (!f || !f.includes("kipo-") || f[0] !== "[" && f[0] !== "{") continue;
        let c;
        try {
          c = JSON.parse(f);
        } catch {
          continue;
        }
        s(c) && g.setItem(d, JSON.stringify(c));
      }
    } catch {
    }
}
function Do(e) {
  const t = [...e.querySelectorAll("[data-session-window]")];
  if (t.length < 2) {
    for (const s of t) s.style.display === "none" && (s.style.display = "");
    return !1;
  }
  const i = t[t.length - 1];
  let r = !1;
  for (const s of t) {
    const g = s === i ? "" : "none";
    s.style.display !== g && (s.style.display = g, r = !0);
  }
  return r;
}
let Lo = 0;
const Bo = () => ++Lo;
let vt = null;
function jo(e) {
  vt = e, tt();
}
function tt() {
  try {
    const e = [...document.querySelectorAll("iframe[data-kipo-frame]")];
    let t = null, i = -1;
    if (vt !== null)
      for (const r of e) {
        if (r.getAttribute("data-kipo-frame") !== vt) continue;
        const s = Number(r.getAttribute("data-kipo-gen") ?? "0");
        s >= i && (i = s, t = r);
      }
    for (const r of e) {
      const s = r === t ? "" : "none";
      r.style.display !== s && (r.style.display = s);
    }
  } catch {
  }
}
function qo({ slotKey: e, frameRef: t, padBottom: i = 0, onComposerH: r }) {
  const s = `/popout/chat?sid=${encodeURIComponent(e)}`, g = pe(null), d = pe(i);
  d.current = i;
  const f = Ae(() => {
    var p;
    try {
      const o = (p = t.current) == null ? void 0 : p.contentDocument;
      if (!o) return;
      let a = o.getElementById("kipo-qcard-css");
      !a && o.head && (a = o.createElement("style"), a.id = "kipo-qcard-css", o.head.appendChild(a));
      const l = d.current ? ".followup-chip{display:none !important}" : "";
      if (a && a.textContent !== l && (a.textContent = l), r) {
        const I = o.querySelector('[data-testid="composer-dock-root"]') ?? o.querySelector('[data-testid="composer-dock"]'), M = I ? Math.round(I.getBoundingClientRect().height) : 0;
        M > 0 && r(M);
      }
      let S = g.current;
      if (!S || !S.isConnected || S.ownerDocument !== o) {
        const I = o.defaultView;
        S = [...o.querySelectorAll("div")].filter((j) => {
          if (j.clientHeight < 200) return !1;
          const L = I == null ? void 0 : I.getComputedStyle(j);
          return !!L && (L.overflowY === "auto" || L.overflowY === "scroll");
        }).sort((j, L) => L.clientHeight - j.clientHeight)[0] ?? null, g.current = S;
      }
      if (!S) return;
      const G = d.current ? `${d.current}px` : "";
      S.style.paddingBottom !== G && (S.style.paddingBottom = G);
    } catch {
    }
  }, [t]);
  U(() => {
    f();
  }, [f, i]), U(() => {
    Zt(e);
  }, [e]), U(() => {
    const p = t.current;
    return p && p.setAttribute("data-kipo-gen", String(Bo())), tt(), () => {
      requestAnimationFrame(tt);
    };
  }, [e, t]);
  const c = () => {
    var o;
    const p = t.current;
    try {
      const a = (o = p == null ? void 0 : p.contentWindow) == null ? void 0 : o.location.pathname;
      if (p && a && !a.startsWith("/popout/chat")) {
        p.src = s;
        return;
      }
      const l = p == null ? void 0 : p.contentDocument;
      if (l && !l.getElementById("kipo-popout-css")) {
        const S = l.createElement("style");
        S.id = "kipo-popout-css", S.textContent = [
          '[title*="main window" i]',
          '[aria-label*="main window" i]',
          '[title*="split view" i]',
          '[aria-label*="split view" i]',
          '[aria-label="Close panel"]',
          '[title="Close panel"]'
        ].join(",") + "{display:none !important}", l.head.appendChild(S);
      }
    } catch {
    }
  };
  return U(() => {
    const p = [], o = window.setInterval(() => {
      var l;
      const a = t.current;
      try {
        const S = (l = a == null ? void 0 : a.contentWindow) == null ? void 0 : l.location.pathname;
        if (a && S && !S.startsWith("/popout/chat")) {
          const I = Date.now();
          for (; p.length && I - p[0] > 6e5; ) p.shift();
          p.length < 5 && (p.push(I), Zt(e), a.src = s);
          return;
        }
        tt();
        const G = a == null ? void 0 : a.contentDocument;
        G && Do(G);
      } catch {
      }
      d.current && f();
    }, 2e3);
    return () => window.clearInterval(o);
  }, [s, e, t, f]), /* @__PURE__ */ n(
    "iframe",
    {
      ref: t,
      src: s,
      title: "The session in Kiro's chat",
      onLoad: c,
      "data-kipo-frame": e,
      style: { flex: 1, minHeight: 0, width: "100%", border: 0, background: "var(--bg)" }
    }
  );
}
const yn = {
  grilling: { what: "Grill", action: "Start the grill", body: "An interview with you to settle this decision. It updates GLOSSARY.md and the ADRs as answers land." },
  prototype: { what: "Prototype", action: "Start a prototype", body: "Throwaway code or an outline to react to, so the decision gets made against something concrete." },
  research: { what: "Research", action: "Run the research", body: "The agent reads primary sources and leaves a cited note on a research branch. No HITL (human-in-the-loop) step." },
  task: { what: "Task", action: "Start this task", body: "Work that has to happen before a decision can be made. The agent does what it can and hands you a checklist for the rest." },
  build: { what: "Build", action: "Implement this ticket", body: "/implement builds this ticket test-first in its own conversation, then reviews it." },
  issue: { what: "Issue", action: "Triage it", body: "A follow-up filed on the map. Triage moves it to an agent-ready brief, or asks you what it needs." }
};
function Go({ detail: e, focus: t, ticket: i, tile: r, starting: s, onStart: g, alternatives: d, onSkill: f }) {
  let c, p, o;
  if (r) {
    const a = yn[r.type];
    r.state === "done" ? (c = "Closed", p = r.sessionKey ? "Its conversation was closed when the ticket was. How it ended is on the right." : "How it ended is on the right.", o = null) : r.state === "blocked" ? (c = `Waiting on ${r.blockedBy.map((l) => `#${l}`).join(", ")}`, p = "It can start once those are closed.", o = null) : r.state === "review" ? (c = "In review", p = "Its PR is open. The effort's Review merges it once it's clean.", o = null) : (c = "No conversation yet", p = `${r.who === "you" ? "HITL (human in the loop): it needs you." : "Agent (AFK, away from keyboard): an agent can take it on its own."} ${a.body}`, o = a.action);
  } else if (t.kind === "ticket")
    i != null && i.blockedBy.length ? (c = `#${t.t} is waiting on ${i.blockedBy.map((a) => `#${a}`).join(", ")}`, p = "It can start once those are closed.", o = null) : (i == null ? void 0 : i.state) === "CLOSED" ? (c = `#${t.t} is closed`, p = "Nothing left to build on this ticket.", o = null) : (c = `Build #${t.t}`, p = "/implement builds this one ticket test-first in a fresh conversation, then reviews it.", o = "Implement this ticket");
  else if (t.kind === "spec")
    c = "Implement the whole spec", p = "/implement-spec builds every unblocked ticket in parallel on one integration branch, then one review.", o = "Run /implement-spec";
  else if (t.kind === "review")
    c = `Review #${t.t}`, p = "kipo-review reviews this ticket's PR, fixes what it finds, and merges it if it's a two-way door.", o = "Review this ticket";
  else if (t.kind === "decision")
    c = `Decision #${t.t}`, p = "Work through this decision ticket from the map in its own conversation.", o = "Start this decision";
  else if (t.kind === "column")
    c = "Start the conductor", p = "The conductor runs this effort: it reads the frontier from GitHub, starts one stage-skill conversation per open thread, asks you in one batched message, and closes the effort when the frontier is empty. It never does the work itself.", o = "Start the conductor";
  else {
    const a = t.column, l = a === "plan" && e.sessions.grill;
    c = `${ft[a]} hasn't started`, p = l ? "Plan continues the Grill conversation, so the spec and tickets are written with everything it learned." : `${qn[a]}`, o = l ? "Continue in the Grill conversation" : `Start ${ft[a]}`;
  }
  return /* @__PURE__ */ n("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ u("div", { style: { maxWidth: 400, textAlign: "center" }, children: [
    /* @__PURE__ */ n("div", { style: { ...ve, fontSize: y.title }, children: c }),
    /* @__PURE__ */ n("div", { style: { ...q, fontSize: y.body, margin: "6px 0 14px", lineHeight: 1.5 }, children: p }),
    /* @__PURE__ */ n("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }, children: o && /* @__PURE__ */ n(Se, { primary: !0, disabled: s, onClick: g, children: s ? "Starting…" : o }) }),
    o && d.map((a) => /* @__PURE__ */ u("div", { style: { marginTop: 10, fontSize: y.small }, children: [
      /* @__PURE__ */ n("span", { style: q, children: "or " }),
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          disabled: s,
          onClick: () => f(a.skill),
          title: kt[a.skill],
          style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: s ? "default" : "pointer", fontSize: y.small },
          children: [
            "/",
            a.skill
          ]
        }
      ),
      /* @__PURE__ */ u("span", { style: q, children: [
        " ",
        a.label
      ] })
    ] }, a.skill))
  ] }) });
}
function en(e, t) {
  return (e ? e.type === "grilling" : t === "grill") ? [{ skill: "grill-me", label: "without writing docs" }] : [];
}
function Ko({ skills: e }) {
  return /* @__PURE__ */ u("span", { style: { ...q, fontSize: y.tiny, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: [
    "Running",
    " ",
    e.map((t, i) => /* @__PURE__ */ u("span", { children: [
      i > 0 && " · ",
      /* @__PURE__ */ n("span", { title: kt[t] ?? t, style: { color: "var(--text)", cursor: "help" }, children: t })
    ] }, t))
  ] });
}
const _o = (e) => (e.closing ?? []).filter((t) => t.started === !1).map((t) => t.key);
function Fo(e) {
  const t = /^(build|shape|review)-t(\d+)$/.exec(e);
  return t ? { kind: t[1] === "build" ? "ticket" : t[1] === "shape" ? "decision" : "review", t: Number(t[2]) } : e === "build-spec" ? { kind: "spec" } : ["intake", "shape", "grill", "plan", "review", "done"].includes(e) ? { kind: "stage", column: e } : null;
}
const tn = (e, t) => Object.values(e.sessions).filter((i) => i === t).length > 1;
function Zo() {
  const e = On(), t = (e == null ? void 0 : e.active) !== !1, i = wt(), [r, s] = W(() => Ve("initiatives")), [g, d] = W(() => Ve("repos")), [f, c] = W(!1), [p, o] = W(""), [a, l] = W(() => {
    const $ = Ve("main");
    return !$ || !["new", "initiative"].includes($.kind) ? null : $.kind === "initiative" ? { ...$, autoStart: void 0 } : $;
  });
  U(() => {
    a && Ze("main", a);
  }, [a]);
  const [S, G] = cn("rail", 300, 168, 620), [I, M] = W(null), [j, L] = W(() => localStorage.getItem("kipo.railOpen") !== "0"), K = ($) => {
    L($), localStorage.setItem("kipo.railOpen", $ ? "1" : "0");
  };
  U(() => {
    Zn(i).catch(() => {
    });
  }, [i]);
  const [Q, N] = W(""), O = Ae(() => {
    le.listInitiatives().then(($) => {
      var B;
      s($.initiatives), Ze("initiatives", $.initiatives), d($.repos ?? []), Ze("repos", $.repos ?? []), o(""), N((B = $.errors) != null && B.length ? `GitHub is refusing calls for ${$.errors.length === 1 ? $.errors[0].repo.split("/").pop() : `${$.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch(($) => o(be($)));
  }, []);
  U(() => {
    if (O(), !t) return;
    const $ = setInterval(O, 15e3);
    return () => clearInterval($);
  }, [O, t]), U(() => {
    if (r === null) return;
    const $ = (a == null ? void 0 : a.kind) === "initiative" && !r.some((C) => C.repo === a.repo && C.number === a.number);
    if (a && !$) return;
    const B = r[0];
    l(B ? { kind: "initiative", repo: B.repo, number: B.number } : { kind: "new" });
  }, [r, a]);
  const x = ($, B) => l({ kind: "initiative", repo: $.repo, number: $.number, autoStart: B }), R = ($) => {
    s((B) => (B ?? []).filter((C) => !(C.repo === $.repo && C.number === $.number))), le.hide($.repo, $.number).then(O).catch((B) => {
      o(be(B)), O();
    });
  }, oe = ($) => {
    s((B) => (B ?? []).filter((C) => !(C.repo === $.repo && C.number === $.number))), le.removeInitiative($.repo, $.number).then(O).catch((B) => {
      o(be(B)), O();
    });
  }, ie = ($) => {
    d((B) => (B ?? []).filter((C) => C.slug !== $)), s((B) => (B ?? []).filter((C) => C.repo !== $)), le.removeRepo($).then(O).catch((B) => {
      o(be(B)), O();
    });
  }, ae = ($, B) => {
    Promise.allSettled(B.map((C) => le.unhide($, C))).then(O);
  }, X = (a == null ? void 0 : a.kind) === "initiative" ? `${a.repo}#${a.number}` : null;
  return /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    j ? /* @__PURE__ */ u(ge, { children: [
      /* @__PURE__ */ n(
        bo,
        {
          width: S,
          onCollapse: () => K(!1),
          items: r,
          repos: g,
          error: p,
          notice: Q,
          selected: X,
          spineSlot: M,
          onNew: () => l({ kind: "new" }),
          onAddRepo: () => c(!0),
          onRemoveRepo: ie,
          onRestore: ae,
          onSelect: ($) => x($),
          onHide: R,
          onRemove: oe
        }
      ),
      /* @__PURE__ */ n(dn, { direction: "vertical", label: "Resize the effort list", onDrag: ($) => G((B) => B + $), onReset: () => G(228) })
    ] }) : /* @__PURE__ */ n(
      vo,
      {
        items: r,
        selected: X,
        onNew: () => l({ kind: "new" }),
        onSelect: ($) => x($),
        onExpand: () => K(!0)
      }
    ),
    /* @__PURE__ */ u("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (a == null ? void 0 : a.kind) === "new" && /* @__PURE__ */ n("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ n(
        ko,
        {
          onStarted: ($) => {
            O(), x($, !0);
          },
          onCancel: r && r.length ? () => l(r[0] ? { kind: "initiative", repo: r[0].repo, number: r[0].number } : { kind: "new" }) : void 0
        }
      ) }),
      (a == null ? void 0 : a.kind) === "initiative" && /* @__PURE__ */ n(
        Po,
        {
          repo: a.repo,
          number: a.number,
          autoStart: a.autoStart,
          active: t,
          spineHost: j ? I : null,
          spineCompact: S < 340,
          onChanged: O,
          onRemoved: () => {
            O(), l(null);
          }
        },
        `${a.repo}#${a.number}`
      )
    ] }),
    f && /* @__PURE__ */ n(Jn, { onAdded: O, onClose: () => c(!1) })
  ] });
}
export {
  Zo as default
};
