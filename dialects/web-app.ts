import { check, context, dialect, ns, section, step } from "../packages/specdsl-core/src/index.ts";

const freeText = ns({ resolution: "free" });

export default dialect({
  name: "web-app",
  version: "1",
  namespaces: {
    Entity: ns(),
    Field: ns({ scope: "Entity" }),
    Action: ns({ scope: "Entity" }),
    State: ns({ scope: "Field" }),
    Surface: ns(),
    Control: ns({ scope: "Surface", kinds: ["field", "button", "region", "table", "link"] }),
    Actor: ns(),
    Ref: ns({ scope: "scenario" }),
    Name: freeText,
    Value: freeText,
    Text: freeText,
    Role: freeText,
    DateTime: freeText,
    Duration: freeText,
    Job: freeText,
  },
  contexts: {
    app: context({ scope: "suite" }),
    data: context({ scope: "scenario", requires: ["app"] }),
    clock: context({ scope: "scenario", requires: ["app"], config: ["DateTime"] }),
    actor: context({ scope: "actor", keyedBy: "Actor", requires: ["data"] }),
  },
  sections: {
    Model: section({
      occurs: "once",
      items: [
        { pattern: "<Entity>: <Field>, ...", declares: ["Entity", "Field"] },
        { pattern: "Belongs to <Entity>", references: ["Entity"], relation: "belongs-to" },
        { pattern: "Has many <Entity>", references: ["Entity"], relation: "has-many" },
        {
          pattern: "<Entity> has many <Target=Entity>",
          references: ["Entity"],
          relation: "has-many",
        },
        {
          pattern: "<Entity> belongs to <Target=Entity>",
          references: ["Entity"],
          relation: "belongs-to",
        },
        {
          pattern: "<Entity>.<Field>: <State> -> ..., ...",
          declares: ["State"],
          references: ["Entity", "Field"],
          emits: "Transition",
        },
      ],
    }),
    Surfaces: section({
      occurs: "once",
      items: [
        {
          pattern: '<Surface>[ (shared)]: <Control.kind> "<Control>", ...',
          declares: ["Surface", "Control"],
          emits: "Control",
        },
      ],
    }),
    Actors: section({
      occurs: "once",
      items: [{ pattern: "<Actor>: role <Role>", declares: ["Actor"], output: "actors" }],
    }),
    Policies: section({
      occurs: "once",
      items: [
        {
          pattern: "<Entity>: <Role> may <Action>, ...",
          declares: ["Action"],
          references: ["Entity"],
          emits: "Policy",
          output: "policies",
        },
      ],
    }),
    Context: section({
      occurs: "once",
      items: [{ pattern: "Clock: <DateTime>", context: "clock", output: "contexts" }],
    }),
    Steps: section({ occurs: "once", body: "composites" }),
    Scenario: section({ heading: "Scenario: <Name>", occurs: "many", body: "steps" }),
  },
  steps: [
    step("<Actor> opens <Surface> [for <Ref>]", {
      uses: ["app", "actor"],
    }),
    step("<Actor> is on <Surface>", {
      id: "is-on",
      uses: ["actor"],
    }),
    step('<Actor> enters <Value> into "<Control:field>"', {
      id: "enters",
      uses: ["actor"],
    }),
    step('<Actor> clicks "<Control:button|link>"', {
      uses: ["actor"],
    }),
    step('<Actor> selects <Value> in "<Control:field>"', {
      id: "selects",
      uses: ["actor"],
    }),
    step('<Actor> sees "<Text>" in "<Control>"', {
      id: "sees",
      uses: ["actor"],
    }),
    step('<Actor> sees "<Text>" before "<Other=Text>" in "<Control>"', {
      id: "sees-before",
      uses: ["actor"],
    }),
    step('<Actor> no longer sees "<Text>" in "<Control>"', {
      id: "no-longer-sees",
      uses: ["actor"],
    }),
    step('[<a|an>] <Entity> "<Ref>" [with <Field> <Value>, ...]', {
      id: "given-entity",
      uses: ["data"],
      declares: ["Ref"],
    }),
    step("<Ref> has <Field> <Value>", {
      id: "has-field",
      uses: ["data"],
      emits: { kind: "TransitionUse", fields: { Ref: "Ref", Field: "Field", State: "Value" } },
    }),
    step("time advances <Duration>", {
      uses: ["clock"],
    }),
    step("job <Job> runs", {
      uses: ["data"],
    }),
    step("<Actor> may <Action> <Ref>", {
      id: "may",
      uses: ["data", "actor"],
      modes: ["domain", "demo"],
      emits: { kind: "PolicyUse", fields: { Actor: "Actor", Action: "Action", Ref: "Ref" } },
    }),
    step("<Actor> may not <Action> <Ref>", {
      id: "may-not",
      uses: ["data", "actor"],
      modes: ["domain", "demo"],
      emits: { kind: "PolicyUse", fields: { Actor: "Actor", Action: "Action", Ref: "Ref" } },
    }),
    step('<Actor> does not see "<Control>"', {
      id: "does-not-see",
      uses: ["actor"],
    }),
  ],
  checks: [
    check.coverage({ declared: "Transition", usedBy: "TransitionUse" }),
    check.sequence({ machine: "Transition", observed: "TransitionUse", within: "scenario" }),
    check.referenced({ declared: "Control" }),
  ],
});
