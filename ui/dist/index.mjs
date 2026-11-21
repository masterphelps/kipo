import { jsxs as c, jsx as o, Fragment as me } from "react/jsx-runtime";
import { useAppApi as xt, useAppInfo as zn } from "@kirocrew/app-sdk";
import { useState as E, useCallback as Re, useEffect as K, useRef as pe, useLayoutEffect as An, useMemo as rt } from "react";
import { Btn as Ie, Badge as Et, MarkdownRenderer as ft } from "@kirocrew/app-sdk/ui";
import { X as On, FolderGit2 as en, FolderOpen as En, MessageSquare as tn, ChevronRight as gt, Plus as Wn, FolderPlus as Mn, MoreHorizontal as Wt, ExternalLink as Mt, EyeOff as Hn, Trash2 as Ht, Map as Nn, PanelRight as Pn } from "lucide-react";
import { createPortal as Dn } from "react-dom";
const Ln = "/apps/kipo/api";
class mt extends Error {
  constructor(t, i, r) {
    super(i), this.name = "BackendError", this.status = t, this.code = r;
  }
}
async function ie(e, t = "GET", i) {
  let r;
  try {
    r = await fetch(`${Ln}${e}`, {
      method: t,
      credentials: "include",
      headers: i === void 0 ? void 0 : { "Content-Type": "application/json" },
      body: i === void 0 ? void 0 : JSON.stringify(i)
    });
  } catch {
    throw new mt(0, "Couldn't reach the KiPo backend. Is the app running?", null);
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
    throw new mt(r.status, f, typeof d.code == "string" ? d.code : null);
  }
  return p;
}
const $e = (e, t) => {
  const [i, r] = e.split("/");
  return `/initiatives/${encodeURIComponent(i)}/${encodeURIComponent(r)}/${t}`;
}, ce = {
  getConfig: () => ie("/config"),
  putConfig: (e) => ie("/config", "PUT", e),
  discoverRepos: () => ie("/repos/discover"),
  addRepo: (e) => ie("/repos", "POST", { path: e }),
  removeRepo: (e) => ie("/repos/remove", "POST", { slug: e }),
  browse: (e) => ie(e ? `/browse?path=${encodeURIComponent(e)}` : "/browse"),
  listInitiatives: () => ie("/initiatives"),
  startInitiative: (e) => ie("/initiatives", "POST", e),
  getInitiative: (e, t) => ie($e(e, t)),
  // Next along the path, or `to` a later column.
  advance: (e, t, i, r = null) => ie(`${$e(e, t)}/advance`, "POST", { force: i, to: r }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (e, t, i) => ie(`${$e(e, t)}/session`, "POST", { skill: null, ticket: null, mode: null, ...i }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (e, t, i) => ie(`${$e(e, t)}/sessions/started`, "POST", { key: i }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (e, t, i) => ie(`${$e(e, t)}/sessions/closed`, "POST", { keys: i }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (e, t, i) => ie(`${$e(e, t)}/sessions/activity`, "POST", { activity: i }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (e, t, i, r, s) => ie(`${$e(e, t)}/sessions/woken`, "POST", { key: i, stall: r, why: s }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (e, t, i) => ie(`${$e(e, t)}/skill`, "POST", { skill: i }),
  listSessions: () => ie("/sessions"),
  tree: (e = !1) => ie(e ? "/tree?completed=1" : "/tree"),
  // A background session's recent transcript, when the dashboard never opened
  // it as a page (so the embedded chat would be empty).
  sessionTail: (e, t = 60) => ie(
    `/sessions/tail?slot=${encodeURIComponent(e)}&limit=${t}`
  ),
  // The green dot: on the sidebar or off. Nothing changes on GitHub.
  setOnSidebar: (e, t, i, r) => ie("/sidebar", "POST", { repo: e, number: t, kind: i, on: r }),
  // Off the sidebar and back; nothing changes on GitHub.
  hide: (e, t) => ie(`${$e(e, t)}/hide`, "POST", {}),
  unhide: (e, t) => ie(`${$e(e, t)}/unhide`, "POST", {}),
  removeInitiative: (e, t) => ie(`${$e(e, t)}/remove`, "POST", {}),
  ticket: (e, t, i) => ie(`${$e(e, t)}/tickets/${i}`),
  frontier: (e, t) => ie(`${$e(e, t)}/frontier`),
  doc: (e, t, i) => ie(`${$e(e, t)}/doc?href=${encodeURIComponent(i)}`)
};
function ke(e) {
  return e instanceof Error ? e.message : String(e);
}
const yt = {
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
}, St = {
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
}, Kn = (e) => jn.find((t) => Gn[t].includes(e)) ?? "intake", at = (e) => !e.answer && typeof e.title == "string" && e.title.trim() !== "", v = {
  body: 13,
  small: 12,
  tiny: 11,
  title: 15
}, st = {
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: v.body,
  width: "100%",
  minWidth: 0
}, B = { color: "var(--muted)" }, xe = { color: "var(--text-strong, var(--text))", fontWeight: 600 };
function Be({ children: e }) {
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
function nn({ path: e }) {
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
function Nt({ children: e, onClick: t, disabled: i, primary: r, danger: s, title: p }) {
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
        fontSize: v.body,
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
function ut({ title: e, aside: t, children: i, defaultOpen: r = !0 }) {
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
          fontSize: v.small
        },
        children: [
          /* @__PURE__ */ o("span", { "aria-hidden": !0, style: { ...B, width: 10, fontSize: 9 }, children: s ? "▾" : "▸" }),
          /* @__PURE__ */ o("span", { style: xe, children: e }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          t != null && /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.tiny }, children: t })
        ]
      }
    ),
    s && /* @__PURE__ */ o("div", { style: { padding: "0 12px 10px 28px", fontSize: v.body }, children: i })
  ] });
}
function Pt(e) {
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
function bt({ kind: e, map: t }) {
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
function on({ busy: e, onAdd: t, actionLabel: i = "Add" }) {
  var h;
  const [r, s] = E(null), [p, d] = E(""), f = Re(async (l) => {
    d("");
    try {
      s(await ce.browse(l));
    } catch (u) {
      d(ke(u));
    }
  }, []);
  return K(() => {
    f();
  }, [f]), /* @__PURE__ */ c(
    "div",
    {
      className: "rounded-md p-3 mb-3",
      style: { background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ o(Be, { children: p }),
        r ? /* @__PURE__ */ c(me, { children: [
          /* @__PURE__ */ c("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ o(Ie, { disabled: !r.parent, onClick: () => r.parent && f(r.parent), children: "Up" }),
            /* @__PURE__ */ o(nn, { path: r.path }),
            ((h = r.here) == null ? void 0 : h.slug) && /* @__PURE__ */ c(Ie, { primary: !0, disabled: e === r.path, onClick: () => t(r.path), children: [
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
              l.repo && (l.slug ? /* @__PURE__ */ c(me, { children: [
                /* @__PURE__ */ o(Et, { variant: "aim", children: l.slug }),
                /* @__PURE__ */ o(Ie, { primary: !0, disabled: e === l.path, onClick: () => t(l.path), children: i })
              ] }) : /* @__PURE__ */ o(Et, { variant: "muted", children: "no GitHub remote" }))
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
  K(() => {
    let n = !0;
    return ce.tree().then((a) => {
      n && r(a.available);
    }).catch((a) => {
      n && (r([]), p(ke(a)));
    }), () => {
      n = !1;
    };
  }, []), K(() => {
    const n = (a) => {
      a.key === "Escape" && t();
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [t]);
  const u = async (n) => {
    l(n), p("");
    try {
      await ce.addRepo(n), e(), t();
    } catch (a) {
      p(ke(a));
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
                /* @__PURE__ */ o("div", { style: { ...xe, fontSize: v.body }, children: "Add a repo" }),
                /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.tiny, marginTop: 1 }, children: "It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed." })
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
              /* @__PURE__ */ o(Be, { children: s }),
              i === null && /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small, padding: "6px 6px" }, children: "Looking for checkouts on this Mac…" }),
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
                    /* @__PURE__ */ o(en, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: h === n.path ? "Adding…" : n.slug }),
                    n.maps > 0 && /* @__PURE__ */ c("span", { style: { ...B, fontSize: v.tiny, flexShrink: 0 }, children: [
                      n.maps,
                      " open map",
                      n.maps === 1 ? "" : "s"
                    ] })
                  ]
                },
                n.path
              )) }),
              i !== null && i.length === 0 && !d && /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small, padding: "6px 6px" }, children: "No un-added checkouts found under your home folder. Browse for one:" }),
              d ? /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(on, { busy: h, onAdd: (n) => void u(n) }) }) : /* @__PURE__ */ c(
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
                    fontSize: v.small
                  },
                  children: [
                    /* @__PURE__ */ o(En, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    "Browse for a folder…"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ o("div", { style: { display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderTop: "1px solid var(--border)" }, children: /* @__PURE__ */ o(Ie, { onClick: t, children: "Cancel" }) })
          ]
        }
      )
    }
  );
}
const rn = "kipo.layout.v1";
function Dt() {
  try {
    return JSON.parse(localStorage.getItem(rn) || "{}");
  } catch {
    return {};
  }
}
function sn(e, t, i, r) {
  const s = Re((h) => Math.round(Math.min(r, Math.max(i, h))), [i, r]), [p, d] = E(() => {
    const h = Dt()[e];
    return s(typeof h == "number" ? h : t);
  });
  K(() => {
    const h = Dt();
    h[e] = p;
    try {
      localStorage.setItem(rn, JSON.stringify(h));
    } catch {
    }
  }, [e, p]);
  const f = Re((h) => {
    d((l) => s(typeof h == "function" ? h(l) : h));
  }, [s]);
  return [p, f];
}
function ln({ direction: e, onDrag: t, onReset: i, label: r }) {
  const s = pe(null), [p, d] = E(!1), [f, h] = E(!1), l = e === "vertical", u = (z) => l ? z.clientX : z.clientY;
  K(() => {
    if (!p) return;
    const z = (N) => {
      if (s.current == null) return;
      const L = u(N), P = L - s.current;
      P && (s.current = L, t(P));
    }, D = () => {
      s.current = null, d(!1);
    };
    return window.addEventListener("pointermove", z), window.addEventListener("pointerup", D), window.addEventListener("pointercancel", D), () => {
      window.removeEventListener("pointermove", z), window.removeEventListener("pointerup", D), window.removeEventListener("pointercancel", D);
    };
  }, [p, t]);
  const n = (z) => {
    z.preventDefault(), s.current = u(z), d(!0);
  }, a = (z) => {
    const D = z.shiftKey ? 40 : 10, N = l ? "ArrowLeft" : "ArrowUp", L = l ? "ArrowRight" : "ArrowDown";
    z.key === N && (z.preventDefault(), t(-D)), z.key === L && (z.preventDefault(), t(D));
  }, I = p || f, j = l ? { width: 9, margin: "0 -4px", cursor: "col-resize", alignSelf: "stretch" } : { height: 9, margin: "-4px 0", cursor: "row-resize", width: "100%" };
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
      style: { ...j, flexShrink: 0, position: "relative", zIndex: 2, touchAction: "none", display: "flex", justifyContent: "center", alignItems: "center" },
      children: [
        /* @__PURE__ */ o(
          "span",
          {
            "aria-hidden": !0,
            style: l ? { width: I ? 3 : 1, height: "100%", borderRadius: 2, background: I ? "var(--accent)" : "var(--border)", transition: "width .1s" } : { height: I ? 3 : 1, width: "100%", borderRadius: 2, background: I ? "var(--accent)" : "var(--border)", transition: "height .1s" }
          }
        ),
        /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
          position: "absolute",
          borderRadius: 3,
          background: I ? "var(--accent)" : "var(--border)",
          ...l ? { width: 5, height: 28, top: "calc(50% - 14px)" } : { height: 5, width: 28, left: "calc(50% - 14px)" }
        } }),
        p && /* @__PURE__ */ o("div", { style: { position: "fixed", inset: 0, zIndex: 9999, cursor: l ? "col-resize" : "row-resize" } })
      ]
    }
  );
}
function Fn(e, t, i = 0.75) {
  const [r, s] = sn(e, 0, 0, 4e3), p = pe(null), d = Re((h) => {
    const l = Math.round(window.innerHeight * i);
    s((u) => {
      var a;
      const n = u || ((a = p.current) == null ? void 0 : a.offsetHeight) || t;
      return Math.max(t, Math.min(l, n + h));
    });
  }, [t, i, s]), f = r ? { flex: `0 0 ${r}px`, minHeight: 0, overflowY: "auto" } : { flex: "0 1 auto", minHeight: 0, maxHeight: `${Math.round(i * 100)}%`, overflowY: "auto" };
  return { ref: p, style: f, onDrag: d, reset: () => s(0) };
}
const $t = "kipo.cache.v3:";
try {
  for (let e = localStorage.length - 1; e >= 0; e--) {
    const t = localStorage.key(e);
    t && t.startsWith("kipo.cache.") && !t.startsWith($t) && localStorage.removeItem(t);
  }
} catch {
}
const lt = /* @__PURE__ */ new Map();
function Ze(e) {
  if (lt.has(e)) return lt.get(e);
  try {
    const t = localStorage.getItem($t + e);
    if (t == null) return null;
    const i = JSON.parse(t);
    return lt.set(e, i), i;
  } catch {
    return null;
  }
}
function et(e, t) {
  lt.set(e, t);
  try {
    localStorage.setItem($t + e, JSON.stringify(t));
  } catch {
  }
}
const Yn = "KiPo", Lt = "kipo.sessionsFiled.v2", Jn = (e) => {
  var i;
  const t = (e == null ? void 0 : e.id) ?? ((i = e == null ? void 0 : e.folder) == null ? void 0 : i.id);
  if (!t) throw new Error("the sidebar didn't return the new folder");
  return t;
};
async function an(e, t, i, r) {
  const s = await e.get("/api/chat/folders"), p = s == null ? void 0 : s.find((d) => d.name === t && (d.parent_id || null) === i);
  return p ? p.id : Jn(await e.post("/api/chat/folders", {
    name: t,
    ...i ? { parent_id: i } : {},
    ...r ? { icon: r } : {}
  }));
}
const Un = (e) => an(e, Yn, null, "⚗️"), Qn = (e) => e.split("/").pop() || e;
async function cn(e, t) {
  const i = await Un(e);
  try {
    return await an(e, Qn(t), i);
  } catch {
    return i;
  }
}
async function Xn(e) {
  if (localStorage.getItem(Lt)) return;
  const { byRepo: t } = await ce.listSessions(), i = /* @__PURE__ */ new Map();
  for (const { repo: r } of t ?? [])
    i.has(r) || i.set(r, await cn(e, r));
  await Promise.all((t ?? []).map(
    ({ slot: r, repo: s }) => e.patch(`/api/chat/slots/${encodeURIComponent(r)}/folder`, { folder_id: i.get(s) }).catch(() => {
    })
    // a session that was closed or deleted is simply skipped
  )), localStorage.setItem(Lt, (/* @__PURE__ */ new Date()).toISOString());
}
const dn = {
  position: "fixed",
  zIndex: 99999,
  background: "var(--bg-elevated, #2a2a2a)",
  border: "1px solid var(--border, rgba(255,255,255,0.15))",
  borderRadius: 6,
  boxShadow: "0 4px 12px var(--shadow, rgba(0,0,0,0.5))"
};
function un(e, t, i) {
  const r = pe(null), [s, p] = E({ x: e, y: t });
  return An(() => {
    const d = r.current;
    if (!d) return;
    const f = d.getBoundingClientRect();
    p({
      x: e + f.width > window.innerWidth ? Math.max(0, e - f.width) : e,
      y: t + f.height > window.innerHeight ? Math.max(0, t - f.height) : t
    });
  }, [e, t]), K(() => {
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
function Bt({ x: e, y: t, items: i, onClose: r }) {
  const { ref: s, pos: p } = un(e, t, r);
  return K(() => {
    var d, f;
    (f = (d = s.current) == null ? void 0 : d.querySelector("[role=menuitem]")) == null || f.focus();
  }, [s]), /* @__PURE__ */ o("div", { ref: s, role: "menu", style: { ...dn, left: p.x, top: p.y, padding: "4px 0", minWidth: 160 }, children: i.map((d, f) => {
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
function pt({ x: e, y: t, title: i, children: r, action: s, onConfirm: p, onClose: d }) {
  const { ref: f, pos: h } = un(e, t, d);
  return /* @__PURE__ */ c(
    "div",
    {
      ref: f,
      role: "alertdialog",
      "aria-label": i,
      style: { ...dn, left: h.x, top: h.y, padding: "12px 14px", width: 280 },
      children: [
        /* @__PURE__ */ o("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e0e0e0)", lineHeight: 1.35 }, children: i }),
        r && /* @__PURE__ */ o("div", { style: { fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6, lineHeight: 1.45 }, children: r }),
        /* @__PURE__ */ c("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ o(Ie, { onClick: d, children: "Cancel" }),
          /* @__PURE__ */ o(Ie, { danger: !0, onClick: () => {
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
}, _e = {
  you: "HITL = human in the loop: open, unblocked, and it needs a person",
  afk: "Agent (AFK = away from keyboard): open, unblocked, and an agent can take it on its own",
  building: "In progress: an agent is building it",
  review: "In review: its pull request is open",
  blocked: "Blocked: waiting on a ticket that is still open",
  done: "Done: closed",
  fog: "Fog: in scope but not yet specified — listed in the map's Not yet specified section, not a ticket yet"
}, ct = {
  HITL: _e.you,
  AFK: _e.afk,
  Agent: _e.afk,
  PR: "PR = pull request on GitHub",
  Fog: _e.fog,
  Decide: "Decide: the wayfinder map — decision tickets that settle what to build",
  Deliver: "Deliver: the spec tickets — the work that ships it",
  Origin: "Origin: the issue the effort started from",
  "hand-over": "Hand-over: the spec tickets were cut from the decided wayfinder map",
  spec: "Spec tickets: the build tickets cut from the spec, labelled kipo:<effort number>",
  kipo: "kipo:<n>: the label that ties a ticket to effort #<n>",
  map: "Wayfinder map: the issue that lists the effort’s decision tickets and its fog"
}, Zn = (e) => [Vn[e.code], _e[e.state]].filter(Boolean).join(`
`);
function eo({ term: e, title: t, children: i }) {
  return /* @__PURE__ */ o(
    "abbr",
    {
      title: t ?? (e ? ct[e] : void 0),
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
function jt({ tile: e, onClick: t, size: i = 34, open: r, status: s, bare: p, numberOnly: d, width: f }) {
  const h = O[e.state], l = e.state !== "blocked", u = e.state === "done", n = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((I) => `#${I}`).join(", ")}` : `#${e.number} ${e.title}: ${h.label}`;
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
        d ? e.number : /* @__PURE__ */ c(me, { children: [
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
    d = await cn(e, t);
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
const pn = "kipo.closedSessions.v1", Ke = (e) => !!e && It().has(e);
function It() {
  try {
    return new Set(JSON.parse(localStorage.getItem(pn) || "[]"));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function vt(e) {
  const t = It();
  t.add(e);
  try {
    localStorage.setItem(pn, JSON.stringify([...t].slice(-500)));
  } catch {
  }
}
async function qt(e, t) {
  try {
    await e.del(`/api/chat/slots/${encodeURIComponent(t)}`);
  } catch (i) {
    if (!/404|not.?found/i.test(String((i == null ? void 0 : i.message) ?? i))) return !1;
  }
  return vt(t), !0;
}
async function Gt(e, t, i) {
  const r = It(), s = [];
  for (const p of t)
    if (!(!p || p === i)) {
      if (r.has(p)) {
        s.push(p);
        continue;
      }
      try {
        const d = await e.get(`/api/chat/slots/${encodeURIComponent(p)}?limit=1`);
        if (d != null && d.running) continue;
        await e.del(`/api/chat/slots/${encodeURIComponent(p)}`), vt(p), s.push(p);
      } catch (d) {
        /404|not.?found/i.test(String((d == null ? void 0 : d.message) ?? d)) && (vt(p), s.push(p));
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
const Xe = ["intake", "shape", "grill", "plan", "build", "review", "done"], so = { idea: "grill", small: "grill", huge: "shape", issue: "intake", bug: "build" }, lo = { idea: "an idea", small: "small", huge: "huge", issue: "an issue", bug: "a bug" }, Kt = {
  intake: "source issues",
  shape: "map tickets",
  grill: "questions",
  plan: "spec → tickets",
  build: "tickets",
  review: "PRs",
  done: "merged · retro"
}, tt = {
  intake: "Intake",
  shape: "Shape",
  grill: "Grill",
  plan: "Plan",
  build: "Build",
  review: "Review",
  done: "Done"
}, Ue = (e, t) => ({ n: e, color: O[t].color });
function ao(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function co({ detail: e, statuses: t, activity: i, busy: r, autopilot: s, selectedKey: p, embedded: d, compact: f, onAutopilot: h, onOpenTile: l, onOpenConversation: u, onSelectConductor: n, onJumpQuestions: a, onHandover: I, onReview: j, onRetro: z, onClose: D }) {
  var Ae, ae, Oe, be, Fe;
  const [N, L] = E(!1), P = (m) => {
    var ee, F;
    return m ? (((F = (ee = e.sessionStates) == null ? void 0 : ee[m]) == null ? void 0 : F.decisions) ?? []).filter(at).length : 0;
  }, J = (((ae = ((Ae = e.sessionStates) == null ? void 0 : Ae.conductor) ?? e.state) == null ? void 0 : ae.decisions) ?? []).filter(at).length, X = (m) => ({ label: m === 1 ? "1 question" : `${m} questions`, color: O.you.color }), x = e.frontier, R = (x == null ? void 0 : x.tiles) ?? [], H = (Oe = x == null ? void 0 : x.fogItems) != null && Oe.length ? x.fogItems : (x == null ? void 0 : x.fogLeft) ?? [], q = !((be = x == null ? void 0 : x.fogItems) != null && be.length) && !!((Fe = x == null ? void 0 : x.fogLeft) != null && Fe.length), oe = new Map(Xe.map((m) => [m, []]));
  for (const m of R) oe.get(oo(m)).push(m);
  const le = (m) => m.source ? "intake" : m.type === "build" ? "build" : m.type === "grilling" ? "grill" : "shape", de = new Map(Xe.map((m) => [m, []]));
  for (const m of R) de.get(le(m)).push(m);
  const Q = so[e.start] ?? "grill", ue = Xe.indexOf(Q), ne = de.get("build"), y = e.artifacts.find((m) => m.label === "Spec" || m.label.startsWith("Spec")), b = e.prs.filter((m) => m.state === "OPEN"), $ = e.prs.filter((m) => m.state === "MERGED"), A = R.filter((m) => m.state === "done").length, re = !!e.sessions.done, G = (m) => {
    var De;
    const ee = m.state !== "done" ? P(m.sessionKey) : 0, F = t[m.number], Y = F === "attention" ? ((De = i == null ? void 0 : i[m.number]) == null ? void 0 : De.needs) ?? null : null, Pe = F === "running" || F === "attention", ve = F === "attention" || ee > 0 || m.state === "you";
    return {
      key: `t${m.number}`,
      number: m.number,
      title: m.title,
      tile: m,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: ee ? X(ee) : Y === "approval" ? { label: "trust prompt", color: O.you.color } : Y === "input" ? { label: "asking", color: O.you.color } : { label: O[m.state].label, color: m.state === "done" ? O.done.text : O[m.state].color, solid: m.state === "you" || m.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Pe || ve,
      attention: ve,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Pe ? i == null ? void 0 : i[m.number] : void 0,
      questions: ee,
      selKeys: [`build-t${m.number}`, `shape-t${m.number}`, `review-t${m.number}`]
    };
  }, Z = (m) => {
    const ee = (F) => m.filter((Y) => Y.state === F).length;
    return { done: ee("done"), you: ee("you"), afk: ee("afk"), building: ee("building"), review: ee("review"), blocked: ee("blocked") };
  }, _ = (m) => {
    const ee = ["you", "building", "afk", "review", "blocked", "done"];
    return [...m].sort((F, Y) => ee.indexOf(F.state) - ee.indexOf(Y.state) || F.number - Y.number);
  }, ye = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, We = (m) => {
    const ee = e.sessions[m];
    if (!ee || Ke(ee)) return [];
    const F = P(m);
    return [{
      key: `conv-${m}`,
      title: ye[m] ?? "Its conversation",
      chip: F ? X(F) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => u(m),
      questions: F,
      selKeys: [m]
    }];
  }, he = Xe.map((m) => {
    const ee = de.get(m), F = We(m === "build" ? "build-spec" : m);
    if (m === "plan") {
      if (ne.length || y)
        return { id: m, state: "full", count: /* @__PURE__ */ c(me, { children: [
          /* @__PURE__ */ o("b", { style: xe, children: "1 spec" }),
          " → ",
          ne.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: O.done.color }], rows: F };
      if (x != null && x.handover)
        return {
          id: m,
          state: "live",
          count: /* @__PURE__ */ o("b", { style: { color: O.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: O.you.color }],
          rows: F,
          // Once the conversation exists, its row above is the way back in.
          action: F.length ? void 0 : { label: "Write the spec", onClick: I }
        };
      const se = R.filter((we) => we.lane === "decide" && we.state !== "done").length;
      return { id: m, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${se || "the"} decision${se === 1 ? "" : "s"}${H.length ? ` and ${H.length} fog` : ""}`, segments: [], rows: F };
    }
    if (m === "review")
      return !b.length && !$.length && !F.length ? { id: m, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: m,
        state: b.length ? "live" : "full",
        count: /* @__PURE__ */ c(me, { children: [
          /* @__PURE__ */ c("b", { style: xe, children: [
            $.length,
            " merged"
          ] }),
          b.length ? /* @__PURE__ */ c(me, { children: [
            " · ",
            b.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: $.length, color: O.done.color }, { n: b.length, color: O.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...F, ...b.map((se) => {
          const we = se.tickets[0];
          return {
            key: `pr${se.number}`,
            number: se.number,
            title: se.title,
            chip: { label: "open", color: O.review.color },
            ...we != null ? { onOpen: () => u(`review-t${we}`), selKeys: [`review-t${we}`] } : { url: se.url }
          };
        })],
        action: b.length && !F.length ? { label: "Review the PRs", onClick: j } : void 0
      };
    if (m === "done") {
      const se = !!(x != null && x.landed), we = se && re && e.kind !== "map";
      return {
        id: m,
        state: A ? se ? "live" : "full" : "queued",
        count: A ? /* @__PURE__ */ c(me, { children: [
          /* @__PURE__ */ c("b", { style: xe, children: [
            A,
            " of ",
            R.length
          ] }),
          " · ",
          re ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: A ? void 0 : "closes when the retro runs",
        segments: [{ n: A, color: O.done.color }, { n: Math.max(0, R.length - A), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...F, ...R.filter((He) => He.state === "done").sort((He, ot) => He.number - ot.number).map(G)],
        action: se && !re ? { label: "Run /retro", onClick: z } : we ? N ? { label: "Close the effort and its issue?", onClick: () => {
          L(!1), D();
        }, confirm: () => L(!1) } : { label: "Close effort", onClick: () => L(!0) } : void 0
      };
    }
    if (!ee.length && !(m === "shape" && H.length) && !F.length)
      return Xe.indexOf(m) < ue ? { id: m, state: "skipped", count: `entered at ${tt[Q]}`, segments: [], rows: [] } : m === "build" ? { id: m, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: m, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const Y = Z(ee), Pe = Y.you + Y.afk + Y.building + Y.review + Y.blocked > 0 || !ee.length && F.length > 0, ve = [];
    m === "grill" ? (Y.done && ve.push(`${Y.done} answered`), Y.you && ve.push(`${Y.you} waiting`)) : (Y.done && ve.push(`${Y.done} done`), Y.you && ve.push(`${Y.you} HITL`)), Y.building && ve.push(`${Y.building} in agents`), Y.afk && ve.push(`${Y.afk} ready`), Y.review && ve.push(`${Y.review} in review`), Y.blocked && ve.push(`${Y.blocked} blocked`);
    const De = [Ue(Y.done, "done"), Ue(Y.building, "building"), Ue(Y.review, "review"), Ue(Y.you, "you"), Ue(Y.afk, "afk"), Ue(Y.blocked, "blocked")];
    m === "shape" && H.length && De.push({ n: H.length, color: "transparent", dashed: !0 });
    const Ye = [...F, ..._(ee.filter((se) => se.state !== "done")).map(G)];
    return m === "shape" && H.forEach((se, we) => Ye.push({
      key: `fog${we}`,
      title: po(se),
      chip: q ? { label: "left unspecified", color: O.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: m,
      state: Pe ? "live" : "full",
      count: /* @__PURE__ */ c(me, { children: [
        ve.map((se, we) => we === 0 ? /* @__PURE__ */ o("b", { style: xe, children: se }, se) : /* @__PURE__ */ c("span", { children: [
          " · ",
          se
        ] }, se)),
        m === "shape" && H.length ? /* @__PURE__ */ c("span", { children: [
          " · ",
          H.length,
          " fog"
        ] }) : null
      ] }),
      segments: De,
      rows: Ye
    };
  }), Ne = (m) => m.state === "live", je = he.reduce((m, ee, F) => Ne(ee) ? F : m, -1), Ee = je >= 0 ? he[je] : null, fe = Z(R), Me = R.length, k = [
    { n: fe.building, label: "in agents", color: O.building.color },
    { n: fe.review, label: "in review", color: O.review.color },
    { n: fe.you, label: "HITL", color: O.you.color },
    { n: fe.afk, label: "ready", color: O.afk.color },
    { n: fe.blocked, label: "blocked", color: O.blocked.color },
    { n: H.length, label: "fog", color: "var(--muted)" }
  ].filter((m) => m.n > 0), [te, ge] = E(() => new Set(Ee ? [Ee.id] : [])), Se = (m) => ge((ee) => {
    const F = new Set(ee);
    return F.has(m) ? F.delete(m) : F.add(m), F;
  }), qe = J + he.reduce((m, ee) => m + ee.rows.reduce((F, Y) => F + (Y.questions ?? 0), 0), 0), Ce = Object.values(i ?? {}).filter((m) => m && (m.needs === "approval" || m.needs === "input")).length, Te = p === "conductor", Ge = !!e.sessions.conductor && !Ke(e.sessions.conductor), ze = f ? 10 : 16;
  return /* @__PURE__ */ c("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, ...d ? {} : { height: "100%" } }, children: [
    /* @__PURE__ */ c("div", { style: { padding: `10px ${ze}px 9px`, borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ c("span", { style: { ...B, fontSize: v.tiny, flex: 1 }, children: [
          "entered at ",
          tt[Q],
          " (",
          lo[e.start] ?? e.start,
          ")"
        ] }),
        !d && /* @__PURE__ */ o("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.tiny, whiteSpace: "nowrap" }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }, children: Me > 0 ? /* @__PURE__ */ c(me, { children: [
        /* @__PURE__ */ c("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ c("b", { style: { color: O.done.text }, children: [
            fe.done,
            " of ",
            Me
          ] }),
          " ",
          /* @__PURE__ */ o("span", { style: B, children: "done" })
        ] }),
        k.map((m) => /* @__PURE__ */ c("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ o("b", { style: { color: m.color }, children: m.n }),
          " ",
          /* @__PURE__ */ o("span", { style: B, children: m.label })
        ] }, m.label))
      ] }) : /* @__PURE__ */ o("span", { style: B, children: H.length ? `${H.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
      (qe > 0 || Ce > 0) && // The pill only shows when something is waiting on the human, so it
      // pulses the moment it appears — the same amber attention cue the
      // session cards use, for questions as well as trust prompts/asks.
      /* @__PURE__ */ c(
        "button",
        {
          type: "button",
          onClick: a,
          className: "kipo-pulse",
          title: Ce > 0 ? "A session is stopped on a trust prompt or an ask: open it to allow or answer" : "Jump to the next conversation with open questions; answer them on the right",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 6,
            padding: "2px 9px",
            borderRadius: 99,
            background: O.you.color,
            color: "#14121c",
            fontSize: v.tiny,
            fontWeight: 700,
            cursor: "pointer",
            border: 0
          },
          children: [
            ao(qe, Ce),
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
            fontSize: v.tiny,
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
      /* @__PURE__ */ o("div", { style: { padding: `9px ${ze}px`, borderBottom: "1px solid var(--border)" }, children: /* @__PURE__ */ c(
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
            background: Te ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: Te ? "var(--accent-fg, #fff)" : "var(--accent)"
          },
          children: [
            /* @__PURE__ */ o(tn, { size: 14, "aria-hidden": !0, style: { flexShrink: 0 } }),
            /* @__PURE__ */ o("span", { style: { flex: 1 }, children: "Conductor" }),
            J > 0 ? /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${Te ? "var(--accent-fg, #fff)" : O.you.color}`,
              color: Te ? "var(--accent-fg, #fff)" : O.you.color
            }, children: J === 1 ? "1 question" : `${J} questions` }) : /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 400, opacity: 0.75 }, children: Ge ? "conversation" : "not started" })
          ]
        }
      ) }),
      he.map((m) => /* @__PURE__ */ o(
        uo,
        {
          s: m,
          busy: r,
          open: te.has(m.id),
          selectedKey: p,
          compact: f,
          onToggle: () => Se(m.id),
          onOpenTile: l
        },
        m.id
      )),
      /* @__PURE__ */ c("div", { style: { display: "flex", gap: 12, alignItems: "center", padding: `9px ${ze}px`, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ o(Ve, { color: O.done.color, label: "done" }),
        /* @__PURE__ */ o(Ve, { color: O.building.color, label: "in agents" }),
        /* @__PURE__ */ o(Ve, { color: O.you.color, label: "HITL" }),
        /* @__PURE__ */ o(Ve, { color: O.afk.color, label: "ready" }),
        /* @__PURE__ */ o(Ve, { color: O.blocked.color, label: "blocked" })
      ] })
    ] })
  ] });
}
function Ve({ color: e, label: t }) {
  return /* @__PURE__ */ c("span", { children: [
    /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, background: e, marginRight: 4, verticalAlign: -1 } }),
    t
  ] });
}
function uo({ s: e, open: t, busy: i, selectedKey: r, compact: s, onToggle: p, onOpenTile: d }) {
  const f = e.state === "skipped" || e.state === "queued", h = e.rows.length > 0 || !!e.action, l = no.find((a) => a.id === e.id), u = e.segments.reduce((a, I) => a + I.n, 0), n = e.rows.reduce((a, I) => a + (I.questions ?? 0), 0);
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
        title: l ? `${tt[e.id]} · ${l.skill}
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
            /* @__PURE__ */ o(gt, { size: 12, "aria-hidden": !0, style: {
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
                style: { width: s ? 48 : 56, flexShrink: 0, fontSize: v.small, fontWeight: 700, color: f ? "var(--muted)" : "var(--text-strong, var(--text))" },
                title: s ? Kt[e.id] : void 0,
                children: tt[e.id]
              }
            ),
            !s && /* @__PURE__ */ o("span", { style: { width: 92, flexShrink: 0, fontSize: 10, color: "var(--muted)" }, children: Kt[e.id] }),
            /* @__PURE__ */ c("span", { style: { flex: 1, textAlign: "right", fontSize: v.small, minWidth: 0 }, children: [
              n > 0 && /* @__PURE__ */ o("span", { style: {
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
              e.count
            ] })
          ] }),
          u > 0 && /* @__PURE__ */ o("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((a) => a.n > 0).map((a, I) => /* @__PURE__ */ o("span", { style: { flex: a.n, background: a.color, ...a.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, I)) }),
          e.ghost && /* @__PURE__ */ o("span", { style: { display: "block", fontSize: v.tiny, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }, children: e.ghost })
        ]
      }
    ),
    t && h && /* @__PURE__ */ c("div", { style: { margin: s ? "0 10px 10px 8px" : "0 16px 10px 14px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }, children: [
      e.action && /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: e.rows.length ? "1px solid var(--border)" : void 0 }, children: [
        /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.tiny, flex: 1 }, children: e.action.confirm ? "" : `${tt[e.id]}'s next step` }),
        /* @__PURE__ */ o(Nt, { primary: !0, disabled: i, onClick: e.action.onClick, children: e.action.label }),
        e.action.confirm && /* @__PURE__ */ o(Nt, { disabled: i, onClick: e.action.confirm, children: "Cancel" })
      ] }),
      e.rows.map((a) => {
        var D;
        const I = () => {
          a.onOpen ? a.onOpen() : a.tile ? d(a.tile) : a.url && window.open(a.url, "_blank", "noreferrer");
        }, j = !!a.onOpen || !!a.tile || !!a.url, z = !!r && !!((D = a.selKeys) != null && D.includes(r));
        return /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: j ? I : void 0,
            disabled: !j,
            title: a.tile ? `#${a.number} ${a.title}
${_e[a.tile.state]}
Click to open its session` : a.onOpen ? `${a.title}
Click to open this conversation` : a.title,
            style: {
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 10px",
              borderTop: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: v.small,
              background: z ? "var(--bg-elevated)" : "transparent",
              boxShadow: z ? "inset 2px 0 0 var(--accent)" : void 0,
              cursor: j ? "pointer" : "default"
            },
            onMouseEnter: (N) => {
              j && !z && (N.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (N) => {
              N.currentTarget.style.background = z ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ c("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: a.number != null ? `#${a.number}` : a.onOpen ? /* @__PURE__ */ o(tn, { size: 11, "aria-hidden": !0 }) : "☁" }),
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
                    fontSize: v.tiny,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  },
                  children: [
                    /* @__PURE__ */ o("span", { style: { color: O.building.color }, children: ho(a.live.at) }),
                    a.live.line ? /* @__PURE__ */ c(me, { children: [
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
const hn = "kipo.rail.repoOpen", fo = () => {
  try {
    return JSON.parse(localStorage.getItem(hn) || "{}");
  } catch {
    return {};
  }
};
function _t() {
  return /* @__PURE__ */ o(
    "span",
    {
      className: "kipo-pulse",
      title: `${ct.HITL}: a session in here is stopped on a trust prompt or question`,
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
function mo({ width: e, items: t, repos: i, error: r, notice: s, selected: p, attention: d, spineSlot: f, onNew: h, onAddRepo: l, onRemoveRepo: u, onRestore: n, onSelect: a, onHide: I, onRemove: j, onCollapse: z }) {
  const [D, N] = E(""), [L, P] = E(null), [J, X] = E(!0);
  K(() => {
    X(!0);
  }, [p]);
  const [x, R] = E(null), H = Re(() => R(null), []), [q, oe] = E(null), [le, de] = E(fo);
  K(() => {
    localStorage.setItem(hn, JSON.stringify(le));
  }, [le]);
  const Q = (y) => le[y] !== !1, ue = D.trim().toLowerCase(), ne = rt(() => {
    const y = /* @__PURE__ */ new Map();
    for (const $ of t ?? []) {
      const A = y.get($.repo) ?? [];
      A.push($), y.set($.repo, A);
    }
    const b = (i ?? []).map(($) => $.slug);
    for (const $ of y.keys()) b.includes($) || b.push($);
    return b.map(($) => {
      const A = (i ?? []).find((_) => _.slug === $) ?? { slug: $, path: "", hidden: [] }, re = y.get($) ?? [], G = !ue || $.toLowerCase().includes(ue), Z = G ? re : re.filter((_) => _.title.toLowerCase().includes(ue));
      return { meta: A, rows: Z, show: !ue || G || Z.length > 0 };
    }).filter(($) => $.show);
  }, [t, i, ue]);
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
            /* @__PURE__ */ o(Ie, { primary: !0, onClick: h, children: /* @__PURE__ */ c("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Wn, { size: 14 }),
              "New effort"
            ] }) }),
            /* @__PURE__ */ o("span", { title: "Add a repo: it joins this sidebar with all its maps and efforts under it", children: /* @__PURE__ */ o(Ie, { onClick: l, children: /* @__PURE__ */ c("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Mn, { size: 14 }),
              "Add repo"
            ] }) }) })
          ] }),
          /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ o(
              "input",
              {
                value: D,
                onChange: (y) => N(y.target.value),
                placeholder: "Filter efforts",
                "aria-label": "Filter efforts",
                style: { ...st, fontSize: v.small, padding: "4px 8px", flex: 1, minWidth: 0 }
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
          r && /* @__PURE__ */ o("div", { style: { color: "var(--danger-text)", fontSize: v.small, padding: "4px 6px" }, children: r }),
          !r && s && /* @__PURE__ */ o("div", { style: { color: "#f5b14c", fontSize: v.tiny, padding: "4px 6px", lineHeight: 1.4 }, children: s }),
          t === null && !r && /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small, padding: "4px 6px" }, children: "Loading…" }),
          t !== null && !ne.length && /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small, padding: "4px 6px" }, children: ue ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          ne.map((y) => {
            const b = Q(y.meta.slug) || !!ue, $ = y.meta.slug.split("/").pop() ?? y.meta.slug;
            return /* @__PURE__ */ c("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ c(
                "div",
                {
                  onContextMenu: (A) => {
                    A.preventDefault(), oe({ slug: y.meta.slug, x: A.clientX, y: A.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => P(`repo:${y.meta.slug}`),
                  onPointerLeave: () => P((A) => A === `repo:${y.meta.slug}` ? null : A),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 6,
                    padding: "3px 4px",
                    background: L === `repo:${y.meta.slug}` ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ c(
                      "button",
                      {
                        type: "button",
                        onClick: () => de((A) => ({ ...A, [y.meta.slug]: !b })),
                        "aria-expanded": b,
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
                          /* @__PURE__ */ o(gt, { size: 11, "aria-hidden": !0, style: {
                            flexShrink: 0,
                            color: "var(--muted)",
                            transition: "transform .12s",
                            transform: b ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ o(en, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: $ }),
                          !b && (d ?? 0) > 0 && (p == null ? void 0 : p.startsWith(`${y.meta.slug}#`)) && /* @__PURE__ */ o(_t, {}),
                          /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.tiny, flexShrink: 0 }, children: y.rows.length || (b ? "" : "0") })
                        ]
                      }
                    ),
                    (L === `repo:${y.meta.slug}` || (q == null ? void 0 : q.slug) === y.meta.slug) && /* @__PURE__ */ o(
                      "button",
                      {
                        type: "button",
                        "aria-label": `More for ${y.meta.slug}`,
                        "aria-haspopup": "menu",
                        title: "More",
                        onClick: (A) => {
                          A.stopPropagation();
                          const re = A.currentTarget.getBoundingClientRect();
                          oe({ slug: y.meta.slug, x: re.left, y: re.bottom + 2, confirm: !1 });
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
                        children: /* @__PURE__ */ o(Wt, { size: 13 })
                      }
                    )
                  ]
                }
              ),
              b && !y.rows.length && /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              b && y.rows.length > 0 && /* @__PURE__ */ o("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: y.rows.map((A) => {
                const re = `${A.repo}#${A.number}`, G = re === p, Z = G && !!f && J;
                return /* @__PURE__ */ c(
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
                    onContextMenu: (_) => {
                      _.preventDefault(), R({ key: re, item: A, x: _.clientX, y: _.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => P(re),
                    onPointerLeave: () => P((_) => _ === re ? null : _),
                    children: [
                      /* @__PURE__ */ c(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            G ? X((_) => !_) : a(A);
                          },
                          "aria-current": G ? "page" : void 0,
                          "aria-expanded": G && f ? J : void 0,
                          title: G ? J ? "Fold this effort's stations away" : "Show this effort's stations" : void 0,
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
                            /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                              /* @__PURE__ */ o(gt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: Z ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ c("span", { style: { ...G ? xe : {}, flex: 1, minWidth: 0, fontSize: v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ c("span", { style: { ...B, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  A.number
                                ] }),
                                " ",
                                A.title
                              ] }),
                              G && !Z && (d ?? 0) > 0 && /* @__PURE__ */ o(_t, {})
                            ] }),
                            (() => {
                              var ye;
                              if (Z)
                                return /* @__PURE__ */ c("div", { style: { ...B, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(bt, { kind: A.kind, map: A.mapIssue }),
                                  /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: A.repo.split("/").pop() }),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Pt(A.updatedAt) })
                                ] });
                              const _ = (ye = A.frontier) != null && ye.stations ? io(A.frontier.stations) : null;
                              return /* @__PURE__ */ c(me, { children: [
                                _ && /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(ro, { glance: _ }) }),
                                /* @__PURE__ */ c("div", { style: { ...B, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(bt, { kind: A.kind, map: A.mapIssue }),
                                  !_ && /* @__PURE__ */ o(go, { stage: A.stage ?? Kn(A.column) }),
                                  /* @__PURE__ */ o(
                                    "span",
                                    {
                                      title: _ ? `${_.bits || _.front}

${ct.HITL}
${ct.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: _ ? _.bits || _.front : A.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Pt(A.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (L === re || G || (x == null ? void 0 : x.key) === re) && /* @__PURE__ */ o(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${A.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: (_) => {
                            _.stopPropagation();
                            const ye = _.currentTarget.getBoundingClientRect();
                            R({ key: re, item: A, x: ye.left, y: ye.bottom + 2, confirm: !1 });
                          },
                          onMouseEnter: (_) => {
                            _.currentTarget.style.background = "rgba(255,255,255,0.1)";
                          },
                          onMouseLeave: (_) => {
                            _.currentTarget.style.background = "transparent";
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
                          children: /* @__PURE__ */ o(Wt, { size: 14 })
                        }
                      ),
                      Z && /* @__PURE__ */ o("div", { ref: f, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  re
                );
              }) }),
              b && y.meta.hidden.length > 0 && /* @__PURE__ */ c(
                "button",
                {
                  type: "button",
                  onClick: () => n(y.meta.slug, y.meta.hidden),
                  title: `Removed from the sidebar: #${y.meta.hidden.join(", #")}. Click to restore them.`,
                  style: {
                    ...B,
                    fontSize: v.tiny,
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
        x && !x.confirm && /* @__PURE__ */ o(Bt, { x: x.x, y: x.y, onClose: H, items: [
          { label: "Open on GitHub", icon: Mt, onSelect: () => window.open(x.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: Hn, danger: !0, onSelect: () => R({ ...x, confirm: "hide" }) },
          ...x.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: Ht, danger: !0, onSelect: () => R({ ...x, confirm: "remove" }) }
          ]
        ] }),
        (x == null ? void 0 : x.confirm) === "hide" && /* @__PURE__ */ o(
          pt,
          {
            x: x.x,
            y: x.y,
            onClose: H,
            action: "Remove",
            title: `Remove "${x.item.title}" from the sidebar?`,
            onConfirm: () => I(x.item),
            children: x.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (x == null ? void 0 : x.confirm) === "remove" && /* @__PURE__ */ o(
          pt,
          {
            x: x.x,
            y: x.y,
            onClose: H,
            action: "Close it",
            title: `Close "${x.item.title}" as not planned?`,
            onConfirm: () => j(x.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        q && !q.confirm && /* @__PURE__ */ o(Bt, { x: q.x, y: q.y, onClose: () => oe(null), items: [
          { label: "Open on GitHub", icon: Mt, onSelect: () => window.open(`https://github.com/${q.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: Ht, danger: !0, onSelect: () => oe({ ...q, confirm: !0 }) }
        ] }),
        (q == null ? void 0 : q.confirm) && /* @__PURE__ */ o(
          pt,
          {
            x: q.x,
            y: q.y,
            onClose: () => oe(null),
            action: "Remove",
            title: `Remove ${q.slug} from KiPo?`,
            onConfirm: () => u(q.slug),
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
const Ft = [
  { id: "idea", title: "An idea", hint: "Grill it, spec and ticket it, build it.", begins: "a grilling: an interview that sharpens the idea. Then the spec and tickets, then the build." },
  { id: "small", title: "A small change", hint: "Grill briefly, then build in the same session.", begins: "a short grilling, then the build in the same conversation. No spec or tickets." },
  { id: "huge", title: "A huge effort", hint: "Too many unknowns: map the decisions first.", begins: "a wayfinder map. Its decision tickets fill the Decide lane." },
  { id: "issue", title: "An incoming issue", hint: "Triage it until an agent can pick it up.", begins: "triaging the issue. Once an agent can take it, it moves to the Deliver lane." },
  { id: "bug", title: "A hard bug", hint: "Diagnose it with a tight loop, then fix it.", begins: "a diagnosis: a command that goes red on the bug, then the fix." }
], it = (e) => /* @__PURE__ */ o("span", { style: { ...xe, fontSize: v.body, display: "block", marginBottom: 6 }, children: e }), bo = (e) => {
  const t = e.trim().match(/(?:issues\/|#)?(\d+)\s*$/);
  return t ? Number(t[1]) : null;
};
function vo({ onStarted: e, onCancel: t }) {
  const [i, r] = E(""), [s, p] = E(null), [d, f] = E(""), [h, l] = E(!1), [u, n] = E(!1), [a, I] = E("idea"), [j, z] = E(""), [D, N] = E(!1), [L, P] = E("");
  K(() => {
    ce.discoverRepos().then((R) => p(
      R.repos.filter((H) => H.slug && !H.worktree).sort((H, q) => Number(q.configured) - Number(H.configured) || H.name.localeCompare(q.name))
    )).catch((R) => {
      P(ke(R)), p([]);
    });
  }, []);
  const J = (R) => {
    l(!1), f(R), s && !s.some((H) => H.path === R) && p([...s, { path: R, name: R.split("/").pop() || R, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, X = async () => {
    const R = a === "issue" && j.trim() ? bo(j) : null;
    if (a === "issue" && j.trim() && R == null) {
      P("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !R) {
      P("Say what you want to do first.");
      return;
    }
    if (!d) {
      P("Choose which project this is for.");
      return;
    }
    N(!0), P("");
    try {
      e(await ce.startInitiative({
        path: d,
        description: i.trim() || `Issue #${R}`,
        start: a,
        worktree: u,
        sourceIssue: R
      }));
    } catch (H) {
      P(ke(H)), N(!1);
    }
  }, x = Ft.find((R) => R.id === a);
  return /* @__PURE__ */ c("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ c("div", { children: [
      /* @__PURE__ */ o("div", { style: { ...xe, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ o(Be, { children: L }),
    /* @__PURE__ */ c("label", { children: [
      it("What do you want to do?"),
      /* @__PURE__ */ o(
        "textarea",
        {
          value: i,
          onChange: (R) => r(R.target.value),
          rows: 3,
          autoFocus: !0,
          placeholder: "e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share",
          style: { ...st, resize: "vertical", lineHeight: 1.45 }
        }
      )
    ] }),
    /* @__PURE__ */ c("div", { children: [
      it("Which project is this for?"),
      /* @__PURE__ */ c(
        "select",
        {
          value: d,
          onChange: (R) => R.target.value === "__pick" ? l(!0) : f(R.target.value),
          style: st,
          disabled: s === null,
          children: [
            /* @__PURE__ */ o("option", { value: "", children: s === null ? "Looking for your projects…" : "Choose a project…" }),
            s == null ? void 0 : s.map((R) => /* @__PURE__ */ o("option", { value: R.path, children: R.slug ?? R.name }, R.path)),
            /* @__PURE__ */ o("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      d && /* @__PURE__ */ c("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(nn, { path: d }) }),
        /* @__PURE__ */ c("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: v.body }, children: [
          /* @__PURE__ */ o("input", { type: "checkbox", checked: u, onChange: (R) => n(R.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ c("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ o("span", { style: B, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      h && /* @__PURE__ */ o("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ o(on, { busy: null, onAdd: J, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ c("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ o("legend", { style: { padding: 0 }, children: it("Where does this start?") }),
      /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: Ft.map((R) => {
        const H = a === R.id;
        return /* @__PURE__ */ c(
          "label",
          {
            style: {
              display: "block",
              padding: "8px 10px 9px",
              cursor: "pointer",
              borderRadius: 8,
              border: `1px solid ${H ? "var(--accent)" : "var(--border)"}`,
              background: H ? "var(--accent-subtle, var(--bg-elevated))" : "var(--card, var(--bg))",
              color: "var(--text)"
            },
            children: [
              /* @__PURE__ */ o(
                "input",
                {
                  type: "radio",
                  name: "start",
                  checked: H,
                  onChange: () => I(R.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ o("div", { style: { ...xe, fontSize: v.body }, children: R.title }),
              /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small, marginTop: 3, lineHeight: 1.4 }, children: R.hint })
            ]
          },
          R.id
        );
      }) }),
      /* @__PURE__ */ c("div", { style: { ...B, fontSize: v.small, marginTop: 8 }, children: [
        "Starts with ",
        x.begins
      ] })
    ] }),
    a === "issue" && /* @__PURE__ */ c("label", { children: [
      it("Which issue? (optional)"),
      /* @__PURE__ */ o(
        "input",
        {
          value: j,
          onChange: (R) => z(R.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: st
        }
      )
    ] }),
    /* @__PURE__ */ c("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ o(Ie, { primary: !0, disabled: D, onClick: X, children: D ? "Starting…" : "Start the conversation" }),
      t && /* @__PURE__ */ o(Ie, { onClick: t, children: "Never mind" })
    ] }),
    /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small, lineHeight: 1.5 }, children: "Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo." })
  ] });
}
const Yt = 6, Le = (e, t) => (e.blockers ?? e.blockedBy).filter((i) => t.has(i) && i !== e.number);
function wo(e, t) {
  const i = new Map(e.map((a) => [a.number, a])), r = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), p = (a) => {
    if (r.has(a.number)) return r.get(a.number);
    if (s.has(a.number)) return 0;
    s.add(a.number);
    const I = Le(a, i), j = I.length ? 1 + Math.max(...I.map((z) => p(i.get(z)))) : 0;
    return s.delete(a.number), r.set(a.number, j), j;
  };
  e.forEach(p);
  const d = e.length ? Math.max(...e.map((a) => r.get(a.number))) + 1 : 0, f = t ? [e.filter((a) => a.lane === "decide"), e.filter((a) => a.lane !== "decide")] : [e], h = /* @__PURE__ */ new Map(), l = [];
  let u = 0, n = null;
  return f.forEach((a, I) => {
    if (!a.length) return;
    t && I === 1 && u > 0 && (n = u, u += 0.6);
    let j = 0;
    const z = [];
    for (let D = 0; D < d; D++) {
      const N = a.filter((P) => r.get(P.number) === D), L = (P) => {
        const J = Le(P, i).map((X) => h.get(X)).filter((X) => X !== void 0);
        return J.length ? J.reduce((X, x) => X + x, 0) / J.length : P.number / 1e3;
      };
      N.sort((P, J) => L(P) - L(J) || P.number - J.number), N.forEach((P, J) => h.set(P.number, u + J)), z.push(N), j = Math.max(j, N.length);
    }
    z.forEach((D, N) => {
      const L = (j - D.length) / 2;
      D.forEach((P, J) => {
        const X = u + J + L;
        h.set(P.number, X), l.push({ tile: P, col: N, row: X });
      });
    }), u += j;
  }), { placed: l, cols: d, rows: u, split: n };
}
function ko({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: s, labeled: p, bands: d, highlight: f, dimOthers: h = !0, down: l }) {
  const u = pe(null), [n, a] = E(0), [I, j] = E(null);
  if (K(() => {
    const k = u.current;
    if (!k) return;
    const te = new ResizeObserver(() => a(k.clientWidth));
    return te.observe(k), a(k.clientWidth), () => te.disconnect();
  }, []), !e.length) return null;
  const z = new Map(e.map((k) => [k.number, k])), D = /* @__PURE__ */ new Set();
  for (const k of e) for (const te of Le(k, z))
    D.add(te), D.add(k.number);
  const N = e.length > 1 ? e.filter((k) => !D.has(k.number)) : [], L = N.length ? e.filter((k) => D.has(k.number)) : e, { placed: P, cols: J, rows: X, split: x } = wo(L, !!d), R = 30, H = !!l && !d, q = d ? 52 : 0, oe = H ? 12 : d ? 64 : p ? 40 : 48, le = i > 0 && !H ? Math.min(i, 4) : 0, de = le ? oe + R : 0, Q = H ? Math.max(1, X) : J, ue = n && Q ? Math.floor((n - 2 - 2 * Yt - q - de - (Q - 1) * oe) / Q) : 168, ne = p ? Math.max(H ? 120 : 110, Math.min(d ? 240 : H ? 260 : 200, ue)) : R, y = R + 6, b = H ? 30 : p ? 10 : 8, $ = L.length ? J : 0, A = H ? (L.length ? Q * (ne + oe) - oe : 0) + 2 : q + ($ ? $ * (ne + oe) - oe : 0) + de + 2, re = x ?? X, G = H ? $ : Math.max(X, le), Z = (k) => 1 + k * (y + b), _ = L.length || le ? Z(G) - b + 1 : 0, ye = new Map(P.map((k) => [k.tile.number, H ? { x: 1 + k.row * (ne + oe), y: Z(k.col) } : { x: q + 1 + k.col * (ne + oe), y: Z(k.row) }])), We = /* @__PURE__ */ new Set();
  if (t != null) {
    We.add(t);
    const k = z.get(t);
    k && Le(k, z).forEach((te) => We.add(te)), e.forEach((te) => {
      Le(te, z).includes(t) && We.add(te.number);
    });
  }
  const he = I != null && z.has(I) ? new Set(wt(e, I).map((k) => k.number)) : null, Ne = (k) => he ? he.has(k) : (f ? f.has(k) : !0) && (t == null || !h || We.has(k)), je = (k) => k.state === "you" || k.state === "afk", Ee = (k) => je(k) && k.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${O[k.state].color}` : void 0, fe = [];
  for (const k of L) for (const te of Le(k, z)) fe.push({ from: z.get(te), to: k });
  const Me = x != null ? Z(x) + 0.3 * (y + b) - b / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ c("div", { ref: u, style: { overflowX: "auto", padding: Yt, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ c("div", { style: { position: "relative", width: A, height: _, minWidth: A }, children: [
        /* @__PURE__ */ c("svg", { width: A, height: _, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ o("defs", { children: /* @__PURE__ */ o("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ o("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          Me != null && /* @__PURE__ */ o("line", { x1: 0, x2: A, y1: Me, y2: Me, stroke: "var(--border)", strokeDasharray: "2 4" }),
          fe.map(({ from: k, to: te }) => {
            const ge = ye.get(k.number), Se = ye.get(te.number);
            if (!ge || !Se) return null;
            const qe = k.state === "done", Ce = he ? he.has(k.number) && he.has(te.number) : t != null && (k.number === t || te.number === t), Te = he ? !Ce : t != null && h && !Ce || !Ne(k.number) || !Ne(te.number), Ge = H ? (() => {
              const ze = ge.x + R / 2, Ae = ge.y + y + 2, ae = Se.x + R / 2, Oe = Se.y - 2, be = (Ae + Oe) / 2;
              return `M${ze},${Ae} C${ze},${be} ${ae},${be} ${ae},${Oe}`;
            })() : (() => {
              const ze = ge.x + ne + 2, Ae = ge.y + y / 2, ae = Se.x - 2, Oe = Se.y + y / 2, be = (ze + ae) / 2;
              return `M${ze},${Ae} C${be},${Ae} ${be},${Oe} ${ae},${Oe}`;
            })();
            return /* @__PURE__ */ o(
              "path",
              {
                d: Ge,
                fill: "none",
                stroke: Ce ? "var(--text)" : "var(--muted)",
                strokeWidth: Ce ? 1.6 : 1.2,
                strokeDasharray: qe ? "3 3" : void 0,
                opacity: Te ? 0.15 : qe ? 0.45 : 0.8,
                markerEnd: "url(#kipo-arrow)"
              },
              `${k.number}-${te.number}`
            );
          })
        ] }),
        d && P.length > 0 && ["decide", "deliver"].map((k) => {
          const te = P.filter((Se) => k === "decide" ? Se.tile.lane === "decide" : Se.tile.lane !== "decide").map((Se) => Se.row);
          if (!te.length) return null;
          const ge = (Math.min(...te) + Math.max(...te)) / 2;
          return /* @__PURE__ */ o("span", { style: { position: "absolute", left: 0, top: Z(ge) + y / 2 - 8, fontSize: v.tiny, fontWeight: 600, color: "var(--muted)" }, children: k === "decide" ? "Decide" : "Deliver" }, k);
        }),
        P.map(({ tile: k }) => {
          const te = ye.get(k.number);
          return /* @__PURE__ */ c(
            "div",
            {
              onPointerEnter: () => j(k.number),
              onPointerLeave: () => j((ge) => ge === k.number ? null : ge),
              style: {
                position: "absolute",
                left: te.x,
                top: te.y,
                width: ne,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: Ne(k.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    title: Ee(k) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: Ee(k), display: "inline-flex" },
                    children: /* @__PURE__ */ o(jt, { tile: k, size: R, onClick: () => r(k), open: k.number === t, status: s == null ? void 0 : s[k.number] })
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
                      fontSize: v.tiny,
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
        Array.from({ length: le }).map((k, te) => /* @__PURE__ */ o(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: q + 1 + $ * (ne + oe),
              top: Z(Math.max(0, (re - le) / 2) + te),
              width: R,
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
          `fog-${te}`
        ))
      ] }),
      N.length > 0 && /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: q }, children: [
        /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        N.map((k) => /* @__PURE__ */ o("span", { style: { opacity: Ne(k.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: Ee(k) }, children: /* @__PURE__ */ o(jt, { tile: k, size: R, onClick: () => r(k), open: k.number === t, status: s == null ? void 0 : s[k.number] }) }, k.number))
      ] }),
      /* @__PURE__ */ c("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: q }, children: [
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
function wt(e, t) {
  const i = new Map(e.map((f) => [f.number, f]));
  if (!i.has(t)) return [];
  const r = /* @__PURE__ */ new Set([t]), s = [t];
  for (; s.length; ) {
    const f = i.get(s.pop());
    for (const h of f ? Le(f, i) : []) r.has(h) || (r.add(h), s.push(h));
  }
  const p = /* @__PURE__ */ new Set([t]), d = [t];
  for (; d.length; ) {
    const f = d.pop();
    for (const h of e)
      !p.has(h.number) && Le(h, i).includes(f) && (p.add(h.number), r.add(h.number), d.push(h.number));
  }
  return e.filter((f) => r.has(f.number));
}
function xo(e) {
  if (!e) return "";
  const t = Math.max(0, (Date.now() - new Date(e).getTime()) / 1e3);
  return t < 60 ? "just now" : t < 3600 ? `${Math.floor(t / 60)}m ago` : t < 86400 ? `${Math.floor(t / 3600)}h ago` : `${Math.floor(t / 86400)}d ago`;
}
function So({ slot: e, active: t, ended: i }) {
  const [r, s] = E(null), [p, d] = E(""), f = pe(null), h = pe(!0);
  return K(() => {
    let l = !0;
    const u = () => ce.sessionTail(e, 60).then((a) => {
      l && (s(a.events), d(""));
    }).catch((a) => {
      l && d(ke(a));
    });
    if (u(), !t || i) return () => {
      l = !1;
    };
    const n = setInterval(u, 4e3);
    return () => {
      l = !1, clearInterval(n);
    };
  }, [e, t, i]), K(() => {
    var l;
    h.current && ((l = f.current) == null || l.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: O.building.color, flexShrink: 0 } }),
      /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.tiny, lineHeight: 1.4 }, children: i ? /* @__PURE__ */ c(me, { children: [
        "This session has ended — a read-only record of what it did, from its transcript. Its slot ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
        " is closed in Kiro."
      ] }) : /* @__PURE__ */ c(me, { children: [
        "Running in the background — read-only progress from its transcript. To chat with it, open ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
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
          /* @__PURE__ */ o(Be, { children: p }),
          r === null && !p && /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small }, children: "Reading its transcript…" }),
          r !== null && r.length === 0 && !p && /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.small }, children: "No steps recorded yet." }),
          /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: (r ?? []).map((l, u) => /* @__PURE__ */ c("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            /* @__PURE__ */ c("span", { style: { ...B, fontSize: v.tiny, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ o("span", { style: { fontWeight: 700, color: l.role === "user" ? O.you.text : "var(--muted)" }, children: l.role === "user" ? "You" : "Agent" }),
              l.ts && /* @__PURE__ */ o("span", { children: xo(l.ts) })
            ] }),
            l.tool ? /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: l.text }) : /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.5 }, children: /* @__PURE__ */ o(ft, { content: l.text }) })
          ] }, u)) }),
          /* @__PURE__ */ o("div", { ref: f })
        ]
      }
    )
  ] });
}
const Jt = 2 * 60 * 60 * 1e3, dt = /* @__PURE__ */ new Map(), $o = (e, t) => {
  const i = dt.get(`${e}:${t}`);
  return i && Date.now() - i >= Jt && dt.delete(`${e}:${t}`), !!i && Date.now() - i < Jt;
};
function Io({ state: e, slotKey: t, settled: i, onError: r, onSize: s, bottomOffset: p = 122 }) {
  const d = xt();
  for (const b of (e == null ? void 0 : e.decisions) ?? []) b.answer && t && dt.delete(`${t}:${b.id}`);
  const f = i || !t ? [] : ((e == null ? void 0 : e.decisions) ?? []).filter((b) => at(b) && !$o(t, b.id)), [h, l] = E({}), [u, n] = E(0), [a, I] = E(!1), [j, z] = E(!1), D = f.map((b) => b.id).join(","), N = pe(D);
  K(() => {
    N.current !== D && (N.current = D, n(0), l({}), D && z(!1));
  }, [D]);
  const L = pe(null), P = Re((b) => {
    var A;
    if ((A = L.current) == null || A.disconnect(), L.current = null, !b) {
      s == null || s(0);
      return;
    }
    const $ = () => s == null ? void 0 : s(b.offsetHeight);
    $(), L.current = new ResizeObserver($), L.current.observe(b);
  }, [s]);
  if (!f.length || !t) return null;
  if (j) return /* @__PURE__ */ c(
    "button",
    {
      type: "button",
      className: "kipo-pulse",
      onClick: () => z(!1),
      title: "Open the questions waiting on you",
      style: {
        position: "absolute",
        right: 16,
        bottom: p + 4,
        zIndex: 6,
        cursor: "pointer",
        borderRadius: 99,
        padding: "4px 12px",
        fontSize: v.small,
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
  const J = Math.min(u, f.length - 1), X = f[J], x = f.filter((b) => (h[b.id] ?? "").trim()), R = J === 0, H = J === f.length - 1, q = (h[X.id] ?? "") !== "" && !(X.options ?? []).includes(h[X.id] ?? ""), oe = f.filter((b) => b.recommended), le = (b) => l(($) => ({ ...$, [X.id]: b })), de = async (b = h) => {
    const $ = f.filter((Z) => (b[Z.id] ?? "").trim());
    if (!$.length) return;
    const A = f.filter((Z) => !(b[Z.id] ?? "").trim()), re = $.map((Z, _) => `${_ + 1}. ${Z.title} (${Z.id}): ${b[Z.id].trim()}`), G = [
      `My answers to your ${$.length === 1 ? "question" : `${$.length} questions`}:`,
      "",
      ...re,
      "",
      A.length ? `Still open, I'll answer later: ${A.map((Z) => Z.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
    ].join(`
`);
    I(!0);
    try {
      await d.post("/api/chat?ws=1", { slot: t, message: G });
      for (const Z of $) dt.set(`${t}:${Z.id}`, Date.now());
      l({}), n(0);
    } catch (Z) {
      r(`Couldn't send your answers: ${ke(Z)}`);
    } finally {
      I(!1);
    }
  }, Q = () => {
    const b = { ...h };
    for (const $ of oe) b[$.id] = $.recommended;
    l(b), de(b);
  }, ue = (b) => /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${b ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: b && /* @__PURE__ */ o("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), ne = (b) => {
    const $ = h[X.id] === b;
    return /* @__PURE__ */ c(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": $,
        disabled: a,
        onClick: () => le(b),
        onMouseEnter: (A) => {
          $ || (A.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (A) => {
          $ || (A.currentTarget.style.background = "transparent");
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
          border: `1px solid ${$ ? "var(--accent)" : "var(--border)"}`,
          background: $ ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
          color: "var(--text)"
        },
        children: [
          ue($),
          /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0 }, children: b }),
          b === X.recommended && /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      b
    );
  }, y = (b, $, A) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      disabled: $,
      onClick: A,
      style: {
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 10px",
        color: $ ? "var(--muted)" : "var(--text)",
        cursor: $ ? "default" : "pointer",
        fontSize: v.small,
        opacity: $ ? 0.5 : 1
      },
      children: b
    }
  );
  return /* @__PURE__ */ c(
    "div",
    {
      ref: P,
      role: "dialog",
      "aria-label": `Question ${J + 1} of ${f.length}`,
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
          /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: O.you.text }, children: f.length === 1 ? "Question" : `Question ${J + 1} of ${f.length}` }),
          f.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ o("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: f.map((b, $) => /* @__PURE__ */ o(
            "span",
            {
              title: b.title,
              onClick: () => n($),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (h[b.id] ?? "").trim() ? O.you.color : $ === J ? "var(--text)" : "var(--border)"
              }
            },
            b.id
          )) }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              onClick: () => z(!0),
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
        /* @__PURE__ */ o("div", { style: { ...xe, fontSize: v.body, marginBottom: 8, lineHeight: 1.4 }, children: X.title }),
        /* @__PURE__ */ c("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
          (X.options ?? []).map(ne),
          /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px" }, children: [
            ue(q),
            /* @__PURE__ */ o(
              "input",
              {
                value: q ? h[X.id] ?? "" : "",
                onChange: (b) => le(b.target.value),
                disabled: a,
                placeholder: "Something else…",
                "aria-label": `Another answer to: ${X.title}`,
                style: {
                  flex: 1,
                  minWidth: 0,
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: v.small,
                  border: `1px solid ${q ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: "5px 10px",
                  outline: "none"
                }
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          f.length > 1 && y("‹ Back", R, () => n(J - 1)),
          !H && y("Next ›", !1, () => n(J + 1)),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          f.length > 1 && /* @__PURE__ */ c("span", { style: { ...B, fontSize: v.tiny }, children: [
            x.length,
            " of ",
            f.length,
            " answered"
          ] }),
          oe.length > 0 && /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              disabled: a,
              onClick: Q,
              title: f.length > 1 ? `Answer all ${oe.length} with their recommendation and send` : "Take the recommendation and send",
              style: {
                background: "transparent",
                border: `1px solid ${O.you.color}`,
                borderRadius: 6,
                padding: "3px 10px",
                color: O.you.text,
                cursor: a ? "default" : "pointer",
                fontSize: v.small,
                whiteSpace: "nowrap",
                opacity: a ? 0.5 : 1
              },
              children: f.length > 1 ? "Accept all recommendations" : "Accept recommendation"
            }
          ),
          /* @__PURE__ */ o(Ie, { primary: !0, disabled: !x.length || a, onClick: () => void de(), children: a ? "Sending…" : x.length > 1 ? `Submit ${x.length} answers` : "Submit" })
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
}, ht = {
  MERGED: { label: "merged", color: "var(--ok, #3fb950)" },
  OPEN: { label: "open", color: "var(--accent)" },
  CLOSED: { label: "closed", color: "var(--muted)" }
};
function Ut({ color: e, text: t, children: i }) {
  return /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, padding: "1px 8px", borderRadius: 999, border: `1px solid ${e}`, color: t, whiteSpace: "nowrap" }, children: i });
}
function Co({ detail: e, tile: t }) {
  const [i, r] = E(null), [s, p] = E("");
  K(() => {
    let u = !0;
    return r(null), p(""), ce.ticket(e.repo, e.number, t.number).then((n) => {
      u && r(n);
    }).catch((n) => {
      u && p(ke(n));
    }), () => {
      u = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const d = e.prs.filter((u) => t.prs.includes(u.number)), f = t.state === "done", h = O[t.state];
  let l;
  return f ? l = d.some((u) => u.state === "MERGED") ? "Closed: its PR merged." : "Closed." : t.state === "review" ? l = "Its PR is open. The effort's Review merges it once it's clean." : t.state === "blocked" ? l = `Waiting on ${t.blockedBy.map((u) => `#${u}`).join(", ")}. It can start once those close.` : t.state === "building" ? l = "An agent is working on it." : t.who === "you" ? l = /* @__PURE__ */ c(me, { children: [
    /* @__PURE__ */ o(eo, { term: "HITL", children: "HITL" }),
    ": it needs you. Start it to open its conversation."
  ] }) : l = "An agent can take it on its own.", /* @__PURE__ */ c("div", { children: [
    /* @__PURE__ */ c("div", { style: { padding: "14px 16px" }, children: [
      /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ c("span", { style: { ...B, fontSize: v.small }, children: [
          "#",
          t.number,
          " · ",
          Ro[t.type]
        ] }),
        /* @__PURE__ */ o("span", { title: _e[t.state], style: { cursor: "help", display: "inline-flex" }, children: /* @__PURE__ */ o(Ut, { color: h.color === "transparent" ? "var(--border)" : h.color, text: h.text, children: h.label }) }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        /* @__PURE__ */ o("a", { href: t.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.small }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { ...xe, fontSize: v.title, marginTop: 4, lineHeight: 1.35 }, children: t.title }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, lineHeight: 1.45 }, children: l })
    ] }),
    d.length > 0 && /* @__PURE__ */ o(ut, { title: d.length === 1 ? "Pull request" : "Pull requests", children: /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: d.map((u) => {
      var n, a, I;
      return /* @__PURE__ */ c(
        "a",
        {
          href: u.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: v.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ o(Ut, { color: ((n = ht[u.state]) == null ? void 0 : n.color) ?? "var(--border)", text: ((a = ht[u.state]) == null ? void 0 : a.color) ?? "var(--muted)", children: ((I = ht[u.state]) == null ? void 0 : I.label) ?? u.state }),
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
    f && /* @__PURE__ */ o(ut, { title: "How it ended", aside: i != null && i.lastComment ? `latest of ${i.comments} comment${i.comments === 1 ? "" : "s"}` : void 0, children: s ? /* @__PURE__ */ o(Be, { children: s }) : i ? i.lastComment ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(ft, { content: i.lastComment.body }) }) : /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.small }, children: "Closed with no comment." }) : /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.small }, children: "Loading…" }) }),
    /* @__PURE__ */ o(ut, { title: f ? "What it asked" : "What it asks", defaultOpen: !f, children: s ? /* @__PURE__ */ o(Be, { children: s }) : i ? i.body.trim() ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(ft, { content: i.body }) }) : /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.small }, children: "No description." }) : /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.small }, children: "Loading…" }) })
  ] });
}
const To = (e) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ""}@${e.at}`;
function zo(e, t, i, r, s = {}) {
  const p = [], d = [], f = new Set(s.unstarted ?? []), h = (n, a) => {
    const I = a ? r[a] : void 0;
    if (I)
      return n.replace === I || a && f.has(a) ? I : null;
  }, l = (n, a) => a ? { ...n, replace: a } : n, u = (n) => (s.prs ?? []).some((a) => a.state === "OPEN" && ((a.tickets ?? []).includes(n) || (a.refs ?? []).includes(n)));
  for (const n of e) {
    const a = To(n);
    if (!(t(a) || p.includes(a))) {
      if (p.push(a), n.ticket != null) {
        const I = i.find((z) => z.number === n.ticket);
        if (!I) continue;
        const j = n.skill === "kipo-review";
        if ((I.state === "done" || I.state === "blocked") && !(j && u(I.number))) continue;
        if (j) {
          const z = h(n, `review-t${I.number}`);
          z !== null && d.push(l({ id: a, kind: "review", t: I.number }, z));
        } else {
          const z = h(n, I.sessionKey);
          z !== null && d.push(l({ id: a, kind: "tile", tile: I, skill: n.skill && !n.skill.startsWith("kipo-") ? n.skill : null }, z));
        }
      } else if (n.stage) {
        const I = h(n, n.stage);
        I !== null && d.push(l({ id: a, kind: "stage", column: n.stage, skill: n.skill && n.skill !== `kipo-${n.stage}` ? n.skill : null }, I));
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
function Mo(e, t, i) {
  return e.filter((r) => {
    var s;
    return ((s = r.stall) == null ? void 0 : s.state) === "stalled" && r.key !== "conductor" && r.slot !== t && !i(`${r.key}/${r.stall.id}`);
  });
}
const Qt = (e) => e.kind === "ticket" ? `build-t${e.t}` : e.kind === "spec" ? "build-spec" : e.kind === "decision" ? `shape-t${e.t}` : e.kind === "review" ? `review-t${e.t}` : e.kind === "stage" ? e.column : "conductor";
function Ho({ repo: e, number: t, active: i, autoStart: r, spineHost: s, spineCompact: p, onRemoved: d, onChanged: f, onNeeds: h }) {
  var zt;
  const l = xt(), u = `effort:${e}#${t}`, [n, a] = E(() => Ze(u)), [I, j] = E(""), [z, D] = E(""), [N, L] = E(() => Ze(`${u}:focus`) ?? { kind: "column" });
  K(() => {
    et(`${u}:focus`, N);
  }, [u, N]);
  const [P, J] = E(!1), [X, x] = E(!1), R = Fn("chain", 100, 0.75), H = Re(() => {
    ce.getInitiative(e, t).then((g) => {
      a(g), et(u, g), j("");
    }).catch((g) => j(ke(g)));
  }, [e, t, u]);
  K(() => {
    if (H(), !i) return;
    const g = setInterval(H, 5e3);
    return () => clearInterval(g);
  }, [H, i]);
  const q = n == null ? void 0 : n.column;
  K(() => {
    D("");
  }, [q, N]);
  const oe = pe(q);
  K(() => {
    if (q === void 0 || oe.current === q) {
      oe.current = q;
      return;
    }
    const g = oe.current !== void 0;
    oe.current = q, g && L({ kind: "column" });
  }, [q]);
  const le = n ? Qt(N) : null, de = n && le ? n.sessions[le] ?? null : null, Q = de && !Ke(de) ? de : null, ue = n && N.kind === "ticket" ? n.tickets.find((g) => g.number === N.t) ?? null : null, ne = async (g = null, w, U = !0, M = !1) => {
    if (!n) return;
    const C = w ?? N;
    J(!0), D("");
    try {
      const W = C.kind === "ticket" ? { column: "build", ticket: C.t, skill: g ?? "implement" } : C.kind === "spec" ? { column: "build", mode: "implement-spec", skill: g ?? "implement-spec" } : C.kind === "decision" ? { column: "shape", ticket: C.t, skill: g } : C.kind === "review" ? { column: "review", ticket: C.t, skill: g } : C.kind === "stage" ? { column: C.column, skill: g } : { column: n.column, mode: "conductor" }, T = await ce.startSession(e, t, M ? { ...W, replace: !0 } : W), S = C.kind === "ticket" ? `${n.title}: #${C.t}` : C.kind === "spec" ? `${n.title}: implement-spec` : C.kind === "decision" ? `${n.title}: decision #${C.t}` : C.kind === "review" ? `${n.title}: review #${C.t}` : C.kind === "stage" ? `${n.title}: ${yt[C.column]}` : `${n.title}: conductor`;
      T.existing ? await l.post("/api/chat?ws=1", { slot: T.slotName, message: T.seed }) : await to(l, e, T.slotName, T.seed, S, T.agent), T.key && await ce.sessionStarted(e, t, T.key).catch(() => ce.sessionStarted(e, t, T.key)).catch(() => {
      }), w && U && L(w), U && (H(), f());
    } catch (W) {
      D(
        W instanceof mt && W.code === "ticket_blocked" ? W.message : `Couldn't start the conversation: ${ke(W)}`
      );
    } finally {
      J(!1);
    }
  }, y = (g) => g.lane === "deliver" ? { kind: "ticket", t: g.number } : { kind: "decision", t: g.number }, b = (g) => g.lane === "deliver" ? "implement" : g.type === "research" ? "research" : g.type === "prototype" ? "prototype" : g.type === "issue" ? "triage" : null, [$, A] = E(null), re = (g) => {
    L(y(g));
  }, G = n != null && n.frontier && (N.kind === "ticket" || N.kind === "decision") ? n.frontier.tiles.find((g) => g.number === N.t) ?? null : null, [Z, _] = E({}), [ye, We] = E({}), [he, Ne] = E(null);
  K(() => {
    let g = !0;
    const w = () => (nt(), l.get("/api/chat/slots").then((M) => {
      g && Array.isArray(M) && Ne(new Set(M.filter((C) => C.key).map((C) => C.key)));
    }).catch(() => {
    }));
    if (w(), !i) return () => {
      g = !1;
    };
    const U = setInterval(w, 5e3);
    return () => {
      g = !1, clearInterval(U);
    };
  }, [l, i]);
  const je = Q && !(he !== null && !he.has(Q)) ? Q : null;
  K(() => {
    Lo(je);
  }, [je]);
  const Ee = rt(
    () => {
      var g;
      return (((g = n == null ? void 0 : n.frontier) == null ? void 0 : g.tiles) ?? []).filter((w) => w.sessionKey && (n == null ? void 0 : n.sessions[w.sessionKey]));
    },
    [n]
  );
  K(() => {
    if (!Ee.length) {
      _({}), We({});
      return;
    }
    let g = !0;
    const w = (C) => {
      const W = (C == null ? void 0 : C.content) ?? (C == null ? void 0 : C.text), T = typeof W == "string" ? W : Array.isArray(W) ? W.map((V) => typeof V == "string" ? V : (V == null ? void 0 : V.text) ?? "").join(" ") : null, S = T == null ? void 0 : T.replace(/\s+/g, " ").trim();
      return S ? S.slice(0, 140) : null;
    }, U = async () => {
      let C = /* @__PURE__ */ new Map();
      try {
        const W = await l.get("/api/chat/slots");
        g && Array.isArray(W) && (C = new Map(W.filter((T) => T.key).map((T) => [T.key, T])));
      } catch {
      }
      Promise.all(Ee.map((W) => {
        const T = n.sessions[W.sessionKey], S = C.get(T);
        return l.get(`/api/chat/slots/${encodeURIComponent(T)}?limit=1`).then((V) => {
          var Ot;
          const Je = (Ot = V == null ? void 0 : V.messages) == null ? void 0 : Ot[V.messages.length - 1], $n = (S == null ? void 0 : S.pending_approval) ?? (V == null ? void 0 : V.pending_approval), In = (S == null ? void 0 : S.needs_input) ?? (V == null ? void 0 : V.needs_input), Rn = (S == null ? void 0 : S.running) ?? (V == null ? void 0 : V.running), At = $n ? "approval" : In ? "input" : null, Cn = { at: (Je == null ? void 0 : Je.ts) ?? null, line: Je && Je.role !== "user" ? w(Je) : null, needs: At }, Tn = At ? "attention" : Rn ? "running" : W.state === "done" ? null : "waiting";
          return [W.number, Tn, Cn];
        }).catch(() => null);
      })).then((W) => {
        if (!g) return;
        const T = {}, S = {};
        for (const V of W)
          V && (V[1] && (T[V[0]] = V[1]), S[V[0]] = V[2]);
        _(T), We(S);
      });
    };
    if (U(), !i) return () => {
      g = !1;
    };
    const M = setInterval(U, 5e3);
    return () => {
      g = !1, clearInterval(M);
    };
  }, [l, Ee, i, n]);
  const fe = rt(() => {
    var U, M, C, W, T;
    if (!n) return [];
    const g = (S) => ((S == null ? void 0 : S.decisions) ?? []).filter(at).length, w = [];
    g(((U = n.sessionStates) == null ? void 0 : U.conductor) ?? n.state) && w.push({ kind: "column" });
    for (const S of ((M = n.frontier) == null ? void 0 : M.tiles) ?? [])
      S.state === "done" || !S.sessionKey || !g((C = n.sessionStates) == null ? void 0 : C[S.sessionKey]) || w.push(S.sessionKey.startsWith("review-t") ? { kind: "review", t: S.number } : S.lane === "deliver" ? { kind: "ticket", t: S.number } : { kind: "decision", t: S.number });
    for (const S of ["plan", "review", "done", "intake", "shape", "grill"])
      n.sessions[S] && g((W = n.sessionStates) == null ? void 0 : W[S]) && w.push({ kind: "stage", column: S });
    return n.sessions["build-spec"] && g((T = n.sessionStates) == null ? void 0 : T["build-spec"]) && w.push({ kind: "spec" }), w;
  }, [n]), Me = rt(
    () => fe.length + Object.values(ye).filter((g) => g && g.needs).length,
    [fe, ye]
  );
  K(() => {
    h == null || h(Me);
  }, [Me, h]), K(() => () => {
    h == null || h(0);
  }, [h]);
  const k = async (g) => {
    for (let w = 0; w < g.length; w++)
      A(`Starting ${w + 1} of ${g.length}…`), await ne(b(g[w]), y(g[w]), !1);
    A(null), H(), f();
  }, te = `kipo.autopilot:${e}#${t}`, [ge, Se] = E(() => localStorage.getItem(te) === "1"), qe = (g) => {
    Se(g), localStorage.setItem(te, g ? "1" : "0");
  }, Ce = pe(/* @__PURE__ */ new Set());
  K(() => {
    if (!ge || !i || $ || !(n != null && n.frontier)) return;
    const g = n.frontier.tiles.filter((w) => w.lane === "deliver" && w.state === "afk" && !w.sessionKey && !Ce.current.has(w.number));
    g.length && (g.forEach((w) => Ce.current.add(w.number)), k(g));
  }, [ge, i, $, n]);
  const Te = `kipo.dispatched:${e}#${t}`, Ge = pe(/* @__PURE__ */ new Set()), ze = (g) => {
    Ge.current.delete(g);
    try {
      const w = JSON.parse(localStorage.getItem(Te) || "[]");
      localStorage.setItem(Te, JSON.stringify(w.filter((U) => U !== g)));
    } catch {
    }
  };
  K(() => {
    var C, W;
    if (!i || P || $ || !(n != null && n.frontier)) return;
    const g = ((W = (C = n.sessionStates) == null ? void 0 : C.conductor) == null ? void 0 : W.dispatch) ?? [];
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(Te) || "[]");
    } catch {
      w = [];
    }
    const { fresh: U, starts: M } = zo(
      g,
      (T) => w.includes(T) || Ge.current.has(T),
      n.frontier.tiles,
      n.sessions,
      { prs: [...n.prs, ...n.refPrs ?? []], unstarted: Go(n) }
    );
    if (U.length) {
      for (const T of U)
        Ge.current.add(T), w.push(T);
      try {
        localStorage.setItem(Te, JSON.stringify(w.slice(-300)));
      } catch {
      }
      M.length && (async () => {
        for (const T of M) {
          if (T.replace && !Zt(n, T.replace) && !await qt(l, T.replace)) {
            ze(T.id);
            continue;
          }
          const S = !!T.replace;
          T.kind === "tile" ? await ne(T.skill ?? b(T.tile), y(T.tile), !1, S) : T.kind === "review" ? await ne(null, { kind: "review", t: T.t }, !1, S) : await ne(T.skill, { kind: "stage", column: T.column }, !1, S);
        }
        H(), f();
      })();
    }
  }, [i, P, $, n]);
  const Ae = `kipo.restarted:${e}#${t}`;
  K(() => {
    if (!i || P || $ || !(n != null && n.closing)) return;
    let g = [];
    try {
      g = JSON.parse(localStorage.getItem(Ae) || "[]");
    } catch {
      g = [];
    }
    const U = n.closing.filter((W) => W.started === !1 && W.key !== "conductor" && !g.includes(W.slot)).map((W) => [W, Ko(W.key)]).find(([, W]) => W);
    if (!U) return;
    const [M, C] = U;
    try {
      localStorage.setItem(Ae, JSON.stringify([...g, M.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var T;
      if (!Zt(n, M.slot) && !await qt(l, M.slot)) return;
      const W = (T = n.frontier) == null ? void 0 : T.tiles.find((S) => (C.kind === "ticket" || C.kind === "decision") && S.number === C.t);
      await ne(W ? b(W) : null, C, !1, !0), H(), f();
    })();
  }, [i, P, $, n]);
  const ae = n != null && n.sessions.conductor && !Ke(n.sessions.conductor) ? n.sessions.conductor : null, Oe = ((n == null ? void 0 : n.closing) ?? []).filter((g) => {
    var w;
    return ((w = g.stall) == null ? void 0 : w.state) === "stuck";
  }).map((g) => g.key), be = n != null && n.frontier ? JSON.stringify({
    t: n.frontier.tiles.map((g) => [g.number, g.state]),
    p: n.prs.map((g) => [g.number, g.state]),
    ...Oe.length ? { s: Oe } : {}
  }) : "";
  K(() => {
    if (!be || !ae || !i) return;
    const g = `kipo.conductorSaw:${e}#${t}`, w = localStorage.getItem(g);
    if (w === be) return;
    if (w === null) {
      localStorage.setItem(g, be);
      return;
    }
    const U = [];
    try {
      const M = JSON.parse(w), C = JSON.parse(be), W = new Map(M.t), T = new Map(M.p);
      for (const [S, V] of C.t) W.get(S) !== V && U.push(`#${S} ${W.get(S) ?? "new"} → ${V}`);
      for (const [S, V] of C.p) T.get(S) !== V && U.push(`PR #${S} ${(T.get(S) ?? "new").toLowerCase()} → ${V.toLowerCase()}`);
      for (const S of C.s ?? []) (M.s ?? []).includes(S) || U.push(`${S} stuck (woken twice, no answer)`);
    } catch {
    }
    (async () => {
      try {
        const M = await l.get(`/api/chat/slots/${encodeURIComponent(ae)}?limit=1`);
        if (M != null && M.running) return;
        await l.post("/api/chat?ws=1", {
          slot: ae,
          message: `[KiPo] Frontier changed${U.length ? `: ${U.slice(0, 12).join("; ")}` : ""}. Run the frontier and carry on.`
        }), localStorage.setItem(g, be);
      } catch {
      }
    })();
  }, [be, ae, i]), K(() => {
    const g = n == null ? void 0 : n.reports;
    if (!g || !ae || !i) return;
    const w = `kipo.reportsSent:${e}#${t}`, U = Number(localStorage.getItem(w) || "0"), M = g.reports.filter((C) => C.id > Math.max(U, g.read));
    M.length && (async () => {
      try {
        const C = await l.get(`/api/chat/slots/${encodeURIComponent(ae)}?limit=1`);
        if (C != null && C.running) return;
        const W = (S) => {
          var V;
          return `${S.event}: ${S.text}${(V = S.items) != null && V.length ? ` (${S.items.join("; ")})` : ""}`;
        }, T = M.length === 1 ? `[KiPo] Report from ${M[0].from}: ${W(M[0])}` : `[KiPo] Reports from the sessions:
${M.slice(-12).map((S) => `- ${S.from} ${W(S)}`).join(`
`)}`;
        await l.post("/api/chat?ws=1", { slot: ae, message: `${T}
Run the frontier and carry on.` }), localStorage.setItem(w, String(M[M.length - 1].id));
      } catch {
      }
    })();
  }, [n, ae, i]);
  const Fe = (g, w) => {
    if (n) {
      if (n.sessions[g]) {
        L({ kind: "stage", column: g });
        return;
      }
      ne(w, { kind: "stage", column: g });
    }
  }, m = () => Fe("plan", "to-spec"), ee = () => Fe("review", null), F = () => Fe("done", "retro"), Y = async () => {
    if (n) {
      x(!0), D("");
      try {
        n.column !== "done" && await ce.advance(e, t, !0, "done"), await ce.advance(e, t, !0, null), await Gt(l, Object.values(n.sessions), null), d();
      } catch (g) {
        D(`Couldn't close it: ${ke(g)}`), x(!1);
      }
    }
  }, Pe = pe(!1);
  K(() => {
    if (!(n != null && n.closing) || !i || Pe.current) return;
    const g = n.closing.filter((w) => w.status === "closable");
    g.length && (Pe.current = !0, Gt(l, g.map((w) => w.slot), Q).then((w) => {
      const U = g.filter((M) => w.includes(M.slot)).map((M) => M.key);
      return U.length ? ce.sessionsClosed(e, t, U).then(() => H()) : void 0;
    }).catch(() => {
    }).finally(() => {
      Pe.current = !1;
    }));
  }, [l, n, i, Q]);
  const ve = JSON.stringify(Wo((n == null ? void 0 : n.closing) ?? []).filter((g) => !Ke(g.slot)).map((g) => [g.key, g.slot]));
  K(() => {
    const g = JSON.parse(ve);
    if (!i || !g.length) return;
    let w = !0;
    const U = () => {
      Promise.all(g.map(
        ([C, W]) => l.get(`/api/chat/slots/${encodeURIComponent(W)}?limit=1`).then((T) => [C, Eo(T)]).catch(() => null)
      )).then((C) => {
        if (!w) return;
        const W = Object.fromEntries(C.filter((T) => T && T[1]).map((T) => [T[0], T[1]]));
        Object.keys(W).length && ce.sessionsActivity(e, t, W).catch(() => {
        });
      });
    };
    U();
    const M = setInterval(U, 3e4);
    return () => {
      w = !1, clearInterval(M);
    };
  }, [l, ve, i, e, t]);
  const De = `kipo.woke:${e}#${t}`, Ye = `kipo.wokeNotes:${e}#${t}`, se = pe(!1);
  K(() => {
    if (!(n != null && n.closing) || !i || se.current) return;
    let g = [];
    try {
      g = JSON.parse(localStorage.getItem(De) || "[]");
    } catch {
      g = [];
    }
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(Ye) || "[]");
    } catch {
      w = [];
    }
    const U = Mo(n.closing, Q, (M) => g.includes(M)).filter((M) => !Ke(M.slot));
    !U.length && !(w.length && ae) || (se.current = !0, (async () => {
      for (const M of U) {
        const C = M.stall;
        try {
          const W = await l.get(`/api/chat/slots/${encodeURIComponent(M.slot)}?limit=1`);
          if (W != null && W.running) continue;
          await l.post("/api/chat?ws=1", { slot: M.slot, message: Ao(C.why) }), g = [...g, `${M.key}/${C.id}`].slice(-300), localStorage.setItem(De, JSON.stringify(g)), w = [...w, Oo(M.key, C.why)], localStorage.setItem(Ye, JSON.stringify(w)), await ce.sessionsWoken(e, t, M.key, C.id ?? "", C.why);
        } catch {
        }
      }
      if (w.length && ae)
        try {
          const M = await l.get(`/api/chat/slots/${encodeURIComponent(ae)}?limit=1`);
          M != null && M.running || (await l.post("/api/chat?ws=1", { slot: ae, message: `${w.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(Ye, "[]"));
        } catch {
        }
      U.length && H();
    })().finally(() => {
      se.current = !1;
    }));
  }, [l, n, i, Q, ae]);
  const we = pe(!1);
  if (K(() => {
    !r || we.current || !n || (we.current = !0, n.sessions[n.column] || ne());
  }, [r, n]), !n)
    return /* @__PURE__ */ o("div", { style: { flex: 1, padding: 24 }, children: I ? /* @__PURE__ */ o(Be, { children: I }) : /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.body }, children: "Loading…" }) });
  const He = le ? ((zt = n.sessionStates) == null ? void 0 : zt[le]) ?? null : n.state, ot = (He == null ? void 0 : He.skillsUsed) ?? [], gn = () => {
    if (!fe.length) return;
    const g = fe.findIndex((w) => Qt(w) === le);
    L(fe[(g + 1) % fe.length]);
  }, Rt = pe(null), mn = () => {
    var g, w;
    try {
      (w = (g = Rt.current) == null ? void 0 : g.contentWindow) == null || w.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [Qe, yn] = E(!1), [Ct, bn] = E(0), vn = Re((g) => bn((w) => Math.abs(w - g) > 4 ? g : w), []), [Tt, wn] = E(128), kn = Re((g) => wn((w) => Math.abs(w - g) > 4 ? g : w), []), xn = G ? G.state === "done" : !!de && Ke(de), Sn = N.kind === "column" ? He ?? n.state : He;
  return /* @__PURE__ */ c("div", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ o("style", { children: "@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}" }),
    /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", minWidth: 0 }, children: [
      /* @__PURE__ */ c("span", { style: { ...xe, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, title: n.title, children: [
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
          children: /* @__PURE__ */ o(bt, { kind: n.kind, map: n.kind === "map" ? n.number : n.mapIssue })
        }
      ),
      /* @__PURE__ */ o("span", { style: { flex: 1 } }),
      /* @__PURE__ */ o("span", { style: { ...B, fontSize: v.tiny, whiteSpace: "nowrap" }, title: n.repoPath, children: n.repo })
    ] }),
    z && /* @__PURE__ */ o("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ o(Be, { children: z }) }),
    (() => {
      var T;
      const g = /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ o("span", { style: { ...Q ? B : xe, fontSize: Q ? v.small : v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: G ? `#${G.number}${Q ? "" : ` ${G.title}`}` : N.kind === "column" ? "Conductor" : n.title }),
        Q && ot.length > 0 && /* @__PURE__ */ o(qo, { skills: ot }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        G && (n.frontier ? wt(n.frontier.tiles, G.number).length > 1 : !1) && /* @__PURE__ */ c(
          "button",
          {
            type: "button",
            onClick: () => yn((S) => !S),
            "aria-pressed": Qe,
            title: "Show or hide this ticket's map — what it waits on and what it unblocks",
            "aria-label": "Show or hide the map",
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              background: Qe ? "var(--bg-elevated)" : "transparent",
              color: Qe ? "var(--text)" : "var(--muted)",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: v.small,
              border: `1px solid ${Qe ? "var(--border)" : "transparent"}`
            },
            children: [
              /* @__PURE__ */ o(Nn, { size: 14 }),
              " Map"
            ]
          }
        ),
        Q && /* @__PURE__ */ o(
          "button",
          {
            type: "button",
            onClick: mn,
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
            onMouseEnter: (S) => {
              S.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))", S.currentTarget.style.color = "var(--text)";
            },
            onMouseLeave: (S) => {
              S.currentTarget.style.background = "transparent", S.currentTarget.style.color = "var(--muted)";
            },
            children: /* @__PURE__ */ o(Pn, { size: 15 })
          }
        )
      ] }), w = G && (G.state === "you" || G.state === "afk"), U = !!Q && he !== null && !he.has(Q), M = Q && U ? /* @__PURE__ */ o(So, { slot: Q, active: i, ended: !0 }) : Q ? (
        // The card sits `composerH` up, so the transcript must clear the
        // composer, the card, and a gap above it.
        /* @__PURE__ */ o(
          Bo,
          {
            slotKey: Q,
            frameRef: Rt,
            padBottom: Ct ? Tt + Ct + 24 : 0,
            onComposerH: kn
          },
          Q
        )
      ) : G ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          w && /* @__PURE__ */ c("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ o(Ie, { primary: !0, disabled: P, onClick: () => ne(b(G)), children: P ? "Starting…" : ((T = fn[G.type]) == null ? void 0 : T.action) ?? "Start this ticket" }),
            Vt(G, null).map((S) => /* @__PURE__ */ c(
              "button",
              {
                type: "button",
                disabled: P,
                onClick: () => ne(S.skill),
                title: St[S.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: P ? "default" : "pointer", fontSize: v.small },
                children: [
                  "/",
                  S.skill,
                  " ",
                  /* @__PURE__ */ o("span", { style: B, children: S.label })
                ]
              },
              S.skill
            ))
          ] }),
          /* @__PURE__ */ o(Co, { detail: n, tile: G })
        ] })
      ) : /* @__PURE__ */ o(
        jo,
        {
          detail: n,
          focus: N,
          ticket: ue,
          tile: null,
          starting: P,
          onStart: () => ne(null),
          alternatives: Vt(null, N.kind === "column" ? n.column : null),
          onSkill: (S) => ne(S)
        }
      ), C = G && n.frontier ? wt(n.frontier.tiles, G.number) : [], W = s ? Dn(
        /* @__PURE__ */ o(
          co,
          {
            detail: n,
            statuses: Z,
            activity: ye,
            busy: X || P || !!$,
            autopilot: ge,
            selectedKey: le,
            embedded: !0,
            compact: p,
            onAutopilot: qe,
            onOpenTile: re,
            onOpenConversation: (S) => L(S === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(S) ? { kind: "review", t: Number(S.slice(8)) } : { kind: "stage", column: S }),
            onSelectConductor: () => L({ kind: "column" }),
            onJumpQuestions: gn,
            onHandover: m,
            onReview: ee,
            onRetro: F,
            onClose: Y
          }
        ),
        s
      ) : null;
      return /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        W,
        /* @__PURE__ */ c("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          g,
          G && C.length > 1 && Qe && /* @__PURE__ */ c(me, { children: [
            /* @__PURE__ */ c("div", { ref: R.ref, style: { ...R.style }, children: [
              /* @__PURE__ */ o("div", { style: { padding: "6px 16px 0", fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ o(ko, { tiles: C, focus: G.number, onOpen: re, labeled: !0, dimOthers: !1, statuses: Z, down: !0 })
            ] }),
            /* @__PURE__ */ o(
              ln,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: R.onDrag,
                onReset: R.reset
              }
            )
          ] }),
          /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            M,
            /* @__PURE__ */ o(Io, { state: Sn, slotKey: Q, settled: xn, onError: D, onSize: vn, bottomOffset: Tt + 10 }, Q ?? "none")
          ] })
        ] })
      ] });
    })()
  ] });
}
function Xt(e) {
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
let kt = null;
function Lo(e) {
  kt = e, nt();
}
function nt() {
  try {
    const e = [...document.querySelectorAll("iframe[data-kipo-frame]")];
    let t = null, i = -1;
    if (kt !== null)
      for (const r of e) {
        if (r.getAttribute("data-kipo-frame") !== kt) continue;
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
  const s = `/popout/chat?sid=${encodeURIComponent(e)}`, p = pe(null), d = pe(i);
  d.current = i;
  const f = Re(() => {
    var l;
    try {
      const u = (l = t.current) == null ? void 0 : l.contentDocument;
      if (!u) return;
      let n = u.getElementById("kipo-qcard-css");
      !n && u.head && (n = u.createElement("style"), n.id = "kipo-qcard-css", u.head.appendChild(n));
      const a = d.current ? ".followup-chip{display:none !important}" : "";
      if (n && n.textContent !== a && (n.textContent = a), r) {
        const z = u.querySelector('[data-testid="composer-dock-root"]') ?? u.querySelector('[data-testid="composer-dock"]'), D = z ? Math.round(z.getBoundingClientRect().height) : 0;
        D > 0 && r(D);
      }
      let I = p.current;
      if (!I || !I.isConnected || I.ownerDocument !== u) {
        const z = u.defaultView;
        I = [...u.querySelectorAll("div")].filter((N) => {
          if (N.clientHeight < 200) return !1;
          const L = z == null ? void 0 : z.getComputedStyle(N);
          return !!L && (L.overflowY === "auto" || L.overflowY === "scroll");
        }).sort((N, L) => L.clientHeight - N.clientHeight)[0] ?? null, p.current = I;
      }
      if (!I) return;
      const j = d.current ? `${d.current}px` : "";
      I.style.paddingBottom !== j && (I.style.paddingBottom = j);
    } catch {
    }
  }, [t]);
  K(() => {
    f();
  }, [f, i]), K(() => {
    Xt(e);
  }, [e]), K(() => {
    const l = t.current;
    return l && l.setAttribute("data-kipo-gen", String(Do())), nt(), () => {
      requestAnimationFrame(nt);
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
        const I = a.createElement("style");
        I.id = "kipo-popout-css", I.textContent = [
          '[title*="main window" i]',
          '[aria-label*="main window" i]',
          '[title*="split view" i]',
          '[aria-label*="split view" i]',
          '[aria-label="Close panel"]',
          '[title="Close panel"]'
        ].join(",") + "{display:none !important}", a.head.appendChild(I);
      }
    } catch {
    }
  };
  return K(() => {
    const l = [], u = window.setInterval(() => {
      var a;
      const n = t.current;
      try {
        const I = (a = n == null ? void 0 : n.contentWindow) == null ? void 0 : a.location.pathname;
        if (n && I && !I.startsWith("/popout/chat")) {
          const z = Date.now();
          for (; l.length && z - l[0] > 6e5; ) l.shift();
          l.length < 5 && (l.push(z), Xt(e), n.src = s);
          return;
        }
        nt();
        const j = n == null ? void 0 : n.contentDocument;
        j && No(j);
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
const fn = {
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
    const n = fn[r.type];
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
    h = `${yt[n]} hasn't started`, l = a ? "Plan continues the Grill conversation, so the spec and tickets are written with everything it learned." : `${Bn[n]}`, u = a ? "Continue in the Grill conversation" : `Start ${yt[n]}`;
  }
  return /* @__PURE__ */ o("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ c("div", { style: { maxWidth: 400, textAlign: "center" }, children: [
    /* @__PURE__ */ o("div", { style: { ...xe, fontSize: v.title }, children: h }),
    /* @__PURE__ */ o("div", { style: { ...B, fontSize: v.body, margin: "6px 0 14px", lineHeight: 1.5 }, children: l }),
    /* @__PURE__ */ o("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }, children: u && /* @__PURE__ */ o(Ie, { primary: !0, disabled: s, onClick: p, children: s ? "Starting…" : u }) }),
    u && d.map((n) => /* @__PURE__ */ c("div", { style: { marginTop: 10, fontSize: v.small }, children: [
      /* @__PURE__ */ o("span", { style: B, children: "or " }),
      /* @__PURE__ */ c(
        "button",
        {
          type: "button",
          disabled: s,
          onClick: () => f(n.skill),
          title: St[n.skill],
          style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: s ? "default" : "pointer", fontSize: v.small },
          children: [
            "/",
            n.skill
          ]
        }
      ),
      /* @__PURE__ */ c("span", { style: B, children: [
        " ",
        n.label
      ] })
    ] }, n.skill))
  ] }) });
}
function Vt(e, t) {
  return (e ? e.type === "grilling" : t === "grill") ? [{ skill: "grill-me", label: "without writing docs" }] : [];
}
function qo({ skills: e }) {
  return /* @__PURE__ */ c("span", { style: { ...B, fontSize: v.tiny, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: [
    "Running",
    " ",
    e.map((t, i) => /* @__PURE__ */ c("span", { children: [
      i > 0 && " · ",
      /* @__PURE__ */ o("span", { title: St[t] ?? t, style: { color: "var(--text)", cursor: "help" }, children: t })
    ] }, t))
  ] });
}
const Go = (e) => (e.closing ?? []).filter((t) => t.started === !1).map((t) => t.key);
function Ko(e) {
  const t = /^(build|shape|review)-t(\d+)$/.exec(e);
  return t ? { kind: t[1] === "build" ? "ticket" : t[1] === "shape" ? "decision" : "review", t: Number(t[2]) } : e === "build-spec" ? { kind: "spec" } : ["intake", "shape", "grill", "plan", "review", "done"].includes(e) ? { kind: "stage", column: e } : null;
}
const Zt = (e, t) => Object.values(e.sessions).filter((i) => i === t).length > 1;
function Xo() {
  const e = zn(), t = (e == null ? void 0 : e.active) !== !1, i = xt(), [r, s] = E(() => Ze("initiatives")), [p, d] = E(() => Ze("repos")), [f, h] = E(!1), [l, u] = E(""), [n, a] = E(() => {
    const y = Ze("main");
    return !y || !["new", "initiative"].includes(y.kind) ? null : y.kind === "initiative" ? { ...y, autoStart: void 0 } : y;
  });
  K(() => {
    n && et("main", n);
  }, [n]);
  const [I, j] = sn("rail", 300, 168, 620), [z, D] = E(null), [N, L] = E(() => localStorage.getItem("kipo.railOpen") !== "0"), P = (y) => {
    L(y), localStorage.setItem("kipo.railOpen", y ? "1" : "0");
  };
  K(() => {
    Xn(i).catch(() => {
    });
  }, [i]);
  const [J, X] = E(""), x = Re(() => {
    ce.listInitiatives().then((y) => {
      var b;
      s(y.initiatives), et("initiatives", y.initiatives), d(y.repos ?? []), et("repos", y.repos ?? []), u(""), X((b = y.errors) != null && b.length ? `GitHub is refusing calls for ${y.errors.length === 1 ? y.errors[0].repo.split("/").pop() : `${y.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch((y) => u(ke(y)));
  }, []);
  K(() => {
    if (x(), !t) return;
    const y = setInterval(x, 15e3);
    return () => clearInterval(y);
  }, [x, t]), K(() => {
    if (r === null) return;
    const y = (n == null ? void 0 : n.kind) === "initiative" && !r.some(($) => $.repo === n.repo && $.number === n.number);
    if (n && !y) return;
    const b = r[0];
    a(b ? { kind: "initiative", repo: b.repo, number: b.number } : { kind: "new" });
  }, [r, n]);
  const R = (y, b) => a({ kind: "initiative", repo: y.repo, number: y.number, autoStart: b }), H = (y) => {
    s((b) => (b ?? []).filter(($) => !($.repo === y.repo && $.number === y.number))), ce.hide(y.repo, y.number).then(x).catch((b) => {
      u(ke(b)), x();
    });
  }, q = (y) => {
    s((b) => (b ?? []).filter(($) => !($.repo === y.repo && $.number === y.number))), ce.removeInitiative(y.repo, y.number).then(x).catch((b) => {
      u(ke(b)), x();
    });
  }, oe = (y) => {
    d((b) => (b ?? []).filter(($) => $.slug !== y)), s((b) => (b ?? []).filter(($) => $.repo !== y)), ce.removeRepo(y).then(x).catch((b) => {
      u(ke(b)), x();
    });
  }, le = (y, b) => {
    Promise.allSettled(b.map(($) => ce.unhide(y, $))).then(x);
  }, de = (n == null ? void 0 : n.kind) === "initiative" ? `${n.repo}#${n.number}` : null, [Q, ue] = E(0), ne = Re((y) => ue(y), []);
  return /* @__PURE__ */ c("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    N ? /* @__PURE__ */ c(me, { children: [
      /* @__PURE__ */ o(
        mo,
        {
          width: I,
          onCollapse: () => P(!1),
          items: r,
          repos: p,
          error: l,
          notice: J,
          selected: de,
          attention: Q,
          spineSlot: D,
          onNew: () => a({ kind: "new" }),
          onAddRepo: () => h(!0),
          onRemoveRepo: oe,
          onRestore: le,
          onSelect: (y) => R(y),
          onHide: H,
          onRemove: q
        }
      ),
      /* @__PURE__ */ o(ln, { direction: "vertical", label: "Resize the effort list", onDrag: (y) => j((b) => b + y), onReset: () => j(228) })
    ] }) : /* @__PURE__ */ o(
      yo,
      {
        items: r,
        selected: de,
        attention: Q,
        onNew: () => a({ kind: "new" }),
        onSelect: (y) => R(y),
        onExpand: () => P(!0)
      }
    ),
    /* @__PURE__ */ c("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (n == null ? void 0 : n.kind) === "new" && /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ o(
        vo,
        {
          onStarted: (y) => {
            x(), R(y, !0);
          },
          onCancel: r && r.length ? () => a(r[0] ? { kind: "initiative", repo: r[0].repo, number: r[0].number } : { kind: "new" }) : void 0
        }
      ) }),
      (n == null ? void 0 : n.kind) === "initiative" && /* @__PURE__ */ o(
        Ho,
        {
          repo: n.repo,
          number: n.number,
          autoStart: n.autoStart,
          active: t,
          spineHost: N ? z : null,
          spineCompact: I < 340,
          onChanged: x,
          onRemoved: () => {
            x(), a(null);
          },
          onNeeds: ne
        },
        `${n.repo}#${n.number}`
      )
    ] }),
    f && /* @__PURE__ */ o(_n, { onAdded: x, onClose: () => h(!1) })
  ] });
}
export {
  Xo as default
};
