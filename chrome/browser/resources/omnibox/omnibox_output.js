// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('omnibox_output', function() {
  /**
   * Details how to display an autocomplete result data field.
   * @typedef {{
   *   header: string,
   *   url: string,
   *   propertyName: string,
   *   displayAlways: boolean,
   *   tooltip: string,
   * }}
   */
  let PresentationInfoRecord;

  /**
   * A constant that's used to decide what autocomplete result
   * properties to output in what order.
   * @type {!Array<!PresentationInfoRecord>}
   */
  const PROPERTY_OUTPUT_ORDER = [
    {
      header: 'Provider',
      url: '',
      propertyName: 'providerName',
      displayAlways: true,
      tooltip: 'The AutocompleteProvider suggesting this result.'
    },
    {
      header: 'Type',
      url: '',
      propertyName: 'type',
      displayAlways: true,
      tooltip: 'The type of the result.'
    },
    {
      header: 'Relevance',
      url: '',
      propertyName: 'relevance',
      displayAlways: true,
      tooltip: 'The result score. Higher is more relevant.'
    },
    {
      header: 'Contents',
      url: '',
      propertyName: 'contents',
      displayAlways: true,
      tooltip: 'The text that is presented identifying the result.'
    },
    {
      header: 'CanBeDefault',
      url: '',
      propertyName: 'allowedToBeDefaultMatch',
      displayAlways: false,
      tooltip:
          'A green checkmark indicates that the result can be the default ' +
          'match(i.e., can be the match that pressing enter in the omnibox' +
          'navigates to).'
    },
    {
      header: 'Starred',
      url: '',
      propertyName: 'starred',
      displayAlways: false,
      tooltip:
          'A green checkmark indicates that the result has been bookmarked.'
    },
    {
      header: 'Hastabmatch',
      url: '',
      propertyName: 'hasTabMatch',
      displayAlways: false,
      tooltip:
          'A green checkmark indicates that the result URL matches an open' +
          'tab.'
    },
    {
      header: 'Description',
      url: '',
      propertyName: 'description',
      displayAlways: false,
      tooltip: 'The page title of the result.'
    },
    {
      header: 'URL',
      url: '',
      propertyName: 'destinationUrl',
      displayAlways: true,
      tooltip: 'The URL for the result.'
    },
    {
      header: 'FillIntoEdit',
      url: '',
      propertyName: 'fillIntoEdit',
      displayAlways: false,
      tooltip: 'The text shown in the omnibox when the result is selected.'
    },
    {
      header: 'InlineAutocompletion',
      url: '',
      propertyName: 'inlineAutocompletion',
      displayAlways: false,
      tooltip: 'The text shown in the omnibox as a blue highlight selection ' +
          'following the cursor, if this match is shown inline.'
    },
    {
      header: 'Del',
      url: '',
      propertyName: 'deletable',
      displayAlways: false,
      tooltip:
          'A green checkmark indicates that the result can be deleted from ' +
          'the visit history.'
    },
    {
      header: 'Prev',
      url: '',
      propertyName: 'fromPrevious',
      displayAlways: false,
      tooltip: ''
    },
    {
      header: 'Tran',
      url:
          'https://cs.chromium.org/chromium/src/ui/base/page_transition_types.h?q=page_transition_types.h&sq=package:chromium&dr=CSs&l=14',
      propertyName: 'transition',
      displayAlways: false,
      tooltip: 'How the user got to the result.'
    },
    {
      header: 'Done',
      url: '',
      propertyName: 'providerDone',
      displayAlways: false,
      tooltip:
          'A green checkmark indicates that the provider is done looking ' +
          'for more results.'
    },
    {
      header: 'AssociatedKeyword',
      url: '',
      propertyName: 'associatedKeyword',
      displayAlways: false,
      tooltip: 'If non-empty, a "press tab to search" hint will be shown and ' +
          'will engage this keyword.'
    },
    {
      header: 'Keyword',
      url: '',
      propertyName: 'keyword',
      displayAlways: false,
      tooltip: 'The keyword of the search engine to be used.'
    },
    {
      header: 'Duplicates',
      url: '',
      propertyName: 'duplicates',
      displayAlways: false,
      tooltip: 'The number of matches that have been marked as duplicates of ' +
          'this match..'
    },
    {
      header: 'AdditionalInfo',
      url: '',
      propertyName: 'additionalInfo',
      displayAlways: false,
      tooltip: 'Provider-specific information about the result.'
    }
  ];

  /**
   * In addition to representing the rendered HTML element, OmniboxOutput also
   * provides a single public interface to interact with the output:
   * 1. Render tables from responses  (RenderDelegate)
   * 2. Control visibility based on display options (TODO)
   * 3. Control visibility and coloring based on search text (TODO)
   * 4. Export and copy output (CopyDelegate)
   * 5. Preserve inputs and reset inputs to default (TODO)
   * 6. Export and import inputs (TODO)
   * With regards to interacting with RenderDelegate, OmniboxOutput tracks and
   * aggregates responses from the C++ autocomplete controller. Typically, the
   * C++ controller returns 3 sets of results per query, unless a new query is
   * submitted before all 3 responses. OmniboxController also triggers
   * appending to and clearing of OmniboxOutput when appropriate (e.g., upon
   * receiving a new response or a change in display inputs).
   */
  class OmniboxOutput extends OmniboxElement {
    /** @return {string} */
    static get is() {
      return 'omnibox-output';
    }

    constructor() {
      super('omnibox-output-template');

      /** @type {RenderDelegate} */
      this.renderDelegate = new RenderDelegate(this.$$('contents'));
      /** @type {CopyDelegate} */
      this.copyDelegate = new CopyDelegate(this);

      /** @type {!Array<!mojom.OmniboxResult>} */
      this.responses = [];
      /** @private {QueryInputs} */
      this.queryInputs_ = /** @type {QueryInputs} */ ({});
      /** @private {DisplayInputs} */
      this.displayInputs_ = /** @type {DisplayInputs} */ ({});
    }

    /** @param {QueryInputs} queryInputs */
    updateQueryInputs(queryInputs) {
      this.queryInputs_ = queryInputs;
      this.refresh_();
    }

    /** @param {DisplayInputs} displayInputs */
    updateDisplayInputs(displayInputs) {
      this.displayInputs_ = displayInputs;
      this.refresh_();
    }

    clearAutocompleteResponses() {
      this.responses = [];
      this.refresh_();
    }

    /** @param {!mojom.OmniboxResult} response */
    addAutocompleteResponse(response) {
      this.responses.push(response);
      this.refresh_();
    }

    /** @private */
    refresh_() {
      this.renderDelegate.refresh(
          this.queryInputs_, this.responses, this.displayInputs_);
    }
  }

  // Responsible for rendering the output HTML.
  class RenderDelegate {
    /** @param {Element} containerElement */
    constructor(containerElement) {
      this.containerElement = containerElement;
    }

    /**
     * @param {QueryInputs} queryInputs
     * @param {!Array<!mojom.OmniboxResult>} responses
     * @param {DisplayInputs} displayInputs
     */
    refresh(queryInputs, responses, displayInputs) {
      this.clearOutput_();
      if (responses.length) {
        if (displayInputs.showIncompleteResults) {
          responses.forEach(
              response => this.addOutputResultsGroup_(
                  response, queryInputs, displayInputs));
        } else {
          this.addOutputResultsGroup_(
              responses[responses.length - 1], queryInputs, displayInputs);
        }
      }
    }

    /**
     * @private
     * @param {!mojom.OmniboxResult} response
     * @param {QueryInputs} queryInputs
     * @param {DisplayInputs} displayInputs
     */
    addOutputResultsGroup_(response, queryInputs, displayInputs) {
      this.containerElement.appendChild(
          new OutputResultsGroup(response, queryInputs.cursorPosition)
              .render(
                  displayInputs.showDetails,
                  displayInputs.showIncompleteResults,
                  displayInputs.showAllProviders));
    }

    /** @private */
    clearOutput_() {
      let contents = this.containerElement;
      // Clears all children.
      while (contents.firstChild)
        contents.removeChild(contents.firstChild);
    }

    /** @return {string} */
    get visibletableText() {
      return this.containerElement.innerText;
    }
  }

  /**
   * Helps track and render a results group. C++ Autocomplete typically returns
   * 3 result groups per query. It may return less if the next query is
   * submitted before all 3 have been returned. Each result group contains
   * top level information (e.g., how long the result took to generate), as well
   * as a single list of combined results and multiple lists of individual
   * results. Each of these lists is tracked and rendered by OutputResultsTable
   * below.
   */
  class OutputResultsGroup {
    /**
     * @param {!mojom.OmniboxResult} resultsGroup
     * @param {number} cursorPosition
     */
    constructor(resultsGroup, cursorPosition) {
      /** @struct */
      this.details = {
        cursorPosition,
        time: resultsGroup.timeSinceOmniboxStartedMs,
        done: resultsGroup.done,
        host: resultsGroup.host,
        isTypedHost: resultsGroup.isTypedHost
      };
      /** @type {OutputResultsTable} */
      this.combinedResults =
          new OutputResultsTable(resultsGroup.combinedResults);
      /** @type {Array<OutputResultsTable>} */
      this.individualResultsList =
          resultsGroup.resultsByProvider
              .map(resultsWrapper => resultsWrapper.results)
              .filter(results => results.length > 0)
              .map(results => new OutputResultsTable(results));
    }

    /**
     * Creates a HTML Node representing this data.
     * @param {boolean} showDetails
     * @param {boolean} showIncompleteResults
     * @param {boolean} showAllProviders
     * @return {Element}
     */
    render(showDetails, showIncompleteResults, showAllProviders) {
      const resultsGroupNode =
          OmniboxElement.getTemplate('results-group-template');
      if (showDetails || showIncompleteResults) {
        resultsGroupNode.querySelector('.details')
            .appendChild(this.renderDetails_());
      }
      resultsGroupNode.querySelector('.combined-results')
          .appendChild(this.combinedResults.render(showDetails));
      if (showAllProviders) {
        resultsGroupNode.querySelector('.individual-results')
            .appendChild(this.renderIndividualResults_(showDetails));
      }
      return resultsGroupNode;
    }

    /**
     * @private
     * @return {Element}
     */
    renderDetails_() {
      const details =
          OmniboxElement.getTemplate('results-group-details-template');
      details.querySelector('.cursor-position').textContent =
          this.details.cursorPosition;
      details.querySelector('.time').textContent = this.details.time;
      details.querySelector('.done').textContent = this.details.done;
      details.querySelector('.host').textContent = this.details.host;
      details.querySelector('.is-typed-host').textContent =
          this.details.isTypedHost;
      return details;
    }

    /**
     * @private
     * @param {boolean} showDetails
     * @return {Element}
     */
    renderIndividualResults_(showDetails) {
      const individualResultsNode = OmniboxElement.getTemplate(
          'results-group-individual-results-template');
      this.individualResultsList.forEach(
          individualResults => individualResultsNode.appendChild(
              individualResults.render(showDetails)));
      return individualResultsNode;
    }
  }

  /**
   * Helps track and render a list of results. Each result is tracked and
   * rendered by OutputMatch below.
   */
  class OutputResultsTable {
    /** @param {Array<!mojom.AutocompleteMatch>} results */
    constructor(results) {
      /** @type {Array<OutputMatch>} */
      this.matches = results.map(match => new OutputMatch(match));
    }

    /**
     * Creates a HTML Node representing this data.
     * @param {boolean} showDetails
     * @return {Element}
     */
    render(showDetails) {
      const resultsTable = OmniboxElement.getTemplate('results-table-template');
      // The additional properties column only needs be displayed if at least
      // one of the results have additional properties.
      const showAdditionalPropertiesHeader = this.matches.some(
          match => match.showAdditionalProperties(showDetails));
      resultsTable.querySelector('.results-table-body')
          .appendChild(OutputMatch.renderHeader_(
              showDetails, showAdditionalPropertiesHeader));
      this.matches.forEach(
          match => resultsTable.querySelector('.results-table-body')
                       .appendChild(match.render(showDetails)));
      return resultsTable;
    }
  }

  /** Helps track and render a single match. */
  class OutputMatch {
    /** @param {!mojom.AutocompleteMatch} match */
    constructor(match) {
      /** @dict */
      this.properties = {};
      /** @dict */
      this.additionalProperties = {};
      Object.entries(match).forEach(propertyNameValueTuple => {
        // TODO(manukh) replace with destructuring when the styleguide is
        // updated
        // https://chromium-review.googlesource.com/c/chromium/src/+/1271915
        const propertyName = propertyNameValueTuple[0];
        const propertyValue = propertyNameValueTuple[1];

        if (PROPERTY_OUTPUT_ORDER.some(
                displayProperty =>
                    displayProperty.propertyName === propertyName)) {
          this.properties[propertyName] = propertyValue;
        } else {
          this.additionalProperties[propertyName] = propertyValue;
        }
      });
    }

    /**
     * Creates a HTML Node representing this data.
     * @param {boolean} showDetails
     * @return {Element}
     */
    render(showDetails) {
      const row = document.createElement('tr');
      OutputMatch.displayedProperties(showDetails)
          .map(property => {
            const value = this.properties[property.propertyName];
            if (typeof value === 'object')
              return OutputMatch.renderJsonProperty_(value);
            if (typeof value === 'boolean')
              return OutputMatch.renderBooleanProperty_(value);
            const LINK_REGEX = /^(http|https|ftp|chrome|file):\/\//;
            if (LINK_REGEX.test(value))
              return OutputMatch.renderLinkProperty_(value);
            return OutputMatch.renderTextProperty_(value);
          })
          .forEach(cell => row.appendChild(cell));

      if (this.showAdditionalProperties(showDetails)) {
        row.appendChild(
            OutputMatch.renderJsonProperty_(this.additionalProperties));
      }
      return row;
    }

    /**
     * TODO(manukh) replace these static render_ functions with subclasses when
     * rendering becomes more substantial
     * @private
     * @param {string} propertyValue
     * @return {Element}
     */
    static renderTextProperty_(propertyValue) {
      const cell = document.createElement('td');
      cell.textContent = propertyValue;
      return cell;
    }

    /**
     * @private
     * @param {Object} propertyValue
     * @return {Element}
     */
    static renderJsonProperty_(propertyValue) {
      const cell = document.createElement('td');
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(propertyValue, null, 2);
      cell.appendChild(pre);
      return cell;
    }

    /**
     * @private
     * @param {boolean} propertyValue
     * @return {Element}
     */
    static renderBooleanProperty_(propertyValue) {
      const cell = document.createElement('td');
      const icon = document.createElement('div');
      icon.className = propertyValue ? 'check-mark' : 'x-mark';
      icon.textContent = propertyValue;
      cell.appendChild(icon);
      return cell;
    }

    /**
     * @private
     * @param {string} propertyValue
     * @return {Element}
     */
    static renderLinkProperty_(propertyValue) {
      let cell = document.createElement('td');
      let link = document.createElement('a');
      link.textContent = propertyValue;
      link.href = propertyValue;
      cell.appendChild(link);
      return cell;
    }

    /**
     * @private
     * @param {boolean} showDetails
     * @param {boolean} showAdditionalHeader
     * @return {Element}
     */
    static renderHeader_(showDetails, showAdditionalHeader) {
      const row = document.createElement('tr');
      const headerCells =
          OutputMatch.displayedProperties(showDetails)
              .map(
                  displayProperty => OutputMatch.renderHeaderCell_(
                      displayProperty.header, displayProperty.url,
                      displayProperty.tooltip));
      if (showAdditionalHeader) {
        headerCells.push(
            OutputMatch.renderHeaderCell_('Additional Properties'));
      }
      headerCells.forEach(headerCell => row.appendChild(headerCell));
      return row;
    }

    /**
     * @private
     * @param {string} name
     * @param {string=} url
     * @param {string=} tooltip
     * @return {Element}
     */
    static renderHeaderCell_(name, url, tooltip) {
      const cell = document.createElement('th');
      if (url) {
        const link = document.createElement('a');
        link.textContent = name;
        link.href = url;
        cell.appendChild(link);
      } else {
        cell.textContent = name;
      }
      cell.title = tooltip || '';
      return cell;
    }

    /**
     * @return {Array<PresentationInfoRecord>} Array representing which columns
     * need to be displayed.
     */
    static displayedProperties(showDetails) {
      return showDetails ?
          PROPERTY_OUTPUT_ORDER :
          PROPERTY_OUTPUT_ORDER.filter(property => property.displayAlways);
    }

    /**
     * @return {boolean} True if the additional properties column is required
     * to be displayed for this result. False if the column can be hidden
     * because this result does not have additional properties.
     */
    showAdditionalProperties(showDetails) {
      return showDetails && Object.keys(this.additionalProperties).length;
    }
  }

  /** Responsible for setting clipboard contents. */
  class CopyDelegate {
    /** @param {omnibox_output.OmniboxOutput} omniboxOutput */
    constructor(omniboxOutput) {
      /** @type {omnibox_output.OmniboxOutput} */
      this.omniboxOutput = omniboxOutput;
    }

    copyTextOutput() {
      this.copy_(this.omniboxOutput.renderDelegate.visibletableText);
    }

    copyJsonOutput() {
      this.copy_(JSON.stringify(this.omniboxOutput.responses, null, 2));
    }

    /**
     * @private
     * @param {string} value
     */
    copy_(value) {
      navigator.clipboard.writeText(value).catch(
          error => console.error('unable to copy to clipboard:', error));
    }
  }

  window.customElements.define(OmniboxOutput.is, OmniboxOutput);

  return {OmniboxOutput: OmniboxOutput};
});
