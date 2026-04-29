import Accordion from "@tangly/theme-ui/components/Accordion.astro";
import AccordionGroup from "@tangly/theme-ui/components/AccordionGroup.astro";
import Badge from "@tangly/theme-ui/components/Badge.astro";
import Card from "@tangly/theme-ui/components/Card.astro";
import CardGroup from "@tangly/theme-ui/components/CardGroup.astro";
import Check from "@tangly/theme-ui/components/Check.astro";
import CodeGroup from "@tangly/theme-ui/components/CodeGroup.astro";
import Columns from "@tangly/theme-ui/components/Columns.astro";
import Danger from "@tangly/theme-ui/components/Danger.astro";
import Embed from "@tangly/theme-ui/components/Embed.astro";
import Expandable from "@tangly/theme-ui/components/Expandable.astro";
import FileTree from "@tangly/theme-ui/components/FileTree.astro";
import Frame from "@tangly/theme-ui/components/Frame.astro";
import GlossaryTerm from "@tangly/theme-ui/components/GlossaryTerm.astro";
import Icon from "@tangly/theme-ui/components/Icon.astro";
import Info from "@tangly/theme-ui/components/Info.astro";
import Kbd from "@tangly/theme-ui/components/Kbd.astro";
import LightboxImage from "@tangly/theme-ui/components/LightboxImage.astro";
import Note from "@tangly/theme-ui/components/Note.astro";
import PackageManager from "@tangly/theme-ui/components/PackageManager.astro";
import ParamField from "@tangly/theme-ui/components/ParamField.astro";
import RequestExample from "@tangly/theme-ui/components/RequestExample.astro";
import ResponseExample from "@tangly/theme-ui/components/ResponseExample.astro";
import ResponseField from "@tangly/theme-ui/components/ResponseField.astro";
import Snippet from "@tangly/theme-ui/components/Snippet.astro";
import Step from "@tangly/theme-ui/components/Step.astro";
import Steps from "@tangly/theme-ui/components/Steps.astro";
import Tab from "@tangly/theme-ui/components/Tab.astro";
import Tabs from "@tangly/theme-ui/components/Tabs.astro";
import Tip from "@tangly/theme-ui/components/Tip.astro";
import Tooltip from "@tangly/theme-ui/components/Tooltip.astro";
import Update from "@tangly/theme-ui/components/Update.astro";
import Video from "@tangly/theme-ui/components/Video.astro";
import Warning from "@tangly/theme-ui/components/Warning.astro";

export const mdxComponents = {
  // Default `img` MDX renderer → wraps every inline image in a clickable
  // lightbox. Pages opt out via `<Frame lightbox={false}>` or by setting
  // `appearance.lightbox: false` (future).
  img: LightboxImage,
  Accordion,
  AccordionGroup,
  Badge,
  Card,
  CardGroup,
  Check,
  CodeGroup,
  Columns,
  Danger,
  Embed,
  Expandable,
  FileTree,
  Frame,
  GlossaryTerm,
  Icon,
  Info,
  Kbd,
  Note,
  PackageManager,
  ParamField,
  RequestExample,
  ResponseExample,
  ResponseField,
  Snippet,
  Step,
  Steps,
  Tab,
  Tabs,
  Tip,
  Tooltip,
  Update,
  Video,
  Warning,
};
