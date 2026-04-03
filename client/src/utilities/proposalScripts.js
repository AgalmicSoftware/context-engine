/**
 * @module proposalScripts
 * @description Legacy-named display helpers for shortening addresses, survey IDs,
 *              question IDs, and transaction hashes across current app surfaces.
 *
 * Key exports: proposalScripts (default)
 */
import React from 'react';
import { NavLink } from "reactstrap";

const proposalScripts = {
  getShortenedAddress: function(address, clickable, customLink) {
    const addressClickable = clickable === null ? true : clickable;

    var displayString = "";

    displayString += address.slice(0, 5);
    displayString += "...";
    displayString += address.slice(38, 42);

    if (addressClickable) {
      const link = customLink ? customLink : '/u/' + address.toString();
      const displayStringURL = (
        <React.Fragment>
          <NavLink
            href={link}
            target="_blank"
            style={{padding: "0px"}}
          >
            {displayString}
          </NavLink>
        </React.Fragment>
      );

      return displayStringURL;
    }

    return displayString;
  },

  getShortenedSurveyID: function(surveyID, clickable, customLink = null, forCSVName = false) {
    const surveyIdClickable = clickable !== null ? clickable : true;

    var displayString = "";

    if (forCSVName === true) {
      displayString += surveyID.slice(2, 5);
      displayString += "-";
      displayString += surveyID.slice(63, 66);

      return displayString;
    }

    else if (surveyIdClickable) {
      const link = customLink ? customLink : '/survey/' + surveyID.toString();
      const displayStringURL = (
        <NavLink
          href={link}
          target="_blank"
          style={{padding: "0px", color: "blue", marginLeft: "5px"}}
        >
          { displayString }
        </NavLink>
      );

      return displayStringURL;
    }

    else if (forCSVName !== true && surveyIdClickable !== true) {
      displayString += surveyID.slice(2, 5);
      displayString += "...";
      displayString += surveyID.slice(63, 66);
      return displayString;
    }
  },

  getShortenedQuestionID: function(questionID, clickable = true, customLink) {
    const displayString = questionID.slice(2, 5) + '...' + questionID.slice(63, 66);

    if (clickable) {
      const link = customLink ? customLink : '/question/' + questionID.toString();
      return (
        <NavLink
          href={link}
          target="_blank"
          style={{ padding: "0px" }}
        >
          {displayString}
        </NavLink>
      );
    }

    return displayString;
  },

  getShortenedTransactionHash: function(transactionHash, clickable = false, customLink = null) {
    const displayString = transactionHash.slice(0, 6) + '...' + transactionHash.slice(58, 64);

    if (clickable) {
      const link = customLink ? customLink : '/tx/' + transactionHash.toString();
      return (
        <NavLink
          href={link}
          target="_blank"
          style={{ padding: "0px" }}
        >
          {displayString}
        </NavLink>
      );
    }

    return displayString;

  },
}

export default proposalScripts;
