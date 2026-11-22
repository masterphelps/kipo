import { jsxs as d, jsx as o, Fragment as we } from "react/jsx-runtime";
import { useAppApi as Ct, useAppInfo as Dn } from "@kirocrew/app-sdk";
import { useState as E, useCallback as Ee, useEffect as U, useRef as ve, useLayoutEffect as Pn, useMemo as vt } from "react";
import { Btn as Ce, Badge as Bt, MarkdownRenderer as wt } from "@kirocrew/app-sdk/ui";
import { X as Ln, FolderGit2 as cn, FolderOpen as Bn, MessageSquare as dn, ChevronRight as kt, Plus as jn, FolderPlus as qn, MoreHorizontal as jt, ExternalLink as qt, EyeOff as Kn, Trash2 as Kt, Map as _n, PanelRight as Gn } from "lucide-react";
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
  let f;
  if (l.trim())
    try {
      f = JSON.parse(l);
    } catch {
      f = void 0;
    }
  if (!r.ok) {
    const h = f ?? {}, g = typeof h.error == "string" && h.error ? h.error : `The KiPo backend answered ${r.status}.`;
    throw new xt(r.status, g, typeof h.code == "string" ? h.code : null);
  }
  return f;
}
const Re = (e, t) => {
  const [i, r] = e.split("/");
  return `/initiatives/${encodeURIComponent(i)}/${encodeURIComponent(r)}/${t}`;
}, ge = {
  getConfig: () => le("/config"),
  putConfig: (e) => le("/config", "PUT", e),
  discoverRepos: () => le("/repos/discover"),
  addRepo: (e) => le("/repos", "POST", { path: e }),
  removeRepo: (e) => le("/repos/remove", "POST", { slug: e }),
  browse: (e) => le(e ? `/browse?path=${encodeURIComponent(e)}` : "/browse"),
  listInitiatives: () => le("/initiatives"),
  startInitiative: (e) => le("/initiatives", "POST", e),
  getInitiative: (e, t) => le(Re(e, t)),
  // Next along the path, or `to` a later column.
  advance: (e, t, i, r = null) => le(`${Re(e, t)}/advance`, "POST", { force: i, to: r }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (e, t, i) => le(`${Re(e, t)}/session`, "POST", { skill: null, ticket: null, mode: null, ...i }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (e, t, i) => le(`${Re(e, t)}/sessions/started`, "POST", { key: i }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (e, t, i) => le(`${Re(e, t)}/sessions/closed`, "POST", { keys: i }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (e, t, i) => le(`${Re(e, t)}/sessions/activity`, "POST", { activity: i }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (e, t, i, r, l) => le(`${Re(e, t)}/sessions/woken`, "POST", { key: i, stall: r, why: l }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (e, t, i) => le(`${Re(e, t)}/skill`, "POST", { skill: i }),
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
  hide: (e, t) => le(`${Re(e, t)}/hide`, "POST", {}),
  unhide: (e, t) => le(`${Re(e, t)}/unhide`, "POST", {}),
  removeInitiative: (e, t) => le(`${Re(e, t)}/remove`, "POST", {}),
  ticket: (e, t, i) => le(`${Re(e, t)}/tickets/${i}`),
  frontier: (e, t) => le(`${Re(e, t)}/frontier`),
  doc: (e, t, i) => le(`${Re(e, t)}/doc?href=${encodeURIComponent(i)}`)
};
function Se(e) {
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
}, G = { color: "var(--muted)" }, Ie = { color: "var(--text-strong, var(--text))", fontWeight: 600 };
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
function _t({ children: e, onClick: t, disabled: i, primary: r, danger: l, title: f }) {
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
        fontSize: v.body,
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
function gt({ title: e, aside: t, children: i, defaultOpen: r = !0 }) {
  const [l, f] = E(r);
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
          fontSize: v.small
        },
        children: [
          /* @__PURE__ */ o("span", { "aria-hidden": !0, style: { ...G, width: 10, fontSize: 9 }, children: l ? "▾" : "▸" }),
          /* @__PURE__ */ o("span", { style: Ie, children: e }),
          /* @__PURE__ */ o("span", { style: { flex: 1 } }),
          t != null && /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.tiny }, children: t })
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
  const f = Math.round(l / 24);
  return f < 30 ? `${f} d ago` : new Date(t).toLocaleDateString();
}
function St({ kind: e, map: t }) {
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
function pn({ busy: e, onAdd: t, actionLabel: i = "Add" }) {
  var c;
  const [r, l] = E(null), [f, h] = E(""), g = Ee(async (s) => {
    h("");
    try {
      l(await ge.browse(s));
    } catch (u) {
      h(Se(u));
    }
  }, []);
  return U(() => {
    g();
  }, [g]), /* @__PURE__ */ d(
    "div",
    {
      className: "rounded-md p-3 mb-3",
      style: { background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ o(Ge, { children: f }),
        r ? /* @__PURE__ */ d(we, { children: [
          /* @__PURE__ */ d("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ o(Ce, { disabled: !r.parent, onClick: () => r.parent && g(r.parent), children: "Up" }),
            /* @__PURE__ */ o(un, { path: r.path }),
            ((c = r.here) == null ? void 0 : c.slug) && /* @__PURE__ */ d(Ce, { primary: !0, disabled: e === r.path, onClick: () => t(r.path), children: [
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
              s.repo && (s.slug ? /* @__PURE__ */ d(we, { children: [
                /* @__PURE__ */ o(Bt, { variant: "aim", children: s.slug }),
                /* @__PURE__ */ o(Ce, { primary: !0, disabled: e === s.path, onClick: () => t(s.path), children: i })
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
  const [i, r] = E(null), [l, f] = E(""), [h, g] = E(!1), [c, s] = E(null);
  U(() => {
    let n = !0;
    return ge.tree().then((a) => {
      n && r(a.available);
    }).catch((a) => {
      n && (r([]), f(Se(a)));
    }), () => {
      n = !1;
    };
  }, []), U(() => {
    const n = (a) => {
      a.key === "Escape" && t();
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [t]);
  const u = async (n) => {
    s(n), f("");
    try {
      await ge.addRepo(n), e(), t();
    } catch (a) {
      f(Se(a));
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
                /* @__PURE__ */ o("div", { style: { ...Ie, fontSize: v.body }, children: "Add a repo" }),
                /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.tiny, marginTop: 1 }, children: "It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed." })
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
            /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 14px" }, children: [
              /* @__PURE__ */ o(Ge, { children: l }),
              i === null && /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small, padding: "6px 6px" }, children: "Looking for checkouts on this Mac…" }),
              i !== null && i.length > 0 && !h && /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column" }, children: i.slice(0, 12).map((n) => /* @__PURE__ */ d(
                "button",
                {
                  type: "button",
                  disabled: !!c,
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
                    cursor: c ? "default" : "pointer",
                    textAlign: "left"
                  },
                  children: [
                    /* @__PURE__ */ o(cn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
                    /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: c === n.path ? "Adding…" : n.slug }),
                    n.maps > 0 && /* @__PURE__ */ d("span", { style: { ...G, fontSize: v.tiny, flexShrink: 0 }, children: [
                      n.maps,
                      " open map",
                      n.maps === 1 ? "" : "s"
                    ] })
                  ]
                },
                n.path
              )) }),
              i !== null && i.length === 0 && !h && /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small, padding: "6px 6px" }, children: "No un-added checkouts found under your home folder. Browse for one:" }),
              h ? /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(pn, { busy: c, onAdd: (n) => void u(n) }) }) : /* @__PURE__ */ d(
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
                    fontSize: v.small
                  },
                  children: [
                    /* @__PURE__ */ o(Bn, { size: 14, style: { color: "var(--muted)", flexShrink: 0 } }),
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
const hn = "kipo.layout.v1";
function Ft() {
  try {
    return JSON.parse(localStorage.getItem(hn) || "{}");
  } catch {
    return {};
  }
}
function fn(e, t, i, r) {
  const l = Ee((c) => Math.round(Math.min(r, Math.max(i, c))), [i, r]), [f, h] = E(() => {
    const c = Ft()[e];
    return l(typeof c == "number" ? c : t);
  });
  U(() => {
    const c = Ft();
    c[e] = f;
    try {
      localStorage.setItem(hn, JSON.stringify(c));
    } catch {
    }
  }, [e, f]);
  const g = Ee((c) => {
    h((s) => l(typeof c == "function" ? c(s) : c));
  }, [l]);
  return [f, g];
}
function gn({ direction: e, onDrag: t, onReset: i, label: r }) {
  const l = ve(null), [f, h] = E(!1), [g, c] = E(!1), s = e === "vertical", u = (T) => s ? T.clientX : T.clientY;
  U(() => {
    if (!f) return;
    const T = (N) => {
      if (l.current == null) return;
      const q = u(N), D = q - l.current;
      D && (l.current = q, t(D));
    }, _ = () => {
      l.current = null, h(!1);
    };
    return window.addEventListener("pointermove", T), window.addEventListener("pointerup", _), window.addEventListener("pointercancel", _), () => {
      window.removeEventListener("pointermove", T), window.removeEventListener("pointerup", _), window.removeEventListener("pointercancel", _);
    };
  }, [f, t]);
  const n = (T) => {
    T.preventDefault(), l.current = u(T), h(!0);
  }, a = (T) => {
    const _ = T.shiftKey ? 40 : 10, N = s ? "ArrowLeft" : "ArrowUp", q = s ? "ArrowRight" : "ArrowDown";
    T.key === N && (T.preventDefault(), t(-_)), T.key === q && (T.preventDefault(), t(_));
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
function eo(e, t, i = 0.75) {
  const [r, l] = fn(e, 0, 0, 4e3), f = ve(null), h = Ee((c) => {
    const s = Math.round(window.innerHeight * i);
    l((u) => {
      var a;
      const n = u || ((a = f.current) == null ? void 0 : a.offsetHeight) || t;
      return Math.max(t, Math.min(s, n + c));
    });
  }, [t, i, l]), g = r ? { flex: `0 0 ${r}px`, minHeight: 0, overflowY: "auto" } : { flex: "0 1 auto", minHeight: 0, maxHeight: `${Math.round(i * 100)}%`, overflowY: "auto" };
  return { ref: f, style: g, onDrag: h, reset: () => l(0) };
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
  const l = await e.get("/api/chat/folders"), f = l == null ? void 0 : l.find((h) => h.name === t && (h.parent_id || null) === i);
  return f ? f.id : no(await e.post("/api/chat/folders", {
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
  const { byRepo: t } = await ge.listSessions(), i = /* @__PURE__ */ new Map();
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
  const r = ve(null), [l, f] = E({ x: e, y: t });
  return Pn(() => {
    const h = r.current;
    if (!h) return;
    const g = h.getBoundingClientRect();
    f({
      x: e + g.width > window.innerWidth ? Math.max(0, e - g.width) : e,
      y: t + g.height > window.innerHeight ? Math.max(0, t - g.height) : t
    });
  }, [e, t]), U(() => {
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
function Jt({ x: e, y: t, items: i, onClose: r }) {
  const { ref: l, pos: f } = vn(e, t, r);
  return U(() => {
    var h, g;
    (g = (h = l.current) == null ? void 0 : h.querySelector("[role=menuitem]")) == null || g.focus();
  }, [l]), /* @__PURE__ */ o("div", { ref: l, role: "menu", style: { ...bn, left: f.x, top: f.y, padding: "4px 0", minWidth: 160 }, children: i.map((h, g) => {
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
        onClick: (u) => {
          u.stopPropagation(), s();
        },
        onKeyDown: (u) => {
          (u.key === "Enter" || u.key === " ") && (u.preventDefault(), s());
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
function mt({ x: e, y: t, title: i, children: r, action: l, onConfirm: f, onClose: h }) {
  const { ref: g, pos: c } = vn(e, t, h);
  return /* @__PURE__ */ d(
    "div",
    {
      ref: g,
      role: "alertdialog",
      "aria-label": i,
      style: { ...bn, left: c.x, top: c.y, padding: "12px 14px", width: 280 },
      children: [
        /* @__PURE__ */ o("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e0e0e0)", lineHeight: 1.35 }, children: i }),
        r && /* @__PURE__ */ o("div", { style: { fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6, lineHeight: 1.45 }, children: r }),
        /* @__PURE__ */ d("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ o(Ce, { onClick: h, children: "Cancel" }),
          /* @__PURE__ */ o(Ce, { danger: !0, onClick: () => {
            h(), f();
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
const O = {
  done: { label: "done", color: "#3fae6a", text: "#7fd39a" },
  review: { label: "in review", color: "#a78bfa", text: "#a78bfa" },
  building: { label: "building", color: "#60a5fa", text: "#60a5fa" },
  you: { label: "HITL", color: "#f5b14c", text: "#f5b14c" },
  afk: { label: "agent", color: "#2dd4bf", text: "#2dd4bf" },
  blocked: { label: "blocked", color: "#c2615b", text: "#e08a85" },
  fog: { label: "fog", color: "transparent", text: "var(--muted)" }
};
function Ut({ tile: e, onClick: t, size: i = 34, open: r, status: l, bare: f, numberOnly: h, width: g }) {
  const c = O[e.state], s = e.state !== "blocked", u = e.state === "done", n = e.state === "blocked" && e.blockedBy.length ? `#${e.number} ${e.title}: waiting on ${e.blockedBy.map((R) => `#${R}`).join(", ")}` : `#${e.number} ${e.title}: ${c.label}`;
  return /* @__PURE__ */ d(
    "button",
    {
      type: "button",
      onClick: t,
      title: `${n}${l === "running" ? " · agent working" : l === "attention" ? " · needs you: a trust prompt or question" : l === "waiting" ? " · awaiting input" : ""}

${lo(e)}`,
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
        background: u ? "rgba(63,174,106,.22)" : s ? c.color : "transparent",
        color: u ? "#7fd39a" : s ? "#14121c" : "var(--muted)",
        border: s ? "1px solid transparent" : `1.5px solid ${c.color}`
      },
      children: [
        h ? e.number : /* @__PURE__ */ d(we, { children: [
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
async function co(e, t, i, r, l, f) {
  let h;
  try {
    h = await yn(e, t);
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
const wn = "kipo.closedSessions.v1", Le = (e) => !!e && At().has(e);
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
  for (const f of t)
    if (!(!f || f === i)) {
      if (r.has(f)) {
        l.push(f);
        continue;
      }
      try {
        const h = await e.get(`/api/chat/slots/${encodeURIComponent(f)}?limit=1`);
        if (h != null && h.running) continue;
        await e.del(`/api/chat/slots/${encodeURIComponent(f)}`), $t(f), l.push(f);
      } catch (h) {
        /404|not.?found/i.test(String((h == null ? void 0 : h.message) ?? h)) && ($t(f), l.push(f));
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
  ], r = { intake: "Intake", shape: "Shape", grill: "Grill", plan: "Plan", build: "Build", review: "Review", done: "Done" }, l = [...i].reverse().find((u) => u.active), f = l ? r[l.id] : e.total || e.prs.merged ? "Done" : "—", h = e.intake.you + e.shape.you + e.grill.you + e.build.you + (e.handover ? 1 : 0) + (e.landed && !e.retro ? 1 : 0), g = e.shape.building + e.grill.building + e.build.building + e.intake.building, c = e.shape.afk + e.grill.afk + e.build.afk + e.intake.afk, s = [
    e.doneTiles ? `${e.doneTiles}/${e.total} done` : "",
    h ? `${h} HITL` : "",
    g ? `${g} in agents` : "",
    c ? `${c} ready` : "",
    e.prs.open ? `${e.prs.open} PR${e.prs.open === 1 ? "" : "s"}` : "",
    e.fog ? `${e.fog} fog` : ""
  ].filter(Boolean);
  return { segs: i, front: f, bits: s.slice(0, 4).join(" · ") };
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
}, Ve = (e, t) => ({ n: e, color: O[t].color });
function yo(e, t) {
  const i = [];
  return t > 0 && i.push(t === 1 ? "1 needs you now" : `${t} need you now`), e > 0 && i.push(e === 1 ? "1 question" : `${e} questions`), i.join(" · ") + (t > 0 ? "" : " waiting on you");
}
function bo({ detail: e, statuses: t, activity: i, busy: r, autopilot: l, selectedKey: f, embedded: h, compact: g, onAutopilot: c, onOpenTile: s, onOpenConversation: u, onSelectConductor: n, onJumpQuestions: a, onHandover: R, onReview: j, onRetro: T, onClose: _ }) {
  var Pe, Ne, fe, Ze, je;
  const [N, q] = E(!1), D = (m) => {
    var ee, X;
    return m ? (((X = (ee = e.sessionStates) == null ? void 0 : ee[m]) == null ? void 0 : X.decisions) ?? []).filter(pt).length : 0;
  }, ne = (((Ne = ((Pe = e.sessionStates) == null ? void 0 : Pe.conductor) ?? e.state) == null ? void 0 : Ne.decisions) ?? []).filter(pt).length, ie = (m) => ({ label: m === 1 ? "1 question" : `${m} questions`, color: O.you.color }), S = e.frontier, I = (S == null ? void 0 : S.tiles) ?? [], H = (fe = S == null ? void 0 : S.fogItems) != null && fe.length ? S.fogItems : (S == null ? void 0 : S.fogLeft) ?? [], F = !((Ze = S == null ? void 0 : S.fogItems) != null && Ze.length) && !!((je = S == null ? void 0 : S.fogLeft) != null && je.length), se = new Map(nt.map((m) => [m, []]));
  for (const m of I) se.get(po(m)).push(m);
  const pe = (m) => m.source ? "intake" : m.type === "build" ? "build" : m.type === "grilling" ? "grill" : "shape", ae = new Map(nt.map((m) => [m, []]));
  for (const m of I) ae.get(pe(m)).push(m);
  const P = go[e.start] ?? "grill", oe = nt.indexOf(P), te = ae.get("build"), b = e.artifacts.find((m) => m.label === "Spec" || m.label.startsWith("Spec")), W = e.prs.filter((m) => m.state === "OPEN"), L = e.prs.filter((m) => m.state === "MERGED"), M = I.filter((m) => m.state === "done").length, re = !!e.sessions.done, J = (m) => {
    var Ke;
    const ee = m.state !== "done" ? D(m.sessionKey) : 0, X = t[m.number], V = X === "attention" ? ((Ke = i == null ? void 0 : i[m.number]) == null ? void 0 : Ke.needs) ?? null : null, Ue = X === "running" || X === "attention", ke = X === "attention" || ee > 0 || m.state === "you";
    return {
      key: `t${m.number}`,
      number: m.number,
      title: m.title,
      tile: m,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: ee ? ie(ee) : V === "approval" ? { label: "trust prompt", color: O.you.color } : V === "input" ? { label: "asking", color: O.you.color } : { label: O[m.state].label, color: m.state === "done" ? O.done.text : O[m.state].color, solid: m.state === "you" || m.state === "afk" },
      // A pulsing dot shows for a busy session (blue) or a ticket that needs
      // you (amber), so an idle HITL ticket still draws the eye.
      pulse: Ue || ke,
      attention: ke,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: Ue ? i == null ? void 0 : i[m.number] : void 0,
      questions: ee,
      selKeys: [`build-t${m.number}`, `shape-t${m.number}`, `review-t${m.number}`]
    };
  }, ce = (m) => {
    const ee = (X) => m.filter((V) => V.state === X).length;
    return { done: ee("done"), you: ee("you"), afk: ee("afk"), building: ee("building"), review: ee("review"), blocked: ee("blocked") };
  }, Q = (m) => {
    const ee = ["you", "building", "afk", "review", "blocked", "done"];
    return [...m].sort((X, V) => ee.indexOf(X.state) - ee.indexOf(V.state) || X.number - V.number);
  }, $e = {
    intake: "The intake conversation",
    shape: "Charting the map",
    grill: "The grill interview",
    plan: "Writing the spec",
    "build-spec": "Building every ready ticket",
    review: "Reviewing the PRs",
    done: "The retro"
  }, ze = (m) => {
    const ee = e.sessions[m];
    if (!ee || Le(ee)) return [];
    const X = D(m);
    return [{
      key: `conv-${m}`,
      title: $e[m] ?? "Its conversation",
      chip: X ? ie(X) : { label: "conversation", color: "var(--accent)" },
      onOpen: () => u(m),
      questions: X,
      selKeys: [m]
    }];
  }, me = nt.map((m) => {
    const ee = ae.get(m), X = ze(m === "build" ? "build-spec" : m);
    if (m === "plan") {
      if (te.length || b)
        return { id: m, state: "full", count: /* @__PURE__ */ d(we, { children: [
          /* @__PURE__ */ o("b", { style: Ie, children: "1 spec" }),
          " → ",
          te.length || "?",
          " tickets"
        ] }), segments: [{ n: 1, color: O.done.color }], rows: X };
      if (S != null && S.handover)
        return {
          id: m,
          state: "live",
          count: /* @__PURE__ */ o("b", { style: { color: O.you.color }, children: "at the handover" }),
          segments: [{ n: 1, color: O.you.color }],
          rows: X,
          // Once the conversation exists, its row above is the way back in.
          action: X.length ? void 0 : { label: "Write the spec", onClick: R }
        };
      const de = I.filter((xe) => xe.lane === "decide" && xe.state !== "done").length;
      return { id: m, state: "queued", count: "", ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${de || "the"} decision${de === 1 ? "" : "s"}${H.length ? ` and ${H.length} fog` : ""}`, segments: [], rows: X };
    }
    if (m === "review")
      return !W.length && !L.length && !X.length ? { id: m, state: "queued", count: "", ghost: "each PR reviewed, clean ones merged by Merge Danger", segments: [], rows: [] } : {
        id: m,
        state: W.length ? "live" : "full",
        count: /* @__PURE__ */ d(we, { children: [
          /* @__PURE__ */ d("b", { style: Ie, children: [
            L.length,
            " merged"
          ] }),
          W.length ? /* @__PURE__ */ d(we, { children: [
            " · ",
            W.length,
            " waiting"
          ] }) : null
        ] }),
        segments: [{ n: L.length, color: O.done.color }, { n: W.length, color: O.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...X, ...W.map((de) => {
          const xe = de.tickets[0];
          return {
            key: `pr${de.number}`,
            number: de.number,
            title: de.title,
            chip: { label: "open", color: O.review.color },
            ...xe != null ? { onOpen: () => u(`review-t${xe}`), selKeys: [`review-t${xe}`] } : { url: de.url }
          };
        })],
        action: W.length && !X.length ? { label: "Review the PRs", onClick: j } : void 0
      };
    if (m === "done") {
      const de = !!(S != null && S.landed), xe = de && re && e.kind !== "map";
      return {
        id: m,
        state: M ? de ? "live" : "full" : "queued",
        count: M ? /* @__PURE__ */ d(we, { children: [
          /* @__PURE__ */ d("b", { style: Ie, children: [
            M,
            " of ",
            I.length
          ] }),
          " · ",
          re ? "retro ran" : "retro not yet"
        ] }) : "",
        ghost: M ? void 0 : "closes when the retro runs",
        segments: [{ n: M, color: O.done.color }, { n: Math.max(0, I.length - M), color: "transparent" }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...X, ...I.filter((Qe) => Qe.state === "done").sort((Qe, Fe) => Qe.number - Fe.number).map(J)],
        action: de && !re ? { label: "Run /retro", onClick: T } : xe ? N ? { label: "Close the effort and its issue?", onClick: () => {
          q(!1), _();
        }, confirm: () => q(!1) } : { label: "Close effort", onClick: () => q(!0) } : void 0
      };
    }
    if (!ee.length && !(m === "shape" && H.length) && !X.length)
      return nt.indexOf(m) < oe ? { id: m, state: "skipped", count: `entered at ${st[P]}`, segments: [], rows: [] } : m === "build" ? { id: m, state: "queued", count: "", ghost: "cut from the spec · done, in agents, ready, blocked", segments: [], rows: [] } : { id: m, state: "skipped", count: "nothing here", segments: [], rows: [] };
    const V = ce(ee), Ue = V.you + V.afk + V.building + V.review + V.blocked > 0 || !ee.length && X.length > 0, ke = [];
    m === "grill" ? (V.done && ke.push(`${V.done} answered`), V.you && ke.push(`${V.you} waiting`)) : (V.done && ke.push(`${V.done} done`), V.you && ke.push(`${V.you} HITL`)), V.building && ke.push(`${V.building} in agents`), V.afk && ke.push(`${V.afk} ready`), V.review && ke.push(`${V.review} in review`), V.blocked && ke.push(`${V.blocked} blocked`);
    const Ke = [Ve(V.done, "done"), Ve(V.building, "building"), Ve(V.review, "review"), Ve(V.you, "you"), Ve(V.afk, "afk"), Ve(V.blocked, "blocked")];
    m === "shape" && H.length && Ke.push({ n: H.length, color: "transparent", dashed: !0 });
    const et = [...X, ...Q(ee.filter((de) => de.state !== "done")).map(J)];
    return m === "shape" && H.forEach((de, xe) => et.push({
      key: `fog${xe}`,
      title: wo(de),
      chip: F ? { label: "left unspecified", color: O.you.color } : { label: "fog", color: "var(--muted)" }
    })), {
      id: m,
      state: Ue ? "live" : "full",
      count: /* @__PURE__ */ d(we, { children: [
        ke.map((de, xe) => xe === 0 ? /* @__PURE__ */ o("b", { style: Ie, children: de }, de) : /* @__PURE__ */ d("span", { children: [
          " · ",
          de
        ] }, de)),
        m === "shape" && H.length ? /* @__PURE__ */ d("span", { children: [
          " · ",
          H.length,
          " fog"
        ] }) : null
      ] }),
      segments: Ke,
      rows: et
    };
  }), De = (m) => m.state === "live", Be = me.reduce((m, ee, X) => De(ee) ? X : m, -1), We = Be >= 0 ? me[Be] : null, x = ce(I), K = I.length, y = [
    { n: x.building, label: "in agents", color: O.building.color },
    { n: x.review, label: "in review", color: O.review.color },
    { n: x.you, label: "HITL", color: O.you.color },
    { n: x.afk, label: "ready", color: O.afk.color },
    { n: x.blocked, label: "blocked", color: O.blocked.color },
    { n: H.length, label: "fog", color: "var(--muted)" }
  ].filter((m) => m.n > 0), [Y, he] = E(() => new Set(We ? [We.id] : [])), ye = (m) => he((ee) => {
    const X = new Set(ee);
    return X.has(m) ? X.delete(m) : X.add(m), X;
  }), Me = ne + me.reduce((m, ee) => m + ee.rows.reduce((X, V) => X + (V.questions ?? 0), 0), 0), Ae = Object.values(i ?? {}).filter((m) => m && (m.needs === "approval" || m.needs === "input")).length, be = I.filter((m) => m.state === "you" && t[m.number] !== "attention" && !D(m.sessionKey)).length, He = f === "conductor", Oe = !!e.sessions.conductor && !Le(e.sessions.conductor), Te = g ? 10 : 16;
  return /* @__PURE__ */ d("div", { style: { display: "flex", flexDirection: "column", minHeight: 0, ...h ? {} : { height: "100%" } }, children: [
    /* @__PURE__ */ d("div", { style: { padding: `10px ${Te}px 9px`, borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ d("span", { style: { ...G, fontSize: v.tiny, flex: 1 }, children: [
          "entered at ",
          st[P],
          " (",
          mo[e.start] ?? e.start,
          ")"
        ] }),
        !h && /* @__PURE__ */ o("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.tiny, whiteSpace: "nowrap" }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }, children: K > 0 ? /* @__PURE__ */ d(we, { children: [
        /* @__PURE__ */ d("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ d("b", { style: { color: O.done.text }, children: [
            x.done,
            " of ",
            K
          ] }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: "done" })
        ] }),
        y.map((m) => /* @__PURE__ */ d("span", { style: { whiteSpace: "nowrap" }, children: [
          /* @__PURE__ */ o("b", { style: { color: m.color }, children: m.n }),
          " ",
          /* @__PURE__ */ o("span", { style: G, children: m.label })
        ] }, m.label))
      ] }) : /* @__PURE__ */ o("span", { style: G, children: H.length ? `${H.length} in the fog, nothing cut yet` : "nothing cut yet" }) }),
      (Me > 0 || Ae > 0 || be > 0) && // The pill only shows when something is waiting on the human, so it
      // pulses the moment it appears — the same amber attention cue the
      // session cards use, for questions, trust prompts/asks, and HITL.
      /* @__PURE__ */ d(
        "button",
        {
          type: "button",
          onClick: a,
          className: "kipo-pulse",
          title: Ae > 0 ? "A session is stopped on a trust prompt or an ask: open it to allow or answer" : be > 0 ? "A ticket is in HITL, waiting on you: open it to act" : "Jump to the next conversation with open questions; answer them on the right",
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
            yo(Me, Ae + be),
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
            fontSize: v.tiny,
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
      /* @__PURE__ */ o("div", { style: { padding: `9px ${Te}px`, borderBottom: "1px solid var(--border)" }, children: /* @__PURE__ */ d(
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
            background: He ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: He ? "var(--accent-fg, #fff)" : "var(--accent)"
          },
          children: [
            /* @__PURE__ */ o(dn, { size: 14, "aria-hidden": !0, style: { flexShrink: 0 } }),
            /* @__PURE__ */ o("span", { style: { flex: 1 }, children: "Conductor" }),
            ne > 0 ? /* @__PURE__ */ o("span", { className: "kipo-pulse", style: {
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              border: `1px solid ${He ? "var(--accent-fg, #fff)" : O.you.color}`,
              color: He ? "var(--accent-fg, #fff)" : O.you.color
            }, children: ne === 1 ? "1 question" : `${ne} questions` }) : /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 400, opacity: 0.75 }, children: Oe ? "conversation" : "not started" })
          ]
        }
      ) }),
      me.map((m) => /* @__PURE__ */ o(
        vo,
        {
          s: m,
          busy: r,
          open: Y.has(m.id),
          selectedKey: f,
          compact: g,
          onToggle: () => ye(m.id),
          onOpenTile: s
        },
        m.id
      )),
      /* @__PURE__ */ d("div", { style: { display: "flex", gap: 12, alignItems: "center", padding: `9px ${Te}px`, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ o(ot, { color: O.done.color, label: "done" }),
        /* @__PURE__ */ o(ot, { color: O.building.color, label: "in agents" }),
        /* @__PURE__ */ o(ot, { color: O.you.color, label: "HITL" }),
        /* @__PURE__ */ o(ot, { color: O.afk.color, label: "ready" }),
        /* @__PURE__ */ o(ot, { color: O.blocked.color, label: "blocked" })
      ] })
    ] })
  ] });
}
function ot({ color: e, label: t }) {
  return /* @__PURE__ */ d("span", { children: [
    /* @__PURE__ */ o("span", { style: { display: "inline-block", width: 9, height: 9, borderRadius: 3, background: e, marginRight: 4, verticalAlign: -1 } }),
    t
  ] });
}
function vo({ s: e, open: t, busy: i, selectedKey: r, compact: l, onToggle: f, onOpenTile: h }) {
  const g = e.state === "skipped" || e.state === "queued", c = e.rows.length > 0 || !!e.action, s = uo.find((a) => a.id === e.id), u = e.segments.reduce((a, R) => a + R.n, 0), n = e.rows.reduce((a, R) => a + (R.questions ?? 0), 0);
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
        title: s ? `${st[e.id]} · ${s.skill}
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
            /* @__PURE__ */ o(kt, { size: 12, "aria-hidden": !0, style: {
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
                style: { width: l ? 48 : 56, flexShrink: 0, fontSize: v.small, fontWeight: 700, color: g ? "var(--muted)" : "var(--text-strong, var(--text))" },
                title: l ? Vt[e.id] : void 0,
                children: st[e.id]
              }
            ),
            !l && /* @__PURE__ */ o("span", { style: { width: 92, flexShrink: 0, fontSize: 10, color: "var(--muted)" }, children: Vt[e.id] }),
            /* @__PURE__ */ d("span", { style: { flex: 1, textAlign: "right", fontSize: v.small, minWidth: 0 }, children: [
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
          u > 0 && /* @__PURE__ */ o("span", { style: { display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg)" }, children: e.segments.filter((a) => a.n > 0).map((a, R) => /* @__PURE__ */ o("span", { style: { flex: a.n, background: a.color, ...a.dashed ? { border: "1px dashed var(--muted)", borderRadius: 3 } : {} } }, R)) }),
          e.ghost && /* @__PURE__ */ o("span", { style: { display: "block", fontSize: v.tiny, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }, children: e.ghost })
        ]
      }
    ),
    t && c && /* @__PURE__ */ d("div", { style: { margin: l ? "0 10px 10px 8px" : "0 16px 10px 14px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }, children: [
      e.action && /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: e.rows.length ? "1px solid var(--border)" : void 0 }, children: [
        /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.tiny, flex: 1 }, children: e.action.confirm ? "" : `${st[e.id]}'s next step` }),
        /* @__PURE__ */ o(_t, { primary: !0, disabled: i, onClick: e.action.onClick, children: e.action.label }),
        e.action.confirm && /* @__PURE__ */ o(_t, { disabled: i, onClick: e.action.confirm, children: "Cancel" })
      ] }),
      e.rows.map((a) => {
        var _;
        const R = () => {
          a.onOpen ? a.onOpen() : a.tile ? h(a.tile) : a.url && window.open(a.url, "_blank", "noreferrer");
        }, j = !!a.onOpen || !!a.tile || !!a.url, T = !!r && !!((_ = a.selKeys) != null && _.includes(r));
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
              fontSize: v.small,
              background: T ? "var(--bg-elevated)" : "transparent",
              boxShadow: T ? "inset 2px 0 0 var(--accent)" : void 0,
              cursor: j ? "pointer" : "default"
            },
            onMouseEnter: (N) => {
              j && !T && (N.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))");
            },
            onMouseLeave: (N) => {
              N.currentTarget.style.background = T ? "var(--bg-elevated)" : "transparent";
            },
            children: [
              /* @__PURE__ */ d("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.tiny, width: 42, flexShrink: 0, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }, children: a.number != null ? `#${a.number}` : a.onOpen ? /* @__PURE__ */ o(dn, { size: 11, "aria-hidden": !0 }) : "☁" }),
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
                    fontSize: v.tiny,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  },
                  children: [
                    /* @__PURE__ */ o("span", { style: { color: O.building.color }, children: ko(a.live.at) }),
                    a.live.line ? /* @__PURE__ */ d(we, { children: [
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
function $o({ width: e, items: t, repos: i, error: r, notice: l, selected: f, attention: h, spineSlot: g, onNew: c, onAddRepo: s, onRemoveRepo: u, onRestore: n, onSelect: a, onHide: R, onRemove: j, onCollapse: T }) {
  const [_, N] = E(""), [q, D] = E(null), [ne, ie] = E(!0);
  U(() => {
    ie(!0);
  }, [f]);
  const [S, I] = E(null), H = Ee(() => I(null), []), [F, se] = E(null), [pe, ae] = E(xo);
  U(() => {
    localStorage.setItem(kn, JSON.stringify(pe));
  }, [pe]);
  const P = (b) => pe[b] !== !1, oe = _.trim().toLowerCase(), te = vt(() => {
    const b = /* @__PURE__ */ new Map();
    for (const L of t ?? []) {
      const M = b.get(L.repo) ?? [];
      M.push(L), b.set(L.repo, M);
    }
    const W = (i ?? []).map((L) => L.slug);
    for (const L of b.keys()) W.includes(L) || W.push(L);
    return W.map((L) => {
      const M = (i ?? []).find((Q) => Q.slug === L) ?? { slug: L, path: "", hidden: [] }, re = b.get(L) ?? [], J = !oe || L.toLowerCase().includes(oe), ce = J ? re : re.filter((Q) => Q.title.toLowerCase().includes(oe));
      return { meta: M, rows: ce, show: !oe || J || ce.length > 0 };
    }).filter((L) => L.show);
  }, [t, i, oe]);
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
            /* @__PURE__ */ o(Ce, { primary: !0, onClick: c, children: /* @__PURE__ */ d("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(jn, { size: 14 }),
              "New effort"
            ] }) }),
            /* @__PURE__ */ o("span", { title: "Add a repo: it joins this sidebar with all its maps and efforts under it", children: /* @__PURE__ */ o(Ce, { onClick: s, children: /* @__PURE__ */ d("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
              /* @__PURE__ */ o(qn, { size: 14 }),
              "Add repo"
            ] }) }) })
          ] }),
          /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ o(
              "input",
              {
                value: _,
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
                onClick: T,
                title: "Fold the effort list away",
                "aria-label": "Fold the effort list away",
                style: { background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: 14, flexShrink: 0 },
                children: "«"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 6px 8px" }, children: [
          r && /* @__PURE__ */ o("div", { style: { color: "var(--danger-text)", fontSize: v.small, padding: "4px 6px" }, children: r }),
          !r && l && /* @__PURE__ */ o("div", { style: { color: "#f5b14c", fontSize: v.tiny, padding: "4px 6px", lineHeight: 1.4 }, children: l }),
          t === null && !r && /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small, padding: "4px 6px" }, children: "Loading…" }),
          t !== null && !te.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small, padding: "4px 6px" }, children: oe ? "Nothing matches." : "No repos yet. Add one; its maps and efforts show up under it." }),
          te.map((b) => {
            const W = P(b.meta.slug) || !!oe, L = b.meta.slug.split("/").pop() ?? b.meta.slug;
            return /* @__PURE__ */ d("div", { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ d(
                "div",
                {
                  onContextMenu: (M) => {
                    M.preventDefault(), se({ slug: b.meta.slug, x: M.clientX, y: M.clientY, confirm: !1 });
                  },
                  onPointerEnter: () => D(`repo:${b.meta.slug}`),
                  onPointerLeave: () => D((M) => M === `repo:${b.meta.slug}` ? null : M),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 6,
                    padding: "3px 4px",
                    background: q === `repo:${b.meta.slug}` ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ d(
                      "button",
                      {
                        type: "button",
                        onClick: () => ae((M) => ({ ...M, [b.meta.slug]: !W })),
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
                          /* @__PURE__ */ o(kt, { size: 11, "aria-hidden": !0, style: {
                            flexShrink: 0,
                            color: "var(--muted)",
                            transition: "transform .12s",
                            transform: W ? "rotate(90deg)" : void 0
                          } }),
                          /* @__PURE__ */ o(cn, { size: 13, "aria-hidden": !0, style: { flexShrink: 0, color: "var(--muted)" } }),
                          /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: L }),
                          !W && (h ?? 0) > 0 && (f == null ? void 0 : f.startsWith(`${b.meta.slug}#`)) && /* @__PURE__ */ o(Zt, {}),
                          /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.tiny, flexShrink: 0 }, children: b.rows.length || (W ? "" : "0") })
                        ]
                      }
                    ),
                    (q === `repo:${b.meta.slug}` || (F == null ? void 0 : F.slug) === b.meta.slug) && /* @__PURE__ */ o(
                      "button",
                      {
                        type: "button",
                        "aria-label": `More for ${b.meta.slug}`,
                        "aria-haspopup": "menu",
                        title: "More",
                        onClick: (M) => {
                          M.stopPropagation();
                          const re = M.currentTarget.getBoundingClientRect();
                          se({ slug: b.meta.slug, x: re.left, y: re.bottom + 2, confirm: !1 });
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
                        children: /* @__PURE__ */ o(jt, { size: 13 })
                      }
                    )
                  ]
                }
              ),
              W && !b.rows.length && /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.tiny, padding: "2px 6px 4px 24px" }, children: "No maps or efforts yet." }),
              W && b.rows.length > 0 && /* @__PURE__ */ o("div", { style: { marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }, children: b.rows.map((M) => {
                const re = `${M.repo}#${M.number}`, J = re === f, ce = J && !!g && ne;
                return /* @__PURE__ */ d(
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
                    onContextMenu: (Q) => {
                      Q.preventDefault(), I({ key: re, item: M, x: Q.clientX, y: Q.clientY, confirm: !1 });
                    },
                    onPointerEnter: () => D(re),
                    onPointerLeave: () => D((Q) => Q === re ? null : Q),
                    children: [
                      /* @__PURE__ */ d(
                        "button",
                        {
                          type: "button",
                          onClick: () => {
                            J ? ie((Q) => !Q) : a(M);
                          },
                          "aria-current": J ? "page" : void 0,
                          "aria-expanded": J && g ? ne : void 0,
                          title: J ? ne ? "Fold this effort's stations away" : "Show this effort's stations" : void 0,
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
                            /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                              /* @__PURE__ */ o(kt, { size: 11, "aria-hidden": !0, style: {
                                flexShrink: 0,
                                color: "var(--muted)",
                                transition: "transform .12s",
                                transform: ce ? "rotate(90deg)" : void 0
                              } }),
                              /* @__PURE__ */ d("span", { style: { ...J ? Ie : {}, flex: 1, minWidth: 0, fontSize: v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                                /* @__PURE__ */ d("span", { style: { ...G, fontWeight: 600, fontVariantNumeric: "tabular-nums" }, children: [
                                  "#",
                                  M.number
                                ] }),
                                " ",
                                M.title
                              ] }),
                              J && !ce && (h ?? 0) > 0 && /* @__PURE__ */ o(Zt, {})
                            ] }),
                            (() => {
                              var $e;
                              if (ce)
                                return /* @__PURE__ */ d("div", { style: { ...G, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(St, { kind: M.kind, map: M.mapIssue }),
                                  /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: M.repo.split("/").pop() }),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Gt(M.updatedAt) })
                                ] });
                              const Q = ($e = M.frontier) != null && $e.stations ? ho(M.frontier.stations) : null;
                              return /* @__PURE__ */ d(we, { children: [
                                Q && /* @__PURE__ */ o("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ o(fo, { glance: Q }) }),
                                /* @__PURE__ */ d("div", { style: { ...G, fontSize: v.tiny, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }, children: [
                                  /* @__PURE__ */ o(St, { kind: M.kind, map: M.mapIssue }),
                                  !Q && /* @__PURE__ */ o(So, { stage: M.stage ?? Vn(M.column) }),
                                  /* @__PURE__ */ o(
                                    "span",
                                    {
                                      title: Q ? `${Q.bits || Q.front}

${ht.HITL}
${ht.Agent}` : void 0,
                                      style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                                      children: Q ? Q.bits || Q.front : M.repo.split("/").pop()
                                    }
                                  ),
                                  /* @__PURE__ */ o("span", { style: { flexShrink: 0 }, children: Gt(M.updatedAt) })
                                ] })
                              ] });
                            })()
                          ]
                        }
                      ),
                      (q === re || J || (S == null ? void 0 : S.key) === re) && /* @__PURE__ */ o(
                        "button",
                        {
                          type: "button",
                          "aria-label": `More for ${M.title}`,
                          "aria-haspopup": "menu",
                          title: "More",
                          onClick: (Q) => {
                            Q.stopPropagation();
                            const $e = Q.currentTarget.getBoundingClientRect();
                            I({ key: re, item: M, x: $e.left, y: $e.bottom + 2, confirm: !1 });
                          },
                          onMouseEnter: (Q) => {
                            Q.currentTarget.style.background = "rgba(255,255,255,0.1)";
                          },
                          onMouseLeave: (Q) => {
                            Q.currentTarget.style.background = "transparent";
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
                          children: /* @__PURE__ */ o(jt, { size: 14 })
                        }
                      ),
                      ce && /* @__PURE__ */ o("div", { ref: g, style: { borderTop: "1px solid var(--border)" } })
                    ]
                  },
                  re
                );
              }) }),
              W && b.meta.hidden.length > 0 && /* @__PURE__ */ d(
                "button",
                {
                  type: "button",
                  onClick: () => n(b.meta.slug, b.meta.hidden),
                  title: `Removed from the sidebar: #${b.meta.hidden.join(", #")}. Click to restore them.`,
                  style: {
                    ...G,
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
        S && !S.confirm && /* @__PURE__ */ o(Jt, { x: S.x, y: S.y, onClose: H, items: [
          { label: "Open on GitHub", icon: qt, onSelect: () => window.open(S.item.url, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove from sidebar…", icon: Kn, danger: !0, onSelect: () => I({ ...S, confirm: "hide" }) },
          ...S.item.kind === "map" ? [] : [
            { label: "Close effort as not planned…", icon: Kt, danger: !0, onSelect: () => I({ ...S, confirm: "remove" }) }
          ]
        ] }),
        (S == null ? void 0 : S.confirm) === "hide" && /* @__PURE__ */ o(
          mt,
          {
            x: S.x,
            y: S.y,
            onClose: H,
            action: "Remove",
            title: `Remove "${S.item.title}" from the sidebar?`,
            onConfirm: () => R(S.item),
            children: S.item.kind === "map" ? `The map stays open on GitHub. Its repo's "removed · restore" line brings it back.` : `Its issue stays open on GitHub. Its repo's "removed · restore" line brings it back.`
          }
        ),
        (S == null ? void 0 : S.confirm) === "remove" && /* @__PURE__ */ o(
          mt,
          {
            x: S.x,
            y: S.y,
            onClose: H,
            action: "Close it",
            title: `Close "${S.item.title}" as not planned?`,
            onConfirm: () => j(S.item),
            children: "Its issue closes on GitHub as not planned and it leaves the sidebar."
          }
        ),
        F && !F.confirm && /* @__PURE__ */ o(Jt, { x: F.x, y: F.y, onClose: () => se(null), items: [
          { label: "Open on GitHub", icon: qt, onSelect: () => window.open(`https://github.com/${F.slug}`, "_blank", "noreferrer") },
          { separator: !0 },
          { label: "Remove repo…", icon: Kt, danger: !0, onSelect: () => se({ ...F, confirm: !0 }) }
        ] }),
        (F == null ? void 0 : F.confirm) && /* @__PURE__ */ o(
          mt,
          {
            x: F.x,
            y: F.y,
            onClose: () => se(null),
            action: "Remove",
            title: `Remove ${F.slug} from KiPo?`,
            onConfirm: () => u(F.slug),
            children: "Its efforts and maps leave the sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back."
          }
        )
      ]
    }
  );
}
function Io({ items: e, selected: t, attention: i, onNew: r, onSelect: l, onExpand: f }) {
  const h = (c) => {
    var u;
    const s = (u = c.frontier) == null ? void 0 : u.counts;
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
      const s = `${c.repo}#${c.number}`, u = s === t;
      return /* @__PURE__ */ o(
        "button",
        {
          type: "button",
          onClick: () => l(c),
          title: `${c.title} (${c.repo.split("/").pop()})`,
          "aria-current": u ? "page" : void 0,
          style: { ...g, background: u ? "var(--bg-elevated)" : "transparent", border: u ? "1px solid var(--border)" : "1px solid transparent", flexShrink: 0 },
          children: /* @__PURE__ */ o(
            "span",
            {
              className: u && (i ?? 0) > 0 ? "kipo-pulse" : void 0,
              style: { width: 10, height: 10, borderRadius: 3, background: u && (i ?? 0) > 0 ? "#f5b14c" : h(c) }
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
], at = (e) => /* @__PURE__ */ o("span", { style: { ...Ie, fontSize: v.body, display: "block", marginBottom: 6 }, children: e }), Ro = (e) => {
  const t = e.trim().match(/(?:issues\/|#)?(\d+)\s*$/);
  return t ? Number(t[1]) : null;
};
function Co({ onStarted: e, onCancel: t }) {
  const [i, r] = E(""), [l, f] = E(null), [h, g] = E(""), [c, s] = E(!1), [u, n] = E(!1), [a, R] = E("idea"), [j, T] = E(""), [_, N] = E(!1), [q, D] = E("");
  U(() => {
    ge.discoverRepos().then((I) => f(
      I.repos.filter((H) => H.slug && !H.worktree).sort((H, F) => Number(F.configured) - Number(H.configured) || H.name.localeCompare(F.name))
    )).catch((I) => {
      D(Se(I)), f([]);
    });
  }, []);
  const ne = (I) => {
    s(!1), g(I), l && !l.some((H) => H.path === I) && f([...l, { path: I, name: I.split("/").pop() || I, slug: null, remote: null, worktree: !1, configured: !1 }]);
  }, ie = async () => {
    const I = a === "issue" && j.trim() ? Ro(j) : null;
    if (a === "issue" && j.trim() && I == null) {
      D("Give the issue as a number or its link.");
      return;
    }
    if (!i.trim() && !I) {
      D("Say what you want to do first.");
      return;
    }
    if (!h) {
      D("Choose which project this is for.");
      return;
    }
    N(!0), D("");
    try {
      e(await ge.startInitiative({
        path: h,
        description: i.trim() || `Issue #${I}`,
        start: a,
        worktree: u,
        sourceIssue: I
      }));
    } catch (H) {
      D(Se(H)), N(!1);
    }
  }, S = en.find((I) => I.id === a);
  return /* @__PURE__ */ d("div", { style: { maxWidth: 460, margin: "0 auto 24px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ d("div", { children: [
      /* @__PURE__ */ o("div", { style: { ...Ie, fontSize: 18 }, children: "Start an effort" }),
      /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.body, marginTop: 4 }, children: "Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time." })
    ] }),
    /* @__PURE__ */ o(Ge, { children: q }),
    /* @__PURE__ */ d("label", { children: [
      at("What do you want to do?"),
      /* @__PURE__ */ o(
        "textarea",
        {
          value: i,
          onChange: (I) => r(I.target.value),
          rows: 3,
          autoFocus: !0,
          placeholder: "e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share",
          style: { ...ct, resize: "vertical", lineHeight: 1.45 }
        }
      )
    ] }),
    /* @__PURE__ */ d("div", { children: [
      at("Which project is this for?"),
      /* @__PURE__ */ d(
        "select",
        {
          value: h,
          onChange: (I) => I.target.value === "__pick" ? s(!0) : g(I.target.value),
          style: ct,
          disabled: l === null,
          children: [
            /* @__PURE__ */ o("option", { value: "", children: l === null ? "Looking for your projects…" : "Choose a project…" }),
            l == null ? void 0 : l.map((I) => /* @__PURE__ */ o("option", { value: I.path, children: I.slug ?? I.name }, I.path)),
            /* @__PURE__ */ o("option", { value: "__pick", children: "Another folder…" })
          ]
        }
      ),
      h && /* @__PURE__ */ d("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ o("div", { children: /* @__PURE__ */ o(un, { path: h }) }),
        /* @__PURE__ */ d("label", { style: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: v.body }, children: [
          /* @__PURE__ */ o("input", { type: "checkbox", checked: u, onChange: (I) => n(I.target.checked), style: { marginTop: 3 } }),
          /* @__PURE__ */ d("span", { children: [
            "Work in a fresh worktree",
            /* @__PURE__ */ o("span", { style: G, children: " so your main checkout stays untouched" })
          ] })
        ] })
      ] }),
      c && /* @__PURE__ */ o("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ o(pn, { busy: null, onAdd: ne, actionLabel: "Use" }) })
    ] }),
    /* @__PURE__ */ d("fieldset", { style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ o("legend", { style: { padding: 0 }, children: at("Where does this start?") }),
      /* @__PURE__ */ o("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }, children: en.map((I) => {
        const H = a === I.id;
        return /* @__PURE__ */ d(
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
                  onChange: () => R(I.id),
                  style: { position: "absolute", opacity: 0, pointerEvents: "none" }
                }
              ),
              /* @__PURE__ */ o("div", { style: { ...Ie, fontSize: v.body }, children: I.title }),
              /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small, marginTop: 3, lineHeight: 1.4 }, children: I.hint })
            ]
          },
          I.id
        );
      }) }),
      /* @__PURE__ */ d("div", { style: { ...G, fontSize: v.small, marginTop: 8 }, children: [
        "Starts with ",
        S.begins
      ] })
    ] }),
    a === "issue" && /* @__PURE__ */ d("label", { children: [
      at("Which issue? (optional)"),
      /* @__PURE__ */ o(
        "input",
        {
          value: j,
          onChange: (I) => T(I.target.value),
          placeholder: "#42 or its link, if it's already filed",
          style: ct
        }
      )
    ] }),
    /* @__PURE__ */ d("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ o(Ce, { primary: !0, disabled: _, onClick: ie, children: _ ? "Starting…" : "Start the conversation" }),
      t && /* @__PURE__ */ o(Ce, { onClick: t, children: "Never mind" })
    ] }),
    /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small, lineHeight: 1.5 }, children: "Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo." })
  ] });
}
const tn = 6, _e = (e, t) => (e.blockers ?? e.blockedBy).filter((i) => t.has(i) && i !== e.number);
function To(e, t) {
  const i = new Map(e.map((a) => [a.number, a])), r = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), f = (a) => {
    if (r.has(a.number)) return r.get(a.number);
    if (l.has(a.number)) return 0;
    l.add(a.number);
    const R = _e(a, i), j = R.length ? 1 + Math.max(...R.map((T) => f(i.get(T)))) : 0;
    return l.delete(a.number), r.set(a.number, j), j;
  };
  e.forEach(f);
  const h = e.length ? Math.max(...e.map((a) => r.get(a.number))) + 1 : 0, g = t ? [e.filter((a) => a.lane === "decide"), e.filter((a) => a.lane !== "decide")] : [e], c = /* @__PURE__ */ new Map(), s = [];
  let u = 0, n = null;
  return g.forEach((a, R) => {
    if (!a.length) return;
    t && R === 1 && u > 0 && (n = u, u += 0.6);
    let j = 0;
    const T = [];
    for (let _ = 0; _ < h; _++) {
      const N = a.filter((D) => r.get(D.number) === _), q = (D) => {
        const ne = _e(D, i).map((ie) => c.get(ie)).filter((ie) => ie !== void 0);
        return ne.length ? ne.reduce((ie, S) => ie + S, 0) / ne.length : D.number / 1e3;
      };
      N.sort((D, ne) => q(D) - q(ne) || D.number - ne.number), N.forEach((D, ne) => c.set(D.number, u + ne)), T.push(N), j = Math.max(j, N.length);
    }
    T.forEach((_, N) => {
      const q = (j - _.length) / 2;
      _.forEach((D, ne) => {
        const ie = u + ne + q;
        c.set(D.number, ie), s.push({ tile: D, col: N, row: ie });
      });
    }), u += j;
  }), { placed: s, cols: h, rows: u, split: n };
}
function zo({ tiles: e, focus: t, fog: i = 0, onOpen: r, statuses: l, labeled: f, bands: h, highlight: g, dimOthers: c = !0, down: s }) {
  const u = ve(null), [n, a] = E(0), [R, j] = E(null);
  if (U(() => {
    const y = u.current;
    if (!y) return;
    const Y = new ResizeObserver(() => a(y.clientWidth));
    return Y.observe(y), a(y.clientWidth), () => Y.disconnect();
  }, []), !e.length) return null;
  const T = new Map(e.map((y) => [y.number, y])), _ = /* @__PURE__ */ new Set();
  for (const y of e) for (const Y of _e(y, T))
    _.add(Y), _.add(y.number);
  const N = e.length > 1 ? e.filter((y) => !_.has(y.number)) : [], q = N.length ? e.filter((y) => _.has(y.number)) : e, { placed: D, cols: ne, rows: ie, split: S } = To(q, !!h), I = 30, H = !!s && !h, F = h ? 52 : 0, se = H ? 12 : h ? 64 : f ? 40 : 48, pe = i > 0 && !H ? Math.min(i, 4) : 0, ae = pe ? se + I : 0, P = H ? Math.max(1, ie) : ne, oe = n && P ? Math.floor((n - 2 - 2 * tn - F - ae - (P - 1) * se) / P) : 168, te = f ? Math.max(H ? 120 : 110, Math.min(h ? 240 : H ? 260 : 200, oe)) : I, b = I + 6, W = H ? 30 : f ? 10 : 8, L = q.length ? ne : 0, M = H ? (q.length ? P * (te + se) - se : 0) + 2 : F + (L ? L * (te + se) - se : 0) + ae + 2, re = S ?? ie, J = H ? L : Math.max(ie, pe), ce = (y) => 1 + y * (b + W), Q = q.length || pe ? ce(J) - W + 1 : 0, $e = new Map(D.map((y) => [y.tile.number, H ? { x: 1 + y.row * (te + se), y: ce(y.col) } : { x: F + 1 + y.col * (te + se), y: ce(y.row) }])), ze = /* @__PURE__ */ new Set();
  if (t != null) {
    ze.add(t);
    const y = T.get(t);
    y && _e(y, T).forEach((Y) => ze.add(Y)), e.forEach((Y) => {
      _e(Y, T).includes(t) && ze.add(Y.number);
    });
  }
  const me = R != null && T.has(R) ? new Set(It(e, R).map((y) => y.number)) : null, De = (y) => me ? me.has(y) : (g ? g.has(y) : !0) && (t == null || !c || ze.has(y)), Be = (y) => y.state === "you" || y.state === "afk", We = (y) => Be(y) && y.number !== t ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${O[y.state].color}` : void 0, x = [];
  for (const y of q) for (const Y of _e(y, T)) x.push({ from: T.get(Y), to: y });
  const K = S != null ? ce(S) + 0.3 * (b + W) - W / 2 : null;
  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    /* @__PURE__ */ d("div", { ref: u, style: { overflowX: "auto", padding: tn, scrollbarWidth: "thin", minWidth: 0 }, children: [
      /* @__PURE__ */ d("div", { style: { position: "relative", width: M, height: Q, minWidth: M }, children: [
        /* @__PURE__ */ d("svg", { width: M, height: Q, style: { position: "absolute", inset: 0, overflow: "visible" }, "aria-hidden": !0, children: [
          /* @__PURE__ */ o("defs", { children: /* @__PURE__ */ o("marker", { id: "kipo-arrow", viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ o("path", { d: "M0,0 L8,4 L0,8 z", fill: "var(--muted)" }) }) }),
          K != null && /* @__PURE__ */ o("line", { x1: 0, x2: M, y1: K, y2: K, stroke: "var(--border)", strokeDasharray: "2 4" }),
          x.map(({ from: y, to: Y }) => {
            const he = $e.get(y.number), ye = $e.get(Y.number);
            if (!he || !ye) return null;
            const Me = y.state === "done", Ae = me ? me.has(y.number) && me.has(Y.number) : t != null && (y.number === t || Y.number === t), be = me ? !Ae : t != null && c && !Ae || !De(y.number) || !De(Y.number), He = H ? (() => {
              const Oe = he.x + I / 2, Te = he.y + b + 2, Pe = ye.x + I / 2, Ne = ye.y - 2, fe = (Te + Ne) / 2;
              return `M${Oe},${Te} C${Oe},${fe} ${Pe},${fe} ${Pe},${Ne}`;
            })() : (() => {
              const Oe = he.x + te + 2, Te = he.y + b / 2, Pe = ye.x - 2, Ne = ye.y + b / 2, fe = (Oe + Pe) / 2;
              return `M${Oe},${Te} C${fe},${Te} ${fe},${Ne} ${Pe},${Ne}`;
            })();
            return /* @__PURE__ */ o(
              "path",
              {
                d: He,
                fill: "none",
                stroke: Ae ? "var(--text)" : "var(--muted)",
                strokeWidth: Ae ? 1.6 : 1.2,
                strokeDasharray: Me ? "3 3" : void 0,
                opacity: be ? 0.15 : Me ? 0.45 : 0.8,
                markerEnd: "url(#kipo-arrow)"
              },
              `${y.number}-${Y.number}`
            );
          })
        ] }),
        h && D.length > 0 && ["decide", "deliver"].map((y) => {
          const Y = D.filter((ye) => y === "decide" ? ye.tile.lane === "decide" : ye.tile.lane !== "decide").map((ye) => ye.row);
          if (!Y.length) return null;
          const he = (Math.min(...Y) + Math.max(...Y)) / 2;
          return /* @__PURE__ */ o("span", { style: { position: "absolute", left: 0, top: ce(he) + b / 2 - 8, fontSize: v.tiny, fontWeight: 600, color: "var(--muted)" }, children: y === "decide" ? "Decide" : "Deliver" }, y);
        }),
        D.map(({ tile: y }) => {
          const Y = $e.get(y.number);
          return /* @__PURE__ */ d(
            "div",
            {
              onPointerEnter: () => j(y.number),
              onPointerLeave: () => j((he) => he === y.number ? null : he),
              style: {
                position: "absolute",
                left: Y.x,
                top: Y.y,
                width: te,
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: De(y.number) ? 1 : 0.28,
                transition: "opacity .15s"
              },
              children: [
                /* @__PURE__ */ o(
                  "span",
                  {
                    title: We(y) ? "On the frontier: open and unblocked" : void 0,
                    style: { borderRadius: 8, boxShadow: We(y), display: "inline-flex" },
                    children: /* @__PURE__ */ o(Ut, { tile: y, size: I, onClick: () => r(y), open: y.number === t, status: l == null ? void 0 : l[y.number] })
                  }
                ),
                f && /* @__PURE__ */ o(
                  "button",
                  {
                    type: "button",
                    onClick: () => r(y),
                    title: y.title,
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
                      fontWeight: y.number === t ? 600 : 400,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    },
                    children: y.title
                  }
                )
              ]
            },
            y.number
          );
        }),
        Array.from({ length: pe }).map((y, Y) => /* @__PURE__ */ o(
          "div",
          {
            title: `${i} question${i === 1 ? "" : "s"} not yet specified`,
            style: {
              position: "absolute",
              left: F + 1 + L * (te + se),
              top: ce(Math.max(0, (re - pe) / 2) + Y),
              width: I,
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
          `fog-${Y}`
        ))
      ] }),
      N.length > 0 && /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap", paddingLeft: F }, children: [
        /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, color: "var(--muted)", marginRight: 2 }, children: "Not linked to anything" }),
        N.map((y) => /* @__PURE__ */ o("span", { style: { opacity: De(y.number) ? 1 : 0.28, borderRadius: 8, display: "inline-flex", boxShadow: We(y) }, children: /* @__PURE__ */ o(Ut, { tile: y, size: I, onClick: () => r(y), open: y.number === t, status: l == null ? void 0 : l[y.number] }) }, y.number))
      ] }),
      /* @__PURE__ */ d("div", { style: { display: "flex", gap: 14, marginTop: 8, fontSize: v.tiny, color: "var(--muted)", flexWrap: "wrap", paddingLeft: F }, children: [
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
function It(e, t) {
  const i = new Map(e.map((g) => [g.number, g]));
  if (!i.has(t)) return [];
  const r = /* @__PURE__ */ new Set([t]), l = [t];
  for (; l.length; ) {
    const g = i.get(l.pop());
    for (const c of g ? _e(g, i) : []) r.has(c) || (r.add(c), l.push(c));
  }
  const f = /* @__PURE__ */ new Set([t]), h = [t];
  for (; h.length; ) {
    const g = h.pop();
    for (const c of e)
      !f.has(c.number) && _e(c, i).includes(g) && (f.add(c.number), r.add(c.number), h.push(c.number));
  }
  return e.filter((g) => r.has(g.number));
}
function Ao(e) {
  if (!e) return "";
  const t = Math.max(0, (Date.now() - new Date(e).getTime()) / 1e3);
  return t < 60 ? "just now" : t < 3600 ? `${Math.floor(t / 60)}m ago` : t < 86400 ? `${Math.floor(t / 3600)}h ago` : `${Math.floor(t / 86400)}d ago`;
}
function Oo({ slot: e, active: t, ended: i }) {
  const [r, l] = E(null), [f, h] = E(""), g = ve(null), c = ve(!0);
  return U(() => {
    let s = !0;
    const u = () => ge.sessionTail(e, 60).then((a) => {
      s && (l(a.events), h(""));
    }).catch((a) => {
      s && h(Se(a));
    });
    if (u(), !t || i) return () => {
      s = !1;
    };
    const n = setInterval(u, 4e3);
    return () => {
      s = !1, clearInterval(n);
    };
  }, [e, t, i]), U(() => {
    var s;
    c.current && ((s = g.current) == null || s.scrollIntoView({ block: "end" }));
  }, [r]), /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid var(--border)" }, children: [
      !i && /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: O.building.color, flexShrink: 0 } }),
      /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.tiny, lineHeight: 1.4 }, children: i ? /* @__PURE__ */ d(we, { children: [
        "This session has ended — a read-only record of what it did, from its transcript. Its slot ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
        " is closed in Kiro."
      ] }) : /* @__PURE__ */ d(we, { children: [
        "Running in the background — read-only progress from its transcript. To chat with it, open ",
        /* @__PURE__ */ o("code", { style: { fontSize: v.tiny }, children: e }),
        " in Kiro's session window."
      ] }) })
    ] }),
    /* @__PURE__ */ d(
      "div",
      {
        onScroll: (s) => {
          const u = s.currentTarget;
          c.current = u.scrollHeight - u.scrollTop - u.clientHeight < 40;
        },
        style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 16px", scrollbarWidth: "thin" },
        children: [
          /* @__PURE__ */ o(Ge, { children: f }),
          r === null && !f && /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small }, children: "Reading its transcript…" }),
          r !== null && r.length === 0 && !f && /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.small }, children: "No steps recorded yet." }),
          /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: (r ?? []).map((s, u) => /* @__PURE__ */ d("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            /* @__PURE__ */ d("span", { style: { ...G, fontSize: v.tiny, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ o("span", { style: { fontWeight: 700, color: s.role === "user" ? O.you.text : "var(--muted)" }, children: s.role === "user" ? "You" : "Agent" }),
              s.ts && /* @__PURE__ */ o("span", { children: Ao(s.ts) })
            ] }),
            s.tool ? /* @__PURE__ */ o("span", { style: { fontSize: v.small, fontFamily: "var(--font-mono, monospace)", color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: s.text }) : /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.5 }, children: /* @__PURE__ */ o(wt, { content: s.text }) })
          ] }, u)) }),
          /* @__PURE__ */ o("div", { ref: g })
        ]
      }
    )
  ] });
}
const nn = 2 * 60 * 60 * 1e3, ft = /* @__PURE__ */ new Map(), Eo = (e, t) => {
  const i = ft.get(`${e}:${t}`);
  return i && Date.now() - i >= nn && ft.delete(`${e}:${t}`), !!i && Date.now() - i < nn;
};
function Wo({ items: e, prompts: t = [], onOpenPrompt: i, onError: r, onSize: l, bottomOffset: f = 122 }) {
  const h = Ct(), g = (x) => `${x.slot}:${x.d.id}`;
  for (const x of e) x.d.answer && ft.delete(g(x));
  const c = e.filter((x) => pt(x.d) && !Eo(x.slot, x.d.id)), [s, u] = E({}), [n, a] = E({}), [R, j] = E(0), [T, _] = E(!1), [N, q] = E(!1), [D, ne] = E({}), ie = ve(null), S = t.filter((x) => !D[x.slot]), I = c.map(g).join(",") + "|" + S.map((x) => x.slot).join(","), H = ve(I);
  U(() => {
    H.current !== I && (H.current = I, j(0), u({}), a({}), I !== "|" && q(!1));
  }, [I]);
  const F = ve(null), se = Ee((x) => {
    var y;
    if ((y = F.current) == null || y.disconnect(), F.current = null, !x) {
      l == null || l(0);
      return;
    }
    const K = () => l == null ? void 0 : l(x.offsetHeight);
    K(), F.current = new ResizeObserver(K), F.current.observe(x);
  }, [l]);
  if (!c.length && !S.length) return null;
  const pe = c.length + S.length;
  if (N) return /* @__PURE__ */ d(
    "button",
    {
      type: "button",
      className: "kipo-pulse",
      onClick: () => q(!1),
      title: "Open what's waiting on you",
      style: {
        position: "absolute",
        right: 16,
        bottom: f + 4,
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
        pe,
        " waiting on you →"
      ]
    }
  );
  const ae = Math.min(R, Math.max(0, c.length - 1)), P = c.length ? c[ae] : null, oe = P ? g(P) : "", te = c.filter((x) => (s[g(x)] ?? "").trim()), b = ae === 0, W = ae === c.length - 1, M = !!P && (s[oe] ?? "") !== "" && !(P.d.options ?? []).includes(s[oe] ?? "") || !!n[oe], re = c.filter((x) => x.d.recommended), J = (x) => {
    oe && u((K) => ({ ...K, [oe]: x }));
  }, ce = () => {
    var x;
    T || !P || (a((K) => ({ ...K, [oe]: !0 })), u((K) => (P.d.options ?? []).includes(K[oe] ?? "") ? { ...K, [oe]: "" } : K), (x = ie.current) == null || x.focus());
  }, Q = async (x = s) => {
    const K = c.filter((Y) => (x[g(Y)] ?? "").trim());
    if (!K.length) return;
    const y = /* @__PURE__ */ new Map();
    for (const Y of K) {
      const he = y.get(Y.slot) ?? [];
      he.push(Y), y.set(Y.slot, he);
    }
    _(!0);
    try {
      for (const [Y, he] of y) {
        const ye = c.filter((be) => be.slot === Y && !(x[g(be)] ?? "").trim()), Me = he.map((be, He) => `${He + 1}. ${be.d.title} (${be.d.id}): ${x[g(be)].trim()}`), Ae = [
          `My answers to your ${he.length === 1 ? "question" : `${he.length} questions`}:`,
          "",
          ...Me,
          "",
          ye.length ? `Still open, I'll answer later: ${ye.map((be) => be.d.title).join("; ")}.` : "That's all of them. Record each answer, then carry on."
        ].join(`
`);
        await h.post("/api/chat?ws=1", { slot: Y, message: Ae });
        for (const be of he) ft.set(g(be), Date.now());
      }
      u({}), j(0);
    } catch (Y) {
      r(`Couldn't send your answers: ${Se(Y)}`);
    } finally {
      _(!1);
    }
  }, $e = () => {
    const x = { ...s };
    for (const K of re) x[g(K)] = K.d.recommended;
    u(x), Q(x);
  }, ze = async (x, K) => {
    try {
      await h.post(`/api/chat/slots/${encodeURIComponent(x.slot)}/approve`, { action: K, request_id: x.requestId }), ne((y) => ({ ...y, [x.slot]: !0 }));
    } catch (y) {
      r(`Couldn't ${K === "approved" ? "allow" : "deny"} ${x.from}: ${Se(y)}`);
    }
  }, me = (x) => /* @__PURE__ */ o("span", { "aria-hidden": !0, style: {
    width: 13,
    height: 13,
    borderRadius: 99,
    flexShrink: 0,
    marginTop: 2,
    border: `1.5px solid ${x ? "var(--accent)" : "var(--muted)"}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: x && /* @__PURE__ */ o("span", { style: { width: 7, height: 7, borderRadius: 99, background: "var(--accent)" } }) }), De = (x) => {
    const K = s[oe] === x && !n[oe];
    return /* @__PURE__ */ d(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": K,
        disabled: T,
        onClick: () => {
          a((y) => ({ ...y, [oe]: !1 })), J(x);
        },
        onMouseEnter: (y) => {
          K || (y.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))");
        },
        onMouseLeave: (y) => {
          K || (y.currentTarget.style.background = "transparent");
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
          border: `1px solid ${K ? "var(--accent)" : "var(--border)"}`,
          background: K ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
          color: "var(--text)"
        },
        children: [
          me(K),
          /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0 }, children: x }),
          !!P && x === P.d.recommended && /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.tiny, flexShrink: 0, marginTop: 1 }, children: "Recommended" })
        ]
      },
      x
    );
  }, Be = (x, K, y) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      title: K,
      onClick: y,
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
      children: x
    }
  ), We = (x, K, y) => /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      disabled: K,
      onClick: y,
      style: {
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "3px 10px",
        color: K ? "var(--muted)" : "var(--text)",
        cursor: K ? "default" : "pointer",
        fontSize: v.small,
        opacity: K ? 0.5 : 1
      },
      children: x
    }
  );
  return /* @__PURE__ */ d(
    "div",
    {
      ref: se,
      role: "dialog",
      "aria-label": `${pe} waiting on you`,
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
          /* @__PURE__ */ o("span", { style: { fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: O.you.text }, children: c.length === 0 ? S.length === 1 ? "Trust prompt" : "Trust prompts" : c.length === 1 ? "Question" : `Question ${ae + 1} of ${c.length}` }),
          c.length > 1 && // The dots show which of the batch are answered.
          /* @__PURE__ */ o("span", { style: { display: "flex", gap: 3 }, "aria-hidden": !0, children: c.map((x, K) => /* @__PURE__ */ o(
            "span",
            {
              title: `${x.from ? `${x.from} — ` : ""}${x.d.title ?? x.d.id}`,
              onClick: () => j(K),
              style: {
                width: 7,
                height: 7,
                borderRadius: 99,
                cursor: "pointer",
                background: (s[g(x)] ?? "").trim() ? O.you.color : K === ae ? "var(--text)" : "var(--border)"
              }
            },
            g(x)
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
        S.length > 0 && /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: c.length ? 10 : 2 }, children: S.map((x) => /* @__PURE__ */ d("div", { style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 9px",
          borderRadius: 8,
          border: `1px solid ${O.you.color}`,
          background: "color-mix(in srgb, #f5b14c 8%, transparent)"
        }, children: [
          /* @__PURE__ */ o("span", { className: "kipo-pulse", "aria-hidden": !0, style: { width: 7, height: 7, borderRadius: 99, background: O.you.color, flexShrink: 0 } }),
          /* @__PURE__ */ d(
            "span",
            {
              style: { flex: 1, minWidth: 0, fontSize: v.small },
              title: [x.tool, x.input, x.purpose].filter(Boolean).join(`

`),
              children: [
                /* @__PURE__ */ o("b", { children: x.from }),
                " ",
                /* @__PURE__ */ o("span", { style: G, children: "wants to run:" }),
                /* @__PURE__ */ o("span", { style: {
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "var(--muted)",
                  fontSize: v.tiny,
                  fontFamily: "ui-monospace, monospace"
                }, children: x.tool })
              ]
            }
          ),
          x.canDecide && /* @__PURE__ */ o(Ce, { primary: !0, onClick: () => void ze(x, "approved"), children: "Allow" }),
          x.canDecide && Be("Deny once", "Reject this one call; the session continues without it", () => void ze(x, "rejected_once")),
          i && Be("Open", "Open this session to see the prompt in full", () => i(x.key))
        ] }, x.slot)) }),
        P && /* @__PURE__ */ d(we, { children: [
          P.from && /* @__PURE__ */ d("div", { style: { ...G, fontSize: v.tiny, marginBottom: 3 }, children: [
            "from ",
            P.from
          ] }),
          /* @__PURE__ */ o("div", { style: { ...Ie, fontSize: v.body, marginBottom: 8, lineHeight: 1.4 }, children: P.d.title }),
          /* @__PURE__ */ d("div", { style: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }, children: [
            (P.d.options ?? []).map(De),
            /* @__PURE__ */ d(
              "div",
              {
                role: "radio",
                "aria-checked": M,
                onClick: ce,
                style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 10px", cursor: "text" },
                children: [
                  me(M),
                  /* @__PURE__ */ o(
                    "input",
                    {
                      ref: ie,
                      value: M ? s[oe] ?? "" : "",
                      onChange: (x) => J(x.target.value),
                      onFocus: ce,
                      disabled: T,
                      placeholder: "Something else…",
                      "aria-label": `Another answer to: ${P.d.title}`,
                      style: {
                        flex: 1,
                        minWidth: 0,
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: v.small,
                        border: `1px solid ${M ? "var(--accent)" : "var(--border)"}`,
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
            c.length > 1 && We("‹ Back", b, () => j(ae - 1)),
            !W && We("Next ›", !1, () => j(ae + 1)),
            /* @__PURE__ */ o("span", { style: { flex: 1 } }),
            c.length > 1 && /* @__PURE__ */ d("span", { style: { ...G, fontSize: v.tiny }, children: [
              te.length,
              " of ",
              c.length,
              " answered"
            ] }),
            re.length > 0 && /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                disabled: T,
                onClick: $e,
                title: c.length > 1 ? `Answer all ${re.length} with their recommendation and send` : "Take the recommendation and send",
                style: {
                  background: "transparent",
                  border: `1px solid ${O.you.color}`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  color: O.you.text,
                  cursor: T ? "default" : "pointer",
                  fontSize: v.small,
                  whiteSpace: "nowrap",
                  opacity: T ? 0.5 : 1
                },
                children: c.length > 1 ? "Accept all recommendations" : "Accept recommendation"
              }
            ),
            /* @__PURE__ */ o(Ce, { primary: !0, disabled: !te.length || T, onClick: () => void Q(), children: T ? "Sending…" : te.length > 1 ? `Submit ${te.length} answers` : "Submit" })
          ] })
        ] })
      ]
    }
  );
}
const Mo = {
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
  const [i, r] = E(null), [l, f] = E("");
  U(() => {
    let u = !0;
    return r(null), f(""), ge.ticket(e.repo, e.number, t.number).then((n) => {
      u && r(n);
    }).catch((n) => {
      u && f(Se(n));
    }), () => {
      u = !1;
    };
  }, [e.repo, e.number, t.number, t.state]);
  const h = e.prs.filter((u) => t.prs.includes(u.number)), g = t.state === "done", c = O[t.state];
  let s;
  return g ? s = h.some((u) => u.state === "MERGED") ? "Closed: its PR merged." : "Closed." : t.state === "review" ? s = "Its PR is open. The effort's Review merges it once it's clean." : t.state === "blocked" ? s = `Waiting on ${t.blockedBy.map((u) => `#${u}`).join(", ")}. It can start once those close.` : t.state === "building" ? s = "An agent is working on it." : t.who === "you" ? s = /* @__PURE__ */ d(we, { children: [
    /* @__PURE__ */ o(ao, { term: "HITL", children: "HITL" }),
    ": it needs you. Start it to open its conversation."
  ] }) : s = "An agent can take it on its own.", /* @__PURE__ */ d("div", { children: [
    /* @__PURE__ */ d("div", { style: { padding: "14px 16px" }, children: [
      /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ d("span", { style: { ...G, fontSize: v.small }, children: [
          "#",
          t.number,
          " · ",
          Mo[t.type]
        ] }),
        /* @__PURE__ */ o("span", { title: Je[t.state], style: { cursor: "help", display: "inline-flex" }, children: /* @__PURE__ */ o(on, { color: c.color === "transparent" ? "var(--border)" : c.color, text: c.text, children: c.label }) }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        /* @__PURE__ */ o("a", { href: t.url, target: "_blank", rel: "noreferrer", style: { color: "var(--accent)", fontSize: v.small }, children: "Open on GitHub" })
      ] }),
      /* @__PURE__ */ o("div", { style: { ...Ie, fontSize: v.title, marginTop: 4, lineHeight: 1.35 }, children: t.title }),
      /* @__PURE__ */ o("div", { style: { fontSize: v.small, marginTop: 5, lineHeight: 1.45 }, children: s })
    ] }),
    h.length > 0 && /* @__PURE__ */ o(gt, { title: h.length === 1 ? "Pull request" : "Pull requests", children: /* @__PURE__ */ o("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: h.map((u) => {
      var n, a, R;
      return /* @__PURE__ */ d(
        "a",
        {
          href: u.url,
          target: "_blank",
          rel: "noreferrer",
          style: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontSize: v.small, textDecoration: "none" },
          children: [
            /* @__PURE__ */ o(on, { color: ((n = yt[u.state]) == null ? void 0 : n.color) ?? "var(--border)", text: ((a = yt[u.state]) == null ? void 0 : a.color) ?? "var(--muted)", children: ((R = yt[u.state]) == null ? void 0 : R.label) ?? u.state }),
            /* @__PURE__ */ d("span", { style: { color: "var(--accent)" }, children: [
              "#",
              u.number
            ] }),
            /* @__PURE__ */ o("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: u.title })
          ]
        },
        u.number
      );
    }) }) }),
    g && /* @__PURE__ */ o(gt, { title: "How it ended", aside: i != null && i.lastComment ? `latest of ${i.comments} comment${i.comments === 1 ? "" : "s"}` : void 0, children: l ? /* @__PURE__ */ o(Ge, { children: l }) : i ? i.lastComment ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(wt, { content: i.lastComment.body }) }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.small }, children: "Closed with no comment." }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.small }, children: "Loading…" }) }),
    /* @__PURE__ */ o(gt, { title: g ? "What it asked" : "What it asks", defaultOpen: !g, children: l ? /* @__PURE__ */ o(Ge, { children: l }) : i ? i.body.trim() ? /* @__PURE__ */ o("div", { style: { fontSize: v.body, lineHeight: 1.55 }, children: /* @__PURE__ */ o(wt, { content: i.body }) }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.small }, children: "No description." }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.small }, children: "Loading…" }) })
  ] });
}
const No = (e) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ""}@${e.at}`;
function Do(e, t, i, r, l = {}) {
  const f = [], h = [], g = new Set(l.unstarted ?? []), c = (n, a) => {
    const R = a ? r[a] : void 0;
    if (R)
      return n.replace === R || a && g.has(a) ? R : null;
  }, s = (n, a) => a ? { ...n, replace: a } : n, u = (n) => (l.prs ?? []).some((a) => a.state === "OPEN" && ((a.tickets ?? []).includes(n) || (a.refs ?? []).includes(n)));
  for (const n of e) {
    const a = No(n);
    if (!(t(a) || f.includes(a))) {
      if (f.push(a), n.ticket != null) {
        const R = i.find((T) => T.number === n.ticket);
        if (!R) continue;
        const j = n.skill === "kipo-review";
        if ((R.state === "done" || R.state === "blocked") && !(j && u(R.number))) continue;
        if (j) {
          const T = c(n, `review-t${R.number}`);
          T !== null && h.push(s({ id: a, kind: "review", t: R.number }, T));
        } else {
          const T = c(n, R.sessionKey);
          T !== null && h.push(s({ id: a, kind: "tile", tile: R, skill: n.skill && !n.skill.startsWith("kipo-") ? n.skill : null }, T));
        }
      } else if (n.stage) {
        const R = c(n, n.stage);
        R !== null && h.push(s({ id: a, kind: "stage", column: n.stage, skill: n.skill && n.skill !== `kipo-${n.stage}` ? n.skill : null }, R));
      }
    }
  }
  return { fresh: f, starts: h };
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
const jo = (e) => e.filter((t) => t.status === "open" && t.key !== "conductor");
function qo(e, t, i) {
  return e.filter((r) => {
    var l;
    return ((l = r.stall) == null ? void 0 : l.state) === "stalled" && r.key !== "conductor" && r.slot !== t && !i(`${r.key}/${r.stall.id}`);
  });
}
const bt = (e) => e.kind === "ticket" ? `build-t${e.t}` : e.kind === "spec" ? "build-spec" : e.kind === "decision" ? `shape-t${e.t}` : e.kind === "review" ? `review-t${e.t}` : e.kind === "stage" ? e.column : "conductor";
function Ko({ repo: e, number: t, active: i, autoStart: r, spineHost: l, spineCompact: f, onRemoved: h, onChanged: g, onNeeds: c }) {
  var Nt, Dt;
  const s = Ct(), u = `effort:${e}#${t}`, [n, a] = E(() => it(u)), [R, j] = E(""), [T, _] = E(""), [N, q] = E(() => it(`${u}:focus`) ?? { kind: "column" });
  U(() => {
    rt(`${u}:focus`, N);
  }, [u, N]);
  const [D, ne] = E(!1), [ie, S] = E(!1), I = eo("chain", 100, 0.75), H = Ee(() => {
    ge.getInitiative(e, t).then((p) => {
      a(p), rt(u, p), j("");
    }).catch((p) => j(Se(p)));
  }, [e, t, u]);
  U(() => {
    if (H(), !i) return;
    const p = setInterval(H, 5e3);
    return () => clearInterval(p);
  }, [H, i]);
  const F = n == null ? void 0 : n.column;
  U(() => {
    _("");
  }, [F, N]);
  const se = ve(F);
  U(() => {
    if (F === void 0 || se.current === F) {
      se.current = F;
      return;
    }
    const p = se.current !== void 0;
    se.current = F, p && q({ kind: "column" });
  }, [F]);
  const pe = n ? bt(N) : null, ae = n && pe ? n.sessions[pe] ?? null : null, P = ae && !Le(ae) ? ae : null, oe = n && N.kind === "ticket" ? n.tickets.find((p) => p.number === N.t) ?? null : null, te = async (p = null, w, B = !0, C = !1) => {
    if (!n) return;
    const k = w ?? N;
    ne(!0), _("");
    try {
      const $ = k.kind === "ticket" ? { column: "build", ticket: k.t, skill: p ?? "implement" } : k.kind === "spec" ? { column: "build", mode: "implement-spec", skill: p ?? "implement-spec" } : k.kind === "decision" ? { column: "shape", ticket: k.t, skill: p } : k.kind === "review" ? { column: "review", ticket: k.t, skill: p } : k.kind === "stage" ? { column: k.column, skill: p } : { column: n.column, mode: "conductor" }, z = await ge.startSession(e, t, C ? { ...$, replace: !0 } : $), A = k.kind === "ticket" ? `${n.title}: #${k.t}` : k.kind === "spec" ? `${n.title}: implement-spec` : k.kind === "decision" ? `${n.title}: decision #${k.t}` : k.kind === "review" ? `${n.title}: review #${k.t}` : k.kind === "stage" ? `${n.title}: ${ut[k.column]}` : `${n.title}: conductor`;
      z.existing ? await s.post("/api/chat?ws=1", { slot: z.slotName, message: z.seed }) : await co(s, e, z.slotName, z.seed, A, z.agent), z.key && await ge.sessionStarted(e, t, z.key).catch(() => ge.sessionStarted(e, t, z.key)).catch(() => {
      }), w && B && q(w), B && (H(), g());
    } catch ($) {
      _(
        $ instanceof xt && $.code === "ticket_blocked" ? $.message : `Couldn't start the conversation: ${Se($)}`
      );
    } finally {
      ne(!1);
    }
  }, b = (p) => p.lane === "deliver" ? { kind: "ticket", t: p.number } : { kind: "decision", t: p.number }, W = (p) => p.lane === "deliver" ? "implement" : p.type === "research" ? "research" : p.type === "prototype" ? "prototype" : p.type === "issue" ? "triage" : null, [L, M] = E(null), re = (p) => {
    q(b(p));
  }, J = n != null && n.frontier && (N.kind === "ticket" || N.kind === "decision") ? n.frontier.tiles.find((p) => p.number === N.t) ?? null : null, [ce, Q] = E({}), [$e, ze] = E({}), [me, De] = E(null), [Be, We] = E({});
  U(() => {
    let p = !0;
    const w = () => (lt(), s.get("/api/chat/slots").then((C) => {
      !p || !Array.isArray(C) || (De(new Set(C.filter((k) => k.key).map((k) => k.key))), We(Object.fromEntries(C.filter((k) => k.key).map((k) => [k.key, k]))));
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
  const x = P && !(me !== null && !me.has(P)) ? P : null;
  U(() => {
    Yo(x);
  }, [x]);
  const K = vt(
    () => {
      var p;
      return (((p = n == null ? void 0 : n.frontier) == null ? void 0 : p.tiles) ?? []).filter((w) => w.sessionKey && (n == null ? void 0 : n.sessions[w.sessionKey]));
    },
    [n]
  );
  U(() => {
    if (!K.length) {
      Q({}), ze({});
      return;
    }
    let p = !0;
    const w = (k) => {
      const $ = (k == null ? void 0 : k.content) ?? (k == null ? void 0 : k.text), z = typeof $ == "string" ? $ : Array.isArray($) ? $.map((Z) => typeof Z == "string" ? Z : (Z == null ? void 0 : Z.text) ?? "").join(" ") : null, A = z == null ? void 0 : z.replace(/\s+/g, " ").trim();
      return A ? A.slice(0, 140) : null;
    }, B = async () => {
      let k = /* @__PURE__ */ new Map();
      try {
        const $ = await s.get("/api/chat/slots");
        p && Array.isArray($) && (k = new Map($.filter((z) => z.key).map((z) => [z.key, z])));
      } catch {
      }
      Promise.all(K.map(($) => {
        const z = n.sessions[$.sessionKey], A = k.get(z);
        return s.get(`/api/chat/slots/${encodeURIComponent(z)}?limit=1`).then((Z) => {
          var Lt;
          const qe = (Lt = Z == null ? void 0 : Z.messages) == null ? void 0 : Lt[Z.messages.length - 1], ue = (A == null ? void 0 : A.pending_approval) ?? (Z == null ? void 0 : Z.pending_approval), Ye = (A == null ? void 0 : A.needs_input) ?? (Z == null ? void 0 : Z.needs_input), Mn = (A == null ? void 0 : A.running) ?? (Z == null ? void 0 : Z.running), Pt = ue ? "approval" : Ye ? "input" : null, Hn = { at: (qe == null ? void 0 : qe.ts) ?? null, line: qe && qe.role !== "user" ? w(qe) : null, needs: Pt }, Nn = Pt ? "attention" : Mn ? "running" : $.state === "done" ? null : "waiting";
          return [$.number, Nn, Hn];
        }).catch(() => null);
      })).then(($) => {
        if (!p) return;
        const z = {}, A = {};
        for (const Z of $)
          Z && (Z[1] && (z[Z[0]] = Z[1]), A[Z[0]] = Z[2]);
        Q(z), ze(A);
      });
    };
    if (B(), !i) return () => {
      p = !1;
    };
    const C = setInterval(B, 5e3);
    return () => {
      p = !1, clearInterval(C);
    };
  }, [s, K, i, n]);
  const y = vt(() => {
    var $, z, A, Z, qe;
    if (!n) return [];
    const p = (ue) => ((ue == null ? void 0 : ue.decisions) ?? []).filter(pt).length, w = /* @__PURE__ */ new Set(), B = [], C = (ue) => {
      const Ye = bt(ue);
      w.has(Ye) || (w.add(Ye), B.push(ue));
    }, k = (ue) => {
      var Ye;
      return (Ye = ue.sessionKey) != null && Ye.startsWith("review-t") ? { kind: "review", t: ue.number } : ue.lane === "deliver" ? { kind: "ticket", t: ue.number } : { kind: "decision", t: ue.number };
    };
    p((($ = n.sessionStates) == null ? void 0 : $.conductor) ?? n.state) && C({ kind: "column" });
    for (const ue of ((z = n.frontier) == null ? void 0 : z.tiles) ?? [])
      ue.state === "done" || !ue.sessionKey || (p((A = n.sessionStates) == null ? void 0 : A[ue.sessionKey]) || ce[ue.number] === "attention" || ue.state === "you") && C(k(ue));
    for (const ue of ["plan", "review", "done", "intake", "shape", "grill"])
      n.sessions[ue] && p((Z = n.sessionStates) == null ? void 0 : Z[ue]) && C({ kind: "stage", column: ue });
    return n.sessions["build-spec"] && p((qe = n.sessionStates) == null ? void 0 : qe["build-spec"]) && C({ kind: "spec" }), B;
  }, [n, ce]), Y = y.length;
  U(() => {
    c == null || c(Y);
  }, [Y, c]), U(() => () => {
    c == null || c(0);
  }, [c]);
  const he = async (p) => {
    for (let w = 0; w < p.length; w++)
      M(`Starting ${w + 1} of ${p.length}…`), await te(W(p[w]), b(p[w]), !1);
    M(null), H(), g();
  }, ye = `kipo.autopilot:${e}#${t}`, [Me, Ae] = E(() => localStorage.getItem(ye) === "1"), be = (p) => {
    Ae(p), localStorage.setItem(ye, p ? "1" : "0");
  }, He = ve(/* @__PURE__ */ new Set());
  U(() => {
    if (!Me || !i || L || !(n != null && n.frontier)) return;
    const p = n.frontier.tiles.filter((w) => w.lane === "deliver" && w.state === "afk" && !w.sessionKey && !He.current.has(w.number));
    p.length && (p.forEach((w) => He.current.add(w.number)), he(p));
  }, [Me, i, L, n]);
  const Oe = `kipo.dispatched:${e}#${t}`, Te = ve(/* @__PURE__ */ new Set()), Pe = (p) => {
    Te.current.delete(p);
    try {
      const w = JSON.parse(localStorage.getItem(Oe) || "[]");
      localStorage.setItem(Oe, JSON.stringify(w.filter((B) => B !== p)));
    } catch {
    }
  };
  U(() => {
    var k, $;
    if (!i || D || L || !(n != null && n.frontier)) return;
    const p = (($ = (k = n.sessionStates) == null ? void 0 : k.conductor) == null ? void 0 : $.dispatch) ?? [];
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(Oe) || "[]");
    } catch {
      w = [];
    }
    const { fresh: B, starts: C } = Do(
      p,
      (z) => w.includes(z) || Te.current.has(z),
      n.frontier.tiles,
      n.sessions,
      { prs: [...n.prs, ...n.refPrs ?? []], unstarted: Xo(n) }
    );
    if (B.length) {
      for (const z of B)
        Te.current.add(z), w.push(z);
      try {
        localStorage.setItem(Oe, JSON.stringify(w.slice(-300)));
      } catch {
      }
      C.length && (async () => {
        for (const z of C) {
          if (z.replace && !an(n, z.replace) && !await Qt(s, z.replace)) {
            Pe(z.id);
            continue;
          }
          const A = !!z.replace;
          z.kind === "tile" ? await te(z.skill ?? W(z.tile), b(z.tile), !1, A) : z.kind === "review" ? await te(null, { kind: "review", t: z.t }, !1, A) : await te(z.skill, { kind: "stage", column: z.column }, !1, A);
        }
        H(), g();
      })();
    }
  }, [i, D, L, n]);
  const Ne = `kipo.restarted:${e}#${t}`;
  U(() => {
    if (!i || D || L || !(n != null && n.closing)) return;
    let p = [];
    try {
      p = JSON.parse(localStorage.getItem(Ne) || "[]");
    } catch {
      p = [];
    }
    const B = n.closing.filter(($) => $.started === !1 && $.key !== "conductor" && !p.includes($.slot)).map(($) => [$, ln($.key)]).find(([, $]) => $);
    if (!B) return;
    const [C, k] = B;
    try {
      localStorage.setItem(Ne, JSON.stringify([...p, C.slot].slice(-200)));
    } catch {
    }
    (async () => {
      var z;
      if (!an(n, C.slot) && !await Qt(s, C.slot)) return;
      const $ = (z = n.frontier) == null ? void 0 : z.tiles.find((A) => (k.kind === "ticket" || k.kind === "decision") && A.number === k.t);
      await te($ ? W($) : null, k, !1, !0), H(), g();
    })();
  }, [i, D, L, n]);
  const fe = n != null && n.sessions.conductor && !Le(n.sessions.conductor) ? n.sessions.conductor : null, Ze = ((n == null ? void 0 : n.closing) ?? []).filter((p) => {
    var w;
    return ((w = p.stall) == null ? void 0 : w.state) === "stuck";
  }).map((p) => p.key), je = n != null && n.frontier ? JSON.stringify({
    t: n.frontier.tiles.map((p) => [p.number, p.state]),
    p: n.prs.map((p) => [p.number, p.state]),
    ...Ze.length ? { s: Ze } : {}
  }) : "";
  U(() => {
    if (!je || !fe || !i) return;
    const p = `kipo.conductorSaw:${e}#${t}`, w = localStorage.getItem(p);
    if (w === je) return;
    if (w === null) {
      localStorage.setItem(p, je);
      return;
    }
    const B = [];
    try {
      const C = JSON.parse(w), k = JSON.parse(je), $ = new Map(C.t), z = new Map(C.p);
      for (const [A, Z] of k.t) $.get(A) !== Z && B.push(`#${A} ${$.get(A) ?? "new"} → ${Z}`);
      for (const [A, Z] of k.p) z.get(A) !== Z && B.push(`PR #${A} ${(z.get(A) ?? "new").toLowerCase()} → ${Z.toLowerCase()}`);
      for (const A of k.s ?? []) (C.s ?? []).includes(A) || B.push(`${A} stuck (woken twice, no answer)`);
    } catch {
    }
    (async () => {
      try {
        const C = await s.get(`/api/chat/slots/${encodeURIComponent(fe)}?limit=1`);
        if (C != null && C.running) return;
        await s.post("/api/chat?ws=1", {
          slot: fe,
          message: `[KiPo] Frontier changed${B.length ? `: ${B.slice(0, 12).join("; ")}` : ""}. Run the frontier and carry on.`
        }), localStorage.setItem(p, je);
      } catch {
      }
    })();
  }, [je, fe, i]), U(() => {
    const p = n == null ? void 0 : n.reports;
    if (!p || !fe || !i) return;
    const w = `kipo.reportsSent:${e}#${t}`, B = Number(localStorage.getItem(w) || "0"), C = p.reports.filter((k) => k.id > Math.max(B, p.read));
    C.length && (async () => {
      try {
        const k = await s.get(`/api/chat/slots/${encodeURIComponent(fe)}?limit=1`);
        if (k != null && k.running) return;
        const $ = (A) => {
          var Z;
          return `${A.event}: ${A.text}${(Z = A.items) != null && Z.length ? ` (${A.items.join("; ")})` : ""}`;
        }, z = C.length === 1 ? `[KiPo] Report from ${C[0].from}: ${$(C[0])}` : `[KiPo] Reports from the sessions:
${C.slice(-12).map((A) => `- ${A.from} ${$(A)}`).join(`
`)}`;
        await s.post("/api/chat?ws=1", { slot: fe, message: `${z}
Run the frontier and carry on.` }), localStorage.setItem(w, String(C[C.length - 1].id));
      } catch {
      }
    })();
  }, [n, fe, i]);
  const m = (p, w) => {
    if (n) {
      if (n.sessions[p]) {
        q({ kind: "stage", column: p });
        return;
      }
      te(w, { kind: "stage", column: p });
    }
  }, ee = () => m("plan", "to-spec"), X = () => m("review", null), V = () => m("done", "retro"), Ue = async () => {
    if (n) {
      S(!0), _("");
      try {
        n.column !== "done" && await ge.advance(e, t, !0, "done"), await ge.advance(e, t, !0, null), await Xt(s, Object.values(n.sessions), null), h();
      } catch (p) {
        _(`Couldn't close it: ${Se(p)}`), S(!1);
      }
    }
  }, ke = ve(!1);
  U(() => {
    if (!(n != null && n.closing) || !i || ke.current) return;
    const p = n.closing.filter((w) => w.status === "closable");
    p.length && (ke.current = !0, Xt(s, p.map((w) => w.slot), P).then((w) => {
      const B = p.filter((C) => w.includes(C.slot)).map((C) => C.key);
      return B.length ? ge.sessionsClosed(e, t, B).then(() => H()) : void 0;
    }).catch(() => {
    }).finally(() => {
      ke.current = !1;
    }));
  }, [s, n, i, P]);
  const Ke = JSON.stringify(jo((n == null ? void 0 : n.closing) ?? []).filter((p) => !Le(p.slot)).map((p) => [p.key, p.slot]));
  U(() => {
    const p = JSON.parse(Ke);
    if (!i || !p.length) return;
    let w = !0;
    const B = () => {
      Promise.all(p.map(
        ([k, $]) => s.get(`/api/chat/slots/${encodeURIComponent($)}?limit=1`).then((z) => [k, Bo(z)]).catch(() => null)
      )).then((k) => {
        if (!w) return;
        const $ = Object.fromEntries(k.filter((z) => z && z[1]).map((z) => [z[0], z[1]]));
        Object.keys($).length && ge.sessionsActivity(e, t, $).catch(() => {
        });
      });
    };
    B();
    const C = setInterval(B, 3e4);
    return () => {
      w = !1, clearInterval(C);
    };
  }, [s, Ke, i, e, t]);
  const et = `kipo.woke:${e}#${t}`, de = `kipo.wokeNotes:${e}#${t}`, xe = ve(!1);
  U(() => {
    if (!(n != null && n.closing) || !i || xe.current) return;
    let p = [];
    try {
      p = JSON.parse(localStorage.getItem(et) || "[]");
    } catch {
      p = [];
    }
    let w = [];
    try {
      w = JSON.parse(localStorage.getItem(de) || "[]");
    } catch {
      w = [];
    }
    const B = qo(n.closing, P, (C) => p.includes(C)).filter((C) => !Le(C.slot));
    !B.length && !(w.length && fe) || (xe.current = !0, (async () => {
      for (const C of B) {
        const k = C.stall;
        try {
          const $ = await s.get(`/api/chat/slots/${encodeURIComponent(C.slot)}?limit=1`);
          if ($ != null && $.running) continue;
          await s.post("/api/chat?ws=1", { slot: C.slot, message: Po(k.why) }), p = [...p, `${C.key}/${k.id}`].slice(-300), localStorage.setItem(et, JSON.stringify(p)), w = [...w, Lo(C.key, k.why)], localStorage.setItem(de, JSON.stringify(w)), await ge.sessionsWoken(e, t, C.key, k.id ?? "", k.why);
        } catch {
        }
      }
      if (w.length && fe)
        try {
          const C = await s.get(`/api/chat/slots/${encodeURIComponent(fe)}?limit=1`);
          C != null && C.running || (await s.post("/api/chat?ws=1", { slot: fe, message: `${w.slice(-12).join(`
`)}
Run the frontier and carry on.` }), localStorage.setItem(de, "[]"));
        } catch {
        }
      B.length && H();
    })().finally(() => {
      xe.current = !1;
    }));
  }, [s, n, i, P, fe]);
  const Qe = ve(!1);
  if (U(() => {
    !r || Qe.current || !n || (Qe.current = !0, n.sessions[n.column] || te());
  }, [r, n]), !n)
    return /* @__PURE__ */ o("div", { style: { flex: 1, padding: 24 }, children: R ? /* @__PURE__ */ o(Ge, { children: R }) : /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.body }, children: "Loading…" }) });
  const Fe = pe ? ((Nt = n.sessionStates) == null ? void 0 : Nt[pe]) ?? null : n.state, Ot = (Fe == null ? void 0 : Fe.skillsUsed) ?? [], Sn = () => {
    if (N.kind !== "column") {
      q({ kind: "column" });
      return;
    }
    if (!y.length) return;
    const p = y.findIndex((w) => bt(w) === pe);
    q(y[(p + 1) % y.length]);
  }, Et = ve(null), $n = () => {
    var p, w;
    try {
      (w = (p = Et.current) == null ? void 0 : p.contentWindow) == null || w.dispatchEvent(new Event("toggle-activity-panel"));
    } catch {
    }
  }, [tt, In] = E(!1), [Wt, Rn] = E(0), Cn = Ee((p) => Rn((w) => Math.abs(w - p) > 4 ? p : w), []), [Mt, Tn] = E(128), zn = Ee((p) => Tn((w) => Math.abs(w - p) > 4 ? p : w), []), An = J ? J.state === "done" : !!ae && Le(ae), Xe = N.kind === "column" ? Fe ?? n.state : Fe, Ht = (p) => {
    var B, C;
    const w = p.match(/^(build|shape|review)-t(\d+)$/);
    if (w) {
      const k = (C = (B = n.frontier) == null ? void 0 : B.tiles) == null ? void 0 : C.find((z) => z.number === Number(w[2]));
      return `${w[1] === "review" ? "Review" : w[1] === "build" ? "Build" : "Shape"} #${w[2]}${k != null && k.title ? ` · ${k.title}` : ""}`;
    }
    return p === "build-spec" ? "Build: the spec" : p === "conductor" ? "Conductor" : ut[p] ?? p;
  }, On = new Set((((Dt = n.frontier) == null ? void 0 : Dt.tiles) ?? []).filter((p) => p.state === "done" && p.sessionKey).map((p) => p.sessionKey)), En = (() => {
    var B, C;
    if (N.kind !== "column")
      return An || !P ? [] : ((Xe == null ? void 0 : Xe.decisions) ?? []).map((k) => ({ slot: P, d: k }));
    const p = [], w = n.sessions.conductor;
    if (w && !Le(w)) for (const k of (Xe == null ? void 0 : Xe.decisions) ?? []) p.push({ slot: w, d: k });
    for (const k of Object.keys(n.sessions)) {
      if (k === "conductor" || On.has(k)) continue;
      const $ = n.sessions[k];
      if (!(!$ || Le($)))
        for (const z of ((C = (B = n.sessionStates) == null ? void 0 : B[k]) == null ? void 0 : C.decisions) ?? []) p.push({ slot: $, from: Ht(k), d: z });
    }
    return p;
  })(), Wn = (() => {
    if (N.kind !== "column") return [];
    const p = /* @__PURE__ */ new Set(), w = [];
    for (const B of Object.keys(n.sessions)) {
      const C = n.sessions[B];
      if (!C || C === x || Le(C) || p.has(C)) continue;
      const k = Be[C];
      if (!(k != null && k.pending_approval)) continue;
      p.add(C);
      const $ = k.pending_approval_info;
      w.push({
        key: B,
        slot: C,
        from: Ht(B),
        tool: ($ == null ? void 0 : $.tool) || "a tool call",
        input: $ == null ? void 0 : $.tool_input,
        purpose: $ == null ? void 0 : $.tool_purpose,
        requestId: $ == null ? void 0 : $.request_id,
        // Only a native prompt with a request id is decidable through the slot
        // approve route; anything else opens the session instead.
        canDecide: ($ == null ? void 0 : $.origin) === "native" && !!($ != null && $.request_id)
      });
    }
    return w;
  })();
  return /* @__PURE__ */ d("div", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ o("style", { children: "@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}" }),
    /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--border)", minWidth: 0 }, children: [
      /* @__PURE__ */ d("span", { style: { ...Ie, fontSize: v.small, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, title: n.title, children: [
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
      /* @__PURE__ */ o("span", { style: { ...G, fontSize: v.tiny, whiteSpace: "nowrap" }, title: n.repoPath, children: n.repo })
    ] }),
    T && /* @__PURE__ */ o("div", { style: { padding: "6px 12px 0" }, children: /* @__PURE__ */ o(Ge, { children: T }) }),
    (() => {
      var z;
      const p = /* @__PURE__ */ d("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 16px", borderBottom: "1px solid var(--border)", minWidth: 0, minHeight: 30 }, children: [
        /* @__PURE__ */ o("span", { style: { ...P ? G : Ie, fontSize: P ? v.small : v.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: J ? `#${J.number}${P ? "" : ` ${J.title}`}` : N.kind === "column" ? "Conductor" : n.title }),
        P && Ot.length > 0 && /* @__PURE__ */ o(Qo, { skills: Ot }),
        /* @__PURE__ */ o("span", { style: { flex: 1 } }),
        J && (n.frontier ? It(n.frontier.tiles, J.number).length > 1 : !1) && /* @__PURE__ */ d(
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
              /* @__PURE__ */ o(_n, { size: 14 }),
              " Map"
            ]
          }
        ),
        P && /* @__PURE__ */ o(
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
      ] }), w = J && (J.state === "you" || J.state === "afk"), B = !!P && me !== null && !me.has(P), C = P && B ? /* @__PURE__ */ o(Oo, { slot: P, active: i, ended: !0 }) : P ? (
        // The card sits `composerH` up, so the transcript must clear the
        // composer, the card, and a gap above it.
        /* @__PURE__ */ o(
          Jo,
          {
            slotKey: P,
            frameRef: Et,
            padBottom: Wt ? Mt + Wt + 24 : 0,
            onComposerH: zn
          },
          P
        )
      ) : J ? (
        // No live conversation: the ticket's own details fill the centre
        // (where the chat would be), since there's no chat and no panel.
        /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin" }, children: [
          w && /* @__PURE__ */ d("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ o(Ce, { primary: !0, disabled: D, onClick: () => te(W(J)), children: D ? "Starting…" : ((z = xn[J.type]) == null ? void 0 : z.action) ?? "Start this ticket" }),
            sn(J, null).map((A) => /* @__PURE__ */ d(
              "button",
              {
                type: "button",
                disabled: D,
                onClick: () => te(A.skill),
                title: Tt[A.skill],
                style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: D ? "default" : "pointer", fontSize: v.small },
                children: [
                  "/",
                  A.skill,
                  " ",
                  /* @__PURE__ */ o("span", { style: G, children: A.label })
                ]
              },
              A.skill
            ))
          ] }),
          /* @__PURE__ */ o(Ho, { detail: n, tile: J })
        ] })
      ) : /* @__PURE__ */ o(
        Uo,
        {
          detail: n,
          focus: N,
          ticket: oe,
          tile: null,
          starting: D,
          onStart: () => te(null),
          alternatives: sn(null, N.kind === "column" ? n.column : null),
          onSkill: (A) => te(A)
        }
      ), k = J && n.frontier ? It(n.frontier.tiles, J.number) : [], $ = l ? Fn(
        /* @__PURE__ */ o(
          bo,
          {
            detail: n,
            statuses: ce,
            activity: $e,
            busy: ie || D || !!L,
            autopilot: Me,
            selectedKey: pe,
            embedded: !0,
            compact: f,
            onAutopilot: be,
            onOpenTile: re,
            onOpenConversation: (A) => q(A === "build-spec" ? { kind: "spec" } : /^review-t\d+$/.test(A) ? { kind: "review", t: Number(A.slice(8)) } : { kind: "stage", column: A }),
            onSelectConductor: () => q({ kind: "column" }),
            onJumpQuestions: Sn,
            onHandover: ee,
            onReview: X,
            onRetro: V,
            onClose: Ue
          }
        ),
        l
      ) : null;
      return /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, display: "flex" }, children: [
        $,
        /* @__PURE__ */ d("section", { style: { flex: "1 1 0", minWidth: 360, minHeight: 0, display: "flex", flexDirection: "column" }, children: [
          p,
          J && k.length > 1 && tt && /* @__PURE__ */ d(we, { children: [
            /* @__PURE__ */ d("div", { ref: I.ref, style: { ...I.style }, children: [
              /* @__PURE__ */ o("div", { style: { padding: "6px 16px 0", fontSize: v.tiny, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }, children: "Where it sits" }),
              /* @__PURE__ */ o(zo, { tiles: k, focus: J.number, onOpen: re, labeled: !0, dimOthers: !1, statuses: ce, down: !0 })
            ] }),
            /* @__PURE__ */ o(
              gn,
              {
                direction: "horizontal",
                label: "Resize the ticket's map and its conversation",
                onDrag: I.onDrag,
                onReset: I.reset
              }
            )
          ] }),
          /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }, children: [
            C,
            /* @__PURE__ */ o(
              Wo,
              {
                items: En,
                prompts: Wn,
                onOpenPrompt: (A) => q(ln(A) ?? { kind: "column" }),
                onError: _,
                onSize: Cn,
                bottomOffset: Mt + 10
              },
              pe ?? "none"
            )
          ] })
        ] })
      ] });
    })()
  ] });
}
function rn(e) {
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
function _o(e) {
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
  const l = `/popout/chat?sid=${encodeURIComponent(e)}`, f = ve(null), h = ve(i);
  h.current = i;
  const g = Ee(() => {
    var s;
    try {
      const u = (s = t.current) == null ? void 0 : s.contentDocument;
      if (!u) return;
      let n = u.getElementById("kipo-qcard-css");
      !n && u.head && (n = u.createElement("style"), n.id = "kipo-qcard-css", u.head.appendChild(n));
      const a = h.current ? ".followup-chip{display:none !important}" : "";
      if (n && n.textContent !== a && (n.textContent = a), r) {
        const T = u.querySelector('[data-testid="composer-dock-root"]') ?? u.querySelector('[data-testid="composer-dock"]'), _ = T ? Math.round(T.getBoundingClientRect().height) : 0;
        _ > 0 && r(_);
      }
      let R = f.current;
      if (!R || !R.isConnected || R.ownerDocument !== u) {
        const T = u.defaultView;
        R = [...u.querySelectorAll("div")].filter((N) => {
          if (N.clientHeight < 200) return !1;
          const q = T == null ? void 0 : T.getComputedStyle(N);
          return !!q && (q.overflowY === "auto" || q.overflowY === "scroll");
        }).sort((N, q) => q.clientHeight - N.clientHeight)[0] ?? null, f.current = R;
      }
      if (!R) return;
      const j = h.current ? `${h.current}px` : "";
      R.style.paddingBottom !== j && (R.style.paddingBottom = j);
    } catch {
    }
  }, [t]);
  U(() => {
    g();
  }, [g, i]), U(() => {
    rn(e);
  }, [e]), U(() => {
    const s = t.current;
    return s && s.setAttribute("data-kipo-gen", String(Fo())), lt(), () => {
      requestAnimationFrame(lt);
    };
  }, [e, t]);
  const c = () => {
    var u;
    const s = t.current;
    try {
      const n = (u = s == null ? void 0 : s.contentWindow) == null ? void 0 : u.location.pathname;
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
  return U(() => {
    const s = [], u = window.setInterval(() => {
      var a;
      const n = t.current;
      try {
        const R = (a = n == null ? void 0 : n.contentWindow) == null ? void 0 : a.location.pathname;
        if (n && R && !R.startsWith("/popout/chat")) {
          const T = Date.now();
          for (; s.length && T - s[0] > 6e5; ) s.shift();
          s.length < 5 && (s.push(T), rn(e), n.src = l);
          return;
        }
        lt();
        const j = n == null ? void 0 : n.contentDocument;
        j && _o(j);
      } catch {
      }
      h.current && g();
    }, 2e3);
    return () => window.clearInterval(u);
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
const xn = {
  grilling: { what: "Grill", action: "Start the grill", body: "An interview with you to settle this decision. It updates GLOSSARY.md and the ADRs as answers land." },
  prototype: { what: "Prototype", action: "Start a prototype", body: "Throwaway code or an outline to react to, so the decision gets made against something concrete." },
  research: { what: "Research", action: "Run the research", body: "The agent reads primary sources and leaves a cited note on a research branch. No HITL (human-in-the-loop) step." },
  task: { what: "Task", action: "Start this task", body: "Work that has to happen before a decision can be made. The agent does what it can and hands you a checklist for the rest." },
  build: { what: "Build", action: "Implement this ticket", body: "/implement builds this ticket test-first in its own conversation, then reviews it." },
  issue: { what: "Issue", action: "Triage it", body: "A follow-up filed on the map. Triage moves it to an agent-ready brief, or asks you what it needs." }
};
function Uo({ detail: e, focus: t, ticket: i, tile: r, starting: l, onStart: f, alternatives: h, onSkill: g }) {
  let c, s, u;
  if (r) {
    const n = xn[r.type];
    r.state === "done" ? (c = "Closed", s = r.sessionKey ? "Its conversation was closed when the ticket was. How it ended is on the right." : "How it ended is on the right.", u = null) : r.state === "blocked" ? (c = `Waiting on ${r.blockedBy.map((a) => `#${a}`).join(", ")}`, s = "It can start once those are closed.", u = null) : r.state === "review" ? (c = "In review", s = "Its PR is open. The effort's Review merges it once it's clean.", u = null) : (c = "No conversation yet", s = `${r.who === "you" ? "HITL (human in the loop): it needs you." : "Agent (AFK, away from keyboard): an agent can take it on its own."} ${n.body}`, u = n.action);
  } else if (t.kind === "ticket")
    i != null && i.blockedBy.length ? (c = `#${t.t} is waiting on ${i.blockedBy.map((n) => `#${n}`).join(", ")}`, s = "It can start once those are closed.", u = null) : (i == null ? void 0 : i.state) === "CLOSED" ? (c = `#${t.t} is closed`, s = "Nothing left to build on this ticket.", u = null) : (c = `Build #${t.t}`, s = "/implement builds this one ticket test-first in a fresh conversation, then reviews it.", u = "Implement this ticket");
  else if (t.kind === "spec")
    c = "Implement the whole spec", s = "/implement-spec builds every unblocked ticket in parallel on one integration branch, then one review.", u = "Run /implement-spec";
  else if (t.kind === "review")
    c = `Review #${t.t}`, s = "kipo-review reviews this ticket's PR, fixes what it finds, and merges it if it's a two-way door.", u = "Review this ticket";
  else if (t.kind === "decision")
    c = `Decision #${t.t}`, s = "Work through this decision ticket from the map in its own conversation.", u = "Start this decision";
  else if (t.kind === "column")
    c = "Start the conductor", s = "The conductor runs this effort: it reads the frontier from GitHub, starts one stage-skill conversation per open thread, asks you in one batched message, and closes the effort when the frontier is empty. It never does the work itself.", u = "Start the conductor";
  else {
    const n = t.column, a = n === "plan" && e.sessions.grill;
    c = `${ut[n]} hasn't started`, s = a ? "Plan continues the Grill conversation, so the spec and tickets are written with everything it learned." : `${Jn[n]}`, u = a ? "Continue in the Grill conversation" : `Start ${ut[n]}`;
  }
  return /* @__PURE__ */ o("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ d("div", { style: { maxWidth: 400, textAlign: "center" }, children: [
    /* @__PURE__ */ o("div", { style: { ...Ie, fontSize: v.title }, children: c }),
    /* @__PURE__ */ o("div", { style: { ...G, fontSize: v.body, margin: "6px 0 14px", lineHeight: 1.5 }, children: s }),
    /* @__PURE__ */ o("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }, children: u && /* @__PURE__ */ o(Ce, { primary: !0, disabled: l, onClick: f, children: l ? "Starting…" : u }) }),
    u && h.map((n) => /* @__PURE__ */ d("div", { style: { marginTop: 10, fontSize: v.small }, children: [
      /* @__PURE__ */ o("span", { style: G, children: "or " }),
      /* @__PURE__ */ d(
        "button",
        {
          type: "button",
          disabled: l,
          onClick: () => g(n.skill),
          title: Tt[n.skill],
          style: { background: "transparent", padding: 0, color: "var(--accent)", cursor: l ? "default" : "pointer", fontSize: v.small },
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
function sn(e, t) {
  return (e ? e.type === "grilling" : t === "grill") ? [{ skill: "grill-me", label: "without writing docs" }] : [];
}
function Qo({ skills: e }) {
  return /* @__PURE__ */ d("span", { style: { ...G, fontSize: v.tiny, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: [
    "Running",
    " ",
    e.map((t, i) => /* @__PURE__ */ d("span", { children: [
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
  const e = Dn(), t = (e == null ? void 0 : e.active) !== !1, i = Ct(), [r, l] = E(() => it("initiatives")), [f, h] = E(() => it("repos")), [g, c] = E(!1), [s, u] = E(""), [n, a] = E(() => {
    const b = it("main");
    return !b || !["new", "initiative"].includes(b.kind) ? null : b.kind === "initiative" ? { ...b, autoStart: void 0 } : b;
  });
  U(() => {
    n && rt("main", n);
  }, [n]);
  const [R, j] = fn("rail", 300, 168, 620), [T, _] = E(null), [N, q] = E(() => localStorage.getItem("kipo.railOpen") !== "0"), D = (b) => {
    q(b), localStorage.setItem("kipo.railOpen", b ? "1" : "0");
  };
  U(() => {
    ro(i).catch(() => {
    });
  }, [i]);
  const [ne, ie] = E(""), S = Ee(() => {
    ge.listInitiatives().then((b) => {
      var W;
      l(b.initiatives), rt("initiatives", b.initiatives), h(b.repos ?? []), rt("repos", b.repos ?? []), u(""), ie((W = b.errors) != null && W.length ? `GitHub is refusing calls for ${b.errors.length === 1 ? b.errors[0].repo.split("/").pop() : `${b.errors.length} repos`} (rate limit?) — showing the last known maps.` : "");
    }).catch((b) => u(Se(b)));
  }, []);
  U(() => {
    if (S(), !t) return;
    const b = setInterval(S, 15e3);
    return () => clearInterval(b);
  }, [S, t]), U(() => {
    if (r === null) return;
    const b = (n == null ? void 0 : n.kind) === "initiative" && !r.some((L) => L.repo === n.repo && L.number === n.number);
    if (n && !b) return;
    const W = r[0];
    a(W ? { kind: "initiative", repo: W.repo, number: W.number } : { kind: "new" });
  }, [r, n]);
  const I = (b, W) => a({ kind: "initiative", repo: b.repo, number: b.number, autoStart: W }), H = (b) => {
    l((W) => (W ?? []).filter((L) => !(L.repo === b.repo && L.number === b.number))), ge.hide(b.repo, b.number).then(S).catch((W) => {
      u(Se(W)), S();
    });
  }, F = (b) => {
    l((W) => (W ?? []).filter((L) => !(L.repo === b.repo && L.number === b.number))), ge.removeInitiative(b.repo, b.number).then(S).catch((W) => {
      u(Se(W)), S();
    });
  }, se = (b) => {
    h((W) => (W ?? []).filter((L) => L.slug !== b)), l((W) => (W ?? []).filter((L) => L.repo !== b)), ge.removeRepo(b).then(S).catch((W) => {
      u(Se(W)), S();
    });
  }, pe = (b, W) => {
    Promise.allSettled(W.map((L) => ge.unhide(b, L))).then(S);
  }, ae = (n == null ? void 0 : n.kind) === "initiative" ? `${n.repo}#${n.number}` : null, [P, oe] = E(0), te = Ee((b) => oe(b), []);
  return /* @__PURE__ */ d("div", { style: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", background: "var(--bg)", color: "var(--text)" }, children: [
    N ? /* @__PURE__ */ d(we, { children: [
      /* @__PURE__ */ o(
        $o,
        {
          width: R,
          onCollapse: () => D(!1),
          items: r,
          repos: f,
          error: s,
          notice: ne,
          selected: ae,
          attention: P,
          spineSlot: _,
          onNew: () => a({ kind: "new" }),
          onAddRepo: () => c(!0),
          onRemoveRepo: se,
          onRestore: pe,
          onSelect: (b) => I(b),
          onHide: H,
          onRemove: F
        }
      ),
      /* @__PURE__ */ o(gn, { direction: "vertical", label: "Resize the effort list", onDrag: (b) => j((W) => W + b), onReset: () => j(228) })
    ] }) : /* @__PURE__ */ o(
      Io,
      {
        items: r,
        selected: ae,
        attention: P,
        onNew: () => a({ kind: "new" }),
        onSelect: (b) => I(b),
        onExpand: () => D(!0)
      }
    ),
    /* @__PURE__ */ d("main", { style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "auto" }, children: [
      (n == null ? void 0 : n.kind) === "new" && /* @__PURE__ */ o("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "40px 24px" }, children: /* @__PURE__ */ o(
        Co,
        {
          onStarted: (b) => {
            S(), I(b, !0);
          },
          onCancel: r && r.length ? () => a(r[0] ? { kind: "initiative", repo: r[0].repo, number: r[0].number } : { kind: "new" }) : void 0
        }
      ) }),
      (n == null ? void 0 : n.kind) === "initiative" && /* @__PURE__ */ o(
        Ko,
        {
          repo: n.repo,
          number: n.number,
          autoStart: n.autoStart,
          active: t,
          spineHost: N ? T : null,
          spineCompact: R < 340,
          onChanged: S,
          onRemoved: () => {
            S(), a(null);
          },
          onNeeds: te
        },
        `${n.repo}#${n.number}`
      )
    ] }),
    g && /* @__PURE__ */ o(Zn, { onAdded: S, onClose: () => c(!1) })
  ] });
}
export {
  ii as default
};
