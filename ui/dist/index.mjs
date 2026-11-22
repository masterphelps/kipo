import { jsxs as c, jsx as o, Fragment as ve } from "react/jsx-runtime";
import { useAppApi as Rt, useAppInfo as zn } from "@kirocrew/app-sdk";
import { useState as O, useCallback as ze, useEffect as F, useRef as ye, useLayoutEffect as An, useMemo as yt } from "react";
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
  const [s, p] = O(r);
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
  const [r, s] = O(null), [p, d] = O(""), f = ze(async (l) => {
    d("");
    try {
      s(await pe.browse(l));
    } catch (u) {
      d(Se(u));
    }
  }, []);
  return F(() => {
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
  const [i, r] = O(null), [s, p] = O(""), [d, f] = O(!1), [h, l] = O(null);
  F(() => {
    let n = !0;
    return pe.tree().then((a) => {
      n && r(a.available);
    }).catch((a) => {
      n && (r([]), p(Se(a)));
    }), () => {
      n = !1;
    };
  }, []), F(() => {
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
  const s = ze((h) => Math.round(Math.min(r, Math.max(i, h))), [i, r]), [p, d] = O(() => {
    const h = qt()[e];
    return s(typeof h == "number" ? h : t);
  });
  F(() => {
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
  const s = ye(null), [p, d] = O(!1), [f, h] = O(!1), l = e === "vertical", u = (z) => l ? z.clientX : z.clientY;
  F(() => {
    if (!p) return;
    const z = (D) => {
      if (s.current == null) return;
      const j = u(D), P = j - s.current;
      P && (s.current = j, t(P));
    }, q = () => {
      s.current = null, d(!1);
    };
    return window.addEventListener("pointermove", z), window.addEventListener("pointerup", q), window.addEventListener("pointercancel", q), () => {
      window.removeEventListener("pointermove", z), window.removeEventListener("pointerup", q), window.removeEventListener("pointercancel", q);
    };
  }, [p, t]);
  const n = (z) => {
    z.preventDefault(), s.current = u(z), d(!0);
  }, a = (z) => {
    const q = z.shiftKey ? 40 : 10, D = l ? "ArrowLeft" : "ArrowUp", j = l ? "ArrowRight" : "ArrowDown";
    z.key === D && (z.preventDefault(), t(-q)), z.key === j && (z.preventDefault(), t(q));
  }, S = p || f, B = l ? { width: 9, margin: "0 -4px", cursor: "col-resize", alignSelf: "stretch" } : { height: 9, margin: "-4px 0", cursor: "row-resize", width: "100%" };
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
            style: l ? { width: S ? 3 : 1, height: "100%", borderRadius: 2, background: S ? "var(--accent)" : "var(--border)", transition: "width .1s" } : { height: S ? 3 : 1, width: "100%", borderRadius: 2, background: S ? "var(--accent)" : "var(--border)", transition: "height .1s" }
          }
        ),
        /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
          position: "absolute",
          borderRadius: 3,
          background: S ? "var(--accent)" : "var(--border)",
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
  const r = ye(null), [s, p] = O({ x: e, y: t });
  return An(() => {
    const d = r.current;
    if (!d) return;
    const f = d.getBoundingClientRect();
    p({
      x: e + f.width > window.innerWidth ? Math.max(0, e - f.width) : e,
      y: t + f.height > window.innerHeight ? Math.max(0, t - f.height) : t
    });
  }, [e, t]), F(() => {
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
  return F(() => {
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
const A = {
  done: { label: "done", color: "#3fae6a", text: "#7fd39a" },
  review: { label: "in review", color: "#a78bfa", text: "#a78bfa" },
  building: { label: "building", color: "#60a5fa", text: "#60a5fa" },
  you: { label: "HITL", color: "#f5b14c", text: "#f5b14c" },
  afk: { label: "agent", color: "#2dd4bf", text: "#2dd4bf" },
  blocked: { label: "blocked", color: "#c2615b", text: "#e08a85" },
  fog: { label: "fog", color: "transparent", text: "var(--muted)" }
};
function _t({ tile: e, onClick: t, size: i = 34, open: r, status: s, bare: p, numberOnly: d, width: f }) {
  const h = A[e.state], l = e.state !== "blocked", u = e.state === "done", n = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((S) => `#${S}`).join(", ")}` : `#${e.number} ${e.title}: ${h.label}`;
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
  const t = (u, n = 0) => u.you ? { color: A.you.color, active: !0 } : u.blocked ? { color: A.blocked.color, active: !0 } : u.building ? { color: A.building.color, active: !0 } : u.afk ? { color: A.afk.color, active: !0 } : u.review ? { color: A.review.color, active: !0 } : n ? { color: "var(--muted)", active: !0 } : u.done ? { color: A.done.color, active: !1 } : { color: null, active: !1 }, i = [
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
}, Xe = (e, t) => ({ n: e, color: A[t].color });
function ao(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function co({ detail: e, statuses: t, activity: i, busy: r, autopilot: s, selectedKey: p, embedded: d, compact: f, onAutopilot: h, onOpenTile: l, onOpenConversation: u, onSelectConductor: n, onJumpQuestions: a, onHandover: S, onReview: B, onRetro: z, onClose: q }) {
  var ue, Ee, ke, Je, rt;
  const [D, j] = O(!1), P = (m) => {
    var Z, U;
    return m ? (((U = (Z = e.sessionStates) == null ? void 0 : Z[m]) == null ? void 0 : U.decisions) ?? []).filter(ct).length : 0;
  }, V = (((Ee = ((ue = e.sessionStates) == null ? void 0 : ue.conductor) ?? e.state) == null ? void 0 : Ee.decisions) ?? []).filter(ct).length, oe = (m) => ({ label: m === 1 ? "1 question" : `${m} questions`, color: A.you.color }), w = e.frontier, v = (w == null ? void 0 : w.tiles) ?? [], W = (ke = w == null ? void 0 : w.fogItems) != null && ke.length ? w.fogItems : (w == null ? void 0 : w.fogLeft) ?? [], Y = !((Je = w == null ? void 0 : w.fogItems) != null && Je.length) && !!((rt = w == null ? void 0 : w.fogLeft) != null && rt.length), ie = new Map(Ze.map((m) => [m, []]));
  for (const m of v) ie.get(oo(m)).push(m);
  const he = (m) => m.source ? "intake" : m.type === "build" ? "build" : m.type === "grilling" ? "grill" : "shape", ce = new Map(Ze.map((m) => [m, []]));
  for (const m of v) ce.get(he(m)).push(m);
  const J = so[e.start] ?? "grill", fe = Ze.indexOf(J), te = ce.get("build"), y = e.artifacts.find((m) => m.label === "Spec" || m.label.startsWith("Spec")), E = e.prs.filter((m) => m.state === "OPEN"), L = e.prs.filter((m) => m.state === "MERGED"), N = v.filter((m) => m.state === "done").length, se = !!e.sessions.done, K = (m) => {
    var Le;
    const Z = m.state !== "done" ? P(m.sessionKey) : 0, U = t[m.number], _ = U === "attention" ? ((Le = i == null ? void 0 : i[m.number]) == null ? void 0 : Le.needs) ?? null : null, Ke = U === "running" || U === "attention", xe = U === "attention" || Z > 0 || m.state === "you";
    return {
      key: `t${m.number}`,
      number: m.number,
      title: m.title,
      tile: m,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: Z ? oe(Z) : _ === "approval" ? { label: "trust prompt", color: A.you.color } : _ === "input" ? { label: "asking", color: A.you.color } : { label: A[m.state].label, color: m.state === "done" ? A.done.text : A[m.state].color, solid: m.state === "you" || m.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Ke || xe,
      attention: xe,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Ke ? i == null ? void 0 : i[m.number] : void 0,
      questions: Z,
      selKeys: [`build-t${m.number}`, `shape-t${m.number}`, `review-t${m.number}`]
    };
  }, I = (m) => {
    const Z = (U) => m.filter((_) => _.state === U).length;
    return { done: Z("done"), you: Z("you"), afk: Z("afk"), building: Z("building"), review: Z("review"), blocked: Z("blocked") };
  }, $ = (m) => {
    const Z = ["you", "building", "afk", "review", "blocked", "done"];
    return [...m].sort((U, _) => Z.indexOf(U.state) - Z.indexOf(_.state) || U.number - _.number);
  }, ne = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, Ae = (m) => {
    const Z = e.sessions[m];
    if (!Z || Fe(Z)) return [];
    const U = P(m);
    return [{
      key: `conv-${m}`,
      title: ne[m] ?? "Its conversation",
      chip: U ? oe(U) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => u(m),
      questions: U,
      selKeys: [m]
    }];
  }, ge = Ze.map((m) => {
    const Z = ce.get(m), U = Ae(m === "build" ? "build-spec" : m);
    if (m === "plan") {
      if (te.length || y)
        return { id: m, state: "full", count: /* @__PURE__ */ c(ve, { children: [
          /* @__PURE__ */ o("b", { style: $e, children: "1 spec" }),
          " → ",
          te.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: A.done.color }], rows: U };
      if (w != null && w.handover)
        return {
          id: m,
          state: "live",
          count: /* @__PURE__ */ o("b", { style: { color: A.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: A.you.color }],
          rows: U,
          // Once the conversation exists, its row above is the way back in.
          action: U.length ? void 0 : { label: "Write the spec", onClick: S }
        };
      const ae = v.filter((me) => me.lane === "decide" && me.state !== "done").length;
      return { id: m, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${ae || "the"} decision${ae === 1 ? "" : "s"}${W.length ? ` and ${W.length} fog` : ""}`, segments: [], rows: U };
    }
    if (m === "review")
      return !E.length && !L.length && !U.length ? { id: m, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: m,
        state: E.length ? "live" : "full",
        count: /* @__PURE__ */ c(ve, { children: [
          /* @__PURE__ */ c("b", { style: $e, children: [
            L.length,
            " merged"
          ] }),
          E.length ? /* @__PURE__ */ c(ve, { children: [
            " · ",
            E.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: L.length, color: A.done.color }, { n: E.length, color: A.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...U, ...E.map((ae) => {
          const me = ae.tickets[0];
          return {
            key: `pr${ae.number}`,
            number: ae.number,
            title: ae.title,
            chip: { label: "open", color: A.review.color },
            ...me != null ? { onOpen: () => u(`review-t${me}`), selKeys: [`review-t${me}`] } : { url: ae.url }
          };
        })],
        action: E.length && !U.length ? { label: "Review the PRs", onClick: B } : void 0
      };
    if (m === "done") {
      const ae = !!(w != null && w.landed), me = ae && se && e.kind !== "map";
      return {
        id: m,
        state: N ? ae ? "live" : "full" : "queued",
        count: N ? /* @__PURE__ */ c(ve, { children: [
          /* @__PURE__ */ c("b", { style: $e, children: [
            N,
            " of ",
            v.length
          ] }),
          " · ",
          se ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: N ? void 0 : "closes when the retro runs",
        segments: [{ n: N, color: A.done.color }, { n: Math.max(0, v.length - N), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...U, ...v.filter((Qe) => Qe.state === "done").sort((Qe, pt) => Qe.number - pt.number).map(K)],
        action: ae && !se ? { label: "Run /retro", onClick: z } : me ? D ? { label: "Close the effort and its issue?", onClick: () => {
          j(!1), q();
        }, confirm: () => j(!1) } : { label: "Close effort", onClick: () => j(!0) } : void 0
      };
    }
    if (!Z.length && !(m === "shape" && W.length) && !U.length)
      return Ze.indexOf(m) < fe ? { id: m, state: "skipped", count: `entered at ${ot[J]}`, segments: [], rows: [] } : m === "build" ? { id: m, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: m, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const _ = I(Z), Ke = _.you + _.afk + _.building + _.review + _.blocked > 0 || !Z.length && U.length > 0, xe = [];
    m === "grill" ? (_.done && xe.push(`${_.done} answered`), _.you && xe.push(`${_.you} waiting`)) : (_.done && xe.push(`${_.done} done`), _.you && xe.push(`${_.you} HITL`)), _.building && xe.push(`${_.building} in agents`), _.afk && xe.push(`${_.afk} ready`), _.review && xe.push(`${_.review} in review`), _.blocked && xe.push(`${_.blocked} blocked`);
    const Le = [Xe(_.done, "done"), Xe(_.building, "building"), Xe(_.review, "review"), Xe(_.you, "you"), Xe(_.afk, "afk"), Xe(_.blocked, "blocked")];
    m === "shape" && W.length && Le.push({ n: W.length, color: "transparent", dashed: !0 });
    const Ue = [...U, ...$(Z.filter((ae) => ae.state !== "done")).map(K)];
    return m === "shape" && W.forEach((ae, me) => Ue.push({
      key: `fog${me}`,
      title: po(ae),
      chip: Y ? { label: "left unspecified", color: A.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: m,
      state: Ke ? "live" : "full",
      count: /* @__PURE__ */ c(ve, { children: [
        xe.map((ae, me) => me === 0 ? /* @__PURE__ */ o("b", { style: $e, children: ae }, ae) : /* @__PURE__ */ c("span", { children: [
          " · ",
          ae
        ] }, ae)),
        m === "shape" && W.length ? /* @__PURE__ */ c("span", { children: [
          " · ",
          W.length,
          " fog"
        ] }) : null
      ] }),
      segments: Le,
      rows: Ue
    };
  }), de = (m) => m.state === "live", Ne = ge.reduce((m, Z, U) => de(Z) ? U : m, -1), We = Ne >= 0 ? ge[Ne] : null, we = I(v), Pe = v.length, k = [
    { n: we.building, label: "in agents", color: A.building.color },
    { n: we.review, label: "in review", color: A.review.color },
    { n: we.you, label: "HITL", color: A.you.color },
    { n: we.afk, label: "ready", color: A.afk.color },
    { n: we.blocked, label: "blocked", color: A.blocked.color },
    { n: W.length, label: "fog", color: "var(--muted)" }
  ].filter((m) => m.n > 0), [ee, be] = O(() => new Set(We ? [We.id] : [])), Ie = (m) => be((Z) => {
    const U = new Set(Z);
    return U.has(m) ? U.delete(m) : U.add(m), U;
  }), Ge = V + ge.reduce((m, Z) => m + Z.rows.reduce((U, _) => U + (_.questions ?? 0), 0), 0), Oe = Object.values(i ?? {}).filter((m) => m && (m.needs === "approval" || m.needs === "input")).length, He = v.filter((m) => m.state === "you" && t[m.number] !== "attention" && !P(m.sessionKey)).length, Me = p === "conductor", De = !!e.sessions.conductor && !Fe(e.sessions.conductor), Te = f ? 10 : 16;
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
          /* @__PURE__ */ c("b", { style: { color: A.done.text }, children: [
            we.done,
            " of ",
            Pe
          ] }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: "done" })
        ] }),
        k.map((m) => /* @__PURE__ */ c("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ o("b", { style: { color: m.color }, children: m.n }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: m.label })
        ] }, m.label))
      ] }) : /* @__PURE__ */ o("span", { style: G, children: W.length ? `${W.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
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
            background: A.you.color,
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
            color: s ? A.afk.text : "var(--muted)"
          },
          children: [
            /* @__PURE__ */ o(
              "span",
              {
                "aria-hidden": !0,
                className: s ? "kipo-pulse" : void 0,
                style: { width: 7, height: 7, borderRadius: 999, background: s ? A.afk.color : "var(--muted)" }
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
            V > 0 ? /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${Me ? "var(--accent-fg, #fff)" : A.you.color}`,
              color: Me ? "var(--accent-fg, #fff)" : A.you.color
            }, children: V === 1 ? "1 question" : `${V} questions` }) : /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, fontWeight: 400, opacity: 0.75 }, children: De ? "conversation" : "not started" })
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
        /* @__PURE__ */ o(et, { color: A.done.color, label: "done" }),
        /* @__PURE__ */ o(et, { color: A.building.color, label: "in agents" }),
        /* @__PURE__ */ o(et, { color: A.you.color, label: "HITL" }),
        /* @__PURE__ */ o(et, { color: A.afk.color, label: "ready" }),
        /* @__PURE__ */ o(et, { color: A.blocked.color, label: "blocked" })
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
  const f = e.state === "skipped" || e.state === "queued", h = e.rows.length > 0 || !!e.action, l = no.find((a) => a.id === e.id), u = e.segments.reduce((a, S) => a + S.n, 0), n = e.rows.reduce((a, S) => a + (S.questions ?? 0), 0);
  return /* @__PURE__ */ c("div", { style: {
    borderBottom: "1px solid var(--border)",
    background: t ? "var(--bg-elevated)" : void 0,
    borderLeft: t ? `2px solid ${A.you.color}` : "2px solid transparent"
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
                border: `1px solid ${A.you.color}`,
                color: A.you.color,
                whiteSpace: "nowrap",
                marginRight: 6
              }, children: n === 1 ? "1 question" : `${n} questions` }),
              !t && !n && e.rows.some((a) => a.attention) && /* @__PURE__ */ o(
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
          u > 0 && /* @__PURE__ */ o("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((a) => a.n > 0).map((a, S) => /* @__PURE__ */ o("span", { style: { flex: a.n, background: a.color, ...a.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, S)) }),
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
        var q;
        const S = () => {
          a.onOpen ? a.onOpen() : a.tile ? d(a.tile) : a.url && window.open(a.url, "_blank", "noreferrer");
        }, B = !!a.onOpen || !!a.tile || !!a.url, z = !!r && !!((q = a.selKeys) != null && q.includes(r));
        return /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: B ? S : void 0,
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
              background: z ? "var(--bg-elevated)" : "transparent",
              boxShadow: z ? "inset 2px 0 0 var(--accent)" : void 0,
              cursor: B ? "pointer" : "default"
            },
            onMouseEnter: (D) => {
              B && !z && (D.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (D) => {
              D.currentTarget.style.background = z ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ c("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: a.number != null ? `#${a.number}` : a.onOpen ? /* @__PURE__ */ o(rn, { size: 11, "aria-hidden": !0 }) : "☁" }),
                /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: a.title }),
                a.pulse && /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: a.attention ? A.you.color : A.building.color,
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
                    /* @__PURE__ */ o("span", { style: { color: A.building.color }, children: ho(a.live.at) }),
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
function mo({ width: e, items: t, repos: i, error: r, notice: s, selected: p, attention: d, spineSlot: f, onNew: h, onAddRepo: l, onRemoveRepo: u, onRestore: n, onSelect: a, onHide: S, onRemove: B, onCollapse: z }) {
  const [q, D] = O(""), [j, P] = O(null), [V, oe] = O(!0);
  F(() => {
    oe(!0);
  }, [p]);
  const [w, v] = O(null), W = ze(() => v(null), []), [Y, ie] = O(null), [he, ce] = O(fo);
  F(() => {
    localStorage.setItem(mn, JSON.stringify(he));
  }, [he]);
  const J = (y) => he[y] !== !1, fe = q.trim().toLowerCase(), te = yt(() => {
    const y = /* @__PURE__ */ new Map();
    for (const L of t ?? []) {
      const N = y.get(L.repo) ?? [];
      N.push(L), y.set(L.repo, N);
    }
    const E = (i ?? []).map((L) => L.slug);
    for (const L of y.keys()) E.includes(L) || E.push(L);
    return E.map((L) => {
      const N = (i ?? []).find(($) => $.slug === L) ?? { slug: L, path: "", hidden: [] }, se = y.get(L) ?? [], K = !fe || L.toLowerCase().includes(fe), I = K ? se : se.filter(($) => $.title.toLowerCase().includes(fe));
      return { meta: N, rows: I, show: !fe || K || I.length > 0 };
    }).filter((L) => L.show);
  }, [t, i, fe]);
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
                value: q,
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
                onClick: z,
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
          t !== null && !te.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "4px 6px" }, children: fe ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          te.map((y) => {
            const E = J(y.meta.slug) || !!fe, L = y.meta.slug.split("/").pop() ?? y.meta.slug;
            return /* @__PURE__ */ c("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ c(
                "div",
                {
                  onContextMenu: (N) => {
                    N.preventDefault(), ie({ slug: y.meta.slug, x: N.clientX, y: N.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => P(`repo:${y.meta.slug}`),
                  onPointerLeave: () => P((N) => N === `repo:${y.meta.slug}` ? null : N),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 6,
                    padding: "3px 4px",
                    background: j === `repo:${y.meta.slug}` ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ c(
                      "button",
                      {
                        type: "button",
                        onClick: () => ce((N) => ({ ...N, [y.meta.slug]: !E })),
                        "aria-expanded": E,
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
                            transform: E ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ o(on, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ o("span", { style: { fontSize: b.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: L }),
                          !E && (d ?? 0) > 0 && (p == null ? void 0 : p.startsWith(`${y.meta.slug}#`)) && /* @__PURE__ */ o(Ut, {}),
                          /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0 }, children: y.rows.length || (E ? "" : "0") })
                        ]
                      }
                    ),
                    (j === `repo:${y.meta.slug}` || (Y == null ? void 0 : Y.slug) === y.meta.slug) && /* @__PURE__ */ o(
                      "button",
                      {
                        type: "button",
                        "aria-label": `More for ${y.meta.slug}`,
                        "aria-haspopup": "menu",
                        title: "More",
                        onClick: (N) => {
                          N.stopPropagation();
                          const se = N.currentTarget.getBoundingClientRect();
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
              E && !y.rows.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              E && y.rows.length > 0 && /* @__PURE__ */ o("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: y.rows.map((N) => {
                const se = `${N.repo}#${N.number}`, K = se === p, I = K && !!f && V;
                return /* @__PURE__ */ c(
                  "div",
                  {
                    style: {
                      position: "relative",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "var(--bg)",
                      // The open map glows; the rest sit as quiet cards.
                      border: `1px solid ${K ? "var(--accent)" : "var(--border)"}`,
                      boxShadow: K ? "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)" : void 0
                    },
                    onContextMenu: ($) => {
                      $.preventDefault(), v({ key: se, item: N, x: $.clientX, y: $.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => P(se),
                    onPointerLeave: () => P(($) => $ === se ? null : $),
                    children: [
                      /* @__PURE__ */ c(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            K ? oe(($) => !$) : a(N);
                          },
                          "aria-current": K ? "page" : void 0,
                          "aria-expanded": K && f ? V : void 0,
                          title: K ? V ? "Fold this effort's stations away" : "Show this effort's stations" : void 0,
                          style: {
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 8px",
                            cursor: "pointer",
                            background: K ? "var(--bg-elevated)" : "transparent",
                            color: "var(--text)"
                          },
                          children: [
                            /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                              /* @__PURE__ */ o(vt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: I ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ c("span", { style: { ...K ? $e : {}, flex: 1, minWidth: 0, fontSize: b.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ c("span", { style: { ...G, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  N.number
                                ] }),
                                " ",
                                N.title
                              ] }),
                              K && !I && (d ?? 0) > 0 && /* @__PURE__ */ o(Ut, {})
                            ] }),
                            (() => {
                              var ne;
                              if (I)
                                return /* @__PURE__ */ c("div", { style: { ...G, fontSize: b.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(xt, { kind: N.kind, map: N.mapIssue }),
                                  /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: N.repo.split("/").pop() }),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: jt(N.updatedAt) })
                                ] });
                              const $ = (ne = N.frontier) != null && ne.stations ? io(N.frontier.stations) : null;
                              return /* @__PURE__ */ c(ve, { children: [
                                $ && /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(ro, { glance: $ }) }),
                                /* @__PURE__ */ c("div", { style: { ...G, fontSize: b.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(xt, { kind: N.kind, map: N.mapIssue }),
                                  !$ && /* @__PURE__ */ o(go, { stage: N.stage ?? Kn(N.column) }),
                                  /* @__PURE__ */ o(
                                    "span",
                                    {
                                      title: $ ? `${$.bits || $.front}

${dt.HITL}
${dt.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: $ ? $.bits || $.front : N.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: jt(N.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (j === se || K || (w == null ? void 0 : w.key) === se) && /* @__PURE__ */ o(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${N.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: ($) => {
                            $.stopPropagation();
                            const ne = $.currentTarget.getBoundingClientRect();
                            v({ key: se, item: N, x: ne.left, y: ne.bottom + 2, confirm: !1 });
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
                      I && /* @__PURE__ */ o("div", { ref: f, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  se
                );
              }) }),
              E && y.meta.hidden.length > 0 && /* @__PURE__ */ c(
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
        w && !w.confirm && /* @__PURE__ */ o(Kt, { x: w.x, y: w.y, onClose: W, items: [
          { label: "Open on GitHub", icon: Dt, onSelect: () => window.open(w.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: Mn, danger: !0, onSelect: () => v({ ...w, confirm: "hide" }) },
          ...w.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: Lt, danger: !0, onSelect: () => v({ ...w, confirm: "remove" }) }
          ]
        ] }),
        (w == null ? void 0 : w.confirm) === "hide" && /* @__PURE__ */ o(
          ft,
          {
            x: w.x,
            y: w.y,
            onClose: W,
            action: "Remove",
            title: `Remove "${w.item.title}" from the sidebar?`,
            onConfirm: () => S(w.item),
            children: w.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (w == null ? void 0 : w.confirm) === "remove" && /* @__PURE__ */ o(
          ft,
          {
            x: w.x,
            y: w.y,
            onClose: W,
            action: "Close it",
            title: `Close "${w.item.title}" as not planned?`,
            onConfirm: () => B(w.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        Y && !Y.confirm && /* @__PURE__ */ o(Kt, { x: Y.x, y: Y.y, onClose: () => ie(null), items: [
          { label: "Open on GitHub", icon: Dt, onSelect: () => window.open(`https://github.com/${Y.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: Lt, danger: !0, onSelect: () => ie({ ...Y, confirm: !0 }) }
        ] }),
        (Y == null ? void 0 : Y.confirm) && /* @__PURE__ */ o(
          ft,
          {
            x: Y.x,
            y: Y.y,
            onClose: () => ie(null),
            action: "Remove",
            title: `Remove ${Y.slug} from KiPo?`,
            onConfirm: () => u(Y.slug),
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
  const [i, r] = O(""), [s, p] = O(null), [d, f] = O(""), [h, l] = O(!1), [u, n] = O(!1), [a, S] = O("idea"), [B, z] = O(""), [q, D] = O(!1), [j, P] = O("");
  F(() => {
    pe.discoverRepos().then((v) => p(
      v.repos.filter((W) => W.slug && !W.worktree).sort((W, Y) => Number(Y.configured) - Number(W.configured) || W.name.localeCompare(Y.name))
    )).catch((v) => {
      P(Se(v)), p([]);
    });
  }, []);
  const V = (v) => {
    l(!1), f(v), s && !s.some((W) => W.path === v) && p([...s, { path: v, name: v.split("/").pop() || v, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, oe = async () => {
    const v = a === "issue" && B.trim() ? bo(B) : null;
    if (a === "issue" && B.trim() && v == null) {
      P("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !v) {
      P("Say what you want to do first.");
      return;
    }
    if (!d) {
      P("Choose which project this is for.");
      return;
    }
    D(!0), P("");
    try {
      e(await pe.startInitiative({
        path: d,
        description: i.trim() || `Issue #${v}`,
        start: a,
        worktree: u,
        sourceIssue: v
      }));
    } catch (W) {
      P(Se(W)), D(!1);
    }
  }, w = Qt.find((v) => v.id === a);
  return /* @__PURE__ */ c("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ c("div", { children: [
      /* @__PURE__ */ o("div", { style: { ...$e, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ o(qe, { children: j }),
    /* @__PURE__ */ c("label", { children: [
      st("What do you want to do?"),
      /* @__PURE__ */ o(
        "textarea",
        {
          value: i,
          onChange: (v) => r(v.target.value),
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
          onChange: (v) => v.target.value === "__pick" ? l(!0) : f(v.target.value),
          style: lt,
          disabled: s === null,
          children: [
            /* @__PURE__ */ o("option", { value: "", children: s === null ? "Looking for your projects…" : "Choose a project…" }),
            s == null ? void 0 : s.map((v) => /* @__PURE__ */ o("option", { value: v.path, children: v.slug ?? v.name }, v.path)),
            /* @__PURE__ */ o("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      d && /* @__PURE__ */ c("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(sn, { path: d }) }),
        /* @__PURE__ */ c("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: b.body }, children: [
          /* @__PURE__ */ o("input", { type: "checkbox", checked: u, onChange: (v) => n(v.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ c("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ o("span", { style: G, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      h && /* @__PURE__ */ o("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ o(ln, { busy: null, onAdd: V, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ c("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ o("legend", { style: { padding: 0 }, children: st("Where does this start?") }),
      /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: Qt.map((v) => {
        const W = a === v.id;
        return /* @__PURE__ */ c(
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
                  onChange: () => S(v.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ o("div", { style: { ...$e, fontSize: b.body }, children: v.title }),
              /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, marginTop: 3, lineHeight: 1.4 }, children: v.hint })
            ]
          },
          v.id
        );
      }) }),
      /* @__PURE__ */ c("div", { style: { ...G, fontSize: b.small, marginTop: 8 }, children: [
        "Starts with ",
        w.begins
      ] })
    ] }),
    a === "issue" && /* @__PURE__ */ c("label", { children: [
      st("Which issue? (optional)"),
      /* @__PURE__ */ o(
        "input",
        {
          value: B,
          onChange: (v) => z(v.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: lt
        }
      )
    ] }),
    /* @__PURE__ */ c("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ o(Ce, { primary: !0, disabled: q, onClick: oe, children: q ? "Starting…" : "Start the conversation" }),
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
    const S = je(a, i), B = S.length ? 1 + Math.max(...S.map((z) => p(i.get(z)))) : 0;
    return s.delete(a.number), r.set(a.number, B), B;
  };
  e.forEach(p);
  const d = e.length ? Math.max(...e.map((a) => r.get(a.number))) + 1 : 0, f = t ? [e.filter((a) => a.lane === "decide"), e.filter((a) => a.lane !== "decide")] : [e], h = /* @__PURE__ */ new Map(), l = [];
  let u = 0, n = null;
  return f.forEach((a, S) => {
    if (!a.length) return;
    t && S === 1 && u > 0 && (n = u, u += 0.6);
    let B = 0;
    const z = [];
    for (let q = 0; q < d; q++) {
      const D = a.filter((P) => r.get(P.number) === q), j = (P) => {
        const V = je(P, i).map((oe) => h.get(oe)).filter((oe) => oe !== void 0);
        return V.length ? V.reduce((oe, w) => oe + w, 0) / V.length : P.number / 1e3;
      };
      D.sort((P, V) => j(P) - j(V) || P.number - V.number), D.forEach((P, V) => h.set(P.number, u + V)), z.push(D), B = Math.max(B, D.length);
    }
    z.forEach((q, D) => {
      const j = (B - q.length) / 2;
      q.forEach((P, V) => {
        const oe = u + V + j;
        h.set(P.number, oe), l.push({ tile: P, col: D, row: oe });
      });
    }), u += B;
  }), { placed: l, cols: d, rows: u, split: n };
}
function ko({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: s, labeled: p, bands: d, highlight: f, dimOthers: h = !0, down: l }) {
  const u = ye(null), [n, a] = O(0), [S, B] = O(null);
  if (F(() => {
    const k = u.current;
    if (!k) return;
    const ee = new ResizeObserver(() => a(k.clientWidth));
    return ee.observe(k), a(k.clientWidth), () => ee.disconnect();
  }, []), !e.length) return null;
  const z = new Map(e.map((k) => [k.number, k])), q = /* @__PURE__ */ new Set();
  for (const k of e) for (const ee of je(k, z))
    q.add(ee), q.add(k.number);
  const D = e.length > 1 ? e.filter((k) => !q.has(k.number)) : [], j = D.length ? e.filter((k) => q.has(k.number)) : e, { placed: P, cols: V, rows: oe, split: w } = wo(j, !!d), v = 30, W = !!l && !d, Y = d ? 52 : 0, ie = W ? 12 : d ? 64 : p ? 40 : 48, he = i > 0 && !W ? Math.min(i, 4) : 0, ce = he ? ie + v : 0, J = W ? Math.max(1, oe) : V, fe = n && J ? Math.floor((n - 2 - 2 * Xt - Y - ce - (J - 1) * ie) / J) : 168, te = p ? Math.max(W ? 120 : 110, Math.min(d ? 240 : W ? 260 : 200, fe)) : v, y = v + 6, E = W ? 30 : p ? 10 : 8, L = j.length ? V : 0, N = W ? (j.length ? J * (te + ie) - ie : 0) + 2 : Y + (L ? L * (te + ie) - ie : 0) + ce + 2, se = w ?? oe, K = W ? L : Math.max(oe, he), I = (k) => 1 + k * (y + E), $ = j.length || he ? I(K) - E + 1 : 0, ne = new Map(P.map((k) => [k.tile.number, W ? { x: 1 + k.row * (te + ie), y: I(k.col) } : { x: Y + 1 + k.col * (te + ie), y: I(k.row) }])), Ae = /* @__PURE__ */ new Set();
  if (t != null) {
    Ae.add(t);
    const k = z.get(t);
    k && je(k, z).forEach((ee) => Ae.add(ee)), e.forEach((ee) => {
      je(ee, z).includes(t) && Ae.add(ee.number);
    });
  }
  const ge = S != null && z.has(S) ? new Set($t(e, S).map((k) => k.number)) : null, de = (k) => ge ? ge.has(k) : (f ? f.has(k) : !0) && (t == null || !h || Ae.has(k)), Ne = (k) => k.state === "you" || k.state === "afk", We = (k) => Ne(k) && k.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${A[k.state].color}` : void 0, we = [];
  for (const k of j) for (const ee of je(k, z)) we.push({ from: z.get(ee), to: k });
  const Pe = w != null ? I(w) + 0.3 * (y + E) - E / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ c("div", { ref: u, style: { overflowX: "auto", padding: Xt, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ c("div", { style: { position: "relative", width: N, height: $, minWidth: N }, children: [
        /* @__PURE__ */ c("svg", { width: N, height: $, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ o("defs", { children: /* @__PURE__ */ o("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ o("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          Pe != null && /* @__PURE__ */ o("line", { x1: 0, x2: N, y1: Pe, y2: Pe, stroke: "var(--border)", strokeDasharray: "2 4" }),
          we.map(({ from: k, to: ee }) => {
            const be = ne.get(k.number), Ie = ne.get(ee.number);
            if (!be || !Ie) return null;
            const Ge = k.state === "done", Oe = ge ? ge.has(k.number) && ge.has(ee.number) : t != null && (k.number === t || ee.number === t), He = ge ? !Oe : t != null && h && !Oe || !de(k.number) || !de(ee.number), Me = W ? (() => {
              const De = be.x + v / 2, Te = be.y + y + 2, ue = Ie.x + v / 2, Ee = Ie.y - 2, ke = (Te + Ee) / 2;
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
              `${k.number}-${ee.number}`
            );
          })
        ] }),
        d && P.length > 0 && ["decide", "deliver"].map((k) => {
          const ee = P.filter((Ie) => k === "decide" ? Ie.tile.lane === "decide" : Ie.tile.lane !== "decide").map((Ie) => Ie.row);
          if (!ee.length) return null;
          const be = (Math.min(...ee) + Math.max(...ee)) / 2;
          return /* @__PURE__ */ o("span", { style: { position: "absolute", left: 0, top: I(be) + y / 2 - 8, fontSize: b.tiny, fontWeight: 600, color: "var(--muted)" }, children: k === "decide" ? "Decide" : "Deliver" }, k);
        }),
        P.map(({ tile: k }) => {
          const ee = ne.get(k.number);
          return /* @__PURE__ */ c(
            "div",
            {
              onPointerEnter: () => B(k.number),
              onPointerLeave: () => B((be) => be === k.number ? null : be),
              style: {
                position: "absolute",
                left: ee.x,
                top: ee.y,
                width: te,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: de(k.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    title: We(k) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: We(k), display: "inline-flex" },
                    children: /* @__PURE__ */ o(_t, { tile: k, size: v, onClick: () => r(k), open: k.number === t, status: s == null ? void 0 : s[k.number] })
                  }
                ),
                p && /* @__PURE__ */ o(
                  "button",
                  {
                    type: "button",
                    onClick: () => r(k),
                    title: k.title,
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
                      fontWeight: k.number === t ? 600 : 400,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    },
                    children: k.title
                  }
                )
              ]
            },
            k.number
          );
        }),
        Array.from({ length: he }).map((k, ee) => /* @__PURE__ */ o(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: Y + 1 + L * (te + ie),
              top: I(Math.max(0, (se - he) / 2) + ee),
              width: v,
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
      D.length > 0 && /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: Y }, children: [
        /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        D.map((k) => /* @__PURE__ */ o("span", { style: { opacity: de(k.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: We(k) }, children: /* @__PURE__ */ o(_t, { tile: k, size: v, onClick: () => r(k), open: k.number === t, status: s == null ? void 0 : s[k.number] }) }, k.number))
      ] }),
      /* @__PURE__ */ c("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: b.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: Y }, children: [
        /* @__PURE__ */ c("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2" }) }),
          " still blocks"
        ] }),
        /* @__PURE__ */ c("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2", strokeDasharray: "3 3", opacity: ".6" }) }),
          " blocker closed"
        ] }),
        /* @__PURE__ */ c("span", { children: [
          /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, boxShadow: `0 0 0 1.5px ${A.you.color}`, marginRight: 5 } }),
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
  const [r, s] = O(null), [p, d] = O(""), f = ye(null), h = ye(!0);
  return F(() => {
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
  }, [e, t, i]), F(() => {
    var l;
    h.current && ((l = f.current) == null || l.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: A.building.color, flexShrink: 0 } }),
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
              /* @__PURE__ */ o("span", { style: { fontWeight: 700, color: l.role === "user" ? A.you.text : "var(--muted)" }, children: l.role === "user" ? "You" : "Agent" }),
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
  for (const I of (e == null ? void 0 : e.decisions) ?? []) I.answer && t && ut.delete(`${t}:${I.id}`);
  const f = i || !t ? [] : ((e == null ? void 0 : e.decisions) ?? []).filter((I) => ct(I) && !$o(t, I.id)), [h, l] = O({}), [u, n] = O({}), [a, S] = O(0), [B, z] = O(!1), [q, D] = O(!1), j = f.map((I) => I.id).join(","), P = ye(j);
  F(() => {
    P.current !== j && (P.current = j, S(0), l({}), n({}), j && D(!1));
  }, [j]);
  const V = ye(null), oe = ze((I) => {
    var ne;
    if ((ne = V.current) == null || ne.disconnect(), V.current = null, !I) {
      s == null || s(0);
      return;
    }
    const $ = () => s == null ? void 0 : s(I.offsetHeight);
    $(), V.current = new ResizeObserver($), V.current.observe(I);
  }, [s]);
  if (!f.length || !t) return null;
  if (q) return /* @__PURE__ */ c(
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
        border: `1px solid ${A.you.color}`,
        color: A.you.text,
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
  const w = Math.min(a, f.length - 1), v = f[w], W = f.filter((I) => (h[I.id] ?? "").trim()), Y = w === 0, ie = w === f.length - 1, ce = (h[v.id] ?? "") !== "" && !(v.options ?? []).includes(h[v.id] ?? "") || !!u[v.id], J = f.filter((I) => I.recommended), fe = (I) => l(($) => ({ ...$, [v.id]: I })), te = ye(null), y = () => {
    var I;
    B || (n(($) => ({ ...$, [v.id]: !0 })), l(($) => (v.options ?? []).includes($[v.id] ?? "") ? { ...$, [v.id]: "" } : $), (I = te.current) == null || I.focus());
  }, E = async (I = h) => {
    const $ = f.filter((de) => (I[de.id] ?? "").trim());
    if (!$.length) return;
    const ne = f.filter((de) => !(I[de.id] ?? "").trim()), Ae = $.map((de, Ne) => `${Ne + 1}. ${de.title} (${de.id}): ${I[de.id].trim()}`), ge = [
      `My answers to your ${$.length === 1 ? "question" : `${$.length} questions`}:`,
      "",
      ...Ae,
      "",
      ne.length ? `Still open, I'll answer later: ${ne.map((de) => de.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
    ].join(`
`);
    z(!0);
    try {
      await d.post("/api/chat?ws=1", { slot: t, message: ge });
      for (const de of $) ut.set(`${t}:${de.id}`, Date.now());
      l({}), S(0);
    } catch (de) {
      r(`Couldn't send your answers: ${Se(de)}`);
    } finally {
      z(!1);
    }
  }, L = () => {
    const I = { ...h };
    for (const $ of J) I[$.id] = $.recommended;
    l(I), E(I);
  }, N = (I) => /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${I ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: I && /* @__PURE__ */ o("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), se = (I) => {
    const $ = h[v.id] === I && !u[v.id];
    return /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": $,
        disabled: B,
        onClick: () => {
          n((ne) => ({ ...ne, [v.id]: !1 })), fe(I);
        },
        onMouseEnter: (ne) => {
          $ || (ne.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (ne) => {
          $ || (ne.currentTarget.style.background = "transparent");
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
          N($),
          /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0 }, children: I }),
          I === v.recommended && /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      I
    );
  }, K = (I, $, ne) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      disabled: $,
      onClick: ne,
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
      children: I
    }
  );
  return /* @__PURE__ */ c(
    "div",
    {
      ref: oe,
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
          /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: A.you.text }, children: f.length === 1 ? "Question" : `Question ${w + 1} of ${f.length}` }),
          f.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ o("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: f.map((I, $) => /* @__PURE__ */ o(
            "span",
            {
              title: I.title,
              onClick: () => S($),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (h[I.id] ?? "").trim() ? A.you.color : $ === w ? "var(--text)" : "var(--border)"
              }
            },
            I.id
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
        /* @__PURE__ */ o("div", { style: { ...$e, fontSize: b.body, marginBottom: 8, lineHeight: 1.4 }, children: v.title }),
        /* @__PURE__ */ c("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
          (v.options ?? []).map(se),
          /* @__PURE__ */ c(
            "div",
            {
              role: "radio",
              "aria-checked": ce,
              onClick: y,
              style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px", cursor: "text" },
              children: [
                N(ce),
                /* @__PURE__ */ o(
                  "input",
                  {
                    ref: te,
                    value: ce ? h[v.id] ?? "" : "",
                    onChange: (I) => fe(I.target.value),
                    onFocus: y,
                    disabled: B,
                    placeholder: "Something else…",
                    "aria-label": `Another answer to: ${v.title}`,
                    style: {
                      flex: 1,
                      minWidth: 0,
                      background: "var(--bg)",
                      color: "var(--text)",
                      fontSize: b.small,
                      border: `1px solid ${ce ? "var(--accent)" : "var(--border)"}`,
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
          f.length > 1 && K("‹ Back", Y, () => S(w - 1)),
          !ie && K("Next ›", !1, () => S(w + 1)),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          f.length > 1 && /* @__PURE__ */ c("span", { style: { ...G, fontSize: b.tiny }, children: [
            W.length,
            " of ",
            f.length,
            " answered"
          ] }),
          J.length > 0 && /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              disabled: B,
              onClick: L,
              title: f.length > 1 ? `Answer all ${J.length} with their recommendation and send` : "Take the recommendation and send",
              style: {
                background: "transparent",
                border: `1px solid ${A.you.color}`,
                borderRadius: 6,
                padding: "3px 10px",
                color: A.you.text,
                cursor: B ? "default" : "pointer",
                fontSize: b.small,
                whiteSpace: "nowrap",
                opacity: B ? 0.5 : 1
              },
              children: f.length > 1 ? "Accept all recommendations" : "Accept recommendation"
            }
          ),
          /* @__PURE__ */ o(Ce, { primary: !0, disabled: !W.length || B, onClick: () => void E(), children: B ? "Sending…" : W.length > 1 ? `Submit ${W.length} answers` : "Submit" })
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
  const [i, r] = O(null), [s, p] = O("");
  F(() => {
    let u = !0;
    return r(null), p(""), pe.ticket(e.repo, e.number, t.number).then((n) => {
      u && r(n);
    }).catch((n) => {
      u && p(Se(n));
    }), () => {
      u = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const d = e.prs.filter((u) => t.prs.includes(u.number)), f = t.state === "done", h = A[t.state];
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
      var n, a, S;
      return /* @__PURE__ */ c(
        "a",
        {
          href: u.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: b.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ o(Zt, { color: ((n = gt[u.state]) == null ? void 0 : n.color) ?? "var(--border)", text: ((a = gt[u.state]) == null ? void 0 : a.color) ?? "var(--muted)", children: ((S = gt[u.state]) == null ? void 0 : S.label) ?? u.state }),
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
    const S = a ? r[a] : void 0;
    if (S)
      return n.replace === S || a && f.has(a) ? S : null;
  }, l = (n, a) => a ? { ...n, replace: a } : n, u = (n) => (s.prs ?? []).some((a) => a.state === "OPEN" && ((a.tickets ?? []).includes(n) || (a.refs ?? []).includes(n)));
  for (const n of e) {
    const a = To(n);
    if (!(t(a) || p.includes(a))) {
      if (p.push(a), n.ticket != null) {
        const S = i.find((z) => z.number === n.ticket);
        if (!S) continue;
        const B = n.skill === "kipo-review";
        if ((S.state === "done" || S.state === "blocked") && !(B && u(S.number))) continue;
        if (B) {
          const z = h(n, `review-t${S.number}`);
          z !== null && d.push(l({ id: a, kind: "review", t: S.number }, z));
        } else {
          const z = h(n, S.sessionKey);
          z !== null && d.push(l({ id: a, kind: "tile", tile: S, skill: n.skill && !n.skill.startsWith("kipo-") ? n.skill : null }, z));
        }
      } else if (n.stage) {
        const S = h(n, n.stage);
        S !== null && d.push(l({ id: a, kind: "stage", column: n.stage, skill: n.skill && n.skill !== `kipo-${n.stage}` ? n.skill : null }, S));
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
  const l = Rt(), u = `effort:${e}#${t}`, [n, a] = O(() => tt(u)), [S, B] = O(""), [z, q] = O(""), [D, j] = O(() => tt(`${u}:focus`) ?? { kind: "column" });
  F(() => {
    nt(`${u}:focus`, D);
  }, [u, D]);
  const [P, V] = O(!1), [oe, w] = O(!1), v = Fn("chain", 100, 0.75), W = ze(() => {
    pe.getInitiative(e, t).then((g) => {
      a(g), nt(u, g), B("");
    }).catch((g) => B(Se(g)));
  }, [e, t, u]);
  F(() => {
    if (W(), !i) return;
    const g = setInterval(W, 5e3);
    return () => clearInterval(g);
  }, [W, i]);
  const Y = n == null ? void 0 : n.column;
  F(() => {
    q("");
  }, [Y, D]);
  const ie = ye(Y);
  F(() => {
    if (Y === void 0 || ie.current === Y) {
      ie.current = Y;
      return;
    }
    const g = ie.current !== void 0;
    ie.current = Y, g && j({ kind: "column" });
  }, [Y]);
  const he = n ? mt(D) : null, ce = n && he ? n.sessions[he] ?? null : null, J = ce && !Fe(ce) ? ce : null, fe = n && D.kind === "ticket" ? n.tickets.find((g) => g.number === D.t) ?? null : null, te = async (g = null, x, Q = !0, H = !1) => {
    if (!n) return;
    const T = x ?? D;
    V(!0), q("");
    try {
      const M = T.kind === "ticket" ? { column: "build", ticket: T.t, skill: g ?? "implement" } : T.kind === "spec" ? { column: "build", mode: "implement-spec", skill: g ?? "implement-spec" } : T.kind === "decision" ? { column: "shape", ticket: T.t, skill: g } : T.kind === "review" ? { column: "review", ticket: T.t, skill: g } : T.kind === "stage" ? { column: T.column, skill: g } : { column: n.column, mode: "conductor" }, R = await pe.startSession(e, t, H ? { ...M, replace: !0 } : M), C = T.kind === "ticket" ? `${n.title}: #${T.t}` : T.kind === "spec" ? `${n.title}: implement-spec` : T.kind === "decision" ? `${n.title}: decision #${T.t}` : T.kind === "review" ? `${n.title}: review #${T.t}` : T.kind === "stage" ? `${n.title}: ${kt[T.column]}` : `${n.title}: conductor`;
      R.existing ? await l.post("/api/chat?ws=1", { slot: R.slotName, message: R.seed }) : await to(l, e, R.slotName, R.seed, C, R.agent), R.key && await pe.sessionStarted(e, t, R.key).catch(() => pe.sessionStarted(e, t, R.key)).catch(() => {
      }), x && Q && j(x), Q && (W(), f());
    } catch (M) {
      q(
        M instanceof wt && M.code === "ticket_blocked" ? M.message : `Couldn't start the conversation: ${Se(M)}`
      );
    } finally {
      V(!1);
    }
  }, y = (g) => g.lane === "deliver" ? { kind: "ticket", t: g.number } : { kind: "decision", t: g.number }, E = (g) => g.lane === "deliver" ? "implement" : g.type === "research" ? "research" : g.type === "prototype" ? "prototype" : g.type === "issue" ? "triage" : null, [L, N] = O(null), se = (g) => {
    j(y(g));
  }, K = n != null && n.frontier && (D.kind === "ticket" || D.kind === "decision") ? n.frontier.tiles.find((g) => g.number === D.t) ?? null : null, [I, $] = O({}), [ne, Ae] = O({}), [ge, de] = O(null);
  F(() => {
    let g = !0;
    const x = () => (it(), l.get("/api/chat/slots").then((H) => {
      g && Array.isArray(H) && de(new Set(H.filter((T) => T.key).map((T) => T.key)));
    }).catch(() => {
    }));
    if (x(), !i) return () => {
      g = !1;
    };
    const Q = setInterval(x, 5e3);
    return () => {
      g = !1, clearInterval(Q);
    };
  }, [l, i]);
  const Ne = J && !(ge !== null && !ge.has(J)) ? J : null;
  F(() => {
    Lo(Ne);
  }, [Ne]);
  const We = yt(
    () => {
      var g;
      return (((g = n == null ? void 0 : n.frontier) == null ? void 0 : g.tiles) ?? []).filter((x) => x.sessionKey && (n == null ? void 0 : n.sessions[x.sessionKey]));
    },
    [n]
  );
  F(() => {
    if (!We.length) {
      $({}), Ae({});
      return;
    }
    let g = !0;
    const x = (T) => {
      const M = (T == null ? void 0 : T.content) ?? (T == null ? void 0 : T.text), R = typeof M == "string" ? M : Array.isArray(M) ? M.map((X) => typeof X == "string" ? X : (X == null ? void 0 : X.text) ?? "").join(" ") : null, C = R == null ? void 0 : R.replace(/\s+/g, " ").trim();
      return C ? C.slice(0, 140) : null;
    }, Q = async () => {
      let T = /* @__PURE__ */ new Map();
      try {
        const M = await l.get("/api/chat/slots");
        g && Array.isArray(M) && (T = new Map(M.filter((R) => R.key).map((R) => [R.key, R])));
      } catch {
      }
      Promise.all(We.map((M) => {
        const R = n.sessions[M.sessionKey], C = T.get(R);
        return l.get(`/api/chat/slots/${encodeURIComponent(R)}?limit=1`).then((X) => {
          var Mt;
          const Be = (Mt = X == null ? void 0 : X.messages) == null ? void 0 : Mt[X.messages.length - 1], le = (C == null ? void 0 : C.pending_approval) ?? (X == null ? void 0 : X.pending_approval), _e = (C == null ? void 0 : C.needs_input) ?? (X == null ? void 0 : X.needs_input), Rn = (C == null ? void 0 : C.running) ?? (X == null ? void 0 : X.running), Ht = le ? "approval" : _e ? "input" : null, Cn = { at: (Be == null ? void 0 : Be.ts) ?? null, line: Be && Be.role !== "user" ? x(Be) : null, needs: Ht }, Tn = Ht ? "attention" : Rn ? "running" : M.state === "done" ? null : "waiting";
          return [M.number, Tn, Cn];
        }).catch(() => null);
      })).then((M) => {
        if (!g) return;
        const R = {}, C = {};
        for (const X of M)
          X && (X[1] && (R[X[0]] = X[1]), C[X[0]] = X[2]);
        $(R), Ae(C);
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
    var M, R, C, X, Be;
    if (!n) return [];
    const g = (le) => ((le == null ? void 0 : le.decisions) ?? []).filter(ct).length, x = /* @__PURE__ */ new Set(), Q = [], H = (le) => {
      const _e = mt(le);
      x.has(_e) || (x.add(_e), Q.push(le));
    }, T = (le) => {
      var _e;
      return (_e = le.sessionKey) != null && _e.startsWith("review-t") ? { kind: "review", t: le.number } : le.lane === "deliver" ? { kind: "ticket", t: le.number } : { kind: "decision", t: le.number };
    };
    g(((M = n.sessionStates) == null ? void 0 : M.conductor) ?? n.state) && H({ kind: "column" });
    for (const le of ((R = n.frontier) == null ? void 0 : R.tiles) ?? [])
      le.state === "done" || !le.sessionKey || (g((C = n.sessionStates) == null ? void 0 : C[le.sessionKey]) || I[le.number] === "attention" || le.state === "you") && H(T(le));
    for (const le of ["plan", "review", "done", "intake", "shape", "grill"])
      n.sessions[le] && g((X = n.sessionStates) == null ? void 0 : X[le]) && H({ kind: "stage", column: le });
    return n.sessions["build-spec"] && g((Be = n.sessionStates) == null ? void 0 : Be["build-spec"]) && H({ kind: "spec" }), Q;
  }, [n, I]), Pe = we.length;
  F(() => {
    h == null || h(Pe);
  }, [Pe, h]), F(() => () => {
    h == null || h(0);
  }, [h]);
  const k = async (g) => {
    for (let x = 0; x < g.length; x++)
      N(`Starting ${x + 1} of ${g.length}…`), await te(E(g[x]), y(g[x]), !1);
    N(null), W(), f();
  }, ee = `kipo.autopilot:${e}#${t}`, [be, Ie] = O(() => localStorage.getItem(ee) === "1"), Ge = (g) => {
    Ie(g), localStorage.setItem(ee, g ? "1" : "0");
  }, Oe = ye(/* @__PURE__ */ new Set());
  F(() => {
    if (!be || !i || L || !(n != null && n.frontier)) return;
    const g = n.frontier.tiles.filter((x) => x.lane === "deliver" && x.state === "afk" && !x.sessionKey && !Oe.current.has(x.number));
    g.length && (g.forEach((x) => Oe.current.add(x.number)), k(g));
  }, [be, i, L, n]);
  const He = `kipo.dispatched:${e}#${t}`, Me = ye(/* @__PURE__ */ new Set()), De = (g) => {
    Me.current.delete(g);
    try {
      const x = JSON.parse(localStorage.getItem(He) || "[]");
      localStorage.setItem(He, JSON.stringify(x.filter((Q) => Q !== g)));
    } catch {
    }
  };
  F(() => {
    var T, M;
    if (!i || P || L || !(n != null && n.frontier)) return;
    const g = ((M = (T = n.sessionStates) == null ? void 0 : T.conductor) == null ? void 0 : M.dispatch) ?? [];
    let x = [];
    try {
      x = JSON.parse(localStorage.getItem(He) || "[]");
    } catch {
      x = [];
    }
    const { fresh: Q, starts: H } = zo(
      g,
      (R) => x.includes(R) || Me.current.has(R),
      n.frontier.tiles,
      n.sessions,
      { prs: [...n.prs, ...n.refPrs ?? []], unstarted: Go(n) }
    );
    if (Q.length) {
      for (const R of Q)
        Me.current.add(R), x.push(R);
      try {
        localStorage.setItem(He, JSON.stringify(x.slice(-300)));
      } catch {
      }
      H.length && (async () => {
        for (const R of H) {
          if (R.replace && !nn(n, R.replace) && !await Ft(l, R.replace)) {
            De(R.id);
            continue;
          }
          const C = !!R.replace;
          R.kind === "tile" ? await te(R.skill ?? E(R.tile), y(R.tile), !1, C) : R.kind === "review" ? await te(null, { kind: "review", t: R.t }, !1, C) : await te(R.skill, { kind: "stage", column: R.column }, !1, C);
        }
        W(), f();
      })();
    }
  }, [i, P, L, n]);
  const Te = `kipo.restarted:${e}#${t}`;
  F(() => {
    if (!i || P || L || !(n != null && n.closing)) return;
    let g = [];
    try {
      g = JSON.parse(localStorage.getItem(Te) || "[]");
    } catch {
      g = [];
    }
    const Q = n.closing.filter((M) => M.started === !1 && M.key !== "conductor" && !g.includes(M.slot)).map((M) => [M, Ko(M.key)]).find(([, M]) => M);
    if (!Q) return;
    const [H, T] = Q;
    try {
      localStorage.setItem(Te, JSON.stringify([...g, H.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var R;
      if (!nn(n, H.slot) && !await Ft(l, H.slot)) return;
      const M = (R = n.frontier) == null ? void 0 : R.tiles.find((C) => (T.kind === "ticket" || T.kind === "decision") && C.number === T.t);
      await te(M ? E(M) : null, T, !1, !0), W(), f();
    })();
  }, [i, P, L, n]);
  const ue = n != null && n.sessions.conductor && !Fe(n.sessions.conductor) ? n.sessions.conductor : null, Ee = ((n == null ? void 0 : n.closing) ?? []).filter((g) => {
    var x;
    return ((x = g.stall) == null ? void 0 : x.state) === "stuck";
  }).map((g) => g.key), ke = n != null && n.frontier ? JSON.stringify({
    t: n.frontier.tiles.map((g) => [g.number, g.state]),
    p: n.prs.map((g) => [g.number, g.state]),
    ...Ee.length ? { s: Ee } : {}
  }) : "";
  F(() => {
    if (!ke || !ue || !i) return;
    const g = `kipo.conductorSaw:${e}#${t}`, x = localStorage.getItem(g);
    if (x === ke) return;
    if (x === null) {
      localStorage.setItem(g, ke);
      return;
    }
    const Q = [];
    try {
      const H = JSON.parse(x), T = JSON.parse(ke), M = new Map(H.t), R = new Map(H.p);
      for (const [C, X] of T.t) M.get(C) !== X && Q.push(`#${C} ${M.get(C) ?? "new"} → ${X}`);
      for (const [C, X] of T.p) R.get(C) !== X && Q.push(`PR #${C} ${(R.get(C) ?? "new").toLowerCase()} → ${X.toLowerCase()}`);
      for (const C of T.s ?? []) (H.s ?? []).includes(C) || Q.push(`${C} stuck (woken twice, no answer)`);
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
  }, [ke, ue, i]), F(() => {
    const g = n == null ? void 0 : n.reports;
    if (!g || !ue || !i) return;
    const x = `kipo.reportsSent:${e}#${t}`, Q = Number(localStorage.getItem(x) || "0"), H = g.reports.filter((T) => T.id > Math.max(Q, g.read));
    H.length && (async () => {
      try {
        const T = await l.get(`/api/chat/slots/${encodeURIComponent(ue)}?limit=1`);
        if (T != null && T.running) return;
        const M = (C) => {
          var X;
          return `${C.event}: ${C.text}${(X = C.items) != null && X.length ? ` (${C.items.join("; ")})` : ""}`;
        }, R = H.length === 1 ? `[KiPo] Report from ${H[0].from}: ${M(H[0])}` : `[KiPo] Reports from the sessions:
${H.slice(-12).map((C) => `- ${C.from} ${M(C)}`).join(`
`)}`;
        await l.post("/api/chat?ws=1", { slot: ue, message: `${R}
Run the frontier and carry on.` }), localStorage.setItem(x, String(H[H.length - 1].id));
      } catch {
      }
    })();
  }, [n, ue, i]);
  const Je = (g, x) => {
    if (n) {
      if (n.sessions[g]) {
        j({ kind: "stage", column: g });
        return;
      }
      te(x, { kind: "stage", column: g });
    }
  }, rt = () => Je("plan", "to-spec"), m = () => Je("review", null), Z = () => Je("done", "retro"), U = async () => {
    if (n) {
      w(!0), q("");
      try {
        n.column !== "done" && await pe.advance(e, t, !0, "done"), await pe.advance(e, t, !0, null), await Yt(l, Object.values(n.sessions), null), d();
      } catch (g) {
        q(`Couldn't close it: ${Se(g)}`), w(!1);
      }
    }
  }, _ = ye(!1);
  F(() => {
    if (!(n != null && n.closing) || !i || _.current) return;
    const g = n.closing.filter((x) => x.status === "closable");
    g.length && (_.current = !0, Yt(l, g.map((x) => x.slot), J).then((x) => {
      const Q = g.filter((H) => x.includes(H.slot)).map((H) => H.key);
      return Q.length ? pe.sessionsClosed(e, t, Q).then(() => W()) : void 0;
    }).catch(() => {
    }).finally(() => {
      _.current = !1;
    }));
  }, [l, n, i, J]);
  const Ke = JSON.stringify(Wo((n == null ? void 0 : n.closing) ?? []).filter((g) => !Fe(g.slot)).map((g) => [g.key, g.slot]));
  F(() => {
    const g = JSON.parse(Ke);
    if (!i || !g.length) return;
    let x = !0;
    const Q = () => {
      Promise.all(g.map(
        ([T, M]) => l.get(`/api/chat/slots/${encodeURIComponent(M)}?limit=1`).then((R) => [T, Eo(R)]).catch(() => null)
      )).then((T) => {
        if (!x) return;
        const M = Object.fromEntries(T.filter((R) => R && R[1]).map((R) => [R[0], R[1]]));
        Object.keys(M).length && pe.sessionsActivity(e, t, M).catch(() => {
        });
      });
    };
    Q();
    const H = setInterval(Q, 3e4);
    return () => {
      x = !1, clearInterval(H);
    };
  }, [l, Ke, i, e, t]);
  const xe = `kipo.woke:${e}#${t}`, Le = `kipo.wokeNotes:${e}#${t}`, Ue = ye(!1);
  F(() => {
    if (!(n != null && n.closing) || !i || Ue.current) return;
    let g = [];
    try {
      g = JSON.parse(localStorage.getItem(xe) || "[]");
    } catch {
      g = [];
    }
    let x = [];
    try {
      x = JSON.parse(localStorage.getItem(Le) || "[]");
    } catch {
      x = [];
    }
    const Q = Ho(n.closing, J, (H) => g.includes(H)).filter((H) => !Fe(H.slot));
    !Q.length && !(x.length && ue) || (Ue.current = !0, (async () => {
      for (const H of Q) {
        const T = H.stall;
        try {
          const M = await l.get(`/api/chat/slots/${encodeURIComponent(H.slot)}?limit=1`);
          if (M != null && M.running) continue;
          await l.post("/api/chat?ws=1", { slot: H.slot, message: Ao(T.why) }), g = [...g, `${H.key}/${T.id}`].slice(-300), localStorage.setItem(xe, JSON.stringify(g)), x = [...x, Oo(H.key, T.why)], localStorage.setItem(Le, JSON.stringify(x)), await pe.sessionsWoken(e, t, H.key, T.id ?? "", T.why);
        } catch {
        }
      }
      if (x.length && ue)
        try {
          const H = await l.get(`/api/chat/slots/${encodeURIComponent(ue)}?limit=1`);
          H != null && H.running || (await l.post("/api/chat?ws=1", { slot: ue, message: `${x.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(Le, "[]"));
        } catch {
        }
      Q.length && W();
    })().finally(() => {
      Ue.current = !1;
    }));
  }, [l, n, i, J, ue]);
  const ae = ye(!1);
  if (F(() => {
    !r || ae.current || !n || (ae.current = !0, n.sessions[n.column] || te());
  }, [r, n]), !n)
    return /* @__PURE__ */ o("div", { style: { flex: 1, padding: 24 }, children: S ? /* @__PURE__ */ o(qe, { children: S }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.body }, children: "Loading…" }) });
  const me = he ? ((Wt = n.sessionStates) == null ? void 0 : Wt[he]) ?? null : n.state, Qe = (me == null ? void 0 : me.skillsUsed) ?? [], pt = () => {
    if (!we.length) return;
    const g = we.findIndex((x) => mt(x) === he);
    j(we[(g + 1) % we.length]);
  }, At = ye(null), bn = () => {
    var g, x;
    try {
      (x = (g = At.current) == null ? void 0 : g.contentWindow) == null || x.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [Ve, vn] = O(!1), [Ot, wn] = O(0), kn = ze((g) => wn((x) => Math.abs(x - g) > 4 ? g : x), []), [Et, xn] = O(128), Sn = ze((g) => xn((x) => Math.abs(x - g) > 4 ? g : x), []), $n = K ? K.state === "done" : !!ce && Fe(ce), In = D.kind === "column" ? me ?? n.state : me;
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
    z && /* @__PURE__ */ o("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ o(qe, { children: z }) }),
    (() => {
      var R;
      const g = /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ o("span", { style: { ...J ? G : $e, fontSize: J ? b.small : b.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: K ? `#${K.number}${J ? "" : ` ${K.title}`}` : D.kind === "column" ? "Conductor" : n.title }),
        J && Qe.length > 0 && /* @__PURE__ */ o(qo, { skills: Qe }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        K && (n.frontier ? $t(n.frontier.tiles, K.number).length > 1 : !1) && /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: () => vn((C) => !C),
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
            onMouseEnter: (C) => {
              C.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))", C.currentTarget.style.color = "var(--text)";
            },
            onMouseLeave: (C) => {
              C.currentTarget.style.background = "transparent", C.currentTarget.style.color = "var(--muted)";
            },
            children: /* @__PURE__ */ o(Pn, { size: 15 })
          }
        )
      ] }), x = K && (K.state === "you" || K.state === "afk"), Q = !!J && ge !== null && !ge.has(J), H = J && Q ? /* @__PURE__ */ o(So, { slot: J, active: i, ended: !0 }) : J ? (
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
      ) : K ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          x && /* @__PURE__ */ c("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ o(Ce, { primary: !0, disabled: P, onClick: () => te(E(K)), children: P ? "Starting…" : ((R = yn[K.type]) == null ? void 0 : R.action) ?? "Start this ticket" }),
            tn(K, null).map((C) => /* @__PURE__ */ c(
              "button",
              {
                type: "button",
                disabled: P,
                onClick: () => te(C.skill),
                title: Ct[C.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: P ? "default" : "pointer", fontSize: b.small },
                children: [
                  "/",
                  C.skill,
                  " ",
                  /* @__PURE__ */ o("span", { style: G, children: C.label })
                ]
              },
              C.skill
            ))
          ] }),
          /* @__PURE__ */ o(Co, { detail: n, tile: K })
        ] })
      ) : /* @__PURE__ */ o(
        jo,
        {
          detail: n,
          focus: D,
          ticket: fe,
          tile: null,
          starting: P,
          onStart: () => te(null),
          alternatives: tn(null, D.kind === "column" ? n.column : null),
          onSkill: (C) => te(C)
        }
      ), T = K && n.frontier ? $t(n.frontier.tiles, K.number) : [], M = s ? Dn(
        /* @__PURE__ */ o(
          co,
          {
            detail: n,
            statuses: I,
            activity: ne,
            busy: oe || P || !!L,
            autopilot: be,
            selectedKey: he,
            embedded: !0,
            compact: p,
            onAutopilot: Ge,
            onOpenTile: se,
            onOpenConversation: (C) => j(C === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(C) ? { kind: "review", t: Number(C.slice(8)) } : { kind: "stage", column: C }),
            onSelectConductor: () => j({ kind: "column" }),
            onJumpQuestions: pt,
            onHandover: rt,
            onReview: m,
            onRetro: Z,
            onClose: U
          }
        ),
        s
      ) : null;
      return /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        M,
        /* @__PURE__ */ c("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          g,
          K && T.length > 1 && Ve && /* @__PURE__ */ c(ve, { children: [
            /* @__PURE__ */ c("div", { ref: v.ref, style: { ...v.style }, children: [
              /* @__PURE__ */ o("div", { style: { padding: "6px 16px 0", fontSize: b.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ o(ko, { tiles: T, focus: K.number, onOpen: se, labeled: !0, dimOthers: !1, statuses: I, down: !0 })
            ] }),
            /* @__PURE__ */ o(
              dn,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: v.onDrag,
                onReset: v.reset
              }
            )
          ] }),
          /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            H,
            /* @__PURE__ */ o(Io, { state: In, slotKey: J, settled: $n, onError: q, onSize: kn, bottomOffset: Et + 10 }, J ?? "none")
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
        const z = u.querySelector('[data-testid="composer-dock-root"]') ?? u.querySelector('[data-testid="composer-dock"]'), q = z ? Math.round(z.getBoundingClientRect().height) : 0;
        q > 0 && r(q);
      }
      let S = p.current;
      if (!S || !S.isConnected || S.ownerDocument !== u) {
        const z = u.defaultView;
        S = [...u.querySelectorAll("div")].filter((D) => {
          if (D.clientHeight < 200) return !1;
          const j = z == null ? void 0 : z.getComputedStyle(D);
          return !!j && (j.overflowY === "auto" || j.overflowY === "scroll");
        }).sort((D, j) => j.clientHeight - D.clientHeight)[0] ?? null, p.current = S;
      }
      if (!S) return;
      const B = d.current ? `${d.current}px` : "";
      S.style.paddingBottom !== B && (S.style.paddingBottom = B);
    } catch {
    }
  }, [t]);
  F(() => {
    f();
  }, [f, i]), F(() => {
    en(e);
  }, [e]), F(() => {
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
        const S = a.createElement("style");
        S.id = "kipo-popout-css", S.textContent = [
          '[title*="main window" i]',
          '[aria-label*="main window" i]',
          '[title*="split view" i]',
          '[aria-label*="split view" i]',
          '[aria-label="Close panel"]',
          '[title="Close panel"]'
        ].join(",") + "{display:none !important}", a.head.appendChild(S);
      }
    } catch {
    }
  };
  return F(() => {
    const l = [], u = window.setInterval(() => {
      var a;
      const n = t.current;
      try {
        const S = (a = n == null ? void 0 : n.contentWindow) == null ? void 0 : a.location.pathname;
        if (n && S && !S.startsWith("/popout/chat")) {
          const z = Date.now();
          for (; l.length && z - l[0] > 6e5; ) l.shift();
          l.length < 5 && (l.push(z), en(e), n.src = s);
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
  const e = zn(), t = (e == null ? void 0 : e.active) !== !1, i = Rt(), [r, s] = O(() => tt("initiatives")), [p, d] = O(() => tt("repos")), [f, h] = O(!1), [l, u] = O(""), [n, a] = O(() => {
    const y = tt("main");
    return !y || !["new", "initiative"].includes(y.kind) ? null : y.kind === "initiative" ? { ...y, autoStart: void 0 } : y;
  });
  F(() => {
    n && nt("main", n);
  }, [n]);
  const [S, B] = cn("rail", 300, 168, 620), [z, q] = O(null), [D, j] = O(() => localStorage.getItem("kipo.railOpen") !== "0"), P = (y) => {
    j(y), localStorage.setItem("kipo.railOpen", y ? "1" : "0");
  };
  F(() => {
    Xn(i).catch(() => {
    });
  }, [i]);
  const [V, oe] = O(""), w = ze(() => {
    pe.listInitiatives().then((y) => {
      var E;
      s(y.initiatives), nt("initiatives", y.initiatives), d(y.repos ?? []), nt("repos", y.repos ?? []), u(""), oe((E = y.errors) != null && E.length ? `GitHub is refusing calls for ${y.errors.length === 1 ? y.errors[0].repo.split("/").pop() : `${y.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch((y) => u(Se(y)));
  }, []);
  F(() => {
    if (w(), !t) return;
    const y = setInterval(w, 15e3);
    return () => clearInterval(y);
  }, [w, t]), F(() => {
    if (r === null) return;
    const y = (n == null ? void 0 : n.kind) === "initiative" && !r.some((L) => L.repo === n.repo && L.number === n.number);
    if (n && !y) return;
    const E = r[0];
    a(E ? { kind: "initiative", repo: E.repo, number: E.number } : { kind: "new" });
  }, [r, n]);
  const v = (y, E) => a({ kind: "initiative", repo: y.repo, number: y.number, autoStart: E }), W = (y) => {
    s((E) => (E ?? []).filter((L) => !(L.repo === y.repo && L.number === y.number))), pe.hide(y.repo, y.number).then(w).catch((E) => {
      u(Se(E)), w();
    });
  }, Y = (y) => {
    s((E) => (E ?? []).filter((L) => !(L.repo === y.repo && L.number === y.number))), pe.removeInitiative(y.repo, y.number).then(w).catch((E) => {
      u(Se(E)), w();
    });
  }, ie = (y) => {
    d((E) => (E ?? []).filter((L) => L.slug !== y)), s((E) => (E ?? []).filter((L) => L.repo !== y)), pe.removeRepo(y).then(w).catch((E) => {
      u(Se(E)), w();
    });
  }, he = (y, E) => {
    Promise.allSettled(E.map((L) => pe.unhide(y, L))).then(w);
  }, ce = (n == null ? void 0 : n.kind) === "initiative" ? `${n.repo}#${n.number}` : null, [J, fe] = O(0), te = ze((y) => fe(y), []);
  return /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    D ? /* @__PURE__ */ c(ve, { children: [
      /* @__PURE__ */ o(
        mo,
        {
          width: S,
          onCollapse: () => P(!1),
          items: r,
          repos: p,
          error: l,
          notice: V,
          selected: ce,
          attention: J,
          spineSlot: q,
          onNew: () => a({ kind: "new" }),
          onAddRepo: () => h(!0),
          onRemoveRepo: ie,
          onRestore: he,
          onSelect: (y) => v(y),
          onHide: W,
          onRemove: Y
        }
      ),
      /* @__PURE__ */ o(dn, { direction: "vertical", label: "Resize the effort list", onDrag: (y) => B((E) => E + y), onReset: () => B(228) })
    ] }) : /* @__PURE__ */ o(
      yo,
      {
        items: r,
        selected: ce,
        attention: J,
        onNew: () => a({ kind: "new" }),
        onSelect: (y) => v(y),
        onExpand: () => P(!0)
      }
    ),
    /* @__PURE__ */ c("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (n == null ? void 0 : n.kind) === "new" && /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ o(
        vo,
        {
          onStarted: (y) => {
            w(), v(y, !0);
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
          spineHost: D ? z : null,
          spineCompact: S < 340,
          onChanged: w,
          onRemoved: () => {
            w(), a(null);
          },
          onNeeds: te
        },
        `${n.repo}#${n.number}`
      )
    ] }),
    f && /* @__PURE__ */ o(_n, { onAdded: w, onClose: () => h(!1) })
  ] });
}
export {
  Xo as default
};
