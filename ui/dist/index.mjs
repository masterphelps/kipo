import { jsxs as c, jsx as o, Fragment as ve } from "react/jsx-runtime";
import { useAppApi as Rt, useAppInfo as zn } from "@kirocrew/app-sdk";
import { useState as E, useCallback as ze, useEffect as Y, useRef as ye, useLayoutEffect as An, useMemo as yt } from "react";
import { Btn as Ce, Badge as Nt, MarkdownRenderer as bt } from "@kirocrew/app-sdk/ui";
import { X as On, FolderGit2 as on, FolderOpen as En, MessageSquare as rn, ChevronRight as vt, Plus as Wn, FolderPlus as Hn, MoreHorizontal as Pt, ExternalLink as Dt, EyeOff as Mn, Trash2 as Lt, Map as Nn, PanelRight as Pn } from "lucide-react";
import { createPortal as Dn } from "react-dom";
const Ln = "/apps/kipo/api";
class wt extends Error {
  constructor(t, i, r) {
    super(i), this.name = "BackendError", this.status = t, this.code = r;
  }
}
async function re(e, t = "GET", i) {
  let r;
  try {
    r = await fetch(`${Ln}${e}`, {
      method: t,
      credentials: "include",
      headers: i === void 0 ? void 0 : { "Content-Type": "application/json" },
      body: i === void 0 ? void 0 : JSON.stringify(i)
    });
  } catch {
    throw new wt(0, "Couldn't reach the KiPo backend. Is the app running?", null);
  }
  const s = await r.text();
  let p;
  if (s.trim())
    try {
      p = JSON.parse(s);
    } catch {
      p = void 0;
    }
  if (!r.ok) {
    const d = p ?? {}, f = typeof d.error == "string" && d.error ? d.error : `The KiPo backend answered ${r.status}.`;
    throw new wt(r.status, f, typeof d.code == "string" ? d.code : null);
  }
  return p;
}
const Re = (e, t) => {
  const [i, r] = e.split("/");
  return `/initiatives/${encodeURIComponent(i)}/${encodeURIComponent(r)}/${t}`;
}, pe = {
  getConfig: () => re("/config"),
  putConfig: (e) => re("/config", "PUT", e),
  discoverRepos: () => re("/repos/discover"),
  addRepo: (e) => re("/repos", "POST", { path: e }),
  removeRepo: (e) => re("/repos/remove", "POST", { slug: e }),
  browse: (e) => re(e ? `/browse?path=${encodeURIComponent(e)}` : "/browse"),
  listInitiatives: () => re("/initiatives"),
  startInitiative: (e) => re("/initiatives", "POST", e),
  getInitiative: (e, t) => re(Re(e, t)),
  // Next along the path, or `to` a later column.
  advance: (e, t, i, r = null) => re(`${Re(e, t)}/advance`, "POST", { force: i, to: r }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (e, t, i) => re(`${Re(e, t)}/session`, "POST", { skill: null, ticket: null, mode: null, ...i }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (e, t, i) => re(`${Re(e, t)}/sessions/started`, "POST", { key: i }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (e, t, i) => re(`${Re(e, t)}/sessions/closed`, "POST", { keys: i }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (e, t, i) => re(`${Re(e, t)}/sessions/activity`, "POST", { activity: i }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (e, t, i, r, s) => re(`${Re(e, t)}/sessions/woken`, "POST", { key: i, stall: r, why: s }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (e, t, i) => re(`${Re(e, t)}/skill`, "POST", { skill: i }),
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
  hide: (e, t) => re(`${Re(e, t)}/hide`, "POST", {}),
  unhide: (e, t) => re(`${Re(e, t)}/unhide`, "POST", {}),
  removeInitiative: (e, t) => re(`${Re(e, t)}/remove`, "POST", {}),
  ticket: (e, t, i) => re(`${Re(e, t)}/tickets/${i}`),
  frontier: (e, t) => re(`${Re(e, t)}/frontier`),
  doc: (e, t, i) => re(`${Re(e, t)}/doc?href=${encodeURIComponent(i)}`)
};
function Se(e) {
  return e instanceof Error ? e.message : String(e);
}
const kt = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Bn = {
  intake: "A raw issue, request or refactor candidate nobody has shaped yet.",
  shape: "Open questions: a wayfinder map, a prototype, research, a questionnaire waiting on someone.",
  grill: "An interview in progress. It updates GLOSSARY.md and adds ADRs.",
  plan: "A spec and the tickets that hang off it, with their blocking links.",
  build: "Tickets being built, or a branch with commits.",
  review: "A PR is open: the agent reviews it, fixes what it finds and merges it.",
  done: "Merged. /retro turns what went wrong into checks, standards and agent instructions."
}, Ct = {
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
}, jn = ["intake", "decide", "deliver", "done"], qn = { intake: "Intake", decide: "Decide", deliver: "Deliver", done: "Done" }, Gn = {
  intake: ["intake"],
  decide: ["shape", "grill", "plan"],
  deliver: ["build", "review"],
  done: ["done"]
}, Kn = (e) => jn.find((t) => Gn[t].includes(e)) ?? "intake", ct = (e) => !e.answer && typeof e.title == "string" && e.title.trim() !== "", b = {
  body: 13,
  small: 12,
  tiny: 11,
  title: 15
}, lt = {
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: b.body,
  width: "100%",
  minWidth: 0
}, G = { color: "var(--muted)" }, $e = { color: "var(--text-strong, var(--text))", fontWeight: 600 };
function qe({ children: e }) {
  return e ? /* @__PURE__ */ o(
    "div",
    {
      role: "alert",
      style: {
        background: "var(--danger-subtle)",
        color: "var(--danger-text)",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: b.body
      },
      children: e
    }
  ) : null;
}
function sn({ path: e }) {
  return /* @__PURE__ */ o(
    "code",
    {
      title: e,
      style: {
        background: "var(--bg-elevated)",
        color: "var(--text)",
        fontSize: b.tiny,
        borderRadius: 4,
        padding: "1px 5px",
        wordBreak: "break-all",
        fontFamily: "var(--font-mono, ui-monospace, monospace)"
      },
      children: e
    }
  );
}
function Bt({ children: e, onClick: t, disabled: i, primary: r, danger: s, title: p }) {
  const d = r ? "var(--accent)" : s ? "var(--danger-subtle)" : "var(--bg-elevated)", f = r ? "var(--accent-fg, #fff)" : s ? "var(--danger-text)" : "var(--text)";
  return /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      onClick: t,
      disabled: i,
      title: p,
      style: {
        height: 28,
        padding: "0 12px",
        flexShrink: 0,
        alignSelf: "center",
        whiteSpace: "nowrap",
        fontSize: b.body,
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
function ht({ title: e, aside: t, children: i, defaultOpen: r = !0 }) {
  const [s, p] = E(r);
  return /* @__PURE__ */ c("section", { style: { borderTop: "1px solid var(--border)" }, children: [
    /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        onClick: () => p((d) => !d),
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
          fontSize: b.small
        },
        children: [
          /* @__PURE__ */ o("span", { "aria-hidden": !0, style: { ...G, width: 10, fontSize: 9 }, children: s ? "▾" : "▸" }),
          /* @__PURE__ */ o("span", { style: $e, children: e }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          t != null && /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny }, children: t })
        ]
      }
    ),
    s && /* @__PURE__ */ o("div", { style: { padding: "0 12px 10px 28px", fontSize: b.body }, children: i })
  ] });
}
function jt(e) {
  const t = Date.parse(e);
  if (Number.isNaN(t)) return "";
  const i = Math.max(0, Math.round((Date.now() - t) / 1e3));
  if (i < 60) return "just now";
  const r = Math.round(i / 60);
  if (r < 60) return `${r} min ago`;
  const s = Math.round(r / 60);
  if (s < 24) return `${s} h ago`;
  const p = Math.round(s / 24);
  return p < 30 ? `${p} d ago` : new Date(t).toLocaleDateString();
}
function xt({ kind: e, map: t }) {
  if (e !== "map" && !t) return null;
  const i = e === "map";
  return /* @__PURE__ */ c(
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
  var h;
  const [r, s] = E(null), [p, d] = E(""), f = ze(async (l) => {
    d("");
    try {
      s(await pe.browse(l));
    } catch (u) {
      d(Se(u));
    }
  }, []);
  return Y(() => {
    f();
  }, [f]), /* @__PURE__ */ c(
    "div",
    {
      className: "rounded-md p-3 mb-3",
      style: { background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ o(qe, { children: p }),
        r ? /* @__PURE__ */ c(ve, { children: [
          /* @__PURE__ */ c("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ o(Ce, { disabled: !r.parent, onClick: () => r.parent && f(r.parent), children: "Up" }),
            /* @__PURE__ */ o(sn, { path: r.path }),
            ((h = r.here) == null ? void 0 : h.slug) && /* @__PURE__ */ c(Ce, { primary: !0, disabled: e === r.path, onClick: () => t(r.path), children: [
              i,
              " this folder"
            ] })
          ] }),
          /* @__PURE__ */ c("ul", { className: "flex flex-col max-h-72 overflow-y-auto", children: [
            r.folders.map((l) => /* @__PURE__ */ c("li", { className: "flex items-center gap-2 py-1", children: [
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  className: "text-sm text-left flex-1 truncate hover:underline",
                  style: { background: "transparent", color: "var(--text)" },
                  onClick: () => f(l.path),
                  children: l.name
                }
              ),
              l.repo && (l.slug ? /* @__PURE__ */ c(ve, { children: [
                /* @__PURE__ */ o(Nt, { variant: "aim", children: l.slug }),
                /* @__PURE__ */ o(Ce, { primary: !0, disabled: e === l.path, onClick: () => t(l.path), children: i })
              ] }) : /* @__PURE__ */ o(Nt, { variant: "muted", children: "no GitHub remote" }))
            ] }, l.path)),
            r.folders.length === 0 && /* @__PURE__ */ o("li", { className: "text-sm text-muted", children: "No folders here." })
          ] })
        ] }) : /* @__PURE__ */ o("p", { className: "text-sm text-muted", children: "Opening your home folder…" })
      ]
    }
  );
}
function _n({ onAdded: e, onClose: t }) {
  const [i, r] = E(null), [s, p] = E(""), [d, f] = E(!1), [h, l] = E(null);
  Y(() => {
    let n = !0;
    return pe.tree().then((a) => {
      n && r(a.available);
    }).catch((a) => {
      n && (r([]), p(Se(a)));
    }), () => {
      n = !1;
    };
  }, []), Y(() => {
    const n = (a) => {
      a.key === "Escape" && t();
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [t]);
  const u = async (n) => {
    l(n), p("");
    try {
      await pe.addRepo(n), e(), t();
    } catch (a) {
      p(Se(a));
    } finally {
      l(null);
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
      children: /* @__PURE__ */ c(
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
            /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
              /* @__PURE__ */ c("div", { style: { flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ o("div", { style: { ...$e, fontSize: b.body }, children: "Add a repo" }),
                /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.tiny, marginTop: 1 }, children: "It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed." })
              ] }),
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  onClick: t,
                  "aria-label": "Close",
                  style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "inline-flex" },
                  children: /* @__PURE__ */ o(On, { size: 15 })
                }
              )
            ] }),
            /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 14px" }, children: [
              /* @__PURE__ */ o(qe, { children: s }),
              i === null && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "6px 6px" }, children: "Looking for checkouts on this Mac…" }),
              i !== null && i.length > 0 && !d && /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column" }, children: i.slice(0, 12).map((n) => /* @__PURE__ */ c(
                "button",
                {
                  type: "button",
                  disabled: !!h,
                  onClick: () => void u(n.path),
                  title: n.path,
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
                    background: "transparent",
                    color: "var(--text)",
                    cursor: h ? "default" : "pointer",
                    textAlign: "left"
                  },
                  children: [
                    /* @__PURE__ */ o(on, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, fontSize: b.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: h === n.path ? "Adding…" : n.slug }),
                    n.maps > 0 && /* @__PURE__ */ c("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0 }, children: [
                      n.maps,
                      " open map",
                      n.maps === 1 ? "" : "s"
                    ] })
                  ]
                },
                n.path
              )) }),
              i !== null && i.length === 0 && !d && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "6px 6px" }, children: "No un-added checkouts found under your home folder. Browse for one:" }),
              d ? /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(ln, { busy: h, onAdd: (n) => void u(n) }) }) : /* @__PURE__ */ c(
                "button",
                {
                  type: "button",
                  onClick: () => f(!0),
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
                    fontSize: b.small
                  },
                  children: [
                    /* @__PURE__ */ o(En, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    "Browse for a folder…"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ o("div", { style: { display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderTop: "1px solid var(--border)" }, children: /* @__PURE__ */ o(Ce, { onClick: t, children: "Cancel" }) })
          ]
        }
      )
    }
  );
}
const an = "kipo.layout.v1";
function qt() {
  try {
    return JSON.parse(localStorage.getItem(an) || "{}");
  } catch {
    return {};
  }
}
function cn(e, t, i, r) {
  const s = ze((h) => Math.round(Math.min(r, Math.max(i, h))), [i, r]), [p, d] = E(() => {
    const h = qt()[e];
    return s(typeof h == "number" ? h : t);
  });
  Y(() => {
    const h = qt();
    h[e] = p;
    try {
      localStorage.setItem(an, JSON.stringify(h));
    } catch {
    }
  }, [e, p]);
  const f = ze((h) => {
    d((l) => s(typeof h == "function" ? h(l) : h));
  }, [s]);
  return [p, f];
}
function dn({ direction: e, onDrag: t, onReset: i, label: r }) {
  const s = ye(null), [p, d] = E(!1), [f, h] = E(!1), l = e === "vertical", u = (A) => l ? A.clientX : A.clientY;
  Y(() => {
    if (!p) return;
    const A = (D) => {
      if (s.current == null) return;
      const q = u(D), M = q - s.current;
      M && (s.current = q, t(M));
    }, j = () => {
      s.current = null, d(!1);
    };
    return window.addEventListener("pointermove", A), window.addEventListener("pointerup", j), window.addEventListener("pointercancel", j), () => {
      window.removeEventListener("pointermove", A), window.removeEventListener("pointerup", j), window.removeEventListener("pointercancel", j);
    };
  }, [p, t]);
  const n = (A) => {
    A.preventDefault(), s.current = u(A), d(!0);
  }, a = (A) => {
    const j = A.shiftKey ? 40 : 10, D = l ? "ArrowLeft" : "ArrowUp", q = l ? "ArrowRight" : "ArrowDown";
    A.key === D && (A.preventDefault(), t(-j)), A.key === q && (A.preventDefault(), t(j));
  }, x = p || f, B = l ? { width: 9, margin: "0 -4px", cursor: "col-resize", alignSelf: "stretch" } : { height: 9, margin: "-4px 0", cursor: "row-resize", width: "100%" };
  return /* @__PURE__ */ c(
    "div",
    {
      role: "separator",
      "aria-orientation": l ? "vertical" : "horizontal",
      "aria-label": r,
      tabIndex: 0,
      title: `${r}. Drag to resize, double-click to reset.`,
      onPointerDown: n,
      onPointerEnter: () => h(!0),
      onPointerLeave: () => h(!1),
      onDoubleClick: i,
      onKeyDown: a,
      style: { ...B, flexShrink: 0, position: "relative", zIndex: 2, touchAction: "none", display: "flex", justifyContent: "center", alignItems: "center" },
      children: [
        /* @__PURE__ */ o(
          "span",
          {
            "aria-hidden": !0,
            style: l ? { width: x ? 3 : 1, height: "100%", borderRadius: 2, background: x ? "var(--accent)" : "var(--border)", transition: "width .1s" } : { height: x ? 3 : 1, width: "100%", borderRadius: 2, background: x ? "var(--accent)" : "var(--border)", transition: "height .1s" }
          }
        ),
        /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
          position: "absolute",
          borderRadius: 3,
          background: x ? "var(--accent)" : "var(--border)",
          ...l ? { width: 5, height: 28, top: "calc(50% - 14px)" } : { height: 5, width: 28, left: "calc(50% - 14px)" }
        } }),
        p && /* @__PURE__ */ o("div", { style: { position: "fixed", inset: 0, zIndex: 9999, cursor: l ? "col-resize" : "row-resize" } })
      ]
    }
  );
}
function Fn(e, t, i = 0.75) {
  const [r, s] = cn(e, 0, 0, 4e3), p = ye(null), d = ze((h) => {
    const l = Math.round(window.innerHeight * i);
    s((u) => {
      var a;
      const n = u || ((a = p.current) == null ? void 0 : a.offsetHeight) || t;
      return Math.max(t, Math.min(l, n + h));
    });
  }, [t, i, s]), f = r ? { flex: `0 0 ${r}px`, minHeight: 0, overflowY: "auto" } : { flex: "0 1 auto", minHeight: 0, maxHeight: `${Math.round(i * 100)}%`, overflowY: "auto" };
  return { ref: p, style: f, onDrag: d, reset: () => s(0) };
}
const Tt = "kipo.cache.v3:";
try {
  for (let e = localStorage.length - 1; e >= 0; e--) {
    const t = localStorage.key(e);
    t && t.startsWith("kipo.cache.") && !t.startsWith(Tt) && localStorage.removeItem(t);
  }
} catch {
}
const at = /* @__PURE__ */ new Map();
function tt(e) {
  if (at.has(e)) return at.get(e);
  try {
    const t = localStorage.getItem(Tt + e);
    if (t == null) return null;
    const i = JSON.parse(t);
    return at.set(e, i), i;
  } catch {
    return null;
  }
}
function nt(e, t) {
  at.set(e, t);
  try {
    localStorage.setItem(Tt + e, JSON.stringify(t));
  } catch {
  }
}
const Yn = "KiPo", Gt = "kipo.sessionsFiled.v2", Jn = (e) => {
  var i;
  const t = (e == null ? void 0 : e.id) ?? ((i = e == null ? void 0 : e.folder) == null ? void 0 : i.id);
  if (!t) throw new Error("the sidebar didn't return the new folder");
  return t;
};
async function un(e, t, i, r) {
  const s = await e.get("/api/chat/folders"), p = s == null ? void 0 : s.find((d) => d.name === t && (d.parent_id || null) === i);
  return p ? p.id : Jn(await e.post("/api/chat/folders", {
    name: t,
    ...i ? { parent_id: i } : {},
    ...r ? { icon: r } : {}
  }));
}
const Un = (e) => un(e, Yn, null, "⚗️"), Qn = (e) => e.split("/").pop() || e;
async function pn(e, t) {
  const i = await Un(e);
  try {
    return await un(e, Qn(t), i);
  } catch {
    return i;
  }
}
async function Xn(e) {
  if (localStorage.getItem(Gt)) return;
  const { byRepo: t } = await pe.listSessions(), i = /* @__PURE__ */ new Map();
  for (const { repo: r } of t ?? [])
    i.has(r) || i.set(r, await pn(e, r));
  await Promise.all((t ?? []).map(
    ({ slot: r, repo: s }) => e.patch(`/api/chat/slots/${encodeURIComponent(r)}/folder`, { folder_id: i.get(s) }).catch(() => {
    })
    // a session that was closed or deleted is simply skipped
  )), localStorage.setItem(Gt, (/* @__PURE__ */ new Date()).toISOString());
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
  const r = ye(null), [s, p] = E({ x: e, y: t });
  return An(() => {
    const d = r.current;
    if (!d) return;
    const f = d.getBoundingClientRect();
    p({
      x: e + f.width > window.innerWidth ? Math.max(0, e - f.width) : e,
      y: t + f.height > window.innerHeight ? Math.max(0, t - f.height) : t
    });
  }, [e, t]), Y(() => {
    const d = (l) => {
      r.current && !r.current.contains(l.target) && i();
    }, f = (l) => {
      l.key === "Escape" && i();
    }, h = setTimeout(() => {
      window.addEventListener("mousedown", d, !0), window.addEventListener("keydown", f, !0), window.addEventListener("blur", i);
    }, 50);
    return () => {
      clearTimeout(h), window.removeEventListener("mousedown", d, !0), window.removeEventListener("keydown", f, !0), window.removeEventListener("blur", i);
    };
  }, [i]), { ref: r, pos: s };
}
function Kt({ x: e, y: t, items: i, onClose: r }) {
  const { ref: s, pos: p } = fn(e, t, r);
  return Y(() => {
    var d, f;
    (f = (d = s.current) == null ? void 0 : d.querySelector("[role=menuitem]")) == null || f.focus();
  }, [s]), /* @__PURE__ */ o("div", { ref: s, role: "menu", style: { ...hn, left: p.x, top: p.y, padding: "4px 0", minWidth: 160 }, children: i.map((d, f) => {
    if ("separator" in d)
      return /* @__PURE__ */ o("div", { role: "separator", style: { height: 1, background: "var(--border, rgba(255,255,255,0.15))", margin: "2px 0" } }, `sep-${f}`);
    const h = d.icon, l = () => {
      r(), d.onSelect();
    };
    return /* @__PURE__ */ o(
      "div",
      {
        role: "menuitem",
        tabIndex: 0,
        onClick: (u) => {
          u.stopPropagation(), l();
        },
        onKeyDown: (u) => {
          (u.key === "Enter" || u.key === " ") && (u.preventDefault(), l());
        },
        onMouseEnter: (u) => {
          u.currentTarget.style.background = "rgba(255,255,255,0.1)";
        },
        onMouseLeave: (u) => {
          u.currentTarget.style.background = "transparent";
        },
        style: {
          padding: "6px 16px",
          fontSize: 12,
          cursor: "pointer",
          outline: "none",
          color: d.danger ? "var(--danger, #f38ba8)" : "var(--text, #e0e0e0)"
        },
        children: /* @__PURE__ */ c("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ o("span", { style: { width: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.85 }, children: h ? /* @__PURE__ */ o(h, { size: 13 }) : null }),
          d.label
        ] })
      },
      d.label
    );
  }) });
}
function ft({ x: e, y: t, title: i, children: r, action: s, onConfirm: p, onClose: d }) {
  const { ref: f, pos: h } = fn(e, t, d);
  return /* @__PURE__ */ c(
    "div",
    {
      ref: f,
      role: "alertdialog",
      "aria-label": i,
      style: { ...hn, left: h.x, top: h.y, padding: "12px 14px", width: 280 },
      children: [
        /* @__PURE__ */ o("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e0e0e0)", lineHeight: 1.35 }, children: i }),
        r && /* @__PURE__ */ o("div", { style: { fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6, lineHeight: 1.45 }, children: r }),
        /* @__PURE__ */ c("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ o(Ce, { onClick: d, children: "Cancel" }),
          /* @__PURE__ */ o(Ce, { danger: !0, onClick: () => {
            d(), p();
          }, children: s })
        ] })
      ]
    }
  );
}
const Vn = {
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
}, dt = {
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
}, Zn = (e) => [Vn[e.code], Ye[e.state]].filter(Boolean).join(`
`);
function eo({ term: e, title: t, children: i }) {
  return /* @__PURE__ */ o(
    "abbr",
    {
      title: t ?? (e ? dt[e] : void 0),
      style: { textDecoration: "underline dotted", textDecorationColor: "color-mix(in srgb, currentColor 45%, transparent)", textUnderlineOffset: 2, cursor: "help" },
      children: i
    }
  );
}
const O = {
  done: { label: "done", color: "#3fae6a", text: "#7fd39a" },
  review: { label: "in review", color: "#a78bfa", text: "#a78bfa" },
  building: { label: "building", color: "#60a5fa", text: "#60a5fa" },
  you: { label: "HITL", color: "#f5b14c", text: "#f5b14c" },
  afk: { label: "agent", color: "#2dd4bf", text: "#2dd4bf" },
  blocked: { label: "blocked", color: "#c2615b", text: "#e08a85" },
  fog: { label: "fog", color: "transparent", text: "var(--muted)" }
};
function _t({ tile: e, onClick: t, size: i = 34, open: r, status: s, bare: p, numberOnly: d, width: f }) {
  const h = O[e.state], l = e.state !== "blocked", u = e.state === "done", n = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((x) => `#${x}`).join(", ")}` : `#${e.number} ${e.title}: ${h.label}`;
  return /* @__PURE__ */ c(
    "button",
    {
      type: "button",
      onClick: t,
      title: `${n}${s === "running" ? " · agent working" : s === "attention" ? " · needs you: a trust prompt or question" : s === "waiting" ? " · awaiting input" : ""}

${Zn(e)}`,
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
        background: u ? "rgba(63,174,106,.22)" : l ? h.color : "transparent",
        color: u ? "#7fd39a" : l ? "#14121c" : "var(--muted)",
        border: l ? "1px solid transparent" : `1.5px solid ${h.color}`
      },
      children: [
        d ? e.number : /* @__PURE__ */ c(ve, { children: [
          !p && /* @__PURE__ */ o("span", { style: { position: "absolute", top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }, children: e.number }),
          e.code
        ] }),
        s && // Inside the tile's top-right corner, in the tile's own text color so it
        // reads on every tile color: pulsing while the agent works or needs
        // you (trust prompt, question), steady when merely waiting.
        /* @__PURE__ */ o(
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
async function to(e, t, i, r, s, p) {
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
    ...p ? { agent: p } : {}
  }), h = (f == null ? void 0 : f.key) || i;
  return await e.post("/api/chat?ws=1", { slot: h, message: r }), h;
}
const gn = "kipo.closedSessions.v1", Fe = (e) => !!e && zt().has(e);
function zt() {
  try {
    return new Set(JSON.parse(localStorage.getItem(gn) || "[]"));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function St(e) {
  const t = zt();
  t.add(e);
  try {
    localStorage.setItem(gn, JSON.stringify([...t].slice(-500)));
  } catch {
  }
}
async function Ft(e, t) {
  try {
    await e.del(`/api/chat/slots/${encodeURIComponent(t)}`);
  } catch (i) {
    if (!/404|not.?found/i.test(String((i == null ? void 0 : i.message) ?? i))) return !1;
  }
  return St(t), !0;
}
async function Yt(e, t, i) {
  const r = zt(), s = [];
  for (const p of t)
    if (!(!p || p === i)) {
      if (r.has(p)) {
        s.push(p);
        continue;
      }
      try {
        const d = await e.get(`/api/chat/slots/${encodeURIComponent(p)}?limit=1`);
        if (d != null && d.running) continue;
        await e.del(`/api/chat/slots/${encodeURIComponent(p)}`), St(p), s.push(p);
      } catch (d) {
        /404|not.?found/i.test(String((d == null ? void 0 : d.message) ?? d)) && (St(p), s.push(p));
      }
    }
  return s;
}
const no = [
  { id: "intake", label: "Intake", skill: "kipo-intake", matt: ["setup-matt-pocock-skills", "ask-matt", "triage", "improve-codebase-architecture"], what: "Set the repo up, triage the issue, pick a start" },
  { id: "shape", label: "Shape", skill: "kipo-shape", matt: ["wayfinder", "research", "prototype", "to-questionnaire"], any: ["handoff", "teach"], what: "Huge, foggy: chart the map, work its decision tickets" },
  { id: "grill", label: "Grill", skill: "kipo-grill", matt: ["grill-with-docs", "grill-me", "grilling", "domain-modeling"], any: ["wait-what"], what: "An idea: interview until it's sharp" },
  { id: "plan", label: "Plan", skill: "kipo-plan", matt: ["to-spec", "to-tickets", "codebase-design"], what: "Hand-over: spec, then tickets" },
  { id: "build", label: "Build", skill: "kipo-build", matt: ["implement", "implement-spec", "tdd", "diagnosing-bugs", "wizard"], what: "One ticket per session, test-first, open a PR" },
  { id: "review", label: "Review", skill: "kipo-review", matt: ["code-review", "pr"], what: "Review, then merge by Merge Danger" },
  { id: "done", label: "Done", skill: "kipo-done", matt: ["retro", "writing-for-agents"], what: "Retro the run, tidy the docs" }
], oo = (e) => e.state === "done" ? "done" : e.source ? "intake" : e.state === "review" ? "review" : e.type === "build" ? "build" : e.type === "grilling" ? "grill" : "shape";
function io(e) {
  const t = (u, n = 0) => u.you ? { color: O.you.color, active: !0 } : u.blocked ? { color: O.blocked.color, active: !0 } : u.building ? { color: O.building.color, active: !0 } : u.afk ? { color: O.afk.color, active: !0 } : u.review ? { color: O.review.color, active: !0 } : n ? { color: "var(--muted)", active: !0 } : u.done ? { color: O.done.color, active: !1 } : { color: null, active: !1 }, i = [
    { id: "intake", ...t(e.intake) },
    { id: "shape", ...t(e.shape, e.fog) },
    { id: "grill", ...t(e.grill) },
    {
      id: "plan",
      ...e.specCut ? { color: O.done.color, active: !1 } : e.handover ? { color: O.you.color, active: !0 } : { color: null, active: !1 }
    },
    { id: "build", ...t(e.build) },
    {
      id: "review",
      ...e.prs.open ? { color: O.review.color, active: !0 } : e.prs.merged ? { color: O.done.color, active: !1 } : { color: null, active: !1 }
    },
    {
      id: "done",
      ...e.landed ? e.retro ? { color: O.done.color, active: !1 } : { color: O.you.color, active: !0 } : { color: null, active: !1 }
    }
  ], r = { intake: "Intake", shape: "Shape", grill: "Grill", plan: "Plan", build: "Build", review: "Review", done: "Done" }, s = [...i].reverse().find((u) => u.active), p = s ? r[s.id] : e.total || e.prs.merged ? "Done" : "—", d = e.intake.you + e.shape.you + e.grill.you + e.build.you + (e.handover ? 1 : 0) + (e.landed && !e.retro ? 1 : 0), f = e.shape.building + e.grill.building + e.build.building + e.intake.building, h = e.shape.afk + e.grill.afk + e.build.afk + e.intake.afk, l = [
    e.doneTiles ? `${e.doneTiles}/${e.total} done` : "",
    d ? `${d} HITL` : "",
    f ? `${f} in agents` : "",
    h ? `${h} ready` : "",
    e.prs.open ? `${e.prs.open} PR${e.prs.open === 1 ? "" : "s"}` : "",
    e.fog ? `${e.fog} fog` : ""
  ].filter(Boolean);
  return { segs: i, front: p, bits: l.slice(0, 4).join(" · ") };
}
function ro({ glance: e }) {
  return /* @__PURE__ */ o("span", { style: { display: "flex", gap: 2, height: 5 }, "aria-hidden": !0, children: e.segs.map((t) => /* @__PURE__ */ o("span", { title: t.id, style: {
    flex: 1,
    borderRadius: 3,
    background: t.color ?? "transparent",
    border: t.color ? "1px solid transparent" : "1px solid var(--border)",
    opacity: t.color && !t.active ? 0.75 : 1
  } }, t.id)) });
}
const Ze = ["intake", "shape", "grill", "plan", "build", "review", "done"], so = { idea: "grill", small: "grill", huge: "shape", issue: "intake", bug: "build" }, lo = { idea: "an idea", small: "small", huge: "huge", issue: "an issue", bug: "a bug" }, Jt = {
  intake: "source issues",
  shape: "map tickets",
  grill: "questions",
  plan: "spec → tickets",
  build: "tickets",
  review: "PRs",
  done: "merged · retro"
}, ot = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Xe = (e, t) => ({ n: e, color: O[t].color });
function ao(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function co({ detail: e, statuses: t, activity: i, busy: r, autopilot: s, selectedKey: p, embedded: d, compact: f, onAutopilot: h, onOpenTile: l, onOpenConversation: u, onSelectConductor: n, onJumpQuestions: a, onHandover: x, onReview: B, onRetro: A, onClose: j }) {
  var ue, Ee, ke, Je, rt;
  const [D, q] = E(!1), M = (m) => {
    var V, U;
    return m ? (((U = (V = e.sessionStates) == null ? void 0 : V[m]) == null ? void 0 : U.decisions) ?? []).filter(ct).length : 0;
  }, Z = (((Ee = ((ue = e.sessionStates) == null ? void 0 : ue.conductor) ?? e.state) == null ? void 0 : Ee.decisions) ?? []).filter(ct).length, ne = (m) => ({ label: m === 1 ? "1 question" : `${m} questions`, color: O.you.color }), S = e.frontier, w = (S == null ? void 0 : S.tiles) ?? [], I = (ke = S == null ? void 0 : S.fogItems) != null && ke.length ? S.fogItems : (S == null ? void 0 : S.fogLeft) ?? [], K = !((Je = S == null ? void 0 : S.fogItems) != null && Je.length) && !!((rt = S == null ? void 0 : S.fogLeft) != null && rt.length), ie = new Map(Ze.map((m) => [m, []]));
  for (const m of w) ie.get(oo(m)).push(m);
  const ce = (m) => m.source ? "intake" : m.type === "build" ? "build" : m.type === "grilling" ? "grill" : "shape", fe = new Map(Ze.map((m) => [m, []]));
  for (const m of w) fe.get(ce(m)).push(m);
  const J = so[e.start] ?? "grill", he = Ze.indexOf(J), te = fe.get("build"), y = e.artifacts.find((m) => m.label === "Spec" || m.label.startsWith("Spec")), W = e.prs.filter((m) => m.state === "OPEN"), L = e.prs.filter((m) => m.state === "MERGED"), P = w.filter((m) => m.state === "done").length, se = !!e.sessions.done, _ = (m) => {
    var Le;
    const V = m.state !== "done" ? M(m.sessionKey) : 0, U = t[m.number], F = U === "attention" ? ((Le = i == null ? void 0 : i[m.number]) == null ? void 0 : Le.needs) ?? null : null, Ke = U === "running" || U === "attention", xe = U === "attention" || V > 0 || m.state === "you";
    return {
      key: `t${m.number}`,
      number: m.number,
      title: m.title,
      tile: m,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: V ? ne(V) : F === "approval" ? { label: "trust prompt", color: O.you.color } : F === "input" ? { label: "asking", color: O.you.color } : { label: O[m.state].label, color: m.state === "done" ? O.done.text : O[m.state].color, solid: m.state === "you" || m.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Ke || xe,
      attention: xe,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Ke ? i == null ? void 0 : i[m.number] : void 0,
      questions: V,
      selKeys: [`build-t${m.number}`, `shape-t${m.number}`, `review-t${m.number}`]
    };
  }, R = (m) => {
    const V = (U) => m.filter((F) => F.state === U).length;
    return { done: V("done"), you: V("you"), afk: V("afk"), building: V("building"), review: V("review"), blocked: V("blocked") };
  }, $ = (m) => {
    const V = ["you", "building", "afk", "review", "blocked", "done"];
    return [...m].sort((U, F) => V.indexOf(U.state) - V.indexOf(F.state) || U.number - F.number);
  }, oe = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, Ae = (m) => {
    const V = e.sessions[m];
    if (!V || Fe(V)) return [];
    const U = M(m);
    return [{
      key: `conv-${m}`,
      title: oe[m] ?? "Its conversation",
      chip: U ? ne(U) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => u(m),
      questions: U,
      selKeys: [m]
    }];
  }, ge = Ze.map((m) => {
    const V = fe.get(m), U = Ae(m === "build" ? "build-spec" : m);
    if (m === "plan") {
      if (te.length || y)
        return { id: m, state: "full", count: /* @__PURE__ */ c(ve, { children: [
          /* @__PURE__ */ o("b", { style: $e, children: "1 spec" }),
          " → ",
          te.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: O.done.color }], rows: U };
      if (S != null && S.handover)
        return {
          id: m,
          state: "live",
          count: /* @__PURE__ */ o("b", { style: { color: O.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: O.you.color }],
          rows: U,
          // Once the conversation exists, its row above is the way back in.
          action: U.length ? void 0 : { label: "Write the spec", onClick: x }
        };
      const ae = w.filter((me) => me.lane === "decide" && me.state !== "done").length;
      return { id: m, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${ae || "the"} decision${ae === 1 ? "" : "s"}${I.length ? ` and ${I.length} fog` : ""}`, segments: [], rows: U };
    }
    if (m === "review")
      return !W.length && !L.length && !U.length ? { id: m, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: m,
        state: W.length ? "live" : "full",
        count: /* @__PURE__ */ c(ve, { children: [
          /* @__PURE__ */ c("b", { style: $e, children: [
            L.length,
            " merged"
          ] }),
          W.length ? /* @__PURE__ */ c(ve, { children: [
            " · ",
            W.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: L.length, color: O.done.color }, { n: W.length, color: O.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...U, ...W.map((ae) => {
          const me = ae.tickets[0];
          return {
            key: `pr${ae.number}`,
            number: ae.number,
            title: ae.title,
            chip: { label: "open", color: O.review.color },
            ...me != null ? { onOpen: () => u(`review-t${me}`), selKeys: [`review-t${me}`] } : { url: ae.url }
          };
        })],
        action: W.length && !U.length ? { label: "Review the PRs", onClick: B } : void 0
      };
    if (m === "done") {
      const ae = !!(S != null && S.landed), me = ae && se && e.kind !== "map";
      return {
        id: m,
        state: P ? ae ? "live" : "full" : "queued",
        count: P ? /* @__PURE__ */ c(ve, { children: [
          /* @__PURE__ */ c("b", { style: $e, children: [
            P,
            " of ",
            w.length
          ] }),
          " · ",
          se ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: P ? void 0 : "closes when the retro runs",
        segments: [{ n: P, color: O.done.color }, { n: Math.max(0, w.length - P), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...U, ...w.filter((Qe) => Qe.state === "done").sort((Qe, pt) => Qe.number - pt.number).map(_)],
        action: ae && !se ? { label: "Run /retro", onClick: A } : me ? D ? { label: "Close the effort and its issue?", onClick: () => {
          q(!1), j();
        }, confirm: () => q(!1) } : { label: "Close effort", onClick: () => q(!0) } : void 0
      };
    }
    if (!V.length && !(m === "shape" && I.length) && !U.length)
      return Ze.indexOf(m) < he ? { id: m, state: "skipped", count: `entered at ${ot[J]}`, segments: [], rows: [] } : m === "build" ? { id: m, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: m, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const F = R(V), Ke = F.you + F.afk + F.building + F.review + F.blocked > 0 || !V.length && U.length > 0, xe = [];
    m === "grill" ? (F.done && xe.push(`${F.done} answered`), F.you && xe.push(`${F.you} waiting`)) : (F.done && xe.push(`${F.done} done`), F.you && xe.push(`${F.you} HITL`)), F.building && xe.push(`${F.building} in agents`), F.afk && xe.push(`${F.afk} ready`), F.review && xe.push(`${F.review} in review`), F.blocked && xe.push(`${F.blocked} blocked`);
    const Le = [Xe(F.done, "done"), Xe(F.building, "building"), Xe(F.review, "review"), Xe(F.you, "you"), Xe(F.afk, "afk"), Xe(F.blocked, "blocked")];
    m === "shape" && I.length && Le.push({ n: I.length, color: "transparent", dashed: !0 });
    const Ue = [...U, ...$(V.filter((ae) => ae.state !== "done")).map(_)];
    return m === "shape" && I.forEach((ae, me) => Ue.push({
      key: `fog${me}`,
      title: po(ae),
      chip: K ? { label: "left unspecified", color: O.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: m,
      state: Ke ? "live" : "full",
      count: /* @__PURE__ */ c(ve, { children: [
        xe.map((ae, me) => me === 0 ? /* @__PURE__ */ o("b", { style: $e, children: ae }, ae) : /* @__PURE__ */ c("span", { children: [
          " · ",
          ae
        ] }, ae)),
        m === "shape" && I.length ? /* @__PURE__ */ c("span", { children: [
          " · ",
          I.length,
          " fog"
        ] }) : null
      ] }),
      segments: Le,
      rows: Ue
    };
  }), de = (m) => m.state === "live", Ne = ge.reduce((m, V, U) => de(V) ? U : m, -1), We = Ne >= 0 ? ge[Ne] : null, we = R(w), Pe = w.length, v = [
    { n: we.building, label: "in agents", color: O.building.color },
    { n: we.review, label: "in review", color: O.review.color },
    { n: we.you, label: "HITL", color: O.you.color },
    { n: we.afk, label: "ready", color: O.afk.color },
    { n: we.blocked, label: "blocked", color: O.blocked.color },
    { n: I.length, label: "fog", color: "var(--muted)" }
  ].filter((m) => m.n > 0), [ee, be] = E(() => new Set(We ? [We.id] : [])), Ie = (m) => be((V) => {
    const U = new Set(V);
    return U.has(m) ? U.delete(m) : U.add(m), U;
  }), Ge = Z + ge.reduce((m, V) => m + V.rows.reduce((U, F) => U + (F.questions ?? 0), 0), 0), Oe = Object.values(i ?? {}).filter((m) => m && (m.needs === "approval" || m.needs === "input")).length, He = w.filter((m) => m.state === "you" && t[m.number] !== "attention" && !M(m.sessionKey)).length, Me = p === "conductor", De = !!e.sessions.conductor && !Fe(e.sessions.conductor), Te = f ? 10 : 16;
  return /* @__PURE__ */ c("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, ...d ? {} : { height: "100%" } }, children: [
    /* @__PURE__ */ c("div", { style: { padding: `10px ${Te}px 9px`, borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ c("span", { style: { ...G, fontSize: b.tiny, flex: 1 }, children: [
          "entered at ",
          ot[J],
          " (",
          lo[e.start] ?? e.start,
          ")"
        ] }),
        !d && /* @__PURE__ */ o("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: b.tiny, whiteSpace: "nowrap" }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { fontSize: b.small, marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }, children: Pe > 0 ? /* @__PURE__ */ c(ve, { children: [
        /* @__PURE__ */ c("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ c("b", { style: { color: O.done.text }, children: [
            we.done,
            " of ",
            Pe
          ] }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: "done" })
        ] }),
        v.map((m) => /* @__PURE__ */ c("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ o("b", { style: { color: m.color }, children: m.n }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: m.label })
        ] }, m.label))
      ] }) : /* @__PURE__ */ o("span", { style: G, children: I.length ? `${I.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
      (Ge > 0 || Oe > 0 || He > 0) && // The pill only shows when something is waiting on the human, so it
      // pulses the moment it appears — the same amber attention cue the
      // session cards use, for questions, trust prompts/asks, and HITL.
      /* @__PURE__ */ c(
        "button",
        {
          type: "button",
          onClick: a,
          className: "kipo-pulse",
          title: Oe > 0 ? "A session is stopped on a trust prompt or an ask: open it to allow or answer" : He > 0 ? "A ticket is in HITL, waiting on you: open it to act" : "Jump to the next conversation with open questions; answer them on the right",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 6,
            padding: "2px 9px",
            borderRadius: 99,
            background: O.you.color,
            color: "#14121c",
            fontSize: b.tiny,
            fontWeight: 700,
            cursor: "pointer",
            border: 0
          },
          children: [
            ao(Ge, Oe + He),
            " →"
          ]
        }
      ),
      /* @__PURE__ */ c(
        "button",
        {
          type: "button",
          "aria-pressed": s,
          onClick: () => h(!s),
          title: "When a ticket closes and frees the next Deliver ticket an agent can take, KiPo starts it. Runs while this effort is open in KiPo.",
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            padding: 0,
            marginTop: 5,
            cursor: "pointer",
            fontSize: b.tiny,
            color: s ? O.afk.text : "var(--muted)"
          },
          children: [
            /* @__PURE__ */ o(
              "span",
              {
                "aria-hidden": !0,
                className: s ? "kipo-pulse" : void 0,
                style: { width: 7, height: 7, borderRadius: 999, background: s ? O.afk.color : "var(--muted)" }
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
    /* @__PURE__ */ c("div", { style: d ? void 0 : { flex: 1, minHeight: 0, overflowY: "auto" }, children: [
      /* @__PURE__ */ o("div", { style: { padding: `9px ${Te}px`, borderBottom: "1px solid var(--border)" }, children: /* @__PURE__ */ c(
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
            fontSize: b.small,
            fontWeight: 700,
            border: "1px solid var(--accent)",
            background: Me ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: Me ? "var(--accent-fg, #fff)" : "var(--accent)"
          },
          children: [
            /* @__PURE__ */ o(rn, { size: 14, "aria-hidden": !0, style: { flexShrink: 0 } }),
            /* @__PURE__ */ o("span", { style: { flex: 1 }, children: "Conductor" }),
            Z > 0 ? /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${Me ? "var(--accent-fg, #fff)" : O.you.color}`,
              color: Me ? "var(--accent-fg, #fff)" : O.you.color
            }, children: Z === 1 ? "1 question" : `${Z} questions` }) : /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, fontWeight: 400, opacity: 0.75 }, children: De ? "conversation" : "not started" })
          ]
        }
      ) }),
      ge.map((m) => /* @__PURE__ */ o(
        uo,
        {
          s: m,
          busy: r,
          open: ee.has(m.id),
          selectedKey: p,
          compact: f,
          onToggle: () => Ie(m.id),
          onOpenTile: l
        },
        m.id
      )),
      /* @__PURE__ */ c("div", { style: { display: "flex", gap: 12, alignItems: "center", padding: `9px ${Te}px`, fontSize: b.tiny, color: "var(--muted)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ o(et, { color: O.done.color, label: "done" }),
        /* @__PURE__ */ o(et, { color: O.building.color, label: "in agents" }),
        /* @__PURE__ */ o(et, { color: O.you.color, label: "HITL" }),
        /* @__PURE__ */ o(et, { color: O.afk.color, label: "ready" }),
        /* @__PURE__ */ o(et, { color: O.blocked.color, label: "blocked" })
      ] })
    ] })
  ] });
}
function et({ color: e, label: t }) {
  return /* @__PURE__ */ c("span", { children: [
    /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, background: e, marginRight: 4, verticalAlign: -1 } }),
    t
  ] });
}
function uo({ s: e, open: t, busy: i, selectedKey: r, compact: s, onToggle: p, onOpenTile: d }) {
  const f = e.state === "skipped" || e.state === "queued", h = e.rows.length > 0 || !!e.action, l = no.find((a) => a.id === e.id), u = e.segments.reduce((a, x) => a + x.n, 0), n = e.rows.reduce((a, x) => a + (x.questions ?? 0), 0);
  return /* @__PURE__ */ c("div", { style: {
    borderBottom: "1px solid var(--border)",
    background: t ? "var(--bg-elevated)" : void 0,
    borderLeft: t ? `2px solid ${O.you.color}` : "2px solid transparent"
  }, children: [
    /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        onClick: h ? p : void 0,
        "aria-expanded": h ? t : void 0,
        title: l ? `${ot[e.id]} · ${l.skill}
${l.what}` : void 0,
        style: {
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: s ? "8px 10px 9px 6px" : "8px 16px 9px 10px",
          background: "transparent",
          color: "var(--text)",
          cursor: h ? "pointer" : "default",
          opacity: f ? 0.55 : 1
        },
        children: [
          /* @__PURE__ */ c("span", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
            /* @__PURE__ */ o(vt, { size: 12, "aria-hidden": !0, style: {
              flexShrink: 0,
              alignSelf: "center",
              color: "var(--muted)",
              transform: t ? "rotate(90deg)" : void 0,
              transition: "transform .12s",
              visibility: h ? "visible" : "hidden"
            } }),
            /* @__PURE__ */ o(
              "span",
              {
                style: { width: s ? 48 : 56, flexShrink: 0, fontSize: b.small, fontWeight: 700, color: f ? "var(--muted)" : "var(--text-strong, var(--text))" },
                title: s ? Jt[e.id] : void 0,
                children: ot[e.id]
              }
            ),
            !s && /* @__PURE__ */ o("span", { style: { width: 92, flexShrink: 0, fontSize: 10, color: "var(--muted)" }, children: Jt[e.id] }),
            /* @__PURE__ */ c("span", { style: { flex: 1, textAlign: "right", fontSize: b.small, minWidth: 0 }, children: [
              !t && n > 0 && /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: ".03em",
                textTransform: "uppercase",
                padding: "1px 6px",
                borderRadius: 99,
                border: `1px solid ${O.you.color}`,
                color: O.you.color,
                whiteSpace: "nowrap",
                marginRight: 6
              }, children: n === 1 ? "1 question" : `${n} questions` }),
              !t && !n && e.rows.some((a) => a.attention) && /* @__PURE__ */ o(
                "span",
                {
                  className: "kipo-pulse",
                  title: "A session in here needs you: a trust prompt, an ask, or HITL",
                  style: { display: "inline-block", width: 7, height: 7, borderRadius: 999, background: O.you.color, marginRight: 6 }
                }
              ),
              e.count
            ] })
          ] }),
          u > 0 && /* @__PURE__ */ o("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((a) => a.n > 0).map((a, x) => /* @__PURE__ */ o("span", { style: { flex: a.n, background: a.color, ...a.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, x)) }),
          e.ghost && /* @__PURE__ */ o("span", { style: { display: "block", fontSize: b.tiny, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }, children: e.ghost })
        ]
      }
    ),
    t && h && /* @__PURE__ */ c("div", { style: { margin: s ? "0 10px 10px 8px" : "0 16px 10px 14px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }, children: [
      e.action && /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: e.rows.length ? "1px solid var(--border)" : void 0 }, children: [
        /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flex: 1 }, children: e.action.confirm ? "" : `${ot[e.id]}'s next step` }),
        /* @__PURE__ */ o(Bt, { primary: !0, disabled: i, onClick: e.action.onClick, children: e.action.label }),
        e.action.confirm && /* @__PURE__ */ o(Bt, { disabled: i, onClick: e.action.confirm, children: "Cancel" })
      ] }),
      e.rows.map((a) => {
        var j;
        const x = () => {
          a.onOpen ? a.onOpen() : a.tile ? d(a.tile) : a.url && window.open(a.url, "_blank", "noreferrer");
        }, B = !!a.onOpen || !!a.tile || !!a.url, A = !!r && !!((j = a.selKeys) != null && j.includes(r));
        return /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: B ? x : void 0,
            disabled: !B,
            title: a.tile ? `#${a.number} ${a.title}
${Ye[a.tile.state]}
Click to open its session` : a.onOpen ? `${a.title}
Click to open this conversation` : a.title,
            style: {
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 10px",
              borderTop: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: b.small,
              background: A ? "var(--bg-elevated)" : "transparent",
              boxShadow: A ? "inset 2px 0 0 var(--accent)" : void 0,
              cursor: B ? "pointer" : "default"
            },
            onMouseEnter: (D) => {
              B && !A && (D.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (D) => {
              D.currentTarget.style.background = A ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ c("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: a.number != null ? `#${a.number}` : a.onOpen ? /* @__PURE__ */ o(rn, { size: 11, "aria-hidden": !0 }) : "☁" }),
                /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: a.title }),
                a.pulse && /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: a.attention ? O.you.color : O.building.color,
                  flexShrink: 0
                } }),
                /* @__PURE__ */ o(
                  "span",
                  {
                    className: a.attention ? "kipo-pulse" : void 0,
                    style: {
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".03em",
                      textTransform: "uppercase",
                      padding: "1px 6px",
                      borderRadius: 99,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      color: a.chip.solid ? "#14121c" : a.chip.color,
                      background: a.chip.solid ? a.chip.color : "transparent",
                      border: a.chip.solid ? "1px solid transparent" : `1px solid ${a.chip.color}`
                    },
                    children: a.chip.label
                  }
                )
              ] }),
              a.live && /* @__PURE__ */ c(
                "span",
                {
                  title: a.live.line ?? void 0,
                  style: {
                    display: "block",
                    marginTop: 3,
                    paddingLeft: 50,
                    fontSize: b.tiny,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  },
                  children: [
                    /* @__PURE__ */ o("span", { style: { color: O.building.color }, children: ho(a.live.at) }),
                    a.live.line ? /* @__PURE__ */ c(ve, { children: [
                      " · ",
                      a.live.line
                    ] }) : null
                  ]
                }
              )
            ]
          },
          a.key
        );
      })
    ] })
  ] });
}
const po = (e) => e.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
function ho(e) {
  const t = e ? Date.parse(e) : NaN;
  if (Number.isNaN(t)) return "running";
  const i = Math.round((Date.now() - t) / 6e4);
  return i < 1 ? "just now" : i < 60 ? `${i}m` : `${Math.round(i / 60)}h`;
}
const mn = "kipo.rail.repoOpen", fo = () => {
  try {
    return JSON.parse(localStorage.getItem(mn) || "{}");
  } catch {
    return {};
  }
};
function Ut() {
  return /* @__PURE__ */ o(
    "span",
    {
      className: "kipo-pulse",
      title: `${dt.HITL}: a session in here is stopped on a trust prompt or question`,
      style: { width: 7, height: 7, borderRadius: 999, background: "#f5b14c", flexShrink: 0 }
    }
  );
}
function go({ stage: e }) {
  return /* @__PURE__ */ o("span", { style: {
    flexShrink: 0,
    fontSize: 10,
    lineHeight: "15px",
    padding: "0 6px",
    borderRadius: 999,
    border: "1px solid var(--accent)",
    color: "var(--accent)",
    whiteSpace: "nowrap"
  }, children: qn[e] });
}
function mo({ width: e, items: t, repos: i, error: r, notice: s, selected: p, attention: d, spineSlot: f, onNew: h, onAddRepo: l, onRemoveRepo: u, onRestore: n, onSelect: a, onHide: x, onRemove: B, onCollapse: A }) {
  const [j, D] = E(""), [q, M] = E(null), [Z, ne] = E(!0);
  Y(() => {
    ne(!0);
  }, [p]);
  const [S, w] = E(null), I = ze(() => w(null), []), [K, ie] = E(null), [ce, fe] = E(fo);
  Y(() => {
    localStorage.setItem(mn, JSON.stringify(ce));
  }, [ce]);
  const J = (y) => ce[y] !== !1, he = j.trim().toLowerCase(), te = yt(() => {
    const y = /* @__PURE__ */ new Map();
    for (const L of t ?? []) {
      const P = y.get(L.repo) ?? [];
      P.push(L), y.set(L.repo, P);
    }
    const W = (i ?? []).map((L) => L.slug);
    for (const L of y.keys()) W.includes(L) || W.push(L);
    return W.map((L) => {
      const P = (i ?? []).find(($) => $.slug === L) ?? { slug: L, path: "", hidden: [] }, se = y.get(L) ?? [], _ = !he || L.toLowerCase().includes(he), R = _ ? se : se.filter(($) => $.title.toLowerCase().includes(he));
      return { meta: P, rows: R, show: !he || _ || R.length > 0 };
    }).filter((L) => L.show);
  }, [t, i, he]);
  return /* @__PURE__ */ c(
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
        /* @__PURE__ */ c("div", { style: { padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 8 }, children: [
          /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }, children: [
            /* @__PURE__ */ o(Ce, { primary: !0, onClick: h, children: /* @__PURE__ */ c("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Wn, { size: 14 }),
              "New effort"
            ] }) }),
            /* @__PURE__ */ o("span", { title: "Add a repo: it joins this sidebar with all its maps and efforts under it", children: /* @__PURE__ */ o(Ce, { onClick: l, children: /* @__PURE__ */ c("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Hn, { size: 14 }),
              "Add repo"
            ] }) }) })
          ] }),
          /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ o(
              "input",
              {
                value: j,
                onChange: (y) => D(y.target.value),
                placeholder: "Filter efforts",
                "aria-label": "Filter efforts",
                style: { ...lt, fontSize: b.small, padding: "4px 8px", flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                onClick: A,
                title: "Fold the effort list away",
                "aria-label": "Fold the effort list away",
                style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: 14, flexShrink: 0 },
                children: "«"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 6px 8px" }, children: [
          r && /* @__PURE__ */ o("div", { style: { color: "var(--danger-text)", fontSize: b.small, padding: "4px 6px" }, children: r }),
          !r && s && /* @__PURE__ */ o("div", { style: { color: "#f5b14c", fontSize: b.tiny, padding: "4px 6px", lineHeight: 1.4 }, children: s }),
          t === null && !r && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "4px 6px" }, children: "Loading…" }),
          t !== null && !te.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "4px 6px" }, children: he ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          te.map((y) => {
            const W = J(y.meta.slug) || !!he, L = y.meta.slug.split("/").pop() ?? y.meta.slug;
            return /* @__PURE__ */ c("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ c(
                "div",
                {
                  onContextMenu: (P) => {
                    P.preventDefault(), ie({ slug: y.meta.slug, x: P.clientX, y: P.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => M(`repo:${y.meta.slug}`),
                  onPointerLeave: () => M((P) => P === `repo:${y.meta.slug}` ? null : P),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 6,
                    padding: "3px 4px",
                    background: q === `repo:${y.meta.slug}` ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ c(
                      "button",
                      {
                        type: "button",
                        onClick: () => fe((P) => ({ ...P, [y.meta.slug]: !W })),
                        "aria-expanded": W,
                        title: y.meta.path || y.meta.slug,
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
                          /* @__PURE__ */ o(vt, { size: 11, "aria-hidden": !0, style: {
                            flexShrink: 0,
                            color: "var(--muted)",
                            transition: "transform .12s",
                            transform: W ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ o(on, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ o("span", { style: { fontSize: b.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: L }),
                          !W && (d ?? 0) > 0 && (p == null ? void 0 : p.startsWith(`${y.meta.slug}#`)) && /* @__PURE__ */ o(Ut, {}),
                          /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0 }, children: y.rows.length || (W ? "" : "0") })
                        ]
                      }
                    ),
                    (q === `repo:${y.meta.slug}` || (K == null ? void 0 : K.slug) === y.meta.slug) && /* @__PURE__ */ o(
                      "button",
                      {
                        type: "button",
                        "aria-label": `More for ${y.meta.slug}`,
                        "aria-haspopup": "menu",
                        title: "More",
                        onClick: (P) => {
                          P.stopPropagation();
                          const se = P.currentTarget.getBoundingClientRect();
                          ie({ slug: y.meta.slug, x: se.left, y: se.bottom + 2, confirm: !1 });
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
                        children: /* @__PURE__ */ o(Pt, { size: 13 })
                      }
                    )
                  ]
                }
              ),
              W && !y.rows.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              W && y.rows.length > 0 && /* @__PURE__ */ o("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: y.rows.map((P) => {
                const se = `${P.repo}#${P.number}`, _ = se === p, R = _ && !!f && Z;
                return /* @__PURE__ */ c(
                  "div",
                  {
                    style: {
                      position: "relative",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "var(--bg)",
                      // The open map glows; the rest sit as quiet cards.
                      border: `1px solid ${_ ? "var(--accent)" : "var(--border)"}`,
                      boxShadow: _ ? "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)" : void 0
                    },
                    onContextMenu: ($) => {
                      $.preventDefault(), w({ key: se, item: P, x: $.clientX, y: $.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => M(se),
                    onPointerLeave: () => M(($) => $ === se ? null : $),
                    children: [
                      /* @__PURE__ */ c(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            _ ? ne(($) => !$) : a(P);
                          },
                          "aria-current": _ ? "page" : void 0,
                          "aria-expanded": _ && f ? Z : void 0,
                          title: _ ? Z ? "Fold this effort's stations away" : "Show this effort's stations" : void 0,
                          style: {
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 8px",
                            cursor: "pointer",
                            background: _ ? "var(--bg-elevated)" : "transparent",
                            color: "var(--text)"
                          },
                          children: [
                            /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                              /* @__PURE__ */ o(vt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: R ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ c("span", { style: { ..._ ? $e : {}, flex: 1, minWidth: 0, fontSize: b.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ c("span", { style: { ...G, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  P.number
                                ] }),
                                " ",
                                P.title
                              ] }),
                              _ && !R && (d ?? 0) > 0 && /* @__PURE__ */ o(Ut, {})
                            ] }),
                            (() => {
                              var oe;
                              if (R)
                                return /* @__PURE__ */ c("div", { style: { ...G, fontSize: b.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(xt, { kind: P.kind, map: P.mapIssue }),
                                  /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: P.repo.split("/").pop() }),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: jt(P.updatedAt) })
                                ] });
                              const $ = (oe = P.frontier) != null && oe.stations ? io(P.frontier.stations) : null;
                              return /* @__PURE__ */ c(ve, { children: [
                                $ && /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(ro, { glance: $ }) }),
                                /* @__PURE__ */ c("div", { style: { ...G, fontSize: b.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(xt, { kind: P.kind, map: P.mapIssue }),
                                  !$ && /* @__PURE__ */ o(go, { stage: P.stage ?? Kn(P.column) }),
                                  /* @__PURE__ */ o(
                                    "span",
                                    {
                                      title: $ ? `${$.bits || $.front}

${dt.HITL}
${dt.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: $ ? $.bits || $.front : P.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: jt(P.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (q === se || _ || (S == null ? void 0 : S.key) === se) && /* @__PURE__ */ o(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${P.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: ($) => {
                            $.stopPropagation();
                            const oe = $.currentTarget.getBoundingClientRect();
                            w({ key: se, item: P, x: oe.left, y: oe.bottom + 2, confirm: !1 });
                          },
                          onMouseEnter: ($) => {
                            $.currentTarget.style.background = "rgba(255,255,255,0.1)";
                          },
                          onMouseLeave: ($) => {
                            $.currentTarget.style.background = "transparent";
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
                          children: /* @__PURE__ */ o(Pt, { size: 14 })
                        }
                      ),
                      R && /* @__PURE__ */ o("div", { ref: f, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  se
                );
              }) }),
              W && y.meta.hidden.length > 0 && /* @__PURE__ */ c(
                "button",
                {
                  type: "button",
                  onClick: () => n(y.meta.slug, y.meta.hidden),
                  title: `Removed from the sidebar: #${y.meta.hidden.join(", #")}. Click to restore them.`,
                  style: {
                    ...G,
                    fontSize: b.tiny,
                    background: "transparent",
                    cursor: "pointer",
                    padding: "3px 6px 2px 24px",
                    textAlign: "left"
                  },
                  children: [
                    y.meta.hidden.length,
                    " removed · restore"
                  ]
                }
              )
            ] }, y.meta.slug);
          })
        ] }),
        S && !S.confirm && /* @__PURE__ */ o(Kt, { x: S.x, y: S.y, onClose: I, items: [
          { label: "Open on GitHub", icon: Dt, onSelect: () => window.open(S.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: Mn, danger: !0, onSelect: () => w({ ...S, confirm: "hide" }) },
          ...S.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: Lt, danger: !0, onSelect: () => w({ ...S, confirm: "remove" }) }
          ]
        ] }),
        (S == null ? void 0 : S.confirm) === "hide" && /* @__PURE__ */ o(
          ft,
          {
            x: S.x,
            y: S.y,
            onClose: I,
            action: "Remove",
            title: `Remove "${S.item.title}" from the sidebar?`,
            onConfirm: () => x(S.item),
            children: S.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (S == null ? void 0 : S.confirm) === "remove" && /* @__PURE__ */ o(
          ft,
          {
            x: S.x,
            y: S.y,
            onClose: I,
            action: "Close it",
            title: `Close "${S.item.title}" as not planned?`,
            onConfirm: () => B(S.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        K && !K.confirm && /* @__PURE__ */ o(Kt, { x: K.x, y: K.y, onClose: () => ie(null), items: [
          { label: "Open on GitHub", icon: Dt, onSelect: () => window.open(`https://github.com/${K.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: Lt, danger: !0, onSelect: () => ie({ ...K, confirm: !0 }) }
        ] }),
        (K == null ? void 0 : K.confirm) && /* @__PURE__ */ o(
          ft,
          {
            x: K.x,
            y: K.y,
            onClose: () => ie(null),
            action: "Remove",
            title: `Remove ${K.slug} from KiPo?`,
            onConfirm: () => u(K.slug),
            children: "Its efforts and maps leave the sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back."
          }
        )
      ]
    }
  );
}
function yo({ items: e, selected: t, attention: i, onNew: r, onSelect: s, onExpand: p }) {
  const d = (h) => {
    var u;
    const l = (u = h.frontier) == null ? void 0 : u.counts;
    return l ? l.you ? "#f5b14c" : l.afk ? "#2dd4bf" : l.building || l.review ? "#60a5fa" : l.done ? "#3fae6a" : "var(--muted)" : "var(--muted)";
  }, f = { width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return /* @__PURE__ */ c("nav", { "aria-label": "Efforts", style: { width: 44, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", borderRight: "1px solid var(--border)", background: "var(--bg)", minHeight: 0 }, children: [
    /* @__PURE__ */ o(
      "button",
      {
        type: "button",
        onClick: p,
        title: "Show the effort list",
        "aria-label": "Show the effort list",
        style: { ...f, background: "transparent", color: "var(--muted)", fontSize: 14 },
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
        style: { ...f, background: "var(--accent)", color: "var(--accent-fg, #fff)", fontWeight: 700, fontSize: 16, borderRadius: 999 },
        children: "+"
      }
    ),
    /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 6, scrollbarWidth: "none" }, children: (e ?? []).map((h) => {
      const l = `${h.repo}#${h.number}`, u = l === t;
      return /* @__PURE__ */ o(
        "button",
        {
          type: "button",
          onClick: () => s(h),
          title: `${h.title} (${h.repo.split("/").pop()})`,
          "aria-current": u ? "page" : void 0,
          style: { ...f, background: u ? "var(--bg-elevated)" : "transparent", border: u ? "1px solid var(--border)" : "1px solid transparent", flexShrink: 0 },
          children: /* @__PURE__ */ o(
            "span",
            {
              className: u && (i ?? 0) > 0 ? "kipo-pulse" : void 0,
              style: { width: 10, height: 10, borderRadius: 3, background: u && (i ?? 0) > 0 ? "#f5b14c" : d(h) }
            }
          )
        },
        l
      );
    }) })
  ] });
}
const Qt = [
  { id: "idea", title: "An idea", hint: "Grill it, spec and ticket it, build it.", begins: "a grilling: an interview that sharpens the idea. Then the spec and tickets, then the build." },
  { id: "small", title: "A small change", hint: "Grill briefly, then build in the same session.", begins: "a short grilling, then the build in the same conversation. No spec or tickets." },
  { id: "huge", title: "A huge effort", hint: "Too many unknowns: map the decisions first.", begins: "a wayfinder map. Its decision tickets fill the Decide lane." },
  { id: "issue", title: "An incoming issue", hint: "Triage it until an agent can pick it up.", begins: "triaging the issue. Once an agent can take it, it moves to the Deliver lane." },
  { id: "bug", title: "A hard bug", hint: "Diagnose it with a tight loop, then fix it.", begins: "a diagnosis: a command that goes red on the bug, then the fix." }
], st = (e) => /* @__PURE__ */ o("span", { style: { ...$e, fontSize: b.body, display: "block", marginBottom: 6 }, children: e }), bo = (e) => {
  const t = e.trim().match(/(?:issues\/|#)?(\d+)\s*$/);
  return t ? Number(t[1]) : null;
};
function vo({ onStarted: e, onCancel: t }) {
  const [i, r] = E(""), [s, p] = E(null), [d, f] = E(""), [h, l] = E(!1), [u, n] = E(!1), [a, x] = E("idea"), [B, A] = E(""), [j, D] = E(!1), [q, M] = E("");
  Y(() => {
    pe.discoverRepos().then((w) => p(
      w.repos.filter((I) => I.slug && !I.worktree).sort((I, K) => Number(K.configured) - Number(I.configured) || I.name.localeCompare(K.name))
    )).catch((w) => {
      M(Se(w)), p([]);
    });
  }, []);
  const Z = (w) => {
    l(!1), f(w), s && !s.some((I) => I.path === w) && p([...s, { path: w, name: w.split("/").pop() || w, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, ne = async () => {
    const w = a === "issue" && B.trim() ? bo(B) : null;
    if (a === "issue" && B.trim() && w == null) {
      M("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !w) {
      M("Say what you want to do first.");
      return;
    }
    if (!d) {
      M("Choose which project this is for.");
      return;
    }
    D(!0), M("");
    try {
      e(await pe.startInitiative({
        path: d,
        description: i.trim() || `Issue #${w}`,
        start: a,
        worktree: u,
        sourceIssue: w
      }));
    } catch (I) {
      M(Se(I)), D(!1);
    }
  }, S = Qt.find((w) => w.id === a);
  return /* @__PURE__ */ c("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ c("div", { children: [
      /* @__PURE__ */ o("div", { style: { ...$e, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ o(qe, { children: q }),
    /* @__PURE__ */ c("label", { children: [
      st("What do you want to do?"),
      /* @__PURE__ */ o(
        "textarea",
        {
          value: i,
          onChange: (w) => r(w.target.value),
          rows: 3,
          autoFocus: !0,
          placeholder: "e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share",
          style: { ...lt, resize: "vertical", lineHeight: 1.45 }
        }
      )
    ] }),
    /* @__PURE__ */ c("div", { children: [
      st("Which project is this for?"),
      /* @__PURE__ */ c(
        "select",
        {
          value: d,
          onChange: (w) => w.target.value === "__pick" ? l(!0) : f(w.target.value),
          style: lt,
          disabled: s === null,
          children: [
            /* @__PURE__ */ o("option", { value: "", children: s === null ? "Looking for your projects…" : "Choose a project…" }),
            s == null ? void 0 : s.map((w) => /* @__PURE__ */ o("option", { value: w.path, children: w.slug ?? w.name }, w.path)),
            /* @__PURE__ */ o("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      d && /* @__PURE__ */ c("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(sn, { path: d }) }),
        /* @__PURE__ */ c("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: b.body }, children: [
          /* @__PURE__ */ o("input", { type: "checkbox", checked: u, onChange: (w) => n(w.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ c("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ o("span", { style: G, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      h && /* @__PURE__ */ o("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ o(ln, { busy: null, onAdd: Z, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ c("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ o("legend", { style: { padding: 0 }, children: st("Where does this start?") }),
      /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: Qt.map((w) => {
        const I = a === w.id;
        return /* @__PURE__ */ c(
          "label",
          {
            style: {
              display: "block",
              padding: "8px 10px 9px",
              cursor: "pointer",
              borderRadius: 8,
              border: `1px solid ${I ? "var(--accent)" : "var(--border)"}`,
              background: I ? "var(--accent-subtle, var(--bg-elevated))" : "var(--card, var(--bg))",
              color: "var(--text)"
            },
            children: [
              /* @__PURE__ */ o(
                "input",
                {
                  type: "radio",
                  name: "start",
                  checked: I,
                  onChange: () => x(w.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ o("div", { style: { ...$e, fontSize: b.body }, children: w.title }),
              /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, marginTop: 3, lineHeight: 1.4 }, children: w.hint })
            ]
          },
          w.id
        );
      }) }),
      /* @__PURE__ */ c("div", { style: { ...G, fontSize: b.small, marginTop: 8 }, children: [
        "Starts with ",
        S.begins
      ] })
    ] }),
    a === "issue" && /* @__PURE__ */ c("label", { children: [
      st("Which issue? (optional)"),
      /* @__PURE__ */ o(
        "input",
        {
          value: B,
          onChange: (w) => A(w.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: lt
        }
      )
    ] }),
    /* @__PURE__ */ c("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ o(Ce, { primary: !0, disabled: j, onClick: ne, children: j ? "Starting…" : "Start the conversation" }),
      t && /* @__PURE__ */ o(Ce, { onClick: t, children: "Never mind" })
    ] }),
    /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, lineHeight: 1.5 }, children: "Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo." })
  ] });
}
const Xt = 6, je = (e, t) => (e.blockers ?? e.blockedBy).filter((i) => t.has(i) && i !== e.number);
function wo(e, t) {
  const i = new Map(e.map((a) => [a.number, a])), r = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), p = (a) => {
    if (r.has(a.number)) return r.get(a.number);
    if (s.has(a.number)) return 0;
    s.add(a.number);
    const x = je(a, i), B = x.length ? 1 + Math.max(...x.map((A) => p(i.get(A)))) : 0;
    return s.delete(a.number), r.set(a.number, B), B;
  };
  e.forEach(p);
  const d = e.length ? Math.max(...e.map((a) => r.get(a.number))) + 1 : 0, f = t ? [e.filter((a) => a.lane === "decide"), e.filter((a) => a.lane !== "decide")] : [e], h = /* @__PURE__ */ new Map(), l = [];
  let u = 0, n = null;
  return f.forEach((a, x) => {
    if (!a.length) return;
    t && x === 1 && u > 0 && (n = u, u += 0.6);
    let B = 0;
    const A = [];
    for (let j = 0; j < d; j++) {
      const D = a.filter((M) => r.get(M.number) === j), q = (M) => {
        const Z = je(M, i).map((ne) => h.get(ne)).filter((ne) => ne !== void 0);
        return Z.length ? Z.reduce((ne, S) => ne + S, 0) / Z.length : M.number / 1e3;
      };
      D.sort((M, Z) => q(M) - q(Z) || M.number - Z.number), D.forEach((M, Z) => h.set(M.number, u + Z)), A.push(D), B = Math.max(B, D.length);
    }
    A.forEach((j, D) => {
      const q = (B - j.length) / 2;
      j.forEach((M, Z) => {
        const ne = u + Z + q;
        h.set(M.number, ne), l.push({ tile: M, col: D, row: ne });
      });
    }), u += B;
  }), { placed: l, cols: d, rows: u, split: n };
}
function ko({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: s, labeled: p, bands: d, highlight: f, dimOthers: h = !0, down: l }) {
  const u = ye(null), [n, a] = E(0), [x, B] = E(null);
  if (Y(() => {
    const v = u.current;
    if (!v) return;
    const ee = new ResizeObserver(() => a(v.clientWidth));
    return ee.observe(v), a(v.clientWidth), () => ee.disconnect();
  }, []), !e.length) return null;
  const A = new Map(e.map((v) => [v.number, v])), j = /* @__PURE__ */ new Set();
  for (const v of e) for (const ee of je(v, A))
    j.add(ee), j.add(v.number);
  const D = e.length > 1 ? e.filter((v) => !j.has(v.number)) : [], q = D.length ? e.filter((v) => j.has(v.number)) : e, { placed: M, cols: Z, rows: ne, split: S } = wo(q, !!d), w = 30, I = !!l && !d, K = d ? 52 : 0, ie = I ? 12 : d ? 64 : p ? 40 : 48, ce = i > 0 && !I ? Math.min(i, 4) : 0, fe = ce ? ie + w : 0, J = I ? Math.max(1, ne) : Z, he = n && J ? Math.floor((n - 2 - 2 * Xt - K - fe - (J - 1) * ie) / J) : 168, te = p ? Math.max(I ? 120 : 110, Math.min(d ? 240 : I ? 260 : 200, he)) : w, y = w + 6, W = I ? 30 : p ? 10 : 8, L = q.length ? Z : 0, P = I ? (q.length ? J * (te + ie) - ie : 0) + 2 : K + (L ? L * (te + ie) - ie : 0) + fe + 2, se = S ?? ne, _ = I ? L : Math.max(ne, ce), R = (v) => 1 + v * (y + W), $ = q.length || ce ? R(_) - W + 1 : 0, oe = new Map(M.map((v) => [v.tile.number, I ? { x: 1 + v.row * (te + ie), y: R(v.col) } : { x: K + 1 + v.col * (te + ie), y: R(v.row) }])), Ae = /* @__PURE__ */ new Set();
  if (t != null) {
    Ae.add(t);
    const v = A.get(t);
    v && je(v, A).forEach((ee) => Ae.add(ee)), e.forEach((ee) => {
      je(ee, A).includes(t) && Ae.add(ee.number);
    });
  }
  const ge = x != null && A.has(x) ? new Set($t(e, x).map((v) => v.number)) : null, de = (v) => ge ? ge.has(v) : (f ? f.has(v) : !0) && (t == null || !h || Ae.has(v)), Ne = (v) => v.state === "you" || v.state === "afk", We = (v) => Ne(v) && v.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${O[v.state].color}` : void 0, we = [];
  for (const v of q) for (const ee of je(v, A)) we.push({ from: A.get(ee), to: v });
  const Pe = S != null ? R(S) + 0.3 * (y + W) - W / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ c("div", { ref: u, style: { overflowX: "auto", padding: Xt, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ c("div", { style: { position: "relative", width: P, height: $, minWidth: P }, children: [
        /* @__PURE__ */ c("svg", { width: P, height: $, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ o("defs", { children: /* @__PURE__ */ o("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ o("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          Pe != null && /* @__PURE__ */ o("line", { x1: 0, x2: P, y1: Pe, y2: Pe, stroke: "var(--border)", strokeDasharray: "2 4" }),
          we.map(({ from: v, to: ee }) => {
            const be = oe.get(v.number), Ie = oe.get(ee.number);
            if (!be || !Ie) return null;
            const Ge = v.state === "done", Oe = ge ? ge.has(v.number) && ge.has(ee.number) : t != null && (v.number === t || ee.number === t), He = ge ? !Oe : t != null && h && !Oe || !de(v.number) || !de(ee.number), Me = I ? (() => {
              const De = be.x + w / 2, Te = be.y + y + 2, ue = Ie.x + w / 2, Ee = Ie.y - 2, ke = (Te + Ee) / 2;
              return `M${De},${Te} C${De},${ke} ${ue},${ke} ${ue},${Ee}`;
            })() : (() => {
              const De = be.x + te + 2, Te = be.y + y / 2, ue = Ie.x - 2, Ee = Ie.y + y / 2, ke = (De + ue) / 2;
              return `M${De},${Te} C${ke},${Te} ${ke},${Ee} ${ue},${Ee}`;
            })();
            return /* @__PURE__ */ o(
              "path",
              {
                d: Me,
                fill: "none",
                stroke: Oe ? "var(--text)" : "var(--muted)",
                strokeWidth: Oe ? 1.6 : 1.2,
                strokeDasharray: Ge ? "3 3" : void 0,
                opacity: He ? 0.15 : Ge ? 0.45 : 0.8,
                markerEnd: "url(#kipo-arrow)"
              },
              `${v.number}-${ee.number}`
            );
          })
        ] }),
        d && M.length > 0 && ["decide", "deliver"].map((v) => {
          const ee = M.filter((Ie) => v === "decide" ? Ie.tile.lane === "decide" : Ie.tile.lane !== "decide").map((Ie) => Ie.row);
          if (!ee.length) return null;
          const be = (Math.min(...ee) + Math.max(...ee)) / 2;
          return /* @__PURE__ */ o("span", { style: { position: "absolute", left: 0, top: R(be) + y / 2 - 8, fontSize: b.tiny, fontWeight: 600, color: "var(--muted)" }, children: v === "decide" ? "Decide" : "Deliver" }, v);
        }),
        M.map(({ tile: v }) => {
          const ee = oe.get(v.number);
          return /* @__PURE__ */ c(
            "div",
            {
              onPointerEnter: () => B(v.number),
              onPointerLeave: () => B((be) => be === v.number ? null : be),
              style: {
                position: "absolute",
                left: ee.x,
                top: ee.y,
                width: te,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: de(v.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    title: We(v) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: We(v), display: "inline-flex" },
                    children: /* @__PURE__ */ o(_t, { tile: v, size: w, onClick: () => r(v), open: v.number === t, status: s == null ? void 0 : s[v.number] })
                  }
                ),
                p && /* @__PURE__ */ o(
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
                      fontSize: b.tiny,
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
        Array.from({ length: ce }).map((v, ee) => /* @__PURE__ */ o(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: K + 1 + L * (te + ie),
              top: R(Math.max(0, (se - ce) / 2) + ee),
              width: w,
              height: y,
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
          `fog-${ee}`
        ))
      ] }),
      D.length > 0 && /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: K }, children: [
        /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        D.map((v) => /* @__PURE__ */ o("span", { style: { opacity: de(v.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: We(v) }, children: /* @__PURE__ */ o(_t, { tile: v, size: w, onClick: () => r(v), open: v.number === t, status: s == null ? void 0 : s[v.number] }) }, v.number))
      ] }),
      /* @__PURE__ */ c("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: b.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: K }, children: [
        /* @__PURE__ */ c("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2" }) }),
          " still blocks"
        ] }),
        /* @__PURE__ */ c("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2", strokeDasharray: "3 3", opacity: ".6" }) }),
          " blocker closed"
        ] }),
        /* @__PURE__ */ c("span", { children: [
          /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, boxShadow: `0 0 0 1.5px ${O.you.color}`, marginRight: 5 } }),
          "frontier: open and unblocked"
        ] }),
        i > 0 && /* @__PURE__ */ o("span", { children: "? not yet specified" })
      ] })
    ] })
  );
}
function $t(e, t) {
  const i = new Map(e.map((f) => [f.number, f]));
  if (!i.has(t)) return [];
  const r = /* @__PURE__ */ new Set([t]), s = [t];
  for (; s.length; ) {
    const f = i.get(s.pop());
    for (const h of f ? je(f, i) : []) r.has(h) || (r.add(h), s.push(h));
  }
  const p = /* @__PURE__ */ new Set([t]), d = [t];
  for (; d.length; ) {
    const f = d.pop();
    for (const h of e)
      !p.has(h.number) && je(h, i).includes(f) && (p.add(h.number), r.add(h.number), d.push(h.number));
  }
  return e.filter((f) => r.has(f.number));
}
function xo(e) {
  if (!e) return "";
  const t = Math.max(0, (Date.now() - new Date(e).getTime()) / 1e3);
  return t < 60 ? "just now" : t < 3600 ? `${Math.floor(t / 60)}m ago` : t < 86400 ? `${Math.floor(t / 3600)}h ago` : `${Math.floor(t / 86400)}d ago`;
}
function So({ slot: e, active: t, ended: i }) {
  const [r, s] = E(null), [p, d] = E(""), f = ye(null), h = ye(!0);
  return Y(() => {
    let l = !0;
    const u = () => pe.sessionTail(e, 60).then((a) => {
      l && (s(a.events), d(""));
    }).catch((a) => {
      l && d(Se(a));
    });
    if (u(), !t || i) return () => {
      l = !1;
    };
    const n = setInterval(u, 4e3);
    return () => {
      l = !1, clearInterval(n);
    };
  }, [e, t, i]), Y(() => {
    var l;
    h.current && ((l = f.current) == null || l.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: O.building.color, flexShrink: 0 } }),
      /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, lineHeight: 1.4 }, children: i ? /* @__PURE__ */ c(ve, { children: [
        "This session has ended — a read-only record of what it did, from its transcript. Its slot ",
        /* @__PURE__ */ o("code", { style: { fontSize: b.tiny }, children: e }),
        " is closed in Kiro."
      ] }) : /* @__PURE__ */ c(ve, { children: [
        "Running in the background — read-only progress from its transcript. To chat with it, open ",
        /* @__PURE__ */ o("code", { style: { fontSize: b.tiny }, children: e }),
        " in Kiro's session window."
      ] }) })
    ] }),
    /* @__PURE__ */ c(
      "div",
      {
        onScroll: (l) => {
          const u = l.currentTarget;
          h.current = u.scrollHeight - u.scrollTop - u.clientHeight < 40;
        },
        style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", scrollbarWidth: "thin" },
        children: [
          /* @__PURE__ */ o(qe, { children: p }),
          r === null && !p && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small }, children: "Reading its transcript…" }),
          r !== null && r.length === 0 && !p && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small }, children: "No steps recorded yet." }),
          /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: (r ?? []).map((l, u) => /* @__PURE__ */ c("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            /* @__PURE__ */ c("span", { style: { ...G, fontSize: b.tiny, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ o("span", { style: { fontWeight: 700, color: l.role === "user" ? O.you.text : "var(--muted)" }, children: l.role === "user" ? "You" : "Agent" }),
              l.ts && /* @__PURE__ */ o("span", { children: xo(l.ts) })
            ] }),
            l.tool ? /* @__PURE__ */ o("span", { style: { fontSize: b.small, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: l.text }) : /* @__PURE__ */ o("div", { style: { fontSize: b.body, lineHeight: 1.5 }, children: /* @__PURE__ */ o(bt, { content: l.text }) })
          ] }, u)) }),
          /* @__PURE__ */ o("div", { ref: f })
        ]
      }
    )
  ] });
}
const Vt = 2 * 60 * 60 * 1e3, ut = /* @__PURE__ */ new Map(), $o = (e, t) => {
  const i = ut.get(`${e}:${t}`);
  return i && Date.now() - i >= Vt && ut.delete(`${e}:${t}`), !!i && Date.now() - i < Vt;
};
function Io({ state: e, slotKey: t, settled: i, onError: r, onSize: s, bottomOffset: p = 122 }) {
  const d = Rt();
  for (const R of (e == null ? void 0 : e.decisions) ?? []) R.answer && t && ut.delete(`${t}:${R.id}`);
  const f = i || !t ? [] : ((e == null ? void 0 : e.decisions) ?? []).filter((R) => ct(R) && !$o(t, R.id)), [h, l] = E({}), [u, n] = E({}), [a, x] = E(0), [B, A] = E(!1), [j, D] = E(!1), q = ye(null), M = f.map((R) => R.id).join(","), Z = ye(M);
  Y(() => {
    Z.current !== M && (Z.current = M, x(0), l({}), n({}), M && D(!1));
  }, [M]);
  const ne = ye(null), S = ze((R) => {
    var oe;
    if ((oe = ne.current) == null || oe.disconnect(), ne.current = null, !R) {
      s == null || s(0);
      return;
    }
    const $ = () => s == null ? void 0 : s(R.offsetHeight);
    $(), ne.current = new ResizeObserver($), ne.current.observe(R);
  }, [s]);
  if (!f.length || !t) return null;
  if (j) return /* @__PURE__ */ c(
    "button",
    {
      type: "button",
      className: "kipo-pulse",
      onClick: () => D(!1),
      title: "Open the questions waiting on you",
      style: {
        position: "absolute",
        right: 16,
        bottom: p + 4,
        zIndex: 6,
        cursor: "pointer",
        borderRadius: 99,
        padding: "4px 12px",
        fontSize: b.small,
        fontWeight: 600,
        border: `1px solid ${O.you.color}`,
        color: O.you.text,
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
  const w = Math.min(a, f.length - 1), I = f[w], K = f.filter((R) => (h[R.id] ?? "").trim()), ie = w === 0, ce = w === f.length - 1, J = (h[I.id] ?? "") !== "" && !(I.options ?? []).includes(h[I.id] ?? "") || !!u[I.id], he = f.filter((R) => R.recommended), te = (R) => l(($) => ({ ...$, [I.id]: R })), y = () => {
    var R;
    B || (n(($) => ({ ...$, [I.id]: !0 })), l(($) => (I.options ?? []).includes($[I.id] ?? "") ? { ...$, [I.id]: "" } : $), (R = q.current) == null || R.focus());
  }, W = async (R = h) => {
    const $ = f.filter((de) => (R[de.id] ?? "").trim());
    if (!$.length) return;
    const oe = f.filter((de) => !(R[de.id] ?? "").trim()), Ae = $.map((de, Ne) => `${Ne + 1}. ${de.title} (${de.id}): ${R[de.id].trim()}`), ge = [
      `My answers to your ${$.length === 1 ? "question" : `${$.length} questions`}:`,
      "",
      ...Ae,
      "",
      oe.length ? `Still open, I'll answer later: ${oe.map((de) => de.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
    ].join(`
`);
    A(!0);
    try {
      await d.post("/api/chat?ws=1", { slot: t, message: ge });
      for (const de of $) ut.set(`${t}:${de.id}`, Date.now());
      l({}), x(0);
    } catch (de) {
      r(`Couldn't send your answers: ${Se(de)}`);
    } finally {
      A(!1);
    }
  }, L = () => {
    const R = { ...h };
    for (const $ of he) R[$.id] = $.recommended;
    l(R), W(R);
  }, P = (R) => /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${R ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: R && /* @__PURE__ */ o("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), se = (R) => {
    const $ = h[I.id] === R && !u[I.id];
    return /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": $,
        disabled: B,
        onClick: () => {
          n((oe) => ({ ...oe, [I.id]: !1 })), te(R);
        },
        onMouseEnter: (oe) => {
          $ || (oe.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (oe) => {
          $ || (oe.currentTarget.style.background = "transparent");
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
          fontSize: b.small,
          lineHeight: 1.4,
          border: `1px solid ${$ ? "var(--accent)" : "var(--border)"}`,
          background: $ ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
          color: "var(--text)"
        },
        children: [
          P($),
          /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0 }, children: R }),
          R === I.recommended && /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      R
    );
  }, _ = (R, $, oe) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      disabled: $,
      onClick: oe,
      style: {
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 10px",
        color: $ ? "var(--muted)" : "var(--text)",
        cursor: $ ? "default" : "pointer",
        fontSize: b.small,
        opacity: $ ? 0.5 : 1
      },
      children: R
    }
  );
  return /* @__PURE__ */ c(
    "div",
    {
      ref: S,
      role: "dialog",
      "aria-label": `Question ${w + 1} of ${f.length}`,
      style: {
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: p,
        zIndex: 6,
        width: "min(680px, calc(100% - 24px))",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.45)",
        padding: "10px 14px 11px"
      },
      children: [
        /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }, children: [
          /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: O.you.text }, children: f.length === 1 ? "Question" : `Question ${w + 1} of ${f.length}` }),
          f.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ o("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: f.map((R, $) => /* @__PURE__ */ o(
            "span",
            {
              title: R.title,
              onClick: () => x($),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (h[R.id] ?? "").trim() ? O.you.color : $ === w ? "var(--text)" : "var(--border)"
              }
            },
            R.id
          )) }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              onClick: () => D(!0),
              title: "Tuck the questions away and get the chat box back",
              style: {
                background: "transparent",
                border: "none",
                padding: "0 2px",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: b.tiny
              },
              children: "Hide"
            }
          )
        ] }),
        /* @__PURE__ */ o("div", { style: { ...$e, fontSize: b.body, marginBottom: 8, lineHeight: 1.4 }, children: I.title }),
        /* @__PURE__ */ c("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
          (I.options ?? []).map(se),
          /* @__PURE__ */ c(
            "div",
            {
              role: "radio",
              "aria-checked": J,
              onClick: y,
              style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px", cursor: "text" },
              children: [
                P(J),
                /* @__PURE__ */ o(
                  "input",
                  {
                    ref: q,
                    value: J ? h[I.id] ?? "" : "",
                    onChange: (R) => te(R.target.value),
                    onFocus: y,
                    disabled: B,
                    placeholder: "Something else…",
                    "aria-label": `Another answer to: ${I.title}`,
                    style: {
                      flex: 1,
                      minWidth: 0,
                      background: "var(--bg)",
                      color: "var(--text)",
                      fontSize: b.small,
                      border: `1px solid ${J ? "var(--accent)" : "var(--border)"}`,
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
        /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          f.length > 1 && _("‹ Back", ie, () => x(w - 1)),
          !ce && _("Next ›", !1, () => x(w + 1)),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          f.length > 1 && /* @__PURE__ */ c("span", { style: { ...G, fontSize: b.tiny }, children: [
            K.length,
            " of ",
            f.length,
            " answered"
          ] }),
          he.length > 0 && /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              disabled: B,
              onClick: L,
              title: f.length > 1 ? `Answer all ${he.length} with their recommendation and send` : "Take the recommendation and send",
              style: {
                background: "transparent",
                border: `1px solid ${O.you.color}`,
                borderRadius: 6,
                padding: "3px 10px",
                color: O.you.text,
                cursor: B ? "default" : "pointer",
                fontSize: b.small,
                whiteSpace: "nowrap",
                opacity: B ? 0.5 : 1
              },
              children: f.length > 1 ? "Accept all recommendations" : "Accept recommendation"
            }
          ),
          /* @__PURE__ */ o(Ce, { primary: !0, disabled: !K.length || B, onClick: () => void W(), children: B ? "Sending…" : K.length > 1 ? `Submit ${K.length} answers` : "Submit" })
        ] })
      ]
    }
  );
}
const Ro = {
  grilling: "Grill",
  prototype: "Prototype",
  research: "Research",
  task: "Task",
  build: "Build",
  issue: "Issue"
}, gt = {
  MERGED: { label: "merged", color: "var(--ok, #3fb950)" },
  OPEN: { label: "open", color: "var(--accent)" },
  CLOSED: { label: "closed", color: "var(--muted)" }
};
function Zt({ color: e, text: t, children: i }) {
  return /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, padding: "1px 8px", borderRadius: 999, border: `1px solid ${e}`, color: t, whiteSpace: "nowrap" }, children: i });
}
function Co({ detail: e, tile: t }) {
  const [i, r] = E(null), [s, p] = E("");
  Y(() => {
    let u = !0;
    return r(null), p(""), pe.ticket(e.repo, e.number, t.number).then((n) => {
      u && r(n);
    }).catch((n) => {
      u && p(Se(n));
    }), () => {
      u = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const d = e.prs.filter((u) => t.prs.includes(u.number)), f = t.state === "done", h = O[t.state];
  let l;
  return f ? l = d.some((u) => u.state === "MERGED") ? "Closed: its PR merged." : "Closed." : t.state === "review" ? l = "Its PR is open. The effort's Review merges it once it's clean." : t.state === "blocked" ? l = `Waiting on ${t.blockedBy.map((u) => `#${u}`).join(", ")}. It can start once those close.` : t.state === "building" ? l = "An agent is working on it." : t.who === "you" ? l = /* @__PURE__ */ c(ve, { children: [
    /* @__PURE__ */ o(eo, { term: "HITL", children: "HITL" }),
    ": it needs you. Start it to open its conversation."
  ] }) : l = "An agent can take it on its own.", /* @__PURE__ */ c("div", { children: [
    /* @__PURE__ */ c("div", { style: { padding: "14px 16px" }, children: [
      /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ c("span", { style: { ...G, fontSize: b.small }, children: [
          "#",
          t.number,
          " · ",
          Ro[t.type]
        ] }),
        /* @__PURE__ */ o("span", { title: Ye[t.state], style: { cursor: "help", display: "inline-flex" }, children: /* @__PURE__ */ o(Zt, { color: h.color === "transparent" ? "var(--border)" : h.color, text: h.text, children: h.label }) }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        /* @__PURE__ */ o("a", { href: t.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: b.small }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { ...$e, fontSize: b.title, marginTop: 4, lineHeight: 1.35 }, children: t.title }),
      /* @__PURE__ */ o("div", { style: { fontSize: b.small, marginTop: 5, lineHeight: 1.45 }, children: l })
    ] }),
    d.length > 0 && /* @__PURE__ */ o(ht, { title: d.length === 1 ? "Pull request" : "Pull requests", children: /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: d.map((u) => {
      var n, a, x;
      return /* @__PURE__ */ c(
        "a",
        {
          href: u.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: b.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ o(Zt, { color: ((n = gt[u.state]) == null ? void 0 : n.color) ?? "var(--border)", text: ((a = gt[u.state]) == null ? void 0 : a.color) ?? "var(--muted)", children: ((x = gt[u.state]) == null ? void 0 : x.label) ?? u.state }),
            /* @__PURE__ */ c("span", { style: { color: "var(--accent)" }, children: [
              "#",
              u.number
            ] }),
            /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: u.title })
          ]
        },
        u.number
      );
    }) }) }),
    f && /* @__PURE__ */ o(ht, { title: "How it ended", aside: i != null && i.lastComment ? `latest of ${i.comments} comment${i.comments === 1 ? "" : "s"}` : void 0, children: s ? /* @__PURE__ */ o(qe, { children: s }) : i ? i.lastComment ? /* @__PURE__ */ o("div", { style: { fontSize: b.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(bt, { content: i.lastComment.body }) }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "Closed with no comment." }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "Loading…" }) }),
    /* @__PURE__ */ o(ht, { title: f ? "What it asked" : "What it asks", defaultOpen: !f, children: s ? /* @__PURE__ */ o(qe, { children: s }) : i ? i.body.trim() ? /* @__PURE__ */ o("div", { style: { fontSize: b.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(bt, { content: i.body }) }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "No description." }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "Loading…" }) })
  ] });
}
const To = (e) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ""}@${e.at}`;
function zo(e, t, i, r, s = {}) {
  const p = [], d = [], f = new Set(s.unstarted ?? []), h = (n, a) => {
    const x = a ? r[a] : void 0;
    if (x)
      return n.replace === x || a && f.has(a) ? x : null;
  }, l = (n, a) => a ? { ...n, replace: a } : n, u = (n) => (s.prs ?? []).some((a) => a.state === "OPEN" && ((a.tickets ?? []).includes(n) || (a.refs ?? []).includes(n)));
  for (const n of e) {
    const a = To(n);
    if (!(t(a) || p.includes(a))) {
      if (p.push(a), n.ticket != null) {
        const x = i.find((A) => A.number === n.ticket);
        if (!x) continue;
        const B = n.skill === "kipo-review";
        if ((x.state === "done" || x.state === "blocked") && !(B && u(x.number))) continue;
        if (B) {
          const A = h(n, `review-t${x.number}`);
          A !== null && d.push(l({ id: a, kind: "review", t: x.number }, A));
        } else {
          const A = h(n, x.sessionKey);
          A !== null && d.push(l({ id: a, kind: "tile", tile: x, skill: n.skill && !n.skill.startsWith("kipo-") ? n.skill : null }, A));
        }
      } else if (n.stage) {
        const x = h(n, n.stage);
        x !== null && d.push(l({ id: a, kind: "stage", column: n.stage, skill: n.skill && n.skill !== `kipo-${n.stage}` ? n.skill : null }, x));
      }
    }
  }
  return { fresh: p, starts: d };
}
const Ao = (e) => `[KiPo] Carry on: ${e}. Re-read your ticket, its PR and comments, and your state file, then continue from where you stopped; report when you finish or block.`, Oo = (e, t) => `[KiPo] Woke ${e}: ${t}`;
function Eo(e) {
  var i;
  if (!e) return null;
  const t = (i = e.messages) == null ? void 0 : i[e.messages.length - 1];
  return {
    at: (t == null ? void 0 : t.ts) || null,
    running: typeof e.running == "boolean" ? e.running : null,
    agent: t != null && t.role ? t.role !== "user" && t.role !== "system" : null
  };
}
const Wo = (e) => e.filter((t) => t.status === "open" && t.key !== "conductor");
function Ho(e, t, i) {
  return e.filter((r) => {
    var s;
    return ((s = r.stall) == null ? void 0 : s.state) === "stalled" && r.key !== "conductor" && r.slot !== t && !i(`${r.key}/${r.stall.id}`);
  });
}
const mt = (e) => e.kind === "ticket" ? `build-t${e.t}` : e.kind === "spec" ? "build-spec" : e.kind === "decision" ? `shape-t${e.t}` : e.kind === "review" ? `review-t${e.t}` : e.kind === "stage" ? e.column : "conductor";
function Mo({ repo: e, number: t, active: i, autoStart: r, spineHost: s, spineCompact: p, onRemoved: d, onChanged: f, onNeeds: h }) {
  var Wt;
  const l = Rt(), u = `effort:${e}#${t}`, [n, a] = E(() => tt(u)), [x, B] = E(""), [A, j] = E(""), [D, q] = E(() => tt(`${u}:focus`) ?? { kind: "column" });
  Y(() => {
    nt(`${u}:focus`, D);
  }, [u, D]);
  const [M, Z] = E(!1), [ne, S] = E(!1), w = Fn("chain", 100, 0.75), I = ze(() => {
    pe.getInitiative(e, t).then((g) => {
      a(g), nt(u, g), B("");
    }).catch((g) => B(Se(g)));
  }, [e, t, u]);
  Y(() => {
    if (I(), !i) return;
    const g = setInterval(I, 5e3);
    return () => clearInterval(g);
  }, [I, i]);
  const K = n == null ? void 0 : n.column;
  Y(() => {
    j("");
  }, [K, D]);
  const ie = ye(K);
  Y(() => {
    if (K === void 0 || ie.current === K) {
      ie.current = K;
      return;
    }
    const g = ie.current !== void 0;
    ie.current = K, g && q({ kind: "column" });
  }, [K]);
  const ce = n ? mt(D) : null, fe = n && ce ? n.sessions[ce] ?? null : null, J = fe && !Fe(fe) ? fe : null, he = n && D.kind === "ticket" ? n.tickets.find((g) => g.number === D.t) ?? null : null, te = async (g = null, k, Q = !0, H = !1) => {
    if (!n) return;
    const z = k ?? D;
    Z(!0), j("");
    try {
      const N = z.kind === "ticket" ? { column: "build", ticket: z.t, skill: g ?? "implement" } : z.kind === "spec" ? { column: "build", mode: "implement-spec", skill: g ?? "implement-spec" } : z.kind === "decision" ? { column: "shape", ticket: z.t, skill: g } : z.kind === "review" ? { column: "review", ticket: z.t, skill: g } : z.kind === "stage" ? { column: z.column, skill: g } : { column: n.column, mode: "conductor" }, C = await pe.startSession(e, t, H ? { ...N, replace: !0 } : N), T = z.kind === "ticket" ? `${n.title}: #${z.t}` : z.kind === "spec" ? `${n.title}: implement-spec` : z.kind === "decision" ? `${n.title}: decision #${z.t}` : z.kind === "review" ? `${n.title}: review #${z.t}` : z.kind === "stage" ? `${n.title}: ${kt[z.column]}` : `${n.title}: conductor`;
      C.existing ? await l.post("/api/chat?ws=1", { slot: C.slotName, message: C.seed }) : await to(l, e, C.slotName, C.seed, T, C.agent), C.key && await pe.sessionStarted(e, t, C.key).catch(() => pe.sessionStarted(e, t, C.key)).catch(() => {
      }), k && Q && q(k), Q && (I(), f());
    } catch (N) {
      j(
        N instanceof wt && N.code === "ticket_blocked" ? N.message : `Couldn't start the conversation: ${Se(N)}`
      );
    } finally {
      Z(!1);
    }
  }, y = (g) => g.lane === "deliver" ? { kind: "ticket", t: g.number } : { kind: "decision", t: g.number }, W = (g) => g.lane === "deliver" ? "implement" : g.type === "research" ? "research" : g.type === "prototype" ? "prototype" : g.type === "issue" ? "triage" : null, [L, P] = E(null), se = (g) => {
    q(y(g));
  }, _ = n != null && n.frontier && (D.kind === "ticket" || D.kind === "decision") ? n.frontier.tiles.find((g) => g.number === D.t) ?? null : null, [R, $] = E({}), [oe, Ae] = E({}), [ge, de] = E(null);
  Y(() => {
    let g = !0;
    const k = () => (it(), l.get("/api/chat/slots").then((H) => {
      g && Array.isArray(H) && de(new Set(H.filter((z) => z.key).map((z) => z.key)));
    }).catch(() => {
    }));
    if (k(), !i) return () => {
      g = !1;
    };
    const Q = setInterval(k, 5e3);
    return () => {
      g = !1, clearInterval(Q);
    };
  }, [l, i]);
  const Ne = J && !(ge !== null && !ge.has(J)) ? J : null;
  Y(() => {
    Lo(Ne);
  }, [Ne]);
  const We = yt(
    () => {
      var g;
      return (((g = n == null ? void 0 : n.frontier) == null ? void 0 : g.tiles) ?? []).filter((k) => k.sessionKey && (n == null ? void 0 : n.sessions[k.sessionKey]));
    },
    [n]
  );
  Y(() => {
    if (!We.length) {
      $({}), Ae({});
      return;
    }
    let g = !0;
    const k = (z) => {
      const N = (z == null ? void 0 : z.content) ?? (z == null ? void 0 : z.text), C = typeof N == "string" ? N : Array.isArray(N) ? N.map((X) => typeof X == "string" ? X : (X == null ? void 0 : X.text) ?? "").join(" ") : null, T = C == null ? void 0 : C.replace(/\s+/g, " ").trim();
      return T ? T.slice(0, 140) : null;
    }, Q = async () => {
      let z = /* @__PURE__ */ new Map();
      try {
        const N = await l.get("/api/chat/slots");
        g && Array.isArray(N) && (z = new Map(N.filter((C) => C.key).map((C) => [C.key, C])));
      } catch {
      }
      Promise.all(We.map((N) => {
        const C = n.sessions[N.sessionKey], T = z.get(C);
        return l.get(`/api/chat/slots/${encodeURIComponent(C)}?limit=1`).then((X) => {
          var Mt;
          const Be = (Mt = X == null ? void 0 : X.messages) == null ? void 0 : Mt[X.messages.length - 1], le = (T == null ? void 0 : T.pending_approval) ?? (X == null ? void 0 : X.pending_approval), _e = (T == null ? void 0 : T.needs_input) ?? (X == null ? void 0 : X.needs_input), Rn = (T == null ? void 0 : T.running) ?? (X == null ? void 0 : X.running), Ht = le ? "approval" : _e ? "input" : null, Cn = { at: (Be == null ? void 0 : Be.ts) ?? null, line: Be && Be.role !== "user" ? k(Be) : null, needs: Ht }, Tn = Ht ? "attention" : Rn ? "running" : N.state === "done" ? null : "waiting";
          return [N.number, Tn, Cn];
        }).catch(() => null);
      })).then((N) => {
        if (!g) return;
        const C = {}, T = {};
        for (const X of N)
          X && (X[1] && (C[X[0]] = X[1]), T[X[0]] = X[2]);
        $(C), Ae(T);
      });
    };
    if (Q(), !i) return () => {
      g = !1;
    };
    const H = setInterval(Q, 5e3);
    return () => {
      g = !1, clearInterval(H);
    };
  }, [l, We, i, n]);
  const we = yt(() => {
    var N, C, T, X, Be;
    if (!n) return [];
    const g = (le) => ((le == null ? void 0 : le.decisions) ?? []).filter(ct).length, k = /* @__PURE__ */ new Set(), Q = [], H = (le) => {
      const _e = mt(le);
      k.has(_e) || (k.add(_e), Q.push(le));
    }, z = (le) => {
      var _e;
      return (_e = le.sessionKey) != null && _e.startsWith("review-t") ? { kind: "review", t: le.number } : le.lane === "deliver" ? { kind: "ticket", t: le.number } : { kind: "decision", t: le.number };
    };
    g(((N = n.sessionStates) == null ? void 0 : N.conductor) ?? n.state) && H({ kind: "column" });
    for (const le of ((C = n.frontier) == null ? void 0 : C.tiles) ?? [])
      le.state === "done" || !le.sessionKey || (g((T = n.sessionStates) == null ? void 0 : T[le.sessionKey]) || R[le.number] === "attention" || le.state === "you") && H(z(le));
    for (const le of ["plan", "review", "done", "intake", "shape", "grill"])
      n.sessions[le] && g((X = n.sessionStates) == null ? void 0 : X[le]) && H({ kind: "stage", column: le });
    return n.sessions["build-spec"] && g((Be = n.sessionStates) == null ? void 0 : Be["build-spec"]) && H({ kind: "spec" }), Q;
  }, [n, R]), Pe = we.length;
  Y(() => {
    h == null || h(Pe);
  }, [Pe, h]), Y(() => () => {
    h == null || h(0);
  }, [h]);
  const v = async (g) => {
    for (let k = 0; k < g.length; k++)
      P(`Starting ${k + 1} of ${g.length}…`), await te(W(g[k]), y(g[k]), !1);
    P(null), I(), f();
  }, ee = `kipo.autopilot:${e}#${t}`, [be, Ie] = E(() => localStorage.getItem(ee) === "1"), Ge = (g) => {
    Ie(g), localStorage.setItem(ee, g ? "1" : "0");
  }, Oe = ye(/* @__PURE__ */ new Set());
  Y(() => {
    if (!be || !i || L || !(n != null && n.frontier)) return;
    const g = n.frontier.tiles.filter((k) => k.lane === "deliver" && k.state === "afk" && !k.sessionKey && !Oe.current.has(k.number));
    g.length && (g.forEach((k) => Oe.current.add(k.number)), v(g));
  }, [be, i, L, n]);
  const He = `kipo.dispatched:${e}#${t}`, Me = ye(/* @__PURE__ */ new Set()), De = (g) => {
    Me.current.delete(g);
    try {
      const k = JSON.parse(localStorage.getItem(He) || "[]");
      localStorage.setItem(He, JSON.stringify(k.filter((Q) => Q !== g)));
    } catch {
    }
  };
  Y(() => {
    var z, N;
    if (!i || M || L || !(n != null && n.frontier)) return;
    const g = ((N = (z = n.sessionStates) == null ? void 0 : z.conductor) == null ? void 0 : N.dispatch) ?? [];
    let k = [];
    try {
      k = JSON.parse(localStorage.getItem(He) || "[]");
    } catch {
      k = [];
    }
    const { fresh: Q, starts: H } = zo(
      g,
      (C) => k.includes(C) || Me.current.has(C),
      n.frontier.tiles,
      n.sessions,
      { prs: [...n.prs, ...n.refPrs ?? []], unstarted: Go(n) }
    );
    if (Q.length) {
      for (const C of Q)
        Me.current.add(C), k.push(C);
      try {
        localStorage.setItem(He, JSON.stringify(k.slice(-300)));
      } catch {
      }
      H.length && (async () => {
        for (const C of H) {
          if (C.replace && !nn(n, C.replace) && !await Ft(l, C.replace)) {
            De(C.id);
            continue;
          }
          const T = !!C.replace;
          C.kind === "tile" ? await te(C.skill ?? W(C.tile), y(C.tile), !1, T) : C.kind === "review" ? await te(null, { kind: "review", t: C.t }, !1, T) : await te(C.skill, { kind: "stage", column: C.column }, !1, T);
        }
        I(), f();
      })();
    }
  }, [i, M, L, n]);
  const Te = `kipo.restarted:${e}#${t}`;
  Y(() => {
    if (!i || M || L || !(n != null && n.closing)) return;
    let g = [];
    try {
      g = JSON.parse(localStorage.getItem(Te) || "[]");
    } catch {
      g = [];
    }
    const Q = n.closing.filter((N) => N.started === !1 && N.key !== "conductor" && !g.includes(N.slot)).map((N) => [N, Ko(N.key)]).find(([, N]) => N);
    if (!Q) return;
    const [H, z] = Q;
    try {
      localStorage.setItem(Te, JSON.stringify([...g, H.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var C;
      if (!nn(n, H.slot) && !await Ft(l, H.slot)) return;
      const N = (C = n.frontier) == null ? void 0 : C.tiles.find((T) => (z.kind === "ticket" || z.kind === "decision") && T.number === z.t);
      await te(N ? W(N) : null, z, !1, !0), I(), f();
    })();
  }, [i, M, L, n]);
  const ue = n != null && n.sessions.conductor && !Fe(n.sessions.conductor) ? n.sessions.conductor : null, Ee = ((n == null ? void 0 : n.closing) ?? []).filter((g) => {
    var k;
    return ((k = g.stall) == null ? void 0 : k.state) === "stuck";
  }).map((g) => g.key), ke = n != null && n.frontier ? JSON.stringify({
    t: n.frontier.tiles.map((g) => [g.number, g.state]),
    p: n.prs.map((g) => [g.number, g.state]),
    ...Ee.length ? { s: Ee } : {}
  }) : "";
  Y(() => {
    if (!ke || !ue || !i) return;
    const g = `kipo.conductorSaw:${e}#${t}`, k = localStorage.getItem(g);
    if (k === ke) return;
    if (k === null) {
      localStorage.setItem(g, ke);
      return;
    }
    const Q = [];
    try {
      const H = JSON.parse(k), z = JSON.parse(ke), N = new Map(H.t), C = new Map(H.p);
      for (const [T, X] of z.t) N.get(T) !== X && Q.push(`#${T} ${N.get(T) ?? "new"} → ${X}`);
      for (const [T, X] of z.p) C.get(T) !== X && Q.push(`PR #${T} ${(C.get(T) ?? "new").toLowerCase()} → ${X.toLowerCase()}`);
      for (const T of z.s ?? []) (H.s ?? []).includes(T) || Q.push(`${T} stuck (woken twice, no answer)`);
    } catch {
    }
    (async () => {
      try {
        const H = await l.get(`/api/chat/slots/${encodeURIComponent(ue)}?limit=1`);
        if (H != null && H.running) return;
        await l.post("/api/chat?ws=1", {
          slot: ue,
          message: `[KiPo] Frontier changed${Q.length ? `: ${Q.slice(0, 12).join("; ")}` : ""}. Run the frontier and carry on.`
        }), localStorage.setItem(g, ke);
      } catch {
      }
    })();
  }, [ke, ue, i]), Y(() => {
    const g = n == null ? void 0 : n.reports;
    if (!g || !ue || !i) return;
    const k = `kipo.reportsSent:${e}#${t}`, Q = Number(localStorage.getItem(k) || "0"), H = g.reports.filter((z) => z.id > Math.max(Q, g.read));
    H.length && (async () => {
      try {
        const z = await l.get(`/api/chat/slots/${encodeURIComponent(ue)}?limit=1`);
        if (z != null && z.running) return;
        const N = (T) => {
          var X;
          return `${T.event}: ${T.text}${(X = T.items) != null && X.length ? ` (${T.items.join("; ")})` : ""}`;
        }, C = H.length === 1 ? `[KiPo] Report from ${H[0].from}: ${N(H[0])}` : `[KiPo] Reports from the sessions:
${H.slice(-12).map((T) => `- ${T.from} ${N(T)}`).join(`
`)}`;
        await l.post("/api/chat?ws=1", { slot: ue, message: `${C}
Run the frontier and carry on.` }), localStorage.setItem(k, String(H[H.length - 1].id));
      } catch {
      }
    })();
  }, [n, ue, i]);
  const Je = (g, k) => {
    if (n) {
      if (n.sessions[g]) {
        q({ kind: "stage", column: g });
        return;
      }
      te(k, { kind: "stage", column: g });
    }
  }, rt = () => Je("plan", "to-spec"), m = () => Je("review", null), V = () => Je("done", "retro"), U = async () => {
    if (n) {
      S(!0), j("");
      try {
        n.column !== "done" && await pe.advance(e, t, !0, "done"), await pe.advance(e, t, !0, null), await Yt(l, Object.values(n.sessions), null), d();
      } catch (g) {
        j(`Couldn't close it: ${Se(g)}`), S(!1);
      }
    }
  }, F = ye(!1);
  Y(() => {
    if (!(n != null && n.closing) || !i || F.current) return;
    const g = n.closing.filter((k) => k.status === "closable");
    g.length && (F.current = !0, Yt(l, g.map((k) => k.slot), J).then((k) => {
      const Q = g.filter((H) => k.includes(H.slot)).map((H) => H.key);
      return Q.length ? pe.sessionsClosed(e, t, Q).then(() => I()) : void 0;
    }).catch(() => {
    }).finally(() => {
      F.current = !1;
    }));
  }, [l, n, i, J]);
  const Ke = JSON.stringify(Wo((n == null ? void 0 : n.closing) ?? []).filter((g) => !Fe(g.slot)).map((g) => [g.key, g.slot]));
  Y(() => {
    const g = JSON.parse(Ke);
    if (!i || !g.length) return;
    let k = !0;
    const Q = () => {
      Promise.all(g.map(
        ([z, N]) => l.get(`/api/chat/slots/${encodeURIComponent(N)}?limit=1`).then((C) => [z, Eo(C)]).catch(() => null)
      )).then((z) => {
        if (!k) return;
        const N = Object.fromEntries(z.filter((C) => C && C[1]).map((C) => [C[0], C[1]]));
        Object.keys(N).length && pe.sessionsActivity(e, t, N).catch(() => {
        });
      });
    };
    Q();
    const H = setInterval(Q, 3e4);
    return () => {
      k = !1, clearInterval(H);
    };
  }, [l, Ke, i, e, t]);
  const xe = `kipo.woke:${e}#${t}`, Le = `kipo.wokeNotes:${e}#${t}`, Ue = ye(!1);
  Y(() => {
    if (!(n != null && n.closing) || !i || Ue.current) return;
    let g = [];
    try {
      g = JSON.parse(localStorage.getItem(xe) || "[]");
    } catch {
      g = [];
    }
    let k = [];
    try {
      k = JSON.parse(localStorage.getItem(Le) || "[]");
    } catch {
      k = [];
    }
    const Q = Ho(n.closing, J, (H) => g.includes(H)).filter((H) => !Fe(H.slot));
    !Q.length && !(k.length && ue) || (Ue.current = !0, (async () => {
      for (const H of Q) {
        const z = H.stall;
        try {
          const N = await l.get(`/api/chat/slots/${encodeURIComponent(H.slot)}?limit=1`);
          if (N != null && N.running) continue;
          await l.post("/api/chat?ws=1", { slot: H.slot, message: Ao(z.why) }), g = [...g, `${H.key}/${z.id}`].slice(-300), localStorage.setItem(xe, JSON.stringify(g)), k = [...k, Oo(H.key, z.why)], localStorage.setItem(Le, JSON.stringify(k)), await pe.sessionsWoken(e, t, H.key, z.id ?? "", z.why);
        } catch {
        }
      }
      if (k.length && ue)
        try {
          const H = await l.get(`/api/chat/slots/${encodeURIComponent(ue)}?limit=1`);
          H != null && H.running || (await l.post("/api/chat?ws=1", { slot: ue, message: `${k.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(Le, "[]"));
        } catch {
        }
      Q.length && I();
    })().finally(() => {
      Ue.current = !1;
    }));
  }, [l, n, i, J, ue]);
  const ae = ye(!1);
  if (Y(() => {
    !r || ae.current || !n || (ae.current = !0, n.sessions[n.column] || te());
  }, [r, n]), !n)
    return /* @__PURE__ */ o("div", { style: { flex: 1, padding: 24 }, children: x ? /* @__PURE__ */ o(qe, { children: x }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.body }, children: "Loading…" }) });
  const me = ce ? ((Wt = n.sessionStates) == null ? void 0 : Wt[ce]) ?? null : n.state, Qe = (me == null ? void 0 : me.skillsUsed) ?? [], pt = () => {
    if (!we.length) return;
    const g = we.findIndex((k) => mt(k) === ce);
    q(we[(g + 1) % we.length]);
  }, At = ye(null), bn = () => {
    var g, k;
    try {
      (k = (g = At.current) == null ? void 0 : g.contentWindow) == null || k.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [Ve, vn] = E(!1), [Ot, wn] = E(0), kn = ze((g) => wn((k) => Math.abs(k - g) > 4 ? g : k), []), [Et, xn] = E(128), Sn = ze((g) => xn((k) => Math.abs(k - g) > 4 ? g : k), []), $n = _ ? _.state === "done" : !!fe && Fe(fe), In = D.kind === "column" ? me ?? n.state : me;
  return /* @__PURE__ */ c("div", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ o("style", { children: "@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}" }),
    /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", minWidth: 0 }, children: [
      /* @__PURE__ */ c("span", { style: { ...$e, fontSize: b.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, title: n.title, children: [
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
          children: /* @__PURE__ */ o(xt, { kind: n.kind, map: n.kind === "map" ? n.number : n.mapIssue })
        }
      ),
      /* @__PURE__ */ o("span", { style: { flex: 1 } }),
      /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, whiteSpace: "nowrap" }, title: n.repoPath, children: n.repo })
    ] }),
    A && /* @__PURE__ */ o("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ o(qe, { children: A }) }),
    (() => {
      var C;
      const g = /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ o("span", { style: { ...J ? G : $e, fontSize: J ? b.small : b.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: _ ? `#${_.number}${J ? "" : ` ${_.title}`}` : D.kind === "column" ? "Conductor" : n.title }),
        J && Qe.length > 0 && /* @__PURE__ */ o(qo, { skills: Qe }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        _ && (n.frontier ? $t(n.frontier.tiles, _.number).length > 1 : !1) && /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: () => vn((T) => !T),
            "aria-pressed": Ve,
            title: "Show or hide this ticket's map — what it waits on and what it unblocks",
            "aria-label": "Show or hide the map",
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              background: Ve ? "var(--bg-elevated)" : "transparent",
              color: Ve ? "var(--text)" : "var(--muted)",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: b.small,
              border: `1px solid ${Ve ? "var(--border)" : "transparent"}`
            },
            children: [
              /* @__PURE__ */ o(Nn, { size: 14 }),
              " Map"
            ]
          }
        ),
        J && /* @__PURE__ */ o(
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
            onMouseEnter: (T) => {
              T.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))", T.currentTarget.style.color = "var(--text)";
            },
            onMouseLeave: (T) => {
              T.currentTarget.style.background = "transparent", T.currentTarget.style.color = "var(--muted)";
            },
            children: /* @__PURE__ */ o(Pn, { size: 15 })
          }
        )
      ] }), k = _ && (_.state === "you" || _.state === "afk"), Q = !!J && ge !== null && !ge.has(J), H = J && Q ? /* @__PURE__ */ o(So, { slot: J, active: i, ended: !0 }) : J ? (
        // The card sits `composerH` up, so the transcript must clear the
        // composer, the card, and a gap above it.
        /* @__PURE__ */ o(
          Bo,
          {
            slotKey: J,
            frameRef: At,
            padBottom: Ot ? Et + Ot + 24 : 0,
            onComposerH: Sn
          },
          J
        )
      ) : _ ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          k && /* @__PURE__ */ c("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ o(Ce, { primary: !0, disabled: M, onClick: () => te(W(_)), children: M ? "Starting…" : ((C = yn[_.type]) == null ? void 0 : C.action) ?? "Start this ticket" }),
            tn(_, null).map((T) => /* @__PURE__ */ c(
              "button",
              {
                type: "button",
                disabled: M,
                onClick: () => te(T.skill),
                title: Ct[T.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: M ? "default" : "pointer", fontSize: b.small },
                children: [
                  "/",
                  T.skill,
                  " ",
                  /* @__PURE__ */ o("span", { style: G, children: T.label })
                ]
              },
              T.skill
            ))
          ] }),
          /* @__PURE__ */ o(Co, { detail: n, tile: _ })
        ] })
      ) : /* @__PURE__ */ o(
        jo,
        {
          detail: n,
          focus: D,
          ticket: he,
          tile: null,
          starting: M,
          onStart: () => te(null),
          alternatives: tn(null, D.kind === "column" ? n.column : null),
          onSkill: (T) => te(T)
        }
      ), z = _ && n.frontier ? $t(n.frontier.tiles, _.number) : [], N = s ? Dn(
        /* @__PURE__ */ o(
          co,
          {
            detail: n,
            statuses: R,
            activity: oe,
            busy: ne || M || !!L,
            autopilot: be,
            selectedKey: ce,
            embedded: !0,
            compact: p,
            onAutopilot: Ge,
            onOpenTile: se,
            onOpenConversation: (T) => q(T === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(T) ? { kind: "review", t: Number(T.slice(8)) } : { kind: "stage", column: T }),
            onSelectConductor: () => q({ kind: "column" }),
            onJumpQuestions: pt,
            onHandover: rt,
            onReview: m,
            onRetro: V,
            onClose: U
          }
        ),
        s
      ) : null;
      return /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        N,
        /* @__PURE__ */ c("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          g,
          _ && z.length > 1 && Ve && /* @__PURE__ */ c(ve, { children: [
            /* @__PURE__ */ c("div", { ref: w.ref, style: { ...w.style }, children: [
              /* @__PURE__ */ o("div", { style: { padding: "6px 16px 0", fontSize: b.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ o(ko, { tiles: z, focus: _.number, onOpen: se, labeled: !0, dimOthers: !1, statuses: R, down: !0 })
            ] }),
            /* @__PURE__ */ o(
              dn,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: w.onDrag,
                onReset: w.reset
              }
            )
          ] }),
          /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            H,
            /* @__PURE__ */ o(Io, { state: In, slotKey: J, settled: $n, onError: j, onSize: kn, bottomOffset: Et + 10 }, J ?? "none")
          ] })
        ] })
      ] });
    })()
  ] });
}
function en(e) {
  const t = (p) => typeof p == "string" && /(^|_)kipo-/.test(p), i = (p) => p === e || p.endsWith(`_${e}`), r = (p) => t(p) ? p : p && typeof p == "object" && t(p.key) ? p.key : null, s = (p) => {
    let d = !1;
    if (Array.isArray(p))
      for (let f = p.length - 1; f >= 0; f--) {
        const h = r(p[f]);
        h !== null && !i(h) ? (p.splice(f, 1), d = !0) : s(p[f]) && (d = !0);
      }
    else if (p && typeof p == "object")
      for (const f of Object.values(p)) s(f) && (d = !0);
    return d;
  };
  for (const p of [window.localStorage, window.sessionStorage])
    try {
      for (const d of Object.keys(p)) {
        const f = p.getItem(d);
        if (!f || !f.includes("kipo-") || f[0] !== "[" && f[0] !== "{") continue;
        let h;
        try {
          h = JSON.parse(f);
        } catch {
          continue;
        }
        s(h) && p.setItem(d, JSON.stringify(h));
      }
    } catch {
    }
}
function No(e) {
  const t = [...e.querySelectorAll("[data-session-window]")];
  if (t.length < 2) {
    for (const s of t) s.style.display === "none" && (s.style.display = "");
    return !1;
  }
  const i = t[t.length - 1];
  let r = !1;
  for (const s of t) {
    const p = s === i ? "" : "none";
    s.style.display !== p && (s.style.display = p, r = !0);
  }
  return r;
}
let Po = 0;
const Do = () => ++Po;
let It = null;
function Lo(e) {
  It = e, it();
}
function it() {
  try {
    const e = [...document.querySelectorAll("iframe[data-kipo-frame]")];
    let t = null, i = -1;
    if (It !== null)
      for (const r of e) {
        if (r.getAttribute("data-kipo-frame") !== It) continue;
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
function Bo({ slotKey: e, frameRef: t, padBottom: i = 0, onComposerH: r }) {
  const s = `/popout/chat?sid=${encodeURIComponent(e)}`, p = ye(null), d = ye(i);
  d.current = i;
  const f = ze(() => {
    var l;
    try {
      const u = (l = t.current) == null ? void 0 : l.contentDocument;
      if (!u) return;
      let n = u.getElementById("kipo-qcard-css");
      !n && u.head && (n = u.createElement("style"), n.id = "kipo-qcard-css", u.head.appendChild(n));
      const a = d.current ? ".followup-chip{display:none !important}" : "";
      if (n && n.textContent !== a && (n.textContent = a), r) {
        const A = u.querySelector('[data-testid="composer-dock-root"]') ?? u.querySelector('[data-testid="composer-dock"]'), j = A ? Math.round(A.getBoundingClientRect().height) : 0;
        j > 0 && r(j);
      }
      let x = p.current;
      if (!x || !x.isConnected || x.ownerDocument !== u) {
        const A = u.defaultView;
        x = [...u.querySelectorAll("div")].filter((D) => {
          if (D.clientHeight < 200) return !1;
          const q = A == null ? void 0 : A.getComputedStyle(D);
          return !!q && (q.overflowY === "auto" || q.overflowY === "scroll");
        }).sort((D, q) => q.clientHeight - D.clientHeight)[0] ?? null, p.current = x;
      }
      if (!x) return;
      const B = d.current ? `${d.current}px` : "";
      x.style.paddingBottom !== B && (x.style.paddingBottom = B);
    } catch {
    }
  }, [t]);
  Y(() => {
    f();
  }, [f, i]), Y(() => {
    en(e);
  }, [e]), Y(() => {
    const l = t.current;
    return l && l.setAttribute("data-kipo-gen", String(Do())), it(), () => {
      requestAnimationFrame(it);
    };
  }, [e, t]);
  const h = () => {
    var u;
    const l = t.current;
    try {
      const n = (u = l == null ? void 0 : l.contentWindow) == null ? void 0 : u.location.pathname;
      if (l && n && !n.startsWith("/popout/chat")) {
        l.src = s;
        return;
      }
      const a = l == null ? void 0 : l.contentDocument;
      if (a && !a.getElementById("kipo-popout-css")) {
        const x = a.createElement("style");
        x.id = "kipo-popout-css", x.textContent = [
          '[title*="main window" i]',
          '[aria-label*="main window" i]',
          '[title*="split view" i]',
          '[aria-label*="split view" i]',
          '[aria-label="Close panel"]',
          '[title="Close panel"]'
        ].join(",") + "{display:none !important}", a.head.appendChild(x);
      }
    } catch {
    }
  };
  return Y(() => {
    const l = [], u = window.setInterval(() => {
      var a;
      const n = t.current;
      try {
        const x = (a = n == null ? void 0 : n.contentWindow) == null ? void 0 : a.location.pathname;
        if (n && x && !x.startsWith("/popout/chat")) {
          const A = Date.now();
          for (; l.length && A - l[0] > 6e5; ) l.shift();
          l.length < 5 && (l.push(A), en(e), n.src = s);
          return;
        }
        it();
        const B = n == null ? void 0 : n.contentDocument;
        B && No(B);
      } catch {
      }
      d.current && f();
    }, 2e3);
    return () => window.clearInterval(u);
  }, [s, e, t, f]), /* @__PURE__ */ o(
    "iframe",
    {
      ref: t,
      src: s,
      title: "The session in Kiro's chat",
      onLoad: h,
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
function jo({ detail: e, focus: t, ticket: i, tile: r, starting: s, onStart: p, alternatives: d, onSkill: f }) {
  let h, l, u;
  if (r) {
    const n = yn[r.type];
    r.state === "done" ? (h = "Closed", l = r.sessionKey ? "Its conversation was closed when the ticket was. How it ended is on the right." : "How it ended is on the right.", u = null) : r.state === "blocked" ? (h = `Waiting on ${r.blockedBy.map((a) => `#${a}`).join(", ")}`, l = "It can start once those are closed.", u = null) : r.state === "review" ? (h = "In review", l = "Its PR is open. The effort's Review merges it once it's clean.", u = null) : (h = "No conversation yet", l = `${r.who === "you" ? "HITL (human in the loop): it needs you." : "Agent (AFK, away from keyboard): an agent can take it on its own."} ${n.body}`, u = n.action);
  } else if (t.kind === "ticket")
    i != null && i.blockedBy.length ? (h = `#${t.t} is waiting on ${i.blockedBy.map((n) => `#${n}`).join(", ")}`, l = "It can start once those are closed.", u = null) : (i == null ? void 0 : i.state) === "CLOSED" ? (h = `#${t.t} is closed`, l = "Nothing left to build on this ticket.", u = null) : (h = `Build #${t.t}`, l = "/implement builds this one ticket test-first in a fresh conversation, then reviews it.", u = "Implement this ticket");
  else if (t.kind === "spec")
    h = "Implement the whole spec", l = "/implement-spec builds every unblocked ticket in parallel on one integration branch, then one review.", u = "Run /implement-spec";
  else if (t.kind === "review")
    h = `Review #${t.t}`, l = "kipo-review reviews this ticket's PR, fixes what it finds, and merges it if it's a two-way door.", u = "Review this ticket";
  else if (t.kind === "decision")
    h = `Decision #${t.t}`, l = "Work through this decision ticket from the map in its own conversation.", u = "Start this decision";
  else if (t.kind === "column")
    h = "Start the conductor", l = "The conductor runs this effort: it reads the frontier from GitHub, starts one stage-skill conversation per open thread, asks you in one batched message, and closes the effort when the frontier is empty. It never does the work itself.", u = "Start the conductor";
  else {
    const n = t.column, a = n === "plan" && e.sessions.grill;
    h = `${kt[n]} hasn't started`, l = a ? "Plan continues the Grill conversation, so the spec and tickets are written with everything it learned." : `${Bn[n]}`, u = a ? "Continue in the Grill conversation" : `Start ${kt[n]}`;
  }
  return /* @__PURE__ */ o("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ c("div", { style: { maxWidth: 400, textAlign: "center" }, children: [
    /* @__PURE__ */ o("div", { style: { ...$e, fontSize: b.title }, children: h }),
    /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.body, margin: "6px 0 14px", lineHeight: 1.5 }, children: l }),
    /* @__PURE__ */ o("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }, children: u && /* @__PURE__ */ o(Ce, { primary: !0, disabled: s, onClick: p, children: s ? "Starting…" : u }) }),
    u && d.map((n) => /* @__PURE__ */ c("div", { style: { marginTop: 10, fontSize: b.small }, children: [
      /* @__PURE__ */ o("span", { style: G, children: "or " }),
      /* @__PURE__ */ c(
        "button",
        {
          type: "button",
          disabled: s,
          onClick: () => f(n.skill),
          title: Ct[n.skill],
          style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: s ? "default" : "pointer", fontSize: b.small },
          children: [
            "/",
            n.skill
          ]
        }
      ),
      /* @__PURE__ */ c("span", { style: G, children: [
        " ",
        n.label
      ] })
    ] }, n.skill))
  ] }) });
}
function tn(e, t) {
  return (e ? e.type === "grilling" : t === "grill") ? [{ skill: "grill-me", label: "without writing docs" }] : [];
}
function qo({ skills: e }) {
  return /* @__PURE__ */ c("span", { style: { ...G, fontSize: b.tiny, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: [
    "Running",
    " ",
    e.map((t, i) => /* @__PURE__ */ c("span", { children: [
      i > 0 && " · ",
      /* @__PURE__ */ o("span", { title: Ct[t] ?? t, style: { color: "var(--text)", cursor: "help" }, children: t })
    ] }, t))
  ] });
}
const Go = (e) => (e.closing ?? []).filter((t) => t.started === !1).map((t) => t.key);
function Ko(e) {
  const t = /^(build|shape|review)-t(\d+)$/.exec(e);
  return t ? { kind: t[1] === "build" ? "ticket" : t[1] === "shape" ? "decision" : "review", t: Number(t[2]) } : e === "build-spec" ? { kind: "spec" } : ["intake", "shape", "grill", "plan", "review", "done"].includes(e) ? { kind: "stage", column: e } : null;
}
const nn = (e, t) => Object.values(e.sessions).filter((i) => i === t).length > 1;
function Xo() {
  const e = zn(), t = (e == null ? void 0 : e.active) !== !1, i = Rt(), [r, s] = E(() => tt("initiatives")), [p, d] = E(() => tt("repos")), [f, h] = E(!1), [l, u] = E(""), [n, a] = E(() => {
    const y = tt("main");
    return !y || !["new", "initiative"].includes(y.kind) ? null : y.kind === "initiative" ? { ...y, autoStart: void 0 } : y;
  });
  Y(() => {
    n && nt("main", n);
  }, [n]);
  const [x, B] = cn("rail", 300, 168, 620), [A, j] = E(null), [D, q] = E(() => localStorage.getItem("kipo.railOpen") !== "0"), M = (y) => {
    q(y), localStorage.setItem("kipo.railOpen", y ? "1" : "0");
  };
  Y(() => {
    Xn(i).catch(() => {
    });
  }, [i]);
  const [Z, ne] = E(""), S = ze(() => {
    pe.listInitiatives().then((y) => {
      var W;
      s(y.initiatives), nt("initiatives", y.initiatives), d(y.repos ?? []), nt("repos", y.repos ?? []), u(""), ne((W = y.errors) != null && W.length ? `GitHub is refusing calls for ${y.errors.length === 1 ? y.errors[0].repo.split("/").pop() : `${y.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch((y) => u(Se(y)));
  }, []);
  Y(() => {
    if (S(), !t) return;
    const y = setInterval(S, 15e3);
    return () => clearInterval(y);
  }, [S, t]), Y(() => {
    if (r === null) return;
    const y = (n == null ? void 0 : n.kind) === "initiative" && !r.some((L) => L.repo === n.repo && L.number === n.number);
    if (n && !y) return;
    const W = r[0];
    a(W ? { kind: "initiative", repo: W.repo, number: W.number } : { kind: "new" });
  }, [r, n]);
  const w = (y, W) => a({ kind: "initiative", repo: y.repo, number: y.number, autoStart: W }), I = (y) => {
    s((W) => (W ?? []).filter((L) => !(L.repo === y.repo && L.number === y.number))), pe.hide(y.repo, y.number).then(S).catch((W) => {
      u(Se(W)), S();
    });
  }, K = (y) => {
    s((W) => (W ?? []).filter((L) => !(L.repo === y.repo && L.number === y.number))), pe.removeInitiative(y.repo, y.number).then(S).catch((W) => {
      u(Se(W)), S();
    });
  }, ie = (y) => {
    d((W) => (W ?? []).filter((L) => L.slug !== y)), s((W) => (W ?? []).filter((L) => L.repo !== y)), pe.removeRepo(y).then(S).catch((W) => {
      u(Se(W)), S();
    });
  }, ce = (y, W) => {
    Promise.allSettled(W.map((L) => pe.unhide(y, L))).then(S);
  }, fe = (n == null ? void 0 : n.kind) === "initiative" ? `${n.repo}#${n.number}` : null, [J, he] = E(0), te = ze((y) => he(y), []);
  return /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    D ? /* @__PURE__ */ c(ve, { children: [
      /* @__PURE__ */ o(
        mo,
        {
          width: x,
          onCollapse: () => M(!1),
          items: r,
          repos: p,
          error: l,
          notice: Z,
          selected: fe,
          attention: J,
          spineSlot: j,
          onNew: () => a({ kind: "new" }),
          onAddRepo: () => h(!0),
          onRemoveRepo: ie,
          onRestore: ce,
          onSelect: (y) => w(y),
          onHide: I,
          onRemove: K
        }
      ),
      /* @__PURE__ */ o(dn, { direction: "vertical", label: "Resize the effort list", onDrag: (y) => B((W) => W + y), onReset: () => B(228) })
    ] }) : /* @__PURE__ */ o(
      yo,
      {
        items: r,
        selected: fe,
        attention: J,
        onNew: () => a({ kind: "new" }),
        onSelect: (y) => w(y),
        onExpand: () => M(!0)
      }
    ),
    /* @__PURE__ */ c("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (n == null ? void 0 : n.kind) === "new" && /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ o(
        vo,
        {
          onStarted: (y) => {
            S(), w(y, !0);
          },
          onCancel: r && r.length ? () => a(r[0] ? { kind: "initiative", repo: r[0].repo, number: r[0].number } : { kind: "new" }) : void 0
        }
      ) }),
      (n == null ? void 0 : n.kind) === "initiative" && /* @__PURE__ */ o(
        Mo,
        {
          repo: n.repo,
          number: n.number,
          autoStart: n.autoStart,
          active: t,
          spineHost: D ? A : null,
          spineCompact: x < 340,
          onChanged: S,
          onRemoved: () => {
            S(), a(null);
          },
          onNeeds: te
        },
        `${n.repo}#${n.number}`
      )
    ] }),
    f && /* @__PURE__ */ o(_n, { onAdded: S, onClose: () => h(!1) })
  ] });
}
export {
  Xo as default
};
