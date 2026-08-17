import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Clock,
  Code,
  CreditCard,
  Database,
  FileText,
  Filter,
  Gauge,
  Globe,
  Handshake,
  Headphones,
  Image,
  Layers,
  Layout,
  LayoutTemplate,
  Languages,
  LifeBuoy,
  LineChart,
  Link2,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Monitor,
  Newspaper,
  PackageSearch,
  Palette,
  PieChart,
  Puzzle,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";

import { FALLBACK_ICON } from "../../data/icons";

/**
 * Ключ иконки → компонент.
 *
 * Разделение с `data/icons.ts` не косметическое: там лежат одни строки,
 * и этот модуль читают каталог услуг и серверные валидаторы, куда lucide
 * тянуть не нужно. Сюда же импорты собраны поимённо, а не через `import *`:
 * так в бандл попадают только используемые иконки.
 */
const MAP: Record<string, LucideIcon> = {
  layout: Layout,
  "layout-template": LayoutTemplate,
  code: Code,
  palette: Palette,
  image: Image,
  smartphone: Smartphone,
  monitor: Monitor,
  languages: Languages,

  zap: Zap,
  gauge: Gauge,
  rocket: Rocket,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  award: Award,
  star: Star,
  check: Check,

  bot: Bot,
  send: Send,
  "message-square": MessageSquare,
  bell: Bell,
  megaphone: Megaphone,
  workflow: Workflow,
  headphones: Headphones,
  "life-buoy": LifeBuoy,

  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  "credit-card": CreditCard,
  wallet: Wallet,
  tag: Tag,
  truck: Truck,
  "package-search": PackageSearch,
  boxes: Boxes,

  search: Search,
  "bar-chart": BarChart3,
  "line-chart": LineChart,
  "pie-chart": PieChart,
  database: Database,
  filter: Filter,
  target: Target,
  activity: Activity,

  users: Users,
  user: User,
  "building-2": Building2,
  handshake: Handshake,
  briefcase: Briefcase,
  calendar: Calendar,
  clock: Clock,
  "map-pin": MapPin,

  "shield-check": ShieldCheck,
  lock: Lock,
  "refresh-cw": RefreshCw,
  wrench: Wrench,
  settings: Settings,
  layers: Layers,
  puzzle: Puzzle,
  "file-text": FileText,
  newspaper: Newspaper,
  globe: Globe,
  link: Link2,
  mail: Mail,
};

/**
 * Иконка по ключу из базы: `<Icon name="rocket" className="h-5 w-5" />`.
 *
 * Неизвестный ключ отдаёт запасную, а не падает: значок мог быть удалён
 * из палитры уже после того, как владелец его выбрал, и ронять из-за этого
 * страницу услуги — несоразмерно.
 */
export function Icon({ name, ...rest }: { name: string | undefined } & LucideProps) {
  const Component: LucideIcon = MAP[name ?? ""] ?? MAP[FALLBACK_ICON] ?? Sparkles;
  return <Component {...rest} />;
}
