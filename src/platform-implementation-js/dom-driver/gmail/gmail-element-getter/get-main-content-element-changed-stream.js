var _ = require('lodash');
var Bacon = require('baconjs');

var streamWaitFor = require('../../../lib/stream-wait-for');
var makeMutationObserverStream = require('../../../lib/dom/make-mutation-observer-stream');

import makeElementChildStream from '../../../lib/dom/make-element-child-stream';

export default function getMainContentElementChangedStream(GmailElementGetter, onlyChanges=false){
	return waitForMainContentContainer(GmailElementGetter)
				.flatMap(mainContentContainer => {
					return makeElementChildStream(mainContentContainer)
							.map(({el}) => el)
							.filter(el => el.classList.contains('nH'))
							.flatMap(el => {
								let stream = makeMutationObserverStream(el, {attributes: true, attributeFilter: ['role'], attributeOldValue: true});
								if (!onlyChanges) {
									stream = stream.toProperty({
										oldValue: null,
										target: el
									});
								}
								return stream
									.filter(_isNowMain)
									.map('.target');
							});

				});
}

function waitForMainContentContainer(GmailElementGetter){
	return streamWaitFor(() => GmailElementGetter.getMainContentContainer());
}

function _isNowMain(mutation){
	const oldValue = mutation.oldValue;
	const newValue = mutation.target.getAttribute('role');

	return (!oldValue && newValue === 'main');
}
