import { jsxs as u, jsx as o, Fragment as be } from "react/jsx-runtime";
import { useAppApi as zt, useAppInfo as qn } from "@kirocrew/app-sdk";
import { useState as O, useCallback as He, useEffect as Q, useRef as fe, useLayoutEffect as _n, useMemo as pt } from "react";
import { Btn as ze, Badge as Ft, MarkdownRenderer as kt } from "@kirocrew/app-sdk/ui";
import { X as Kn, FolderGit2 as fn, FolderOpen as Gn, MessageSquare as gn, ChevronRight as xt, Plus as Fn, FolderPlus as Jn, MoreHorizontal as Jt, ExternalLink as Yt, EyeOff as Yn, Trash2 as Ut, Map as Un, PanelRight as Qn } from "lucide-react";
import { createPortal as Xn } from "react-dom";
const Vn = "/apps/kipo/api";
class St extends Error {
  constructor(t, i, r) {
    super(i), this.name = "BackendError", this.status = t, this.code = r;
  }
}
async function ae(e, t = "GET", i) {
  let r;
  try {
    r = await fetch(`${Vn}${e}`, {
      method: t,
      credentials: "include",
      headers: i === void 0 ? void 0 : { "Content-Type": "application/json" },
      body: i === void 0 ? void 0 : JSON.stringify(i)
    });
  } catch {
    throw new St(0, "Couldn't reach the KiPo backend. Is the app running?", null);
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
    throw new St(r.status, m, typeof f.code == "string" ? f.code : null);
  }
  return g;
}
const Te = (e, t) => {
  const [i, r] = e.split("/");
  return `/initiatives/${encodeURIComponent(i)}/${encodeURIComponent(r)}/${t}`;
}, he = {
  getConfig: () => ae("/config"),
  putConfig: (e) => ae("/config", "PUT", e),
  discoverRepos: () => ae("/repos/discover"),
  addRepo: (e) => ae("/repos", "POST", { path: e }),
  removeRepo: (e) => ae("/repos/remove", "POST", { slug: e }),
  browse: (e) => ae(e ? `/browse?path=${encodeURIComponent(e)}` : "/browse"),
  listInitiatives: () => ae("/initiatives"),
  startInitiative: (e) => ae("/initiatives", "POST", e),
  getInitiative: (e, t) => ae(Te(e, t)),
  // Next along the path, or `to` a later column.
  advance: (e, t, i, r = null) => ae(`${Te(e, t)}/advance`, "POST", { force: i, to: r }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (e, t, i) => ae(`${Te(e, t)}/session`, "POST", { skill: null, ticket: null, mode: null, ...i }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (e, t, i) => ae(`${Te(e, t)}/sessions/started`, "POST", { key: i }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (e, t, i) => ae(`${Te(e, t)}/sessions/closed`, "POST", { keys: i }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (e, t, i) => ae(`${Te(e, t)}/sessions/activity`, "POST", { activity: i }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (e, t, i, r, l) => ae(`${Te(e, t)}/sessions/woken`, "POST", { key: i, stall: r, why: l }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (e, t, i) => ae(`${Te(e, t)}/skill`, "POST", { skill: i }),
  listSessions: () => ae("/sessions"),
  tree: (e = !1) => ae(e ? "/tree?completed=1" : "/tree"),
  // A background session's recent transcript, when the dashboard never opened
  // it as a page (so the embedded chat would be empty).
  sessionTail: (e, t = 60) => ae(
    `/sessions/tail?slot=${encodeURIComponent(e)}&limit=${t}`
  ),
  // The green dot: on the sidebar or off. Nothing changes on GitHub.
  setOnSidebar: (e, t, i, r) => ae("/sidebar", "POST", { repo: e, number: t, kind: i, on: r }),
  // Off the sidebar and back; nothing changes on GitHub.
  hide: (e, t) => ae(`${Te(e, t)}/hide`, "POST", {}),
  unhide: (e, t) => ae(`${Te(e, t)}/unhide`, "POST", {}),
  removeInitiative: (e, t) => ae(`${Te(e, t)}/remove`, "POST", {}),
  ticket: (e, t, i) => ae(`${Te(e, t)}/tickets/${i}`),
  frontier: (e, t) => ae(`${Te(e, t)}/frontier`),
  doc: (e, t, i) => ae(`${Te(e, t)}/doc?href=${encodeURIComponent(i)}`)
};
function we(e) {
  return e instanceof Error ? e.message : String(e);
}
const gt = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Zn = {
  intake: "A raw issue, request or refactor candidate nobody has shaped yet.",
  shape: "Open questions: a wayfinder map, a prototype, research, a questionnaire waiting on someone.",
  grill: "An interview in progress. It updates GLOSSARY.md and adds ADRs.",
  plan: "A spec and the tickets that hang off it, with their blocking links.",
  build: "Tickets being built, or a branch with commits.",
  review: "A PR is open: the agent reviews it, fixes what it finds and merges it.",
  done: "Merged. /retro turns what went wrong into checks, standards and agent instructions."
}, Ot = {
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
}, eo = ["intake", "decide", "deliver", "done"], to = { intake: "Intake", decide: "Decide", deliver: "Deliver", done: "Done" }, no = {
  intake: ["intake"],
  decide: ["shape", "grill", "plan"],
  deliver: ["build", "review"],
  done: ["done"]
}, oo = (e) => eo.find((t) => no[t].includes(e)) ?? "intake", At = (e) => !e.answer && typeof e.title == "string" && e.title.trim() !== "", v = {
  body: 13,
  small: 12,
  tiny: 11,
  title: 15
}, ht = {
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: v.body,
  width: "100%",
  minWidth: 0
}, K = { color: "var(--muted)" }, Se = { color: "var(--text-strong, var(--text))", fontWeight: 600 };
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
function mn({ path: e }) {
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
function Qt({ children: e, onClick: t, disabled: i, primary: r, danger: l, title: g }) {
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
function yt({ title: e, aside: t, children: i, defaultOpen: r = !0 }) {
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
          /* @__PURE__ */ o("span", { "aria-hidden": !0, style: { ...K, width: 10, fontSize: 9 }, children: l ? "▾" : "▸" }),
          /* @__PURE__ */ o("span", { style: Se, children: e }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          t != null && /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.tiny }, children: t })
        ]
      }
    ),
    l && /* @__PURE__ */ o("div", { style: { padding: "0 12px 10px 28px", fontSize: v.body }, children: i })
  ] });
}
function Xt(e) {
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
function $t({ kind: e, map: t }) {
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
function yn({ busy: e, onAdd: t, actionLabel: i = "Add" }) {
  var d;
  const [r, l] = O(null), [g, f] = O(""), m = He(async (s) => {
    f("");
    try {
      l(await he.browse(s));
    } catch (h) {
      f(we(h));
    }
  }, []);
  return Q(() => {
    m();
  }, [m]), /* @__PURE__ */ u(
    "div",
    {
      className: "rounded-md p-3 mb-3",
      style: { background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ o(Ge, { children: g }),
        r ? /* @__PURE__ */ u(be, { children: [
          /* @__PURE__ */ u("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ o(ze, { disabled: !r.parent, onClick: () => r.parent && m(r.parent), children: "Up" }),
            /* @__PURE__ */ o(mn, { path: r.path }),
            ((d = r.here) == null ? void 0 : d.slug) && /* @__PURE__ */ u(ze, { primary: !0, disabled: e === r.path, onClick: () => t(r.path), children: [
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
              s.repo && (s.slug ? /* @__PURE__ */ u(be, { children: [
                /* @__PURE__ */ o(Ft, { variant: "aim", children: s.slug }),
                /* @__PURE__ */ o(ze, { primary: !0, disabled: e === s.path, onClick: () => t(s.path), children: i })
              ] }) : /* @__PURE__ */ o(Ft, { variant: "muted", children: "no GitHub remote" }))
            ] }, s.path)),
            r.folders.length === 0 && /* @__PURE__ */ o("li", { className: "text-sm text-muted", children: "No folders here." })
          ] })
        ] }) : /* @__PURE__ */ o("p", { className: "text-sm text-muted", children: "Opening your home folder…" })
      ]
    }
  );
}
function io({ onAdded: e, onClose: t }) {
  const [i, r] = O(null), [l, g] = O(""), [f, m] = O(!1), [d, s] = O(null);
  Q(() => {
    let n = !0;
    return he.tree().then((c) => {
      n && r(c.available);
    }).catch((c) => {
      n && (r([]), g(we(c)));
    }), () => {
      n = !1;
    };
  }, []), Q(() => {
    const n = (c) => {
      c.key === "Escape" && t();
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [t]);
  const h = async (n) => {
    s(n), g("");
    try {
      await he.addRepo(n), e(), t();
    } catch (c) {
      g(we(c));
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
                /* @__PURE__ */ o("div", { style: { ...Se, fontSize: v.body }, children: "Add a repo" }),
                /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.tiny, marginTop: 1 }, children: "It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed." })
              ] }),
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  onClick: t,
                  "aria-label": "Close",
                  style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "inline-flex" },
                  children: /* @__PURE__ */ o(Kn, { size: 15 })
                }
              )
            ] }),
            /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 14px" }, children: [
              /* @__PURE__ */ o(Ge, { children: l }),
              i === null && /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small, padding: "6px 6px" }, children: "Looking for checkouts on this Mac…" }),
              i !== null && i.length > 0 && !f && /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column" }, children: i.slice(0, 12).map((n) => /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  disabled: !!d,
                  onClick: () => void h(n.path),
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
                    /* @__PURE__ */ o(fn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: d === n.path ? "Adding…" : n.slug }),
                    n.maps > 0 && /* @__PURE__ */ u("span", { style: { ...K, fontSize: v.tiny, flexShrink: 0 }, children: [
                      n.maps,
                      " open map",
                      n.maps === 1 ? "" : "s"
                    ] })
                  ]
                },
                n.path
              )) }),
              i !== null && i.length === 0 && !f && /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small, padding: "6px 6px" }, children: "No un-added checkouts found under your home folder. Browse for one:" }),
              f ? /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(yn, { busy: d, onAdd: (n) => void h(n) }) }) : /* @__PURE__ */ u(
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
                    /* @__PURE__ */ o(Gn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    "Browse for a folder…"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ o("div", { style: { display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderTop: "1px solid var(--border)" }, children: /* @__PURE__ */ o(ze, { onClick: t, children: "Cancel" }) })
          ]
        }
      )
    }
  );
}
const bn = "kipo.layout.v1";
function Vt() {
  try {
    return JSON.parse(localStorage.getItem(bn) || "{}");
  } catch {
    return {};
  }
}
function vn(e, t, i, r) {
  const l = He((d) => Math.round(Math.min(r, Math.max(i, d))), [i, r]), [g, f] = O(() => {
    const d = Vt()[e];
    return l(typeof d == "number" ? d : t);
  });
  Q(() => {
    const d = Vt();
    d[e] = g;
    try {
      localStorage.setItem(bn, JSON.stringify(d));
    } catch {
    }
  }, [e, g]);
  const m = He((d) => {
    f((s) => l(typeof d == "function" ? d(s) : d));
  }, [l]);
  return [g, m];
}
function wn({ direction: e, onDrag: t, onReset: i, label: r }) {
  const l = fe(null), [g, f] = O(!1), [m, d] = O(!1), s = e === "vertical", h = (T) => s ? T.clientX : T.clientY;
  Q(() => {
    if (!g) return;
    const T = (D) => {
      if (l.current == null) return;
      const q = h(D), P = q - l.current;
      P && (l.current = q, t(P));
    }, _ = () => {
      l.current = null, f(!1);
    };
    return window.addEventListener("pointermove", T), window.addEventListener("pointerup", _), window.addEventListener("pointercancel", _), () => {
      window.removeEventListener("pointermove", T), window.removeEventListener("pointerup", _), window.removeEventListener("pointercancel", _);
    };
  }, [g, t]);
  const n = (T) => {
    T.preventDefault(), l.current = h(T), f(!0);
  }, c = (T) => {
    const _ = T.shiftKey ? 40 : 10, D = s ? "ArrowLeft" : "ArrowUp", q = s ? "ArrowRight" : "ArrowDown";
    T.key === D && (T.preventDefault(), t(-_)), T.key === q && (T.preventDefault(), t(_));
  }, I = g || m, j = s ? { width: 9, margin: "0 -4px", cursor: "col-resize", alignSelf: "stretch" } : { height: 9, margin: "-4px 0", cursor: "row-resize", width: "100%" };
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
      style: { ...j, flexShrink: 0, position: "relative", zIndex: 2, touchAction: "none", display: "flex", justifyContent: "center", alignItems: "center" },
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
function ro(e, t, i = 0.75) {
  const [r, l] = vn(e, 0, 0, 4e3), g = fe(null), f = He((d) => {
    const s = Math.round(window.innerHeight * i);
    l((h) => {
      var c;
      const n = h || ((c = g.current) == null ? void 0 : c.offsetHeight) || t;
      return Math.max(t, Math.min(s, n + d));
    });
  }, [t, i, l]), m = r ? { flex: `0 0 ${r}px`, minHeight: 0, overflowY: "auto" } : { flex: "0 1 auto", minHeight: 0, maxHeight: `${Math.round(i * 100)}%`, overflowY: "auto" };
  return { ref: g, style: m, onDrag: f, reset: () => l(0) };
}
const Et = "kipo.cache.v3:";
try {
  for (let e = localStorage.length - 1; e >= 0; e--) {
    const t = localStorage.key(e);
    t && t.startsWith("kipo.cache.") && !t.startsWith(Et) && localStorage.removeItem(t);
  }
} catch {
}
const ft = /* @__PURE__ */ new Map();
function rt(e) {
  if (ft.has(e)) return ft.get(e);
  try {
    const t = localStorage.getItem(Et + e);
    if (t == null) return null;
    const i = JSON.parse(t);
    return ft.set(e, i), i;
  } catch {
    return null;
  }
}
function st(e, t) {
  ft.set(e, t);
  try {
    localStorage.setItem(Et + e, JSON.stringify(t));
  } catch {
  }
}
const so = "KiPo", Zt = "kipo.sessionsFiled.v2", lo = (e) => {
  var i;
  const t = (e == null ? void 0 : e.id) ?? ((i = e == null ? void 0 : e.folder) == null ? void 0 : i.id);
  if (!t) throw new Error("the sidebar didn't return the new folder");
  return t;
};
async function kn(e, t, i, r) {
  const l = await e.get("/api/chat/folders"), g = l == null ? void 0 : l.find((f) => f.name === t && (f.parent_id || null) === i);
  return g ? g.id : lo(await e.post("/api/chat/folders", {
    name: t,
    ...i ? { parent_id: i } : {},
    ...r ? { icon: r } : {}
  }));
}
const ao = (e) => kn(e, so, null, "⚗️"), co = (e) => e.split("/").pop() || e;
async function xn(e, t) {
  const i = await ao(e);
  try {
    return await kn(e, co(t), i);
  } catch {
    return i;
  }
}
async function uo(e) {
  if (localStorage.getItem(Zt)) return;
  const { byRepo: t } = await he.listSessions(), i = /* @__PURE__ */ new Map();
  for (const { repo: r } of t ?? [])
    i.has(r) || i.set(r, await xn(e, r));
  await Promise.all((t ?? []).map(
    ({ slot: r, repo: l }) => e.patch(`/api/chat/slots/${encodeURIComponent(r)}/folder`, { folder_id: i.get(l) }).catch(() => {
    })
    // a session that was closed or deleted is simply skipped
  )), localStorage.setItem(Zt, (/* @__PURE__ */ new Date()).toISOString());
}
const Sn = {
  position: "fixed",
  zIndex: 99999,
  background: "var(--bg-elevated, #2a2a2a)",
  border: "1px solid var(--border, rgba(255,255,255,0.15))",
  borderRadius: 6,
  boxShadow: "0 4px 12px var(--shadow, rgba(0,0,0,0.5))"
};
function $n(e, t, i) {
  const r = fe(null), [l, g] = O({ x: e, y: t });
  return _n(() => {
    const f = r.current;
    if (!f) return;
    const m = f.getBoundingClientRect();
    g({
      x: e + m.width > window.innerWidth ? Math.max(0, e - m.width) : e,
      y: t + m.height > window.innerHeight ? Math.max(0, t - m.height) : t
    });
  }, [e, t]), Q(() => {
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
function en({ x: e, y: t, items: i, onClose: r }) {
  const { ref: l, pos: g } = $n(e, t, r);
  return Q(() => {
    var f, m;
    (m = (f = l.current) == null ? void 0 : f.querySelector("[role=menuitem]")) == null || m.focus();
  }, [l]), /* @__PURE__ */ o("div", { ref: l, role: "menu", style: { ...Sn, left: g.x, top: g.y, padding: "4px 0", minWidth: 160 }, children: i.map((f, m) => {
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
        onClick: (h) => {
          h.stopPropagation(), s();
        },
        onKeyDown: (h) => {
          (h.key === "Enter" || h.key === " ") && (h.preventDefault(), s());
        },
        onMouseEnter: (h) => {
          h.currentTarget.style.background = "rgba(255,255,255,0.1)";
        },
        onMouseLeave: (h) => {
          h.currentTarget.style.background = "transparent";
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
function bt({ x: e, y: t, title: i, children: r, action: l, onConfirm: g, onClose: f }) {
  const { ref: m, pos: d } = $n(e, t, f);
  return /* @__PURE__ */ u(
    "div",
    {
      ref: m,
      role: "alertdialog",
      "aria-label": i,
      style: { ...Sn, left: d.x, top: d.y, padding: "12px 14px", width: 280 },
      children: [
        /* @__PURE__ */ o("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e0e0e0)", lineHeight: 1.35 }, children: i }),
        r && /* @__PURE__ */ o("div", { style: { fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6, lineHeight: 1.45 }, children: r }),
        /* @__PURE__ */ u("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ o(ze, { onClick: f, children: "Cancel" }),
          /* @__PURE__ */ o(ze, { danger: !0, onClick: () => {
            f(), g();
          }, children: l })
        ] })
      ]
    }
  );
}
const po = {
  Gr: "Gr = Grilling: a decision ticket, settled by an interview with you (HITL)",
  Pr: "Pr = Prototype: a decision ticket, settled by building something throwaway to react to",
  Rs: "Rs = Research: a decision ticket, settled by an agent reading primary sources",
  Tk: "Tk = Task: a decision-side ticket of plain work on the wayfinder map",
  Bd: "Bd = Build: a spec ticket that ships code (Deliver)",
  Is: "Is = Issue: the source issue, or a plain follow-up filed on the map"
}, Ye = {
  you: "HITL = human in the loop: open, unblocked, and it needs a person",
  afk: "Agent (AFK = away from keyboard): open, unblocked, and an agent can take it on its own",
  building: "In progress: an agent is building it",
  review: "In review: its pull request is open",
  blocked: "Blocked: waiting on a ticket that is still open",
  done: "Done: closed",
  fog: "Fog: in scope but not yet specified — listed in the map's Not yet specified section, not a ticket yet"
}, mt = {
  HITL: Ye.you,
  AFK: Ye.afk,
  Agent: Ye.afk,
  PR: "PR = pull request on GitHub",
  Fog: Ye.fog,
  Decide: "Decide: the wayfinder map — decision tickets that settle what to build",
  Deliver: "Deliver: the spec tickets — the work that ships it",
  Origin: "Origin: the issue the effort started from",
  "hand-over": "Hand-over: the spec tickets were cut from the decided wayfinder map",
  spec: "Spec tickets: the build tickets cut from the spec, labelled kipo:<effort number>",
  kipo: "kipo:<n>: the label that ties a ticket to effort #<n>",
  map: "Wayfinder map: the issue that lists the effort’s decision tickets and its fog"
}, ho = (e) => [po[e.code], Ye[e.state]].filter(Boolean).join(`
`);
function fo({ term: e, title: t, children: i }) {
  return /* @__PURE__ */ o(
    "abbr",
    {
      title: t ?? (e ? mt[e] : void 0),
      style: { textDecoration: "underline dotted", textDecorationColor: "color-mix(in srgb, currentColor 45%, transparent)", textUnderlineOffset: 2, cursor: "help" },
      children: i
    }
  );
}
const A = {
  done: { label: "done", color: "#3fae6a", text: "#7fd39a" },
  review: { label: "in review", color: "#a78bfa", text: "#a78bfa" },
  building: { label: "building", color: "#60a5fa", text: "#60a5fa" },
  you: { label: "HITL", color: "#f5b14c", text: "#f5b14c" },
  afk: { label: "agent", color: "#2dd4bf", text: "#2dd4bf" },
  blocked: { label: "blocked", color: "#c2615b", text: "#e08a85" },
  fog: { label: "fog", color: "transparent", text: "var(--muted)" }
};
function tn({ tile: e, onClick: t, size: i = 34, open: r, status: l, bare: g, numberOnly: f, width: m }) {
  const d = A[e.state], s = e.state !== "blocked", h = e.state === "done", n = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((I) => `#${I}`).join(", ")}` : `#${e.number} ${e.title}: ${d.label}`;
  return /* @__PURE__ */ u(
    "button",
    {
      type: "button",
      onClick: t,
      title: `${n}${l === "running" ? " · agent working" : l === "attention" ? " · needs you: a trust prompt or question" : l === "waiting" ? " · awaiting input" : ""}

${ho(e)}`,
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
        background: h ? "rgba(63,174,106,.22)" : s ? d.color : "transparent",
        color: h ? "#7fd39a" : s ? "#14121c" : "var(--muted)",
        border: s ? "1px solid transparent" : `1.5px solid ${d.color}`
      },
      children: [
        f ? e.number : /* @__PURE__ */ u(be, { children: [
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
async function go(e, t, i, r, l, g) {
  let f;
  try {
    f = await xn(e, t);
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
const In = "kipo.closedSessions.v1", De = (e) => !!e && Mt().has(e);
function Mt() {
  try {
    return new Set(JSON.parse(localStorage.getItem(In) || "[]"));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function It(e) {
  const t = Mt();
  t.add(e);
  try {
    localStorage.setItem(In, JSON.stringify([...t].slice(-500)));
  } catch {
  }
}
async function nn(e, t) {
  try {
    await e.del(`/api/chat/slots/${encodeURIComponent(t)}`);
  } catch (i) {
    if (!/404|not.?found/i.test(String((i == null ? void 0 : i.message) ?? i))) return !1;
  }
  return It(t), !0;
}
async function on(e, t, i) {
  const r = Mt(), l = [];
  for (const g of t)
    if (!(!g || g === i)) {
      if (r.has(g)) {
        l.push(g);
        continue;
      }
      try {
        const f = await e.get(`/api/chat/slots/${encodeURIComponent(g)}?limit=1`);
        if (f != null && f.running) continue;
        await e.del(`/api/chat/slots/${encodeURIComponent(g)}`), It(g), l.push(g);
      } catch (f) {
        /404|not.?found/i.test(String((f == null ? void 0 : f.message) ?? f)) && (It(g), l.push(g));
      }
    }
  return l;
}
const mo = [
  { id: "intake", label: "Intake", skill: "kipo-intake", matt: ["setup-matt-pocock-skills", "ask-matt", "triage", "improve-codebase-architecture"], what: "Set the repo up, triage the issue, pick a start" },
  { id: "shape", label: "Shape", skill: "kipo-shape", matt: ["wayfinder", "research", "prototype", "to-questionnaire"], any: ["handoff", "teach"], what: "Huge, foggy: chart the map, work its decision tickets" },
  { id: "grill", label: "Grill", skill: "kipo-grill", matt: ["grill-with-docs", "grill-me", "grilling", "domain-modeling"], any: ["wait-what"], what: "An idea: interview until it's sharp" },
  { id: "plan", label: "Plan", skill: "kipo-plan", matt: ["to-spec", "to-tickets", "codebase-design"], what: "Hand-over: spec, then tickets" },
  { id: "build", label: "Build", skill: "kipo-build", matt: ["implement", "implement-spec", "tdd", "diagnosing-bugs", "wizard"], what: "One ticket per session, test-first, open a PR" },
  { id: "review", label: "Review", skill: "kipo-review", matt: ["code-review", "pr"], what: "Review, then merge by Merge Danger" },
  { id: "done", label: "Done", skill: "kipo-done", matt: ["retro", "writing-for-agents"], what: "Retro the run, tidy the docs" }
], yo = (e) => e.state === "done" ? "done" : e.source ? "intake" : e.state === "review" ? "review" : e.type === "build" ? "build" : e.type === "grilling" ? "grill" : "shape", Rn = "kipo.sentAnswers.v1", Rt = 2 * 60 * 60 * 1e3, bo = () => {
  try {
    const e = JSON.parse(localStorage.getItem(Rn) || "{}"), t = Date.now();
    return new Map(Object.entries(e).filter((i) => typeof i[1] == "number" && t - i[1] < Rt));
  } catch {
    return /* @__PURE__ */ new Map();
  }
}, ct = bo(), Wt = () => {
  try {
    localStorage.setItem(Rn, JSON.stringify(Object.fromEntries(ct)));
  } catch {
  }
}, vo = (e, t) => {
  ct.set(`${e}:${t}`, Date.now()), Wt();
}, wo = (e, t) => {
  ct.delete(`${e}:${t}`) && Wt();
}, Ht = (e, t) => {
  const i = ct.get(`${e}:${t}`);
  return i && Date.now() - i >= Rt && (ct.delete(`${e}:${t}`), Wt()), !!i && Date.now() - i < Rt;
};
function ko(e) {
  const t = (h, n = 0) => h.you ? { color: A.you.color, active: !0 } : h.blocked ? { color: A.blocked.color, active: !0 } : h.building ? { color: A.building.color, active: !0 } : h.afk ? { color: A.afk.color, active: !0 } : h.review ? { color: A.review.color, active: !0 } : n ? { color: "var(--muted)", active: !0 } : h.done ? { color: A.done.color, active: !1 } : { color: null, active: !1 }, i = [
    { id: "intake", ...t(e.intake) },
    { id: "shape", ...t(e.shape, e.fog) },
    { id: "grill", ...t(e.grill) },
    {
      id: "plan",
      ...e.specCut ? { color: A.done.color, active: !1 } : e.handover ? { color: A.you.color, active: !0 } : { color: null, active: !1 }
    },
    { id: "build", ...t(e.build) },
    {
      id: "review",
      ...e.prs.open ? { color: A.review.color, active: !0 } : e.prs.merged ? { color: A.done.color, active: !1 } : { color: null, active: !1 }
    },
    {
      id: "done",
      ...e.landed ? e.retro ? { color: A.done.color, active: !1 } : { color: A.you.color, active: !0 } : { color: null, active: !1 }
    }
  ], r = { intake: "Intake", shape: "Shape", grill: "Grill", plan: "Plan", build: "Build", review: "Review", done: "Done" }, l = [...i].reverse().find((h) => h.active), g = l ? r[l.id] : e.total || e.prs.merged ? "Done" : "—", f = e.intake.you + e.shape.you + e.grill.you + e.build.you + (e.handover ? 1 : 0) + (e.landed && !e.retro ? 1 : 0), m = e.shape.building + e.grill.building + e.build.building + e.intake.building, d = e.shape.afk + e.grill.afk + e.build.afk + e.intake.afk, s = [
    e.doneTiles ? `${e.doneTiles}/${e.total} done` : "",
    f ? `${f} HITL` : "",
    m ? `${m} in agents` : "",
    d ? `${d} ready` : "",
    e.prs.open ? `${e.prs.open} PR${e.prs.open === 1 ? "" : "s"}` : "",
    e.fog ? `${e.fog} fog` : ""
  ].filter(Boolean);
  return { segs: i, front: g, bits: s.slice(0, 4).join(" · ") };
}
function xo({ glance: e }) {
  return /* @__PURE__ */ o("span", { style: { display: "flex", gap: 2, height: 5 }, "aria-hidden": !0, children: e.segs.map((t) => /* @__PURE__ */ o("span", { title: t.id, style: {
    flex: 1,
    borderRadius: 3,
    background: t.color ?? "transparent",
    border: t.color ? "1px solid transparent" : "1px solid var(--border)",
    opacity: t.color && !t.active ? 0.75 : 1
  } }, t.id)) });
}
const ot = ["intake", "shape", "grill", "plan", "build", "review", "done"], So = { idea: "grill", small: "grill", huge: "shape", issue: "intake", bug: "build" }, $o = { idea: "an idea", small: "small", huge: "huge", issue: "an issue", bug: "a bug" }, rn = {
  intake: "source issues",
  shape: "map tickets",
  grill: "questions",
  plan: "spec → tickets",
  build: "tickets",
  review: "PRs",
  done: "merged · retro"
}, lt = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Ve = (e, t) => ({ n: e, color: A[t].color });
function Io(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function Ro({ detail: e, statuses: t, activity: i, busy: r, autopilot: l, selectedKey: g, embedded: f, compact: m, onAutopilot: d, onOpenTile: s, onOpenConversation: h, onSelectConductor: n, onJumpQuestions: c, onHandover: I, onReview: j, onRetro: T, onClose: _ }) {
  var We, Be, Ze, ve;
  const [D, q] = O(!1), P = (y, Y) => ((y == null ? void 0 : y.decisions) ?? []).filter((U) => At(U) && !(Y && Ht(Y, U.id))).length, te = (y) => {
    var Y;
    return y ? P((Y = e.sessionStates) == null ? void 0 : Y[y], e.sessions[y]) : 0;
  }, ne = P(((We = e.sessionStates) == null ? void 0 : We.conductor) ?? e.state, e.sessions.conductor), E = (y) => ({ label: y === 1 ? "1 question" : `${y} questions`, color: A.you.color }), S = e.frontier, M = (S == null ? void 0 : S.tiles) ?? [], N = (Be = S == null ? void 0 : S.fogItems) != null && Be.length ? S.fogItems : (S == null ? void 0 : S.fogLeft) ?? [], ie = !((Ze = S == null ? void 0 : S.fogItems) != null && Ze.length) && !!((ve = S == null ? void 0 : S.fogLeft) != null && ve.length), le = new Map(ot.map((y) => [y, []]));
  for (const y of M) le.get(yo(y)).push(y);
  const ge = (y) => y.source ? "intake" : y.type === "build" ? "build" : y.type === "grilling" ? "grill" : "shape", Z = new Map(ot.map((y) => [y, []]));
  for (const y of M) Z.get(ge(y)).push(y);
  const ce = So[e.start] ?? "grill", F = ot.indexOf(ce), b = Z.get("build"), W = e.artifacts.find((y) => y.label === "Spec" || y.label.startsWith("Spec")), H = e.prs.filter((y) => y.state === "OPEN"), L = e.prs.filter((y) => y.state === "MERGED"), re = M.filter((y) => y.state === "done").length, G = !!e.sessions.done, de = (y) => {
    var Fe;
    const Y = y.state !== "done" ? te(y.sessionKey) : 0, U = t[y.number], V = U === "attention" ? ((Fe = i == null ? void 0 : i[y.number]) == null ? void 0 : Fe.needs) ?? null : null, Ue = U === "running" || U === "attention", Ce = U === "attention" || Y > 0 || y.state === "you";
    return {
      key: `t${y.number}`,
      number: y.number,
      title: y.title,
      tile: y,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: Y ? E(Y) : V === "approval" ? { label: "trust prompt", color: A.you.color } : V === "input" ? { label: "asking", color: A.you.color } : { label: A[y.state].label, color: y.state === "done" ? A.done.text : A[y.state].color, solid: y.state === "you" || y.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Ue || Ce,
      attention: Ce,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Ue ? i == null ? void 0 : i[y.number] : void 0,
      questions: Y,
      selKeys: [`build-t${y.number}`, `shape-t${y.number}`, `review-t${y.number}`]
    };
  }, J = (y) => {
    const Y = (U) => y.filter((V) => V.state === U).length;
    return { done: Y("done"), you: Y("you"), afk: Y("afk"), building: Y("building"), review: Y("review"), blocked: Y("blocked") };
  }, me = (y) => {
    const Y = ["you", "building", "afk", "review", "blocked", "done"];
    return [...y].sort((U, V) => Y.indexOf(U.state) - Y.indexOf(V.state) || U.number - V.number);
  }, Ae = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, ke = (y) => {
    const Y = e.sessions[y];
    if (!Y || De(Y)) return [];
    const U = te(y);
    return [{
      key: `conv-${y}`,
      title: Ae[y] ?? "Its conversation",
      chip: U ? E(U) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => h(y),
      questions: U,
      selKeys: [y]
    }];
  }, $e = ot.map((y) => {
    const Y = Z.get(y), U = ke(y === "build" ? "build-spec" : y);
    if (y === "plan") {
      if (b.length || W)
        return { id: y, state: "full", count: /* @__PURE__ */ u(be, { children: [
          /* @__PURE__ */ o("b", { style: Se, children: "1 spec" }),
          " → ",
          b.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: A.done.color }], rows: U };
      if (S != null && S.handover)
        return {
          id: y,
          state: "live",
          count: /* @__PURE__ */ o("b", { style: { color: A.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: A.you.color }],
          rows: U,
          // Once the conversation exists, its row above is the way back in.
          action: U.length ? void 0 : { label: "Write the spec", onClick: I }
        };
      const pe = M.filter((xe) => xe.lane === "decide" && xe.state !== "done").length;
      return { id: y, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${pe || "the"} decision${pe === 1 ? "" : "s"}${N.length ? ` and ${N.length} fog` : ""}`, segments: [], rows: U };
    }
    if (y === "review")
      return !H.length && !L.length && !U.length ? { id: y, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: y,
        state: H.length ? "live" : "full",
        count: /* @__PURE__ */ u(be, { children: [
          /* @__PURE__ */ u("b", { style: Se, children: [
            L.length,
            " merged"
          ] }),
          H.length ? /* @__PURE__ */ u(be, { children: [
            " · ",
            H.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: L.length, color: A.done.color }, { n: H.length, color: A.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...U, ...H.map((pe) => {
          const xe = pe.tickets[0];
          return {
            key: `pr${pe.number}`,
            number: pe.number,
            title: pe.title,
            chip: { label: "open", color: A.review.color },
            ...xe != null ? { onOpen: () => h(`review-t${xe}`), selKeys: [`review-t${xe}`] } : { url: pe.url }
          };
        })],
        action: H.length && !U.length ? { label: "Review the PRs", onClick: j } : void 0
      };
    if (y === "done") {
      const pe = !!(S != null && S.landed), xe = pe && G && e.kind !== "map";
      return {
        id: y,
        state: re ? pe ? "live" : "full" : "queued",
        count: re ? /* @__PURE__ */ u(be, { children: [
          /* @__PURE__ */ u("b", { style: Se, children: [
            re,
            " of ",
            M.length
          ] }),
          " · ",
          G ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: re ? void 0 : "closes when the retro runs",
        segments: [{ n: re, color: A.done.color }, { n: Math.max(0, M.length - re), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...U, ...M.filter((Je) => Je.state === "done").sort((Je, et) => Je.number - et.number).map(de)],
        action: pe && !G ? { label: "Run /retro", onClick: T } : xe ? D ? { label: "Close the effort and its issue?", onClick: () => {
          q(!1), _();
        }, confirm: () => q(!1) } : { label: "Close effort", onClick: () => q(!0) } : void 0
      };
    }
    if (!Y.length && !(y === "shape" && N.length) && !U.length)
      return ot.indexOf(y) < F ? { id: y, state: "skipped", count: `entered at ${lt[ce]}`, segments: [], rows: [] } : y === "build" ? { id: y, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: y, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const V = J(Y), Ue = V.you + V.afk + V.building + V.review + V.blocked > 0 || !Y.length && U.length > 0, Ce = [];
    y === "grill" ? (V.done && Ce.push(`${V.done} answered`), V.you && Ce.push(`${V.you} waiting`)) : (V.done && Ce.push(`${V.done} done`), V.you && Ce.push(`${V.you} HITL`)), V.building && Ce.push(`${V.building} in agents`), V.afk && Ce.push(`${V.afk} ready`), V.review && Ce.push(`${V.review} in review`), V.blocked && Ce.push(`${V.blocked} blocked`);
    const Fe = [Ve(V.done, "done"), Ve(V.building, "building"), Ve(V.review, "review"), Ve(V.you, "you"), Ve(V.afk, "afk"), Ve(V.blocked, "blocked")];
    y === "shape" && N.length && Fe.push({ n: N.length, color: "transparent", dashed: !0 });
    const Qe = [...U, ...me(Y.filter((pe) => pe.state !== "done")).map(de)];
    return y === "shape" && N.forEach((pe, xe) => Qe.push({
      key: `fog${xe}`,
      title: To(pe),
      chip: ie ? { label: "left unspecified", color: A.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: y,
      state: Ue ? "live" : "full",
      count: /* @__PURE__ */ u(be, { children: [
        Ce.map((pe, xe) => xe === 0 ? /* @__PURE__ */ o("b", { style: Se, children: pe }, pe) : /* @__PURE__ */ u("span", { children: [
          " · ",
          pe
        ] }, pe)),
        y === "shape" && N.length ? /* @__PURE__ */ u("span", { children: [
          " · ",
          N.length,
          " fog"
        ] }) : null
      ] }),
      segments: Fe,
      rows: Qe
    };
  }), Pe = (y) => y.state === "live", Le = $e.reduce((y, Y, U) => Pe(Y) ? U : y, -1), Ee = Le >= 0 ? $e[Le] : null, ye = J(M), a = M.length, z = [
    { n: ye.building, label: "in agents", color: A.building.color },
    { n: ye.review, label: "in review", color: A.review.color },
    { n: ye.you, label: "HITL", color: A.you.color },
    { n: ye.afk, label: "ready", color: A.afk.color },
    { n: ye.blocked, label: "blocked", color: A.blocked.color },
    { n: N.length, label: "fog", color: "var(--muted)" }
  ].filter((y) => y.n > 0), [X, oe] = O(() => new Set(Ee ? [Ee.id] : [])), Ie = (y) => oe((Y) => {
    const U = new Set(Y);
    return U.has(y) ? U.delete(y) : U.add(y), U;
  }), Oe = ne + $e.reduce((y, Y) => y + Y.rows.reduce((U, V) => U + (V.questions ?? 0), 0), 0), Ne = Object.values(i ?? {}).filter((y) => y && (y.needs === "approval" || y.needs === "input")).length, qe = M.filter((y) => y.state === "you" && t[y.number] !== "attention" && !te(y.sessionKey)).length, ue = g === "conductor", Me = !!e.sessions.conductor && !De(e.sessions.conductor), Re = m ? 10 : 16;
  return /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, ...f ? {} : { height: "100%" } }, children: [
    /* @__PURE__ */ u("div", { style: { padding: `10px ${Re}px 9px`, borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ u("span", { style: { ...K, fontSize: v.tiny, flex: 1 }, children: [
          "entered at ",
          lt[ce],
          " (",
          $o[e.start] ?? e.start,
          ")"
        ] }),
        !f && /* @__PURE__ */ o("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.tiny, whiteSpace: "nowrap" }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }, children: a > 0 ? /* @__PURE__ */ u(be, { children: [
        /* @__PURE__ */ u("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ u("b", { style: { color: A.done.text }, children: [
            ye.done,
            " of ",
            a
          ] }),
          " ",
          /* @__PURE__ */ o("span", { style: K, children: "done" })
        ] }),
        z.map((y) => /* @__PURE__ */ u("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ o("b", { style: { color: y.color }, children: y.n }),
          " ",
          /* @__PURE__ */ o("span", { style: K, children: y.label })
        ] }, y.label))
      ] }) : /* @__PURE__ */ o("span", { style: K, children: N.length ? `${N.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
      (Oe > 0 || Ne > 0 || qe > 0) && // The pill only shows when something is waiting on the human, so it
      // pulses the moment it appears — the same amber attention cue the
      // session cards use, for questions, trust prompts/asks, and HITL.
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          onClick: c,
          className: "kipo-pulse",
          title: Ne > 0 ? "A session is stopped on a trust prompt or an ask: open it to allow or answer" : qe > 0 ? "A ticket is in HITL, waiting on you: open it to act" : "Jump to the next conversation with open questions; answer them on the right",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 6,
            padding: "2px 9px",
            borderRadius: 99,
            background: A.you.color,
            color: "#14121c",
            fontSize: v.tiny,
            fontWeight: 700,
            cursor: "pointer",
            border: 0
          },
          children: [
            Io(Oe, Ne + qe),
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
            color: l ? A.afk.text : "var(--muted)"
          },
          children: [
            /* @__PURE__ */ o(
              "span",
              {
                "aria-hidden": !0,
                className: l ? "kipo-pulse" : void 0,
                style: { width: 7, height: 7, borderRadius: 999, background: l ? A.afk.color : "var(--muted)" }
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
      /* @__PURE__ */ o("div", { style: { padding: `9px ${Re}px`, borderBottom: "1px solid var(--border)" }, children: /* @__PURE__ */ u(
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
            background: ue ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: ue ? "var(--accent-fg, #fff)" : "var(--accent)"
          },
          children: [
            /* @__PURE__ */ o(gn, { size: 14, "aria-hidden": !0, style: { flexShrink: 0 } }),
            /* @__PURE__ */ o("span", { style: { flex: 1 }, children: "Conductor" }),
            ne > 0 ? /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${ue ? "var(--accent-fg, #fff)" : A.you.color}`,
              color: ue ? "var(--accent-fg, #fff)" : A.you.color
            }, children: ne === 1 ? "1 question" : `${ne} questions` }) : /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 400, opacity: 0.75 }, children: Me ? "conversation" : "not started" })
          ]
        }
      ) }),
      $e.map((y) => /* @__PURE__ */ o(
        Co,
        {
          s: y,
          busy: r,
          open: X.has(y.id),
          selectedKey: g,
          compact: m,
          onToggle: () => Ie(y.id),
          onOpenTile: s
        },
        y.id
      )),
      /* @__PURE__ */ u("div", { style: { display: "flex", gap: 12, alignItems: "center", padding: `9px ${Re}px`, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ o(it, { color: A.done.color, label: "done" }),
        /* @__PURE__ */ o(it, { color: A.building.color, label: "in agents" }),
        /* @__PURE__ */ o(it, { color: A.you.color, label: "HITL" }),
        /* @__PURE__ */ o(it, { color: A.afk.color, label: "ready" }),
        /* @__PURE__ */ o(it, { color: A.blocked.color, label: "blocked" })
      ] })
    ] })
  ] });
}
function it({ color: e, label: t }) {
  return /* @__PURE__ */ u("span", { children: [
    /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, background: e, marginRight: 4, verticalAlign: -1 } }),
    t
  ] });
}
function Co({ s: e, open: t, busy: i, selectedKey: r, compact: l, onToggle: g, onOpenTile: f }) {
  const m = e.state === "skipped" || e.state === "queued", d = e.rows.length > 0 || !!e.action, s = mo.find((c) => c.id === e.id), h = e.segments.reduce((c, I) => c + I.n, 0), n = e.rows.reduce((c, I) => c + (I.questions ?? 0), 0);
  return /* @__PURE__ */ u("div", { style: {
    borderBottom: "1px solid var(--border)",
    background: t ? "var(--bg-elevated)" : void 0,
    borderLeft: t ? `2px solid ${A.you.color}` : "2px solid transparent"
  }, children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        onClick: d ? g : void 0,
        "aria-expanded": d ? t : void 0,
        title: s ? `${lt[e.id]} · ${s.skill}
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
            /* @__PURE__ */ o(xt, { size: 12, "aria-hidden": !0, style: {
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
                title: l ? rn[e.id] : void 0,
                children: lt[e.id]
              }
            ),
            !l && /* @__PURE__ */ o("span", { style: { width: 92, flexShrink: 0, fontSize: 10, color: "var(--muted)" }, children: rn[e.id] }),
            /* @__PURE__ */ u("span", { style: { flex: 1, textAlign: "right", fontSize: v.small, minWidth: 0 }, children: [
              !t && n > 0 && /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: ".03em",
                textTransform: "uppercase",
                padding: "1px 6px",
                borderRadius: 99,
                border: `1px solid ${A.you.color}`,
                color: A.you.color,
                whiteSpace: "nowrap",
                marginRight: 6
              }, children: n === 1 ? "1 question" : `${n} questions` }),
              !t && !n && e.rows.some((c) => c.attention) && /* @__PURE__ */ o(
                "span",
                {
                  className: "kipo-pulse",
                  title: "A session in here needs you: a trust prompt, an ask, or HITL",
                  style: { display: "inline-block", width: 7, height: 7, borderRadius: 999, background: A.you.color, marginRight: 6 }
                }
              ),
              e.count
            ] })
          ] }),
          h > 0 && /* @__PURE__ */ o("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((c) => c.n > 0).map((c, I) => /* @__PURE__ */ o("span", { style: { flex: c.n, background: c.color, ...c.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, I)) }),
          e.ghost && /* @__PURE__ */ o("span", { style: { display: "block", fontSize: v.tiny, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }, children: e.ghost })
        ]
      }
    ),
    t && d && /* @__PURE__ */ u("div", { style: { margin: l ? "0 10px 10px 8px" : "0 16px 10px 14px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }, children: [
      e.action && /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: e.rows.length ? "1px solid var(--border)" : void 0 }, children: [
        /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.tiny, flex: 1 }, children: e.action.confirm ? "" : `${lt[e.id]}'s next step` }),
        /* @__PURE__ */ o(Qt, { primary: !0, disabled: i, onClick: e.action.onClick, children: e.action.label }),
        e.action.confirm && /* @__PURE__ */ o(Qt, { disabled: i, onClick: e.action.confirm, children: "Cancel" })
      ] }),
      e.rows.map((c) => {
        var _;
        const I = () => {
          c.onOpen ? c.onOpen() : c.tile ? f(c.tile) : c.url && window.open(c.url, "_blank", "noreferrer");
        }, j = !!c.onOpen || !!c.tile || !!c.url, T = !!r && !!((_ = c.selKeys) != null && _.includes(r));
        return /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            onClick: j ? I : void 0,
            disabled: !j,
            title: c.tile ? `#${c.number} ${c.title}
${Ye[c.tile.state]}
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
              background: T ? "var(--bg-elevated)" : "transparent",
              boxShadow: T ? "inset 2px 0 0 var(--accent)" : void 0,
              cursor: j ? "pointer" : "default"
            },
            onMouseEnter: (D) => {
              j && !T && (D.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (D) => {
              D.currentTarget.style.background = T ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ u("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: c.number != null ? `#${c.number}` : c.onOpen ? /* @__PURE__ */ o(gn, { size: 11, "aria-hidden": !0 }) : "☁" }),
                /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: c.title }),
                c.pulse && /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: c.attention ? A.you.color : A.building.color,
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
                    /* @__PURE__ */ o("span", { style: { color: A.building.color }, children: zo(c.live.at) }),
                    c.live.line ? /* @__PURE__ */ u(be, { children: [
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
const To = (e) => e.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
function zo(e) {
  const t = e ? Date.parse(e) : NaN;
  if (Number.isNaN(t)) return "running";
  const i = Math.round((Date.now() - t) / 6e4);
  return i < 1 ? "just now" : i < 60 ? `${i}m` : `${Math.round(i / 60)}h`;
}
const Cn = "kipo.rail.repoOpen", Oo = () => {
  try {
    return JSON.parse(localStorage.getItem(Cn) || "{}");
  } catch {
    return {};
  }
};
function sn() {
  return /* @__PURE__ */ o(
    "span",
    {
      className: "kipo-pulse",
      title: `${mt.HITL}: a session in here is stopped on a trust prompt or question`,
      style: { width: 7, height: 7, borderRadius: 999, background: "#f5b14c", flexShrink: 0 }
    }
  );
}
function Ao({ stage: e }) {
  return /* @__PURE__ */ o("span", { style: {
    flexShrink: 0,
    fontSize: 10,
    lineHeight: "15px",
    padding: "0 6px",
    borderRadius: 999,
    border: "1px solid var(--accent)",
    color: "var(--accent)",
    whiteSpace: "nowrap"
  }, children: to[e] });
}
function Eo({ width: e, items: t, repos: i, error: r, notice: l, selected: g, attention: f, spineSlot: m, onNew: d, onAddRepo: s, onRemoveRepo: h, onRestore: n, onSelect: c, onHide: I, onRemove: j, onCollapse: T }) {
  const [_, D] = O(""), [q, P] = O(null), [te, ne] = O(!0);
  Q(() => {
    ne(!0);
  }, [g]);
  const [E, S] = O(null), M = He(() => S(null), []), [N, ie] = O(null), [le, ge] = O(Oo);
  Q(() => {
    localStorage.setItem(Cn, JSON.stringify(le));
  }, [le]);
  const Z = (b) => le[b] !== !1, ce = _.trim().toLowerCase(), F = pt(() => {
    const b = /* @__PURE__ */ new Map();
    for (const H of t ?? []) {
      const L = b.get(H.repo) ?? [];
      L.push(H), b.set(H.repo, L);
    }
    const W = (i ?? []).map((H) => H.slug);
    for (const H of b.keys()) W.includes(H) || W.push(H);
    return W.map((H) => {
      const L = (i ?? []).find((J) => J.slug === H) ?? { slug: H, path: "", hidden: [] }, re = b.get(H) ?? [], G = !ce || H.toLowerCase().includes(ce), de = G ? re : re.filter((J) => J.title.toLowerCase().includes(ce));
      return { meta: L, rows: de, show: !ce || G || de.length > 0 };
    }).filter((H) => H.show);
  }, [t, i, ce]);
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
            /* @__PURE__ */ o(ze, { primary: !0, onClick: d, children: /* @__PURE__ */ u("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Fn, { size: 14 }),
              "New effort"
            ] }) }),
            /* @__PURE__ */ o("span", { title: "Add a repo: it joins this sidebar with all its maps and efforts under it", children: /* @__PURE__ */ o(ze, { onClick: s, children: /* @__PURE__ */ u("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Jn, { size: 14 }),
              "Add repo"
            ] }) }) })
          ] }),
          /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ o(
              "input",
              {
                value: _,
                onChange: (b) => D(b.target.value),
                placeholder: "Filter efforts",
                "aria-label": "Filter efforts",
                style: { ...ht, fontSize: v.small, padding: "4px 8px", flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                onClick: T,
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
          t === null && !r && /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small, padding: "4px 6px" }, children: "Loading…" }),
          t !== null && !F.length && /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small, padding: "4px 6px" }, children: ce ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          F.map((b) => {
            const W = Z(b.meta.slug) || !!ce, H = b.meta.slug.split("/").pop() ?? b.meta.slug;
            return /* @__PURE__ */ u("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ u(
                "div",
                {
                  onContextMenu: (L) => {
                    L.preventDefault(), ie({ slug: b.meta.slug, x: L.clientX, y: L.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => P(`repo:${b.meta.slug}`),
                  onPointerLeave: () => P((L) => L === `repo:${b.meta.slug}` ? null : L),
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
                        onClick: () => ge((L) => ({ ...L, [b.meta.slug]: !W })),
                        "aria-expanded": W,
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
                          /* @__PURE__ */ o(xt, { size: 11, "aria-hidden": !0, style: {
                            flexShrink: 0,
                            color: "var(--muted)",
                            transition: "transform .12s",
                            transform: W ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ o(fn, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: H }),
                          !W && (f ?? 0) > 0 && (g == null ? void 0 : g.startsWith(`${b.meta.slug}#`)) && /* @__PURE__ */ o(sn, {}),
                          /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.tiny, flexShrink: 0 }, children: b.rows.length || (W ? "" : "0") })
                        ]
                      }
                    ),
                    (q === `repo:${b.meta.slug}` || (N == null ? void 0 : N.slug) === b.meta.slug) && /* @__PURE__ */ o(
                      "button",
                      {
                        type: "button",
                        "aria-label": `More for ${b.meta.slug}`,
                        "aria-haspopup": "menu",
                        title: "More",
                        onClick: (L) => {
                          L.stopPropagation();
                          const re = L.currentTarget.getBoundingClientRect();
                          ie({ slug: b.meta.slug, x: re.left, y: re.bottom + 2, confirm: !1 });
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
                        children: /* @__PURE__ */ o(Jt, { size: 13 })
                      }
                    )
                  ]
                }
              ),
              W && !b.rows.length && /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              W && b.rows.length > 0 && /* @__PURE__ */ o("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: b.rows.map((L) => {
                const re = `${L.repo}#${L.number}`, G = re === g, de = G && !!m && te;
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
                      J.preventDefault(), S({ key: re, item: L, x: J.clientX, y: J.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => P(re),
                    onPointerLeave: () => P((J) => J === re ? null : J),
                    children: [
                      /* @__PURE__ */ u(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            G ? ne((J) => !J) : c(L);
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
                              /* @__PURE__ */ o(xt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: de ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ u("span", { style: { ...G ? Se : {}, flex: 1, minWidth: 0, fontSize: v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ u("span", { style: { ...K, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  L.number
                                ] }),
                                " ",
                                L.title
                              ] }),
                              G && !de && (f ?? 0) > 0 && /* @__PURE__ */ o(sn, {})
                            ] }),
                            (() => {
                              var me;
                              if (de)
                                return /* @__PURE__ */ u("div", { style: { ...K, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o($t, { kind: L.kind, map: L.mapIssue }),
                                  /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: L.repo.split("/").pop() }),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Xt(L.updatedAt) })
                                ] });
                              const J = (me = L.frontier) != null && me.stations ? ko(L.frontier.stations) : null;
                              return /* @__PURE__ */ u(be, { children: [
                                J && /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(xo, { glance: J }) }),
                                /* @__PURE__ */ u("div", { style: { ...K, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o($t, { kind: L.kind, map: L.mapIssue }),
                                  !J && /* @__PURE__ */ o(Ao, { stage: L.stage ?? oo(L.column) }),
                                  /* @__PURE__ */ o(
                                    "span",
                                    {
                                      title: J ? `${J.bits || J.front}

${mt.HITL}
${mt.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: J ? J.bits || J.front : L.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Xt(L.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (q === re || G || (E == null ? void 0 : E.key) === re) && /* @__PURE__ */ o(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${L.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: (J) => {
                            J.stopPropagation();
                            const me = J.currentTarget.getBoundingClientRect();
                            S({ key: re, item: L, x: me.left, y: me.bottom + 2, confirm: !1 });
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
                          children: /* @__PURE__ */ o(Jt, { size: 14 })
                        }
                      ),
                      de && /* @__PURE__ */ o("div", { ref: m, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  re
                );
              }) }),
              W && b.meta.hidden.length > 0 && /* @__PURE__ */ u(
                "button",
                {
                  type: "button",
                  onClick: () => n(b.meta.slug, b.meta.hidden),
                  title: `Removed from the sidebar: #${b.meta.hidden.join(", #")}. Click to restore them.`,
                  style: {
                    ...K,
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
        E && !E.confirm && /* @__PURE__ */ o(en, { x: E.x, y: E.y, onClose: M, items: [
          { label: "Open on GitHub", icon: Yt, onSelect: () => window.open(E.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: Yn, danger: !0, onSelect: () => S({ ...E, confirm: "hide" }) },
          ...E.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: Ut, danger: !0, onSelect: () => S({ ...E, confirm: "remove" }) }
          ]
        ] }),
        (E == null ? void 0 : E.confirm) === "hide" && /* @__PURE__ */ o(
          bt,
          {
            x: E.x,
            y: E.y,
            onClose: M,
            action: "Remove",
            title: `Remove "${E.item.title}" from the sidebar?`,
            onConfirm: () => I(E.item),
            children: E.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (E == null ? void 0 : E.confirm) === "remove" && /* @__PURE__ */ o(
          bt,
          {
            x: E.x,
            y: E.y,
            onClose: M,
            action: "Close it",
            title: `Close "${E.item.title}" as not planned?`,
            onConfirm: () => j(E.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        N && !N.confirm && /* @__PURE__ */ o(en, { x: N.x, y: N.y, onClose: () => ie(null), items: [
          { label: "Open on GitHub", icon: Yt, onSelect: () => window.open(`https://github.com/${N.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: Ut, danger: !0, onSelect: () => ie({ ...N, confirm: !0 }) }
        ] }),
        (N == null ? void 0 : N.confirm) && /* @__PURE__ */ o(
          bt,
          {
            x: N.x,
            y: N.y,
            onClose: () => ie(null),
            action: "Remove",
            title: `Remove ${N.slug} from KiPo?`,
            onConfirm: () => h(N.slug),
            children: "Its efforts and maps leave the sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back."
          }
        )
      ]
    }
  );
}
function Mo({ items: e, selected: t, attention: i, onNew: r, onSelect: l, onExpand: g }) {
  const f = (d) => {
    var h;
    const s = (h = d.frontier) == null ? void 0 : h.counts;
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
      const s = `${d.repo}#${d.number}`, h = s === t;
      return /* @__PURE__ */ o(
        "button",
        {
          type: "button",
          onClick: () => l(d),
          title: `${d.title} (${d.repo.split("/").pop()})`,
          "aria-current": h ? "page" : void 0,
          style: { ...m, background: h ? "var(--bg-elevated)" : "transparent", border: h ? "1px solid var(--border)" : "1px solid transparent", flexShrink: 0 },
          children: /* @__PURE__ */ o(
            "span",
            {
              className: h && (i ?? 0) > 0 ? "kipo-pulse" : void 0,
              style: { width: 10, height: 10, borderRadius: 3, background: h && (i ?? 0) > 0 ? "#f5b14c" : f(d) }
            }
          )
        },
        s
      );
    }) })
  ] });
}
const ln = [
  { id: "idea", title: "An idea", hint: "Grill it, spec and ticket it, build it.", begins: "a grilling: an interview that sharpens the idea. Then the spec and tickets, then the build." },
  { id: "small", title: "A small change", hint: "Grill briefly, then build in the same session.", begins: "a short grilling, then the build in the same conversation. No spec or tickets." },
  { id: "huge", title: "A huge effort", hint: "Too many unknowns: map the decisions first.", begins: "a wayfinder map. Its decision tickets fill the Decide lane." },
  { id: "issue", title: "An incoming issue", hint: "Triage it until an agent can pick it up.", begins: "triaging the issue. Once an agent can take it, it moves to the Deliver lane." },
  { id: "bug", title: "A hard bug", hint: "Diagnose it with a tight loop, then fix it.", begins: "a diagnosis: a command that goes red on the bug, then the fix." }
], ut = (e) => /* @__PURE__ */ o("span", { style: { ...Se, fontSize: v.body, display: "block", marginBottom: 6 }, children: e }), Wo = (e) => {
  const t = e.trim().match(/(?:issues\/|#)?(\d+)\s*$/);
  return t ? Number(t[1]) : null;
};
function Ho({ onStarted: e, onCancel: t }) {
  const [i, r] = O(""), [l, g] = O(null), [f, m] = O(""), [d, s] = O(!1), [h, n] = O(!1), [c, I] = O("idea"), [j, T] = O(""), [_, D] = O(!1), [q, P] = O("");
  Q(() => {
    he.discoverRepos().then((S) => g(
      S.repos.filter((M) => M.slug && !M.worktree).sort((M, N) => Number(N.configured) - Number(M.configured) || M.name.localeCompare(N.name))
    )).catch((S) => {
      P(we(S)), g([]);
    });
  }, []);
  const te = (S) => {
    s(!1), m(S), l && !l.some((M) => M.path === S) && g([...l, { path: S, name: S.split("/").pop() || S, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, ne = async () => {
    const S = c === "issue" && j.trim() ? Wo(j) : null;
    if (c === "issue" && j.trim() && S == null) {
      P("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !S) {
      P("Say what you want to do first.");
      return;
    }
    if (!f) {
      P("Choose which project this is for.");
      return;
    }
    D(!0), P("");
    try {
      e(await he.startInitiative({
        path: f,
        description: i.trim() || `Issue #${S}`,
        start: c,
        worktree: h,
        sourceIssue: S
      }));
    } catch (M) {
      P(we(M)), D(!1);
    }
  }, E = ln.find((S) => S.id === c);
  return /* @__PURE__ */ u("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ u("div", { children: [
      /* @__PURE__ */ o("div", { style: { ...Se, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ o(Ge, { children: q }),
    /* @__PURE__ */ u("label", { children: [
      ut("What do you want to do?"),
      /* @__PURE__ */ o(
        "textarea",
        {
          value: i,
          onChange: (S) => r(S.target.value),
          rows: 3,
          autoFocus: !0,
          placeholder: "e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share",
          style: { ...ht, resize: "vertical", lineHeight: 1.45 }
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { children: [
      ut("Which project is this for?"),
      /* @__PURE__ */ u(
        "select",
        {
          value: f,
          onChange: (S) => S.target.value === "__pick" ? s(!0) : m(S.target.value),
          style: ht,
          disabled: l === null,
          children: [
            /* @__PURE__ */ o("option", { value: "", children: l === null ? "Looking for your projects…" : "Choose a project…" }),
            l == null ? void 0 : l.map((S) => /* @__PURE__ */ o("option", { value: S.path, children: S.slug ?? S.name }, S.path)),
            /* @__PURE__ */ o("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      f && /* @__PURE__ */ u("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(mn, { path: f }) }),
        /* @__PURE__ */ u("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: v.body }, children: [
          /* @__PURE__ */ o("input", { type: "checkbox", checked: h, onChange: (S) => n(S.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ u("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ o("span", { style: K, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      d && /* @__PURE__ */ o("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ o(yn, { busy: null, onAdd: te, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ u("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ o("legend", { style: { padding: 0 }, children: ut("Where does this start?") }),
      /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: ln.map((S) => {
        const M = c === S.id;
        return /* @__PURE__ */ u(
          "label",
          {
            style: {
              display: "block",
              padding: "8px 10px 9px",
              cursor: "pointer",
              borderRadius: 8,
              border: `1px solid ${M ? "var(--accent)" : "var(--border)"}`,
              background: M ? "var(--accent-subtle, var(--bg-elevated))" : "var(--card, var(--bg))",
              color: "var(--text)"
            },
            children: [
              /* @__PURE__ */ o(
                "input",
                {
                  type: "radio",
                  name: "start",
                  checked: M,
                  onChange: () => I(S.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ o("div", { style: { ...Se, fontSize: v.body }, children: S.title }),
              /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small, marginTop: 3, lineHeight: 1.4 }, children: S.hint })
            ]
          },
          S.id
        );
      }) }),
      /* @__PURE__ */ u("div", { style: { ...K, fontSize: v.small, marginTop: 8 }, children: [
        "Starts with ",
        E.begins
      ] })
    ] }),
    c === "issue" && /* @__PURE__ */ u("label", { children: [
      ut("Which issue? (optional)"),
      /* @__PURE__ */ o(
        "input",
        {
          value: j,
          onChange: (S) => T(S.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: ht
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ o(ze, { primary: !0, disabled: _, onClick: ne, children: _ ? "Starting…" : "Start the conversation" }),
      t && /* @__PURE__ */ o(ze, { onClick: t, children: "Never mind" })
    ] }),
    /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small, lineHeight: 1.5 }, children: "Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo." })
  ] });
}
const an = 6, Ke = (e, t) => (e.blockers ?? e.blockedBy).filter((i) => t.has(i) && i !== e.number);
function No(e, t) {
  const i = new Map(e.map((c) => [c.number, c])), r = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), g = (c) => {
    if (r.has(c.number)) return r.get(c.number);
    if (l.has(c.number)) return 0;
    l.add(c.number);
    const I = Ke(c, i), j = I.length ? 1 + Math.max(...I.map((T) => g(i.get(T)))) : 0;
    return l.delete(c.number), r.set(c.number, j), j;
  };
  e.forEach(g);
  const f = e.length ? Math.max(...e.map((c) => r.get(c.number))) + 1 : 0, m = t ? [e.filter((c) => c.lane === "decide"), e.filter((c) => c.lane !== "decide")] : [e], d = /* @__PURE__ */ new Map(), s = [];
  let h = 0, n = null;
  return m.forEach((c, I) => {
    if (!c.length) return;
    t && I === 1 && h > 0 && (n = h, h += 0.6);
    let j = 0;
    const T = [];
    for (let _ = 0; _ < f; _++) {
      const D = c.filter((P) => r.get(P.number) === _), q = (P) => {
        const te = Ke(P, i).map((ne) => d.get(ne)).filter((ne) => ne !== void 0);
        return te.length ? te.reduce((ne, E) => ne + E, 0) / te.length : P.number / 1e3;
      };
      D.sort((P, te) => q(P) - q(te) || P.number - te.number), D.forEach((P, te) => d.set(P.number, h + te)), T.push(D), j = Math.max(j, D.length);
    }
    T.forEach((_, D) => {
      const q = (j - _.length) / 2;
      _.forEach((P, te) => {
        const ne = h + te + q;
        d.set(P.number, ne), s.push({ tile: P, col: D, row: ne });
      });
    }), h += j;
  }), { placed: s, cols: f, rows: h, split: n };
}
function Do({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: l, labeled: g, bands: f, highlight: m, dimOthers: d = !0, down: s }) {
  const h = fe(null), [n, c] = O(0), [I, j] = O(null);
  if (Q(() => {
    const a = h.current;
    if (!a) return;
    const z = new ResizeObserver(() => c(a.clientWidth));
    return z.observe(a), c(a.clientWidth), () => z.disconnect();
  }, []), !e.length) return null;
  const T = new Map(e.map((a) => [a.number, a])), _ = /* @__PURE__ */ new Set();
  for (const a of e) for (const z of Ke(a, T))
    _.add(z), _.add(a.number);
  const D = e.length > 1 ? e.filter((a) => !_.has(a.number)) : [], q = D.length ? e.filter((a) => _.has(a.number)) : e, { placed: P, cols: te, rows: ne, split: E } = No(q, !!f), S = 30, M = !!s && !f, N = f ? 52 : 0, ie = M ? 12 : f ? 64 : g ? 40 : 48, le = i > 0 && !M ? Math.min(i, 4) : 0, ge = le ? ie + S : 0, Z = M ? Math.max(1, ne) : te, ce = n && Z ? Math.floor((n - 2 - 2 * an - N - ge - (Z - 1) * ie) / Z) : 168, F = g ? Math.max(M ? 120 : 110, Math.min(f ? 240 : M ? 260 : 200, ce)) : S, b = S + 6, W = M ? 30 : g ? 10 : 8, H = q.length ? te : 0, L = M ? (q.length ? Z * (F + ie) - ie : 0) + 2 : N + (H ? H * (F + ie) - ie : 0) + ge + 2, re = E ?? ne, G = M ? H : Math.max(ne, le), de = (a) => 1 + a * (b + W), J = q.length || le ? de(G) - W + 1 : 0, me = new Map(P.map((a) => [a.tile.number, M ? { x: 1 + a.row * (F + ie), y: de(a.col) } : { x: N + 1 + a.col * (F + ie), y: de(a.row) }])), Ae = /* @__PURE__ */ new Set();
  if (t != null) {
    Ae.add(t);
    const a = T.get(t);
    a && Ke(a, T).forEach((z) => Ae.add(z)), e.forEach((z) => {
      Ke(z, T).includes(t) && Ae.add(z.number);
    });
  }
  const ke = I != null && T.has(I) ? new Set(Ct(e, I).map((a) => a.number)) : null, $e = (a) => ke ? ke.has(a) : (m ? m.has(a) : !0) && (t == null || !d || Ae.has(a)), Pe = (a) => a.state === "you" || a.state === "afk", Le = (a) => Pe(a) && a.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${A[a.state].color}` : void 0, Ee = [];
  for (const a of q) for (const z of Ke(a, T)) Ee.push({ from: T.get(z), to: a });
  const ye = E != null ? de(E) + 0.3 * (b + W) - W / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ u("div", { ref: h, style: { overflowX: "auto", padding: an, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ u("div", { style: { position: "relative", width: L, height: J, minWidth: L }, children: [
        /* @__PURE__ */ u("svg", { width: L, height: J, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ o("defs", { children: /* @__PURE__ */ o("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ o("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          ye != null && /* @__PURE__ */ o("line", { x1: 0, x2: L, y1: ye, y2: ye, stroke: "var(--border)", strokeDasharray: "2 4" }),
          Ee.map(({ from: a, to: z }) => {
            const X = me.get(a.number), oe = me.get(z.number);
            if (!X || !oe) return null;
            const Ie = a.state === "done", Oe = ke ? ke.has(a.number) && ke.has(z.number) : t != null && (a.number === t || z.number === t), Ne = ke ? !Oe : t != null && d && !Oe || !$e(a.number) || !$e(z.number), qe = M ? (() => {
              const ue = X.x + S / 2, Me = X.y + b + 2, Re = oe.x + S / 2, We = oe.y - 2, Be = (Me + We) / 2;
              return `M${ue},${Me} C${ue},${Be} ${Re},${Be} ${Re},${We}`;
            })() : (() => {
              const ue = X.x + F + 2, Me = X.y + b / 2, Re = oe.x - 2, We = oe.y + b / 2, Be = (ue + Re) / 2;
              return `M${ue},${Me} C${Be},${Me} ${Be},${We} ${Re},${We}`;
            })();
            return /* @__PURE__ */ o(
              "path",
              {
                d: qe,
                fill: "none",
                stroke: Oe ? "var(--text)" : "var(--muted)",
                strokeWidth: Oe ? 1.6 : 1.2,
                strokeDasharray: Ie ? "3 3" : void 0,
                opacity: Ne ? 0.15 : Ie ? 0.45 : 0.8,
                markerEnd: "url(#kipo-arrow)"
              },
              `${a.number}-${z.number}`
            );
          })
        ] }),
        f && P.length > 0 && ["decide", "deliver"].map((a) => {
          const z = P.filter((oe) => a === "decide" ? oe.tile.lane === "decide" : oe.tile.lane !== "decide").map((oe) => oe.row);
          if (!z.length) return null;
          const X = (Math.min(...z) + Math.max(...z)) / 2;
          return /* @__PURE__ */ o("span", { style: { position: "absolute", left: 0, top: de(X) + b / 2 - 8, fontSize: v.tiny, fontWeight: 600, color: "var(--muted)" }, children: a === "decide" ? "Decide" : "Deliver" }, a);
        }),
        P.map(({ tile: a }) => {
          const z = me.get(a.number);
          return /* @__PURE__ */ u(
            "div",
            {
              onPointerEnter: () => j(a.number),
              onPointerLeave: () => j((X) => X === a.number ? null : X),
              style: {
                position: "absolute",
                left: z.x,
                top: z.y,
                width: F,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: $e(a.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    title: Le(a) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: Le(a), display: "inline-flex" },
                    children: /* @__PURE__ */ o(tn, { tile: a, size: S, onClick: () => r(a), open: a.number === t, status: l == null ? void 0 : l[a.number] })
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
        Array.from({ length: le }).map((a, z) => /* @__PURE__ */ o(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: N + 1 + H * (F + ie),
              top: de(Math.max(0, (re - le) / 2) + z),
              width: S,
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
      D.length > 0 && /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: N }, children: [
        /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        D.map((a) => /* @__PURE__ */ o("span", { style: { opacity: $e(a.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: Le(a) }, children: /* @__PURE__ */ o(tn, { tile: a, size: S, onClick: () => r(a), open: a.number === t, status: l == null ? void 0 : l[a.number] }) }, a.number))
      ] }),
      /* @__PURE__ */ u("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: N }, children: [
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2" }) }),
          " still blocks"
        ] }),
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2", strokeDasharray: "3 3", opacity: ".6" }) }),
          " blocker closed"
        ] }),
        /* @__PURE__ */ u("span", { children: [
          /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, boxShadow: `0 0 0 1.5px ${A.you.color}`, marginRight: 5 } }),
          "frontier: open and unblocked"
        ] }),
        i > 0 && /* @__PURE__ */ o("span", { children: "? not yet specified" })
      ] })
    ] })
  );
}
function Ct(e, t) {
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
function Po(e) {
  if (!e) return "";
  const t = Math.max(0, (Date.now() - new Date(e).getTime()) / 1e3);
  return t < 60 ? "just now" : t < 3600 ? `${Math.floor(t / 60)}m ago` : t < 86400 ? `${Math.floor(t / 3600)}h ago` : `${Math.floor(t / 86400)}d ago`;
}
function Lo({ slot: e, active: t, ended: i }) {
  const [r, l] = O(null), [g, f] = O(""), m = fe(null), d = fe(!0);
  return Q(() => {
    let s = !0;
    const h = () => he.sessionTail(e, 60).then((c) => {
      s && (l(c.events), f(""));
    }).catch((c) => {
      s && f(we(c));
    });
    if (h(), !t || i) return () => {
      s = !1;
    };
    const n = setInterval(h, 4e3);
    return () => {
      s = !1, clearInterval(n);
    };
  }, [e, t, i]), Q(() => {
    var s;
    d.current && ((s = m.current) == null || s.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: A.building.color, flexShrink: 0 } }),
      /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.tiny, lineHeight: 1.4 }, children: i ? /* @__PURE__ */ u(be, { children: [
        "This session has ended — a read-only record of what it did, from its transcript. Its slot ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
        " is closed in Kiro."
      ] }) : /* @__PURE__ */ u(be, { children: [
        "Running in the background — read-only progress from its transcript. To chat with it, open ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
        " in Kiro's session window."
      ] }) })
    ] }),
    /* @__PURE__ */ u(
      "div",
      {
        onScroll: (s) => {
          const h = s.currentTarget;
          d.current = h.scrollHeight - h.scrollTop - h.clientHeight < 40;
        },
        style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", scrollbarWidth: "thin" },
        children: [
          /* @__PURE__ */ o(Ge, { children: g }),
          r === null && !g && /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small }, children: "Reading its transcript…" }),
          r !== null && r.length === 0 && !g && /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.small }, children: "No steps recorded yet." }),
          /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: (r ?? []).map((s, h) => /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            /* @__PURE__ */ u("span", { style: { ...K, fontSize: v.tiny, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ o("span", { style: { fontWeight: 700, color: s.role === "user" ? A.you.text : "var(--muted)" }, children: s.role === "user" ? "You" : "Agent" }),
              s.ts && /* @__PURE__ */ o("span", { children: Po(s.ts) })
            ] }),
            s.tool ? /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: s.text }) : /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.5 }, children: /* @__PURE__ */ o(kt, { content: s.text }) })
          ] }, h)) }),
          /* @__PURE__ */ o("div", { ref: m })
        ]
      }
    )
  ] });
}
function Bo({ items: e, prompts: t = [], onOpenPrompt: i, onError: r, onSize: l, bottomOffset: g = 122 }) {
  const f = zt(), m = (a) => `${a.slot}:${a.d.id}`;
  for (const a of e) a.d.answer && wo(a.slot, a.d.id);
  const d = e.filter((a) => At(a.d) && !Ht(a.slot, a.d.id)), [s, h] = O({}), [n, c] = O({}), [I, j] = O(0), [T, _] = O(!1), [D, q] = O(!1), [P, te] = O({}), [ne, E] = O(""), S = fe(null), M = t.filter((a) => !P[a.slot]), N = d.map(m).join(",") + "|" + M.map((a) => a.slot).join(","), ie = fe(N);
  Q(() => {
    ie.current !== N && (ie.current = N, j(0), h({}), c({}), N !== "|" && q(!1));
  }, [N]);
  const le = fe(null), ge = He((a) => {
    var X;
    if ((X = le.current) == null || X.disconnect(), le.current = null, !a) {
      l == null || l(0);
      return;
    }
    const z = () => l == null ? void 0 : l(a.offsetHeight);
    z(), le.current = new ResizeObserver(z), le.current.observe(a);
  }, [l]);
  if (!d.length && !M.length) return null;
  const Z = d.length + M.length;
  if (D) return /* @__PURE__ */ u(
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
        border: `1px solid ${A.you.color}`,
        color: A.you.text,
        background: "var(--bg-elevated)",
        boxShadow: "0 4px 14px rgba(0,0,0,.35)"
      },
      children: [
        Z,
        " waiting on you →"
      ]
    }
  );
  const ce = Math.min(I, Math.max(0, d.length - 1)), F = d.length ? d[ce] : null, b = F ? m(F) : "", W = d.filter((a) => (s[m(a)] ?? "").trim()), H = ce === 0, L = ce === d.length - 1, G = !!F && (s[b] ?? "") !== "" && !(F.d.options ?? []).includes(s[b] ?? "") || !!n[b], de = d.filter((a) => a.d.recommended), J = (a) => {
    b && h((z) => ({ ...z, [b]: a }));
  }, me = () => {
    var a;
    T || !F || (c((z) => ({ ...z, [b]: !0 })), h((z) => (F.d.options ?? []).includes(z[b] ?? "") ? { ...z, [b]: "" } : z), (a = S.current) == null || a.focus());
  }, Ae = async (a = s) => {
    const z = d.filter((oe) => (a[m(oe)] ?? "").trim());
    if (!z.length) return;
    const X = /* @__PURE__ */ new Map();
    for (const oe of z) {
      const Ie = X.get(oe.slot) ?? [];
      Ie.push(oe), X.set(oe.slot, Ie);
    }
    _(!0);
    try {
      for (const [oe, Ie] of X) {
        const Oe = d.filter((ue) => ue.slot === oe && !(a[m(ue)] ?? "").trim()), Ne = Ie.map((ue, Me) => `${Me + 1}. ${ue.d.title} (${ue.d.id}): ${a[m(ue)].trim()}`), qe = [
          `My answers to your ${Ie.length === 1 ? "question" : `${Ie.length} questions`}:`,
          "",
          ...Ne,
          "",
          Oe.length ? `Still open, I'll answer later: ${Oe.map((ue) => ue.d.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
        ].join(`
`);
        await f.post("/api/chat?ws=1", { slot: oe, message: qe });
        for (const ue of Ie) vo(ue.slot, ue.d.id);
      }
      h({}), j(0);
    } catch (oe) {
      r(`Couldn't send your answers: ${we(oe)}`);
    } finally {
      _(!1);
    }
  }, ke = () => {
    const a = { ...s };
    for (const z of de) a[m(z)] = z.d.recommended;
    h(a), Ae(a);
  }, $e = async (a, z) => {
    try {
      await f.post(
        `/api/chat/slots/${encodeURIComponent(a.slot)}/approve`,
        { action: z, request_id: a.requestId, request_mid: a.requestMid, origin: "native" }
      ), te((X) => ({ ...X, [a.slot]: !0 })), E("");
    } catch (X) {
      const oe = `Couldn't ${z === "approved" ? "allow" : "deny"} ${a.from}: ${we(X)}`;
      E(oe), r(oe);
    }
  }, Pe = (a) => /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${a ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: a && /* @__PURE__ */ o("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), Le = (a) => {
    const z = s[b] === a && !n[b];
    return /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": z,
        disabled: T,
        onClick: () => {
          c((X) => ({ ...X, [b]: !1 })), J(a);
        },
        onMouseEnter: (X) => {
          z || (X.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (X) => {
          z || (X.currentTarget.style.background = "transparent");
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
          Pe(z),
          /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0 }, children: a }),
          !!F && a === F.d.recommended && /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      a
    );
  }, Ee = (a, z, X) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      title: z,
      onClick: X,
      disabled: T,
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
  ), ye = (a, z, X) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      disabled: z,
      onClick: X,
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
      "aria-label": `${Z} waiting on you`,
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
          /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: A.you.text }, children: d.length === 0 ? M.length === 1 ? "Trust prompt" : "Trust prompts" : d.length === 1 ? "Question" : `Question ${ce + 1} of ${d.length}` }),
          d.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ o("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: d.map((a, z) => /* @__PURE__ */ o(
            "span",
            {
              title: `${a.from ? `${a.from} — ` : ""}${a.d.title ?? a.d.id}`,
              onClick: () => j(z),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (s[m(a)] ?? "").trim() ? A.you.color : z === ce ? "var(--text)" : "var(--border)"
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
        M.length > 0 && /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: d.length ? 10 : 2 }, children: [
          M.map((a) => /* @__PURE__ */ u("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 9px",
            borderRadius: 8,
            border: `1px solid ${A.you.color}`,
            background: "color-mix(in srgb, #f5b14c 8%, transparent)"
          }, children: [
            /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: A.you.color, flexShrink: 0 } }),
            /* @__PURE__ */ u(
              "span",
              {
                style: { flex: 1, minWidth: 0, fontSize: v.small },
                title: [a.tool, a.input, a.purpose].filter(Boolean).join(`

`),
                children: [
                  /* @__PURE__ */ o("b", { children: a.from }),
                  " ",
                  /* @__PURE__ */ o("span", { style: K, children: "wants to run:" }),
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
            a.canDecide && /* @__PURE__ */ o(ze, { primary: !0, onClick: () => void $e(a, "approved"), children: "Allow" }),
            a.canDecide && Ee("Deny once", "Reject this one call; the session continues without it", () => void $e(a, "rejected_once")),
            i && Ee("Open", "Open this session to see the prompt in full", () => i(a.key))
          ] }, a.slot)),
          ne && /* @__PURE__ */ o("div", { style: { color: "var(--danger-text, #f85149)", fontSize: v.tiny, padding: "0 2px" }, children: ne })
        ] }),
        F && /* @__PURE__ */ u(be, { children: [
          F.from && /* @__PURE__ */ u("div", { style: { ...K, fontSize: v.tiny, marginBottom: 3 }, children: [
            "from ",
            F.from
          ] }),
          /* @__PURE__ */ o("div", { style: { ...Se, fontSize: v.body, marginBottom: 8, lineHeight: 1.4 }, children: F.d.title }),
          /* @__PURE__ */ u("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
            (F.d.options ?? []).map(Le),
            /* @__PURE__ */ u(
              "div",
              {
                role: "radio",
                "aria-checked": G,
                onClick: me,
                style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px", cursor: "text" },
                children: [
                  Pe(G),
                  /* @__PURE__ */ o(
                    "input",
                    {
                      ref: S,
                      value: G ? s[b] ?? "" : "",
                      onChange: (a) => J(a.target.value),
                      onFocus: me,
                      disabled: T,
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
            d.length > 1 && ye("‹ Back", H, () => j(ce - 1)),
            !L && ye("Next ›", !1, () => j(ce + 1)),
            /* @__PURE__ */ o("span", { style: { flex: 1 } }),
            d.length > 1 && /* @__PURE__ */ u("span", { style: { ...K, fontSize: v.tiny }, children: [
              W.length,
              " of ",
              d.length,
              " answered"
            ] }),
            de.length > 0 && /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                disabled: T,
                onClick: ke,
                title: d.length > 1 ? `Answer all ${de.length} with their recommendation and send` : "Take the recommendation and send",
                style: {
                  background: "transparent",
                  border: `1px solid ${A.you.color}`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  color: A.you.text,
                  cursor: T ? "default" : "pointer",
                  fontSize: v.small,
                  whiteSpace: "nowrap",
                  opacity: T ? 0.5 : 1
                },
                children: d.length > 1 ? "Accept all recommendations" : "Accept recommendation"
              }
            ),
            /* @__PURE__ */ o(ze, { primary: !0, disabled: !W.length || T, onClick: () => void Ae(), children: T ? "Sending…" : W.length > 1 ? `Submit ${W.length} answers` : "Submit" })
          ] })
        ] })
      ]
    }
  );
}
const jo = {
  grilling: "Grill",
  prototype: "Prototype",
  research: "Research",
  task: "Task",
  build: "Build",
  issue: "Issue"
}, vt = {
  MERGED: { label: "merged", color: "var(--ok, #3fb950)" },
  OPEN: { label: "open", color: "var(--accent)" },
  CLOSED: { label: "closed", color: "var(--muted)" }
};
function cn({ color: e, text: t, children: i }) {
  return /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, padding: "1px 8px", borderRadius: 999, border: `1px solid ${e}`, color: t, whiteSpace: "nowrap" }, children: i });
}
function qo({ detail: e, tile: t }) {
  const [i, r] = O(null), [l, g] = O("");
  Q(() => {
    let h = !0;
    return r(null), g(""), he.ticket(e.repo, e.number, t.number).then((n) => {
      h && r(n);
    }).catch((n) => {
      h && g(we(n));
    }), () => {
      h = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const f = e.prs.filter((h) => t.prs.includes(h.number)), m = t.state === "done", d = A[t.state];
  let s;
  return m ? s = f.some((h) => h.state === "MERGED") ? "Closed: its PR merged." : "Closed." : t.state === "review" ? s = "Its PR is open. The effort's Review merges it once it's clean." : t.state === "blocked" ? s = `Waiting on ${t.blockedBy.map((h) => `#${h}`).join(", ")}. It can start once those close.` : t.state === "building" ? s = "An agent is working on it." : t.who === "you" ? s = /* @__PURE__ */ u(be, { children: [
    /* @__PURE__ */ o(fo, { term: "HITL", children: "HITL" }),
    ": it needs you. Start it to open its conversation."
  ] }) : s = "An agent can take it on its own.", /* @__PURE__ */ u("div", { children: [
    /* @__PURE__ */ u("div", { style: { padding: "14px 16px" }, children: [
      /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ u("span", { style: { ...K, fontSize: v.small }, children: [
          "#",
          t.number,
          " · ",
          jo[t.type]
        ] }),
        /* @__PURE__ */ o("span", { title: Ye[t.state], style: { cursor: "help", display: "inline-flex" }, children: /* @__PURE__ */ o(cn, { color: d.color === "transparent" ? "var(--border)" : d.color, text: d.text, children: d.label }) }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        /* @__PURE__ */ o("a", { href: t.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.small }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { ...Se, fontSize: v.title, marginTop: 4, lineHeight: 1.35 }, children: t.title }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, lineHeight: 1.45 }, children: s })
    ] }),
    f.length > 0 && /* @__PURE__ */ o(yt, { title: f.length === 1 ? "Pull request" : "Pull requests", children: /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: f.map((h) => {
      var n, c, I;
      return /* @__PURE__ */ u(
        "a",
        {
          href: h.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: v.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ o(cn, { color: ((n = vt[h.state]) == null ? void 0 : n.color) ?? "var(--border)", text: ((c = vt[h.state]) == null ? void 0 : c.color) ?? "var(--muted)", children: ((I = vt[h.state]) == null ? void 0 : I.label) ?? h.state }),
            /* @__PURE__ */ u("span", { style: { color: "var(--accent)" }, children: [
              "#",
              h.number
            ] }),
            /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: h.title })
          ]
        },
        h.number
      );
    }) }) }),
    m && /* @__PURE__ */ o(yt, { title: "How it ended", aside: i != null && i.lastComment ? `latest of ${i.comments} comment${i.comments === 1 ? "" : "s"}` : void 0, children: l ? /* @__PURE__ */ o(Ge, { children: l }) : i ? i.lastComment ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(kt, { content: i.lastComment.body }) }) : /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.small }, children: "Closed with no comment." }) : /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.small }, children: "Loading…" }) }),
    /* @__PURE__ */ o(yt, { title: m ? "What it asked" : "What it asks", defaultOpen: !m, children: l ? /* @__PURE__ */ o(Ge, { children: l }) : i ? i.body.trim() ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(kt, { content: i.body }) }) : /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.small }, children: "No description." }) : /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.small }, children: "Loading…" }) })
  ] });
}
const _o = (e) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ""}@${e.at}`;
function Ko(e, t, i, r, l = {}) {
  const g = [], f = [], m = new Set(l.unstarted ?? []), d = (n, c) => {
    const I = c ? r[c] : void 0;
    if (I)
      return n.replace === I || c && m.has(c) ? I : null;
  }, s = (n, c) => c ? { ...n, replace: c } : n, h = (n) => (l.prs ?? []).some((c) => c.state === "OPEN" && ((c.tickets ?? []).includes(n) || (c.refs ?? []).includes(n)));
  for (const n of e) {
    const c = _o(n);
    if (!(t(c) || g.includes(c))) {
      if (g.push(c), n.ticket != null) {
        const I = i.find((T) => T.number === n.ticket);
        if (!I) continue;
        const j = n.skill === "kipo-review";
        if ((I.state === "done" || I.state === "blocked") && !(j && h(I.number))) continue;
        if (j) {
          const T = d(n, `review-t${I.number}`);
          T !== null && f.push(s({ id: c, kind: "review", t: I.number }, T));
        } else {
          const T = d(n, I.sessionKey);
          T !== null && f.push(s({ id: c, kind: "tile", tile: I, skill: n.skill && !n.skill.startsWith("kipo-") ? n.skill : null }, T));
        }
      } else if (n.stage) {
        const I = d(n, n.stage);
        I !== null && f.push(s({ id: c, kind: "stage", column: n.stage, skill: n.skill && n.skill !== `kipo-${n.stage}` ? n.skill : null }, I));
      }
    }
  }
  return { fresh: g, starts: f };
}
const Go = (e) => `[KiPo] Carry on: ${e}. Re-read your ticket, its PR and comments, and your state file, then continue from where you stopped; report when you finish or block.`, Fo = (e, t) => `[KiPo] Woke ${e}: ${t}`;
function Jo(e) {
  var i;
  if (!e) return null;
  const t = (i = e.messages) == null ? void 0 : i[e.messages.length - 1];
  return {
    at: (t == null ? void 0 : t.ts) || null,
    running: typeof e.running == "boolean" ? e.running : null,
    agent: t != null && t.role ? t.role !== "user" && t.role !== "system" : null
  };
}
const Yo = (e) => e.filter((t) => t.status === "open" && t.key !== "conductor");
function Uo(e, t, i) {
  return e.filter((r) => {
    var l;
    return ((l = r.stall) == null ? void 0 : l.state) === "stalled" && r.key !== "conductor" && r.slot !== t && !i(`${r.key}/${r.stall.id}`);
  });
}
const wt = (e) => e.kind === "ticket" ? `build-t${e.t}` : e.kind === "spec" ? "build-spec" : e.kind === "decision" ? `shape-t${e.t}` : e.kind === "review" ? `review-t${e.t}` : e.kind === "stage" ? e.column : "conductor";
function Qo({ repo: e, number: t, active: i, autoStart: r, spineHost: l, spineCompact: g, onRemoved: f, onChanged: m, onNeeds: d }) {
  var qt, _t;
  const s = zt(), h = `effort:${e}#${t}`, [n, c] = O(() => rt(h)), [I, j] = O(""), [T, _] = O(""), [D, q] = O(() => rt(`${h}:focus`) ?? { kind: "column" });
  Q(() => {
    st(`${h}:focus`, D);
  }, [h, D]);
  const [P, te] = O(!1), [ne, E] = O(!1), S = ro("chain", 100, 0.75), M = He(() => {
    he.getInitiative(e, t).then((p) => {
      c(p), st(h, p), j("");
    }).catch((p) => j(we(p)));
  }, [e, t, h]);
  Q(() => {
    if (M(), !i) return;
    const p = setInterval(M, 5e3);
    return () => clearInterval(p);
  }, [M, i]);
  const N = n == null ? void 0 : n.column;
  Q(() => {
    _("");
  }, [N, D]);
  const ie = fe(N);
  Q(() => {
    if (N === void 0 || ie.current === N) {
      ie.current = N;
      return;
    }
    const p = ie.current !== void 0;
    ie.current = N, p && q({ kind: "column" });
  }, [N]);
  const le = n ? wt(D) : null, ge = n && le ? n.sessions[le] ?? null : null, Z = ge && !De(ge) ? ge : null, ce = n && D.kind === "ticket" ? n.tickets.find((p) => p.number === D.t) ?? null : null, F = async (p = null, w, B = !0, $ = !1) => {
    if (!n) return;
    const k = w ?? D;
    te(!0), _("");
    try {
      const x = k.kind === "ticket" ? { column: "build", ticket: k.t, skill: p ?? "implement" } : k.kind === "spec" ? { column: "build", mode: "implement-spec", skill: p ?? "implement-spec" } : k.kind === "decision" ? { column: "shape", ticket: k.t, skill: p } : k.kind === "review" ? { column: "review", ticket: k.t, skill: p } : k.kind === "stage" ? { column: k.column, skill: p } : { column: n.column, mode: "conductor" }, R = await he.startSession(e, t, $ ? { ...x, replace: !0 } : x), C = k.kind === "ticket" ? `${n.title}: #${k.t}` : k.kind === "spec" ? `${n.title}: implement-spec` : k.kind === "decision" ? `${n.title}: decision #${k.t}` : k.kind === "review" ? `${n.title}: review #${k.t}` : k.kind === "stage" ? `${n.title}: ${gt[k.column]}` : `${n.title}: conductor`;
      R.existing ? await s.post("/api/chat?ws=1", { slot: R.slotName, message: R.seed }) : await go(s, e, R.slotName, R.seed, C, R.agent), R.key && await he.sessionStarted(e, t, R.key).catch(() => he.sessionStarted(e, t, R.key)).catch(() => {
      }), w && B && q(w), B && (M(), m());
    } catch (x) {
      _(
        x instanceof St && x.code === "ticket_blocked" ? x.message : `Couldn't start the conversation: ${we(x)}`
      );
    } finally {
      te(!1);
    }
  }, b = (p) => p.lane === "deliver" ? { kind: "ticket", t: p.number } : { kind: "decision", t: p.number }, W = (p) => p.lane === "deliver" ? "implement" : p.type === "research" ? "research" : p.type === "prototype" ? "prototype" : p.type === "issue" ? "triage" : null, [H, L] = O(null), re = (p) => {
    q(b(p));
  }, G = n != null && n.frontier && (D.kind === "ticket" || D.kind === "decision") ? n.frontier.tiles.find((p) => p.number === D.t) ?? null : null, [de, J] = O({}), [me, Ae] = O({}), [ke, $e] = O(null), [Pe, Le] = O({});
  Q(() => {
    let p = !0;
    const w = () => (at(), s.get("/api/chat/slots").then(($) => {
      !p || !Array.isArray($) || ($e(new Set($.filter((k) => k.key).map((k) => k.key))), Le(Object.fromEntries($.filter((k) => k.key).map((k) => [k.key, k]))));
    }).catch(() => {
    }));
    if (w(), !i) return () => {
      p = !1;
    };
    const B = setInterval(w, 5e3);
    return () => {
      p = !1, clearInterval(B);
    };
  }, [s, i]);
  const Ee = Z && !(ke !== null && !ke.has(Z)) ? Z : null;
  Q(() => {
    ei(Ee);
  }, [Ee]);
  const ye = pt(
    () => {
      var p;
      return (((p = n == null ? void 0 : n.frontier) == null ? void 0 : p.tiles) ?? []).filter((w) => w.sessionKey && (n == null ? void 0 : n.sessions[w.sessionKey]));
    },
    [n]
  );
  Q(() => {
    if (!ye.length) {
      J({}), Ae({});
      return;
    }
    let p = !0;
    const w = (k) => {
      const x = (k == null ? void 0 : k.content) ?? (k == null ? void 0 : k.text), R = typeof x == "string" ? x : Array.isArray(x) ? x.map((ee) => typeof ee == "string" ? ee : (ee == null ? void 0 : ee.text) ?? "").join(" ") : null, C = R == null ? void 0 : R.replace(/\s+/g, " ").trim();
      return C ? C.slice(0, 140) : null;
    }, B = async () => {
      let k = /* @__PURE__ */ new Map();
      try {
        const x = await s.get("/api/chat/slots");
        p && Array.isArray(x) && (k = new Map(x.filter((R) => R.key).map((R) => [R.key, R])));
      } catch {
      }
      Promise.all(ye.map((x) => {
        const R = n.sessions[x.sessionKey], C = k.get(R);
        return s.get(`/api/chat/slots/${encodeURIComponent(R)}?limit=1`).then((ee) => {
          var Gt;
          const _e = (Gt = ee == null ? void 0 : ee.messages) == null ? void 0 : Gt[ee.messages.length - 1], se = (C == null ? void 0 : C.pending_approval) ?? (ee == null ? void 0 : ee.pending_approval), je = (C == null ? void 0 : C.needs_input) ?? (ee == null ? void 0 : ee.needs_input), dt = (C == null ? void 0 : C.running) ?? (ee == null ? void 0 : ee.running), Kt = se ? "approval" : je ? "input" : null, Bn = { at: (_e == null ? void 0 : _e.ts) ?? null, line: _e && _e.role !== "user" ? w(_e) : null, needs: Kt }, jn = Kt ? "attention" : dt ? "running" : x.state === "done" ? null : "waiting";
          return [x.number, jn, Bn];
        }).catch(() => null);
      })).then((x) => {
        if (!p) return;
        const R = {}, C = {};
        for (const ee of x)
          ee && (ee[1] && (R[ee[0]] = ee[1]), C[ee[0]] = ee[2]);
        J(R), Ae(C);
      });
    };
    if (B(), !i) return () => {
      p = !1;
    };
    const $ = setInterval(B, 5e3);
    return () => {
      p = !1, clearInterval($);
    };
  }, [s, ye, i, n]);
  const [a, z] = pt(() => {
    const p = { ...de }, w = { ...me };
    for (const B of Object.keys((n == null ? void 0 : n.sessions) ?? {})) {
      const $ = B.match(/^(?:build|shape|review)-t(\d+)$/);
      if (!$) continue;
      const k = n.sessions[B];
      if (!k || De(k)) continue;
      const x = Pe[k], R = x != null && x.pending_approval ? "approval" : x != null && x.needs_input ? "input" : null;
      if (!R) continue;
      const C = Number($[1]);
      p[C] = "attention", w[C] = { ...w[C] ?? { at: null, line: null }, needs: R };
    }
    return [p, w];
  }, [de, me, Pe, n]), X = pt(() => {
    var x, R, C, ee, _e;
    if (!n) return [];
    const p = (se, je) => ((se == null ? void 0 : se.decisions) ?? []).filter((dt) => At(dt) && !(je && Ht(je, dt.id))).length, w = /* @__PURE__ */ new Set(), B = [], $ = (se) => {
      const je = wt(se);
      w.has(je) || (w.add(je), B.push(se));
    }, k = (se) => {
      var je;
      return (je = se.sessionKey) != null && je.startsWith("review-t") ? { kind: "review", t: se.number } : se.lane === "deliver" ? { kind: "ticket", t: se.number } : { kind: "decision", t: se.number };
    };
    p(((x = n.sessionStates) == null ? void 0 : x.conductor) ?? n.state, n.sessions.conductor) && $({ kind: "column" });
    for (const se of ((R = n.frontier) == null ? void 0 : R.tiles) ?? [])
      se.state === "done" || !se.sessionKey || (p((C = n.sessionStates) == null ? void 0 : C[se.sessionKey], n.sessions[se.sessionKey]) || a[se.number] === "attention" || se.state === "you") && $(k(se));
    for (const se of ["plan", "review", "done", "intake", "shape", "grill"])
      n.sessions[se] && p((ee = n.sessionStates) == null ? void 0 : ee[se], n.sessions[se]) && $({ kind: "stage", column: se });
    return n.sessions["build-spec"] && p((_e = n.sessionStates) == null ? void 0 : _e["build-spec"], n.sessions["build-spec"]) && $({ kind: "spec" }), B;
  }, [n, a]), oe = X.length;
  Q(() => {
    d == null || d(oe);
  }, [oe, d]), Q(() => () => {
    d == null || d(0);
  }, [d]);
  const Ie = async (p) => {
    for (let w = 0; w < p.length; w++)
      L(`Starting ${w + 1} of ${p.length}…`), await F(W(p[w]), b(p[w]), !1);
    L(null), M(), m();
  }, Oe = `kipo.autopilot:${e}#${t}`, [Ne, qe] = O(() => localStorage.getItem(Oe) === "1"), ue = (p) => {
    qe(p), localStorage.setItem(Oe, p ? "1" : "0");
  }, Me = fe(/* @__PURE__ */ new Set());
  Q(() => {
    if (!Ne || !i || H || !(n != null && n.frontier)) return;
    const p = n.frontier.tiles.filter((w) => w.lane === "deliver" && w.state === "afk" && !w.sessionKey && !Me.current.has(w.number));
    p.length && (p.forEach((w) => Me.current.add(w.number)), Ie(p));
  }, [Ne, i, H, n]);
  const Re = `kipo.dispatched:${e}#${t}`, We = fe(/* @__PURE__ */ new Set()), Be = (p) => {
    We.current.delete(p);
    try {
      const w = JSON.parse(localStorage.getItem(Re) || "[]");
      localStorage.setItem(Re, JSON.stringify(w.filter((B) => B !== p)));
    } catch {
    }
  };
  Q(() => {
    var k, x;
    if (!i || P || H || !(n != null && n.frontier)) return;
    const p = ((x = (k = n.sessionStates) == null ? void 0 : k.conductor) == null ? void 0 : x.dispatch) ?? [];
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(Re) || "[]");
    } catch {
      w = [];
    }
    const { fresh: B, starts: $ } = Ko(
      p,
      (R) => w.includes(R) || We.current.has(R),
      n.frontier.tiles,
      n.sessions,
      { prs: [...n.prs, ...n.refPrs ?? []], unstarted: ii(n) }
    );
    if (B.length) {
      for (const R of B)
        We.current.add(R), w.push(R);
      try {
        localStorage.setItem(Re, JSON.stringify(w.slice(-300)));
      } catch {
      }
      $.length && (async () => {
        for (const R of $) {
          if (R.replace && !hn(n, R.replace) && !await nn(s, R.replace)) {
            Be(R.id);
            continue;
          }
          const C = !!R.replace;
          R.kind === "tile" ? await F(R.skill ?? W(R.tile), b(R.tile), !1, C) : R.kind === "review" ? await F(null, { kind: "review", t: R.t }, !1, C) : await F(R.skill, { kind: "stage", column: R.column }, !1, C);
        }
        M(), m();
      })();
    }
  }, [i, P, H, n]);
  const Ze = `kipo.restarted:${e}#${t}`;
  Q(() => {
    if (!i || P || H || !(n != null && n.closing)) return;
    let p = [];
    try {
      p = JSON.parse(localStorage.getItem(Ze) || "[]");
    } catch {
      p = [];
    }
    const B = n.closing.filter((x) => x.started === !1 && x.key !== "conductor" && !p.includes(x.slot)).map((x) => [x, pn(x.key)]).find(([, x]) => x);
    if (!B) return;
    const [$, k] = B;
    try {
      localStorage.setItem(Ze, JSON.stringify([...p, $.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var R;
      if (!hn(n, $.slot) && !await nn(s, $.slot)) return;
      const x = (R = n.frontier) == null ? void 0 : R.tiles.find((C) => (k.kind === "ticket" || k.kind === "decision") && C.number === k.t);
      await F(x ? W(x) : null, k, !1, !0), M(), m();
    })();
  }, [i, P, H, n]);
  const ve = n != null && n.sessions.conductor && !De(n.sessions.conductor) ? n.sessions.conductor : null, y = ((n == null ? void 0 : n.closing) ?? []).filter((p) => {
    var w;
    return ((w = p.stall) == null ? void 0 : w.state) === "stuck";
  }).map((p) => p.key), Y = n != null && n.frontier ? JSON.stringify({
    t: n.frontier.tiles.map((p) => [p.number, p.state]),
    p: n.prs.map((p) => [p.number, p.state]),
    ...y.length ? { s: y } : {}
  }) : "";
  Q(() => {
    if (!Y || !ve || !i) return;
    const p = `kipo.conductorSaw:${e}#${t}`, w = localStorage.getItem(p);
    if (w === Y) return;
    if (w === null) {
      localStorage.setItem(p, Y);
      return;
    }
    const B = [];
    try {
      const $ = JSON.parse(w), k = JSON.parse(Y), x = new Map($.t), R = new Map($.p);
      for (const [C, ee] of k.t) x.get(C) !== ee && B.push(`#${C} ${x.get(C) ?? "new"} → ${ee}`);
      for (const [C, ee] of k.p) R.get(C) !== ee && B.push(`PR #${C} ${(R.get(C) ?? "new").toLowerCase()} → ${ee.toLowerCase()}`);
      for (const C of k.s ?? []) ($.s ?? []).includes(C) || B.push(`${C} stuck (woken twice, no answer)`);
    } catch {
    }
    (async () => {
      try {
        const $ = await s.get(`/api/chat/slots/${encodeURIComponent(ve)}?limit=1`);
        if ($ != null && $.running) return;
        await s.post("/api/chat?ws=1", {
          slot: ve,
          message: `[KiPo] Frontier changed${B.length ? `: ${B.slice(0, 12).join("; ")}` : ""}. Run the frontier and carry on.`
        }), localStorage.setItem(p, Y);
      } catch {
      }
    })();
  }, [Y, ve, i]), Q(() => {
    const p = n == null ? void 0 : n.reports;
    if (!p || !ve || !i) return;
    const w = `kipo.reportsSent:${e}#${t}`, B = Number(localStorage.getItem(w) || "0"), $ = p.reports.filter((k) => k.id > Math.max(B, p.read));
    $.length && (async () => {
      try {
        const k = await s.get(`/api/chat/slots/${encodeURIComponent(ve)}?limit=1`);
        if (k != null && k.running) return;
        const x = (C) => {
          var ee;
          return `${C.event}: ${C.text}${(ee = C.items) != null && ee.length ? ` (${C.items.join("; ")})` : ""}`;
        }, R = $.length === 1 ? `[KiPo] Report from ${$[0].from}: ${x($[0])}` : `[KiPo] Reports from the sessions:
${$.slice(-12).map((C) => `- ${C.from} ${x(C)}`).join(`
`)}`;
        await s.post("/api/chat?ws=1", { slot: ve, message: `${R}
Run the frontier and carry on.` }), localStorage.setItem(w, String($[$.length - 1].id));
      } catch {
      }
    })();
  }, [n, ve, i]);
  const U = (p, w) => {
    if (n) {
      if (n.sessions[p]) {
        q({ kind: "stage", column: p });
        return;
      }
      F(w, { kind: "stage", column: p });
    }
  }, V = () => U("plan", "to-spec"), Ue = () => U("review", null), Ce = () => U("done", "retro"), Fe = async () => {
    if (n) {
      E(!0), _("");
      try {
        n.column !== "done" && await he.advance(e, t, !0, "done"), await he.advance(e, t, !0, null), await on(s, Object.values(n.sessions), null), f();
      } catch (p) {
        _(`Couldn't close it: ${we(p)}`), E(!1);
      }
    }
  }, Qe = fe(!1);
  Q(() => {
    if (!(n != null && n.closing) || !i || Qe.current) return;
    const p = n.closing.filter((w) => w.status === "closable");
    p.length && (Qe.current = !0, on(s, p.map((w) => w.slot), Z).then((w) => {
      const B = p.filter(($) => w.includes($.slot)).map(($) => $.key);
      return B.length ? he.sessionsClosed(e, t, B).then(() => M()) : void 0;
    }).catch(() => {
    }).finally(() => {
      Qe.current = !1;
    }));
  }, [s, n, i, Z]);
  const pe = JSON.stringify(Yo((n == null ? void 0 : n.closing) ?? []).filter((p) => !De(p.slot)).map((p) => [p.key, p.slot]));
  Q(() => {
    const p = JSON.parse(pe);
    if (!i || !p.length) return;
    let w = !0;
    const B = () => {
      Promise.all(p.map(
        ([k, x]) => s.get(`/api/chat/slots/${encodeURIComponent(x)}?limit=1`).then((R) => [k, Jo(R)]).catch(() => null)
      )).then((k) => {
        if (!w) return;
        const x = Object.fromEntries(k.filter((R) => R && R[1]).map((R) => [R[0], R[1]]));
        Object.keys(x).length && he.sessionsActivity(e, t, x).catch(() => {
        });
      });
    };
    B();
    const $ = setInterval(B, 3e4);
    return () => {
      w = !1, clearInterval($);
    };
  }, [s, pe, i, e, t]);
  const xe = `kipo.woke:${e}#${t}`, Je = `kipo.wokeNotes:${e}#${t}`, et = fe(!1);
  Q(() => {
    if (!(n != null && n.closing) || !i || et.current) return;
    let p = [];
    try {
      p = JSON.parse(localStorage.getItem(xe) || "[]");
    } catch {
      p = [];
    }
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(Je) || "[]");
    } catch {
      w = [];
    }
    const B = Uo(n.closing, Z, ($) => p.includes($)).filter(($) => !De($.slot));
    !B.length && !(w.length && ve) || (et.current = !0, (async () => {
      for (const $ of B) {
        const k = $.stall;
        try {
          const x = await s.get(`/api/chat/slots/${encodeURIComponent($.slot)}?limit=1`);
          if (x != null && x.running) continue;
          await s.post("/api/chat?ws=1", { slot: $.slot, message: Go(k.why) }), p = [...p, `${$.key}/${k.id}`].slice(-300), localStorage.setItem(xe, JSON.stringify(p)), w = [...w, Fo($.key, k.why)], localStorage.setItem(Je, JSON.stringify(w)), await he.sessionsWoken(e, t, $.key, k.id ?? "", k.why);
        } catch {
        }
      }
      if (w.length && ve)
        try {
          const $ = await s.get(`/api/chat/slots/${encodeURIComponent(ve)}?limit=1`);
          $ != null && $.running || (await s.post("/api/chat?ws=1", { slot: ve, message: `${w.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(Je, "[]"));
        } catch {
        }
      B.length && M();
    })().finally(() => {
      et.current = !1;
    }));
  }, [s, n, i, Z, ve]);
  const Nt = fe(!1);
  if (Q(() => {
    !r || Nt.current || !n || (Nt.current = !0, n.sessions[n.column] || F());
  }, [r, n]), !n)
    return /* @__PURE__ */ o("div", { style: { flex: 1, padding: 24 }, children: I ? /* @__PURE__ */ o(Ge, { children: I }) : /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.body }, children: "Loading…" }) });
  const tt = le ? ((qt = n.sessionStates) == null ? void 0 : qt[le]) ?? null : n.state, Dt = (tt == null ? void 0 : tt.skillsUsed) ?? [], zn = () => {
    if (D.kind !== "column") {
      q({ kind: "column" });
      return;
    }
    if (!X.length) return;
    const p = X.findIndex((w) => wt(w) === le);
    q(X[(p + 1) % X.length]);
  }, Pt = fe(null), On = () => {
    var p, w;
    try {
      (w = (p = Pt.current) == null ? void 0 : p.contentWindow) == null || w.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [nt, An] = O(!1), [Lt, En] = O(0), Mn = He((p) => En((w) => Math.abs(w - p) > 4 ? p : w), []), [Bt, Wn] = O(128), Hn = He((p) => Wn((w) => Math.abs(w - p) > 4 ? p : w), []), Nn = G ? G.state === "done" : !!ge && De(ge), Xe = D.kind === "column" ? tt ?? n.state : tt, jt = (p) => {
    var B, $;
    const w = p.match(/^(build|shape|review)-t(\d+)$/);
    if (w) {
      const k = ($ = (B = n.frontier) == null ? void 0 : B.tiles) == null ? void 0 : $.find((R) => R.number === Number(w[2]));
      return `${w[1] === "review" ? "Review" : w[1] === "build" ? "Build" : "Shape"} #${w[2]}${k != null && k.title ? ` · ${k.title}` : ""}`;
    }
    return p === "build-spec" ? "Build: the spec" : p === "conductor" ? "Conductor" : gt[p] ?? p;
  }, Dn = new Set((((_t = n.frontier) == null ? void 0 : _t.tiles) ?? []).filter((p) => p.state === "done" && p.sessionKey).map((p) => p.sessionKey)), Pn = (() => {
    var B, $;
    if (D.kind !== "column")
      return Nn || !Z ? [] : ((Xe == null ? void 0 : Xe.decisions) ?? []).map((k) => ({ slot: Z, d: k }));
    const p = [], w = n.sessions.conductor;
    if (w && !De(w)) for (const k of (Xe == null ? void 0 : Xe.decisions) ?? []) p.push({ slot: w, d: k });
    for (const k of Object.keys(n.sessions)) {
      if (k === "conductor" || Dn.has(k)) continue;
      const x = n.sessions[k];
      if (!(!x || De(x)))
        for (const R of (($ = (B = n.sessionStates) == null ? void 0 : B[k]) == null ? void 0 : $.decisions) ?? []) p.push({ slot: x, from: jt(k), d: R });
    }
    return p;
  })(), Ln = (() => {
    if (D.kind !== "column") return [];
    const p = /* @__PURE__ */ new Set(), w = [];
    for (const B of Object.keys(n.sessions)) {
      const $ = n.sessions[B];
      if (!$ || $ === Ee || De($) || p.has($)) continue;
      const k = Pe[$];
      if (!(k != null && k.pending_approval)) continue;
      p.add($);
      const x = k.pending_approval_info;
      w.push({
        key: B,
        slot: $,
        from: jt(B),
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
      /* @__PURE__ */ u("span", { style: { ...Se, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, title: n.title, children: [
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
          children: /* @__PURE__ */ o($t, { kind: n.kind, map: n.kind === "map" ? n.number : n.mapIssue })
        }
      ),
      /* @__PURE__ */ o("span", { style: { flex: 1 } }),
      /* @__PURE__ */ o("span", { style: { ...K, fontSize: v.tiny, whiteSpace: "nowrap" }, title: n.repoPath, children: n.repo })
    ] }),
    T && /* @__PURE__ */ o("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ o(Ge, { children: T }) }),
    (() => {
      var R;
      const p = /* @__PURE__ */ u("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ o("span", { style: { ...Z ? K : Se, fontSize: Z ? v.small : v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: G ? `#${G.number}${Z ? "" : ` ${G.title}`}` : D.kind === "column" ? "Conductor" : n.title }),
        Z && Dt.length > 0 && /* @__PURE__ */ o(oi, { skills: Dt }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        G && (n.frontier ? Ct(n.frontier.tiles, G.number).length > 1 : !1) && /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            onClick: () => An((C) => !C),
            "aria-pressed": nt,
            title: "Show or hide this ticket's map — what it waits on and what it unblocks",
            "aria-label": "Show or hide the map",
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              background: nt ? "var(--bg-elevated)" : "transparent",
              color: nt ? "var(--text)" : "var(--muted)",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: v.small,
              border: `1px solid ${nt ? "var(--border)" : "transparent"}`
            },
            children: [
              /* @__PURE__ */ o(Un, { size: 14 }),
              " Map"
            ]
          }
        ),
        Z && /* @__PURE__ */ o(
          "button",
          {
            type: "button",
            onClick: On,
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
            onMouseEnter: (C) => {
              C.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))", C.currentTarget.style.color = "var(--text)";
            },
            onMouseLeave: (C) => {
              C.currentTarget.style.background = "transparent", C.currentTarget.style.color = "var(--muted)";
            },
            children: /* @__PURE__ */ o(Qn, { size: 15 })
          }
        )
      ] }), w = G && (G.state === "you" || G.state === "afk"), B = !!Z && ke !== null && !ke.has(Z), $ = Z && B ? /* @__PURE__ */ o(Lo, { slot: Z, active: i, ended: !0 }) : Z ? (
        // The card sits `composerH` up, so the transcript must clear the
        // composer, the card, and a gap above it.
        /* @__PURE__ */ o(
          ti,
          {
            slotKey: Z,
            frameRef: Pt,
            padBottom: Lt ? Bt + Lt + 24 : 0,
            onComposerH: Hn
          },
          Z
        )
      ) : G ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          w && /* @__PURE__ */ u("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ o(ze, { primary: !0, disabled: P, onClick: () => F(W(G)), children: P ? "Starting…" : ((R = Tn[G.type]) == null ? void 0 : R.action) ?? "Start this ticket" }),
            un(G, null).map((C) => /* @__PURE__ */ u(
              "button",
              {
                type: "button",
                disabled: P,
                onClick: () => F(C.skill),
                title: Ot[C.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: P ? "default" : "pointer", fontSize: v.small },
                children: [
                  "/",
                  C.skill,
                  " ",
                  /* @__PURE__ */ o("span", { style: K, children: C.label })
                ]
              },
              C.skill
            ))
          ] }),
          /* @__PURE__ */ o(qo, { detail: n, tile: G })
        ] })
      ) : /* @__PURE__ */ o(
        ni,
        {
          detail: n,
          focus: D,
          ticket: ce,
          tile: null,
          starting: P,
          onStart: () => F(null),
          alternatives: un(null, D.kind === "column" ? n.column : null),
          onSkill: (C) => F(C)
        }
      ), k = G && n.frontier ? Ct(n.frontier.tiles, G.number) : [], x = l ? Xn(
        /* @__PURE__ */ o(
          Ro,
          {
            detail: n,
            statuses: a,
            activity: z,
            busy: ne || P || !!H,
            autopilot: Ne,
            selectedKey: le,
            embedded: !0,
            compact: g,
            onAutopilot: ue,
            onOpenTile: re,
            onOpenConversation: (C) => q(C === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(C) ? { kind: "review", t: Number(C.slice(8)) } : { kind: "stage", column: C }),
            onSelectConductor: () => q({ kind: "column" }),
            onJumpQuestions: zn,
            onHandover: V,
            onReview: Ue,
            onRetro: Ce,
            onClose: Fe
          }
        ),
        l
      ) : null;
      return /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        x,
        /* @__PURE__ */ u("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          p,
          G && k.length > 1 && nt && /* @__PURE__ */ u(be, { children: [
            /* @__PURE__ */ u("div", { ref: S.ref, style: { ...S.style }, children: [
              /* @__PURE__ */ o("div", { style: { padding: "6px 16px 0", fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ o(Do, { tiles: k, focus: G.number, onOpen: re, labeled: !0, dimOthers: !1, statuses: de, down: !0 })
            ] }),
            /* @__PURE__ */ o(
              wn,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: S.onDrag,
                onReset: S.reset
              }
            )
          ] }),
          /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            $,
            /* @__PURE__ */ o(
              Bo,
              {
                items: Pn,
                prompts: Ln,
                onOpenPrompt: (C) => q(pn(C) ?? { kind: "column" }),
                onError: _,
                onSize: Mn,
                bottomOffset: Bt + 10
              },
              le ?? "none"
            )
          ] })
        ] })
      ] });
    })()
  ] });
}
function dn(e) {
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
function Xo(e) {
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
let Vo = 0;
const Zo = () => ++Vo;
let Tt = null;
function ei(e) {
  Tt = e, at();
}
function at() {
  try {
    const e = [...document.querySelectorAll("iframe[data-kipo-frame]")];
    let t = null, i = -1;
    if (Tt !== null)
      for (const r of e) {
        if (r.getAttribute("data-kipo-frame") !== Tt) continue;
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
function ti({ slotKey: e, frameRef: t, padBottom: i = 0, onComposerH: r }) {
  const l = `/popout/chat?sid=${encodeURIComponent(e)}`, g = fe(null), f = fe(i);
  f.current = i;
  const m = He(() => {
    var s;
    try {
      const h = (s = t.current) == null ? void 0 : s.contentDocument;
      if (!h) return;
      let n = h.getElementById("kipo-qcard-css");
      !n && h.head && (n = h.createElement("style"), n.id = "kipo-qcard-css", h.head.appendChild(n));
      const c = f.current ? ".followup-chip{display:none !important}" : "";
      if (n && n.textContent !== c && (n.textContent = c), r) {
        const T = h.querySelector('[data-testid="composer-dock-root"]') ?? h.querySelector('[data-testid="composer-dock"]'), _ = T ? Math.round(T.getBoundingClientRect().height) : 0;
        _ > 0 && r(_);
      }
      let I = g.current;
      if (!I || !I.isConnected || I.ownerDocument !== h) {
        const T = h.defaultView;
        I = [...h.querySelectorAll("div")].filter((D) => {
          if (D.clientHeight < 200) return !1;
          const q = T == null ? void 0 : T.getComputedStyle(D);
          return !!q && (q.overflowY === "auto" || q.overflowY === "scroll");
        }).sort((D, q) => q.clientHeight - D.clientHeight)[0] ?? null, g.current = I;
      }
      if (!I) return;
      const j = f.current ? `${f.current}px` : "";
      I.style.paddingBottom !== j && (I.style.paddingBottom = j);
    } catch {
    }
  }, [t]);
  Q(() => {
    m();
  }, [m, i]), Q(() => {
    dn(e);
  }, [e]), Q(() => {
    const s = t.current;
    return s && s.setAttribute("data-kipo-gen", String(Zo())), at(), () => {
      requestAnimationFrame(at);
    };
  }, [e, t]);
  const d = () => {
    var h;
    const s = t.current;
    try {
      const n = (h = s == null ? void 0 : s.contentWindow) == null ? void 0 : h.location.pathname;
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
  return Q(() => {
    const s = [], h = window.setInterval(() => {
      var c;
      const n = t.current;
      try {
        const I = (c = n == null ? void 0 : n.contentWindow) == null ? void 0 : c.location.pathname;
        if (n && I && !I.startsWith("/popout/chat")) {
          const T = Date.now();
          for (; s.length && T - s[0] > 6e5; ) s.shift();
          s.length < 5 && (s.push(T), dn(e), n.src = l);
          return;
        }
        at();
        const j = n == null ? void 0 : n.contentDocument;
        j && Xo(j);
      } catch {
      }
      f.current && m();
    }, 2e3);
    return () => window.clearInterval(h);
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
const Tn = {
  grilling: { what: "Grill", action: "Start the grill", body: "An interview with you to settle this decision. It updates GLOSSARY.md and the ADRs as answers land." },
  prototype: { what: "Prototype", action: "Start a prototype", body: "Throwaway code or an outline to react to, so the decision gets made against something concrete." },
  research: { what: "Research", action: "Run the research", body: "The agent reads primary sources and leaves a cited note on a research branch. No HITL (human-in-the-loop) step." },
  task: { what: "Task", action: "Start this task", body: "Work that has to happen before a decision can be made. The agent does what it can and hands you a checklist for the rest." },
  build: { what: "Build", action: "Implement this ticket", body: "/implement builds this ticket test-first in its own conversation, then reviews it." },
  issue: { what: "Issue", action: "Triage it", body: "A follow-up filed on the map. Triage moves it to an agent-ready brief, or asks you what it needs." }
};
function ni({ detail: e, focus: t, ticket: i, tile: r, starting: l, onStart: g, alternatives: f, onSkill: m }) {
  let d, s, h;
  if (r) {
    const n = Tn[r.type];
    r.state === "done" ? (d = "Closed", s = r.sessionKey ? "Its conversation was closed when the ticket was. How it ended is on the right." : "How it ended is on the right.", h = null) : r.state === "blocked" ? (d = `Waiting on ${r.blockedBy.map((c) => `#${c}`).join(", ")}`, s = "It can start once those are closed.", h = null) : r.state === "review" ? (d = "In review", s = "Its PR is open. The effort's Review merges it once it's clean.", h = null) : (d = "No conversation yet", s = `${r.who === "you" ? "HITL (human in the loop): it needs you." : "Agent (AFK, away from keyboard): an agent can take it on its own."} ${n.body}`, h = n.action);
  } else if (t.kind === "ticket")
    i != null && i.blockedBy.length ? (d = `#${t.t} is waiting on ${i.blockedBy.map((n) => `#${n}`).join(", ")}`, s = "It can start once those are closed.", h = null) : (i == null ? void 0 : i.state) === "CLOSED" ? (d = `#${t.t} is closed`, s = "Nothing left to build on this ticket.", h = null) : (d = `Build #${t.t}`, s = "/implement builds this one ticket test-first in a fresh conversation, then reviews it.", h = "Implement this ticket");
  else if (t.kind === "spec")
    d = "Implement the whole spec", s = "/implement-spec builds every unblocked ticket in parallel on one integration branch, then one review.", h = "Run /implement-spec";
  else if (t.kind === "review")
    d = `Review #${t.t}`, s = "kipo-review reviews this ticket's PR, fixes what it finds, and merges it if it's a two-way door.", h = "Review this ticket";
  else if (t.kind === "decision")
    d = `Decision #${t.t}`, s = "Work through this decision ticket from the map in its own conversation.", h = "Start this decision";
  else if (t.kind === "column")
    d = "Start the conductor", s = "The conductor runs this effort: it reads the frontier from GitHub, starts one stage-skill conversation per open thread, asks you in one batched message, and closes the effort when the frontier is empty. It never does the work itself.", h = "Start the conductor";
  else {
    const n = t.column, c = n === "plan" && e.sessions.grill;
    d = `${gt[n]} hasn't started`, s = c ? "Plan continues the Grill conversation, so the spec and tickets are written with everything it learned." : `${Zn[n]}`, h = c ? "Continue in the Grill conversation" : `Start ${gt[n]}`;
  }
  return /* @__PURE__ */ o("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ u("div", { style: { maxWidth: 400, textAlign: "center" }, children: [
    /* @__PURE__ */ o("div", { style: { ...Se, fontSize: v.title }, children: d }),
    /* @__PURE__ */ o("div", { style: { ...K, fontSize: v.body, margin: "6px 0 14px", lineHeight: 1.5 }, children: s }),
    /* @__PURE__ */ o("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }, children: h && /* @__PURE__ */ o(ze, { primary: !0, disabled: l, onClick: g, children: l ? "Starting…" : h }) }),
    h && f.map((n) => /* @__PURE__ */ u("div", { style: { marginTop: 10, fontSize: v.small }, children: [
      /* @__PURE__ */ o("span", { style: K, children: "or " }),
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          disabled: l,
          onClick: () => m(n.skill),
          title: Ot[n.skill],
          style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: l ? "default" : "pointer", fontSize: v.small },
          children: [
            "/",
            n.skill
          ]
        }
      ),
      /* @__PURE__ */ u("span", { style: K, children: [
        " ",
        n.label
      ] })
    ] }, n.skill))
  ] }) });
}
function un(e, t) {
  return (e ? e.type === "grilling" : t === "grill") ? [{ skill: "grill-me", label: "without writing docs" }] : [];
}
function oi({ skills: e }) {
  return /* @__PURE__ */ u("span", { style: { ...K, fontSize: v.tiny, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: [
    "Running",
    " ",
    e.map((t, i) => /* @__PURE__ */ u("span", { children: [
      i > 0 && " · ",
      /* @__PURE__ */ o("span", { title: Ot[t] ?? t, style: { color: "var(--text)", cursor: "help" }, children: t })
    ] }, t))
  ] });
}
const ii = (e) => (e.closing ?? []).filter((t) => t.started === !1).map((t) => t.key);
function pn(e) {
  const t = /^(build|shape|review)-t(\d+)$/.exec(e);
  return t ? { kind: t[1] === "build" ? "ticket" : t[1] === "shape" ? "decision" : "review", t: Number(t[2]) } : e === "build-spec" ? { kind: "spec" } : ["intake", "shape", "grill", "plan", "review", "done"].includes(e) ? { kind: "stage", column: e } : null;
}
const hn = (e, t) => Object.values(e.sessions).filter((i) => i === t).length > 1;
function ui() {
  const e = qn(), t = (e == null ? void 0 : e.active) !== !1, i = zt(), [r, l] = O(() => rt("initiatives")), [g, f] = O(() => rt("repos")), [m, d] = O(!1), [s, h] = O(""), [n, c] = O(() => {
    const b = rt("main");
    return !b || !["new", "initiative"].includes(b.kind) ? null : b.kind === "initiative" ? { ...b, autoStart: void 0 } : b;
  });
  Q(() => {
    n && st("main", n);
  }, [n]);
  const [I, j] = vn("rail", 300, 168, 620), [T, _] = O(null), [D, q] = O(() => localStorage.getItem("kipo.railOpen") !== "0"), P = (b) => {
    q(b), localStorage.setItem("kipo.railOpen", b ? "1" : "0");
  };
  Q(() => {
    uo(i).catch(() => {
    });
  }, [i]);
  const [te, ne] = O(""), E = He(() => {
    he.listInitiatives().then((b) => {
      var W;
      l(b.initiatives), st("initiatives", b.initiatives), f(b.repos ?? []), st("repos", b.repos ?? []), h(""), ne((W = b.errors) != null && W.length ? `GitHub is refusing calls for ${b.errors.length === 1 ? b.errors[0].repo.split("/").pop() : `${b.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch((b) => h(we(b)));
  }, []);
  Q(() => {
    if (E(), !t) return;
    const b = setInterval(E, 15e3);
    return () => clearInterval(b);
  }, [E, t]), Q(() => {
    if (r === null) return;
    const b = (n == null ? void 0 : n.kind) === "initiative" && !r.some((H) => H.repo === n.repo && H.number === n.number);
    if (n && !b) return;
    const W = r[0];
    c(W ? { kind: "initiative", repo: W.repo, number: W.number } : { kind: "new" });
  }, [r, n]);
  const S = (b, W) => c({ kind: "initiative", repo: b.repo, number: b.number, autoStart: W }), M = (b) => {
    l((W) => (W ?? []).filter((H) => !(H.repo === b.repo && H.number === b.number))), he.hide(b.repo, b.number).then(E).catch((W) => {
      h(we(W)), E();
    });
  }, N = (b) => {
    l((W) => (W ?? []).filter((H) => !(H.repo === b.repo && H.number === b.number))), he.removeInitiative(b.repo, b.number).then(E).catch((W) => {
      h(we(W)), E();
    });
  }, ie = (b) => {
    f((W) => (W ?? []).filter((H) => H.slug !== b)), l((W) => (W ?? []).filter((H) => H.repo !== b)), he.removeRepo(b).then(E).catch((W) => {
      h(we(W)), E();
    });
  }, le = (b, W) => {
    Promise.allSettled(W.map((H) => he.unhide(b, H))).then(E);
  }, ge = (n == null ? void 0 : n.kind) === "initiative" ? `${n.repo}#${n.number}` : null, [Z, ce] = O(0), F = He((b) => ce(b), []);
  return /* @__PURE__ */ u("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    D ? /* @__PURE__ */ u(be, { children: [
      /* @__PURE__ */ o(
        Eo,
        {
          width: I,
          onCollapse: () => P(!1),
          items: r,
          repos: g,
          error: s,
          notice: te,
          selected: ge,
          attention: Z,
          spineSlot: _,
          onNew: () => c({ kind: "new" }),
          onAddRepo: () => d(!0),
          onRemoveRepo: ie,
          onRestore: le,
          onSelect: (b) => S(b),
          onHide: M,
          onRemove: N
        }
      ),
      /* @__PURE__ */ o(wn, { direction: "vertical", label: "Resize the effort list", onDrag: (b) => j((W) => W + b), onReset: () => j(228) })
    ] }) : /* @__PURE__ */ o(
      Mo,
      {
        items: r,
        selected: ge,
        attention: Z,
        onNew: () => c({ kind: "new" }),
        onSelect: (b) => S(b),
        onExpand: () => P(!0)
      }
    ),
    /* @__PURE__ */ u("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (n == null ? void 0 : n.kind) === "new" && /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ o(
        Ho,
        {
          onStarted: (b) => {
            E(), S(b, !0);
          },
          onCancel: r && r.length ? () => c(r[0] ? { kind: "initiative", repo: r[0].repo, number: r[0].number } : { kind: "new" }) : void 0
        }
      ) }),
      (n == null ? void 0 : n.kind) === "initiative" && /* @__PURE__ */ o(
        Qo,
        {
          repo: n.repo,
          number: n.number,
          autoStart: n.autoStart,
          active: t,
          spineHost: D ? T : null,
          spineCompact: I < 340,
          onChanged: E,
          onRemoved: () => {
            E(), c(null);
          },
          onNeeds: F
        },
        `${n.repo}#${n.number}`
      )
    ] }),
    m && /* @__PURE__ */ o(io, { onAdded: E, onClose: () => d(!1) })
  ] });
}
export {
  ui as default
};
