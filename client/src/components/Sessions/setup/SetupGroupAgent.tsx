/** @file SetupGroupAgent.tsx: who may ask the Group Agent, and how each audience is answered. */
import React from 'react';
import { Input } from 'reactstrap';

import {
  GROUP_AGENT_DEFAULT_INSTRUCTIONS,
  GROUP_AGENT_LIMITS,
  GROUP_AGENT_STYLES,
  validateGroupAgent,
} from '@ce-shared/groupAgent.mjs';
import { SetupCheck, SetupField, setupHelpId } from './SetupPrimitives';
import { asList, asRecord, text } from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

type Rule = Record<string, unknown>;
type Audience = { who: { match: string; conditions: Rule[] }; answers: string };

const L = GROUP_AGENT_LIMITS;
const everyone = (): Rule => ({ kind: 'agent_grant_scope', scope: 'ai' });
const STYLE_LABELS: Record<string, string> = { general: 'General', detailed: 'Detailed' };
// Admins always get Detailed answers, so a rule naming them is only shown when a setting has one.
const RULE_KINDS = [
  { kind: 'agent_grant_scope', label: 'Everyone signed in' },
  { kind: 'worker_group', label: 'Members of groups' },
  { kind: 'sbt_onchain', label: 'SBT holders' },
  { kind: 'worker_role', label: 'Admins' },
];

const AGENT_HELP =
  'An AI on the session page that answers questions about the session, as a preview. ' +
  'The first audience a person is in sets how they’re answered. Admins always get Detailed answers.';
const ANSWERS_HELP =
  'General answers read the context, files open to everyone and results the asker may see. ' +
  'Detailed answers also read the files they may open and members’ answers, from people who allow it. ' +
  'No answer names anyone.';
const MATCH_HELP = 'Any: people who meet at least one rule. All: only people who meet every rule.';
const instructionsHelp = (style: string) =>
  `How ${STYLE_LABELS[style]} answers are written. Leave it blank for the default. Always added: answer only ` +
  `from the session’s material, never name anyone, and use at most ${L.answerWords} words.`;

/** The first reason the setting can't be saved, or '' when it can. */
export const describeGroupAgentProblem = (value: unknown): string => {
  const checked = validateGroupAgent(value ?? null);
  return checked.ok ? '' : checked.errors[0].message;
};

const readAudiences = (setting: unknown): Audience[] =>
  asList(asRecord(setting).audiences).map((entry) => {
    const audience = asRecord(entry);
    const who = asRecord(audience.who);
    return {
      who: { match: text(who.match) || 'any', conditions: asList(who.conditions).map(asRecord) },
      answers: text(audience.answers) || 'general',
    };
  });

type Props = {
  /** The draft's setting; null or absent is off. */
  value: unknown;
  onChange: (next: Record<string, unknown> | null) => void;
  /** The session's groups, for rules that name groups. */
  groups: Array<{ groupId: string; label: string }>;
  /** The chain the session checks SBTs on, or 0 when it checks none. */
  sbtChainId?: number;
};

// Off is no setting. Turning it on lets everyone signed in ask, with General
// answers; an admin adds audiences, in order, and may rewrite each style's
// instructions. The Worker checks who may ask and gathers what each style reads.
const SetupGroupAgent = ({ value, onChange, groups, sbtChainId = 0 }: Props): React.ReactElement => {
  const on = !!value && typeof value === 'object';
  const audiences = readAudiences(value);
  const instructions = asRecord(asRecord(value).instructions);
  const problem = on ? describeGroupAgentProblem(value) : '';
  const save = (next: Audience[], nextInstructions: Record<string, unknown> = instructions) =>
    onChange({ audiences: next, ...(Object.keys(nextInstructions).length ? { instructions: nextInstructions } : {}) });
  const update = (index: number, change: (audience: Audience) => Audience) =>
    save(audiences.map((audience, at) => (at === index ? change(audience) : audience)));
  const setRules = (index: number, conditions: Rule[]) =>
    update(index, (audience) => ({ ...audience, who: { ...audience.who, conditions } }));
  const move = (index: number, by: number) => {
    const next = [...audiences];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    save(next);
  };
  const ruleOf = (kind: string): Rule => {
    if (kind === 'worker_group') return { kind, groupIds: [] };
    if (kind === 'sbt_onchain') return { kind, chainId: sbtChainId, contract: '', anyOrAll: 'any' };
    if (kind === 'worker_role') return { kind, role: 'admin' };
    return everyone();
  };

  const groupChoices = (rule: Rule, name: string, pick: (groupIds: string[]) => void) => {
    const chosen = asList(rule.groupIds).map(text);
    // A group the list doesn't name, such as one since deleted, still shows, so it can be taken off.
    const shown = [
      ...groups,
      ...chosen
        .filter((groupId) => !groups.some((group) => group.groupId === groupId))
        .map((groupId) => ({ groupId, label: 'Unlisted group' })),
    ];
    if (!shown.length) return <p className={styles.hint}>This session has no groups yet.</p>;
    return (
      <div className={styles.checkRow} role="group" aria-label={`${name}: groups`}>
        {shown.map((group) => (
          <label key={group.groupId}>
            <input
              type="checkbox"
              checked={chosen.includes(group.groupId)}
              onChange={(event) =>
                pick(event.target.checked ? [...chosen, group.groupId] : chosen.filter((id) => id !== group.groupId))
              }
            />
            {group.label}
          </label>
        ))}
      </div>
    );
  };

  const renderRule = (audience: Audience, index: number, rule: Rule, at: number) => {
    const name = `Audience ${index + 1}, rule ${at + 1}`;
    const kind = text(rule.kind);
    const change = (next: Rule) =>
      setRules(
        index,
        audience.who.conditions.map((entry, i) => (i === at ? next : entry)),
      );
    const kinds = RULE_KINDS.filter(
      (option) =>
        option.kind === kind ||
        option.kind === 'agent_grant_scope' ||
        option.kind === 'worker_group' ||
        (option.kind === 'sbt_onchain' && sbtChainId > 0),
    );
    return (
      <div key={at} className={styles.inlineRow}>
        <Input
          type="select"
          aria-label={name}
          value={kind}
          data-testid={`ce-setup-group-agent-rule-${index}-${at}`}
          onChange={(event) => change(ruleOf(event.target.value))}
        >
          {kinds.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </Input>
        {kind === 'worker_group' ? groupChoices(rule, name, (groupIds) => change({ ...rule, groupIds })) : null}
        {kind === 'sbt_onchain' ? (
          <Input
            aria-label={`${name}: SBT contract`}
            placeholder="0x…"
            value={text(rule.contract)}
            onChange={(event) => change({ ...rule, contract: event.target.value })}
          />
        ) : null}
        {audience.who.conditions.length > 1 ? (
          <button
            type="button"
            className={styles.button}
            aria-label={`Remove ${name}`}
            onClick={() =>
              setRules(
                index,
                audience.who.conditions.filter((_, i) => i !== at),
              )
            }
          >
            Remove rule
          </button>
        ) : null}
      </div>
    );
  };

  const renderAudience = (audience: Audience, index: number) => {
    const id = `ce-setup-group-agent-${index}`;
    const { conditions } = audience.who;
    return (
      <div key={index} className={styles.listRow} data-testid={`ce-setup-group-agent-audience-${index}`}>
        <div className={styles.listRowBody}>
          <span className={styles.questionType}>Audience {index + 1}</span>
          {conditions.length > 1 ? (
            <SetupField id={`${id}-match`} label="Who" help={MATCH_HELP}>
              <Input
                id={`${id}-match`}
                type="select"
                value={audience.who.match}
                aria-describedby={setupHelpId(`${id}-match`)}
                onChange={(event) =>
                  update(index, (current) => ({ ...current, who: { ...current.who, match: event.target.value } }))
                }
              >
                <option value="any">Meets any rule</option>
                <option value="all">Meets every rule</option>
              </Input>
            </SetupField>
          ) : null}
          {conditions.map((rule, at) => renderRule(audience, index, rule, at))}
          <SetupField id={`${id}-answers`} label="Answers" help={ANSWERS_HELP}>
            <Input
              id={`${id}-answers`}
              type="select"
              value={audience.answers}
              aria-describedby={setupHelpId(`${id}-answers`)}
              data-testid={`${id}-answers`}
              onChange={(event) => update(index, (current) => ({ ...current, answers: event.target.value }))}
            >
              {GROUP_AGENT_STYLES.map((style) => (
                <option key={style} value={style}>
                  {STYLE_LABELS[style]}
                </option>
              ))}
            </Input>
          </SetupField>
          <div className={styles.buttonRow}>
            {conditions.length < L.conditions ? (
              <button
                type="button"
                className={styles.button}
                aria-label={`Add a rule to audience ${index + 1}`}
                onClick={() => setRules(index, [...conditions, ruleOf('worker_group')])}
              >
                Add rule
              </button>
            ) : null}
            {index > 0 ? (
              <button
                type="button"
                className={styles.button}
                aria-label={`Move audience ${index + 1} up`}
                onClick={() => move(index, -1)}
              >
                Up
              </button>
            ) : null}
            {index < audiences.length - 1 ? (
              <button
                type="button"
                className={styles.button}
                aria-label={`Move audience ${index + 1} down`}
                onClick={() => move(index, 1)}
              >
                Down
              </button>
            ) : null}
            <button
              type="button"
              className={styles.button}
              aria-label={`Remove audience ${index + 1}`}
              onClick={() => save(audiences.filter((_, at) => at !== index))}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <SetupCheck
        id="ce-setup-group-agent"
        label="Group Agent"
        checked={on}
        help={AGENT_HELP}
        testId="ce-setup-group-agent"
        onChange={(checked) =>
          onChange(
            checked ? { audiences: [{ who: { match: 'any', conditions: [everyone()] }, answers: 'general' }] } : null,
          )
        }
      />
      {on ? (
        <>
          {audiences.map(renderAudience)}
          {audiences.length ? null : <p className={styles.hint}>Only admins may ask.</p>}
          {audiences.length < L.audiences ? (
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.button}
                data-testid="ce-setup-group-agent-add"
                // A new audience goes first: a narrower one, such as a group, comes before everyone else.
                onClick={() =>
                  save([
                    { who: { match: 'any', conditions: [ruleOf('worker_group')] }, answers: 'detailed' },
                    ...audiences,
                  ])
                }
              >
                Add audience
              </button>
            </div>
          ) : null}
          {GROUP_AGENT_STYLES.map((style) => {
            const fieldId = `ce-setup-group-agent-${style}`;
            const written = instructions[style];
            return (
              <SetupField
                key={style}
                id={fieldId}
                label={`${STYLE_LABELS[style]} instructions`}
                help={instructionsHelp(style)}
              >
                <Input
                  id={fieldId}
                  type="textarea"
                  className={styles.textarea}
                  maxLength={L.instructionsChars}
                  value={typeof written === 'string' ? written : GROUP_AGENT_DEFAULT_INSTRUCTIONS[style]}
                  aria-describedby={setupHelpId(fieldId)}
                  data-testid={fieldId}
                  onChange={(event) => save(audiences, { ...instructions, [style]: event.target.value })}
                />
              </SetupField>
            );
          })}
          {problem ? (
            <p className={styles.errorText} data-testid="ce-setup-group-agent-error">
              {problem}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default SetupGroupAgent;
