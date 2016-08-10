/* @flow */

import {defn} from 'ud';
import Kefir from 'kefir';
import kefirStopper from 'kefir-stopper';

class InboxBackdrop {
  _stopper: Kefir.Stream<null>&{destroy():void} = kefirStopper();

  constructor(zIndex=500, target=document.body) {
    const el = document.createElement('div');
    el.className = 'inboxsdk__inbox_backdrop';
    el.style.zIndex = String(zIndex);
    el.addEventListener('click', () => {
      this.destroy();
    });
    target.appendChild(el);

    this._stopper.onValue(() => {
      el.classList.remove('inboxsdk__active');
      Kefir.fromEvents(el, 'transitionend')
        .merge(Kefir.later(200)) // transition might not finish if element is hidden
        .take(1)
        .onValue(() => {
          el.remove();
        });
    });

    el.offsetHeight; // force layout so that adding this class does a transition.
    el.classList.add('inboxsdk__active');
  }

  getStopper(): Kefir.Stream<null> {
    return this._stopper;
  }

  destroy() {
    this._stopper.destroy();
  }
}

export default defn(module, InboxBackdrop);