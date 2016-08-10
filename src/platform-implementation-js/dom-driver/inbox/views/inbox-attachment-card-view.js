/* @flow */

import _ from 'lodash';
import {defn} from 'ud';
import autoHtml from 'auto-html';
import Kefir from 'kefir';
import kefirBus from 'kefir-bus';
import kefirStopper from 'kefir-stopper';
import type InboxDriver from '../inbox-driver';

class InboxAttachmentCardView {
  _stopper = kefirStopper();
  _previewClicks = Kefir.pool();
  _element: HTMLElement;
  _driver: InboxDriver;

  constructor(options, driver: InboxDriver) {
    this._driver = driver;
    if (options.element) {
      throw new Error('not implemented yet');
    } else {
      this._createNewElement(options);
    }
  }

  destroy() {
    this._stopper.destroy();
  }

  _createNewElement(options) {
    if (options.previewUrl) {
      this._element = document.createElement('a');
      this._element.href = options.previewUrl;
    } else {
      this._element = document.createElement('div');
      this._element.tabIndex = 0;
    }
    this._element.title = options.title;

    const setupInnerHtml = options => {
      if (options.previewThumbnailUrl) {
        this._element.className = 'inboxsdk__attachment_card inboxsdk__attachment_card_with_preview';
        this._element.innerHTML = autoHtml `
          <img alt="" aria-hidden="true"
            style="width: 100%"
            src="${options.previewThumbnailUrl}"
            >
          <div class="inboxsdk__attachment_card_hover_overlay">
            <div class="inboxsdk__attachment_card_title">${options.title}</div>
            <div class="inboxsdk__attachment_card_buttons"></div>
          </div>
        `;
        if (options.failoverPreviewIconUrl) {
          Kefir.fromEvents(this._element.querySelector('img'), 'error')
            .take(1)
            .takeUntilBy(this._stopper)
            .onValue(() => {
              setupInnerHtml({
                ...options,
                previewThumbnailUrl: null,
                iconThumbnailUrl: options.failoverPreviewIconUrl
              });
            });
        }
      } else {
        this._element.className = 'inboxsdk__attachment_card';
        this._element.innerHTML = autoHtml `
          <div class="inboxsdk__attachment_card_nohover">
            <div class="inboxsdk__attachment_card_title">${options.title}</div>
            <div class="inboxsdk__attachment_card_description">
              <img alt="" aria-hidden="true" src="${options.fileIconImageUrl}">
              <span>${options.description || ''}</span>
            </div>
          </div>
          <div class="inboxsdk__attachment_card_hover_overlay">
            <div class="inboxsdk__attachment_card_title">${options.title}</div>
            <div class="inboxsdk__attachment_card_buttons"></div>
          </div>
        `;
      }

      const buttonContainer = this._element.querySelector('.inboxsdk__attachment_card_buttons');
      options.buttons.forEach(button => {
        const el = document.createElement('button');
        el.className = 'inboxsdk__attachment_card_button';
        if (button.downloadUrl) {
          el.setAttribute('data-inboxsdk-download-url', button.downloadUrl);
          (el:any).addEventListener('click', event => {
            event.stopPropagation();
            event.preventDefault();
            let prevented = false;
            if (button.onClick) {
              button.onClick({
                preventDefault() {
                  prevented = true;
                }
              });
            }
            if (prevented) return;
            const downloadLink = document.createElement('a');
            downloadLink.href = button.downloadUrl;
            (downloadLink:any).addEventListener('click', function(e) {
              e.stopPropagation();
            }, true);
            if (button.openInNewTab) {
              downloadLink.setAttribute('target', '_blank');
            }
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
          });
          el.innerHTML = `
            <div style="background: no-repeat url(https://ssl.gstatic.com/mail/sprites/newattachmentcards-ff2ce2bea04dec2bf32f2ebbfa0834ff.png) -219px -129px"></div>
          `;
        } else {
          (el:any).addEventListener('click', event => {
            event.stopPropagation();
            event.preventDefault();
            if (button.onClick) {
              button.onClick();
            }
          });
          el.innerHTML = autoHtml `
            <img src="${button.iconUrl}">
          `;
          el.title = button.tooltip;
        }
        buttonContainer.appendChild(el);
      });
    };
    setupInnerHtml(options);
    this._previewClicks.plug(
      Kefir.merge([
        Kefir.fromEvents(this._element, 'click'),
        Kefir.fromEvents(this._element, 'keypress').filter(e => _.includes([32/*space*/, 13/*enter*/], e.which))
      ])
    );
  }

  getElement() {
    return this._element;
  }

  getMessageViewDriver() {
    return null;
  }

  getStopper(): Kefir.Stream<null> {
    return this._stopper;
  }

  getPreviewClicks(): Kefir.Stream<Event> {
    return this._previewClicks.takeUntilBy(this._stopper);
  }

  getAttachmentType(): string {
    throw new Error('not implemented yet');
  }

  addButton(options: Object): void {
    throw new Error('not implemented yet');
  }

  getTitle(): string {
    return this._element.title;
  }

  async getDownloadURL(): Promise<?string> {
    throw new Error('not implemented yet');
  }
}

export default defn(module, InboxAttachmentCardView);