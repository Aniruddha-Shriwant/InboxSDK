/* @flow */

import Kefir from 'kefir';
import fromEventTargetCapture from '../../lib/from-event-target-capture';

const SELECTION_MASTER_ATTR = 'data-inboxsdk-selection-master-claimed';

const hasNativeResults = (resultsEl: HTMLElement) => (
  resultsEl.querySelectorAll(
    'li:not(.inboxsdk__search_suggestion)'
  ).length > 0
);

const getSelectedNativeResult = (resultsEl: HTMLElement) => {
  const nativeResults = resultsEl.querySelectorAll('li:not(.inboxsdk__search_suggestion)');

  // Unfortunately there are no distinguishable features of a selected
  // native result besides its background color... (ಥ﹏ಥ)
  return Array.from(nativeResults).find(result => {
    const {backgroundColor}: {backgroundColor: string} = getComputedStyle(result);

    const colorValues = backgroundColor.match(/([\d.]+)/g);

    return colorValues && parseFloat(colorValues[3]) > 0;
  });
};

const selectFirstCustomResult = (resultsEl: HTMLElement) => {
  const firstCustomResult = resultsEl.querySelector(
    '.inboxsdk__search_suggestion_group:first-of-type > ' +
    '.inboxsdk__search_suggestion:first-child'
  );

  firstCustomResult && firstCustomResult.classList.add('inboxsdk__selected');
};

const setupCustomResultHoverListeners = (resultsEl, resultsElRemovalStream) => {
  Kefir.fromEvents(resultsEl, 'mouseover')
    .takeUntilBy(resultsElRemovalStream)
    .map(({target}: {target: HTMLElement}) => (
      target.closest('.inboxsdk__search_suggestion:not(.inboxsdk__selected)')
    )).filter(Boolean).onValue(el => {
      const customResults = resultsEl.querySelectorAll(
        '.inboxsdk__search_suggestion.inboxsdk__selected'
      );

      // Needed to ensure custom results selected via keyboard events
      // have their selected state removed (since no mouseout event fires).
      Array.from(customResults).forEach((result) => (
        result.classList.remove('inboxsdk__selected')
      ));

      el.classList.add('inboxsdk__selected');
    });

  Kefir.fromEvents(resultsEl, 'mouseout')
    .takeUntilBy(resultsElRemovalStream)
    .map(({target}: {target: HTMLElement}) => (
      target.closest('.inboxsdk__search_suggestion.inboxsdk__selected')
    )).filter(Boolean).onValue(el => el.classList.remove('inboxsdk__selected'));
};

export default function setupCustomAutocompleteSelectionHandling({
  resultsEl,
  resultsElRemovalStream,
  searchInput
}: {
  resultsEl: HTMLElement,
  resultsElRemovalStream: Kefir.Observable<any>,
  searchInput: HTMLInputElement
}): void {
  if (resultsEl.hasAttribute(SELECTION_MASTER_ATTR)) {
    return;
  }

  resultsEl.setAttribute(SELECTION_MASTER_ATTR, 'true');

  // We need to be able to cancel up/down arrow events before Inbox gets them,
  // but we only want to listen for events that happen while the search box
  // is in focus (since that's when up/down arrows manipulate selection).
  // As a result, we need to grab the search box's parent element so we can
  // capture and cancel events prior to Inbox's listeners (and our own).
  const searchInputParent = searchInput.parentElement;
  if (!searchInputParent) { throw new Error(); }

  const keyboardEvents: Kefir.Observable<KeyboardEvent> = fromEventTargetCapture(
    searchInputParent,
    'keydown'
  ).takeUntilBy(resultsElRemovalStream);

  const upArrowPresses = keyboardEvents.filter(({keyCode}) => keyCode === 38);
  const downArrowPresses = keyboardEvents.filter(({keyCode}) => keyCode === 40);
  const enterPresses = keyboardEvents.filter(({keyCode}) => keyCode === 13);

  upArrowPresses.onValue(event => {
    const selectedNativeResult = getSelectedNativeResult(resultsEl);
    const selectedCustomResult = resultsEl.querySelector(
      '.inboxsdk__search_suggestion.inboxsdk__selected'
    );
    const customResultGroup = selectedCustomResult && selectedCustomResult.closest(
      '.inboxsdk__search_suggestion_group'
    );

    if (selectedNativeResult) {
      return;
    }

    if (
      selectedCustomResult &&
      customResultGroup &&
      selectedCustomResult.matches(':first-child') &&
      customResultGroup.matches(':first-of-type')
    ) {
      // If there are native results, Inbox will automatically select
      // the last one when it sees this up arrow press, so all we need to do
      // is remove the highlighting from our result. If there *aren't* any
      // native results, then nothing will be selected, which is consistent
      // with native behavior (hitting the up arrow with the first item selected
      // leaves *nothing* selected).
      selectedCustomResult.classList.remove('inboxsdk__selected');
    } else if (!(selectedNativeResult || selectedCustomResult)) {
      // TODO make sure to only do this when there are custom results,
      // right now it breaks with only native.
      event.stopPropagation();

      const lastCustomResult = resultsEl.querySelector(
        '.inboxsdk__search_suggestion_group:last-of-type > ' +
        '.inboxsdk__search_suggestion:last-child'
      );

      lastCustomResult && lastCustomResult.classList.add('inboxsdk__selected');
    } else if (selectedCustomResult && customResultGroup) {
      event.stopPropagation();
      selectedCustomResult.classList.remove('inboxsdk__selected');

      if (selectedCustomResult.matches(':first-child')) {
        const previousResultGroup = customResultGroup.previousElementSibling;
        const customResultToSelect = previousResultGroup && previousResultGroup
          .querySelector('.inboxsdk__search_suggestion:last-child');

        customResultToSelect && customResultToSelect
          .classList.add('inboxsdk__selected');
      } else {
        const previousCustomResult = selectedCustomResult.previousElementSibling;
        previousCustomResult && previousCustomResult
          .classList.add('inboxsdk__selected');
      }
    }
  });

  downArrowPresses.onValue(event => {
    const selectedNativeResult = getSelectedNativeResult(resultsEl);
    const selectedCustomResult = resultsEl.querySelector(
      '.inboxsdk__search_suggestion.inboxsdk__selected'
    );
    const customResultGroup = selectedCustomResult && selectedCustomResult.closest(
      '.inboxsdk__search_suggestion_group'
    );

    if (selectedNativeResult && !selectedNativeResult.matches(':last-of-type')) {
      return;
    }

    if (selectedNativeResult && selectedNativeResult.matches(':last-of-type')) {
      selectFirstCustomResult(resultsEl);
    } else if (
      selectedCustomResult &&
      customResultGroup &&
      selectedCustomResult.matches(':last-child') &&
      customResultGroup.matches(':last-of-type')
    ) {
      // Inbox's native behavior is to leave nothing selected when you hit
      // the down arrow while the last item is selected, so we don't
      // try to select any other results if the last custom result is currently
      // selected.
      event.stopPropagation();
      selectedCustomResult.classList.remove('inboxsdk__selected');
    } else if (!(selectedNativeResult || selectedCustomResult)) {
      // Inbox will automatically select the first native result if
      // one exists.
      if (hasNativeResults(resultsEl)) {
        return;
      }

      selectFirstCustomResult(resultsEl);
    } else if (selectedCustomResult && customResultGroup) {
      event.stopPropagation();
      selectedCustomResult.classList.remove('inboxsdk__selected');

      if (selectedCustomResult.matches(':last-child')) {
        const nextResultGroup = customResultGroup.nextElementSibling;
        const customResultToSelect = nextResultGroup && nextResultGroup
          .querySelector('.inboxsdk__search_suggestion:first-child');

        customResultToSelect && customResultToSelect
          .classList.add('inboxsdk__selected');
      } else {
        const nextCustomResult = selectedCustomResult.nextElementSibling;
        nextCustomResult && nextCustomResult
          .classList.add('inboxsdk__selected');
      }
    }
  });

  enterPresses.onValue(event => {
    const selectedCustomResult = resultsEl.querySelector(
      '.inboxsdk__search_suggestion.inboxsdk__selected'
    );

    // If the user hits enter and has a custom result selected, we want to
    // trigger the custom result's action *but* avoid letting the native
    // behavior (hiding `resultsEl`) happen.
    if (selectedCustomResult) {
      event.stopPropagation();

      selectedCustomResult.dispatchEvent(new MouseEvent('click'));
    }
  });

  keyboardEvents.onEnd(() => resultsEl.removeAttribute(SELECTION_MASTER_ATTR));

  setupCustomResultHoverListeners(resultsEl, resultsElRemovalStream)
}
