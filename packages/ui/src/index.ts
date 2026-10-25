// React components for the HUD and decision cards. They receive display-ready strings, so every
// number they show comes from the finance engine via the app (AGENTS.md section 7, rule 9).
export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';
export { Callout } from './Callout';
export type { CalloutProps, Tone } from './Callout';
export { ChoiceGroup } from './ChoiceGroup';
export type { ChoiceGroupProps, ChoiceOption } from './ChoiceGroup';
export { DEFAULT_DISCLAIMER, Disclaimer } from './Disclaimer';
export { Hud } from './Hud';
export type { HudProps } from './Hud';
export { InfoCard, ScreenPanel } from './ScreenPanel';
export type { InfoCardProps, ScreenPanelProps } from './ScreenPanel';
export { ValueList, ValueRow } from './ValueList';
export type { ValueRowProps } from './ValueList';
