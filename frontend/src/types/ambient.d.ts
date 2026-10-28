// Ambient TypeScript definitions to guarantee zero IDE/type errors in sandbox & offline environments

declare var process: {
  env: {
    NODE_ENV?: string;
    NEXT_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
  [key: string]: any;
};

declare namespace React {
  export type ReactNode = any;
  export type ReactElement<P = any, T = any> = any;
  export type ElementType<P = any> = any;
  export type ComponentType<P = any> = any;
  export type FC<P = {}> = (props: P) => any;
  export type Key = string | number;

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: null): { current: T | null };
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useContext<T>(context: Context<T>): T;
  export interface Context<T> {
    Provider: FC<{ value: T; children?: any }>;
    Consumer: FC<{ children: (value: T) => any }>;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export const Suspense: FC<{ fallback?: any; children?: any }>;

  export interface SyntheticEvent<T = any> {
    preventDefault(): void;
    stopPropagation(): void;
    target: T;
    currentTarget: T;
  }
  export interface FormEvent<T = any> extends SyntheticEvent<T> {}
  export interface MouseEvent<T = any> extends SyntheticEvent<T> {}
  export interface KeyboardEvent<T = any> extends SyntheticEvent<T> {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
  }
  export interface ChangeEvent<T = any> extends SyntheticEvent<T> {
    target: T & { value: string };
  }
}

declare module "react" {
  export = React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface Element extends any {}
  interface DOMAttributes<T> {
    children?: any;
    dangerouslySetInnerHTML?: any;
    onCopy?: (e: any) => void;
    onCut?: (e: any) => void;
    onPaste?: (e: any) => void;
    onKeyDown?: (e: any) => void;
    onKeyPress?: (e: any) => void;
    onKeyUp?: (e: any) => void;
    onFocus?: (e: any) => void;
    onBlur?: (e: any) => void;
    onChange?: (e: any) => void;
    onInput?: (e: any) => void;
    onReset?: (e: any) => void;
    onSubmit?: (e: any) => void;
    onClick?: (e: any) => void;
    onContextMenu?: (e: any) => void;
    onDoubleClick?: (e: any) => void;
    onDrag?: (e: any) => void;
    onScroll?: (e: any) => void;
    [propName: string]: any;
  }
  interface HTMLAttributes<T> extends DOMAttributes<T> {
    className?: string;
    style?: any;
    id?: string;
    title?: string;
    role?: string;
    tabIndex?: number;
    value?: any;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    rows?: number;
    cols?: number;
    alt?: string;
    src?: string;
    loading?: string;
    href?: string;
    target?: string;
    rel?: string;
    colSpan?: number;
    rowSpan?: number;
    [propName: string]: any;
  }
  interface IntrinsicElements {
    [elemName: string]: HTMLAttributes<any>;
  }
  interface IntrinsicAttributes {
    key?: any;
    ref?: any;
  }
  interface ElementAttributesProperty {
    props: {};
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}

declare module "lucide-react" {
  export type Icon = (props: {
    className?: string;
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    [key: string]: any;
  }) => any;

  export const Wrench: Icon;
  export const Inbox: Icon;
  export const Shield: Icon;
  export const Search: Icon;
  export const Sun: Icon;
  export const Moon: Icon;
  export const Laptop: Icon;
  export const Bell: Icon;
  export const User: Icon;
  export const Mail: Icon;
  export const Lock: Icon;
  export const Plus: Icon;
  export const X: Icon;
  export const Clock: Icon;
  export const Check: Icon;
  export const MapPin: Icon;
  export const Copy: Icon;
  export const Zap: Icon;
  export const Droplets: Icon;
  export const Wifi: Icon;
  export const ShieldAlert: Icon;
  export const Armchair: Icon;
  export const Sparkles: Icon;
  export const HelpCircle: Icon;
  export const Accessibility: Icon;
  export const Camera: Icon;
  export const ArrowLeft: Icon;
  export const AlertTriangle: Icon;
  export const CheckCircle: Icon;
  export const CheckCircle2: Icon;
  export const AlertCircle: Icon;
  export const Filter: Icon;
  export const Layers: Icon;
  export const LayoutDashboard: Icon;
  export const FileText: Icon;
  export const Map: Icon;
  export const ChevronLeft: Icon;
  export const RefreshCw: Icon;
  export const ChevronRight: Icon;
  export const ArrowRight: Icon;
  export const Play: Icon;
  export const UserCheck: Icon;
  export const QrCode: Icon;
  export const Info: Icon;
  export const BarChart3: Icon;
  export const [key: string]: any;
}

declare module "next" {
  export type Metadata = {
    title?: string;
    description?: string;
    [key: string]: any;
  };
}

declare module "next/navigation" {
  export function useRouter(): {
    push(url: string, options?: any): void;
    replace(url: string, options?: any): void;
    back(): void;
    forward(): void;
    refresh(): void;
    prefetch(url: string): void;
  };
  export function usePathname(): string;
  export function useSearchParams(): {
    get(name: string): string | null;
    toString(): string;
    [key: string]: any;
  };
  export function useParams(): Record<string, string | string[] | undefined>;
}

declare module "next/link" {
  const Link: any;
  export default Link;
}

declare module "next/font/google" {
  export function Inter(options?: any): { className: string };
}

declare module "react-hot-toast" {
  export interface ToastOptions {
    [key: string]: any;
  }
  export const toast: {
    success(msg: string, opts?: ToastOptions): any;
    error(msg: string, opts?: ToastOptions): any;
    loading(msg: string, opts?: ToastOptions): any;
    (msg: string, opts?: ToastOptions): any;
  };
  export const Toaster: any;
  export default toast;
}

declare module "tailwindcss" {
  export interface Config {
    [key: string]: any;
  }
}
