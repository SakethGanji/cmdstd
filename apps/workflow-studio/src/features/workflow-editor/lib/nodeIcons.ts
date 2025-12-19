/**
 * Shared icon mapping for workflow nodes
 * Maps FontAwesome names (fa:xxx) and Lucide names to Lucide components
 */

import {
  MousePointer,
  Play,
  Clock,
  Webhook,
  Code,
  Filter,
  GitBranch,
  Route,
  GitMerge,
  Layers,
  Globe,
  Pen,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Bot,
  File,
  BarChart3,
  Zap,
  Timer,
  CircleAlert,
  MessageCircle,
  Shuffle,
  Split,
  Pause,
  ArrowRightLeft,
  FileCode,
  FileText,
  Send,
  Database,
  Brain,
  Sparkles,
  Calculator,
  Dice1,
  Type,
  PanelBottom,
  Monitor,
  Hash,
  Settings,
  Cpu,
  Network,
  Terminal,
  Box,
  Boxes,
  LayoutGrid,
  Wrench,
  Download,
  Upload,
} from 'lucide-react';

// Lucide icon component type
export type LucideIconComponent = React.ComponentType<{ size?: string | number; className?: string }>;

/**
 * Icon mapping - maps icon names to Lucide components
 * Supports FontAwesome names (fa:xxx), Lucide names, and node type names
 */
export const iconMap: Record<string, LucideIconComponent> = {
  // Trigger nodes - distinct starting icons
  'mouse-pointer': MousePointer,
  play: Play,
  'fa:play': Play,
  start: Play,
  zap: Zap,
  bolt: Zap,
  'fa:bolt': Zap,
  webhook: Webhook,
  'fa:webhook': Webhook,
  clock: Clock,
  'fa:clock': Clock,
  timer: Timer,
  cron: Timer,
  calendar: Calendar,
  'calendar-alt': Calendar,
  'fa:calendar': Calendar,
  'alert-triangle': AlertTriangle,
  'exclamation-triangle': CircleAlert,
  'fa:exclamation-triangle': CircleAlert,
  errortrigger: CircleAlert,
  message: MessageCircle,
  'fa:message': MessageCircle,
  chatinput: MessageCircle,

  // Flow control nodes - branching/routing icons
  'git-branch': GitBranch,
  'code-branch': GitBranch,
  'fa:code-branch': GitBranch,
  if: GitBranch,
  shuffle: Shuffle,
  random: Shuffle,
  'fa:random': Shuffle,
  switch: Shuffle,
  route: Route,
  split: Split,
  'layer-group': Boxes,
  'fa:layer-group': Boxes,
  splitinbatches: Boxes,
  'git-merge': GitMerge,
  merge: GitMerge,
  'compress-arrows-alt': ArrowRightLeft,
  'fa:compress-arrows-alt': ArrowRightLeft,
  pause: Pause,
  'hourglass-half': Pause,
  'fa:hourglass-half': Pause,
  wait: Pause,

  // Transform/Action nodes
  code: Code,
  'fa:code': Code,
  terminal: Terminal,
  filecode: FileCode,
  filter: Filter,
  layers: Layers,
  'th-large': LayoutGrid,
  'fa:th-large': LayoutGrid,
  globe: Globe,
  'fa:globe': Globe,
  httprequest: Globe,
  pen: Pen,
  edit: Pen,
  'fa:edit': Pen,
  set: Settings,
  file: File,
  'fa:file': File,
  readfile: FileText,
  'chart-bar': BarChart3,
  'fa:chart-bar': BarChart3,
  pandasexplore: BarChart3,

  // AI nodes - smart/brain icons
  bot: Bot,
  robot: Bot,
  'fa:robot': Bot,
  llmchat: Bot,
  brain: Brain,
  'fa:brain': Brain,
  aiagent: Brain,
  sparkles: Sparkles,
  cpu: Cpu,

  // Output/Display nodes
  'message-square': MessageSquare,
  'comment-dots': Send,
  'fa:comment-dots': Send,
  chatoutput: Send,
  monitor: Monitor,
  htmldisplay: Monitor,
  panelbottom: PanelBottom,

  // Subnode tools
  calculator: Calculator,
  'fa:calculator': Calculator,
  calculatortool: Calculator,
  dice: Dice1,
  'fa:dice': Dice1,
  randomnumbertool: Dice1,
  font: Type,
  'fa:font': Type,
  texttool: Type,
  currenttimetool: Clock,

  // Subnode models/memory
  google: Sparkles,
  'fa:google': Sparkles,
  geminimodel: Sparkles,
  database: Database,
  simplememory: Database,
  memory: Database,

  // Storage nodes
  download: Download,
  'fa:download': Download,
  objectread: Download,
  upload: Upload,
  'fa:upload': Upload,
  objectwrite: Upload,

  // Generic/fallback
  network: Network,
  box: Box,
  hash: Hash,
  wrench: Wrench,
  tasks: Wrench,
};

/**
 * Get the appropriate icon for a node
 * @param icon - The icon name from node data
 * @param nodeType - The node type as fallback
 * @returns LucideIconComponent
 */
export function getIconForNode(icon?: string, nodeType?: string): LucideIconComponent {
  // First try the explicit icon
  if (icon) {
    // Try direct match
    if (iconMap[icon]) return iconMap[icon];
    // Try without fa: prefix
    const withoutPrefix = icon.replace('fa:', '');
    if (iconMap[withoutPrefix]) return iconMap[withoutPrefix];
  }

  // Try matching by node type (lowercase)
  if (nodeType) {
    const typeLower = nodeType.toLowerCase();
    if (iconMap[typeLower]) return iconMap[typeLower];
  }

  // Fallback to Code icon
  return Code;
}
