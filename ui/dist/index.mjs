import { jsxs as u, jsx as o, Fragment as ve } from "react/jsx-runtime";
import { useAppApi as Ct, useAppInfo as Dn } from "@kirocrew/app-sdk";
import { useState as O, useCallback as Ee, useEffect as Y, useRef as ye, useLayoutEffect as Pn, useMemo as vt } from "react";
import { Btn as Te, Badge as Bt, MarkdownRenderer as wt } from "@kirocrew/app-sdk/ui";
import { X as Ln, FolderGit2 as cn, FolderOpen as Bn, MessageSquare as dn, ChevronRight as kt, Plus as qn, FolderPlus as jn, MoreHorizontal as qt, ExternalLink as jt, EyeOff as _n, Trash2 as _t, Map as Kn, PanelRight as Gn } from "lucide-react";
import { createPortal as Fn } from "react-dom";
const Yn = "/apps/kipo/api";
class xt extends Error {
  constructor(t, i, r) {
    super(i), this.name = "BackendError", this.status = t, this.code = r;
  }
}
async function le(e, t = "GET", i) {
  let r;
  try {
    r = await fetch(`${Yn}${e}`, {
      method: t,
      credentials: "include",
      headers: i === void 0 ? void 0 : { "Content-Type": "application/json" },
      body: i === void 0 ? void 0 : JSON.stringify(i)
    });
  } catch {
    throw new xt(0, "Couldn't reach the KiPo backend. Is the app running?", null);
  }
  const l = await r.text();
  let g;
  if (l.trim())
    try {
      g = JSON.parse(l);
    } catch {
      g = void 0;
    }
  if (!r.ok) {
    const f = g ?? {}, m = typeof f.error == "string" && f.error ? f.error : `The KiPo backend answered ${r.status}.`;
    throw new xt(r.status, m, typeof f.code == "string" ? f.code : null);
  }
  return g;
}
const Ce = (e, t) => {
  const [i, r] = e.split("/");
  return `/initiatives/${encodeURIComponent(i)}/${encodeURIComponent(r)}/${t}`;
}, fe = {
  getConfig: () => le("/config"),
  putConfig: (e) => le("/config", "PUT", e),
  discoverRepos: () => le("/repos/discover"),
  addRepo: (e) => le("/repos", "POST", { path: e }),
  removeRepo: (e) => le("/repos/remove", "POST", { slug: e }),
  browse: (e) => le(e ? `/browse?path=${encodeURIComponent(e)}` : "/browse"),
  listInitiatives: () => le("/initiatives"),
  startInitiative: (e) => le("/initiatives", "POST", e),
  getInitiative: (e, t) => le(Ce(e, t)),
  // Next along the path, or `to` a later column.
  advance: (e, t, i, r = null) => le(`${Ce(e, t)}/advance`, "POST", { force: i, to: r }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (e, t, i) => le(`${Ce(e, t)}/session`, "POST", { skill: null, ticket: null, mode: null, ...i }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (e, t, i) => le(`${Ce(e, t)}/sessions/started`, "POST", { key: i }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (e, t, i) => le(`${Ce(e, t)}/sessions/closed`, "POST", { keys: i }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (e, t, i) => le(`${Ce(e, t)}/sessions/activity`, "POST", { activity: i }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (e, t, i, r, l) => le(`${Ce(e, t)}/sessions/woken`, "POST", { key: i, stall: r, why: l }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (e, t, i) => le(`${Ce(e, t)}/skill`, "POST", { skill: i }),
  listSessions: () => le("/sessions"),
  tree: (e = !1) => le(e ? "/tree?completed=1" : "/tree"),
  // A background session's recent transcript, when the dashboard never opened
  // it as a page (so the embedded chat would be empty).
  sessionTail: (e, t = 60) => le(
    `/sessions/tail?slot=${encodeURIComponent(e)}&limit=${t}`
  ),
  // The green dot: on the sidebar or off. Nothing changes on GitHub.
  setOnSidebar: (e, t, i, r) => le("/sidebar", "POST", { repo: e, number: t, kind: i, on: r }),
  // Off the sidebar and back; nothing changes on GitHub.
  hide: (e, t) => le(`${Ce(e, t)}/hide`, "POST", {}),
  unhide: (e, t) => le(`${Ce(e, t)}/unhide`, "POST", {}),
  removeInitiative: (e, t) => le(`${Ce(e, t)}/remove`, "POST", {}),
  ticket: (e, t, i) => le(`${Ce(e, t)}/tickets/${i}`),
  frontier: (e, t) => le(`${Ce(e, t)}/frontier`),
  doc: (e, t, i) => le(`${Ce(e, t)}/doc?href=${encodeURIComponent(i)}`)
};
function $e(e) {
  return e instanceof Error ? e.message : String(e);
}
const ut = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Jn = {
  intake: "A raw issue, request or refactor candidate nobody has shaped yet.",
  shape: "Open questions: a wayfinder map, a prototype, research, a questionnaire waiting on someone.",
  grill: "An interview in progress. It updates GLOSSARY.md and adds ADRs.",
  plan: "A spec and the tickets that hang off it, with their blocking links.",
  build: "Tickets being built, or a branch with commits.",
  review: "A PR is open: the agent reviews it, fixes what it finds and merges it.",
  done: "Merged. /retro turns what went wrong into checks, standards and agent instructions."
}, Tt = {
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
}, Un = ["intake", "decide", "deliver", "done"], Qn = { intake: "Intake", decide: "Decide", deliver: "Deliver", done: "Done" }, Xn = {
  intake: ["intake"],
  decide: ["shape", "grill", "plan"],
  deliver: ["build", "review"],
  done: ["done"]
}, Vn = (e) => Un.find((t) => Xn[t].includes(e)) ?? "intake", pt = (e) => !e.answer && typeof e.title == "string" && e.title.trim() !== "", v = {
  body: 13,
  small: 12,
  tiny: 11,
  title: 15
}, ct = {
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: v.body,
  width: "100%",
  minWidth: 0
}, _ = { color: "var(--muted)" }, Re = { color: "var(--text-strong, var(--text))", fontWeight: 600 };
function Ge({ children: e }) {
  return e ? /* @__PURE__ */ o(
    "div",
    {
      role: "alert",
      style: {
        background: "var(--danger-subtle)",
        color: "var(--danger-text)",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: v.body
      },
      children: e
    }
  ) : null;
}
function un({ path: e }) {
  return /* @__PURE__ */ o(
    "code",
    {
      title: e,
      style: {
        background: "var(--bg-elevated)",
        color: "var(--text)",
        fontSize: v.tiny,
        borderRadius: 4,
        padding: "1px 5px",
        wordBreak: "break-all",
        fontFamily: "var(--font-mono, ui-monospace, monospace)"
      },
      children: e
    }
  );
}
function Kt({ children: e, onClick: t, disabled: i, primary: r, danger: l, title: g }) {
  const f = r ? "var(--accent)" : l ? "var(--danger-subtle)" : "var(--bg-elevated)", m = r ? "var(--accent-fg, #fff)" : l ? "var(--danger-text)" : "var(--text)";
  return /* @__PURE__ */ o(
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
        fontSize: v.body,
        fontWeight: r ? 600 : 500,
        lineHeight: "28px",
        borderRadius: 6,
        border: r ? "1px solid transparent" : "1px solid var(--border)",
        background: f,
        color: m,
        cursor: i ? "default" : "pointer",
        opacity: i ? 0.5 : 1
      },
      children: e
    }
  );
}
function gt({ title: e, aside: t, children: i, defaultOpen: r = !0 }) {
  const [l, g] = O(r);
  return /* @__PURE__ */ u("section", { style: { borderTop: "1px solid var(--border)" }, children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        onClick: () => g((f) => !f),
        "aria-expanded": l,
        style: {
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          fontSize: v.small
        },
        children: [
          /* @__PURE__ */ o("span", { "aria-hidden": !0, style: { ..._, width: 10, fontSize: 9 }, children: l ? "▾" : "▸" }),
          /* @__PURE__ */ o("span", { style: Re, children: e }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          t != null && /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.tiny }, children: t })
        ]
      }
    ),
    l && /* @__PURE__ */ o("div", { style: { padding: "0 12px 10px 28px", fontSize: v.body }, children: i })
  ] });
}
function Gt(e) {
  const t = Date.parse(e);
  if (Number.isNaN(t)) return "";
  const i = Math.max(0, Math.round((Date.now() - t) / 1e3));
  if (i < 60) return "just now";
  const r = Math.round(i / 60);
  if (r < 60) return `${r} min ago`;
  const l = Math.round(r / 60);
  if (l < 24) return `${l} h ago`;
  const g = Math.round(l / 24);
  return g < 30 ? `${g} d ago` : new Date(t).toLocaleDateString();
}
function St({ kind: e, map: t }) {
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
function pn({ busy: e, onAdd: t, actionLabel: i = "Add" }) {
  var d;
  const [r, l] = O(null), [g, f] = O(""), m = Ee(async (s) => {
    f("");
    try {
      l(await fe.browse(s));
    } catch (p) {
      f($e(p));
    }
  }, []);
  return Y(() => {
    m();
  }, [m]), /* @__PURE__ */ u(
    "div",
    {
      className: "rounded-md p-3 mb-3",
      style: { background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ o(Ge, { children: g }),
        r ? /* @__PURE__ */ u(ve, { children: [
          /* @__PURE__ */ u("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ o(Te, { disabled: !r.parent, onClick: () => r.parent && m(r.parent), children: "Up" }),
            /* @__PURE__ */ o(un, { path: r.path }),
            ((d = r.here) == null ? void 0 : d.slug) && /* @__PURE__ */ u(Te, { primary: !0, disabled: e === r.path, onClick: () => t(r.path), children: [
              i,
              " this folder"
            ] })
          ] }),
          /* @__PURE__ */ u("ul", { className: "flex flex-col max-h-72 overflow-y-auto", children: [
            r.folders.map((s) => /* @__PURE__ */ u("li", { className: "flex items-center gap-2 py-1", children: [
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  className: "text-sm text-left flex-1 truncate hover:underline",
                  style: { background: "transparent", color: "var(--text)" },
                  onClick: () => m(s.path),
                  children: s.name
                }
              ),
              s.repo && (s.slug ? /* @__PURE__ */ u(ve, { children: [
                /* @__PURE__ */ o(Bt, { variant: "aim", children: s.slug }),
                /* @__PURE__ */ o(Te, { primary: !0, disabled: e === s.path, onClick: () => t(s.path), children: i })
              ] }) : /* @__PURE__ */ o(Bt, { variant: "muted", children: "no GitHub remote" }))
            ] }, s.path)),
            r.folders.length === 0 && /* @__PURE__ */ o("li", { className: "text-sm text-muted", children: "No folders here." })
          ] })
        ] }) : /* @__PURE__ */ o("p", { className: "text-sm text-muted", children: "Opening your home folder…" })
      ]
    }
  );
}
function Zn({ onAdded: e, onClose: t }) {
  const [i, r] = O(null), [l, g] = O(""), [f, m] = O(!1), [d, s] = O(null);
  Y(() => {
    let n = !0;
    return fe.tree().then((c) => {
      n && r(c.available);
    }).catch((c) => {
      n && (r([]), g($e(c)));
    }), () => {
      n = !1;
    };
  }, []), Y(() => {
    const n = (c) => {
      c.key === "Escape" && t();
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [t]);
  const p = async (n) => {
    s(n), g("");
    try {
      await fe.addRepo(n), e(), t();
    } catch (c) {
      g($e(c));
    } finally {
      s(null);
    }
  };
  return /* @__PURE__ */ o(
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
          onClick: (n) => n.stopPropagation(),
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
                /* @__PURE__ */ o("div", { style: { ...Re, fontSize: v.body }, children: "Add a repo" }),
                /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.tiny, marginTop: 1 }, children: "It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed." })
              ] }),
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  onClick: t,
                  "aria-label": "Close",
                  style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "inline-flex" },
                  children: /* @__PURE__ */ o(Ln, { size: 15 })
                }
              )
            ] }),
            /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 14px" }, children: [
              /* @__PURE__ */ o(Ge, { children: l }),
              i === null && /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small, padding: "6px 6px" }, children: "Looking for checkouts on this Mac…" }),
              i !== null && i.length > 0 && !f && /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column" }, children: i.slice(0, 12).map((n) => /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  disabled: !!d,
                  onClick: () => void p(n.path),
                  title: n.path,
                  onMouseEnter: (c) => {
                    c.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.06))";
                  },
                  onMouseLeave: (c) => {
                    c.currentTarget.style.background = "transparent";
                  },
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 8px",
                    borderRadius: 6,
                    background: "transparent",
                    color: "var(--text)",
                    cursor: d ? "default" : "pointer",
                    textAlign: "left"
                  },
                  children: [
                    /* @__PURE__ */ o(cn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: d === n.path ? "Adding…" : n.slug }),
                    n.maps > 0 && /* @__PURE__ */ u("span", { style: { ..._, fontSize: v.tiny, flexShrink: 0 }, children: [
                      n.maps,
                      " open map",
                      n.maps === 1 ? "" : "s"
                    ] })
                  ]
                },
                n.path
              )) }),
              i !== null && i.length === 0 && !f && /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small, padding: "6px 6px" }, children: "No un-added checkouts found under your home folder. Browse for one:" }),
              f ? /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(pn, { busy: d, onAdd: (n) => void p(n) }) }) : /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  onClick: () => m(!0),
                  onMouseEnter: (n) => {
                    n.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.06))";
                  },
                  onMouseLeave: (n) => {
                    n.currentTarget.style.background = "transparent";
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
                    fontSize: v.small
                  },
                  children: [
                    /* @__PURE__ */ o(Bn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    "Browse for a folder…"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ o("div", { style: { display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderTop: "1px solid var(--border)" }, children: /* @__PURE__ */ o(Te, { onClick: t, children: "Cancel" }) })
          ]
        }
      )
    }
  );
}
const hn = "kipo.layout.v1";
function Ft() {
  try {
    return JSON.parse(localStorage.getItem(hn) || "{}");
  } catch {
    return {};
  }
}
function fn(e, t, i, r) {
  const l = Ee((d) => Math.round(Math.min(r, Math.max(i, d))), [i, r]), [g, f] = O(() => {
    const d = Ft()[e];
    return l(typeof d == "number" ? d : t);
  });
  Y(() => {
    const d = Ft();
    d[e] = g;
    try {
      localStorage.setItem(hn, JSON.stringify(d));
    } catch {
    }
  }, [e, g]);
  const m = Ee((d) => {
    f((s) => l(typeof d == "function" ? d(s) : d));
  }, [l]);
  return [g, m];
}
function gn({ direction: e, onDrag: t, onReset: i, label: r }) {
  const l = ye(null), [g, f] = O(!1), [m, d] = O(!1), s = e === "vertical", p = (C) => s ? C.clientX : C.clientY;
  Y(() => {
    if (!g) return;
    const C = (N) => {
      if (l.current == null) return;
      const q = p(N), D = q - l.current;
      D && (l.current = q, t(D));
    }, j = () => {
      l.current = null, f(!1);
    };
    return window.addEventListener("pointermove", C), window.addEventListener("pointerup", j), window.addEventListener("pointercancel", j), () => {
      window.removeEventListener("pointermove", C), window.removeEventListener("pointerup", j), window.removeEventListener("pointercancel", j);
    };
  }, [g, t]);
  const n = (C) => {
    C.preventDefault(), l.current = p(C), f(!0);
  }, c = (C) => {
    const j = C.shiftKey ? 40 : 10, N = s ? "ArrowLeft" : "ArrowUp", q = s ? "ArrowRight" : "ArrowDown";
    C.key === N && (C.preventDefault(), t(-j)), C.key === q && (C.preventDefault(), t(j));
  }, I = g || m, B = s ? { width: 9, margin: "0 -4px", cursor: "col-resize", alignSelf: "stretch" } : { height: 9, margin: "-4px 0", cursor: "row-resize", width: "100%" };
  return /* @__PURE__ */ u(
    "div",
    {
      role: "separator",
      "aria-orientation": s ? "vertical" : "horizontal",
      "aria-label": r,
      tabIndex: 0,
      title: `${r}. Drag to resize, double-click to reset.`,
      onPointerDown: n,
      onPointerEnter: () => d(!0),
      onPointerLeave: () => d(!1),
      onDoubleClick: i,
      onKeyDown: c,
      style: { ...B, flexShrink: 0, position: "relative", zIndex: 2, touchAction: "none", display: "flex", justifyContent: "center", alignItems: "center" },
      children: [
        /* @__PURE__ */ o(
          "span",
          {
            "aria-hidden": !0,
            style: s ? { width: I ? 3 : 1, height: "100%", borderRadius: 2, background: I ? "var(--accent)" : "var(--border)", transition: "width .1s" } : { height: I ? 3 : 1, width: "100%", borderRadius: 2, background: I ? "var(--accent)" : "var(--border)", transition: "height .1s" }
          }
        ),
        /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
          position: "absolute",
          borderRadius: 3,
          background: I ? "var(--accent)" : "var(--border)",
          ...s ? { width: 5, height: 28, top: "calc(50% - 14px)" } : { height: 5, width: 28, left: "calc(50% - 14px)" }
        } }),
        g && /* @__PURE__ */ o("div", { style: { position: "fixed", inset: 0, zIndex: 9999, cursor: s ? "col-resize" : "row-resize" } })
      ]
    }
  );
}
function eo(e, t, i = 0.75) {
  const [r, l] = fn(e, 0, 0, 4e3), g = ye(null), f = Ee((d) => {
    const s = Math.round(window.innerHeight * i);
    l((p) => {
      var c;
      const n = p || ((c = g.current) == null ? void 0 : c.offsetHeight) || t;
      return Math.max(t, Math.min(s, n + d));
    });
  }, [t, i, l]), m = r ? { flex: `0 0 ${r}px`, minHeight: 0, overflowY: "auto" } : { flex: "0 1 auto", minHeight: 0, maxHeight: `${Math.round(i * 100)}%`, overflowY: "auto" };
  return { ref: g, style: m, onDrag: f, reset: () => l(0) };
}
const zt = "kipo.cache.v3:";
try {
  for (let e = localStorage.length - 1; e >= 0; e--) {
    const t = localStorage.key(e);
    t && t.startsWith("kipo.cache.") && !t.startsWith(zt) && localStorage.removeItem(t);
  }
} catch {
}
const dt = /* @__PURE__ */ new Map();
function it(e) {
  if (dt.has(e)) return dt.get(e);
  try {
    const t = localStorage.getItem(zt + e);
    if (t == null) return null;
    const i = JSON.parse(t);
    return dt.set(e, i), i;
  } catch {
    return null;
  }
}
function rt(e, t) {
  dt.set(e, t);
  try {
    localStorage.setItem(zt + e, JSON.stringify(t));
  } catch {
  }
}
const to = "KiPo", Yt = "kipo.sessionsFiled.v2", no = (e) => {
  var i;
  const t = (e == null ? void 0 : e.id) ?? ((i = e == null ? void 0 : e.folder) == null ? void 0 : i.id);
  if (!t) throw new Error("the sidebar didn't return the new folder");
  return t;
};
async function mn(e, t, i, r) {
  const l = await e.get("/api/chat/folders"), g = l == null ? void 0 : l.find((f) => f.name === t && (f.parent_id || null) === i);
  return g ? g.id : no(await e.post("/api/chat/folders", {
    name: t,
    ...i ? { parent_id: i } : {},
    ...r ? { icon: r } : {}
  }));
}
const oo = (e) => mn(e, to, null, "⚗️"), io = (e) => e.split("/").pop() || e;
async function yn(e, t) {
  const i = await oo(e);
  try {
    return await mn(e, io(t), i);
  } catch {
    return i;
  }
}
async function ro(e) {
  if (localStorage.getItem(Yt)) return;
  const { byRepo: t } = await fe.listSessions(), i = /* @__PURE__ */ new Map();
  for (const { repo: r } of t ?? [])
    i.has(r) || i.set(r, await yn(e, r));
  await Promise.all((t ?? []).map(
    ({ slot: r, repo: l }) => e.patch(`/api/chat/slots/${encodeURIComponent(r)}/folder`, { folder_id: i.get(l) }).catch(() => {
    })
    // a session that was closed or deleted is simply skipped
  )), localStorage.setItem(Yt, (/* @__PURE__ */ new Date()).toISOString());
}
const bn = {
  position: "fixed",
  zIndex: 99999,
  background: "var(--bg-elevated, #2a2a2a)",
  border: "1px solid var(--border, rgba(255,255,255,0.15))",
  borderRadius: 6,
  boxShadow: "0 4px 12px var(--shadow, rgba(0,0,0,0.5))"
};
function vn(e, t, i) {
  const r = ye(null), [l, g] = O({ x: e, y: t });
  return Pn(() => {
    const f = r.current;
    if (!f) return;
    const m = f.getBoundingClientRect();
    g({
      x: e + m.width > window.innerWidth ? Math.max(0, e - m.width) : e,
      y: t + m.height > window.innerHeight ? Math.max(0, t - m.height) : t
    });
  }, [e, t]), Y(() => {
    const f = (s) => {
      r.current && !r.current.contains(s.target) && i();
    }, m = (s) => {
      s.key === "Escape" && i();
    }, d = setTimeout(() => {
      window.addEventListener("mousedown", f, !0), window.addEventListener("keydown", m, !0), window.addEventListener("blur", i);
    }, 50);
    return () => {
      clearTimeout(d), window.removeEventListener("mousedown", f, !0), window.removeEventListener("keydown", m, !0), window.removeEventListener("blur", i);
    };
  }, [i]), { ref: r, pos: l };
}
function Jt({ x: e, y: t, items: i, onClose: r }) {
  const { ref: l, pos: g } = vn(e, t, r);
  return Y(() => {
    var f, m;
    (m = (f = l.current) == null ? void 0 : f.querySelector("[role=menuitem]")) == null || m.focus();
  }, [l]), /* @__PURE__ */ o("div", { ref: l, role: "menu", style: { ...bn, left: g.x, top: g.y, padding: "4px 0", minWidth: 160 }, children: i.map((f, m) => {
    if ("separator" in f)
      return /* @__PURE__ */ o("div", { role: "separator", style: { height: 1, background: "var(--border, rgba(255,255,255,0.15))", margin: "2px 0" } }, `sep-${m}`);
    const d = f.icon, s = () => {
      r(), f.onSelect();
    };
    return /* @__PURE__ */ o(
      "div",
      {
        role: "menuitem",
        tabIndex: 0,
        onClick: (p) => {
          p.stopPropagation(), s();
        },
        onKeyDown: (p) => {
          (p.key === "Enter" || p.key === " ") && (p.preventDefault(), s());
        },
        onMouseEnter: (p) => {
          p.currentTarget.style.background = "rgba(255,255,255,0.1)";
        },
        onMouseLeave: (p) => {
          p.currentTarget.style.background = "transparent";
        },
        style: {
          padding: "6px 16px",
          fontSize: 12,
          cursor: "pointer",
          outline: "none",
          color: f.danger ? "var(--danger, #f38ba8)" : "var(--text, #e0e0e0)"
        },
        children: /* @__PURE__ */ u("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ o("span", { style: { width: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.85 }, children: d ? /* @__PURE__ */ o(d, { size: 13 }) : null }),
          f.label
        ] })
      },
      f.label
    );
  }) });
}
function mt({ x: e, y: t, title: i, children: r, action: l, onConfirm: g, onClose: f }) {
  const { ref: m, pos: d } = vn(e, t, f);
  return /* @__PURE__ */ u(
    "div",
    {
      ref: m,
      role: "alertdialog",
      "aria-label": i,
      style: { ...bn, left: d.x, top: d.y, padding: "12px 14px", width: 280 },
      children: [
        /* @__PURE__ */ o("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e0e0e0)", lineHeight: 1.35 }, children: i }),
        r && /* @__PURE__ */ o("div", { style: { fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6, lineHeight: 1.45 }, children: r }),
        /* @__PURE__ */ u("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ o(Te, { onClick: f, children: "Cancel" }),
          /* @__PURE__ */ o(Te, { danger: !0, onClick: () => {
            f(), g();
          }, children: l })
        ] })
      ]
    }
  );
}
const so = {
  Gr: "Gr = Grilling: a decision ticket, settled by an interview with you (HITL)",
  Pr: "Pr = Prototype: a decision ticket, settled by building something throwaway to react to",
  Rs: "Rs = Research: a decision ticket, settled by an agent reading primary sources",
  Tk: "Tk = Task: a decision-side ticket of plain work on the wayfinder map",
  Bd: "Bd = Build: a spec ticket that ships code (Deliver)",
  Is: "Is = Issue: the source issue, or a plain follow-up filed on the map"
}, Je = {
  you: "HITL = human in the loop: open, unblocked, and it needs a person",
  afk: "Agent (AFK = away from keyboard): open, unblocked, and an agent can take it on its own",
  building: "In progress: an agent is building it",
  review: "In review: its pull request is open",
  blocked: "Blocked: waiting on a ticket that is still open",
  done: "Done: closed",
  fog: "Fog: in scope but not yet specified — listed in the map's Not yet specified section, not a ticket yet"
}, ht = {
  HITL: Je.you,
  AFK: Je.afk,
  Agent: Je.afk,
  PR: "PR = pull request on GitHub",
  Fog: Je.fog,
  Decide: "Decide: the wayfinder map — decision tickets that settle what to build",
  Deliver: "Deliver: the spec tickets — the work that ships it",
  Origin: "Origin: the issue the effort started from",
  "hand-over": "Hand-over: the spec tickets were cut from the decided wayfinder map",
  spec: "Spec tickets: the build tickets cut from the spec, labelled kipo:<effort number>",
  kipo: "kipo:<n>: the label that ties a ticket to effort #<n>",
  map: "Wayfinder map: the issue that lists the effort’s decision tickets and its fog"
}, lo = (e) => [so[e.code], Je[e.state]].filter(Boolean).join(`
`);
function ao({ term: e, title: t, children: i }) {
  return /* @__PURE__ */ o(
    "abbr",
    {
      title: t ?? (e ? ht[e] : void 0),
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
function Ut({ tile: e, onClick: t, size: i = 34, open: r, status: l, bare: g, numberOnly: f, width: m }) {
  const d = E[e.state], s = e.state !== "blocked", p = e.state === "done", n = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((I) => `#${I}`).join(", ")}` : `#${e.number} ${e.title}: ${d.label}`;
  return /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      onClick: t,
      title: `${n}${l === "running" ? " · agent working" : l === "attention" ? " · needs you: a trust prompt or question" : l === "waiting" ? " · awaiting input" : ""}

${lo(e)}`,
      "aria-current": r ? "true" : void 0,
      style: {
        position: "relative",
        width: m ?? i,
        height: f ? i : i + 6,
        flexShrink: 0,
        borderRadius: 6,
        padding: 0,
        outline: r ? "2px solid var(--text-strong, #fff)" : void 0,
        outlineOffset: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: t ? "pointer" : "default",
        fontWeight: f ? 700 : 800,
        fontSize: f ? 11 : 13,
        fontVariantNumeric: "tabular-nums",
        background: p ? "rgba(63,174,106,.22)" : s ? d.color : "transparent",
        color: p ? "#7fd39a" : s ? "#14121c" : "var(--muted)",
        border: s ? "1px solid transparent" : `1.5px solid ${d.color}`
      },
      children: [
        f ? e.number : /* @__PURE__ */ u(ve, { children: [
          !g && /* @__PURE__ */ o("span", { style: { position: "absolute", top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }, children: e.number }),
          e.code
        ] }),
        l && // Inside the tile's top-right corner, in the tile's own text color so it
        // reads on every tile color: pulsing while the agent works or needs
        // you (trust prompt, question), steady when merely waiting.
        /* @__PURE__ */ o(
          "span",
          {
            className: l === "running" || l === "attention" ? "kipo-pulse" : void 0,
            style: {
              position: "absolute",
              top: f ? 2 : 4,
              right: f ? 2 : 4,
              width: f ? 5 : 6,
              height: f ? 5 : 6,
              borderRadius: 999,
              background: "currentColor"
            }
          }
        )
      ]
    }
  );
}
async function co(e, t, i, r, l, g) {
  let f;
  try {
    f = await yn(e, t);
  } catch {
    f = void 0;
  }
  const m = await e.post("/api/chat/slots", {
    name: i,
    title: l,
    ...f ? { folder_id: f } : {},
    // The app's own agent for this session (the conductor); the default agent otherwise.
    ...g ? { agent: g } : {}
  }), d = (m == null ? void 0 : m.key) || i;
  return await e.post("/api/chat?ws=1", { slot: d, message: r }), d;
}
const wn = "kipo.closedSessions.v1", Pe = (e) => !!e && At().has(e);
function At() {
  try {
    return new Set(JSON.parse(localStorage.getItem(wn) || "[]"));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function $t(e) {
  const t = At();
  t.add(e);
  try {
    localStorage.setItem(wn, JSON.stringify([...t].slice(-500)));
  } catch {
  }
}
async function Qt(e, t) {
  try {
    await e.del(`/api/chat/slots/${encodeURIComponent(t)}`);
  } catch (i) {
    if (!/404|not.?found/i.test(String((i == null ? void 0 : i.message) ?? i))) return !1;
  }
  return $t(t), !0;
}
async function Xt(e, t, i) {
  const r = At(), l = [];
  for (const g of t)
    if (!(!g || g === i)) {
      if (r.has(g)) {
        l.push(g);
        continue;
      }
      try {
        const f = await e.get(`/api/chat/slots/${encodeURIComponent(g)}?limit=1`);
        if (f != null && f.running) continue;
        await e.del(`/api/chat/slots/${encodeURIComponent(g)}`), $t(g), l.push(g);
      } catch (f) {
        /404|not.?found/i.test(String((f == null ? void 0 : f.message) ?? f)) && ($t(g), l.push(g));
      }
    }
  return l;
}
const uo = [
  { id: "intake", label: "Intake", skill: "kipo-intake", matt: ["setup-matt-pocock-skills", "ask-matt", "triage", "improve-codebase-architecture"], what: "Set the repo up, triage the issue, pick a start" },
  { id: "shape", label: "Shape", skill: "kipo-shape", matt: ["wayfinder", "research", "prototype", "to-questionnaire"], any: ["handoff", "teach"], what: "Huge, foggy: chart the map, work its decision tickets" },
  { id: "grill", label: "Grill", skill: "kipo-grill", matt: ["grill-with-docs", "grill-me", "grilling", "domain-modeling"], any: ["wait-what"], what: "An idea: interview until it's sharp" },
  { id: "plan", label: "Plan", skill: "kipo-plan", matt: ["to-spec", "to-tickets", "codebase-design"], what: "Hand-over: spec, then tickets" },
  { id: "build", label: "Build", skill: "kipo-build", matt: ["implement", "implement-spec", "tdd", "diagnosing-bugs", "wizard"], what: "One ticket per session, test-first, open a PR" },
  { id: "review", label: "Review", skill: "kipo-review", matt: ["code-review", "pr"], what: "Review, then merge by Merge Danger" },
  { id: "done", label: "Done", skill: "kipo-done", matt: ["retro", "writing-for-agents"], what: "Retro the run, tidy the docs" }
], po = (e) => e.state === "done" ? "done" : e.source ? "intake" : e.state === "review" ? "review" : e.type === "build" ? "build" : e.type === "grilling" ? "grill" : "shape";
function ho(e) {
  const t = (p, n = 0) => p.you ? { color: E.you.color, active: !0 } : p.blocked ? { color: E.blocked.color, active: !0 } : p.building ? { color: E.building.color, active: !0 } : p.afk ? { color: E.afk.color, active: !0 } : p.review ? { color: E.review.color, active: !0 } : n ? { color: "var(--muted)", active: !0 } : p.done ? { color: E.done.color, active: !1 } : { color: null, active: !1 }, i = [
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
  ], r = { intake: "Intake", shape: "Shape", grill: "Grill", plan: "Plan", build: "Build", review: "Review", done: "Done" }, l = [...i].reverse().find((p) => p.active), g = l ? r[l.id] : e.total || e.prs.merged ? "Done" : "—", f = e.intake.you + e.shape.you + e.grill.you + e.build.you + (e.handover ? 1 : 0) + (e.landed && !e.retro ? 1 : 0), m = e.shape.building + e.grill.building + e.build.building + e.intake.building, d = e.shape.afk + e.grill.afk + e.build.afk + e.intake.afk, s = [
    e.doneTiles ? `${e.doneTiles}/${e.total} done` : "",
    f ? `${f} HITL` : "",
    m ? `${m} in agents` : "",
    d ? `${d} ready` : "",
    e.prs.open ? `${e.prs.open} PR${e.prs.open === 1 ? "" : "s"}` : "",
    e.fog ? `${e.fog} fog` : ""
  ].filter(Boolean);
  return { segs: i, front: g, bits: s.slice(0, 4).join(" · ") };
}
function fo({ glance: e }) {
  return /* @__PURE__ */ o("span", { style: { display: "flex", gap: 2, height: 5 }, "aria-hidden": !0, children: e.segs.map((t) => /* @__PURE__ */ o("span", { title: t.id, style: {
    flex: 1,
    borderRadius: 3,
    background: t.color ?? "transparent",
    border: t.color ? "1px solid transparent" : "1px solid var(--border)",
    opacity: t.color && !t.active ? 0.75 : 1
  } }, t.id)) });
}
const nt = ["intake", "shape", "grill", "plan", "build", "review", "done"], go = { idea: "grill", small: "grill", huge: "shape", issue: "intake", bug: "build" }, mo = { idea: "an idea", small: "small", huge: "huge", issue: "an issue", bug: "a bug" }, Vt = {
  intake: "source issues",
  shape: "map tickets",
  grill: "questions",
  plan: "spec → tickets",
  build: "tickets",
  review: "PRs",
  done: "merged · retro"
}, st = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Ve = (e, t) => ({ n: e, color: E[t].color });
function yo(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function bo({ detail: e, statuses: t, activity: i, busy: r, autopilot: l, selectedKey: g, embedded: f, compact: m, onAutopilot: d, onOpenTile: s, onOpenConversation: p, onSelectConductor: n, onJumpQuestions: c, onHandover: I, onReview: B, onRetro: C, onClose: j }) {
  var De, He, he, Ze, qe;
  const [N, q] = O(!1), D = (y) => {
    var ee, U;
    return y ? (((U = (ee = e.sessionStates) == null ? void 0 : ee[y]) == null ? void 0 : U.decisions) ?? []).filter(pt).length : 0;
  }, te = (((He = ((De = e.sessionStates) == null ? void 0 : De.conductor) ?? e.state) == null ? void 0 : He.decisions) ?? []).filter(pt).length, oe = (y) => ({ label: y === 1 ? "1 question" : `${y} questions`, color: E.you.color }), S = e.frontier, $ = (S == null ? void 0 : S.tiles) ?? [], W = (he = S == null ? void 0 : S.fogItems) != null && he.length ? S.fogItems : (S == null ? void 0 : S.fogLeft) ?? [], K = !((Ze = S == null ? void 0 : S.fogItems) != null && Ze.length) && !!((qe = S == null ? void 0 : S.fogLeft) != null && qe.length), ie = new Map(nt.map((y) => [y, []]));
  for (const y of $) ie.get(po(y)).push(y);
  const re = (y) => y.source ? "intake" : y.type === "build" ? "build" : y.type === "grilling" ? "grill" : "shape", ge = new Map(nt.map((y) => [y, []]));
  for (const y of $) ge.get(re(y)).push(y);
  const X = go[e.start] ?? "grill", ue = nt.indexOf(X), F = ge.get("build"), b = e.artifacts.find((y) => y.label === "Spec" || y.label.startsWith("Spec")), M = e.prs.filter((y) => y.state === "OPEN"), P = e.prs.filter((y) => y.state === "MERGED"), H = $.filter((y) => y.state === "done").length, de = !!e.sessions.done, G = (y) => {
    var _e;
    const ee = y.state !== "done" ? D(y.sessionKey) : 0, U = t[y.number], Q = U === "attention" ? ((_e = i == null ? void 0 : i[y.number]) == null ? void 0 : _e.needs) ?? null : null, Ue = U === "running" || U === "attention", xe = U === "attention" || ee > 0 || y.state === "you";
    return {
      key: `t${y.number}`,
      number: y.number,
      title: y.title,
      tile: y,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: ee ? oe(ee) : Q === "approval" ? { label: "trust prompt", color: E.you.color } : Q === "input" ? { label: "asking", color: E.you.color } : { label: E[y.state].label, color: y.state === "done" ? E.done.text : E[y.state].color, solid: y.state === "you" || y.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Ue || xe,
      attention: xe,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Ue ? i == null ? void 0 : i[y.number] : void 0,
      questions: ee,
      selKeys: [`build-t${y.number}`, `shape-t${y.number}`, `review-t${y.number}`]
    };
  }, se = (y) => {
    const ee = (U) => y.filter((Q) => Q.state === U).length;
    return { done: ee("done"), you: ee("you"), afk: ee("afk"), building: ee("building"), review: ee("review"), blocked: ee("blocked") };
  }, J = (y) => {
    const ee = ["you", "building", "afk", "review", "blocked", "done"];
    return [...y].sort((U, Q) => ee.indexOf(U.state) - ee.indexOf(Q.state) || U.number - Q.number);
  }, we = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, Oe = (y) => {
    const ee = e.sessions[y];
    if (!ee || Pe(ee)) return [];
    const U = D(y);
    return [{
      key: `conv-${y}`,
      title: we[y] ?? "Its conversation",
      chip: U ? oe(U) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => p(y),
      questions: U,
      selKeys: [y]
    }];
  }, me = nt.map((y) => {
    const ee = ge.get(y), U = Oe(y === "build" ? "build-spec" : y);
    if (y === "plan") {
      if (F.length || b)
        return { id: y, state: "full", count: /* @__PURE__ */ u(ve, { children: [
          /* @__PURE__ */ o("b", { style: Re, children: "1 spec" }),
          " → ",
          F.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: E.done.color }], rows: U };
      if (S != null && S.handover)
        return {
          id: y,
          state: "live",
          count: /* @__PURE__ */ o("b", { style: { color: E.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: E.you.color }],
          rows: U,
          // Once the conversation exists, its row above is the way back in.
          action: U.length ? void 0 : { label: "Write the spec", onClick: I }
        };
      const ae = $.filter((Se) => Se.lane === "decide" && Se.state !== "done").length;
      return { id: y, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${ae || "the"} decision${ae === 1 ? "" : "s"}${W.length ? ` and ${W.length} fog` : ""}`, segments: [], rows: U };
    }
    if (y === "review")
      return !M.length && !P.length && !U.length ? { id: y, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: y,
        state: M.length ? "live" : "full",
        count: /* @__PURE__ */ u(ve, { children: [
          /* @__PURE__ */ u("b", { style: Re, children: [
            P.length,
            " merged"
          ] }),
          M.length ? /* @__PURE__ */ u(ve, { children: [
            " · ",
            M.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: P.length, color: E.done.color }, { n: M.length, color: E.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...U, ...M.map((ae) => {
          const Se = ae.tickets[0];
          return {
            key: `pr${ae.number}`,
            number: ae.number,
            title: ae.title,
            chip: { label: "open", color: E.review.color },
            ...Se != null ? { onOpen: () => p(`review-t${Se}`), selKeys: [`review-t${Se}`] } : { url: ae.url }
          };
        })],
        action: M.length && !U.length ? { label: "Review the PRs", onClick: B } : void 0
      };
    if (y === "done") {
      const ae = !!(S != null && S.landed), Se = ae && de && e.kind !== "map";
      return {
        id: y,
        state: H ? ae ? "live" : "full" : "queued",
        count: H ? /* @__PURE__ */ u(ve, { children: [
          /* @__PURE__ */ u("b", { style: Re, children: [
            H,
            " of ",
            $.length
          ] }),
          " · ",
          de ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: H ? void 0 : "closes when the retro runs",
        segments: [{ n: H, color: E.done.color }, { n: Math.max(0, $.length - H), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...U, ...$.filter((Qe) => Qe.state === "done").sort((Qe, Fe) => Qe.number - Fe.number).map(G)],
        action: ae && !de ? { label: "Run /retro", onClick: C } : Se ? N ? { label: "Close the effort and its issue?", onClick: () => {
          q(!1), j();
        }, confirm: () => q(!1) } : { label: "Close effort", onClick: () => q(!0) } : void 0
      };
    }
    if (!ee.length && !(y === "shape" && W.length) && !U.length)
      return nt.indexOf(y) < ue ? { id: y, state: "skipped", count: `entered at ${st[X]}`, segments: [], rows: [] } : y === "build" ? { id: y, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: y, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const Q = se(ee), Ue = Q.you + Q.afk + Q.building + Q.review + Q.blocked > 0 || !ee.length && U.length > 0, xe = [];
    y === "grill" ? (Q.done && xe.push(`${Q.done} answered`), Q.you && xe.push(`${Q.you} waiting`)) : (Q.done && xe.push(`${Q.done} done`), Q.you && xe.push(`${Q.you} HITL`)), Q.building && xe.push(`${Q.building} in agents`), Q.afk && xe.push(`${Q.afk} ready`), Q.review && xe.push(`${Q.review} in review`), Q.blocked && xe.push(`${Q.blocked} blocked`);
    const _e = [Ve(Q.done, "done"), Ve(Q.building, "building"), Ve(Q.review, "review"), Ve(Q.you, "you"), Ve(Q.afk, "afk"), Ve(Q.blocked, "blocked")];
    y === "shape" && W.length && _e.push({ n: W.length, color: "transparent", dashed: !0 });
    const et = [...U, ...J(ee.filter((ae) => ae.state !== "done")).map(G)];
    return y === "shape" && W.forEach((ae, Se) => et.push({
      key: `fog${Se}`,
      title: wo(ae),
      chip: K ? { label: "left unspecified", color: E.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: y,
      state: Ue ? "live" : "full",
      count: /* @__PURE__ */ u(ve, { children: [
        xe.map((ae, Se) => Se === 0 ? /* @__PURE__ */ o("b", { style: Re, children: ae }, ae) : /* @__PURE__ */ u("span", { children: [
          " · ",
          ae
        ] }, ae)),
        y === "shape" && W.length ? /* @__PURE__ */ u("span", { children: [
          " · ",
          W.length,
          " fog"
        ] }) : null
      ] }),
      segments: _e,
      rows: et
    };
  }), Me = (y) => y.state === "live", Le = me.reduce((y, ee, U) => Me(ee) ? U : y, -1), Ne = Le >= 0 ? me[Le] : null, ke = se($), ze = $.length, a = [
    { n: ke.building, label: "in agents", color: E.building.color },
    { n: ke.review, label: "in review", color: E.review.color },
    { n: ke.you, label: "HITL", color: E.you.color },
    { n: ke.afk, label: "ready", color: E.afk.color },
    { n: ke.blocked, label: "blocked", color: E.blocked.color },
    { n: W.length, label: "fog", color: "var(--muted)" }
  ].filter((y) => y.n > 0), [z, Z] = O(() => new Set(Ne ? [Ne.id] : [])), ne = (y) => Z((ee) => {
    const U = new Set(ee);
    return U.has(y) ? U.delete(y) : U.add(y), U;
  }), be = te + me.reduce((y, ee) => y + ee.rows.reduce((U, Q) => U + (Q.questions ?? 0), 0), 0), Ae = Object.values(i ?? {}).filter((y) => y && (y.needs === "approval" || y.needs === "input")).length, Be = $.filter((y) => y.state === "you" && t[y.number] !== "attention" && !D(y.sessionKey)).length, We = g === "conductor", pe = !!e.sessions.conductor && !Pe(e.sessions.conductor), Ie = m ? 10 : 16;
  return /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, ...f ? {} : { height: "100%" } }, children: [
    /* @__PURE__ */ u("div", { style: { padding: `10px ${Ie}px 9px`, borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ u("span", { style: { ..._, fontSize: v.tiny, flex: 1 }, children: [
          "entered at ",
          st[X],
          " (",
          mo[e.start] ?? e.start,
          ")"
        ] }),
        !f && /* @__PURE__ */ o("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.tiny, whiteSpace: "nowrap" }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }, children: ze > 0 ? /* @__PURE__ */ u(ve, { children: [
        /* @__PURE__ */ u("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ u("b", { style: { color: E.done.text }, children: [
            ke.done,
            " of ",
            ze
          ] }),
          " ",
          /* @__PURE__ */ o("span", { style: _, children: "done" })
        ] }),
        a.map((y) => /* @__PURE__ */ u("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ o("b", { style: { color: y.color }, children: y.n }),
          " ",
          /* @__PURE__ */ o("span", { style: _, children: y.label })
        ] }, y.label))
      ] }) : /* @__PURE__ */ o("span", { style: _, children: W.length ? `${W.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
      (be > 0 || Ae > 0 || Be > 0) && // The pill only shows when something is waiting on the human, so it
      // pulses the moment it appears — the same amber attention cue the
      // session cards use, for questions, trust prompts/asks, and HITL.
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          onClick: c,
          className: "kipo-pulse",
          title: Ae > 0 ? "A session is stopped on a trust prompt or an ask: open it to allow or answer" : Be > 0 ? "A ticket is in HITL, waiting on you: open it to act" : "Jump to the next conversation with open questions; answer them on the right",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 6,
            padding: "2px 9px",
            borderRadius: 99,
            background: E.you.color,
            color: "#14121c",
            fontSize: v.tiny,
            fontWeight: 700,
            cursor: "pointer",
            border: 0
          },
          children: [
            yo(be, Ae + Be),
            " →"
          ]
        }
      ),
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          "aria-pressed": l,
          onClick: () => d(!l),
          title: "When a ticket closes and frees the next Deliver ticket an agent can take, KiPo starts it. Runs while this effort is open in KiPo.",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            padding: 0,
            marginTop: 5,
            cursor: "pointer",
            fontSize: v.tiny,
            color: l ? E.afk.text : "var(--muted)"
          },
          children: [
            /* @__PURE__ */ o(
              "span",
              {
                "aria-hidden": !0,
                className: l ? "kipo-pulse" : void 0,
                style: { width: 7, height: 7, borderRadius: 999, background: l ? E.afk.color : "var(--muted)" }
              }
            ),
            "Autopilot ",
            l ? "on" : "off",
            ": freed agent tickets ",
            l ? "start on their own" : "wait for you"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { style: f ? void 0 : { flex: 1, minHeight: 0, overflowY: "auto" }, children: [
      /* @__PURE__ */ o("div", { style: { padding: `9px ${Ie}px`, borderBottom: "1px solid var(--border)" }, children: /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          onClick: n,
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
            fontSize: v.small,
            fontWeight: 700,
            border: "1px solid var(--accent)",
            background: We ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: We ? "var(--accent-fg, #fff)" : "var(--accent)"
          },
          children: [
            /* @__PURE__ */ o(dn, { size: 14, "aria-hidden": !0, style: { flexShrink: 0 } }),
            /* @__PURE__ */ o("span", { style: { flex: 1 }, children: "Conductor" }),
            te > 0 ? /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${We ? "var(--accent-fg, #fff)" : E.you.color}`,
              color: We ? "var(--accent-fg, #fff)" : E.you.color
            }, children: te === 1 ? "1 question" : `${te} questions` }) : /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 400, opacity: 0.75 }, children: pe ? "conversation" : "not started" })
          ]
        }
      ) }),
      me.map((y) => /* @__PURE__ */ o(
        vo,
        {
          s: y,
          busy: r,
          open: z.has(y.id),
          selectedKey: g,
          compact: m,
          onToggle: () => ne(y.id),
          onOpenTile: s
        },
        y.id
      )),
      /* @__PURE__ */ u("div", { style: { display: "flex", gap: 12, alignItems: "center", padding: `9px ${Ie}px`, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ o(ot, { color: E.done.color, label: "done" }),
        /* @__PURE__ */ o(ot, { color: E.building.color, label: "in agents" }),
        /* @__PURE__ */ o(ot, { color: E.you.color, label: "HITL" }),
        /* @__PURE__ */ o(ot, { color: E.afk.color, label: "ready" }),
        /* @__PURE__ */ o(ot, { color: E.blocked.color, label: "blocked" })
      ] })
    ] })
  ] });
}
function ot({ color: e, label: t }) {
  return /* @__PURE__ */ u("span", { children: [
    /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, background: e, marginRight: 4, verticalAlign: -1 } }),
    t
  ] });
}
function vo({ s: e, open: t, busy: i, selectedKey: r, compact: l, onToggle: g, onOpenTile: f }) {
  const m = e.state === "skipped" || e.state === "queued", d = e.rows.length > 0 || !!e.action, s = uo.find((c) => c.id === e.id), p = e.segments.reduce((c, I) => c + I.n, 0), n = e.rows.reduce((c, I) => c + (I.questions ?? 0), 0);
  return /* @__PURE__ */ u("div", { style: {
    borderBottom: "1px solid var(--border)",
    background: t ? "var(--bg-elevated)" : void 0,
    borderLeft: t ? `2px solid ${E.you.color}` : "2px solid transparent"
  }, children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        onClick: d ? g : void 0,
        "aria-expanded": d ? t : void 0,
        title: s ? `${st[e.id]} · ${s.skill}
${s.what}` : void 0,
        style: {
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: l ? "8px 10px 9px 6px" : "8px 16px 9px 10px",
          background: "transparent",
          color: "var(--text)",
          cursor: d ? "pointer" : "default",
          opacity: m ? 0.55 : 1
        },
        children: [
          /* @__PURE__ */ u("span", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
            /* @__PURE__ */ o(kt, { size: 12, "aria-hidden": !0, style: {
              flexShrink: 0,
              alignSelf: "center",
              color: "var(--muted)",
              transform: t ? "rotate(90deg)" : void 0,
              transition: "transform .12s",
              visibility: d ? "visible" : "hidden"
            } }),
            /* @__PURE__ */ o(
              "span",
              {
                style: { width: l ? 48 : 56, flexShrink: 0, fontSize: v.small, fontWeight: 700, color: m ? "var(--muted)" : "var(--text-strong, var(--text))" },
                title: l ? Vt[e.id] : void 0,
                children: st[e.id]
              }
            ),
            !l && /* @__PURE__ */ o("span", { style: { width: 92, flexShrink: 0, fontSize: 10, color: "var(--muted)" }, children: Vt[e.id] }),
            /* @__PURE__ */ u("span", { style: { flex: 1, textAlign: "right", fontSize: v.small, minWidth: 0 }, children: [
              !t && n > 0 && /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
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
              }, children: n === 1 ? "1 question" : `${n} questions` }),
              !t && !n && e.rows.some((c) => c.attention) && /* @__PURE__ */ o(
                "span",
                {
                  className: "kipo-pulse",
                  title: "A session in here needs you: a trust prompt, an ask, or HITL",
                  style: { display: "inline-block", width: 7, height: 7, borderRadius: 999, background: E.you.color, marginRight: 6 }
                }
              ),
              e.count
            ] })
          ] }),
          p > 0 && /* @__PURE__ */ o("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((c) => c.n > 0).map((c, I) => /* @__PURE__ */ o("span", { style: { flex: c.n, background: c.color, ...c.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, I)) }),
          e.ghost && /* @__PURE__ */ o("span", { style: { display: "block", fontSize: v.tiny, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }, children: e.ghost })
        ]
      }
    ),
    t && d && /* @__PURE__ */ u("div", { style: { margin: l ? "0 10px 10px 8px" : "0 16px 10px 14px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }, children: [
      e.action && /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: e.rows.length ? "1px solid var(--border)" : void 0 }, children: [
        /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.tiny, flex: 1 }, children: e.action.confirm ? "" : `${st[e.id]}'s next step` }),
        /* @__PURE__ */ o(Kt, { primary: !0, disabled: i, onClick: e.action.onClick, children: e.action.label }),
        e.action.confirm && /* @__PURE__ */ o(Kt, { disabled: i, onClick: e.action.confirm, children: "Cancel" })
      ] }),
      e.rows.map((c) => {
        var j;
        const I = () => {
          c.onOpen ? c.onOpen() : c.tile ? f(c.tile) : c.url && window.open(c.url, "_blank", "noreferrer");
        }, B = !!c.onOpen || !!c.tile || !!c.url, C = !!r && !!((j = c.selKeys) != null && j.includes(r));
        return /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            onClick: B ? I : void 0,
            disabled: !B,
            title: c.tile ? `#${c.number} ${c.title}
${Je[c.tile.state]}
Click to open its session` : c.onOpen ? `${c.title}
Click to open this conversation` : c.title,
            style: {
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 10px",
              borderTop: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: v.small,
              background: C ? "var(--bg-elevated)" : "transparent",
              boxShadow: C ? "inset 2px 0 0 var(--accent)" : void 0,
              cursor: B ? "pointer" : "default"
            },
            onMouseEnter: (N) => {
              B && !C && (N.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (N) => {
              N.currentTarget.style.background = C ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ u("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: c.number != null ? `#${c.number}` : c.onOpen ? /* @__PURE__ */ o(dn, { size: 11, "aria-hidden": !0 }) : "☁" }),
                /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: c.title }),
                c.pulse && /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: c.attention ? E.you.color : E.building.color,
                  flexShrink: 0
                } }),
                /* @__PURE__ */ o(
                  "span",
                  {
                    className: c.attention ? "kipo-pulse" : void 0,
                    style: {
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".03em",
                      textTransform: "uppercase",
                      padding: "1px 6px",
                      borderRadius: 99,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      color: c.chip.solid ? "#14121c" : c.chip.color,
                      background: c.chip.solid ? c.chip.color : "transparent",
                      border: c.chip.solid ? "1px solid transparent" : `1px solid ${c.chip.color}`
                    },
                    children: c.chip.label
                  }
                )
              ] }),
              c.live && /* @__PURE__ */ u(
                "span",
                {
                  title: c.live.line ?? void 0,
                  style: {
                    display: "block",
                    marginTop: 3,
                    paddingLeft: 50,
                    fontSize: v.tiny,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  },
                  children: [
                    /* @__PURE__ */ o("span", { style: { color: E.building.color }, children: ko(c.live.at) }),
                    c.live.line ? /* @__PURE__ */ u(ve, { children: [
                      " · ",
                      c.live.line
                    ] }) : null
                  ]
                }
              )
            ]
          },
          c.key
        );
      })
    ] })
  ] });
}
const wo = (e) => e.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
function ko(e) {
  const t = e ? Date.parse(e) : NaN;
  if (Number.isNaN(t)) return "running";
  const i = Math.round((Date.now() - t) / 6e4);
  return i < 1 ? "just now" : i < 60 ? `${i}m` : `${Math.round(i / 60)}h`;
}
const kn = "kipo.rail.repoOpen", xo = () => {
  try {
    return JSON.parse(localStorage.getItem(kn) || "{}");
  } catch {
    return {};
  }
};
function Zt() {
  return /* @__PURE__ */ o(
    "span",
    {
      className: "kipo-pulse",
      title: `${ht.HITL}: a session in here is stopped on a trust prompt or question`,
      style: { width: 7, height: 7, borderRadius: 999, background: "#f5b14c", flexShrink: 0 }
    }
  );
}
function So({ stage: e }) {
  return /* @__PURE__ */ o("span", { style: {
    flexShrink: 0,
    fontSize: 10,
    lineHeight: "15px",
    padding: "0 6px",
    borderRadius: 999,
    border: "1px solid var(--accent)",
    color: "var(--accent)",
    whiteSpace: "nowrap"
  }, children: Qn[e] });
}
function $o({ width: e, items: t, repos: i, error: r, notice: l, selected: g, attention: f, spineSlot: m, onNew: d, onAddRepo: s, onRemoveRepo: p, onRestore: n, onSelect: c, onHide: I, onRemove: B, onCollapse: C }) {
  const [j, N] = O(""), [q, D] = O(null), [te, oe] = O(!0);
  Y(() => {
    oe(!0);
  }, [g]);
  const [S, $] = O(null), W = Ee(() => $(null), []), [K, ie] = O(null), [re, ge] = O(xo);
  Y(() => {
    localStorage.setItem(kn, JSON.stringify(re));
  }, [re]);
  const X = (b) => re[b] !== !1, ue = j.trim().toLowerCase(), F = vt(() => {
    const b = /* @__PURE__ */ new Map();
    for (const P of t ?? []) {
      const H = b.get(P.repo) ?? [];
      H.push(P), b.set(P.repo, H);
    }
    const M = (i ?? []).map((P) => P.slug);
    for (const P of b.keys()) M.includes(P) || M.push(P);
    return M.map((P) => {
      const H = (i ?? []).find((J) => J.slug === P) ?? { slug: P, path: "", hidden: [] }, de = b.get(P) ?? [], G = !ue || P.toLowerCase().includes(ue), se = G ? de : de.filter((J) => J.title.toLowerCase().includes(ue));
      return { meta: H, rows: se, show: !ue || G || se.length > 0 };
    }).filter((P) => P.show);
  }, [t, i, ue]);
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
            /* @__PURE__ */ o(Te, { primary: !0, onClick: d, children: /* @__PURE__ */ u("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(qn, { size: 14 }),
              "New effort"
            ] }) }),
            /* @__PURE__ */ o("span", { title: "Add a repo: it joins this sidebar with all its maps and efforts under it", children: /* @__PURE__ */ o(Te, { onClick: s, children: /* @__PURE__ */ u("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(jn, { size: 14 }),
              "Add repo"
            ] }) }) })
          ] }),
          /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ o(
              "input",
              {
                value: j,
                onChange: (b) => N(b.target.value),
                placeholder: "Filter efforts",
                "aria-label": "Filter efforts",
                style: { ...ct, fontSize: v.small, padding: "4px 8px", flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                onClick: C,
                title: "Fold the effort list away",
                "aria-label": "Fold the effort list away",
                style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: 14, flexShrink: 0 },
                children: "«"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 6px 8px" }, children: [
          r && /* @__PURE__ */ o("div", { style: { color: "var(--danger-text)", fontSize: v.small, padding: "4px 6px" }, children: r }),
          !r && l && /* @__PURE__ */ o("div", { style: { color: "#f5b14c", fontSize: v.tiny, padding: "4px 6px", lineHeight: 1.4 }, children: l }),
          t === null && !r && /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small, padding: "4px 6px" }, children: "Loading…" }),
          t !== null && !F.length && /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small, padding: "4px 6px" }, children: ue ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          F.map((b) => {
            const M = X(b.meta.slug) || !!ue, P = b.meta.slug.split("/").pop() ?? b.meta.slug;
            return /* @__PURE__ */ u("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ u(
                "div",
                {
                  onContextMenu: (H) => {
                    H.preventDefault(), ie({ slug: b.meta.slug, x: H.clientX, y: H.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => D(`repo:${b.meta.slug}`),
                  onPointerLeave: () => D((H) => H === `repo:${b.meta.slug}` ? null : H),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 6,
                    padding: "3px 4px",
                    background: q === `repo:${b.meta.slug}` ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ u(
                      "button",
                      {
                        type: "button",
                        onClick: () => ge((H) => ({ ...H, [b.meta.slug]: !M })),
                        "aria-expanded": M,
                        title: b.meta.path || b.meta.slug,
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
                          /* @__PURE__ */ o(kt, { size: 11, "aria-hidden": !0, style: {
                            flexShrink: 0,
                            color: "var(--muted)",
                            transition: "transform .12s",
                            transform: M ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ o(cn, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: P }),
                          !M && (f ?? 0) > 0 && (g == null ? void 0 : g.startsWith(`${b.meta.slug}#`)) && /* @__PURE__ */ o(Zt, {}),
                          /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.tiny, flexShrink: 0 }, children: b.rows.length || (M ? "" : "0") })
                        ]
                      }
                    ),
                    (q === `repo:${b.meta.slug}` || (K == null ? void 0 : K.slug) === b.meta.slug) && /* @__PURE__ */ o(
                      "button",
                      {
                        type: "button",
                        "aria-label": `More for ${b.meta.slug}`,
                        "aria-haspopup": "menu",
                        title: "More",
                        onClick: (H) => {
                          H.stopPropagation();
                          const de = H.currentTarget.getBoundingClientRect();
                          ie({ slug: b.meta.slug, x: de.left, y: de.bottom + 2, confirm: !1 });
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
                        children: /* @__PURE__ */ o(qt, { size: 13 })
                      }
                    )
                  ]
                }
              ),
              M && !b.rows.length && /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              M && b.rows.length > 0 && /* @__PURE__ */ o("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: b.rows.map((H) => {
                const de = `${H.repo}#${H.number}`, G = de === g, se = G && !!m && te;
                return /* @__PURE__ */ u(
                  "div",
                  {
                    style: {
                      position: "relative",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "var(--bg)",
                      // The open map glows; the rest sit as quiet cards.
                      border: `1px solid ${G ? "var(--accent)" : "var(--border)"}`,
                      boxShadow: G ? "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)" : void 0
                    },
                    onContextMenu: (J) => {
                      J.preventDefault(), $({ key: de, item: H, x: J.clientX, y: J.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => D(de),
                    onPointerLeave: () => D((J) => J === de ? null : J),
                    children: [
                      /* @__PURE__ */ u(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            G ? oe((J) => !J) : c(H);
                          },
                          "aria-current": G ? "page" : void 0,
                          "aria-expanded": G && m ? te : void 0,
                          title: G ? te ? "Fold this effort's stations away" : "Show this effort's stations" : void 0,
                          style: {
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 8px",
                            cursor: "pointer",
                            background: G ? "var(--bg-elevated)" : "transparent",
                            color: "var(--text)"
                          },
                          children: [
                            /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                              /* @__PURE__ */ o(kt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: se ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ u("span", { style: { ...G ? Re : {}, flex: 1, minWidth: 0, fontSize: v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ u("span", { style: { ..._, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  H.number
                                ] }),
                                " ",
                                H.title
                              ] }),
                              G && !se && (f ?? 0) > 0 && /* @__PURE__ */ o(Zt, {})
                            ] }),
                            (() => {
                              var we;
                              if (se)
                                return /* @__PURE__ */ u("div", { style: { ..._, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(St, { kind: H.kind, map: H.mapIssue }),
                                  /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: H.repo.split("/").pop() }),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Gt(H.updatedAt) })
                                ] });
                              const J = (we = H.frontier) != null && we.stations ? ho(H.frontier.stations) : null;
                              return /* @__PURE__ */ u(ve, { children: [
                                J && /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(fo, { glance: J }) }),
                                /* @__PURE__ */ u("div", { style: { ..._, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(St, { kind: H.kind, map: H.mapIssue }),
                                  !J && /* @__PURE__ */ o(So, { stage: H.stage ?? Vn(H.column) }),
                                  /* @__PURE__ */ o(
                                    "span",
                                    {
                                      title: J ? `${J.bits || J.front}

${ht.HITL}
${ht.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: J ? J.bits || J.front : H.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Gt(H.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (q === de || G || (S == null ? void 0 : S.key) === de) && /* @__PURE__ */ o(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${H.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: (J) => {
                            J.stopPropagation();
                            const we = J.currentTarget.getBoundingClientRect();
                            $({ key: de, item: H, x: we.left, y: we.bottom + 2, confirm: !1 });
                          },
                          onMouseEnter: (J) => {
                            J.currentTarget.style.background = "rgba(255,255,255,0.1)";
                          },
                          onMouseLeave: (J) => {
                            J.currentTarget.style.background = "transparent";
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
                          children: /* @__PURE__ */ o(qt, { size: 14 })
                        }
                      ),
                      se && /* @__PURE__ */ o("div", { ref: m, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  de
                );
              }) }),
              M && b.meta.hidden.length > 0 && /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  onClick: () => n(b.meta.slug, b.meta.hidden),
                  title: `Removed from the sidebar: #${b.meta.hidden.join(", #")}. Click to restore them.`,
                  style: {
                    ..._,
                    fontSize: v.tiny,
                    background: "transparent",
                    cursor: "pointer",
                    padding: "3px 6px 2px 24px",
                    textAlign: "left"
                  },
                  children: [
                    b.meta.hidden.length,
                    " removed · restore"
                  ]
                }
              )
            ] }, b.meta.slug);
          })
        ] }),
        S && !S.confirm && /* @__PURE__ */ o(Jt, { x: S.x, y: S.y, onClose: W, items: [
          { label: "Open on GitHub", icon: jt, onSelect: () => window.open(S.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: _n, danger: !0, onSelect: () => $({ ...S, confirm: "hide" }) },
          ...S.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: _t, danger: !0, onSelect: () => $({ ...S, confirm: "remove" }) }
          ]
        ] }),
        (S == null ? void 0 : S.confirm) === "hide" && /* @__PURE__ */ o(
          mt,
          {
            x: S.x,
            y: S.y,
            onClose: W,
            action: "Remove",
            title: `Remove "${S.item.title}" from the sidebar?`,
            onConfirm: () => I(S.item),
            children: S.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (S == null ? void 0 : S.confirm) === "remove" && /* @__PURE__ */ o(
          mt,
          {
            x: S.x,
            y: S.y,
            onClose: W,
            action: "Close it",
            title: `Close "${S.item.title}" as not planned?`,
            onConfirm: () => B(S.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        K && !K.confirm && /* @__PURE__ */ o(Jt, { x: K.x, y: K.y, onClose: () => ie(null), items: [
          { label: "Open on GitHub", icon: jt, onSelect: () => window.open(`https://github.com/${K.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: _t, danger: !0, onSelect: () => ie({ ...K, confirm: !0 }) }
        ] }),
        (K == null ? void 0 : K.confirm) && /* @__PURE__ */ o(
          mt,
          {
            x: K.x,
            y: K.y,
            onClose: () => ie(null),
            action: "Remove",
            title: `Remove ${K.slug} from KiPo?`,
            onConfirm: () => p(K.slug),
            children: "Its efforts and maps leave the sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back."
          }
        )
      ]
    }
  );
}
function Io({ items: e, selected: t, attention: i, onNew: r, onSelect: l, onExpand: g }) {
  const f = (d) => {
    var p;
    const s = (p = d.frontier) == null ? void 0 : p.counts;
    return s ? s.you ? "#f5b14c" : s.afk ? "#2dd4bf" : s.building || s.review ? "#60a5fa" : s.done ? "#3fae6a" : "var(--muted)" : "var(--muted)";
  }, m = { width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return /* @__PURE__ */ u("nav", { "aria-label": "Efforts", style: { width: 44, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", borderRight: "1px solid var(--border)", background: "var(--bg)", minHeight: 0 }, children: [
    /* @__PURE__ */ o(
      "button",
      {
        type: "button",
        onClick: g,
        title: "Show the effort list",
        "aria-label": "Show the effort list",
        style: { ...m, background: "transparent", color: "var(--muted)", fontSize: 14 },
        children: "»"
      }
    ),
    /* @__PURE__ */ o(
      "button",
      {
        type: "button",
        onClick: r,
        title: "New effort",
        "aria-label": "New effort",
        style: { ...m, background: "var(--accent)", color: "var(--accent-fg, #fff)", fontWeight: 700, fontSize: 16, borderRadius: 999 },
        children: "+"
      }
    ),
    /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 6, scrollbarWidth: "none" }, children: (e ?? []).map((d) => {
      const s = `${d.repo}#${d.number}`, p = s === t;
      return /* @__PURE__ */ o(
        "button",
        {
          type: "button",
          onClick: () => l(d),
          title: `${d.title} (${d.repo.split("/").pop()})`,
          "aria-current": p ? "page" : void 0,
          style: { ...m, background: p ? "var(--bg-elevated)" : "transparent", border: p ? "1px solid var(--border)" : "1px solid transparent", flexShrink: 0 },
          children: /* @__PURE__ */ o(
            "span",
            {
              className: p && (i ?? 0) > 0 ? "kipo-pulse" : void 0,
              style: { width: 10, height: 10, borderRadius: 3, background: p && (i ?? 0) > 0 ? "#f5b14c" : f(d) }
            }
          )
        },
        s
      );
    }) })
  ] });
}
const en = [
  { id: "idea", title: "An idea", hint: "Grill it, spec and ticket it, build it.", begins: "a grilling: an interview that sharpens the idea. Then the spec and tickets, then the build." },
  { id: "small", title: "A small change", hint: "Grill briefly, then build in the same session.", begins: "a short grilling, then the build in the same conversation. No spec or tickets." },
  { id: "huge", title: "A huge effort", hint: "Too many unknowns: map the decisions first.", begins: "a wayfinder map. Its decision tickets fill the Decide lane." },
  { id: "issue", title: "An incoming issue", hint: "Triage it until an agent can pick it up.", begins: "triaging the issue. Once an agent can take it, it moves to the Deliver lane." },
  { id: "bug", title: "A hard bug", hint: "Diagnose it with a tight loop, then fix it.", begins: "a diagnosis: a command that goes red on the bug, then the fix." }
], at = (e) => /* @__PURE__ */ o("span", { style: { ...Re, fontSize: v.body, display: "block", marginBottom: 6 }, children: e }), Ro = (e) => {
  const t = e.trim().match(/(?:issues\/|#)?(\d+)\s*$/);
  return t ? Number(t[1]) : null;
};
function Co({ onStarted: e, onCancel: t }) {
  const [i, r] = O(""), [l, g] = O(null), [f, m] = O(""), [d, s] = O(!1), [p, n] = O(!1), [c, I] = O("idea"), [B, C] = O(""), [j, N] = O(!1), [q, D] = O("");
  Y(() => {
    fe.discoverRepos().then(($) => g(
      $.repos.filter((W) => W.slug && !W.worktree).sort((W, K) => Number(K.configured) - Number(W.configured) || W.name.localeCompare(K.name))
    )).catch(($) => {
      D($e($)), g([]);
    });
  }, []);
  const te = ($) => {
    s(!1), m($), l && !l.some((W) => W.path === $) && g([...l, { path: $, name: $.split("/").pop() || $, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, oe = async () => {
    const $ = c === "issue" && B.trim() ? Ro(B) : null;
    if (c === "issue" && B.trim() && $ == null) {
      D("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !$) {
      D("Say what you want to do first.");
      return;
    }
    if (!f) {
      D("Choose which project this is for.");
      return;
    }
    N(!0), D("");
    try {
      e(await fe.startInitiative({
        path: f,
        description: i.trim() || `Issue #${$}`,
        start: c,
        worktree: p,
        sourceIssue: $
      }));
    } catch (W) {
      D($e(W)), N(!1);
    }
  }, S = en.find(($) => $.id === c);
  return /* @__PURE__ */ u("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ u("div", { children: [
      /* @__PURE__ */ o("div", { style: { ...Re, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ o(Ge, { children: q }),
    /* @__PURE__ */ u("label", { children: [
      at("What do you want to do?"),
      /* @__PURE__ */ o(
        "textarea",
        {
          value: i,
          onChange: ($) => r($.target.value),
          rows: 3,
          autoFocus: !0,
          placeholder: "e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share",
          style: { ...ct, resize: "vertical", lineHeight: 1.45 }
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { children: [
      at("Which project is this for?"),
      /* @__PURE__ */ u(
        "select",
        {
          value: f,
          onChange: ($) => $.target.value === "__pick" ? s(!0) : m($.target.value),
          style: ct,
          disabled: l === null,
          children: [
            /* @__PURE__ */ o("option", { value: "", children: l === null ? "Looking for your projects…" : "Choose a project…" }),
            l == null ? void 0 : l.map(($) => /* @__PURE__ */ o("option", { value: $.path, children: $.slug ?? $.name }, $.path)),
            /* @__PURE__ */ o("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      f && /* @__PURE__ */ u("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(un, { path: f }) }),
        /* @__PURE__ */ u("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: v.body }, children: [
          /* @__PURE__ */ o("input", { type: "checkbox", checked: p, onChange: ($) => n($.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ u("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ o("span", { style: _, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      d && /* @__PURE__ */ o("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ o(pn, { busy: null, onAdd: te, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ u("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ o("legend", { style: { padding: 0 }, children: at("Where does this start?") }),
      /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: en.map(($) => {
        const W = c === $.id;
        return /* @__PURE__ */ u(
          "label",
          {
            style: {
              display: "block",
              padding: "8px 10px 9px",
              cursor: "pointer",
              borderRadius: 8,
              border: `1px solid ${W ? "var(--accent)" : "var(--border)"}`,
              background: W ? "var(--accent-subtle, var(--bg-elevated))" : "var(--card, var(--bg))",
              color: "var(--text)"
            },
            children: [
              /* @__PURE__ */ o(
                "input",
                {
                  type: "radio",
                  name: "start",
                  checked: W,
                  onChange: () => I($.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ o("div", { style: { ...Re, fontSize: v.body }, children: $.title }),
              /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small, marginTop: 3, lineHeight: 1.4 }, children: $.hint })
            ]
          },
          $.id
        );
      }) }),
      /* @__PURE__ */ u("div", { style: { ..._, fontSize: v.small, marginTop: 8 }, children: [
        "Starts with ",
        S.begins
      ] })
    ] }),
    c === "issue" && /* @__PURE__ */ u("label", { children: [
      at("Which issue? (optional)"),
      /* @__PURE__ */ o(
        "input",
        {
          value: B,
          onChange: ($) => C($.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: ct
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ o(Te, { primary: !0, disabled: j, onClick: oe, children: j ? "Starting…" : "Start the conversation" }),
      t && /* @__PURE__ */ o(Te, { onClick: t, children: "Never mind" })
    ] }),
    /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small, lineHeight: 1.5 }, children: "Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo." })
  ] });
}
const tn = 6, Ke = (e, t) => (e.blockers ?? e.blockedBy).filter((i) => t.has(i) && i !== e.number);
function To(e, t) {
  const i = new Map(e.map((c) => [c.number, c])), r = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), g = (c) => {
    if (r.has(c.number)) return r.get(c.number);
    if (l.has(c.number)) return 0;
    l.add(c.number);
    const I = Ke(c, i), B = I.length ? 1 + Math.max(...I.map((C) => g(i.get(C)))) : 0;
    return l.delete(c.number), r.set(c.number, B), B;
  };
  e.forEach(g);
  const f = e.length ? Math.max(...e.map((c) => r.get(c.number))) + 1 : 0, m = t ? [e.filter((c) => c.lane === "decide"), e.filter((c) => c.lane !== "decide")] : [e], d = /* @__PURE__ */ new Map(), s = [];
  let p = 0, n = null;
  return m.forEach((c, I) => {
    if (!c.length) return;
    t && I === 1 && p > 0 && (n = p, p += 0.6);
    let B = 0;
    const C = [];
    for (let j = 0; j < f; j++) {
      const N = c.filter((D) => r.get(D.number) === j), q = (D) => {
        const te = Ke(D, i).map((oe) => d.get(oe)).filter((oe) => oe !== void 0);
        return te.length ? te.reduce((oe, S) => oe + S, 0) / te.length : D.number / 1e3;
      };
      N.sort((D, te) => q(D) - q(te) || D.number - te.number), N.forEach((D, te) => d.set(D.number, p + te)), C.push(N), B = Math.max(B, N.length);
    }
    C.forEach((j, N) => {
      const q = (B - j.length) / 2;
      j.forEach((D, te) => {
        const oe = p + te + q;
        d.set(D.number, oe), s.push({ tile: D, col: N, row: oe });
      });
    }), p += B;
  }), { placed: s, cols: f, rows: p, split: n };
}
function zo({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: l, labeled: g, bands: f, highlight: m, dimOthers: d = !0, down: s }) {
  const p = ye(null), [n, c] = O(0), [I, B] = O(null);
  if (Y(() => {
    const a = p.current;
    if (!a) return;
    const z = new ResizeObserver(() => c(a.clientWidth));
    return z.observe(a), c(a.clientWidth), () => z.disconnect();
  }, []), !e.length) return null;
  const C = new Map(e.map((a) => [a.number, a])), j = /* @__PURE__ */ new Set();
  for (const a of e) for (const z of Ke(a, C))
    j.add(z), j.add(a.number);
  const N = e.length > 1 ? e.filter((a) => !j.has(a.number)) : [], q = N.length ? e.filter((a) => j.has(a.number)) : e, { placed: D, cols: te, rows: oe, split: S } = To(q, !!f), $ = 30, W = !!s && !f, K = f ? 52 : 0, ie = W ? 12 : f ? 64 : g ? 40 : 48, re = i > 0 && !W ? Math.min(i, 4) : 0, ge = re ? ie + $ : 0, X = W ? Math.max(1, oe) : te, ue = n && X ? Math.floor((n - 2 - 2 * tn - K - ge - (X - 1) * ie) / X) : 168, F = g ? Math.max(W ? 120 : 110, Math.min(f ? 240 : W ? 260 : 200, ue)) : $, b = $ + 6, M = W ? 30 : g ? 10 : 8, P = q.length ? te : 0, H = W ? (q.length ? X * (F + ie) - ie : 0) + 2 : K + (P ? P * (F + ie) - ie : 0) + ge + 2, de = S ?? oe, G = W ? P : Math.max(oe, re), se = (a) => 1 + a * (b + M), J = q.length || re ? se(G) - M + 1 : 0, we = new Map(D.map((a) => [a.tile.number, W ? { x: 1 + a.row * (F + ie), y: se(a.col) } : { x: K + 1 + a.col * (F + ie), y: se(a.row) }])), Oe = /* @__PURE__ */ new Set();
  if (t != null) {
    Oe.add(t);
    const a = C.get(t);
    a && Ke(a, C).forEach((z) => Oe.add(z)), e.forEach((z) => {
      Ke(z, C).includes(t) && Oe.add(z.number);
    });
  }
  const me = I != null && C.has(I) ? new Set(It(e, I).map((a) => a.number)) : null, Me = (a) => me ? me.has(a) : (m ? m.has(a) : !0) && (t == null || !d || Oe.has(a)), Le = (a) => a.state === "you" || a.state === "afk", Ne = (a) => Le(a) && a.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${E[a.state].color}` : void 0, ke = [];
  for (const a of q) for (const z of Ke(a, C)) ke.push({ from: C.get(z), to: a });
  const ze = S != null ? se(S) + 0.3 * (b + M) - M / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ u("div", { ref: p, style: { overflowX: "auto", padding: tn, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ u("div", { style: { position: "relative", width: H, height: J, minWidth: H }, children: [
        /* @__PURE__ */ u("svg", { width: H, height: J, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ o("defs", { children: /* @__PURE__ */ o("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ o("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          ze != null && /* @__PURE__ */ o("line", { x1: 0, x2: H, y1: ze, y2: ze, stroke: "var(--border)", strokeDasharray: "2 4" }),
          ke.map(({ from: a, to: z }) => {
            const Z = we.get(a.number), ne = we.get(z.number);
            if (!Z || !ne) return null;
            const be = a.state === "done", Ae = me ? me.has(a.number) && me.has(z.number) : t != null && (a.number === t || z.number === t), Be = me ? !Ae : t != null && d && !Ae || !Me(a.number) || !Me(z.number), We = W ? (() => {
              const pe = Z.x + $ / 2, Ie = Z.y + b + 2, De = ne.x + $ / 2, He = ne.y - 2, he = (Ie + He) / 2;
              return `M${pe},${Ie} C${pe},${he} ${De},${he} ${De},${He}`;
            })() : (() => {
              const pe = Z.x + F + 2, Ie = Z.y + b / 2, De = ne.x - 2, He = ne.y + b / 2, he = (pe + De) / 2;
              return `M${pe},${Ie} C${he},${Ie} ${he},${He} ${De},${He}`;
            })();
            return /* @__PURE__ */ o(
              "path",
              {
                d: We,
                fill: "none",
                stroke: Ae ? "var(--text)" : "var(--muted)",
                strokeWidth: Ae ? 1.6 : 1.2,
                strokeDasharray: be ? "3 3" : void 0,
                opacity: Be ? 0.15 : be ? 0.45 : 0.8,
                markerEnd: "url(#kipo-arrow)"
              },
              `${a.number}-${z.number}`
            );
          })
        ] }),
        f && D.length > 0 && ["decide", "deliver"].map((a) => {
          const z = D.filter((ne) => a === "decide" ? ne.tile.lane === "decide" : ne.tile.lane !== "decide").map((ne) => ne.row);
          if (!z.length) return null;
          const Z = (Math.min(...z) + Math.max(...z)) / 2;
          return /* @__PURE__ */ o("span", { style: { position: "absolute", left: 0, top: se(Z) + b / 2 - 8, fontSize: v.tiny, fontWeight: 600, color: "var(--muted)" }, children: a === "decide" ? "Decide" : "Deliver" }, a);
        }),
        D.map(({ tile: a }) => {
          const z = we.get(a.number);
          return /* @__PURE__ */ u(
            "div",
            {
              onPointerEnter: () => B(a.number),
              onPointerLeave: () => B((Z) => Z === a.number ? null : Z),
              style: {
                position: "absolute",
                left: z.x,
                top: z.y,
                width: F,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: Me(a.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    title: Ne(a) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: Ne(a), display: "inline-flex" },
                    children: /* @__PURE__ */ o(Ut, { tile: a, size: $, onClick: () => r(a), open: a.number === t, status: l == null ? void 0 : l[a.number] })
                  }
                ),
                g && /* @__PURE__ */ o(
                  "button",
                  {
                    type: "button",
                    onClick: () => r(a),
                    title: a.title,
                    style: {
                      flex: 1,
                      minWidth: 0,
                      background: "transparent",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--text)",
                      fontSize: v.tiny,
                      lineHeight: 1.3,
                      fontWeight: a.number === t ? 600 : 400,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    },
                    children: a.title
                  }
                )
              ]
            },
            a.number
          );
        }),
        Array.from({ length: re }).map((a, z) => /* @__PURE__ */ o(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: K + 1 + P * (F + ie),
              top: se(Math.max(0, (de - re) / 2) + z),
              width: $,
              height: b,
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
          `fog-${z}`
        ))
      ] }),
      N.length > 0 && /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: K }, children: [
        /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        N.map((a) => /* @__PURE__ */ o("span", { style: { opacity: Me(a.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: Ne(a) }, children: /* @__PURE__ */ o(Ut, { tile: a, size: $, onClick: () => r(a), open: a.number === t, status: l == null ? void 0 : l[a.number] }) }, a.number))
      ] }),
      /* @__PURE__ */ u("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: K }, children: [
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2" }) }),
          " still blocks"
        ] }),
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2", strokeDasharray: "3 3", opacity: ".6" }) }),
          " blocker closed"
        ] }),
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, boxShadow: `0 0 0 1.5px ${E.you.color}`, marginRight: 5 } }),
          "frontier: open and unblocked"
        ] }),
        i > 0 && /* @__PURE__ */ o("span", { children: "? not yet specified" })
      ] })
    ] })
  );
}
function It(e, t) {
  const i = new Map(e.map((m) => [m.number, m]));
  if (!i.has(t)) return [];
  const r = /* @__PURE__ */ new Set([t]), l = [t];
  for (; l.length; ) {
    const m = i.get(l.pop());
    for (const d of m ? Ke(m, i) : []) r.has(d) || (r.add(d), l.push(d));
  }
  const g = /* @__PURE__ */ new Set([t]), f = [t];
  for (; f.length; ) {
    const m = f.pop();
    for (const d of e)
      !g.has(d.number) && Ke(d, i).includes(m) && (g.add(d.number), r.add(d.number), f.push(d.number));
  }
  return e.filter((m) => r.has(m.number));
}
function Ao(e) {
  if (!e) return "";
  const t = Math.max(0, (Date.now() - new Date(e).getTime()) / 1e3);
  return t < 60 ? "just now" : t < 3600 ? `${Math.floor(t / 60)}m ago` : t < 86400 ? `${Math.floor(t / 3600)}h ago` : `${Math.floor(t / 86400)}d ago`;
}
function Oo({ slot: e, active: t, ended: i }) {
  const [r, l] = O(null), [g, f] = O(""), m = ye(null), d = ye(!0);
  return Y(() => {
    let s = !0;
    const p = () => fe.sessionTail(e, 60).then((c) => {
      s && (l(c.events), f(""));
    }).catch((c) => {
      s && f($e(c));
    });
    if (p(), !t || i) return () => {
      s = !1;
    };
    const n = setInterval(p, 4e3);
    return () => {
      s = !1, clearInterval(n);
    };
  }, [e, t, i]), Y(() => {
    var s;
    d.current && ((s = m.current) == null || s.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: E.building.color, flexShrink: 0 } }),
      /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.tiny, lineHeight: 1.4 }, children: i ? /* @__PURE__ */ u(ve, { children: [
        "This session has ended — a read-only record of what it did, from its transcript. Its slot ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
        " is closed in Kiro."
      ] }) : /* @__PURE__ */ u(ve, { children: [
        "Running in the background — read-only progress from its transcript. To chat with it, open ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
        " in Kiro's session window."
      ] }) })
    ] }),
    /* @__PURE__ */ u(
      "div",
      {
        onScroll: (s) => {
          const p = s.currentTarget;
          d.current = p.scrollHeight - p.scrollTop - p.clientHeight < 40;
        },
        style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", scrollbarWidth: "thin" },
        children: [
          /* @__PURE__ */ o(Ge, { children: g }),
          r === null && !g && /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small }, children: "Reading its transcript…" }),
          r !== null && r.length === 0 && !g && /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.small }, children: "No steps recorded yet." }),
          /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: (r ?? []).map((s, p) => /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            /* @__PURE__ */ u("span", { style: { ..._, fontSize: v.tiny, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ o("span", { style: { fontWeight: 700, color: s.role === "user" ? E.you.text : "var(--muted)" }, children: s.role === "user" ? "You" : "Agent" }),
              s.ts && /* @__PURE__ */ o("span", { children: Ao(s.ts) })
            ] }),
            s.tool ? /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: s.text }) : /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.5 }, children: /* @__PURE__ */ o(wt, { content: s.text }) })
          ] }, p)) }),
          /* @__PURE__ */ o("div", { ref: m })
        ]
      }
    )
  ] });
}
const nn = 2 * 60 * 60 * 1e3, ft = /* @__PURE__ */ new Map(), Eo = (e, t) => {
  const i = ft.get(`${e}:${t}`);
  return i && Date.now() - i >= nn && ft.delete(`${e}:${t}`), !!i && Date.now() - i < nn;
};
function Mo({ items: e, prompts: t = [], onOpenPrompt: i, onError: r, onSize: l, bottomOffset: g = 122 }) {
  const f = Ct(), m = (a) => `${a.slot}:${a.d.id}`;
  for (const a of e) a.d.answer && ft.delete(m(a));
  const d = e.filter((a) => pt(a.d) && !Eo(a.slot, a.d.id)), [s, p] = O({}), [n, c] = O({}), [I, B] = O(0), [C, j] = O(!1), [N, q] = O(!1), [D, te] = O({}), [oe, S] = O(""), $ = ye(null), W = t.filter((a) => !D[a.slot]), K = d.map(m).join(",") + "|" + W.map((a) => a.slot).join(","), ie = ye(K);
  Y(() => {
    ie.current !== K && (ie.current = K, B(0), p({}), c({}), K !== "|" && q(!1));
  }, [K]);
  const re = ye(null), ge = Ee((a) => {
    var Z;
    if ((Z = re.current) == null || Z.disconnect(), re.current = null, !a) {
      l == null || l(0);
      return;
    }
    const z = () => l == null ? void 0 : l(a.offsetHeight);
    z(), re.current = new ResizeObserver(z), re.current.observe(a);
  }, [l]);
  if (!d.length && !W.length) return null;
  const X = d.length + W.length;
  if (N) return /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      className: "kipo-pulse",
      onClick: () => q(!1),
      title: "Open what's waiting on you",
      style: {
        position: "absolute",
        right: 16,
        bottom: g + 4,
        zIndex: 6,
        cursor: "pointer",
        borderRadius: 99,
        padding: "4px 12px",
        fontSize: v.small,
        fontWeight: 600,
        border: `1px solid ${E.you.color}`,
        color: E.you.text,
        background: "var(--bg-elevated)",
        boxShadow: "0 4px 14px rgba(0,0,0,.35)"
      },
      children: [
        X,
        " waiting on you →"
      ]
    }
  );
  const ue = Math.min(I, Math.max(0, d.length - 1)), F = d.length ? d[ue] : null, b = F ? m(F) : "", M = d.filter((a) => (s[m(a)] ?? "").trim()), P = ue === 0, H = ue === d.length - 1, G = !!F && (s[b] ?? "") !== "" && !(F.d.options ?? []).includes(s[b] ?? "") || !!n[b], se = d.filter((a) => a.d.recommended), J = (a) => {
    b && p((z) => ({ ...z, [b]: a }));
  }, we = () => {
    var a;
    C || !F || (c((z) => ({ ...z, [b]: !0 })), p((z) => (F.d.options ?? []).includes(z[b] ?? "") ? { ...z, [b]: "" } : z), (a = $.current) == null || a.focus());
  }, Oe = async (a = s) => {
    const z = d.filter((ne) => (a[m(ne)] ?? "").trim());
    if (!z.length) return;
    const Z = /* @__PURE__ */ new Map();
    for (const ne of z) {
      const be = Z.get(ne.slot) ?? [];
      be.push(ne), Z.set(ne.slot, be);
    }
    j(!0);
    try {
      for (const [ne, be] of Z) {
        const Ae = d.filter((pe) => pe.slot === ne && !(a[m(pe)] ?? "").trim()), Be = be.map((pe, Ie) => `${Ie + 1}. ${pe.d.title} (${pe.d.id}): ${a[m(pe)].trim()}`), We = [
          `My answers to your ${be.length === 1 ? "question" : `${be.length} questions`}:`,
          "",
          ...Be,
          "",
          Ae.length ? `Still open, I'll answer later: ${Ae.map((pe) => pe.d.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
        ].join(`
`);
        await f.post("/api/chat?ws=1", { slot: ne, message: We });
        for (const pe of be) ft.set(m(pe), Date.now());
      }
      p({}), B(0);
    } catch (ne) {
      r(`Couldn't send your answers: ${$e(ne)}`);
    } finally {
      j(!1);
    }
  }, me = () => {
    const a = { ...s };
    for (const z of se) a[m(z)] = z.d.recommended;
    p(a), Oe(a);
  }, Me = async (a, z) => {
    try {
      await f.post(
        `/api/chat/slots/${encodeURIComponent(a.slot)}/approve`,
        { action: z, request_id: a.requestId, request_mid: a.requestMid, origin: "native" }
      ), te((Z) => ({ ...Z, [a.slot]: !0 })), S("");
    } catch (Z) {
      const ne = `Couldn't ${z === "approved" ? "allow" : "deny"} ${a.from}: ${$e(Z)}`;
      S(ne), r(ne);
    }
  }, Le = (a) => /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${a ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: a && /* @__PURE__ */ o("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), Ne = (a) => {
    const z = s[b] === a && !n[b];
    return /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": z,
        disabled: C,
        onClick: () => {
          c((Z) => ({ ...Z, [b]: !1 })), J(a);
        },
        onMouseEnter: (Z) => {
          z || (Z.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (Z) => {
          z || (Z.currentTarget.style.background = "transparent");
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
          fontSize: v.small,
          lineHeight: 1.4,
          border: `1px solid ${z ? "var(--accent)" : "var(--border)"}`,
          background: z ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
          color: "var(--text)"
        },
        children: [
          Le(z),
          /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0 }, children: a }),
          !!F && a === F.d.recommended && /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      a
    );
  }, ke = (a, z, Z) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      title: z,
      onClick: Z,
      disabled: C,
      style: {
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 9px",
        color: "var(--text)",
        cursor: "pointer",
        fontSize: v.tiny,
        whiteSpace: "nowrap",
        flexShrink: 0
      },
      children: a
    }
  ), ze = (a, z, Z) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      disabled: z,
      onClick: Z,
      style: {
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 10px",
        color: z ? "var(--muted)" : "var(--text)",
        cursor: z ? "default" : "pointer",
        fontSize: v.small,
        opacity: z ? 0.5 : 1
      },
      children: a
    }
  );
  return /* @__PURE__ */ u(
    "div",
    {
      ref: ge,
      role: "dialog",
      "aria-label": `${X} waiting on you`,
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
          /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: E.you.text }, children: d.length === 0 ? W.length === 1 ? "Trust prompt" : "Trust prompts" : d.length === 1 ? "Question" : `Question ${ue + 1} of ${d.length}` }),
          d.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ o("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: d.map((a, z) => /* @__PURE__ */ o(
            "span",
            {
              title: `${a.from ? `${a.from} — ` : ""}${a.d.title ?? a.d.id}`,
              onClick: () => B(z),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (s[m(a)] ?? "").trim() ? E.you.color : z === ue ? "var(--text)" : "var(--border)"
              }
            },
            m(a)
          )) }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              onClick: () => q(!0),
              title: "Tuck the questions away and get the chat box back",
              style: {
                background: "transparent",
                border: "none",
                padding: "0 2px",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: v.tiny
              },
              children: "Hide"
            }
          )
        ] }),
        W.length > 0 && /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: d.length ? 10 : 2 }, children: [
          W.map((a) => /* @__PURE__ */ u("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 9px",
            borderRadius: 8,
            border: `1px solid ${E.you.color}`,
            background: "color-mix(in srgb, #f5b14c 8%, transparent)"
          }, children: [
            /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: E.you.color, flexShrink: 0 } }),
            /* @__PURE__ */ u(
              "span",
              {
                style: { flex: 1, minWidth: 0, fontSize: v.small },
                title: [a.tool, a.input, a.purpose].filter(Boolean).join(`

`),
                children: [
                  /* @__PURE__ */ o("b", { children: a.from }),
                  " ",
                  /* @__PURE__ */ o("span", { style: _, children: "wants to run:" }),
                  /* @__PURE__ */ o("span", { style: {
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "var(--muted)",
                    fontSize: v.tiny,
                    fontFamily: "ui-monospace, monospace"
                  }, children: a.tool })
                ]
              }
            ),
            a.canDecide && /* @__PURE__ */ o(Te, { primary: !0, onClick: () => void Me(a, "approved"), children: "Allow" }),
            a.canDecide && ke("Deny once", "Reject this one call; the session continues without it", () => void Me(a, "rejected_once")),
            i && ke("Open", "Open this session to see the prompt in full", () => i(a.key))
          ] }, a.slot)),
          oe && /* @__PURE__ */ o("div", { style: { color: "var(--danger-text, #f85149)", fontSize: v.tiny, padding: "0 2px" }, children: oe })
        ] }),
        F && /* @__PURE__ */ u(ve, { children: [
          F.from && /* @__PURE__ */ u("div", { style: { ..._, fontSize: v.tiny, marginBottom: 3 }, children: [
            "from ",
            F.from
          ] }),
          /* @__PURE__ */ o("div", { style: { ...Re, fontSize: v.body, marginBottom: 8, lineHeight: 1.4 }, children: F.d.title }),
          /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
            (F.d.options ?? []).map(Ne),
            /* @__PURE__ */ u(
              "div",
              {
                role: "radio",
                "aria-checked": G,
                onClick: we,
                style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px", cursor: "text" },
                children: [
                  Le(G),
                  /* @__PURE__ */ o(
                    "input",
                    {
                      ref: $,
                      value: G ? s[b] ?? "" : "",
                      onChange: (a) => J(a.target.value),
                      onFocus: we,
                      disabled: C,
                      placeholder: "Something else…",
                      "aria-label": `Another answer to: ${F.d.title}`,
                      style: {
                        flex: 1,
                        minWidth: 0,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: v.small,
                        border: `1px solid ${G ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 8,
                        padding: "5px 10px",
                        outline: "none"
                      }
                    }
                  )
                ]
              }
            )
          ] }),
          /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            d.length > 1 && ze("‹ Back", P, () => B(ue - 1)),
            !H && ze("Next ›", !1, () => B(ue + 1)),
            /* @__PURE__ */ o("span", { style: { flex: 1 } }),
            d.length > 1 && /* @__PURE__ */ u("span", { style: { ..._, fontSize: v.tiny }, children: [
              M.length,
              " of ",
              d.length,
              " answered"
            ] }),
            se.length > 0 && /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                disabled: C,
                onClick: me,
                title: d.length > 1 ? `Answer all ${se.length} with their recommendation and send` : "Take the recommendation and send",
                style: {
                  background: "transparent",
                  border: `1px solid ${E.you.color}`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  color: E.you.text,
                  cursor: C ? "default" : "pointer",
                  fontSize: v.small,
                  whiteSpace: "nowrap",
                  opacity: C ? 0.5 : 1
                },
                children: d.length > 1 ? "Accept all recommendations" : "Accept recommendation"
              }
            ),
            /* @__PURE__ */ o(Te, { primary: !0, disabled: !M.length || C, onClick: () => void Oe(), children: C ? "Sending…" : M.length > 1 ? `Submit ${M.length} answers` : "Submit" })
          ] })
        ] })
      ]
    }
  );
}
const Wo = {
  grilling: "Grill",
  prototype: "Prototype",
  research: "Research",
  task: "Task",
  build: "Build",
  issue: "Issue"
}, yt = {
  MERGED: { label: "merged", color: "var(--ok, #3fb950)" },
  OPEN: { label: "open", color: "var(--accent)" },
  CLOSED: { label: "closed", color: "var(--muted)" }
};
function on({ color: e, text: t, children: i }) {
  return /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, padding: "1px 8px", borderRadius: 999, border: `1px solid ${e}`, color: t, whiteSpace: "nowrap" }, children: i });
}
function Ho({ detail: e, tile: t }) {
  const [i, r] = O(null), [l, g] = O("");
  Y(() => {
    let p = !0;
    return r(null), g(""), fe.ticket(e.repo, e.number, t.number).then((n) => {
      p && r(n);
    }).catch((n) => {
      p && g($e(n));
    }), () => {
      p = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const f = e.prs.filter((p) => t.prs.includes(p.number)), m = t.state === "done", d = E[t.state];
  let s;
  return m ? s = f.some((p) => p.state === "MERGED") ? "Closed: its PR merged." : "Closed." : t.state === "review" ? s = "Its PR is open. The effort's Review merges it once it's clean." : t.state === "blocked" ? s = `Waiting on ${t.blockedBy.map((p) => `#${p}`).join(", ")}. It can start once those close.` : t.state === "building" ? s = "An agent is working on it." : t.who === "you" ? s = /* @__PURE__ */ u(ve, { children: [
    /* @__PURE__ */ o(ao, { term: "HITL", children: "HITL" }),
    ": it needs you. Start it to open its conversation."
  ] }) : s = "An agent can take it on its own.", /* @__PURE__ */ u("div", { children: [
    /* @__PURE__ */ u("div", { style: { padding: "14px 16px" }, children: [
      /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ u("span", { style: { ..._, fontSize: v.small }, children: [
          "#",
          t.number,
          " · ",
          Wo[t.type]
        ] }),
        /* @__PURE__ */ o("span", { title: Je[t.state], style: { cursor: "help", display: "inline-flex" }, children: /* @__PURE__ */ o(on, { color: d.color === "transparent" ? "var(--border)" : d.color, text: d.text, children: d.label }) }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        /* @__PURE__ */ o("a", { href: t.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.small }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { ...Re, fontSize: v.title, marginTop: 4, lineHeight: 1.35 }, children: t.title }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, lineHeight: 1.45 }, children: s })
    ] }),
    f.length > 0 && /* @__PURE__ */ o(gt, { title: f.length === 1 ? "Pull request" : "Pull requests", children: /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: f.map((p) => {
      var n, c, I;
      return /* @__PURE__ */ u(
        "a",
        {
          href: p.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: v.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ o(on, { color: ((n = yt[p.state]) == null ? void 0 : n.color) ?? "var(--border)", text: ((c = yt[p.state]) == null ? void 0 : c.color) ?? "var(--muted)", children: ((I = yt[p.state]) == null ? void 0 : I.label) ?? p.state }),
            /* @__PURE__ */ u("span", { style: { color: "var(--accent)" }, children: [
              "#",
              p.number
            ] }),
            /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: p.title })
          ]
        },
        p.number
      );
    }) }) }),
    m && /* @__PURE__ */ o(gt, { title: "How it ended", aside: i != null && i.lastComment ? `latest of ${i.comments} comment${i.comments === 1 ? "" : "s"}` : void 0, children: l ? /* @__PURE__ */ o(Ge, { children: l }) : i ? i.lastComment ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(wt, { content: i.lastComment.body }) }) : /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.small }, children: "Closed with no comment." }) : /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.small }, children: "Loading…" }) }),
    /* @__PURE__ */ o(gt, { title: m ? "What it asked" : "What it asks", defaultOpen: !m, children: l ? /* @__PURE__ */ o(Ge, { children: l }) : i ? i.body.trim() ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(wt, { content: i.body }) }) : /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.small }, children: "No description." }) : /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.small }, children: "Loading…" }) })
  ] });
}
const No = (e) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ""}@${e.at}`;
function Do(e, t, i, r, l = {}) {
  const g = [], f = [], m = new Set(l.unstarted ?? []), d = (n, c) => {
    const I = c ? r[c] : void 0;
    if (I)
      return n.replace === I || c && m.has(c) ? I : null;
  }, s = (n, c) => c ? { ...n, replace: c } : n, p = (n) => (l.prs ?? []).some((c) => c.state === "OPEN" && ((c.tickets ?? []).includes(n) || (c.refs ?? []).includes(n)));
  for (const n of e) {
    const c = No(n);
    if (!(t(c) || g.includes(c))) {
      if (g.push(c), n.ticket != null) {
        const I = i.find((C) => C.number === n.ticket);
        if (!I) continue;
        const B = n.skill === "kipo-review";
        if ((I.state === "done" || I.state === "blocked") && !(B && p(I.number))) continue;
        if (B) {
          const C = d(n, `review-t${I.number}`);
          C !== null && f.push(s({ id: c, kind: "review", t: I.number }, C));
        } else {
          const C = d(n, I.sessionKey);
          C !== null && f.push(s({ id: c, kind: "tile", tile: I, skill: n.skill && !n.skill.startsWith("kipo-") ? n.skill : null }, C));
        }
      } else if (n.stage) {
        const I = d(n, n.stage);
        I !== null && f.push(s({ id: c, kind: "stage", column: n.stage, skill: n.skill && n.skill !== `kipo-${n.stage}` ? n.skill : null }, I));
      }
    }
  }
  return { fresh: g, starts: f };
}
const Po = (e) => `[KiPo] Carry on: ${e}. Re-read your ticket, its PR and comments, and your state file, then continue from where you stopped; report when you finish or block.`, Lo = (e, t) => `[KiPo] Woke ${e}: ${t}`;
function Bo(e) {
  var i;
  if (!e) return null;
  const t = (i = e.messages) == null ? void 0 : i[e.messages.length - 1];
  return {
    at: (t == null ? void 0 : t.ts) || null,
    running: typeof e.running == "boolean" ? e.running : null,
    agent: t != null && t.role ? t.role !== "user" && t.role !== "system" : null
  };
}
const qo = (e) => e.filter((t) => t.status === "open" && t.key !== "conductor");
function jo(e, t, i) {
  return e.filter((r) => {
    var l;
    return ((l = r.stall) == null ? void 0 : l.state) === "stalled" && r.key !== "conductor" && r.slot !== t && !i(`${r.key}/${r.stall.id}`);
  });
}
const bt = (e) => e.kind === "ticket" ? `build-t${e.t}` : e.kind === "spec" ? "build-spec" : e.kind === "decision" ? `shape-t${e.t}` : e.kind === "review" ? `review-t${e.t}` : e.kind === "stage" ? e.column : "conductor";
function _o({ repo: e, number: t, active: i, autoStart: r, spineHost: l, spineCompact: g, onRemoved: f, onChanged: m, onNeeds: d }) {
  var Nt, Dt;
  const s = Ct(), p = `effort:${e}#${t}`, [n, c] = O(() => it(p)), [I, B] = O(""), [C, j] = O(""), [N, q] = O(() => it(`${p}:focus`) ?? { kind: "column" });
  Y(() => {
    rt(`${p}:focus`, N);
  }, [p, N]);
  const [D, te] = O(!1), [oe, S] = O(!1), $ = eo("chain", 100, 0.75), W = Ee(() => {
    fe.getInitiative(e, t).then((h) => {
      c(h), rt(p, h), B("");
    }).catch((h) => B($e(h)));
  }, [e, t, p]);
  Y(() => {
    if (W(), !i) return;
    const h = setInterval(W, 5e3);
    return () => clearInterval(h);
  }, [W, i]);
  const K = n == null ? void 0 : n.column;
  Y(() => {
    j("");
  }, [K, N]);
  const ie = ye(K);
  Y(() => {
    if (K === void 0 || ie.current === K) {
      ie.current = K;
      return;
    }
    const h = ie.current !== void 0;
    ie.current = K, h && q({ kind: "column" });
  }, [K]);
  const re = n ? bt(N) : null, ge = n && re ? n.sessions[re] ?? null : null, X = ge && !Pe(ge) ? ge : null, ue = n && N.kind === "ticket" ? n.tickets.find((h) => h.number === N.t) ?? null : null, F = async (h = null, w, L = !0, R = !1) => {
    if (!n) return;
    const k = w ?? N;
    te(!0), j("");
    try {
      const x = k.kind === "ticket" ? { column: "build", ticket: k.t, skill: h ?? "implement" } : k.kind === "spec" ? { column: "build", mode: "implement-spec", skill: h ?? "implement-spec" } : k.kind === "decision" ? { column: "shape", ticket: k.t, skill: h } : k.kind === "review" ? { column: "review", ticket: k.t, skill: h } : k.kind === "stage" ? { column: k.column, skill: h } : { column: n.column, mode: "conductor" }, T = await fe.startSession(e, t, R ? { ...x, replace: !0 } : x), A = k.kind === "ticket" ? `${n.title}: #${k.t}` : k.kind === "spec" ? `${n.title}: implement-spec` : k.kind === "decision" ? `${n.title}: decision #${k.t}` : k.kind === "review" ? `${n.title}: review #${k.t}` : k.kind === "stage" ? `${n.title}: ${ut[k.column]}` : `${n.title}: conductor`;
      T.existing ? await s.post("/api/chat?ws=1", { slot: T.slotName, message: T.seed }) : await co(s, e, T.slotName, T.seed, A, T.agent), T.key && await fe.sessionStarted(e, t, T.key).catch(() => fe.sessionStarted(e, t, T.key)).catch(() => {
      }), w && L && q(w), L && (W(), m());
    } catch (x) {
      j(
        x instanceof xt && x.code === "ticket_blocked" ? x.message : `Couldn't start the conversation: ${$e(x)}`
      );
    } finally {
      te(!1);
    }
  }, b = (h) => h.lane === "deliver" ? { kind: "ticket", t: h.number } : { kind: "decision", t: h.number }, M = (h) => h.lane === "deliver" ? "implement" : h.type === "research" ? "research" : h.type === "prototype" ? "prototype" : h.type === "issue" ? "triage" : null, [P, H] = O(null), de = (h) => {
    q(b(h));
  }, G = n != null && n.frontier && (N.kind === "ticket" || N.kind === "decision") ? n.frontier.tiles.find((h) => h.number === N.t) ?? null : null, [se, J] = O({}), [we, Oe] = O({}), [me, Me] = O(null), [Le, Ne] = O({});
  Y(() => {
    let h = !0;
    const w = () => (lt(), s.get("/api/chat/slots").then((R) => {
      !h || !Array.isArray(R) || (Me(new Set(R.filter((k) => k.key).map((k) => k.key))), Ne(Object.fromEntries(R.filter((k) => k.key).map((k) => [k.key, k]))));
    }).catch(() => {
    }));
    if (w(), !i) return () => {
      h = !1;
    };
    const L = setInterval(w, 5e3);
    return () => {
      h = !1, clearInterval(L);
    };
  }, [s, i]);
  const ke = X && !(me !== null && !me.has(X)) ? X : null;
  Y(() => {
    Yo(ke);
  }, [ke]);
  const ze = vt(
    () => {
      var h;
      return (((h = n == null ? void 0 : n.frontier) == null ? void 0 : h.tiles) ?? []).filter((w) => w.sessionKey && (n == null ? void 0 : n.sessions[w.sessionKey]));
    },
    [n]
  );
  Y(() => {
    if (!ze.length) {
      J({}), Oe({});
      return;
    }
    let h = !0;
    const w = (k) => {
      const x = (k == null ? void 0 : k.content) ?? (k == null ? void 0 : k.text), T = typeof x == "string" ? x : Array.isArray(x) ? x.map((V) => typeof V == "string" ? V : (V == null ? void 0 : V.text) ?? "").join(" ") : null, A = T == null ? void 0 : T.replace(/\s+/g, " ").trim();
      return A ? A.slice(0, 140) : null;
    }, L = async () => {
      let k = /* @__PURE__ */ new Map();
      try {
        const x = await s.get("/api/chat/slots");
        h && Array.isArray(x) && (k = new Map(x.filter((T) => T.key).map((T) => [T.key, T])));
      } catch {
      }
      Promise.all(ze.map((x) => {
        const T = n.sessions[x.sessionKey], A = k.get(T);
        return s.get(`/api/chat/slots/${encodeURIComponent(T)}?limit=1`).then((V) => {
          var Lt;
          const je = (Lt = V == null ? void 0 : V.messages) == null ? void 0 : Lt[V.messages.length - 1], ce = (A == null ? void 0 : A.pending_approval) ?? (V == null ? void 0 : V.pending_approval), Ye = (A == null ? void 0 : A.needs_input) ?? (V == null ? void 0 : V.needs_input), Wn = (A == null ? void 0 : A.running) ?? (V == null ? void 0 : V.running), Pt = ce ? "approval" : Ye ? "input" : null, Hn = { at: (je == null ? void 0 : je.ts) ?? null, line: je && je.role !== "user" ? w(je) : null, needs: Pt }, Nn = Pt ? "attention" : Wn ? "running" : x.state === "done" ? null : "waiting";
          return [x.number, Nn, Hn];
        }).catch(() => null);
      })).then((x) => {
        if (!h) return;
        const T = {}, A = {};
        for (const V of x)
          V && (V[1] && (T[V[0]] = V[1]), A[V[0]] = V[2]);
        J(T), Oe(A);
      });
    };
    if (L(), !i) return () => {
      h = !1;
    };
    const R = setInterval(L, 5e3);
    return () => {
      h = !1, clearInterval(R);
    };
  }, [s, ze, i, n]);
  const a = vt(() => {
    var x, T, A, V, je;
    if (!n) return [];
    const h = (ce) => ((ce == null ? void 0 : ce.decisions) ?? []).filter(pt).length, w = /* @__PURE__ */ new Set(), L = [], R = (ce) => {
      const Ye = bt(ce);
      w.has(Ye) || (w.add(Ye), L.push(ce));
    }, k = (ce) => {
      var Ye;
      return (Ye = ce.sessionKey) != null && Ye.startsWith("review-t") ? { kind: "review", t: ce.number } : ce.lane === "deliver" ? { kind: "ticket", t: ce.number } : { kind: "decision", t: ce.number };
    };
    h(((x = n.sessionStates) == null ? void 0 : x.conductor) ?? n.state) && R({ kind: "column" });
    for (const ce of ((T = n.frontier) == null ? void 0 : T.tiles) ?? [])
      ce.state === "done" || !ce.sessionKey || (h((A = n.sessionStates) == null ? void 0 : A[ce.sessionKey]) || se[ce.number] === "attention" || ce.state === "you") && R(k(ce));
    for (const ce of ["plan", "review", "done", "intake", "shape", "grill"])
      n.sessions[ce] && h((V = n.sessionStates) == null ? void 0 : V[ce]) && R({ kind: "stage", column: ce });
    return n.sessions["build-spec"] && h((je = n.sessionStates) == null ? void 0 : je["build-spec"]) && R({ kind: "spec" }), L;
  }, [n, se]), z = a.length;
  Y(() => {
    d == null || d(z);
  }, [z, d]), Y(() => () => {
    d == null || d(0);
  }, [d]);
  const Z = async (h) => {
    for (let w = 0; w < h.length; w++)
      H(`Starting ${w + 1} of ${h.length}…`), await F(M(h[w]), b(h[w]), !1);
    H(null), W(), m();
  }, ne = `kipo.autopilot:${e}#${t}`, [be, Ae] = O(() => localStorage.getItem(ne) === "1"), Be = (h) => {
    Ae(h), localStorage.setItem(ne, h ? "1" : "0");
  }, We = ye(/* @__PURE__ */ new Set());
  Y(() => {
    if (!be || !i || P || !(n != null && n.frontier)) return;
    const h = n.frontier.tiles.filter((w) => w.lane === "deliver" && w.state === "afk" && !w.sessionKey && !We.current.has(w.number));
    h.length && (h.forEach((w) => We.current.add(w.number)), Z(h));
  }, [be, i, P, n]);
  const pe = `kipo.dispatched:${e}#${t}`, Ie = ye(/* @__PURE__ */ new Set()), De = (h) => {
    Ie.current.delete(h);
    try {
      const w = JSON.parse(localStorage.getItem(pe) || "[]");
      localStorage.setItem(pe, JSON.stringify(w.filter((L) => L !== h)));
    } catch {
    }
  };
  Y(() => {
    var k, x;
    if (!i || D || P || !(n != null && n.frontier)) return;
    const h = ((x = (k = n.sessionStates) == null ? void 0 : k.conductor) == null ? void 0 : x.dispatch) ?? [];
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(pe) || "[]");
    } catch {
      w = [];
    }
    const { fresh: L, starts: R } = Do(
      h,
      (T) => w.includes(T) || Ie.current.has(T),
      n.frontier.tiles,
      n.sessions,
      { prs: [...n.prs, ...n.refPrs ?? []], unstarted: Xo(n) }
    );
    if (L.length) {
      for (const T of L)
        Ie.current.add(T), w.push(T);
      try {
        localStorage.setItem(pe, JSON.stringify(w.slice(-300)));
      } catch {
      }
      R.length && (async () => {
        for (const T of R) {
          if (T.replace && !an(n, T.replace) && !await Qt(s, T.replace)) {
            De(T.id);
            continue;
          }
          const A = !!T.replace;
          T.kind === "tile" ? await F(T.skill ?? M(T.tile), b(T.tile), !1, A) : T.kind === "review" ? await F(null, { kind: "review", t: T.t }, !1, A) : await F(T.skill, { kind: "stage", column: T.column }, !1, A);
        }
        W(), m();
      })();
    }
  }, [i, D, P, n]);
  const He = `kipo.restarted:${e}#${t}`;
  Y(() => {
    if (!i || D || P || !(n != null && n.closing)) return;
    let h = [];
    try {
      h = JSON.parse(localStorage.getItem(He) || "[]");
    } catch {
      h = [];
    }
    const L = n.closing.filter((x) => x.started === !1 && x.key !== "conductor" && !h.includes(x.slot)).map((x) => [x, ln(x.key)]).find(([, x]) => x);
    if (!L) return;
    const [R, k] = L;
    try {
      localStorage.setItem(He, JSON.stringify([...h, R.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var T;
      if (!an(n, R.slot) && !await Qt(s, R.slot)) return;
      const x = (T = n.frontier) == null ? void 0 : T.tiles.find((A) => (k.kind === "ticket" || k.kind === "decision") && A.number === k.t);
      await F(x ? M(x) : null, k, !1, !0), W(), m();
    })();
  }, [i, D, P, n]);
  const he = n != null && n.sessions.conductor && !Pe(n.sessions.conductor) ? n.sessions.conductor : null, Ze = ((n == null ? void 0 : n.closing) ?? []).filter((h) => {
    var w;
    return ((w = h.stall) == null ? void 0 : w.state) === "stuck";
  }).map((h) => h.key), qe = n != null && n.frontier ? JSON.stringify({
    t: n.frontier.tiles.map((h) => [h.number, h.state]),
    p: n.prs.map((h) => [h.number, h.state]),
    ...Ze.length ? { s: Ze } : {}
  }) : "";
  Y(() => {
    if (!qe || !he || !i) return;
    const h = `kipo.conductorSaw:${e}#${t}`, w = localStorage.getItem(h);
    if (w === qe) return;
    if (w === null) {
      localStorage.setItem(h, qe);
      return;
    }
    const L = [];
    try {
      const R = JSON.parse(w), k = JSON.parse(qe), x = new Map(R.t), T = new Map(R.p);
      for (const [A, V] of k.t) x.get(A) !== V && L.push(`#${A} ${x.get(A) ?? "new"} → ${V}`);
      for (const [A, V] of k.p) T.get(A) !== V && L.push(`PR #${A} ${(T.get(A) ?? "new").toLowerCase()} → ${V.toLowerCase()}`);
      for (const A of k.s ?? []) (R.s ?? []).includes(A) || L.push(`${A} stuck (woken twice, no answer)`);
    } catch {
    }
    (async () => {
      try {
        const R = await s.get(`/api/chat/slots/${encodeURIComponent(he)}?limit=1`);
        if (R != null && R.running) return;
        await s.post("/api/chat?ws=1", {
          slot: he,
          message: `[KiPo] Frontier changed${L.length ? `: ${L.slice(0, 12).join("; ")}` : ""}. Run the frontier and carry on.`
        }), localStorage.setItem(h, qe);
      } catch {
      }
    })();
  }, [qe, he, i]), Y(() => {
    const h = n == null ? void 0 : n.reports;
    if (!h || !he || !i) return;
    const w = `kipo.reportsSent:${e}#${t}`, L = Number(localStorage.getItem(w) || "0"), R = h.reports.filter((k) => k.id > Math.max(L, h.read));
    R.length && (async () => {
      try {
        const k = await s.get(`/api/chat/slots/${encodeURIComponent(he)}?limit=1`);
        if (k != null && k.running) return;
        const x = (A) => {
          var V;
          return `${A.event}: ${A.text}${(V = A.items) != null && V.length ? ` (${A.items.join("; ")})` : ""}`;
        }, T = R.length === 1 ? `[KiPo] Report from ${R[0].from}: ${x(R[0])}` : `[KiPo] Reports from the sessions:
${R.slice(-12).map((A) => `- ${A.from} ${x(A)}`).join(`
`)}`;
        await s.post("/api/chat?ws=1", { slot: he, message: `${T}
Run the frontier and carry on.` }), localStorage.setItem(w, String(R[R.length - 1].id));
      } catch {
      }
    })();
  }, [n, he, i]);
  const y = (h, w) => {
    if (n) {
      if (n.sessions[h]) {
        q({ kind: "stage", column: h });
        return;
      }
      F(w, { kind: "stage", column: h });
    }
  }, ee = () => y("plan", "to-spec"), U = () => y("review", null), Q = () => y("done", "retro"), Ue = async () => {
    if (n) {
      S(!0), j("");
      try {
        n.column !== "done" && await fe.advance(e, t, !0, "done"), await fe.advance(e, t, !0, null), await Xt(s, Object.values(n.sessions), null), f();
      } catch (h) {
        j(`Couldn't close it: ${$e(h)}`), S(!1);
      }
    }
  }, xe = ye(!1);
  Y(() => {
    if (!(n != null && n.closing) || !i || xe.current) return;
    const h = n.closing.filter((w) => w.status === "closable");
    h.length && (xe.current = !0, Xt(s, h.map((w) => w.slot), X).then((w) => {
      const L = h.filter((R) => w.includes(R.slot)).map((R) => R.key);
      return L.length ? fe.sessionsClosed(e, t, L).then(() => W()) : void 0;
    }).catch(() => {
    }).finally(() => {
      xe.current = !1;
    }));
  }, [s, n, i, X]);
  const _e = JSON.stringify(qo((n == null ? void 0 : n.closing) ?? []).filter((h) => !Pe(h.slot)).map((h) => [h.key, h.slot]));
  Y(() => {
    const h = JSON.parse(_e);
    if (!i || !h.length) return;
    let w = !0;
    const L = () => {
      Promise.all(h.map(
        ([k, x]) => s.get(`/api/chat/slots/${encodeURIComponent(x)}?limit=1`).then((T) => [k, Bo(T)]).catch(() => null)
      )).then((k) => {
        if (!w) return;
        const x = Object.fromEntries(k.filter((T) => T && T[1]).map((T) => [T[0], T[1]]));
        Object.keys(x).length && fe.sessionsActivity(e, t, x).catch(() => {
        });
      });
    };
    L();
    const R = setInterval(L, 3e4);
    return () => {
      w = !1, clearInterval(R);
    };
  }, [s, _e, i, e, t]);
  const et = `kipo.woke:${e}#${t}`, ae = `kipo.wokeNotes:${e}#${t}`, Se = ye(!1);
  Y(() => {
    if (!(n != null && n.closing) || !i || Se.current) return;
    let h = [];
    try {
      h = JSON.parse(localStorage.getItem(et) || "[]");
    } catch {
      h = [];
    }
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(ae) || "[]");
    } catch {
      w = [];
    }
    const L = jo(n.closing, X, (R) => h.includes(R)).filter((R) => !Pe(R.slot));
    !L.length && !(w.length && he) || (Se.current = !0, (async () => {
      for (const R of L) {
        const k = R.stall;
        try {
          const x = await s.get(`/api/chat/slots/${encodeURIComponent(R.slot)}?limit=1`);
          if (x != null && x.running) continue;
          await s.post("/api/chat?ws=1", { slot: R.slot, message: Po(k.why) }), h = [...h, `${R.key}/${k.id}`].slice(-300), localStorage.setItem(et, JSON.stringify(h)), w = [...w, Lo(R.key, k.why)], localStorage.setItem(ae, JSON.stringify(w)), await fe.sessionsWoken(e, t, R.key, k.id ?? "", k.why);
        } catch {
        }
      }
      if (w.length && he)
        try {
          const R = await s.get(`/api/chat/slots/${encodeURIComponent(he)}?limit=1`);
          R != null && R.running || (await s.post("/api/chat?ws=1", { slot: he, message: `${w.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(ae, "[]"));
        } catch {
        }
      L.length && W();
    })().finally(() => {
      Se.current = !1;
    }));
  }, [s, n, i, X, he]);
  const Qe = ye(!1);
  if (Y(() => {
    !r || Qe.current || !n || (Qe.current = !0, n.sessions[n.column] || F());
  }, [r, n]), !n)
    return /* @__PURE__ */ o("div", { style: { flex: 1, padding: 24 }, children: I ? /* @__PURE__ */ o(Ge, { children: I }) : /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.body }, children: "Loading…" }) });
  const Fe = re ? ((Nt = n.sessionStates) == null ? void 0 : Nt[re]) ?? null : n.state, Ot = (Fe == null ? void 0 : Fe.skillsUsed) ?? [], Sn = () => {
    if (N.kind !== "column") {
      q({ kind: "column" });
      return;
    }
    if (!a.length) return;
    const h = a.findIndex((w) => bt(w) === re);
    q(a[(h + 1) % a.length]);
  }, Et = ye(null), $n = () => {
    var h, w;
    try {
      (w = (h = Et.current) == null ? void 0 : h.contentWindow) == null || w.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [tt, In] = O(!1), [Mt, Rn] = O(0), Cn = Ee((h) => Rn((w) => Math.abs(w - h) > 4 ? h : w), []), [Wt, Tn] = O(128), zn = Ee((h) => Tn((w) => Math.abs(w - h) > 4 ? h : w), []), An = G ? G.state === "done" : !!ge && Pe(ge), Xe = N.kind === "column" ? Fe ?? n.state : Fe, Ht = (h) => {
    var L, R;
    const w = h.match(/^(build|shape|review)-t(\d+)$/);
    if (w) {
      const k = (R = (L = n.frontier) == null ? void 0 : L.tiles) == null ? void 0 : R.find((T) => T.number === Number(w[2]));
      return `${w[1] === "review" ? "Review" : w[1] === "build" ? "Build" : "Shape"} #${w[2]}${k != null && k.title ? ` · ${k.title}` : ""}`;
    }
    return h === "build-spec" ? "Build: the spec" : h === "conductor" ? "Conductor" : ut[h] ?? h;
  }, On = new Set((((Dt = n.frontier) == null ? void 0 : Dt.tiles) ?? []).filter((h) => h.state === "done" && h.sessionKey).map((h) => h.sessionKey)), En = (() => {
    var L, R;
    if (N.kind !== "column")
      return An || !X ? [] : ((Xe == null ? void 0 : Xe.decisions) ?? []).map((k) => ({ slot: X, d: k }));
    const h = [], w = n.sessions.conductor;
    if (w && !Pe(w)) for (const k of (Xe == null ? void 0 : Xe.decisions) ?? []) h.push({ slot: w, d: k });
    for (const k of Object.keys(n.sessions)) {
      if (k === "conductor" || On.has(k)) continue;
      const x = n.sessions[k];
      if (!(!x || Pe(x)))
        for (const T of ((R = (L = n.sessionStates) == null ? void 0 : L[k]) == null ? void 0 : R.decisions) ?? []) h.push({ slot: x, from: Ht(k), d: T });
    }
    return h;
  })(), Mn = (() => {
    if (N.kind !== "column") return [];
    const h = /* @__PURE__ */ new Set(), w = [];
    for (const L of Object.keys(n.sessions)) {
      const R = n.sessions[L];
      if (!R || R === ke || Pe(R) || h.has(R)) continue;
      const k = Le[R];
      if (!(k != null && k.pending_approval)) continue;
      h.add(R);
      const x = k.pending_approval_info;
      w.push({
        key: L,
        slot: R,
        from: Ht(L),
        tool: (x == null ? void 0 : x.tool) || "a tool call",
        input: x == null ? void 0 : x.tool_input,
        purpose: x == null ? void 0 : x.tool_purpose,
        requestId: x == null ? void 0 : x.request_id,
        requestMid: x == null ? void 0 : x.request_mid,
        // An app caller must name the exact request a card showed: the slot
        // approve route only accepts origin "native" + request_id + request_mid
        // from anyone but the owner's own browser. Anything less: Open instead.
        canDecide: (x == null ? void 0 : x.origin) === "native" && !!(x != null && x.request_id) && !!(x != null && x.request_mid)
      });
    }
    return w;
  })();
  return /* @__PURE__ */ u("div", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ o("style", { children: "@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}" }),
    /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", minWidth: 0 }, children: [
      /* @__PURE__ */ u("span", { style: { ...Re, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, title: n.title, children: [
        "#",
        n.number,
        " ",
        n.title
      ] }),
      (n.kind === "map" || n.mapIssue) && /* @__PURE__ */ o(
        "a",
        {
          href: `https://github.com/${n.repo}/issues/${n.kind === "map" ? n.number : n.mapIssue}`,
          target: "_blank",
          rel: "noreferrer",
          title: "Open the wayfinder map on GitHub",
          style: { textDecoration: "none", display: "inline-flex" },
          children: /* @__PURE__ */ o(St, { kind: n.kind, map: n.kind === "map" ? n.number : n.mapIssue })
        }
      ),
      /* @__PURE__ */ o("span", { style: { flex: 1 } }),
      /* @__PURE__ */ o("span", { style: { ..._, fontSize: v.tiny, whiteSpace: "nowrap" }, title: n.repoPath, children: n.repo })
    ] }),
    C && /* @__PURE__ */ o("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ o(Ge, { children: C }) }),
    (() => {
      var T;
      const h = /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ o("span", { style: { ...X ? _ : Re, fontSize: X ? v.small : v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: G ? `#${G.number}${X ? "" : ` ${G.title}`}` : N.kind === "column" ? "Conductor" : n.title }),
        X && Ot.length > 0 && /* @__PURE__ */ o(Qo, { skills: Ot }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        G && (n.frontier ? It(n.frontier.tiles, G.number).length > 1 : !1) && /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            onClick: () => In((A) => !A),
            "aria-pressed": tt,
            title: "Show or hide this ticket's map — what it waits on and what it unblocks",
            "aria-label": "Show or hide the map",
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              background: tt ? "var(--bg-elevated)" : "transparent",
              color: tt ? "var(--text)" : "var(--muted)",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: v.small,
              border: `1px solid ${tt ? "var(--border)" : "transparent"}`
            },
            children: [
              /* @__PURE__ */ o(Kn, { size: 14 }),
              " Map"
            ]
          }
        ),
        X && /* @__PURE__ */ o(
          "button",
          {
            type: "button",
            onClick: $n,
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
            children: /* @__PURE__ */ o(Gn, { size: 15 })
          }
        )
      ] }), w = G && (G.state === "you" || G.state === "afk"), L = !!X && me !== null && !me.has(X), R = X && L ? /* @__PURE__ */ o(Oo, { slot: X, active: i, ended: !0 }) : X ? (
        // The card sits `composerH` up, so the transcript must clear the
        // composer, the card, and a gap above it.
        /* @__PURE__ */ o(
          Jo,
          {
            slotKey: X,
            frameRef: Et,
            padBottom: Mt ? Wt + Mt + 24 : 0,
            onComposerH: zn
          },
          X
        )
      ) : G ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          w && /* @__PURE__ */ u("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ o(Te, { primary: !0, disabled: D, onClick: () => F(M(G)), children: D ? "Starting…" : ((T = xn[G.type]) == null ? void 0 : T.action) ?? "Start this ticket" }),
            sn(G, null).map((A) => /* @__PURE__ */ u(
              "button",
              {
                type: "button",
                disabled: D,
                onClick: () => F(A.skill),
                title: Tt[A.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: D ? "default" : "pointer", fontSize: v.small },
                children: [
                  "/",
                  A.skill,
                  " ",
                  /* @__PURE__ */ o("span", { style: _, children: A.label })
                ]
              },
              A.skill
            ))
          ] }),
          /* @__PURE__ */ o(Ho, { detail: n, tile: G })
        ] })
      ) : /* @__PURE__ */ o(
        Uo,
        {
          detail: n,
          focus: N,
          ticket: ue,
          tile: null,
          starting: D,
          onStart: () => F(null),
          alternatives: sn(null, N.kind === "column" ? n.column : null),
          onSkill: (A) => F(A)
        }
      ), k = G && n.frontier ? It(n.frontier.tiles, G.number) : [], x = l ? Fn(
        /* @__PURE__ */ o(
          bo,
          {
            detail: n,
            statuses: se,
            activity: we,
            busy: oe || D || !!P,
            autopilot: be,
            selectedKey: re,
            embedded: !0,
            compact: g,
            onAutopilot: Be,
            onOpenTile: de,
            onOpenConversation: (A) => q(A === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(A) ? { kind: "review", t: Number(A.slice(8)) } : { kind: "stage", column: A }),
            onSelectConductor: () => q({ kind: "column" }),
            onJumpQuestions: Sn,
            onHandover: ee,
            onReview: U,
            onRetro: Q,
            onClose: Ue
          }
        ),
        l
      ) : null;
      return /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        x,
        /* @__PURE__ */ u("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          h,
          G && k.length > 1 && tt && /* @__PURE__ */ u(ve, { children: [
            /* @__PURE__ */ u("div", { ref: $.ref, style: { ...$.style }, children: [
              /* @__PURE__ */ o("div", { style: { padding: "6px 16px 0", fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ o(zo, { tiles: k, focus: G.number, onOpen: de, labeled: !0, dimOthers: !1, statuses: se, down: !0 })
            ] }),
            /* @__PURE__ */ o(
              gn,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: $.onDrag,
                onReset: $.reset
              }
            )
          ] }),
          /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            R,
            /* @__PURE__ */ o(
              Mo,
              {
                items: En,
                prompts: Mn,
                onOpenPrompt: (A) => q(ln(A) ?? { kind: "column" }),
                onError: j,
                onSize: Cn,
                bottomOffset: Wt + 10
              },
              re ?? "none"
            )
          ] })
        ] })
      ] });
    })()
  ] });
}
function rn(e) {
  const t = (g) => typeof g == "string" && /(^|_)kipo-/.test(g), i = (g) => g === e || g.endsWith(`_${e}`), r = (g) => t(g) ? g : g && typeof g == "object" && t(g.key) ? g.key : null, l = (g) => {
    let f = !1;
    if (Array.isArray(g))
      for (let m = g.length - 1; m >= 0; m--) {
        const d = r(g[m]);
        d !== null && !i(d) ? (g.splice(m, 1), f = !0) : l(g[m]) && (f = !0);
      }
    else if (g && typeof g == "object")
      for (const m of Object.values(g)) l(m) && (f = !0);
    return f;
  };
  for (const g of [window.localStorage, window.sessionStorage])
    try {
      for (const f of Object.keys(g)) {
        const m = g.getItem(f);
        if (!m || !m.includes("kipo-") || m[0] !== "[" && m[0] !== "{") continue;
        let d;
        try {
          d = JSON.parse(m);
        } catch {
          continue;
        }
        l(d) && g.setItem(f, JSON.stringify(d));
      }
    } catch {
    }
}
function Ko(e) {
  const t = [...e.querySelectorAll("[data-session-window]")];
  if (t.length < 2) {
    for (const l of t) l.style.display === "none" && (l.style.display = "");
    return !1;
  }
  const i = t[t.length - 1];
  let r = !1;
  for (const l of t) {
    const g = l === i ? "" : "none";
    l.style.display !== g && (l.style.display = g, r = !0);
  }
  return r;
}
let Go = 0;
const Fo = () => ++Go;
let Rt = null;
function Yo(e) {
  Rt = e, lt();
}
function lt() {
  try {
    const e = [...document.querySelectorAll("iframe[data-kipo-frame]")];
    let t = null, i = -1;
    if (Rt !== null)
      for (const r of e) {
        if (r.getAttribute("data-kipo-frame") !== Rt) continue;
        const l = Number(r.getAttribute("data-kipo-gen") ?? "0");
        l >= i && (i = l, t = r);
      }
    for (const r of e) {
      const l = r === t ? "" : "none";
      r.style.display !== l && (r.style.display = l);
    }
  } catch {
  }
}
function Jo({ slotKey: e, frameRef: t, padBottom: i = 0, onComposerH: r }) {
  const l = `/popout/chat?sid=${encodeURIComponent(e)}`, g = ye(null), f = ye(i);
  f.current = i;
  const m = Ee(() => {
    var s;
    try {
      const p = (s = t.current) == null ? void 0 : s.contentDocument;
      if (!p) return;
      let n = p.getElementById("kipo-qcard-css");
      !n && p.head && (n = p.createElement("style"), n.id = "kipo-qcard-css", p.head.appendChild(n));
      const c = f.current ? ".followup-chip{display:none !important}" : "";
      if (n && n.textContent !== c && (n.textContent = c), r) {
        const C = p.querySelector('[data-testid="composer-dock-root"]') ?? p.querySelector('[data-testid="composer-dock"]'), j = C ? Math.round(C.getBoundingClientRect().height) : 0;
        j > 0 && r(j);
      }
      let I = g.current;
      if (!I || !I.isConnected || I.ownerDocument !== p) {
        const C = p.defaultView;
        I = [...p.querySelectorAll("div")].filter((N) => {
          if (N.clientHeight < 200) return !1;
          const q = C == null ? void 0 : C.getComputedStyle(N);
          return !!q && (q.overflowY === "auto" || q.overflowY === "scroll");
        }).sort((N, q) => q.clientHeight - N.clientHeight)[0] ?? null, g.current = I;
      }
      if (!I) return;
      const B = f.current ? `${f.current}px` : "";
      I.style.paddingBottom !== B && (I.style.paddingBottom = B);
    } catch {
    }
  }, [t]);
  Y(() => {
    m();
  }, [m, i]), Y(() => {
    rn(e);
  }, [e]), Y(() => {
    const s = t.current;
    return s && s.setAttribute("data-kipo-gen", String(Fo())), lt(), () => {
      requestAnimationFrame(lt);
    };
  }, [e, t]);
  const d = () => {
    var p;
    const s = t.current;
    try {
      const n = (p = s == null ? void 0 : s.contentWindow) == null ? void 0 : p.location.pathname;
      if (s && n && !n.startsWith("/popout/chat")) {
        s.src = l;
        return;
      }
      const c = s == null ? void 0 : s.contentDocument;
      if (c && !c.getElementById("kipo-popout-css")) {
        const I = c.createElement("style");
        I.id = "kipo-popout-css", I.textContent = [
          '[title*="main window" i]',
          '[aria-label*="main window" i]',
          '[title*="split view" i]',
          '[aria-label*="split view" i]',
          '[aria-label="Close panel"]',
          '[title="Close panel"]'
        ].join(",") + "{display:none !important}", c.head.appendChild(I);
      }
    } catch {
    }
  };
  return Y(() => {
    const s = [], p = window.setInterval(() => {
      var c;
      const n = t.current;
      try {
        const I = (c = n == null ? void 0 : n.contentWindow) == null ? void 0 : c.location.pathname;
        if (n && I && !I.startsWith("/popout/chat")) {
          const C = Date.now();
          for (; s.length && C - s[0] > 6e5; ) s.shift();
          s.length < 5 && (s.push(C), rn(e), n.src = l);
          return;
        }
        lt();
        const B = n == null ? void 0 : n.contentDocument;
        B && Ko(B);
      } catch {
      }
      f.current && m();
    }, 2e3);
    return () => window.clearInterval(p);
  }, [l, e, t, m]), /* @__PURE__ */ o(
    "iframe",
    {
      ref: t,
      src: l,
      title: "The session in Kiro's chat",
      onLoad: d,
      "data-kipo-frame": e,
      style: { flex: 1, minHeight: 0, width: "100%", border: 0, background: "var(--bg)" }
    }
  );
}
const xn = {
  grilling: { what: "Grill", action: "Start the grill", body: "An interview with you to settle this decision. It updates GLOSSARY.md and the ADRs as answers land." },
  prototype: { what: "Prototype", action: "Start a prototype", body: "Throwaway code or an outline to react to, so the decision gets made against something concrete." },
  research: { what: "Research", action: "Run the research", body: "The agent reads primary sources and leaves a cited note on a research branch. No HITL (human-in-the-loop) step." },
  task: { what: "Task", action: "Start this task", body: "Work that has to happen before a decision can be made. The agent does what it can and hands you a checklist for the rest." },
  build: { what: "Build", action: "Implement this ticket", body: "/implement builds this ticket test-first in its own conversation, then reviews it." },
  issue: { what: "Issue", action: "Triage it", body: "A follow-up filed on the map. Triage moves it to an agent-ready brief, or asks you what it needs." }
};
function Uo({ detail: e, focus: t, ticket: i, tile: r, starting: l, onStart: g, alternatives: f, onSkill: m }) {
  let d, s, p;
  if (r) {
    const n = xn[r.type];
    r.state === "done" ? (d = "Closed", s = r.sessionKey ? "Its conversation was closed when the ticket was. How it ended is on the right." : "How it ended is on the right.", p = null) : r.state === "blocked" ? (d = `Waiting on ${r.blockedBy.map((c) => `#${c}`).join(", ")}`, s = "It can start once those are closed.", p = null) : r.state === "review" ? (d = "In review", s = "Its PR is open. The effort's Review merges it once it's clean.", p = null) : (d = "No conversation yet", s = `${r.who === "you" ? "HITL (human in the loop): it needs you." : "Agent (AFK, away from keyboard): an agent can take it on its own."} ${n.body}`, p = n.action);
  } else if (t.kind === "ticket")
    i != null && i.blockedBy.length ? (d = `#${t.t} is waiting on ${i.blockedBy.map((n) => `#${n}`).join(", ")}`, s = "It can start once those are closed.", p = null) : (i == null ? void 0 : i.state) === "CLOSED" ? (d = `#${t.t} is closed`, s = "Nothing left to build on this ticket.", p = null) : (d = `Build #${t.t}`, s = "/implement builds this one ticket test-first in a fresh conversation, then reviews it.", p = "Implement this ticket");
  else if (t.kind === "spec")
    d = "Implement the whole spec", s = "/implement-spec builds every unblocked ticket in parallel on one integration branch, then one review.", p = "Run /implement-spec";
  else if (t.kind === "review")
    d = `Review #${t.t}`, s = "kipo-review reviews this ticket's PR, fixes what it finds, and merges it if it's a two-way door.", p = "Review this ticket";
  else if (t.kind === "decision")
    d = `Decision #${t.t}`, s = "Work through this decision ticket from the map in its own conversation.", p = "Start this decision";
  else if (t.kind === "column")
    d = "Start the conductor", s = "The conductor runs this effort: it reads the frontier from GitHub, starts one stage-skill conversation per open thread, asks you in one batched message, and closes the effort when the frontier is empty. It never does the work itself.", p = "Start the conductor";
  else {
    const n = t.column, c = n === "plan" && e.sessions.grill;
    d = `${ut[n]} hasn't started`, s = c ? "Plan continues the Grill conversation, so the spec and tickets are written with everything it learned." : `${Jn[n]}`, p = c ? "Continue in the Grill conversation" : `Start ${ut[n]}`;
  }
  return /* @__PURE__ */ o("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ u("div", { style: { maxWidth: 400, textAlign: "center" }, children: [
    /* @__PURE__ */ o("div", { style: { ...Re, fontSize: v.title }, children: d }),
    /* @__PURE__ */ o("div", { style: { ..._, fontSize: v.body, margin: "6px 0 14px", lineHeight: 1.5 }, children: s }),
    /* @__PURE__ */ o("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }, children: p && /* @__PURE__ */ o(Te, { primary: !0, disabled: l, onClick: g, children: l ? "Starting…" : p }) }),
    p && f.map((n) => /* @__PURE__ */ u("div", { style: { marginTop: 10, fontSize: v.small }, children: [
      /* @__PURE__ */ o("span", { style: _, children: "or " }),
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          disabled: l,
          onClick: () => m(n.skill),
          title: Tt[n.skill],
          style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: l ? "default" : "pointer", fontSize: v.small },
          children: [
            "/",
            n.skill
          ]
        }
      ),
      /* @__PURE__ */ u("span", { style: _, children: [
        " ",
        n.label
      ] })
    ] }, n.skill))
  ] }) });
}
function sn(e, t) {
  return (e ? e.type === "grilling" : t === "grill") ? [{ skill: "grill-me", label: "without writing docs" }] : [];
}
function Qo({ skills: e }) {
  return /* @__PURE__ */ u("span", { style: { ..._, fontSize: v.tiny, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: [
    "Running",
    " ",
    e.map((t, i) => /* @__PURE__ */ u("span", { children: [
      i > 0 && " · ",
      /* @__PURE__ */ o("span", { title: Tt[t] ?? t, style: { color: "var(--text)", cursor: "help" }, children: t })
    ] }, t))
  ] });
}
const Xo = (e) => (e.closing ?? []).filter((t) => t.started === !1).map((t) => t.key);
function ln(e) {
  const t = /^(build|shape|review)-t(\d+)$/.exec(e);
  return t ? { kind: t[1] === "build" ? "ticket" : t[1] === "shape" ? "decision" : "review", t: Number(t[2]) } : e === "build-spec" ? { kind: "spec" } : ["intake", "shape", "grill", "plan", "review", "done"].includes(e) ? { kind: "stage", column: e } : null;
}
const an = (e, t) => Object.values(e.sessions).filter((i) => i === t).length > 1;
function ii() {
  const e = Dn(), t = (e == null ? void 0 : e.active) !== !1, i = Ct(), [r, l] = O(() => it("initiatives")), [g, f] = O(() => it("repos")), [m, d] = O(!1), [s, p] = O(""), [n, c] = O(() => {
    const b = it("main");
    return !b || !["new", "initiative"].includes(b.kind) ? null : b.kind === "initiative" ? { ...b, autoStart: void 0 } : b;
  });
  Y(() => {
    n && rt("main", n);
  }, [n]);
  const [I, B] = fn("rail", 300, 168, 620), [C, j] = O(null), [N, q] = O(() => localStorage.getItem("kipo.railOpen") !== "0"), D = (b) => {
    q(b), localStorage.setItem("kipo.railOpen", b ? "1" : "0");
  };
  Y(() => {
    ro(i).catch(() => {
    });
  }, [i]);
  const [te, oe] = O(""), S = Ee(() => {
    fe.listInitiatives().then((b) => {
      var M;
      l(b.initiatives), rt("initiatives", b.initiatives), f(b.repos ?? []), rt("repos", b.repos ?? []), p(""), oe((M = b.errors) != null && M.length ? `GitHub is refusing calls for ${b.errors.length === 1 ? b.errors[0].repo.split("/").pop() : `${b.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch((b) => p($e(b)));
  }, []);
  Y(() => {
    if (S(), !t) return;
    const b = setInterval(S, 15e3);
    return () => clearInterval(b);
  }, [S, t]), Y(() => {
    if (r === null) return;
    const b = (n == null ? void 0 : n.kind) === "initiative" && !r.some((P) => P.repo === n.repo && P.number === n.number);
    if (n && !b) return;
    const M = r[0];
    c(M ? { kind: "initiative", repo: M.repo, number: M.number } : { kind: "new" });
  }, [r, n]);
  const $ = (b, M) => c({ kind: "initiative", repo: b.repo, number: b.number, autoStart: M }), W = (b) => {
    l((M) => (M ?? []).filter((P) => !(P.repo === b.repo && P.number === b.number))), fe.hide(b.repo, b.number).then(S).catch((M) => {
      p($e(M)), S();
    });
  }, K = (b) => {
    l((M) => (M ?? []).filter((P) => !(P.repo === b.repo && P.number === b.number))), fe.removeInitiative(b.repo, b.number).then(S).catch((M) => {
      p($e(M)), S();
    });
  }, ie = (b) => {
    f((M) => (M ?? []).filter((P) => P.slug !== b)), l((M) => (M ?? []).filter((P) => P.repo !== b)), fe.removeRepo(b).then(S).catch((M) => {
      p($e(M)), S();
    });
  }, re = (b, M) => {
    Promise.allSettled(M.map((P) => fe.unhide(b, P))).then(S);
  }, ge = (n == null ? void 0 : n.kind) === "initiative" ? `${n.repo}#${n.number}` : null, [X, ue] = O(0), F = Ee((b) => ue(b), []);
  return /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    N ? /* @__PURE__ */ u(ve, { children: [
      /* @__PURE__ */ o(
        $o,
        {
          width: I,
          onCollapse: () => D(!1),
          items: r,
          repos: g,
          error: s,
          notice: te,
          selected: ge,
          attention: X,
          spineSlot: j,
          onNew: () => c({ kind: "new" }),
          onAddRepo: () => d(!0),
          onRemoveRepo: ie,
          onRestore: re,
          onSelect: (b) => $(b),
          onHide: W,
          onRemove: K
        }
      ),
      /* @__PURE__ */ o(gn, { direction: "vertical", label: "Resize the effort list", onDrag: (b) => B((M) => M + b), onReset: () => B(228) })
    ] }) : /* @__PURE__ */ o(
      Io,
      {
        items: r,
        selected: ge,
        attention: X,
        onNew: () => c({ kind: "new" }),
        onSelect: (b) => $(b),
        onExpand: () => D(!0)
      }
    ),
    /* @__PURE__ */ u("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (n == null ? void 0 : n.kind) === "new" && /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ o(
        Co,
        {
          onStarted: (b) => {
            S(), $(b, !0);
          },
          onCancel: r && r.length ? () => c(r[0] ? { kind: "initiative", repo: r[0].repo, number: r[0].number } : { kind: "new" }) : void 0
        }
      ) }),
      (n == null ? void 0 : n.kind) === "initiative" && /* @__PURE__ */ o(
        _o,
        {
          repo: n.repo,
          number: n.number,
          autoStart: n.autoStart,
          active: t,
          spineHost: N ? C : null,
          spineCompact: I < 340,
          onChanged: S,
          onRemoved: () => {
            S(), c(null);
          },
          onNeeds: F
        },
        `${n.repo}#${n.number}`
      )
    ] }),
    m && /* @__PURE__ */ o(Zn, { onAdded: S, onClose: () => d(!1) })
  ] });
}
export {
  ii as default
};
