// lucide-react comes from the host at runtime (see vite.config.ts externals).
declare module 'lucide-react' {
  import type { ComponentType, SVGProps } from 'react'
  type Icon = ComponentType<Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number }>
  export const ExternalLink: Icon
  export const EyeOff: Icon
  export const Map: Icon
  export const MoreHorizontal: Icon
  export const Plus: Icon
}
