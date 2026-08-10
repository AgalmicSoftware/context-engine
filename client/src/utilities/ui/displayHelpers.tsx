import React from 'react';
import { NavLink } from 'reactstrap';

type SliceableDisplayValue = {
  slice: (start: number, end?: number) => string;
  toString: () => string;
};

type DisplayHelperResult = string | React.ReactElement;

const asSliceableDisplayValue = (value: unknown): SliceableDisplayValue => value as SliceableDisplayValue;

export const getShortenedAddress = (
  address: unknown,
  clickable?: boolean | null,
  customLink?: string | null,
): DisplayHelperResult => {
  const addressClickable = clickable === null ? true : clickable;
  const source = asSliceableDisplayValue(address);

  let displayString = '';

  displayString += source.slice(0, 5);
  displayString += '...';
  displayString += source.slice(38, 42);

  if (addressClickable) {
    const link = customLink ? customLink : '/u/' + source.toString();
    const displayStringURL = (
      <React.Fragment>
        <NavLink href={link} target="_blank" style={{ padding: '0px' }}>
          {displayString}
        </NavLink>
      </React.Fragment>
    );

    return displayStringURL;
  }

  return displayString;
};

export const getShortenedSurveyID = (
  surveyID: unknown,
  clickable?: boolean | null,
  customLink: string | null = null,
  forCSVName = false,
): DisplayHelperResult | undefined => {
  const surveyIdClickable = clickable !== null ? clickable : true;
  const source = asSliceableDisplayValue(surveyID);

  let displayString = '';

  if (forCSVName === true) {
    displayString += source.slice(2, 5);
    displayString += '-';
    displayString += source.slice(63, 66);

    return displayString;
  } else if (surveyIdClickable) {
    const link = customLink ? customLink : '/survey/' + source.toString();
    const displayStringURL = (
      <NavLink
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        style={{ padding: '0px', color: 'var(--ce-link)', marginLeft: '5px' }}
      >
        {displayString}
      </NavLink>
    );

    return displayStringURL;
  } else {
    displayString += source.slice(2, 5);
    displayString += '...';
    displayString += source.slice(63, 66);
    return displayString;
  }
};

export const getShortenedQuestionID = (
  questionID: unknown,
  clickable = true,
  customLink?: string | null,
): DisplayHelperResult => {
  const source = asSliceableDisplayValue(questionID);
  const displayString = source.slice(2, 5) + '...' + source.slice(63, 66);

  if (clickable) {
    const link = customLink ? customLink : '/question/' + source.toString();
    return (
      <NavLink href={link} target="_blank" style={{ padding: '0px' }}>
        {displayString}
      </NavLink>
    );
  }

  return displayString;
};

export const getShortenedTransactionHash = (
  transactionHash: unknown,
  clickable = false,
  customLink: string | null = null,
): DisplayHelperResult => {
  const source = asSliceableDisplayValue(transactionHash);
  const displayString = source.slice(0, 6) + '...' + source.slice(58, 64);

  if (clickable) {
    const link = customLink ? customLink : '/tx/' + source.toString();
    return (
      <NavLink href={link} target="_blank" style={{ padding: '0px' }}>
        {displayString}
      </NavLink>
    );
  }

  return displayString;
};
