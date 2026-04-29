import Accordion from "@tanglydocs/theme-ui/components/Accordion.astro";
import AccordionGroup from "@tanglydocs/theme-ui/components/AccordionGroup.astro";
import Badge from "@tanglydocs/theme-ui/components/Badge.astro";
import Card from "@tanglydocs/theme-ui/components/Card.astro";
import CardGroup from "@tanglydocs/theme-ui/components/CardGroup.astro";
import Check from "@tanglydocs/theme-ui/components/Check.astro";
import CodeGroup from "@tanglydocs/theme-ui/components/CodeGroup.astro";
import Columns from "@tanglydocs/theme-ui/components/Columns.astro";
import Danger from "@tanglydocs/theme-ui/components/Danger.astro";
import Embed from "@tanglydocs/theme-ui/components/Embed.astro";
import Expandable from "@tanglydocs/theme-ui/components/Expandable.astro";
import FileTree from "@tanglydocs/theme-ui/components/FileTree.astro";
import Frame from "@tanglydocs/theme-ui/components/Frame.astro";
import GlossaryTerm from "@tanglydocs/theme-ui/components/GlossaryTerm.astro";
import Icon from "@tanglydocs/theme-ui/components/Icon.astro";
import Info from "@tanglydocs/theme-ui/components/Info.astro";
import Kbd from "@tanglydocs/theme-ui/components/Kbd.astro";
import LightboxImage from "@tanglydocs/theme-ui/components/LightboxImage.astro";
import Note from "@tanglydocs/theme-ui/components/Note.astro";
import PackageManager from "@tanglydocs/theme-ui/components/PackageManager.astro";
import ParamField from "@tanglydocs/theme-ui/components/ParamField.astro";
import RequestExample from "@tanglydocs/theme-ui/components/RequestExample.astro";
import ResponseExample from "@tanglydocs/theme-ui/components/ResponseExample.astro";
import ResponseField from "@tanglydocs/theme-ui/components/ResponseField.astro";
import Snippet from "@tanglydocs/theme-ui/components/Snippet.astro";
import Step from "@tanglydocs/theme-ui/components/Step.astro";
import Steps from "@tanglydocs/theme-ui/components/Steps.astro";
import Tab from "@tanglydocs/theme-ui/components/Tab.astro";
import Tabs from "@tanglydocs/theme-ui/components/Tabs.astro";
import Tip from "@tanglydocs/theme-ui/components/Tip.astro";
import Tooltip from "@tanglydocs/theme-ui/components/Tooltip.astro";
import Update from "@tanglydocs/theme-ui/components/Update.astro";
import Video from "@tanglydocs/theme-ui/components/Video.astro";
import Warning from "@tanglydocs/theme-ui/components/Warning.astro";

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
