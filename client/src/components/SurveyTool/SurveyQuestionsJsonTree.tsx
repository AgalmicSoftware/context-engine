import React from 'react';

import styles from './SurveyTool.module.scss';
import { buildSurveyQuestionsJsonTreeItemStyle } from './surveyQuestionsTypes.js';

type SurveyQuestionsJsonTreeNode = {
  key: string | number;
  level: number;
  type: 'arrayItem' | 'arrayItemValue' | 'objectKey' | 'objectKeyValue' | 'value';
  value?: unknown;
};

type SurveyQuestionsJsonTreeProps = {
  jsonInput?: unknown;
  onInvalidInput?: (...args: unknown[]) => void;
};

export const processSurveyQuestionsJsonToTree = (json: unknown, level = 0): SurveyQuestionsJsonTreeNode[] => {
  let output: SurveyQuestionsJsonTreeNode[] = [];
  if (json === null || json === undefined) {
    return output;
  }

  if (Array.isArray(json)) {
    json.forEach((item, index) => {
      if (item !== null && typeof item === 'object') {
        output.push({ type: 'arrayItem', key: index, level });
        output = [...output, ...processSurveyQuestionsJsonToTree(item, level + 1)];
      } else {
        output.push({ type: 'arrayItemValue', key: index, value: item, level });
      }
    });
  } else if (typeof json === 'object') {
    Object.keys(json).forEach((key) => {
      const value = (json as Record<string, unknown>)[key];
      if (value !== null && typeof value === 'object') {
        output.push({ type: 'objectKey', key, level });
        output = [...output, ...processSurveyQuestionsJsonToTree(value, level + 1)];
      } else {
        output.push({ type: 'objectKeyValue', key, value, level });
      }
    });
  }
  return output;
};

const normalizeJsonInputForDisplay = (jsonInput: unknown, onInvalidInput: (...args: unknown[]) => void): unknown => {
  let jsonObject: unknown;
  if (jsonInput === null || jsonInput === undefined) {
    jsonObject = {};
  } else if (typeof jsonInput === 'string') {
    try {
      jsonObject = JSON.parse(jsonInput);
    } catch (e) {
      onInvalidInput('Invalid JSON string for display:', e, 'Input:', jsonInput);
      jsonObject = { error: 'Invalid JSON input', original: jsonInput };
    }
  } else if (typeof jsonInput === 'object') {
    jsonObject = jsonInput;
  } else {
    onInvalidInput('Invalid input for jsonTreeDisplay: Expected string or object, got', typeof jsonInput);
    jsonObject = { error: 'Invalid input type', original: String(jsonInput) };
  }

  if (!jsonObject) {
    jsonObject = { error: 'JSON became null after processing' };
  }

  return jsonObject;
};

const SurveyQuestionsJsonTree = ({
  jsonInput,
  onInvalidInput = () => {},
}: SurveyQuestionsJsonTreeProps): React.ReactElement => {
  const jsonObject = normalizeJsonInputForDisplay(jsonInput, onInvalidInput);
  const treeData = processSurveyQuestionsJsonToTree(jsonObject);

  if (treeData.length === 0) {
    return (
      <ul className={styles.tree}>
        <li className={styles.treeItem}>{'{}'}</li>
      </ul>
    );
  }

  return (
    <ul className={styles.tree}>
      {treeData.map((node, index) => (
        <li key={index} className={styles.treeItem} style={buildSurveyQuestionsJsonTreeItemStyle(node.level)}>
          <span className={styles.keyValueContainer}>
            {node.type === 'arrayItemValue' && (
              <span>
                [{node.key}]: {String(node.value)}
              </span>
            )}
            {node.type === 'objectKeyValue' && (
              <span>
                {node.key}: {String(node.value)}
              </span>
            )}
            {node.type === 'arrayItem' && <span>[{node.key}]</span>}
            {node.type === 'objectKey' && <span>{node.key}:</span>}
            {node.type === 'value' && <span>{String(node.value)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default SurveyQuestionsJsonTree;
