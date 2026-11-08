// Minimal types for the host-provided SDK. The package ships no types and is
// not installed: the dashboard import map supplies it at runtime. Only exports
// confirmed in the host's vendor stubs are declared here.

declare module '@kirocrew/app-sdk' {
  import type { ReactNode } from 'react'

  export interface AppApi {
    raw(path: string, init?: RequestInit): Promise<Response>
    request<T = unknown>(path: string, init?: RequestInit): Promise<T>
    get<T = unknown>(path: string, init?: RequestInit): Promise<T>
    post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>
    put<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>
    patch<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>
    del<T = unknown>(path: string, init?: RequestInit): Promise<T>
  }
  export function useAppApi(): AppApi

  export interface AppInfo {
    name: string
    version: string
    active?: boolean
  }
  export function useAppInfo(): AppInfo

  export interface ChatEmbedSendMeta {
    sendId?: string
    files?: string[]
    pastes?: unknown[]
  }
  export interface ChatEmbedProps {
    slotKey: string
    agent?: string
    placeholder?: string
    frameless?: boolean
    startAtBottom?: boolean
    onSend?: (message: string, meta?: ChatEmbedSendMeta) => Promise<unknown> | void
    aboveComposer?: ReactNode
    composerMaxHeight?: number
  }
  export function ChatEmbed(props: ChatEmbedProps): JSX.Element
  // Kiro Crew's native chat page for a session, with its side panel (the agent's
  // background work, subagents, checks). conversationOnly drops its sessions rail.
  export function ChatPanel(props: { slotKey: string; conversationOnly?: boolean }): JSX.Element
}

declare module '@kirocrew/app-sdk/ui' {
  import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

  export function Card(props: HTMLAttributes<HTMLDivElement>): JSX.Element
  export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>): JSX.Element
  export function Btn(
    props: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean },
  ): JSX.Element
  export function Badge(
    props: HTMLAttributes<HTMLSpanElement> & { variant?: 'ok' | 'err' | 'aim' | 'muted' | 'warn' },
  ): JSX.Element
  export function PageHeader(props: {
    title: ReactNode
    subtitle?: ReactNode
    actions?: ReactNode
  }): JSX.Element
  export function EmptyState(props: {
    icon?: ReactNode
    title: ReactNode
    subtitle?: ReactNode
    action?: ReactNode
  }): JSX.Element
  // The dashboard's own markdown renderer (the one chat and Spec Builder use).
  export function MarkdownRenderer(props: { content: string; softBreaks?: boolean }): JSX.Element
}
