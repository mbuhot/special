import type { ControlKind, StepMode } from "./dialect.js";

export interface BindError {
  file: string;
  line: number;
  message: string;
}

export type AstValue = string | AstValue[];

export interface StepNode {
  id: string;
  line: number;
  args: Record<string, AstValue>;
  modes?: StepMode[];
}

export interface NarrationNode {
  id: "narrate" | "caption";
  line: number;
  text: string;
  modes: StepMode[];
}

export type ScenarioNode = StepNode | NarrationNode;

export interface Scenario {
  name: string;
  source: { file: string; line: number };
  story?: string;
  steps: ScenarioNode[];
}

export interface SurfaceNode {
  route?: string;
  shared?: true;
  controls: Record<string, { kind: ControlKind | string; locators: Record<string, string> }>;
}

export interface StateMachineNode {
  states: string[];
  transitions: { from: string; to: string }[];
}

export interface EntityNode {
  fields: string[];
  relations: { kind: "belongs-to" | "has-many"; entity: string }[];
  machines: Record<string, StateMachineNode>;
}

export interface SpecAst {
  dialect: { name: string; version: string; stepIds: string[] };
  contexts: Record<string, Record<string, string>>;
  actors: Record<string, Record<string, string | Record<string, string>>>;
  surfaces: Record<string, SurfaceNode>;
  model: Record<string, EntityNode>;
  policies: Record<string, Record<string, string[]>>;
  scenarios: Scenario[];
}

export interface Declaration {
  kind: string;
  key: string;
  file: string;
  line: number;
  data: Record<string, string>;
}

export interface Emission {
  kind: string;
  key?: string;
  scenario: string;
  file: string;
  line: number;
  data: Record<string, string>;
}

export interface Reference {
  kind: string;
  key: string;
  file: string;
  line: number;
}

export interface Analysis {
  declarations: Declaration[];
  emissions: Emission[];
  references: Reference[];
}

export interface BindSuccess {
  ok: true;
  file: string;
  ast: SpecAst;
  analysis: Analysis;
}

export interface BindFailure {
  ok: false;
  errors: BindError[];
}

export type BindResult = BindSuccess | BindFailure;
