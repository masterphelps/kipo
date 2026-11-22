import { jsxs as d, jsx as o, Fragment as ke } from "react/jsx-runtime";
import { useAppApi as zt, useAppInfo as Kn } from "@kirocrew/app-sdk";
import { useState as A, useCallback as We, useEffect as Q, useRef as ye, useLayoutEffect as _n, useMemo as pt } from "react";
import { Btn as Oe, Badge as Ft, MarkdownRenderer as kt } from "@kirocrew/app-sdk/ui";
import { X as qn, FolderGit2 as fn, FolderOpen as Gn, MessageSquare as gn, ChevronRight as xt, Plus as Fn, FolderPlus as Jn, MoreHorizontal as Jt, ExternalLink as Yt, EyeOff as Yn, Trash2 as Ut, Map as Un, PanelRight as Qn } from "lucide-react";
import { createPortal as Xn } from "react-dom";
const Vn = "/apps/kipo/api";
class St extends Error {
  constructor(t, i, r) {
    super(i), this.name = "BackendError", this.status = t, this.code = r;
  }
}
async function de(e, t = "GET", i) {
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
  let f;
  if (l.trim())
    try {
      f = JSON.parse(l);
    } catch {
      f = void 0;
    }
  if (!r.ok) {
    const h = f ?? {}, g = typeof h.error == "string" && h.error ? h.error : `The KiPo backend answered ${r.status}.`;
    throw new St(r.status, g, typeof h.code == "string" ? h.code : null);
  }
  return f;
}
const ze = (e, t) => {
  const [i, r] = e.split("/");
  return `/initiatives/${encodeURIComponent(i)}/${encodeURIComponent(r)}/${t}`;
}, fe = {
  getConfig: () => de("/config"),
  putConfig: (e) => de("/config", "PUT", e),
  discoverRepos: () => de("/repos/discover"),
  addRepo: (e) => de("/repos", "POST", { path: e }),
  removeRepo: (e) => de("/repos/remove", "POST", { slug: e }),
  browse: (e) => de(e ? `/browse?path=${encodeURIComponent(e)}` : "/browse"),
  listInitiatives: () => de("/initiatives"),
  startInitiative: (e) => de("/initiatives", "POST", e),
  getInitiative: (e, t) => de(ze(e, t)),
  // Next along the path, or `to` a later column.
  advance: (e, t, i, r = null) => de(`${ze(e, t)}/advance`, "POST", { force: i, to: r }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (e, t, i) => de(`${ze(e, t)}/session`, "POST", { skill: null, ticket: null, mode: null, ...i }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (e, t, i) => de(`${ze(e, t)}/sessions/started`, "POST", { key: i }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (e, t, i) => de(`${ze(e, t)}/sessions/closed`, "POST", { keys: i }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (e, t, i) => de(`${ze(e, t)}/sessions/activity`, "POST", { activity: i }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (e, t, i, r, l) => de(`${ze(e, t)}/sessions/woken`, "POST", { key: i, stall: r, why: l }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (e, t, i) => de(`${ze(e, t)}/skill`, "POST", { skill: i }),
  listSessions: () => de("/sessions"),
  tree: (e = !1) => de(e ? "/tree?completed=1" : "/tree"),
  // A background session's recent transcript, when the dashboard never opened
  // it as a page (so the embedded chat would be empty).
  sessionTail: (e, t = 60) => de(
    `/sessions/tail?slot=${encodeURIComponent(e)}&limit=${t}`
  ),
  // The green dot: on the sidebar or off. Nothing changes on GitHub.
  setOnSidebar: (e, t, i, r) => de("/sidebar", "POST", { repo: e, number: t, kind: i, on: r }),
  // Off the sidebar and back; nothing changes on GitHub.
  hide: (e, t) => de(`${ze(e, t)}/hide`, "POST", {}),
  unhide: (e, t) => de(`${ze(e, t)}/unhide`, "POST", {}),
  removeInitiative: (e, t) => de(`${ze(e, t)}/remove`, "POST", {}),
  ticket: (e, t, i) => de(`${ze(e, t)}/tickets/${i}`),
  frontier: (e, t) => de(`${ze(e, t)}/frontier`),
  doc: (e, t, i) => de(`${ze(e, t)}/doc?href=${encodeURIComponent(i)}`)
};
function Ie(e) {
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
}, oo = (e) => eo.find((t) => no[t].includes(e)) ?? "intake", At = (e) => !e.answer && typeof e.title == "string" && e.title.trim() !== "", b = {
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
  fontSize: b.body,
  width: "100%",
  minWidth: 0
}, G = { color: "var(--muted)" }, Re = { color: "var(--text-strong, var(--text))", fontWeight: 600 };
function _e({ children: e }) {
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
function mn({ path: e }) {
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
function Qt({ children: e, onClick: t, disabled: i, primary: r, danger: l, title: f }) {
  const h = r ? "var(--accent)" : l ? "var(--danger-subtle)" : "var(--bg-elevated)", g = r ? "var(--accent-fg, #fff)" : l ? "var(--danger-text)" : "var(--text)";
  return /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      onClick: t,
      disabled: i,
      title: f,
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
        background: h,
        color: g,
        cursor: i ? "default" : "pointer",
        opacity: i ? 0.5 : 1
      },
      children: e
    }
  );
}
function yt({ title: e, aside: t, children: i, defaultOpen: r = !0 }) {
  const [l, f] = A(r);
  return /* @__PURE__ */ d("section", { style: { borderTop: "1px solid var(--border)" }, children: [
    /* @__PURE__ */ d(
      "button",
      {
        type: "button",
        onClick: () => f((h) => !h),
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
          fontSize: b.small
        },
        children: [
          /* @__PURE__ */ o("span", { "aria-hidden": !0, style: { ...G, width: 10, fontSize: 9 }, children: l ? "▾" : "▸" }),
          /* @__PURE__ */ o("span", { style: Re, children: e }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          t != null && /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny }, children: t })
        ]
      }
    ),
    l && /* @__PURE__ */ o("div", { style: { padding: "0 12px 10px 28px", fontSize: b.body }, children: i })
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
  const f = Math.round(l / 24);
  return f < 30 ? `${f} d ago` : new Date(t).toLocaleDateString();
}
function $t({ kind: e, map: t }) {
  if (e !== "map" && !t) return null;
  const i = e === "map";
  return /* @__PURE__ */ d(
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
  var c;
  const [r, l] = A(null), [f, h] = A(""), g = We(async (s) => {
    h("");
    try {
      l(await fe.browse(s));
    } catch (p) {
      h(Ie(p));
    }
  }, []);
  return Q(() => {
    g();
  }, [g]), /* @__PURE__ */ d(
    "div",
    {
      className: "rounded-md p-3 mb-3",
      style: { background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ o(_e, { children: f }),
        r ? /* @__PURE__ */ d(ke, { children: [
          /* @__PURE__ */ d("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ o(Oe, { disabled: !r.parent, onClick: () => r.parent && g(r.parent), children: "Up" }),
            /* @__PURE__ */ o(mn, { path: r.path }),
            ((c = r.here) == null ? void 0 : c.slug) && /* @__PURE__ */ d(Oe, { primary: !0, disabled: e === r.path, onClick: () => t(r.path), children: [
              i,
              " this folder"
            ] })
          ] }),
          /* @__PURE__ */ d("ul", { className: "flex flex-col max-h-72 overflow-y-auto", children: [
            r.folders.map((s) => /* @__PURE__ */ d("li", { className: "flex items-center gap-2 py-1", children: [
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  className: "text-sm text-left flex-1 truncate hover:underline",
                  style: { background: "transparent", color: "var(--text)" },
                  onClick: () => g(s.path),
                  children: s.name
                }
              ),
              s.repo && (s.slug ? /* @__PURE__ */ d(ke, { children: [
                /* @__PURE__ */ o(Ft, { variant: "aim", children: s.slug }),
                /* @__PURE__ */ o(Oe, { primary: !0, disabled: e === s.path, onClick: () => t(s.path), children: i })
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
  const [i, r] = A(null), [l, f] = A(""), [h, g] = A(!1), [c, s] = A(null);
  Q(() => {
    let n = !0;
    return fe.tree().then((a) => {
      n && r(a.available);
    }).catch((a) => {
      n && (r([]), f(Ie(a)));
    }), () => {
      n = !1;
    };
  }, []), Q(() => {
    const n = (a) => {
      a.key === "Escape" && t();
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [t]);
  const p = async (n) => {
    s(n), f("");
    try {
      await fe.addRepo(n), e(), t();
    } catch (a) {
      f(Ie(a));
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
      children: /* @__PURE__ */ d(
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
            /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
              /* @__PURE__ */ d("div", { style: { flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ o("div", { style: { ...Re, fontSize: b.body }, children: "Add a repo" }),
                /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.tiny, marginTop: 1 }, children: "It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed." })
              ] }),
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  onClick: t,
                  "aria-label": "Close",
                  style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 4, borderRadius: 6, display: "inline-flex" },
                  children: /* @__PURE__ */ o(qn, { size: 15 })
                }
              )
            ] }),
            /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 14px" }, children: [
              /* @__PURE__ */ o(_e, { children: l }),
              i === null && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "6px 6px" }, children: "Looking for checkouts on this Mac…" }),
              i !== null && i.length > 0 && !h && /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column" }, children: i.slice(0, 12).map((n) => /* @__PURE__ */ d(
                "button",
                {
                  type: "button",
                  disabled: !!c,
                  onClick: () => void p(n.path),
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
                    cursor: c ? "default" : "pointer",
                    textAlign: "left"
                  },
                  children: [
                    /* @__PURE__ */ o(fn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, fontSize: b.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: c === n.path ? "Adding…" : n.slug }),
                    n.maps > 0 && /* @__PURE__ */ d("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0 }, children: [
                      n.maps,
                      " open map",
                      n.maps === 1 ? "" : "s"
                    ] })
                  ]
                },
                n.path
              )) }),
              i !== null && i.length === 0 && !h && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "6px 6px" }, children: "No un-added checkouts found under your home folder. Browse for one:" }),
              h ? /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(yn, { busy: c, onAdd: (n) => void p(n) }) }) : /* @__PURE__ */ d(
                "button",
                {
                  type: "button",
                  onClick: () => g(!0),
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
                    /* @__PURE__ */ o(Gn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    "Browse for a folder…"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ o("div", { style: { display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderTop: "1px solid var(--border)" }, children: /* @__PURE__ */ o(Oe, { onClick: t, children: "Cancel" }) })
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
  const l = We((c) => Math.round(Math.min(r, Math.max(i, c))), [i, r]), [f, h] = A(() => {
    const c = Vt()[e];
    return l(typeof c == "number" ? c : t);
  });
  Q(() => {
    const c = Vt();
    c[e] = f;
    try {
      localStorage.setItem(bn, JSON.stringify(c));
    } catch {
    }
  }, [e, f]);
  const g = We((c) => {
    h((s) => l(typeof c == "function" ? c(s) : c));
  }, [l]);
  return [f, g];
}
function wn({ direction: e, onDrag: t, onReset: i, label: r }) {
  const l = ye(null), [f, h] = A(!1), [g, c] = A(!1), s = e === "vertical", p = (z) => s ? z.clientX : z.clientY;
  Q(() => {
    if (!f) return;
    const z = (H) => {
      if (l.current == null) return;
      const K = p(H), L = K - l.current;
      L && (l.current = K, t(L));
    }, q = () => {
      l.current = null, h(!1);
    };
    return window.addEventListener("pointermove", z), window.addEventListener("pointerup", q), window.addEventListener("pointercancel", q), () => {
      window.removeEventListener("pointermove", z), window.removeEventListener("pointerup", q), window.removeEventListener("pointercancel", q);
    };
  }, [f, t]);
  const n = (z) => {
    z.preventDefault(), l.current = p(z), h(!0);
  }, a = (z) => {
    const q = z.shiftKey ? 40 : 10, H = s ? "ArrowLeft" : "ArrowUp", K = s ? "ArrowRight" : "ArrowDown";
    z.key === H && (z.preventDefault(), t(-q)), z.key === K && (z.preventDefault(), t(q));
  }, R = f || g, j = s ? { width: 9, margin: "0 -4px", cursor: "col-resize", alignSelf: "stretch" } : { height: 9, margin: "-4px 0", cursor: "row-resize", width: "100%" };
  return /* @__PURE__ */ d(
    "div",
    {
      role: "separator",
      "aria-orientation": s ? "vertical" : "horizontal",
      "aria-label": r,
      tabIndex: 0,
      title: `${r}. Drag to resize, double-click to reset.`,
      onPointerDown: n,
      onPointerEnter: () => c(!0),
      onPointerLeave: () => c(!1),
      onDoubleClick: i,
      onKeyDown: a,
      style: { ...j, flexShrink: 0, position: "relative", zIndex: 2, touchAction: "none", display: "flex", justifyContent: "center", alignItems: "center" },
      children: [
        /* @__PURE__ */ o(
          "span",
          {
            "aria-hidden": !0,
            style: s ? { width: R ? 3 : 1, height: "100%", borderRadius: 2, background: R ? "var(--accent)" : "var(--border)", transition: "width .1s" } : { height: R ? 3 : 1, width: "100%", borderRadius: 2, background: R ? "var(--accent)" : "var(--border)", transition: "height .1s" }
          }
        ),
        /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
          position: "absolute",
          borderRadius: 3,
          background: R ? "var(--accent)" : "var(--border)",
          ...s ? { width: 5, height: 28, top: "calc(50% - 14px)" } : { height: 5, width: 28, left: "calc(50% - 14px)" }
        } }),
        f && /* @__PURE__ */ o("div", { style: { position: "fixed", inset: 0, zIndex: 9999, cursor: s ? "col-resize" : "row-resize" } })
      ]
    }
  );
}
function ro(e, t, i = 0.75) {
  const [r, l] = vn(e, 0, 0, 4e3), f = ye(null), h = We((c) => {
    const s = Math.round(window.innerHeight * i);
    l((p) => {
      var a;
      const n = p || ((a = f.current) == null ? void 0 : a.offsetHeight) || t;
      return Math.max(t, Math.min(s, n + c));
    });
  }, [t, i, l]), g = r ? { flex: `0 0 ${r}px`, minHeight: 0, overflowY: "auto" } : { flex: "0 1 auto", minHeight: 0, maxHeight: `${Math.round(i * 100)}%`, overflowY: "auto" };
  return { ref: f, style: g, onDrag: h, reset: () => l(0) };
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
  const l = await e.get("/api/chat/folders"), f = l == null ? void 0 : l.find((h) => h.name === t && (h.parent_id || null) === i);
  return f ? f.id : lo(await e.post("/api/chat/folders", {
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
  const { byRepo: t } = await fe.listSessions(), i = /* @__PURE__ */ new Map();
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
  const r = ye(null), [l, f] = A({ x: e, y: t });
  return _n(() => {
    const h = r.current;
    if (!h) return;
    const g = h.getBoundingClientRect();
    f({
      x: e + g.width > window.innerWidth ? Math.max(0, e - g.width) : e,
      y: t + g.height > window.innerHeight ? Math.max(0, t - g.height) : t
    });
  }, [e, t]), Q(() => {
    const h = (s) => {
      r.current && !r.current.contains(s.target) && i();
    }, g = (s) => {
      s.key === "Escape" && i();
    }, c = setTimeout(() => {
      window.addEventListener("mousedown", h, !0), window.addEventListener("keydown", g, !0), window.addEventListener("blur", i);
    }, 50);
    return () => {
      clearTimeout(c), window.removeEventListener("mousedown", h, !0), window.removeEventListener("keydown", g, !0), window.removeEventListener("blur", i);
    };
  }, [i]), { ref: r, pos: l };
}
function en({ x: e, y: t, items: i, onClose: r }) {
  const { ref: l, pos: f } = $n(e, t, r);
  return Q(() => {
    var h, g;
    (g = (h = l.current) == null ? void 0 : h.querySelector("[role=menuitem]")) == null || g.focus();
  }, [l]), /* @__PURE__ */ o("div", { ref: l, role: "menu", style: { ...Sn, left: f.x, top: f.y, padding: "4px 0", minWidth: 160 }, children: i.map((h, g) => {
    if ("separator" in h)
      return /* @__PURE__ */ o("div", { role: "separator", style: { height: 1, background: "var(--border, rgba(255,255,255,0.15))", margin: "2px 0" } }, `sep-${g}`);
    const c = h.icon, s = () => {
      r(), h.onSelect();
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
          color: h.danger ? "var(--danger, #f38ba8)" : "var(--text, #e0e0e0)"
        },
        children: /* @__PURE__ */ d("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ o("span", { style: { width: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.85 }, children: c ? /* @__PURE__ */ o(c, { size: 13 }) : null }),
          h.label
        ] })
      },
      h.label
    );
  }) });
}
function bt({ x: e, y: t, title: i, children: r, action: l, onConfirm: f, onClose: h }) {
  const { ref: g, pos: c } = $n(e, t, h);
  return /* @__PURE__ */ d(
    "div",
    {
      ref: g,
      role: "alertdialog",
      "aria-label": i,
      style: { ...Sn, left: c.x, top: c.y, padding: "12px 14px", width: 280 },
      children: [
        /* @__PURE__ */ o("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e0e0e0)", lineHeight: 1.35 }, children: i }),
        r && /* @__PURE__ */ o("div", { style: { fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6, lineHeight: 1.45 }, children: r }),
        /* @__PURE__ */ d("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ o(Oe, { onClick: h, children: "Cancel" }),
          /* @__PURE__ */ o(Oe, { danger: !0, onClick: () => {
            h(), f();
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
}, Je = {
  you: "HITL = human in the loop: open, unblocked, and it needs a person",
  afk: "Agent (AFK = away from keyboard): open, unblocked, and an agent can take it on its own",
  building: "In progress: an agent is building it",
  review: "In review: its pull request is open",
  blocked: "Blocked: waiting on a ticket that is still open",
  done: "Done: closed",
  fog: "Fog: in scope but not yet specified — listed in the map's Not yet specified section, not a ticket yet"
}, mt = {
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
}, ho = (e) => [po[e.code], Je[e.state]].filter(Boolean).join(`
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
const O = {
  done: { label: "done", color: "#3fae6a", text: "#7fd39a" },
  review: { label: "in review", color: "#a78bfa", text: "#a78bfa" },
  building: { label: "building", color: "#60a5fa", text: "#60a5fa" },
  you: { label: "HITL", color: "#f5b14c", text: "#f5b14c" },
  afk: { label: "agent", color: "#2dd4bf", text: "#2dd4bf" },
  blocked: { label: "blocked", color: "#c2615b", text: "#e08a85" },
  fog: { label: "fog", color: "transparent", text: "var(--muted)" }
};
function tn({ tile: e, onClick: t, size: i = 34, open: r, status: l, bare: f, numberOnly: h, width: g }) {
  const c = O[e.state], s = e.state !== "blocked", p = e.state === "done", n = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((R) => `#${R}`).join(", ")}` : `#${e.number} ${e.title}: ${c.label}`;
  return /* @__PURE__ */ d(
    "button",
    {
      type: "button",
      onClick: t,
      title: `${n}${l === "running" ? " · agent working" : l === "attention" ? " · needs you: a trust prompt or question" : l === "waiting" ? " · awaiting input" : ""}

${ho(e)}`,
      "aria-current": r ? "true" : void 0,
      style: {
        position: "relative",
        width: g ?? i,
        height: h ? i : i + 6,
        flexShrink: 0,
        borderRadius: 6,
        padding: 0,
        outline: r ? "2px solid var(--text-strong, #fff)" : void 0,
        outlineOffset: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: t ? "pointer" : "default",
        fontWeight: h ? 700 : 800,
        fontSize: h ? 11 : 13,
        fontVariantNumeric: "tabular-nums",
        background: p ? "rgba(63,174,106,.22)" : s ? c.color : "transparent",
        color: p ? "#7fd39a" : s ? "#14121c" : "var(--muted)",
        border: s ? "1px solid transparent" : `1.5px solid ${c.color}`
      },
      children: [
        h ? e.number : /* @__PURE__ */ d(ke, { children: [
          !f && /* @__PURE__ */ o("span", { style: { position: "absolute", top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }, children: e.number }),
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
              top: h ? 2 : 4,
              right: h ? 2 : 4,
              width: h ? 5 : 6,
              height: h ? 5 : 6,
              borderRadius: 999,
              background: "currentColor"
            }
          }
        )
      ]
    }
  );
}
async function go(e, t, i, r, l, f) {
  let h;
  try {
    h = await xn(e, t);
  } catch {
    h = void 0;
  }
  const g = await e.post("/api/chat/slots", {
    name: i,
    title: l,
    ...h ? { folder_id: h } : {},
    // The app's own agent for this session (the conductor); the default agent otherwise.
    ...f ? { agent: f } : {}
  }), c = (g == null ? void 0 : g.key) || i;
  return await e.post("/api/chat?ws=1", { slot: c, message: r }), c;
}
const In = "kipo.closedSessions.v1", He = (e) => !!e && Mt().has(e);
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
  for (const f of t)
    if (!(!f || f === i)) {
      if (r.has(f)) {
        l.push(f);
        continue;
      }
      try {
        const h = await e.get(`/api/chat/slots/${encodeURIComponent(f)}?limit=1`);
        if (h != null && h.running) continue;
        await e.del(`/api/chat/slots/${encodeURIComponent(f)}`), It(f), l.push(f);
      } catch (h) {
        /404|not.?found/i.test(String((h == null ? void 0 : h.message) ?? h)) && (It(f), l.push(f));
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
  const t = (p, n = 0) => p.you ? { color: O.you.color, active: !0 } : p.blocked ? { color: O.blocked.color, active: !0 } : p.building ? { color: O.building.color, active: !0 } : p.afk ? { color: O.afk.color, active: !0 } : p.review ? { color: O.review.color, active: !0 } : n ? { color: "var(--muted)", active: !0 } : p.done ? { color: O.done.color, active: !1 } : { color: null, active: !1 }, i = [
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
  ], r = { intake: "Intake", shape: "Shape", grill: "Grill", plan: "Plan", build: "Build", review: "Review", done: "Done" }, l = [...i].reverse().find((p) => p.active), f = l ? r[l.id] : e.total || e.prs.merged ? "Done" : "—", h = e.intake.you + e.shape.you + e.grill.you + e.build.you + (e.handover ? 1 : 0) + (e.landed && !e.retro ? 1 : 0), g = e.shape.building + e.grill.building + e.build.building + e.intake.building, c = e.shape.afk + e.grill.afk + e.build.afk + e.intake.afk, s = [
    e.doneTiles ? `${e.doneTiles}/${e.total} done` : "",
    h ? `${h} HITL` : "",
    g ? `${g} in agents` : "",
    c ? `${c} ready` : "",
    e.prs.open ? `${e.prs.open} PR${e.prs.open === 1 ? "" : "s"}` : "",
    e.fog ? `${e.fog} fog` : ""
  ].filter(Boolean);
  return { segs: i, front: f, bits: s.slice(0, 4).join(" · ") };
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
}, Ve = (e, t) => ({ n: e, color: O[t].color });
function Io(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function Ro({ detail: e, statuses: t, activity: i, busy: r, autopilot: l, selectedKey: f, embedded: h, compact: g, onAutopilot: c, onOpenTile: s, onOpenConversation: p, onSelectConductor: n, onJumpQuestions: a, onHandover: R, onReview: j, onRetro: z, onClose: q }) {
  var Me, Pe, Ze, Se;
  const [H, K] = A(!1), L = (m, Y) => ((m == null ? void 0 : m.decisions) ?? []).filter((U) => At(U) && !(Y && Ht(Y, U.id))).length, te = (m) => {
    var Y;
    return m ? L((Y = e.sessionStates) == null ? void 0 : Y[m], e.sessions[m]) : 0;
  }, oe = L(((Me = e.sessionStates) == null ? void 0 : Me.conductor) ?? e.state, e.sessions.conductor), E = (m) => ({ label: m === 1 ? "1 question" : `${m} questions`, color: O.you.color }), k = e.frontier, N = (k == null ? void 0 : k.tiles) ?? [], D = (Pe = k == null ? void 0 : k.fogItems) != null && Pe.length ? k.fogItems : (k == null ? void 0 : k.fogLeft) ?? [], ie = !((Ze = k == null ? void 0 : k.fogItems) != null && Ze.length) && !!((Se = k == null ? void 0 : k.fogLeft) != null && Se.length), ee = new Map(ot.map((m) => [m, []]));
  for (const m of N) ee.get(yo(m)).push(m);
  const le = (m) => m.source ? "intake" : m.type === "build" ? "build" : m.type === "grilling" ? "grill" : "shape", X = new Map(ot.map((m) => [m, []]));
  for (const m of N) X.get(le(m)).push(m);
  const ge = So[e.start] ?? "grill", ae = ot.indexOf(ge), y = X.get("build"), W = e.artifacts.find((m) => m.label === "Spec" || m.label.startsWith("Spec")), M = e.prs.filter((m) => m.state === "OPEN"), P = e.prs.filter((m) => m.state === "MERGED"), se = N.filter((m) => m.state === "done").length, F = !!e.sessions.done, pe = (m) => {
    var Ge;
    const Y = m.state !== "done" ? te(m.sessionKey) : 0, U = t[m.number], V = U === "attention" ? ((Ge = i == null ? void 0 : i[m.number]) == null ? void 0 : Ge.needs) ?? null : null, Ue = U === "running" || U === "attention", Te = U === "attention" || Y > 0 || m.state === "you";
    return {
      key: `t${m.number}`,
      number: m.number,
      title: m.title,
      tile: m,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: Y ? E(Y) : V === "approval" ? { label: "trust prompt", color: O.you.color } : V === "input" ? { label: "asking", color: O.you.color } : { label: O[m.state].label, color: m.state === "done" ? O.done.text : O[m.state].color, solid: m.state === "you" || m.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Ue || Te,
      attention: Te,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Ue ? i == null ? void 0 : i[m.number] : void 0,
      questions: Y,
      selKeys: [`build-t${m.number}`, `shape-t${m.number}`, `review-t${m.number}`]
    };
  }, J = (m) => {
    const Y = (U) => m.filter((V) => V.state === U).length;
    return { done: Y("done"), you: Y("you"), afk: Y("afk"), building: Y("building"), review: Y("review"), blocked: Y("blocked") };
  }, xe = (m) => {
    const Y = ["you", "building", "afk", "review", "blocked", "done"];
    return [...m].sort((U, V) => Y.indexOf(U.state) - Y.indexOf(V.state) || U.number - V.number);
  }, Ae = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, $ = (m) => {
    const Y = e.sessions[m];
    if (!Y || He(Y)) return [];
    const U = te(m);
    return [{
      key: `conv-${m}`,
      title: Ae[m] ?? "Its conversation",
      chip: U ? E(U) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => p(m),
      questions: U,
      selKeys: [m]
    }];
  }, _ = ot.map((m) => {
    const Y = X.get(m), U = $(m === "build" ? "build-spec" : m);
    if (m === "plan") {
      if (y.length || W)
        return { id: m, state: "full", count: /* @__PURE__ */ d(ke, { children: [
          /* @__PURE__ */ o("b", { style: Re, children: "1 spec" }),
          " → ",
          y.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: O.done.color }], rows: U };
      if (k != null && k.handover)
        return {
          id: m,
          state: "live",
          count: /* @__PURE__ */ o("b", { style: { color: O.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: O.you.color }],
          rows: U,
          // Once the conversation exists, its row above is the way back in.
          action: U.length ? void 0 : { label: "Write the spec", onClick: R }
        };
      const ue = N.filter(($e) => $e.lane === "decide" && $e.state !== "done").length;
      return { id: m, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${ue || "the"} decision${ue === 1 ? "" : "s"}${D.length ? ` and ${D.length} fog` : ""}`, segments: [], rows: U };
    }
    if (m === "review")
      return !M.length && !P.length && !U.length ? { id: m, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: m,
        state: M.length ? "live" : "full",
        count: /* @__PURE__ */ d(ke, { children: [
          /* @__PURE__ */ d("b", { style: Re, children: [
            P.length,
            " merged"
          ] }),
          M.length ? /* @__PURE__ */ d(ke, { children: [
            " · ",
            M.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: P.length, color: O.done.color }, { n: M.length, color: O.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...U, ...M.map((ue) => {
          const $e = ue.tickets[0];
          return {
            key: `pr${ue.number}`,
            number: ue.number,
            title: ue.title,
            chip: { label: "open", color: O.review.color },
            ...$e != null ? { onOpen: () => p(`review-t${$e}`), selKeys: [`review-t${$e}`] } : { url: ue.url }
          };
        })],
        action: M.length && !U.length ? { label: "Review the PRs", onClick: j } : void 0
      };
    if (m === "done") {
      const ue = !!(k != null && k.landed), $e = ue && F && e.kind !== "map";
      return {
        id: m,
        state: se ? ue ? "live" : "full" : "queued",
        count: se ? /* @__PURE__ */ d(ke, { children: [
          /* @__PURE__ */ d("b", { style: Re, children: [
            se,
            " of ",
            N.length
          ] }),
          " · ",
          F ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: se ? void 0 : "closes when the retro runs",
        segments: [{ n: se, color: O.done.color }, { n: Math.max(0, N.length - se), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...U, ...N.filter((Fe) => Fe.state === "done").sort((Fe, et) => Fe.number - et.number).map(pe)],
        action: ue && !F ? { label: "Run /retro", onClick: z } : $e ? H ? { label: "Close the effort and its issue?", onClick: () => {
          K(!1), q();
        }, confirm: () => K(!1) } : { label: "Close effort", onClick: () => K(!0) } : void 0
      };
    }
    if (!Y.length && !(m === "shape" && D.length) && !U.length)
      return ot.indexOf(m) < ae ? { id: m, state: "skipped", count: `entered at ${lt[ge]}`, segments: [], rows: [] } : m === "build" ? { id: m, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: m, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const V = J(Y), Ue = V.you + V.afk + V.building + V.review + V.blocked > 0 || !Y.length && U.length > 0, Te = [];
    m === "grill" ? (V.done && Te.push(`${V.done} answered`), V.you && Te.push(`${V.you} waiting`)) : (V.done && Te.push(`${V.done} done`), V.you && Te.push(`${V.you} HITL`)), V.building && Te.push(`${V.building} in agents`), V.afk && Te.push(`${V.afk} ready`), V.review && Te.push(`${V.review} in review`), V.blocked && Te.push(`${V.blocked} blocked`);
    const Ge = [Ve(V.done, "done"), Ve(V.building, "building"), Ve(V.review, "review"), Ve(V.you, "you"), Ve(V.afk, "afk"), Ve(V.blocked, "blocked")];
    m === "shape" && D.length && Ge.push({ n: D.length, color: "transparent", dashed: !0 });
    const Qe = [...U, ...xe(Y.filter((ue) => ue.state !== "done")).map(pe)];
    return m === "shape" && D.forEach((ue, $e) => Qe.push({
      key: `fog${$e}`,
      title: To(ue),
      chip: ie ? { label: "left unspecified", color: O.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: m,
      state: Ue ? "live" : "full",
      count: /* @__PURE__ */ d(ke, { children: [
        Te.map((ue, $e) => $e === 0 ? /* @__PURE__ */ o("b", { style: Re, children: ue }, ue) : /* @__PURE__ */ d("span", { children: [
          " · ",
          ue
        ] }, ue)),
        m === "shape" && D.length ? /* @__PURE__ */ d("span", { children: [
          " · ",
          D.length,
          " fog"
        ] }) : null
      ] }),
      segments: Ge,
      rows: Qe
    };
  }), he = (m) => m.state === "live", me = _.reduce((m, Y, U) => he(Y) ? U : m, -1), be = me >= 0 ? _[me] : null, ve = J(N), x = N.length, ne = [
    { n: ve.building, label: "in agents", color: O.building.color },
    { n: ve.review, label: "in review", color: O.review.color },
    { n: ve.you, label: "HITL", color: O.you.color },
    { n: ve.afk, label: "ready", color: O.afk.color },
    { n: ve.blocked, label: "blocked", color: O.blocked.color },
    { n: D.length, label: "fog", color: "var(--muted)" }
  ].filter((m) => m.n > 0), [re, we] = A(() => new Set(be ? [be.id] : [])), Ye = (m) => we((Y) => {
    const U = new Set(Y);
    return U.has(m) ? U.delete(m) : U.add(m), U;
  }), Ne = oe + _.reduce((m, Y) => m + Y.rows.reduce((U, V) => U + (V.questions ?? 0), 0), 0), Be = Object.values(i ?? {}).filter((m) => m && (m.needs === "approval" || m.needs === "input")).length, qe = N.filter((m) => m.state === "you" && t[m.number] !== "attention" && !te(m.sessionKey)).length, Ee = f === "conductor", Le = !!e.sessions.conductor && !He(e.sessions.conductor), Ce = g ? 10 : 16;
  return /* @__PURE__ */ d("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, ...h ? {} : { height: "100%" } }, children: [
    /* @__PURE__ */ d("div", { style: { padding: `10px ${Ce}px 9px`, borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ d("span", { style: { ...G, fontSize: b.tiny, flex: 1 }, children: [
          "entered at ",
          lt[ge],
          " (",
          $o[e.start] ?? e.start,
          ")"
        ] }),
        !h && /* @__PURE__ */ o("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: b.tiny, whiteSpace: "nowrap" }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { fontSize: b.small, marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }, children: x > 0 ? /* @__PURE__ */ d(ke, { children: [
        /* @__PURE__ */ d("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ d("b", { style: { color: O.done.text }, children: [
            ve.done,
            " of ",
            x
          ] }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: "done" })
        ] }),
        ne.map((m) => /* @__PURE__ */ d("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ o("b", { style: { color: m.color }, children: m.n }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: m.label })
        ] }, m.label))
      ] }) : /* @__PURE__ */ o("span", { style: G, children: D.length ? `${D.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
      (Ne > 0 || Be > 0 || qe > 0) && // The pill only shows when something is waiting on the human, so it
      // pulses the moment it appears — the same amber attention cue the
      // session cards use, for questions, trust prompts/asks, and HITL.
      /* @__PURE__ */ d(
        "button",
        {
          type: "button",
          onClick: a,
          className: "kipo-pulse",
          title: Be > 0 ? "A session is stopped on a trust prompt or an ask: open it to allow or answer" : qe > 0 ? "A ticket is in HITL, waiting on you: open it to act" : "Jump to the next conversation with open questions; answer them on the right",
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
            Io(Ne, Be + qe),
            " →"
          ]
        }
      ),
      /* @__PURE__ */ d(
        "button",
        {
          type: "button",
          "aria-pressed": l,
          onClick: () => c(!l),
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
            color: l ? O.afk.text : "var(--muted)"
          },
          children: [
            /* @__PURE__ */ o(
              "span",
              {
                "aria-hidden": !0,
                className: l ? "kipo-pulse" : void 0,
                style: { width: 7, height: 7, borderRadius: 999, background: l ? O.afk.color : "var(--muted)" }
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
    /* @__PURE__ */ d("div", { style: h ? void 0 : { flex: 1, minHeight: 0, overflowY: "auto" }, children: [
      /* @__PURE__ */ o("div", { style: { padding: `9px ${Ce}px`, borderBottom: "1px solid var(--border)" }, children: /* @__PURE__ */ d(
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
            background: Ee ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: Ee ? "var(--accent-fg, #fff)" : "var(--accent)"
          },
          children: [
            /* @__PURE__ */ o(gn, { size: 14, "aria-hidden": !0, style: { flexShrink: 0 } }),
            /* @__PURE__ */ o("span", { style: { flex: 1 }, children: "Conductor" }),
            oe > 0 ? /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${Ee ? "var(--accent-fg, #fff)" : O.you.color}`,
              color: Ee ? "var(--accent-fg, #fff)" : O.you.color
            }, children: oe === 1 ? "1 question" : `${oe} questions` }) : /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, fontWeight: 400, opacity: 0.75 }, children: Le ? "conversation" : "not started" })
          ]
        }
      ) }),
      _.map((m) => /* @__PURE__ */ o(
        Co,
        {
          s: m,
          busy: r,
          open: re.has(m.id),
          selectedKey: f,
          compact: g,
          onToggle: () => Ye(m.id),
          onOpenTile: s
        },
        m.id
      )),
      /* @__PURE__ */ d("div", { style: { display: "flex", gap: 12, alignItems: "center", padding: `9px ${Ce}px`, fontSize: b.tiny, color: "var(--muted)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ o(it, { color: O.done.color, label: "done" }),
        /* @__PURE__ */ o(it, { color: O.building.color, label: "in agents" }),
        /* @__PURE__ */ o(it, { color: O.you.color, label: "HITL" }),
        /* @__PURE__ */ o(it, { color: O.afk.color, label: "ready" }),
        /* @__PURE__ */ o(it, { color: O.blocked.color, label: "blocked" })
      ] })
    ] })
  ] });
}
function it({ color: e, label: t }) {
  return /* @__PURE__ */ d("span", { children: [
    /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, background: e, marginRight: 4, verticalAlign: -1 } }),
    t
  ] });
}
function Co({ s: e, open: t, busy: i, selectedKey: r, compact: l, onToggle: f, onOpenTile: h }) {
  const g = e.state === "skipped" || e.state === "queued", c = e.rows.length > 0 || !!e.action, s = mo.find((a) => a.id === e.id), p = e.segments.reduce((a, R) => a + R.n, 0), n = e.rows.reduce((a, R) => a + (R.questions ?? 0), 0);
  return /* @__PURE__ */ d("div", { style: {
    borderBottom: "1px solid var(--border)",
    background: t ? "var(--bg-elevated)" : void 0,
    borderLeft: t ? `2px solid ${O.you.color}` : "2px solid transparent"
  }, children: [
    /* @__PURE__ */ d(
      "button",
      {
        type: "button",
        onClick: c ? f : void 0,
        "aria-expanded": c ? t : void 0,
        title: s ? `${lt[e.id]} · ${s.skill}
${s.what}` : void 0,
        style: {
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: l ? "8px 10px 9px 6px" : "8px 16px 9px 10px",
          background: "transparent",
          color: "var(--text)",
          cursor: c ? "pointer" : "default",
          opacity: g ? 0.55 : 1
        },
        children: [
          /* @__PURE__ */ d("span", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
            /* @__PURE__ */ o(xt, { size: 12, "aria-hidden": !0, style: {
              flexShrink: 0,
              alignSelf: "center",
              color: "var(--muted)",
              transform: t ? "rotate(90deg)" : void 0,
              transition: "transform .12s",
              visibility: c ? "visible" : "hidden"
            } }),
            /* @__PURE__ */ o(
              "span",
              {
                style: { width: l ? 48 : 56, flexShrink: 0, fontSize: b.small, fontWeight: 700, color: g ? "var(--muted)" : "var(--text-strong, var(--text))" },
                title: l ? rn[e.id] : void 0,
                children: lt[e.id]
              }
            ),
            !l && /* @__PURE__ */ o("span", { style: { width: 92, flexShrink: 0, fontSize: 10, color: "var(--muted)" }, children: rn[e.id] }),
            /* @__PURE__ */ d("span", { style: { flex: 1, textAlign: "right", fontSize: b.small, minWidth: 0 }, children: [
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
          p > 0 && /* @__PURE__ */ o("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((a) => a.n > 0).map((a, R) => /* @__PURE__ */ o("span", { style: { flex: a.n, background: a.color, ...a.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, R)) }),
          e.ghost && /* @__PURE__ */ o("span", { style: { display: "block", fontSize: b.tiny, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }, children: e.ghost })
        ]
      }
    ),
    t && c && /* @__PURE__ */ d("div", { style: { margin: l ? "0 10px 10px 8px" : "0 16px 10px 14px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }, children: [
      e.action && /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: e.rows.length ? "1px solid var(--border)" : void 0 }, children: [
        /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flex: 1 }, children: e.action.confirm ? "" : `${lt[e.id]}'s next step` }),
        /* @__PURE__ */ o(Qt, { primary: !0, disabled: i, onClick: e.action.onClick, children: e.action.label }),
        e.action.confirm && /* @__PURE__ */ o(Qt, { disabled: i, onClick: e.action.confirm, children: "Cancel" })
      ] }),
      e.rows.map((a) => {
        var q;
        const R = () => {
          a.onOpen ? a.onOpen() : a.tile ? h(a.tile) : a.url && window.open(a.url, "_blank", "noreferrer");
        }, j = !!a.onOpen || !!a.tile || !!a.url, z = !!r && !!((q = a.selKeys) != null && q.includes(r));
        return /* @__PURE__ */ d(
          "button",
          {
            type: "button",
            onClick: j ? R : void 0,
            disabled: !j,
            title: a.tile ? `#${a.number} ${a.title}
${Je[a.tile.state]}
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
              cursor: j ? "pointer" : "default"
            },
            onMouseEnter: (H) => {
              j && !z && (H.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (H) => {
              H.currentTarget.style.background = z ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ d("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: a.number != null ? `#${a.number}` : a.onOpen ? /* @__PURE__ */ o(gn, { size: 11, "aria-hidden": !0 }) : "☁" }),
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
              a.live && /* @__PURE__ */ d(
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
                    /* @__PURE__ */ o("span", { style: { color: O.building.color }, children: zo(a.live.at) }),
                    a.live.line ? /* @__PURE__ */ d(ke, { children: [
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
function Eo({ width: e, items: t, repos: i, error: r, notice: l, selected: f, attention: h, spineSlot: g, onNew: c, onAddRepo: s, onRemoveRepo: p, onRestore: n, onSelect: a, onHide: R, onRemove: j, onCollapse: z }) {
  const [q, H] = A(""), [K, L] = A(null), [te, oe] = A(!0);
  Q(() => {
    oe(!0);
  }, [f]);
  const [E, k] = A(null), N = We(() => k(null), []), [D, ie] = A(null), [ee, le] = A(Oo);
  Q(() => {
    localStorage.setItem(Cn, JSON.stringify(ee));
  }, [ee]);
  const X = (y) => ee[y] !== !1, ge = q.trim().toLowerCase(), ae = pt(() => {
    const y = /* @__PURE__ */ new Map();
    for (const M of t ?? []) {
      const P = y.get(M.repo) ?? [];
      P.push(M), y.set(M.repo, P);
    }
    const W = (i ?? []).map((M) => M.slug);
    for (const M of y.keys()) W.includes(M) || W.push(M);
    return W.map((M) => {
      const P = (i ?? []).find((J) => J.slug === M) ?? { slug: M, path: "", hidden: [] }, se = y.get(M) ?? [], F = !ge || M.toLowerCase().includes(ge), pe = F ? se : se.filter((J) => J.title.toLowerCase().includes(ge));
      return { meta: P, rows: pe, show: !ge || F || pe.length > 0 };
    }).filter((M) => M.show);
  }, [t, i, ge]);
  return /* @__PURE__ */ d(
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
        /* @__PURE__ */ d("div", { style: { padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 8 }, children: [
          /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }, children: [
            /* @__PURE__ */ o(Oe, { primary: !0, onClick: c, children: /* @__PURE__ */ d("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Fn, { size: 14 }),
              "New effort"
            ] }) }),
            /* @__PURE__ */ o("span", { title: "Add a repo: it joins this sidebar with all its maps and efforts under it", children: /* @__PURE__ */ o(Oe, { onClick: s, children: /* @__PURE__ */ d("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(Jn, { size: 14 }),
              "Add repo"
            ] }) }) })
          ] }),
          /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ o(
              "input",
              {
                value: q,
                onChange: (y) => H(y.target.value),
                placeholder: "Filter efforts",
                "aria-label": "Filter efforts",
                style: { ...ht, fontSize: b.small, padding: "4px 8px", flex: 1, minWidth: 0 }
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
        /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 6px 8px" }, children: [
          r && /* @__PURE__ */ o("div", { style: { color: "var(--danger-text)", fontSize: b.small, padding: "4px 6px" }, children: r }),
          !r && l && /* @__PURE__ */ o("div", { style: { color: "#f5b14c", fontSize: b.tiny, padding: "4px 6px", lineHeight: 1.4 }, children: l }),
          t === null && !r && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "4px 6px" }, children: "Loading…" }),
          t !== null && !ae.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, padding: "4px 6px" }, children: ge ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          ae.map((y) => {
            const W = X(y.meta.slug) || !!ge, M = y.meta.slug.split("/").pop() ?? y.meta.slug;
            return /* @__PURE__ */ d("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ d(
                "div",
                {
                  onContextMenu: (P) => {
                    P.preventDefault(), ie({ slug: y.meta.slug, x: P.clientX, y: P.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => L(`repo:${y.meta.slug}`),
                  onPointerLeave: () => L((P) => P === `repo:${y.meta.slug}` ? null : P),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 6,
                    padding: "3px 4px",
                    background: K === `repo:${y.meta.slug}` ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ d(
                      "button",
                      {
                        type: "button",
                        onClick: () => le((P) => ({ ...P, [y.meta.slug]: !W })),
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
                          /* @__PURE__ */ o(xt, { size: 11, "aria-hidden": !0, style: {
                            flexShrink: 0,
                            color: "var(--muted)",
                            transition: "transform .12s",
                            transform: W ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ o(fn, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ o("span", { style: { fontSize: b.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: M }),
                          !W && (h ?? 0) > 0 && (f == null ? void 0 : f.startsWith(`${y.meta.slug}#`)) && /* @__PURE__ */ o(sn, {}),
                          /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0 }, children: y.rows.length || (W ? "" : "0") })
                        ]
                      }
                    ),
                    (K === `repo:${y.meta.slug}` || (D == null ? void 0 : D.slug) === y.meta.slug) && /* @__PURE__ */ o(
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
                        children: /* @__PURE__ */ o(Jt, { size: 13 })
                      }
                    )
                  ]
                }
              ),
              W && !y.rows.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              W && y.rows.length > 0 && /* @__PURE__ */ o("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: y.rows.map((P) => {
                const se = `${P.repo}#${P.number}`, F = se === f, pe = F && !!g && te;
                return /* @__PURE__ */ d(
                  "div",
                  {
                    style: {
                      position: "relative",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "var(--bg)",
                      // The open map glows; the rest sit as quiet cards.
                      border: `1px solid ${F ? "var(--accent)" : "var(--border)"}`,
                      boxShadow: F ? "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)" : void 0
                    },
                    onContextMenu: (J) => {
                      J.preventDefault(), k({ key: se, item: P, x: J.clientX, y: J.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => L(se),
                    onPointerLeave: () => L((J) => J === se ? null : J),
                    children: [
                      /* @__PURE__ */ d(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            F ? oe((J) => !J) : a(P);
                          },
                          "aria-current": F ? "page" : void 0,
                          "aria-expanded": F && g ? te : void 0,
                          title: F ? te ? "Fold this effort's stations away" : "Show this effort's stations" : void 0,
                          style: {
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 8px",
                            cursor: "pointer",
                            background: F ? "var(--bg-elevated)" : "transparent",
                            color: "var(--text)"
                          },
                          children: [
                            /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                              /* @__PURE__ */ o(xt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: pe ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ d("span", { style: { ...F ? Re : {}, flex: 1, minWidth: 0, fontSize: b.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ d("span", { style: { ...G, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  P.number
                                ] }),
                                " ",
                                P.title
                              ] }),
                              F && !pe && (h ?? 0) > 0 && /* @__PURE__ */ o(sn, {})
                            ] }),
                            (() => {
                              var xe;
                              if (pe)
                                return /* @__PURE__ */ d("div", { style: { ...G, fontSize: b.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o($t, { kind: P.kind, map: P.mapIssue }),
                                  /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: P.repo.split("/").pop() }),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Xt(P.updatedAt) })
                                ] });
                              const J = (xe = P.frontier) != null && xe.stations ? ko(P.frontier.stations) : null;
                              return /* @__PURE__ */ d(ke, { children: [
                                J && /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(xo, { glance: J }) }),
                                /* @__PURE__ */ d("div", { style: { ...G, fontSize: b.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o($t, { kind: P.kind, map: P.mapIssue }),
                                  !J && /* @__PURE__ */ o(Ao, { stage: P.stage ?? oo(P.column) }),
                                  /* @__PURE__ */ o(
                                    "span",
                                    {
                                      title: J ? `${J.bits || J.front}

${mt.HITL}
${mt.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: J ? J.bits || J.front : P.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Xt(P.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (K === se || F || (E == null ? void 0 : E.key) === se) && /* @__PURE__ */ o(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${P.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: (J) => {
                            J.stopPropagation();
                            const xe = J.currentTarget.getBoundingClientRect();
                            k({ key: se, item: P, x: xe.left, y: xe.bottom + 2, confirm: !1 });
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
                      pe && /* @__PURE__ */ o("div", { ref: g, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  se
                );
              }) }),
              W && y.meta.hidden.length > 0 && /* @__PURE__ */ d(
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
        E && !E.confirm && /* @__PURE__ */ o(en, { x: E.x, y: E.y, onClose: N, items: [
          { label: "Open on GitHub", icon: Yt, onSelect: () => window.open(E.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: Yn, danger: !0, onSelect: () => k({ ...E, confirm: "hide" }) },
          ...E.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: Ut, danger: !0, onSelect: () => k({ ...E, confirm: "remove" }) }
          ]
        ] }),
        (E == null ? void 0 : E.confirm) === "hide" && /* @__PURE__ */ o(
          bt,
          {
            x: E.x,
            y: E.y,
            onClose: N,
            action: "Remove",
            title: `Remove "${E.item.title}" from the sidebar?`,
            onConfirm: () => R(E.item),
            children: E.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (E == null ? void 0 : E.confirm) === "remove" && /* @__PURE__ */ o(
          bt,
          {
            x: E.x,
            y: E.y,
            onClose: N,
            action: "Close it",
            title: `Close "${E.item.title}" as not planned?`,
            onConfirm: () => j(E.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        D && !D.confirm && /* @__PURE__ */ o(en, { x: D.x, y: D.y, onClose: () => ie(null), items: [
          { label: "Open on GitHub", icon: Yt, onSelect: () => window.open(`https://github.com/${D.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: Ut, danger: !0, onSelect: () => ie({ ...D, confirm: !0 }) }
        ] }),
        (D == null ? void 0 : D.confirm) && /* @__PURE__ */ o(
          bt,
          {
            x: D.x,
            y: D.y,
            onClose: () => ie(null),
            action: "Remove",
            title: `Remove ${D.slug} from KiPo?`,
            onConfirm: () => p(D.slug),
            children: "Its efforts and maps leave the sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back."
          }
        )
      ]
    }
  );
}
function Mo({ items: e, selected: t, attention: i, onNew: r, onSelect: l, onExpand: f }) {
  const h = (c) => {
    var p;
    const s = (p = c.frontier) == null ? void 0 : p.counts;
    return s ? s.you ? "#f5b14c" : s.afk ? "#2dd4bf" : s.building || s.review ? "#60a5fa" : s.done ? "#3fae6a" : "var(--muted)" : "var(--muted)";
  }, g = { width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return /* @__PURE__ */ d("nav", { "aria-label": "Efforts", style: { width: 44, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", borderRight: "1px solid var(--border)", background: "var(--bg)", minHeight: 0 }, children: [
    /* @__PURE__ */ o(
      "button",
      {
        type: "button",
        onClick: f,
        title: "Show the effort list",
        "aria-label": "Show the effort list",
        style: { ...g, background: "transparent", color: "var(--muted)", fontSize: 14 },
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
        style: { ...g, background: "var(--accent)", color: "var(--accent-fg, #fff)", fontWeight: 700, fontSize: 16, borderRadius: 999 },
        children: "+"
      }
    ),
    /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 6, scrollbarWidth: "none" }, children: (e ?? []).map((c) => {
      const s = `${c.repo}#${c.number}`, p = s === t;
      return /* @__PURE__ */ o(
        "button",
        {
          type: "button",
          onClick: () => l(c),
          title: `${c.title} (${c.repo.split("/").pop()})`,
          "aria-current": p ? "page" : void 0,
          style: { ...g, background: p ? "var(--bg-elevated)" : "transparent", border: p ? "1px solid var(--border)" : "1px solid transparent", flexShrink: 0 },
          children: /* @__PURE__ */ o(
            "span",
            {
              className: p && (i ?? 0) > 0 ? "kipo-pulse" : void 0,
              style: { width: 10, height: 10, borderRadius: 3, background: p && (i ?? 0) > 0 ? "#f5b14c" : h(c) }
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
], ut = (e) => /* @__PURE__ */ o("span", { style: { ...Re, fontSize: b.body, display: "block", marginBottom: 6 }, children: e }), Wo = (e) => {
  const t = e.trim().match(/(?:issues\/|#)?(\d+)\s*$/);
  return t ? Number(t[1]) : null;
};
function Ho({ onStarted: e, onCancel: t }) {
  const [i, r] = A(""), [l, f] = A(null), [h, g] = A(""), [c, s] = A(!1), [p, n] = A(!1), [a, R] = A("idea"), [j, z] = A(""), [q, H] = A(!1), [K, L] = A("");
  Q(() => {
    fe.discoverRepos().then((k) => f(
      k.repos.filter((N) => N.slug && !N.worktree).sort((N, D) => Number(D.configured) - Number(N.configured) || N.name.localeCompare(D.name))
    )).catch((k) => {
      L(Ie(k)), f([]);
    });
  }, []);
  const te = (k) => {
    s(!1), g(k), l && !l.some((N) => N.path === k) && f([...l, { path: k, name: k.split("/").pop() || k, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, oe = async () => {
    const k = a === "issue" && j.trim() ? Wo(j) : null;
    if (a === "issue" && j.trim() && k == null) {
      L("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !k) {
      L("Say what you want to do first.");
      return;
    }
    if (!h) {
      L("Choose which project this is for.");
      return;
    }
    H(!0), L("");
    try {
      e(await fe.startInitiative({
        path: h,
        description: i.trim() || `Issue #${k}`,
        start: a,
        worktree: p,
        sourceIssue: k
      }));
    } catch (N) {
      L(Ie(N)), H(!1);
    }
  }, E = ln.find((k) => k.id === a);
  return /* @__PURE__ */ d("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ d("div", { children: [
      /* @__PURE__ */ o("div", { style: { ...Re, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ o(_e, { children: K }),
    /* @__PURE__ */ d("label", { children: [
      ut("What do you want to do?"),
      /* @__PURE__ */ o(
        "textarea",
        {
          value: i,
          onChange: (k) => r(k.target.value),
          rows: 3,
          autoFocus: !0,
          placeholder: "e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share",
          style: { ...ht, resize: "vertical", lineHeight: 1.45 }
        }
      )
    ] }),
    /* @__PURE__ */ d("div", { children: [
      ut("Which project is this for?"),
      /* @__PURE__ */ d(
        "select",
        {
          value: h,
          onChange: (k) => k.target.value === "__pick" ? s(!0) : g(k.target.value),
          style: ht,
          disabled: l === null,
          children: [
            /* @__PURE__ */ o("option", { value: "", children: l === null ? "Looking for your projects…" : "Choose a project…" }),
            l == null ? void 0 : l.map((k) => /* @__PURE__ */ o("option", { value: k.path, children: k.slug ?? k.name }, k.path)),
            /* @__PURE__ */ o("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      h && /* @__PURE__ */ d("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(mn, { path: h }) }),
        /* @__PURE__ */ d("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: b.body }, children: [
          /* @__PURE__ */ o("input", { type: "checkbox", checked: p, onChange: (k) => n(k.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ d("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ o("span", { style: G, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      c && /* @__PURE__ */ o("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ o(yn, { busy: null, onAdd: te, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ d("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ o("legend", { style: { padding: 0 }, children: ut("Where does this start?") }),
      /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: ln.map((k) => {
        const N = a === k.id;
        return /* @__PURE__ */ d(
          "label",
          {
            style: {
              display: "block",
              padding: "8px 10px 9px",
              cursor: "pointer",
              borderRadius: 8,
              border: `1px solid ${N ? "var(--accent)" : "var(--border)"}`,
              background: N ? "var(--accent-subtle, var(--bg-elevated))" : "var(--card, var(--bg))",
              color: "var(--text)"
            },
            children: [
              /* @__PURE__ */ o(
                "input",
                {
                  type: "radio",
                  name: "start",
                  checked: N,
                  onChange: () => R(k.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ o("div", { style: { ...Re, fontSize: b.body }, children: k.title }),
              /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, marginTop: 3, lineHeight: 1.4 }, children: k.hint })
            ]
          },
          k.id
        );
      }) }),
      /* @__PURE__ */ d("div", { style: { ...G, fontSize: b.small, marginTop: 8 }, children: [
        "Starts with ",
        E.begins
      ] })
    ] }),
    a === "issue" && /* @__PURE__ */ d("label", { children: [
      ut("Which issue? (optional)"),
      /* @__PURE__ */ o(
        "input",
        {
          value: j,
          onChange: (k) => z(k.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: ht
        }
      )
    ] }),
    /* @__PURE__ */ d("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ o(Oe, { primary: !0, disabled: q, onClick: oe, children: q ? "Starting…" : "Start the conversation" }),
      t && /* @__PURE__ */ o(Oe, { onClick: t, children: "Never mind" })
    ] }),
    /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small, lineHeight: 1.5 }, children: "Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo." })
  ] });
}
const an = 6, Ke = (e, t) => (e.blockers ?? e.blockedBy).filter((i) => t.has(i) && i !== e.number);
function No(e, t) {
  const i = new Map(e.map((a) => [a.number, a])), r = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), f = (a) => {
    if (r.has(a.number)) return r.get(a.number);
    if (l.has(a.number)) return 0;
    l.add(a.number);
    const R = Ke(a, i), j = R.length ? 1 + Math.max(...R.map((z) => f(i.get(z)))) : 0;
    return l.delete(a.number), r.set(a.number, j), j;
  };
  e.forEach(f);
  const h = e.length ? Math.max(...e.map((a) => r.get(a.number))) + 1 : 0, g = t ? [e.filter((a) => a.lane === "decide"), e.filter((a) => a.lane !== "decide")] : [e], c = /* @__PURE__ */ new Map(), s = [];
  let p = 0, n = null;
  return g.forEach((a, R) => {
    if (!a.length) return;
    t && R === 1 && p > 0 && (n = p, p += 0.6);
    let j = 0;
    const z = [];
    for (let q = 0; q < h; q++) {
      const H = a.filter((L) => r.get(L.number) === q), K = (L) => {
        const te = Ke(L, i).map((oe) => c.get(oe)).filter((oe) => oe !== void 0);
        return te.length ? te.reduce((oe, E) => oe + E, 0) / te.length : L.number / 1e3;
      };
      H.sort((L, te) => K(L) - K(te) || L.number - te.number), H.forEach((L, te) => c.set(L.number, p + te)), z.push(H), j = Math.max(j, H.length);
    }
    z.forEach((q, H) => {
      const K = (j - q.length) / 2;
      q.forEach((L, te) => {
        const oe = p + te + K;
        c.set(L.number, oe), s.push({ tile: L, col: H, row: oe });
      });
    }), p += j;
  }), { placed: s, cols: h, rows: p, split: n };
}
function Lo({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: l, labeled: f, bands: h, highlight: g, dimOthers: c = !0, down: s }) {
  const p = ye(null), [n, a] = A(0), [R, j] = A(null);
  if (Q(() => {
    const x = p.current;
    if (!x) return;
    const ne = new ResizeObserver(() => a(x.clientWidth));
    return ne.observe(x), a(x.clientWidth), () => ne.disconnect();
  }, []), !e.length) return null;
  const z = new Map(e.map((x) => [x.number, x])), q = /* @__PURE__ */ new Set();
  for (const x of e) for (const ne of Ke(x, z))
    q.add(ne), q.add(x.number);
  const H = e.length > 1 ? e.filter((x) => !q.has(x.number)) : [], K = H.length ? e.filter((x) => q.has(x.number)) : e, { placed: L, cols: te, rows: oe, split: E } = No(K, !!h), k = 30, N = !!s && !h, D = h ? 52 : 0, ie = N ? 12 : h ? 64 : f ? 40 : 48, ee = i > 0 && !N ? Math.min(i, 4) : 0, le = ee ? ie + k : 0, X = N ? Math.max(1, oe) : te, ge = n && X ? Math.floor((n - 2 - 2 * an - D - le - (X - 1) * ie) / X) : 168, ae = f ? Math.max(N ? 120 : 110, Math.min(h ? 240 : N ? 260 : 200, ge)) : k, y = k + 6, W = N ? 30 : f ? 10 : 8, M = K.length ? te : 0, P = N ? (K.length ? X * (ae + ie) - ie : 0) + 2 : D + (M ? M * (ae + ie) - ie : 0) + le + 2, se = E ?? oe, F = N ? M : Math.max(oe, ee), pe = (x) => 1 + x * (y + W), J = K.length || ee ? pe(F) - W + 1 : 0, xe = new Map(L.map((x) => [x.tile.number, N ? { x: 1 + x.row * (ae + ie), y: pe(x.col) } : { x: D + 1 + x.col * (ae + ie), y: pe(x.row) }])), Ae = /* @__PURE__ */ new Set();
  if (t != null) {
    Ae.add(t);
    const x = z.get(t);
    x && Ke(x, z).forEach((ne) => Ae.add(ne)), e.forEach((ne) => {
      Ke(ne, z).includes(t) && Ae.add(ne.number);
    });
  }
  const $ = R != null && z.has(R) ? new Set(Ct(e, R).map((x) => x.number)) : null, _ = (x) => $ ? $.has(x) : (g ? g.has(x) : !0) && (t == null || !c || Ae.has(x)), he = (x) => x.state === "you" || x.state === "afk", me = (x) => he(x) && x.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${O[x.state].color}` : void 0, be = [];
  for (const x of K) for (const ne of Ke(x, z)) be.push({ from: z.get(ne), to: x });
  const ve = E != null ? pe(E) + 0.3 * (y + W) - W / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ d("div", { ref: p, style: { overflowX: "auto", padding: an, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ d("div", { style: { position: "relative", width: P, height: J, minWidth: P }, children: [
        /* @__PURE__ */ d("svg", { width: P, height: J, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ o("defs", { children: /* @__PURE__ */ o("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ o("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          ve != null && /* @__PURE__ */ o("line", { x1: 0, x2: P, y1: ve, y2: ve, stroke: "var(--border)", strokeDasharray: "2 4" }),
          be.map(({ from: x, to: ne }) => {
            const re = xe.get(x.number), we = xe.get(ne.number);
            if (!re || !we) return null;
            const Ye = x.state === "done", Ne = $ ? $.has(x.number) && $.has(ne.number) : t != null && (x.number === t || ne.number === t), Be = $ ? !Ne : t != null && c && !Ne || !_(x.number) || !_(ne.number), qe = N ? (() => {
              const Ee = re.x + k / 2, Le = re.y + y + 2, Ce = we.x + k / 2, Me = we.y - 2, Pe = (Le + Me) / 2;
              return `M${Ee},${Le} C${Ee},${Pe} ${Ce},${Pe} ${Ce},${Me}`;
            })() : (() => {
              const Ee = re.x + ae + 2, Le = re.y + y / 2, Ce = we.x - 2, Me = we.y + y / 2, Pe = (Ee + Ce) / 2;
              return `M${Ee},${Le} C${Pe},${Le} ${Pe},${Me} ${Ce},${Me}`;
            })();
            return /* @__PURE__ */ o(
              "path",
              {
                d: qe,
                fill: "none",
                stroke: Ne ? "var(--text)" : "var(--muted)",
                strokeWidth: Ne ? 1.6 : 1.2,
                strokeDasharray: Ye ? "3 3" : void 0,
                opacity: Be ? 0.15 : Ye ? 0.45 : 0.8,
                markerEnd: "url(#kipo-arrow)"
              },
              `${x.number}-${ne.number}`
            );
          })
        ] }),
        h && L.length > 0 && ["decide", "deliver"].map((x) => {
          const ne = L.filter((we) => x === "decide" ? we.tile.lane === "decide" : we.tile.lane !== "decide").map((we) => we.row);
          if (!ne.length) return null;
          const re = (Math.min(...ne) + Math.max(...ne)) / 2;
          return /* @__PURE__ */ o("span", { style: { position: "absolute", left: 0, top: pe(re) + y / 2 - 8, fontSize: b.tiny, fontWeight: 600, color: "var(--muted)" }, children: x === "decide" ? "Decide" : "Deliver" }, x);
        }),
        L.map(({ tile: x }) => {
          const ne = xe.get(x.number);
          return /* @__PURE__ */ d(
            "div",
            {
              onPointerEnter: () => j(x.number),
              onPointerLeave: () => j((re) => re === x.number ? null : re),
              style: {
                position: "absolute",
                left: ne.x,
                top: ne.y,
                width: ae,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: _(x.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    title: me(x) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: me(x), display: "inline-flex" },
                    children: /* @__PURE__ */ o(tn, { tile: x, size: k, onClick: () => r(x), open: x.number === t, status: l == null ? void 0 : l[x.number] })
                  }
                ),
                f && /* @__PURE__ */ o(
                  "button",
                  {
                    type: "button",
                    onClick: () => r(x),
                    title: x.title,
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
                      fontWeight: x.number === t ? 600 : 400,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    },
                    children: x.title
                  }
                )
              ]
            },
            x.number
          );
        }),
        Array.from({ length: ee }).map((x, ne) => /* @__PURE__ */ o(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: D + 1 + M * (ae + ie),
              top: pe(Math.max(0, (se - ee) / 2) + ne),
              width: k,
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
          `fog-${ne}`
        ))
      ] }),
      H.length > 0 && /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: D }, children: [
        /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        H.map((x) => /* @__PURE__ */ o("span", { style: { opacity: _(x.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: me(x) }, children: /* @__PURE__ */ o(tn, { tile: x, size: k, onClick: () => r(x), open: x.number === t, status: l == null ? void 0 : l[x.number] }) }, x.number))
      ] }),
      /* @__PURE__ */ d("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: b.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: D }, children: [
        /* @__PURE__ */ d("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2" }) }),
          " still blocks"
        ] }),
        /* @__PURE__ */ d("span", { children: [
          /* @__PURE__ */ o("svg", { width: "22", height: "6", "aria-hidden": !0, children: /* @__PURE__ */ o("line", { x1: "0", y1: "3", x2: "22", y2: "3", stroke: "var(--muted)", strokeWidth: "1.2", strokeDasharray: "3 3", opacity: ".6" }) }),
          " blocker closed"
        ] }),
        /* @__PURE__ */ d("span", { children: [
          /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, boxShadow: `0 0 0 1.5px ${O.you.color}`, marginRight: 5 } }),
          "frontier: open and unblocked"
        ] }),
        i > 0 && /* @__PURE__ */ o("span", { children: "? not yet specified" })
      ] })
    ] })
  );
}
function Ct(e, t) {
  const i = new Map(e.map((g) => [g.number, g]));
  if (!i.has(t)) return [];
  const r = /* @__PURE__ */ new Set([t]), l = [t];
  for (; l.length; ) {
    const g = i.get(l.pop());
    for (const c of g ? Ke(g, i) : []) r.has(c) || (r.add(c), l.push(c));
  }
  const f = /* @__PURE__ */ new Set([t]), h = [t];
  for (; h.length; ) {
    const g = h.pop();
    for (const c of e)
      !f.has(c.number) && Ke(c, i).includes(g) && (f.add(c.number), r.add(c.number), h.push(c.number));
  }
  return e.filter((g) => r.has(g.number));
}
function Po(e) {
  if (!e) return "";
  const t = Math.max(0, (Date.now() - new Date(e).getTime()) / 1e3);
  return t < 60 ? "just now" : t < 3600 ? `${Math.floor(t / 60)}m ago` : t < 86400 ? `${Math.floor(t / 3600)}h ago` : `${Math.floor(t / 86400)}d ago`;
}
function Do({ slot: e, active: t, ended: i }) {
  const [r, l] = A(null), [f, h] = A(""), g = ye(null), c = ye(!0);
  return Q(() => {
    let s = !0;
    const p = () => fe.sessionTail(e, 60).then((a) => {
      s && (l(a.events), h(""));
    }).catch((a) => {
      s && h(Ie(a));
    });
    if (p(), !t || i) return () => {
      s = !1;
    };
    const n = setInterval(p, 4e3);
    return () => {
      s = !1, clearInterval(n);
    };
  }, [e, t, i]), Q(() => {
    var s;
    c.current && ((s = g.current) == null || s.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: O.building.color, flexShrink: 0 } }),
      /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, lineHeight: 1.4 }, children: i ? /* @__PURE__ */ d(ke, { children: [
        "This session has ended — a read-only record of what it did, from its transcript. Its slot ",
        /* @__PURE__ */ o("code", { style: { fontSize: b.tiny }, children: e }),
        " is closed in Kiro."
      ] }) : /* @__PURE__ */ d(ke, { children: [
        "Running in the background — read-only progress from its transcript. To chat with it, open ",
        /* @__PURE__ */ o("code", { style: { fontSize: b.tiny }, children: e }),
        " in Kiro's session window."
      ] }) })
    ] }),
    /* @__PURE__ */ d(
      "div",
      {
        onScroll: (s) => {
          const p = s.currentTarget;
          c.current = p.scrollHeight - p.scrollTop - p.clientHeight < 40;
        },
        style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", scrollbarWidth: "thin" },
        children: [
          /* @__PURE__ */ o(_e, { children: f }),
          r === null && !f && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small }, children: "Reading its transcript…" }),
          r !== null && r.length === 0 && !f && /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.small }, children: "No steps recorded yet." }),
          /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: (r ?? []).map((s, p) => /* @__PURE__ */ d("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            /* @__PURE__ */ d("span", { style: { ...G, fontSize: b.tiny, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ o("span", { style: { fontWeight: 700, color: s.role === "user" ? O.you.text : "var(--muted)" }, children: s.role === "user" ? "You" : "Agent" }),
              s.ts && /* @__PURE__ */ o("span", { children: Po(s.ts) })
            ] }),
            s.tool ? /* @__PURE__ */ o("span", { style: { fontSize: b.small, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: s.text }) : /* @__PURE__ */ o("div", { style: { fontSize: b.body, lineHeight: 1.5 }, children: /* @__PURE__ */ o(kt, { content: s.text }) })
          ] }, p)) }),
          /* @__PURE__ */ o("div", { ref: g })
        ]
      }
    )
  ] });
}
function Bo({ items: e, prompts: t = [], onOpenPrompt: i, onError: r, onSize: l, bottomOffset: f = 122 }) {
  const h = zt(), g = ($) => `${$.slot}:${$.d.id}`;
  for (const $ of e) $.d.answer && wo($.slot, $.d.id);
  const c = e.filter(($) => At($.d) && !Ht($.slot, $.d.id)), [s, p] = A({}), [n, a] = A({}), [R, j] = A(0), [z, q] = A(!1), [H, K] = A(!1), L = ye(null), te = t, oe = c.map(g).join(",") + "|" + te.map(($) => $.slot).join(","), E = ye(oe);
  Q(() => {
    E.current !== oe && (E.current = oe, j(0), p({}), a({}), oe !== "|" && K(!1));
  }, [oe]);
  const k = ye(null), N = We(($) => {
    var he;
    if ((he = k.current) == null || he.disconnect(), k.current = null, !$) {
      l == null || l(0);
      return;
    }
    const _ = () => l == null ? void 0 : l($.offsetHeight);
    _(), k.current = new ResizeObserver(_), k.current.observe($);
  }, [l]);
  if (!c.length && !te.length) return null;
  const D = c.length + te.length;
  if (H) return /* @__PURE__ */ d(
    "button",
    {
      type: "button",
      className: "kipo-pulse",
      onClick: () => K(!1),
      title: "Open what's waiting on you",
      style: {
        position: "absolute",
        right: 16,
        bottom: f + 4,
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
        D,
        " waiting on you →"
      ]
    }
  );
  const ie = Math.min(R, Math.max(0, c.length - 1)), ee = c.length ? c[ie] : null, le = ee ? g(ee) : "", X = c.filter(($) => (s[g($)] ?? "").trim()), ge = ie === 0, ae = ie === c.length - 1, W = !!ee && (s[le] ?? "") !== "" && !(ee.d.options ?? []).includes(s[le] ?? "") || !!n[le], M = c.filter(($) => $.d.recommended), P = ($) => {
    le && p((_) => ({ ..._, [le]: $ }));
  }, se = () => {
    var $;
    z || !ee || (a((_) => ({ ..._, [le]: !0 })), p((_) => (ee.d.options ?? []).includes(_[le] ?? "") ? { ..._, [le]: "" } : _), ($ = L.current) == null || $.focus());
  }, F = async ($ = s) => {
    const _ = c.filter((me) => ($[g(me)] ?? "").trim());
    if (!_.length) return;
    const he = /* @__PURE__ */ new Map();
    for (const me of _) {
      const be = he.get(me.slot) ?? [];
      be.push(me), he.set(me.slot, be);
    }
    q(!0);
    try {
      for (const [me, be] of he) {
        const ve = c.filter((re) => re.slot === me && !($[g(re)] ?? "").trim()), x = be.map((re, we) => `${we + 1}. ${re.d.title} (${re.d.id}): ${$[g(re)].trim()}`), ne = [
          `My answers to your ${be.length === 1 ? "question" : `${be.length} questions`}:`,
          "",
          ...x,
          "",
          ve.length ? `Still open, I'll answer later: ${ve.map((re) => re.d.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
        ].join(`
`);
        await h.post("/api/chat?ws=1", { slot: me, message: ne });
        for (const re of be) vo(re.slot, re.d.id);
      }
      p({}), j(0);
    } catch (me) {
      r(`Couldn't send your answers: ${Ie(me)}`);
    } finally {
      q(!1);
    }
  }, pe = () => {
    const $ = { ...s };
    for (const _ of M) $[g(_)] = _.d.recommended;
    p($), F($);
  }, J = ($) => /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${$ ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: $ && /* @__PURE__ */ o("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), xe = ($) => {
    const _ = s[le] === $ && !n[le];
    return /* @__PURE__ */ d(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": _,
        disabled: z,
        onClick: () => {
          a((he) => ({ ...he, [le]: !1 })), P($);
        },
        onMouseEnter: (he) => {
          _ || (he.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (he) => {
          _ || (he.currentTarget.style.background = "transparent");
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
          border: `1px solid ${_ ? "var(--accent)" : "var(--border)"}`,
          background: _ ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
          color: "var(--text)"
        },
        children: [
          J(_),
          /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0 }, children: $ }),
          !!ee && $ === ee.d.recommended && /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      $
    );
  }, Ae = ($, _, he) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      disabled: _,
      onClick: he,
      style: {
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 10px",
        color: _ ? "var(--muted)" : "var(--text)",
        cursor: _ ? "default" : "pointer",
        fontSize: b.small,
        opacity: _ ? 0.5 : 1
      },
      children: $
    }
  );
  return /* @__PURE__ */ d(
    "div",
    {
      ref: N,
      role: "dialog",
      "aria-label": `${D} waiting on you`,
      style: {
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: f,
        zIndex: 6,
        width: "min(680px, calc(100% - 24px))",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.45)",
        padding: "10px 14px 11px"
      },
      children: [
        /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }, children: [
          /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: O.you.text }, children: c.length === 0 ? te.length === 1 ? "Trust prompt" : "Trust prompts" : c.length === 1 ? "Question" : `Question ${ie + 1} of ${c.length}` }),
          c.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ o("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: c.map(($, _) => /* @__PURE__ */ o(
            "span",
            {
              title: `${$.from ? `${$.from} — ` : ""}${$.d.title ?? $.d.id}`,
              onClick: () => j(_),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (s[g($)] ?? "").trim() ? O.you.color : _ === ie ? "var(--text)" : "var(--border)"
              }
            },
            g($)
          )) }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              onClick: () => K(!0),
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
        te.length > 0 && /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: c.length ? 10 : 2 }, children: te.map(($) => /* @__PURE__ */ d(
          "button",
          {
            type: "button",
            onClick: i ? () => i($.key) : void 0,
            title: `${[$.tool, $.input, $.purpose].filter(Boolean).join(`

`)}

Open this session; its Allow is on the trust line over the chat box.`,
            onMouseEnter: (_) => {
              _.currentTarget.style.background = "color-mix(in srgb, #f5b14c 16%, transparent)";
            },
            onMouseLeave: (_) => {
              _.currentTarget.style.background = "color-mix(in srgb, #f5b14c 8%, transparent)";
            },
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 9px",
              borderRadius: 8,
              width: "100%",
              textAlign: "left",
              cursor: i ? "pointer" : "default",
              color: "var(--text)",
              border: `1px solid ${O.you.color}`,
              background: "color-mix(in srgb, #f5b14c 8%, transparent)"
            },
            children: [
              /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: O.you.color, flexShrink: 0 } }),
              /* @__PURE__ */ d("span", { style: { flex: 1, minWidth: 0, fontSize: b.small }, children: [
                /* @__PURE__ */ o("b", { children: $.from }),
                " ",
                /* @__PURE__ */ o("span", { style: G, children: "wants to run:" }),
                /* @__PURE__ */ o("span", { style: {
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "var(--muted)",
                  fontSize: b.tiny,
                  fontFamily: "ui-monospace, monospace"
                }, children: $.tool })
              ] }),
              /* @__PURE__ */ o("span", { style: { flexShrink: 0, fontSize: b.small, fontWeight: 600, color: O.you.text, whiteSpace: "nowrap" }, children: "Open & allow →" })
            ]
          },
          $.slot
        )) }),
        ee && /* @__PURE__ */ d(ke, { children: [
          ee.from && /* @__PURE__ */ d("div", { style: { ...G, fontSize: b.tiny, marginBottom: 3 }, children: [
            "from ",
            ee.from
          ] }),
          /* @__PURE__ */ o("div", { style: { ...Re, fontSize: b.body, marginBottom: 8, lineHeight: 1.4 }, children: ee.d.title }),
          /* @__PURE__ */ d("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
            (ee.d.options ?? []).map(xe),
            /* @__PURE__ */ d(
              "div",
              {
                role: "radio",
                "aria-checked": W,
                onClick: se,
                style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px", cursor: "text" },
                children: [
                  J(W),
                  /* @__PURE__ */ o(
                    "input",
                    {
                      ref: L,
                      value: W ? s[le] ?? "" : "",
                      onChange: ($) => P($.target.value),
                      onFocus: se,
                      disabled: z,
                      placeholder: "Something else…",
                      "aria-label": `Another answer to: ${ee.d.title}`,
                      style: {
                        flex: 1,
                        minWidth: 0,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: b.small,
                        border: `1px solid ${W ? "var(--accent)" : "var(--border)"}`,
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
          /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            c.length > 1 && Ae("‹ Back", ge, () => j(ie - 1)),
            !ae && Ae("Next ›", !1, () => j(ie + 1)),
            /* @__PURE__ */ o("span", { style: { flex: 1 } }),
            c.length > 1 && /* @__PURE__ */ d("span", { style: { ...G, fontSize: b.tiny }, children: [
              X.length,
              " of ",
              c.length,
              " answered"
            ] }),
            M.length > 0 && /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                disabled: z,
                onClick: pe,
                title: c.length > 1 ? `Answer all ${M.length} with their recommendation and send` : "Take the recommendation and send",
                style: {
                  background: "transparent",
                  border: `1px solid ${O.you.color}`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  color: O.you.text,
                  cursor: z ? "default" : "pointer",
                  fontSize: b.small,
                  whiteSpace: "nowrap",
                  opacity: z ? 0.5 : 1
                },
                children: c.length > 1 ? "Accept all recommendations" : "Accept recommendation"
              }
            ),
            /* @__PURE__ */ o(Oe, { primary: !0, disabled: !X.length || z, onClick: () => void F(), children: z ? "Sending…" : X.length > 1 ? `Submit ${X.length} answers` : "Submit" })
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
  return /* @__PURE__ */ o("span", { style: { fontSize: b.tiny, padding: "1px 8px", borderRadius: 999, border: `1px solid ${e}`, color: t, whiteSpace: "nowrap" }, children: i });
}
function Ko({ detail: e, tile: t }) {
  const [i, r] = A(null), [l, f] = A("");
  Q(() => {
    let p = !0;
    return r(null), f(""), fe.ticket(e.repo, e.number, t.number).then((n) => {
      p && r(n);
    }).catch((n) => {
      p && f(Ie(n));
    }), () => {
      p = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const h = e.prs.filter((p) => t.prs.includes(p.number)), g = t.state === "done", c = O[t.state];
  let s;
  return g ? s = h.some((p) => p.state === "MERGED") ? "Closed: its PR merged." : "Closed." : t.state === "review" ? s = "Its PR is open. The effort's Review merges it once it's clean." : t.state === "blocked" ? s = `Waiting on ${t.blockedBy.map((p) => `#${p}`).join(", ")}. It can start once those close.` : t.state === "building" ? s = "An agent is working on it." : t.who === "you" ? s = /* @__PURE__ */ d(ke, { children: [
    /* @__PURE__ */ o(fo, { term: "HITL", children: "HITL" }),
    ": it needs you. Start it to open its conversation."
  ] }) : s = "An agent can take it on its own.", /* @__PURE__ */ d("div", { children: [
    /* @__PURE__ */ d("div", { style: { padding: "14px 16px" }, children: [
      /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ d("span", { style: { ...G, fontSize: b.small }, children: [
          "#",
          t.number,
          " · ",
          jo[t.type]
        ] }),
        /* @__PURE__ */ o("span", { title: Je[t.state], style: { cursor: "help", display: "inline-flex" }, children: /* @__PURE__ */ o(cn, { color: c.color === "transparent" ? "var(--border)" : c.color, text: c.text, children: c.label }) }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        /* @__PURE__ */ o("a", { href: t.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: b.small }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { ...Re, fontSize: b.title, marginTop: 4, lineHeight: 1.35 }, children: t.title }),
      /* @__PURE__ */ o("div", { style: { fontSize: b.small, marginTop: 5, lineHeight: 1.45 }, children: s })
    ] }),
    h.length > 0 && /* @__PURE__ */ o(yt, { title: h.length === 1 ? "Pull request" : "Pull requests", children: /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: h.map((p) => {
      var n, a, R;
      return /* @__PURE__ */ d(
        "a",
        {
          href: p.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: b.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ o(cn, { color: ((n = vt[p.state]) == null ? void 0 : n.color) ?? "var(--border)", text: ((a = vt[p.state]) == null ? void 0 : a.color) ?? "var(--muted)", children: ((R = vt[p.state]) == null ? void 0 : R.label) ?? p.state }),
            /* @__PURE__ */ d("span", { style: { color: "var(--accent)" }, children: [
              "#",
              p.number
            ] }),
            /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: p.title })
          ]
        },
        p.number
      );
    }) }) }),
    g && /* @__PURE__ */ o(yt, { title: "How it ended", aside: i != null && i.lastComment ? `latest of ${i.comments} comment${i.comments === 1 ? "" : "s"}` : void 0, children: l ? /* @__PURE__ */ o(_e, { children: l }) : i ? i.lastComment ? /* @__PURE__ */ o("div", { style: { fontSize: b.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(kt, { content: i.lastComment.body }) }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "Closed with no comment." }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "Loading…" }) }),
    /* @__PURE__ */ o(yt, { title: g ? "What it asked" : "What it asks", defaultOpen: !g, children: l ? /* @__PURE__ */ o(_e, { children: l }) : i ? i.body.trim() ? /* @__PURE__ */ o("div", { style: { fontSize: b.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(kt, { content: i.body }) }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "No description." }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.small }, children: "Loading…" }) })
  ] });
}
const _o = (e) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ""}@${e.at}`;
function qo(e, t, i, r, l = {}) {
  const f = [], h = [], g = new Set(l.unstarted ?? []), c = (n, a) => {
    const R = a ? r[a] : void 0;
    if (R)
      return n.replace === R || a && g.has(a) ? R : null;
  }, s = (n, a) => a ? { ...n, replace: a } : n, p = (n) => (l.prs ?? []).some((a) => a.state === "OPEN" && ((a.tickets ?? []).includes(n) || (a.refs ?? []).includes(n)));
  for (const n of e) {
    const a = _o(n);
    if (!(t(a) || f.includes(a))) {
      if (f.push(a), n.ticket != null) {
        const R = i.find((z) => z.number === n.ticket);
        if (!R) continue;
        const j = n.skill === "kipo-review";
        if ((R.state === "done" || R.state === "blocked") && !(j && p(R.number))) continue;
        if (j) {
          const z = c(n, `review-t${R.number}`);
          z !== null && h.push(s({ id: a, kind: "review", t: R.number }, z));
        } else {
          const z = c(n, R.sessionKey);
          z !== null && h.push(s({ id: a, kind: "tile", tile: R, skill: n.skill && !n.skill.startsWith("kipo-") ? n.skill : null }, z));
        }
      } else if (n.stage) {
        const R = c(n, n.stage);
        R !== null && h.push(s({ id: a, kind: "stage", column: n.stage, skill: n.skill && n.skill !== `kipo-${n.stage}` ? n.skill : null }, R));
      }
    }
  }
  return { fresh: f, starts: h };
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
function Qo({ repo: e, number: t, active: i, autoStart: r, spineHost: l, spineCompact: f, onRemoved: h, onChanged: g, onNeeds: c }) {
  var Kt, _t;
  const s = zt(), p = `effort:${e}#${t}`, [n, a] = A(() => rt(p)), [R, j] = A(""), [z, q] = A(""), [H, K] = A(() => rt(`${p}:focus`) ?? { kind: "column" });
  Q(() => {
    st(`${p}:focus`, H);
  }, [p, H]);
  const [L, te] = A(!1), [oe, E] = A(!1), k = ro("chain", 100, 0.75), N = We(() => {
    fe.getInitiative(e, t).then((u) => {
      a(u), st(p, u), j("");
    }).catch((u) => j(Ie(u)));
  }, [e, t, p]);
  Q(() => {
    if (N(), !i) return;
    const u = setInterval(N, 5e3);
    return () => clearInterval(u);
  }, [N, i]);
  const D = n == null ? void 0 : n.column;
  Q(() => {
    q("");
  }, [D, H]);
  const ie = ye(D);
  Q(() => {
    if (D === void 0 || ie.current === D) {
      ie.current = D;
      return;
    }
    const u = ie.current !== void 0;
    ie.current = D, u && K({ kind: "column" });
  }, [D]);
  const ee = n ? wt(H) : null, le = n && ee ? n.sessions[ee] ?? null : null, X = le && !He(le) ? le : null, ge = n && H.kind === "ticket" ? n.tickets.find((u) => u.number === H.t) ?? null : null, ae = async (u = null, v, B = !0, I = !1) => {
    if (!n) return;
    const w = v ?? H;
    te(!0), q("");
    try {
      const S = w.kind === "ticket" ? { column: "build", ticket: w.t, skill: u ?? "implement" } : w.kind === "spec" ? { column: "build", mode: "implement-spec", skill: u ?? "implement-spec" } : w.kind === "decision" ? { column: "shape", ticket: w.t, skill: u } : w.kind === "review" ? { column: "review", ticket: w.t, skill: u } : w.kind === "stage" ? { column: w.column, skill: u } : { column: n.column, mode: "conductor" }, C = await fe.startSession(e, t, I ? { ...S, replace: !0 } : S), T = w.kind === "ticket" ? `${n.title}: #${w.t}` : w.kind === "spec" ? `${n.title}: implement-spec` : w.kind === "decision" ? `${n.title}: decision #${w.t}` : w.kind === "review" ? `${n.title}: review #${w.t}` : w.kind === "stage" ? `${n.title}: ${gt[w.column]}` : `${n.title}: conductor`;
      C.existing ? await s.post("/api/chat?ws=1", { slot: C.slotName, message: C.seed }) : await go(s, e, C.slotName, C.seed, T, C.agent), C.key && await fe.sessionStarted(e, t, C.key).catch(() => fe.sessionStarted(e, t, C.key)).catch(() => {
      }), v && B && K(v), B && (N(), g());
    } catch (S) {
      q(
        S instanceof St && S.code === "ticket_blocked" ? S.message : `Couldn't start the conversation: ${Ie(S)}`
      );
    } finally {
      te(!1);
    }
  }, y = (u) => u.lane === "deliver" ? { kind: "ticket", t: u.number } : { kind: "decision", t: u.number }, W = (u) => u.lane === "deliver" ? "implement" : u.type === "research" ? "research" : u.type === "prototype" ? "prototype" : u.type === "issue" ? "triage" : null, [M, P] = A(null), se = (u) => {
    K(y(u));
  }, F = n != null && n.frontier && (H.kind === "ticket" || H.kind === "decision") ? n.frontier.tiles.find((u) => u.number === H.t) ?? null : null, [pe, J] = A({}), [xe, Ae] = A({}), [$, _] = A(null), [he, me] = A({});
  Q(() => {
    let u = !0;
    const v = () => (at(), s.get("/api/chat/slots").then((I) => {
      !u || !Array.isArray(I) || (_(new Set(I.filter((w) => w.key).map((w) => w.key))), me(Object.fromEntries(I.filter((w) => w.key).map((w) => [w.key, w]))));
    }).catch(() => {
    }));
    if (v(), !i) return () => {
      u = !1;
    };
    const B = setInterval(v, 5e3);
    return () => {
      u = !1, clearInterval(B);
    };
  }, [s, i]);
  const be = X && !($ !== null && !$.has(X)) ? X : null;
  Q(() => {
    ei(be);
  }, [be]);
  const ve = pt(
    () => {
      var u;
      return (((u = n == null ? void 0 : n.frontier) == null ? void 0 : u.tiles) ?? []).filter((v) => v.sessionKey && (n == null ? void 0 : n.sessions[v.sessionKey]));
    },
    [n]
  );
  Q(() => {
    if (!ve.length) {
      J({}), Ae({});
      return;
    }
    let u = !0;
    const v = (w) => {
      const S = (w == null ? void 0 : w.content) ?? (w == null ? void 0 : w.text), C = typeof S == "string" ? S : Array.isArray(S) ? S.map((Z) => typeof Z == "string" ? Z : (Z == null ? void 0 : Z.text) ?? "").join(" ") : null, T = C == null ? void 0 : C.replace(/\s+/g, " ").trim();
      return T ? T.slice(0, 140) : null;
    }, B = async () => {
      let w = /* @__PURE__ */ new Map();
      try {
        const S = await s.get("/api/chat/slots");
        u && Array.isArray(S) && (w = new Map(S.filter((C) => C.key).map((C) => [C.key, C])));
      } catch {
      }
      Promise.all(ve.map((S) => {
        const C = n.sessions[S.sessionKey], T = w.get(C);
        return s.get(`/api/chat/slots/${encodeURIComponent(C)}?limit=1`).then((Z) => {
          var Gt;
          const je = (Gt = Z == null ? void 0 : Z.messages) == null ? void 0 : Gt[Z.messages.length - 1], ce = (T == null ? void 0 : T.pending_approval) ?? (Z == null ? void 0 : Z.pending_approval), De = (T == null ? void 0 : T.needs_input) ?? (Z == null ? void 0 : Z.needs_input), dt = (T == null ? void 0 : T.running) ?? (Z == null ? void 0 : Z.running), qt = ce ? "approval" : De ? "input" : null, Bn = { at: (je == null ? void 0 : je.ts) ?? null, line: je && je.role !== "user" ? v(je) : null, needs: qt }, jn = qt ? "attention" : dt ? "running" : S.state === "done" ? null : "waiting";
          return [S.number, jn, Bn];
        }).catch(() => null);
      })).then((S) => {
        if (!u) return;
        const C = {}, T = {};
        for (const Z of S)
          Z && (Z[1] && (C[Z[0]] = Z[1]), T[Z[0]] = Z[2]);
        J(C), Ae(T);
      });
    };
    if (B(), !i) return () => {
      u = !1;
    };
    const I = setInterval(B, 5e3);
    return () => {
      u = !1, clearInterval(I);
    };
  }, [s, ve, i, n]);
  const [x, ne] = pt(() => {
    const u = { ...pe }, v = { ...xe };
    for (const B of Object.keys((n == null ? void 0 : n.sessions) ?? {})) {
      const I = B.match(/^(?:build|shape|review)-t(\d+)$/);
      if (!I) continue;
      const w = n.sessions[B];
      if (!w || He(w)) continue;
      const S = he[w], C = S != null && S.pending_approval ? "approval" : S != null && S.needs_input ? "input" : null;
      if (!C) continue;
      const T = Number(I[1]);
      u[T] = "attention", v[T] = { ...v[T] ?? { at: null, line: null }, needs: C };
    }
    return [u, v];
  }, [pe, xe, he, n]), re = pt(() => {
    var S, C, T, Z, je;
    if (!n) return [];
    const u = (ce, De) => ((ce == null ? void 0 : ce.decisions) ?? []).filter((dt) => At(dt) && !(De && Ht(De, dt.id))).length, v = /* @__PURE__ */ new Set(), B = [], I = (ce) => {
      const De = wt(ce);
      v.has(De) || (v.add(De), B.push(ce));
    }, w = (ce) => {
      var De;
      return (De = ce.sessionKey) != null && De.startsWith("review-t") ? { kind: "review", t: ce.number } : ce.lane === "deliver" ? { kind: "ticket", t: ce.number } : { kind: "decision", t: ce.number };
    };
    u(((S = n.sessionStates) == null ? void 0 : S.conductor) ?? n.state, n.sessions.conductor) && I({ kind: "column" });
    for (const ce of ((C = n.frontier) == null ? void 0 : C.tiles) ?? [])
      ce.state === "done" || !ce.sessionKey || (u((T = n.sessionStates) == null ? void 0 : T[ce.sessionKey], n.sessions[ce.sessionKey]) || x[ce.number] === "attention" || ce.state === "you") && I(w(ce));
    for (const ce of ["plan", "review", "done", "intake", "shape", "grill"])
      n.sessions[ce] && u((Z = n.sessionStates) == null ? void 0 : Z[ce], n.sessions[ce]) && I({ kind: "stage", column: ce });
    return n.sessions["build-spec"] && u((je = n.sessionStates) == null ? void 0 : je["build-spec"], n.sessions["build-spec"]) && I({ kind: "spec" }), B;
  }, [n, x]), we = re.length;
  Q(() => {
    c == null || c(we);
  }, [we, c]), Q(() => () => {
    c == null || c(0);
  }, [c]);
  const Ye = async (u) => {
    for (let v = 0; v < u.length; v++)
      P(`Starting ${v + 1} of ${u.length}…`), await ae(W(u[v]), y(u[v]), !1);
    P(null), N(), g();
  }, Ne = `kipo.autopilot:${e}#${t}`, [Be, qe] = A(() => localStorage.getItem(Ne) === "1"), Ee = (u) => {
    qe(u), localStorage.setItem(Ne, u ? "1" : "0");
  }, Le = ye(/* @__PURE__ */ new Set());
  Q(() => {
    if (!Be || !i || M || !(n != null && n.frontier)) return;
    const u = n.frontier.tiles.filter((v) => v.lane === "deliver" && v.state === "afk" && !v.sessionKey && !Le.current.has(v.number));
    u.length && (u.forEach((v) => Le.current.add(v.number)), Ye(u));
  }, [Be, i, M, n]);
  const Ce = `kipo.dispatched:${e}#${t}`, Me = ye(/* @__PURE__ */ new Set()), Pe = (u) => {
    Me.current.delete(u);
    try {
      const v = JSON.parse(localStorage.getItem(Ce) || "[]");
      localStorage.setItem(Ce, JSON.stringify(v.filter((B) => B !== u)));
    } catch {
    }
  };
  Q(() => {
    var w, S;
    if (!i || L || M || !(n != null && n.frontier)) return;
    const u = ((S = (w = n.sessionStates) == null ? void 0 : w.conductor) == null ? void 0 : S.dispatch) ?? [];
    let v = [];
    try {
      v = JSON.parse(localStorage.getItem(Ce) || "[]");
    } catch {
      v = [];
    }
    const { fresh: B, starts: I } = qo(
      u,
      (C) => v.includes(C) || Me.current.has(C),
      n.frontier.tiles,
      n.sessions,
      { prs: [...n.prs, ...n.refPrs ?? []], unstarted: ii(n) }
    );
    if (B.length) {
      for (const C of B)
        Me.current.add(C), v.push(C);
      try {
        localStorage.setItem(Ce, JSON.stringify(v.slice(-300)));
      } catch {
      }
      I.length && (async () => {
        for (const C of I) {
          if (C.replace && !hn(n, C.replace) && !await nn(s, C.replace)) {
            Pe(C.id);
            continue;
          }
          const T = !!C.replace;
          C.kind === "tile" ? await ae(C.skill ?? W(C.tile), y(C.tile), !1, T) : C.kind === "review" ? await ae(null, { kind: "review", t: C.t }, !1, T) : await ae(C.skill, { kind: "stage", column: C.column }, !1, T);
        }
        N(), g();
      })();
    }
  }, [i, L, M, n]);
  const Ze = `kipo.restarted:${e}#${t}`;
  Q(() => {
    if (!i || L || M || !(n != null && n.closing)) return;
    let u = [];
    try {
      u = JSON.parse(localStorage.getItem(Ze) || "[]");
    } catch {
      u = [];
    }
    const B = n.closing.filter((S) => S.started === !1 && S.key !== "conductor" && !u.includes(S.slot)).map((S) => [S, pn(S.key)]).find(([, S]) => S);
    if (!B) return;
    const [I, w] = B;
    try {
      localStorage.setItem(Ze, JSON.stringify([...u, I.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var C;
      if (!hn(n, I.slot) && !await nn(s, I.slot)) return;
      const S = (C = n.frontier) == null ? void 0 : C.tiles.find((T) => (w.kind === "ticket" || w.kind === "decision") && T.number === w.t);
      await ae(S ? W(S) : null, w, !1, !0), N(), g();
    })();
  }, [i, L, M, n]);
  const Se = n != null && n.sessions.conductor && !He(n.sessions.conductor) ? n.sessions.conductor : null, m = ((n == null ? void 0 : n.closing) ?? []).filter((u) => {
    var v;
    return ((v = u.stall) == null ? void 0 : v.state) === "stuck";
  }).map((u) => u.key), Y = n != null && n.frontier ? JSON.stringify({
    t: n.frontier.tiles.map((u) => [u.number, u.state]),
    p: n.prs.map((u) => [u.number, u.state]),
    ...m.length ? { s: m } : {}
  }) : "";
  Q(() => {
    if (!Y || !Se || !i) return;
    const u = `kipo.conductorSaw:${e}#${t}`, v = localStorage.getItem(u);
    if (v === Y) return;
    if (v === null) {
      localStorage.setItem(u, Y);
      return;
    }
    const B = [];
    try {
      const I = JSON.parse(v), w = JSON.parse(Y), S = new Map(I.t), C = new Map(I.p);
      for (const [T, Z] of w.t) S.get(T) !== Z && B.push(`#${T} ${S.get(T) ?? "new"} → ${Z}`);
      for (const [T, Z] of w.p) C.get(T) !== Z && B.push(`PR #${T} ${(C.get(T) ?? "new").toLowerCase()} → ${Z.toLowerCase()}`);
      for (const T of w.s ?? []) (I.s ?? []).includes(T) || B.push(`${T} stuck (woken twice, no answer)`);
    } catch {
    }
    (async () => {
      try {
        const I = await s.get(`/api/chat/slots/${encodeURIComponent(Se)}?limit=1`);
        if (I != null && I.running) return;
        await s.post("/api/chat?ws=1", {
          slot: Se,
          message: `[KiPo] Frontier changed${B.length ? `: ${B.slice(0, 12).join("; ")}` : ""}. Run the frontier and carry on.`
        }), localStorage.setItem(u, Y);
      } catch {
      }
    })();
  }, [Y, Se, i]), Q(() => {
    const u = n == null ? void 0 : n.reports;
    if (!u || !Se || !i) return;
    const v = `kipo.reportsSent:${e}#${t}`, B = Number(localStorage.getItem(v) || "0"), I = u.reports.filter((w) => w.id > Math.max(B, u.read));
    I.length && (async () => {
      try {
        const w = await s.get(`/api/chat/slots/${encodeURIComponent(Se)}?limit=1`);
        if (w != null && w.running) return;
        const S = (T) => {
          var Z;
          return `${T.event}: ${T.text}${(Z = T.items) != null && Z.length ? ` (${T.items.join("; ")})` : ""}`;
        }, C = I.length === 1 ? `[KiPo] Report from ${I[0].from}: ${S(I[0])}` : `[KiPo] Reports from the sessions:
${I.slice(-12).map((T) => `- ${T.from} ${S(T)}`).join(`
`)}`;
        await s.post("/api/chat?ws=1", { slot: Se, message: `${C}
Run the frontier and carry on.` }), localStorage.setItem(v, String(I[I.length - 1].id));
      } catch {
      }
    })();
  }, [n, Se, i]);
  const U = (u, v) => {
    if (n) {
      if (n.sessions[u]) {
        K({ kind: "stage", column: u });
        return;
      }
      ae(v, { kind: "stage", column: u });
    }
  }, V = () => U("plan", "to-spec"), Ue = () => U("review", null), Te = () => U("done", "retro"), Ge = async () => {
    if (n) {
      E(!0), q("");
      try {
        n.column !== "done" && await fe.advance(e, t, !0, "done"), await fe.advance(e, t, !0, null), await on(s, Object.values(n.sessions), null), h();
      } catch (u) {
        q(`Couldn't close it: ${Ie(u)}`), E(!1);
      }
    }
  }, Qe = ye(!1);
  Q(() => {
    if (!(n != null && n.closing) || !i || Qe.current) return;
    const u = n.closing.filter((v) => v.status === "closable");
    u.length && (Qe.current = !0, on(s, u.map((v) => v.slot), X).then((v) => {
      const B = u.filter((I) => v.includes(I.slot)).map((I) => I.key);
      return B.length ? fe.sessionsClosed(e, t, B).then(() => N()) : void 0;
    }).catch(() => {
    }).finally(() => {
      Qe.current = !1;
    }));
  }, [s, n, i, X]);
  const ue = JSON.stringify(Yo((n == null ? void 0 : n.closing) ?? []).filter((u) => !He(u.slot)).map((u) => [u.key, u.slot]));
  Q(() => {
    const u = JSON.parse(ue);
    if (!i || !u.length) return;
    let v = !0;
    const B = () => {
      Promise.all(u.map(
        ([w, S]) => s.get(`/api/chat/slots/${encodeURIComponent(S)}?limit=1`).then((C) => [w, Jo(C)]).catch(() => null)
      )).then((w) => {
        if (!v) return;
        const S = Object.fromEntries(w.filter((C) => C && C[1]).map((C) => [C[0], C[1]]));
        Object.keys(S).length && fe.sessionsActivity(e, t, S).catch(() => {
        });
      });
    };
    B();
    const I = setInterval(B, 3e4);
    return () => {
      v = !1, clearInterval(I);
    };
  }, [s, ue, i, e, t]);
  const $e = `kipo.woke:${e}#${t}`, Fe = `kipo.wokeNotes:${e}#${t}`, et = ye(!1);
  Q(() => {
    if (!(n != null && n.closing) || !i || et.current) return;
    let u = [];
    try {
      u = JSON.parse(localStorage.getItem($e) || "[]");
    } catch {
      u = [];
    }
    let v = [];
    try {
      v = JSON.parse(localStorage.getItem(Fe) || "[]");
    } catch {
      v = [];
    }
    const B = Uo(n.closing, X, (I) => u.includes(I)).filter((I) => !He(I.slot));
    !B.length && !(v.length && Se) || (et.current = !0, (async () => {
      for (const I of B) {
        const w = I.stall;
        try {
          const S = await s.get(`/api/chat/slots/${encodeURIComponent(I.slot)}?limit=1`);
          if (S != null && S.running) continue;
          await s.post("/api/chat?ws=1", { slot: I.slot, message: Go(w.why) }), u = [...u, `${I.key}/${w.id}`].slice(-300), localStorage.setItem($e, JSON.stringify(u)), v = [...v, Fo(I.key, w.why)], localStorage.setItem(Fe, JSON.stringify(v)), await fe.sessionsWoken(e, t, I.key, w.id ?? "", w.why);
        } catch {
        }
      }
      if (v.length && Se)
        try {
          const I = await s.get(`/api/chat/slots/${encodeURIComponent(Se)}?limit=1`);
          I != null && I.running || (await s.post("/api/chat?ws=1", { slot: Se, message: `${v.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(Fe, "[]"));
        } catch {
        }
      B.length && N();
    })().finally(() => {
      et.current = !1;
    }));
  }, [s, n, i, X, Se]);
  const Nt = ye(!1);
  if (Q(() => {
    !r || Nt.current || !n || (Nt.current = !0, n.sessions[n.column] || ae());
  }, [r, n]), !n)
    return /* @__PURE__ */ o("div", { style: { flex: 1, padding: 24 }, children: R ? /* @__PURE__ */ o(_e, { children: R }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.body }, children: "Loading…" }) });
  const tt = ee ? ((Kt = n.sessionStates) == null ? void 0 : Kt[ee]) ?? null : n.state, Lt = (tt == null ? void 0 : tt.skillsUsed) ?? [], zn = () => {
    if (H.kind !== "column") {
      K({ kind: "column" });
      return;
    }
    if (!re.length) return;
    const u = re.findIndex((v) => wt(v) === ee);
    K(re[(u + 1) % re.length]);
  }, Pt = ye(null), On = () => {
    var u, v;
    try {
      (v = (u = Pt.current) == null ? void 0 : u.contentWindow) == null || v.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [nt, An] = A(!1), [Dt, En] = A(0), Mn = We((u) => En((v) => Math.abs(v - u) > 4 ? u : v), []), [Bt, Wn] = A(128), Hn = We((u) => Wn((v) => Math.abs(v - u) > 4 ? u : v), []), Nn = F ? F.state === "done" : !!le && He(le), Xe = H.kind === "column" ? tt ?? n.state : tt, jt = (u) => {
    var B, I;
    const v = u.match(/^(build|shape|review)-t(\d+)$/);
    if (v) {
      const w = (I = (B = n.frontier) == null ? void 0 : B.tiles) == null ? void 0 : I.find((C) => C.number === Number(v[2]));
      return `${v[1] === "review" ? "Review" : v[1] === "build" ? "Build" : "Shape"} #${v[2]}${w != null && w.title ? ` · ${w.title}` : ""}`;
    }
    return u === "build-spec" ? "Build: the spec" : u === "conductor" ? "Conductor" : gt[u] ?? u;
  }, Ln = new Set((((_t = n.frontier) == null ? void 0 : _t.tiles) ?? []).filter((u) => u.state === "done" && u.sessionKey).map((u) => u.sessionKey)), Pn = (() => {
    var B, I;
    if (H.kind !== "column")
      return Nn || !X ? [] : ((Xe == null ? void 0 : Xe.decisions) ?? []).map((w) => ({ slot: X, d: w }));
    const u = [], v = n.sessions.conductor;
    if (v && !He(v)) for (const w of (Xe == null ? void 0 : Xe.decisions) ?? []) u.push({ slot: v, d: w });
    for (const w of Object.keys(n.sessions)) {
      if (w === "conductor" || Ln.has(w)) continue;
      const S = n.sessions[w];
      if (!(!S || He(S)))
        for (const C of ((I = (B = n.sessionStates) == null ? void 0 : B[w]) == null ? void 0 : I.decisions) ?? []) u.push({ slot: S, from: jt(w), d: C });
    }
    return u;
  })(), Dn = (() => {
    if (H.kind !== "column") return [];
    const u = /* @__PURE__ */ new Set(), v = [];
    for (const B of Object.keys(n.sessions)) {
      const I = n.sessions[B];
      if (!I || I === be || He(I) || u.has(I)) continue;
      const w = he[I];
      if (!(w != null && w.pending_approval)) continue;
      u.add(I);
      const S = w.pending_approval_info;
      v.push({
        key: B,
        slot: I,
        from: jt(B),
        tool: (S == null ? void 0 : S.tool) || "a tool call",
        input: S == null ? void 0 : S.tool_input,
        purpose: S == null ? void 0 : S.tool_purpose
      });
    }
    return v;
  })();
  return /* @__PURE__ */ d("div", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ o("style", { children: "@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}" }),
    /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", minWidth: 0 }, children: [
      /* @__PURE__ */ d("span", { style: { ...Re, fontSize: b.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, title: n.title, children: [
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
      /* @__PURE__ */ o("span", { style: { ...G, fontSize: b.tiny, whiteSpace: "nowrap" }, title: n.repoPath, children: n.repo })
    ] }),
    z && /* @__PURE__ */ o("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ o(_e, { children: z }) }),
    (() => {
      var C;
      const u = /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ o("span", { style: { ...X ? G : Re, fontSize: X ? b.small : b.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: F ? `#${F.number}${X ? "" : ` ${F.title}`}` : H.kind === "column" ? "Conductor" : n.title }),
        X && Lt.length > 0 && /* @__PURE__ */ o(oi, { skills: Lt }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        F && (n.frontier ? Ct(n.frontier.tiles, F.number).length > 1 : !1) && /* @__PURE__ */ d(
          "button",
          {
            type: "button",
            onClick: () => An((T) => !T),
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
              fontSize: b.small,
              border: `1px solid ${nt ? "var(--border)" : "transparent"}`
            },
            children: [
              /* @__PURE__ */ o(Un, { size: 14 }),
              " Map"
            ]
          }
        ),
        X && /* @__PURE__ */ o(
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
            onMouseEnter: (T) => {
              T.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))", T.currentTarget.style.color = "var(--text)";
            },
            onMouseLeave: (T) => {
              T.currentTarget.style.background = "transparent", T.currentTarget.style.color = "var(--muted)";
            },
            children: /* @__PURE__ */ o(Qn, { size: 15 })
          }
        )
      ] }), v = F && (F.state === "you" || F.state === "afk"), B = !!X && $ !== null && !$.has(X), I = X && B ? /* @__PURE__ */ o(Do, { slot: X, active: i, ended: !0 }) : X ? (
        // The card sits `composerH` up, so the transcript must clear the
        // composer, the card, and a gap above it.
        /* @__PURE__ */ o(
          ti,
          {
            slotKey: X,
            frameRef: Pt,
            padBottom: Dt ? Bt + Dt + 24 : 0,
            onComposerH: Hn
          },
          X
        )
      ) : F ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          v && /* @__PURE__ */ d("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ o(Oe, { primary: !0, disabled: L, onClick: () => ae(W(F)), children: L ? "Starting…" : ((C = Tn[F.type]) == null ? void 0 : C.action) ?? "Start this ticket" }),
            un(F, null).map((T) => /* @__PURE__ */ d(
              "button",
              {
                type: "button",
                disabled: L,
                onClick: () => ae(T.skill),
                title: Ot[T.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: L ? "default" : "pointer", fontSize: b.small },
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
          /* @__PURE__ */ o(Ko, { detail: n, tile: F })
        ] })
      ) : /* @__PURE__ */ o(
        ni,
        {
          detail: n,
          focus: H,
          ticket: ge,
          tile: null,
          starting: L,
          onStart: () => ae(null),
          alternatives: un(null, H.kind === "column" ? n.column : null),
          onSkill: (T) => ae(T)
        }
      ), w = F && n.frontier ? Ct(n.frontier.tiles, F.number) : [], S = l ? Xn(
        /* @__PURE__ */ o(
          Ro,
          {
            detail: n,
            statuses: x,
            activity: ne,
            busy: oe || L || !!M,
            autopilot: Be,
            selectedKey: ee,
            embedded: !0,
            compact: f,
            onAutopilot: Ee,
            onOpenTile: se,
            onOpenConversation: (T) => K(T === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(T) ? { kind: "review", t: Number(T.slice(8)) } : { kind: "stage", column: T }),
            onSelectConductor: () => K({ kind: "column" }),
            onJumpQuestions: zn,
            onHandover: V,
            onReview: Ue,
            onRetro: Te,
            onClose: Ge
          }
        ),
        l
      ) : null;
      return /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        S,
        /* @__PURE__ */ d("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          u,
          F && w.length > 1 && nt && /* @__PURE__ */ d(ke, { children: [
            /* @__PURE__ */ d("div", { ref: k.ref, style: { ...k.style }, children: [
              /* @__PURE__ */ o("div", { style: { padding: "6px 16px 0", fontSize: b.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ o(Lo, { tiles: w, focus: F.number, onOpen: se, labeled: !0, dimOthers: !1, statuses: pe, down: !0 })
            ] }),
            /* @__PURE__ */ o(
              wn,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: k.onDrag,
                onReset: k.reset
              }
            )
          ] }),
          /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            I,
            /* @__PURE__ */ o(
              Bo,
              {
                items: Pn,
                prompts: Dn,
                onOpenPrompt: (T) => K(pn(T) ?? { kind: "column" }),
                onError: q,
                onSize: Mn,
                bottomOffset: Bt + 10
              },
              ee ?? "none"
            )
          ] })
        ] })
      ] });
    })()
  ] });
}
function dn(e) {
  const t = (f) => typeof f == "string" && /(^|_)kipo-/.test(f), i = (f) => f === e || f.endsWith(`_${e}`), r = (f) => t(f) ? f : f && typeof f == "object" && t(f.key) ? f.key : null, l = (f) => {
    let h = !1;
    if (Array.isArray(f))
      for (let g = f.length - 1; g >= 0; g--) {
        const c = r(f[g]);
        c !== null && !i(c) ? (f.splice(g, 1), h = !0) : l(f[g]) && (h = !0);
      }
    else if (f && typeof f == "object")
      for (const g of Object.values(f)) l(g) && (h = !0);
    return h;
  };
  for (const f of [window.localStorage, window.sessionStorage])
    try {
      for (const h of Object.keys(f)) {
        const g = f.getItem(h);
        if (!g || !g.includes("kipo-") || g[0] !== "[" && g[0] !== "{") continue;
        let c;
        try {
          c = JSON.parse(g);
        } catch {
          continue;
        }
        l(c) && f.setItem(h, JSON.stringify(c));
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
    const f = l === i ? "" : "none";
    l.style.display !== f && (l.style.display = f, r = !0);
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
  const l = `/popout/chat?sid=${encodeURIComponent(e)}`, f = ye(null), h = ye(i);
  h.current = i;
  const g = We(() => {
    var s;
    try {
      const p = (s = t.current) == null ? void 0 : s.contentDocument;
      if (!p) return;
      let n = p.getElementById("kipo-qcard-css");
      !n && p.head && (n = p.createElement("style"), n.id = "kipo-qcard-css", p.head.appendChild(n));
      const a = h.current ? ".followup-chip{display:none !important}" : "";
      if (n && n.textContent !== a && (n.textContent = a), r) {
        const z = p.querySelector('[data-testid="composer-dock-root"]') ?? p.querySelector('[data-testid="composer-dock"]'), q = z ? Math.round(z.getBoundingClientRect().height) : 0;
        q > 0 && r(q);
      }
      let R = f.current;
      if (!R || !R.isConnected || R.ownerDocument !== p) {
        const z = p.defaultView;
        R = [...p.querySelectorAll("div")].filter((H) => {
          if (H.clientHeight < 200) return !1;
          const K = z == null ? void 0 : z.getComputedStyle(H);
          return !!K && (K.overflowY === "auto" || K.overflowY === "scroll");
        }).sort((H, K) => K.clientHeight - H.clientHeight)[0] ?? null, f.current = R;
      }
      if (!R) return;
      const j = h.current ? `${h.current}px` : "";
      R.style.paddingBottom !== j && (R.style.paddingBottom = j);
    } catch {
    }
  }, [t]);
  Q(() => {
    g();
  }, [g, i]), Q(() => {
    dn(e);
  }, [e]), Q(() => {
    const s = t.current;
    return s && s.setAttribute("data-kipo-gen", String(Zo())), at(), () => {
      requestAnimationFrame(at);
    };
  }, [e, t]);
  const c = () => {
    var p;
    const s = t.current;
    try {
      const n = (p = s == null ? void 0 : s.contentWindow) == null ? void 0 : p.location.pathname;
      if (s && n && !n.startsWith("/popout/chat")) {
        s.src = l;
        return;
      }
      const a = s == null ? void 0 : s.contentDocument;
      if (a && !a.getElementById("kipo-popout-css")) {
        const R = a.createElement("style");
        R.id = "kipo-popout-css", R.textContent = [
          '[title*="main window" i]',
          '[aria-label*="main window" i]',
          '[title*="split view" i]',
          '[aria-label*="split view" i]',
          '[aria-label="Close panel"]',
          '[title="Close panel"]'
        ].join(",") + "{display:none !important}", a.head.appendChild(R);
      }
    } catch {
    }
  };
  return Q(() => {
    const s = [], p = window.setInterval(() => {
      var a;
      const n = t.current;
      try {
        const R = (a = n == null ? void 0 : n.contentWindow) == null ? void 0 : a.location.pathname;
        if (n && R && !R.startsWith("/popout/chat")) {
          const z = Date.now();
          for (; s.length && z - s[0] > 6e5; ) s.shift();
          s.length < 5 && (s.push(z), dn(e), n.src = l);
          return;
        }
        at();
        const j = n == null ? void 0 : n.contentDocument;
        j && Xo(j);
      } catch {
      }
      h.current && g();
    }, 2e3);
    return () => window.clearInterval(p);
  }, [l, e, t, g]), /* @__PURE__ */ o(
    "iframe",
    {
      ref: t,
      src: l,
      title: "The session in Kiro's chat",
      onLoad: c,
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
function ni({ detail: e, focus: t, ticket: i, tile: r, starting: l, onStart: f, alternatives: h, onSkill: g }) {
  let c, s, p;
  if (r) {
    const n = Tn[r.type];
    r.state === "done" ? (c = "Closed", s = r.sessionKey ? "Its conversation was closed when the ticket was. How it ended is on the right." : "How it ended is on the right.", p = null) : r.state === "blocked" ? (c = `Waiting on ${r.blockedBy.map((a) => `#${a}`).join(", ")}`, s = "It can start once those are closed.", p = null) : r.state === "review" ? (c = "In review", s = "Its PR is open. The effort's Review merges it once it's clean.", p = null) : (c = "No conversation yet", s = `${r.who === "you" ? "HITL (human in the loop): it needs you." : "Agent (AFK, away from keyboard): an agent can take it on its own."} ${n.body}`, p = n.action);
  } else if (t.kind === "ticket")
    i != null && i.blockedBy.length ? (c = `#${t.t} is waiting on ${i.blockedBy.map((n) => `#${n}`).join(", ")}`, s = "It can start once those are closed.", p = null) : (i == null ? void 0 : i.state) === "CLOSED" ? (c = `#${t.t} is closed`, s = "Nothing left to build on this ticket.", p = null) : (c = `Build #${t.t}`, s = "/implement builds this one ticket test-first in a fresh conversation, then reviews it.", p = "Implement this ticket");
  else if (t.kind === "spec")
    c = "Implement the whole spec", s = "/implement-spec builds every unblocked ticket in parallel on one integration branch, then one review.", p = "Run /implement-spec";
  else if (t.kind === "review")
    c = `Review #${t.t}`, s = "kipo-review reviews this ticket's PR, fixes what it finds, and merges it if it's a two-way door.", p = "Review this ticket";
  else if (t.kind === "decision")
    c = `Decision #${t.t}`, s = "Work through this decision ticket from the map in its own conversation.", p = "Start this decision";
  else if (t.kind === "column")
    c = "Start the conductor", s = "The conductor runs this effort: it reads the frontier from GitHub, starts one stage-skill conversation per open thread, asks you in one batched message, and closes the effort when the frontier is empty. It never does the work itself.", p = "Start the conductor";
  else {
    const n = t.column, a = n === "plan" && e.sessions.grill;
    c = `${gt[n]} hasn't started`, s = a ? "Plan continues the Grill conversation, so the spec and tickets are written with everything it learned." : `${Zn[n]}`, p = a ? "Continue in the Grill conversation" : `Start ${gt[n]}`;
  }
  return /* @__PURE__ */ o("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ d("div", { style: { maxWidth: 400, textAlign: "center" }, children: [
    /* @__PURE__ */ o("div", { style: { ...Re, fontSize: b.title }, children: c }),
    /* @__PURE__ */ o("div", { style: { ...G, fontSize: b.body, margin: "6px 0 14px", lineHeight: 1.5 }, children: s }),
    /* @__PURE__ */ o("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }, children: p && /* @__PURE__ */ o(Oe, { primary: !0, disabled: l, onClick: f, children: l ? "Starting…" : p }) }),
    p && h.map((n) => /* @__PURE__ */ d("div", { style: { marginTop: 10, fontSize: b.small }, children: [
      /* @__PURE__ */ o("span", { style: G, children: "or " }),
      /* @__PURE__ */ d(
        "button",
        {
          type: "button",
          disabled: l,
          onClick: () => g(n.skill),
          title: Ot[n.skill],
          style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: l ? "default" : "pointer", fontSize: b.small },
          children: [
            "/",
            n.skill
          ]
        }
      ),
      /* @__PURE__ */ d("span", { style: G, children: [
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
  return /* @__PURE__ */ d("span", { style: { ...G, fontSize: b.tiny, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: [
    "Running",
    " ",
    e.map((t, i) => /* @__PURE__ */ d("span", { children: [
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
  const e = Kn(), t = (e == null ? void 0 : e.active) !== !1, i = zt(), [r, l] = A(() => rt("initiatives")), [f, h] = A(() => rt("repos")), [g, c] = A(!1), [s, p] = A(""), [n, a] = A(() => {
    const y = rt("main");
    return !y || !["new", "initiative"].includes(y.kind) ? null : y.kind === "initiative" ? { ...y, autoStart: void 0 } : y;
  });
  Q(() => {
    n && st("main", n);
  }, [n]);
  const [R, j] = vn("rail", 300, 168, 620), [z, q] = A(null), [H, K] = A(() => localStorage.getItem("kipo.railOpen") !== "0"), L = (y) => {
    K(y), localStorage.setItem("kipo.railOpen", y ? "1" : "0");
  };
  Q(() => {
    uo(i).catch(() => {
    });
  }, [i]);
  const [te, oe] = A(""), E = We(() => {
    fe.listInitiatives().then((y) => {
      var W;
      l(y.initiatives), st("initiatives", y.initiatives), h(y.repos ?? []), st("repos", y.repos ?? []), p(""), oe((W = y.errors) != null && W.length ? `GitHub is refusing calls for ${y.errors.length === 1 ? y.errors[0].repo.split("/").pop() : `${y.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch((y) => p(Ie(y)));
  }, []);
  Q(() => {
    if (E(), !t) return;
    const y = setInterval(E, 15e3);
    return () => clearInterval(y);
  }, [E, t]), Q(() => {
    if (r === null) return;
    const y = (n == null ? void 0 : n.kind) === "initiative" && !r.some((M) => M.repo === n.repo && M.number === n.number);
    if (n && !y) return;
    const W = r[0];
    a(W ? { kind: "initiative", repo: W.repo, number: W.number } : { kind: "new" });
  }, [r, n]);
  const k = (y, W) => a({ kind: "initiative", repo: y.repo, number: y.number, autoStart: W }), N = (y) => {
    l((W) => (W ?? []).filter((M) => !(M.repo === y.repo && M.number === y.number))), fe.hide(y.repo, y.number).then(E).catch((W) => {
      p(Ie(W)), E();
    });
  }, D = (y) => {
    l((W) => (W ?? []).filter((M) => !(M.repo === y.repo && M.number === y.number))), fe.removeInitiative(y.repo, y.number).then(E).catch((W) => {
      p(Ie(W)), E();
    });
  }, ie = (y) => {
    h((W) => (W ?? []).filter((M) => M.slug !== y)), l((W) => (W ?? []).filter((M) => M.repo !== y)), fe.removeRepo(y).then(E).catch((W) => {
      p(Ie(W)), E();
    });
  }, ee = (y, W) => {
    Promise.allSettled(W.map((M) => fe.unhide(y, M))).then(E);
  }, le = (n == null ? void 0 : n.kind) === "initiative" ? `${n.repo}#${n.number}` : null, [X, ge] = A(0), ae = We((y) => ge(y), []);
  return /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    H ? /* @__PURE__ */ d(ke, { children: [
      /* @__PURE__ */ o(
        Eo,
        {
          width: R,
          onCollapse: () => L(!1),
          items: r,
          repos: f,
          error: s,
          notice: te,
          selected: le,
          attention: X,
          spineSlot: q,
          onNew: () => a({ kind: "new" }),
          onAddRepo: () => c(!0),
          onRemoveRepo: ie,
          onRestore: ee,
          onSelect: (y) => k(y),
          onHide: N,
          onRemove: D
        }
      ),
      /* @__PURE__ */ o(wn, { direction: "vertical", label: "Resize the effort list", onDrag: (y) => j((W) => W + y), onReset: () => j(228) })
    ] }) : /* @__PURE__ */ o(
      Mo,
      {
        items: r,
        selected: le,
        attention: X,
        onNew: () => a({ kind: "new" }),
        onSelect: (y) => k(y),
        onExpand: () => L(!0)
      }
    ),
    /* @__PURE__ */ d("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (n == null ? void 0 : n.kind) === "new" && /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ o(
        Ho,
        {
          onStarted: (y) => {
            E(), k(y, !0);
          },
          onCancel: r && r.length ? () => a(r[0] ? { kind: "initiative", repo: r[0].repo, number: r[0].number } : { kind: "new" }) : void 0
        }
      ) }),
      (n == null ? void 0 : n.kind) === "initiative" && /* @__PURE__ */ o(
        Qo,
        {
          repo: n.repo,
          number: n.number,
          autoStart: n.autoStart,
          active: t,
          spineHost: H ? z : null,
          spineCompact: R < 340,
          onChanged: E,
          onRemoved: () => {
            E(), a(null);
          },
          onNeeds: ae
        },
        `${n.repo}#${n.number}`
      )
    ] }),
    g && /* @__PURE__ */ o(io, { onAdded: E, onClose: () => c(!1) })
  ] });
}
export {
  ui as default
};
