/**
 * Image viewer component
 * @module components/slideshow/slideshow
 */
 
import dialogHelper from '../dialogHelper/dialogHelper';
import inputManager from '../../scripts/inputManager';
import layoutManager from '../layoutManager';
import focusManager from '../focusManager';
import browser from '../../scripts/browser';
import { appHost } from '../apphost';
import dom from '../../scripts/dom';
import './style.scss';
import 'material-design-icons-iconfont';
import '../../elements/emby-button/paper-icon-button-light';
import ServerConnections from '../ServerConnections';
// eslint-disable-next-line import/named, import/namespace
import { Swiper } from 'swiper/swiper-bundle.esm';
import 'swiper/swiper-bundle.css';
import screenfull from 'screenfull';
import * as userSettings from '../../scripts/settings/userSettings';

/**
 * Name of transition event.
 */
const transitionEndEventName = dom.whichTransitionEvent();

/**
 * Flag to use fake image to fix blurry zoomed image.
 * At least WebKit doesn't restore quality for zoomed images.
 */
const useFakeZoomImage = browser.safari;

/**
 * Retrieves an item's image URL from the API.
 * @param {object|string} item - Item used to generate the image URL.
 * @param {object} options - Options of the image.
 * @param {object} apiClient - API client instance used to retrieve the image.
 * @returns {null|string} URL of the item's image.
 */
function getImageUrl(item, options, apiClient) {
    options = options || {};
    options.type = options.type || 'Primary';

    if (typeof (item) === 'string') {
        return apiClient.getScaledImageUrl(item, options);
    }

    if (item.ImageTags && item.ImageTags[options.type]) {
        options.tag = item.ImageTags[options.type];
        return apiClient.getScaledImageUrl(item.Id, options);
    }

    if (options.type === 'Primary') {
        if (item.AlbumId && item.AlbumPrimaryImageTag) {
            options.tag = item.AlbumPrimaryImageTag;
            return apiClient.getScaledImageUrl(item.AlbumId, options);
        }
    }

    return null;
}

/**
 * Retrieves a backdrop's image URL from the API.
 * @param {object} item - Item used to generate the image URL.
 * @param {object} options - Options of the image.
 * @param {object} apiClient - API client instance used to retrieve the image.
 * @returns {null|string} URL of the item's backdrop.
 */
function getBackdropImageUrl(item, options, apiClient) {
    options = options || {};
    options.type = options.type || 'Backdrop';

    // If not resizing, get the original image
    if (!options.maxWidth && !options.width && !options.maxHeight && !options.height && !options.fillWidth && !options.fillHeight) {
        options.quality = 100;
    }

    if (item.BackdropImageTags && item.BackdropImageTags.length) {
        options.tag = item.BackdropImageTags[0];
        return apiClient.getScaledImageUrl(item.Id, options);
    }

    return null;
}

/**
 * Dispatches a request for an item's image to its respective handler.
 * @param {object} item - Item used to generate the image URL.
 * @returns {string} URL of the item's image.
 */
function getImgUrl(item, user) {
    const apiClient = ServerConnections.getApiClient(item.ServerId);
    const imageOptions = {};

    if (item.BackdropImageTags && item.BackdropImageTags.length) {
        return getBackdropImageUrl(item, imageOptions, apiClient);
    } else {
        if (item.MediaType === 'Photo' && user && user.Policy.EnableContentDownloading) {
            return apiClient.getItemDownloadUrl(item.Id);
        }
        imageOptions.type = 'Primary';
        return getImageUrl(item, imageOptions, apiClient);
    }
}

/**
 * Generates a button using the specified icon, classes and properties.
 * @param {string} icon - Name of the material icon on the button
 * @param {string} cssClass - CSS classes to assign to the button
 * @param {boolean} canFocus - Flag to set the tabindex attribute on the button to -1.
 * @param {boolean} autoFocus - Flag to set the autofocus attribute on the button.
 * @returns {string} The HTML markup of the button.
 */
function getIcon(icon, cssClass, canFocus, autoFocus) {
    const tabIndex = canFocus ? '' : ' tabindex="-1"';
    autoFocus = autoFocus ? ' autofocus' : '';
    return '<button is="paper-icon-button-light" class="autoSize ' + cssClass + '"' + tabIndex + autoFocus + '><span class="material-icons slideshowButtonIcon ' + icon + '"></span></button>';
}

/**
 * Sets the viewport meta tag to enable or disable scaling by the user.
 * @param {boolean} scalable - Flag to set the scalability of the viewport.
 */
function setUserScalable(scalable) {
    try {
        appHost.setUserScalable(scalable);
    } catch (err) {
        console.error('error in appHost.setUserScalable: ' + err);
    }
}

var swiperCount = 0;

export default function (options) {
    const self = this;
    /** Initialized instance of Swiper. */
    let swiperInstance;
	
    /** Initialized instance of the dialog containing the Swiper instance. */
    let dialog;
    /** Options of the slideshow components */
    let currentOptions;
    /** ID of the timeout used to hide the OSD. */
    let hideTimeout;
    /** Last coordinates of the mouse pointer. */
    let lastMouseMoveData;

    /**
     * Creates the HTML markup for the dialog and the OSD.
     * @param {Object} options - Options used to create the dialog and slideshow.
     */
    function createElements(options) {
        currentOptions = options;
		
        dialog = dialogHelper.createDialog({
            exitAnimationDuration: options.interactive ? 400 : 800,
            size: 'fullscreen',
            autoFocus: false,
            scrollY: false,
            exitAnimation: 'fadeout',
            removeOnClose: true
        });

        dialog.classList.add('slideshowDialog');

        let html = '';

        html += '<div class="slideshowSwiperContainer"><div class="swiper-wrapper"></div></div>';

        //if (options.interactive && !layoutManager.tv) {
		if (options.interactive) {
            const actionButtonsOnTop = layoutManager.mobile;

            html += getIcon('keyboard_arrow_left', 'btnSlideshowPrevious slideshowButton hide-mouse-idle-tv', false);
            html += getIcon('keyboard_arrow_right', 'btnSlideshowNext slideshowButton hide-mouse-idle-tv', false);

            html += '<div class="topActionButtons">';
            if (actionButtonsOnTop) {
                if (appHost.supports('filedownload') && options.user && options.user.Policy.EnableContentDownloading) {
                    html += getIcon('file_download', 'btnDownload slideshowButton', true);
                }
                if (appHost.supports('sharing')) {
                    html += getIcon('share', 'btnShare slideshowButton', true);
                }
                if (screenfull.isEnabled) {
                    html += getIcon('fullscreen', 'btnFullscreen', true);
                    html += getIcon('fullscreen_exit', 'btnFullscreenExit hide', true);
                }
				html += getIcon('rotate_left', 'btnRotateLeft', true);
				html += getIcon('rotate_right', 'btnRotateRight', true);
            }
            html += getIcon('close', 'slideshowButton btnSlideshowExit hide-mouse-idle-tv', false);
            html += '</div>';

            if (!actionButtonsOnTop) {
                html += '<div class="slideshowBottomBar hide">';

                html += getIcon('play_arrow', 'btnSlideshowPause slideshowButton', true, true);
                if (appHost.supports('filedownload') && options.user && options.user.Policy.EnableContentDownloading) {
                    html += getIcon('file_download', 'btnDownload slideshowButton', true);
                }
                if (appHost.supports('sharing')) {
                    html += getIcon('share', 'btnShare slideshowButton', true);
                }
                if (screenfull.isEnabled) {
                    html += getIcon('fullscreen', 'btnFullscreen', true);
                    html += getIcon('fullscreen_exit', 'btnFullscreenExit hide', true);
                }
				html += getIcon('rotate_left', 'btnRotateLeft', true);
				html += getIcon('rotate_right', 'btnRotateRight', true);
                html += '</div>';
            }
        } else {
            html += '<div class="slideshowImage"></div><h1 class="slideshowImageText"></h1>';
        }

        dialog.innerHTML = html;

        //if (options.interactive && !layoutManager.tv) {
		if (options.interactive) {
            dialog.querySelector('.btnSlideshowExit').addEventListener('click', function () {
                dialogHelper.close(dialog);
            });

            dialog.querySelector('.btnSlideshowPrevious')?.addEventListener('click', getClickHandler(null));
            dialog.querySelector('.btnSlideshowNext')?.addEventListener('click', getClickHandler(null));

            const btnPause = dialog.querySelector('.btnSlideshowPause');
            if (btnPause) {
                btnPause.addEventListener('click', getClickHandler(playPause));
            }

            const btnDownload = dialog.querySelector('.btnDownload');
            if (btnDownload) {
                 btnDownload.addEventListener('click', getClickHandler(download));
            }

            const btnShare = dialog.querySelector('.btnShare');
            if (btnShare) {
                 btnShare.addEventListener('click', getClickHandler(share));
            }

            const btnFullscreen = dialog.querySelector('.btnFullscreen');
            if (btnFullscreen) {
                btnFullscreen.addEventListener('click', getClickHandler(fullscreen)); 
            }

            const btnFullscreenExit = dialog.querySelector('.btnFullscreenExit');
            if (btnFullscreenExit) {
                btnFullscreenExit.addEventListener('click', getClickHandler(fullscreenExit));
            }

            if (screenfull.isEnabled) {
                screenfull.on('change', function () {
                    toggleFullscreenButtons(screenfull.isFullscreen);
                });
            }
			
			const btnRotateLeft = dialog.querySelector('.btnRotateLeft');
            if (btnRotateLeft) {
                btnRotateLeft.addEventListener('click', () => {rotateImage(false);});
            }
			
			const btnRotateRight = dialog.querySelector('.btnRotateRight');
            if (btnRotateRight) {
                btnRotateRight.addEventListener('click', () => {rotateImage(true);});
            }  
        }

        setUserScalable(true);

        dialogHelper.open(dialog).then(function () {
            setUserScalable(false);
        });

        inputManager.on(window, onInputCommand);
        /* eslint-disable-next-line compat/compat */
        document.addEventListener((window.PointerEvent ? 'pointermove' : 'mousemove'), onPointerMove);
		document.removeEventListener("keydown", onKeyDown);
		document.addEventListener("keydown", onKeyDown);
		
        dialog.addEventListener('close', onDialogClosed);

        loadSwiper(dialog, options);

        if (layoutManager.desktop) {
            const topActionButtons = dialog.querySelector('.topActionButtons');
            if (topActionButtons) topActionButtons.classList.add('hide');
        }

        const btnSlideshowPrevious = dialog.querySelector('.btnSlideshowPrevious');
        if (btnSlideshowPrevious) btnSlideshowPrevious.classList.add('hide');
        const btnSlideshowNext = dialog.querySelector('.btnSlideshowNext');
        if (btnSlideshowNext) btnSlideshowNext.classList.add('hide');
    }
	
	/* Added: Allow a 2D rotation of the active image using the up and down keys */
	/* of the keyboard or remote. */
	function onKeyDown(event) {
		const code = (event.keyCode || event.which || null);
		if (!code || event.repeat) {
			return;
		}
		// console.debug('Got a keydown type event, code: ' + code);
		switch(code) {
			case 38: // up arrow, rotation clockwise
				rotateImage(true);
				break;
			case 40: // down arrow, rotation anti-clockwise
				rotateImage(false);
				break;      
		} 
	}

	function getCurrentRotation(elm) {	
		if (elm === undefined) {
			return;
		}
		var st = window.getComputedStyle(elm, null);
		if (st === undefined) {
			//console.debug('No style computed yet; Using fallback value 0.');
			return 0;
		}
		var tr = st.getPropertyValue("-webkit-transform") ||
			 st.getPropertyValue("-moz-transform") ||
			 st.getPropertyValue("-ms-transform") ||
			 st.getPropertyValue("-o-transform") ||
			 st.getPropertyValue("transform") ||
			 undefined;

		if (tr === undefined) {
			//console.debug('No transform used yet; Using fallback value 0.');
			return 0;
		}
		
		// With rotate(30deg)...
		// matrix(0.866025, 0.5, -0.5, 0.866025, 0px, 0px)
		// console.debug('transform: ' + tr);
		// rotation matrix - http://en.wikipedia.org/wiki/Rotation_matrix

		var values = tr.split('trix(')[1];
		if (values === undefined) {
			return 0;
		}
		values = values.split(')')[0];
		if (values === undefined) {
			return 0;
		}
		values = values.split(',');
		const a = values[0];
		const b = values[1];
		//const c = values[2];
		//const d = values[3];

		if (a === undefined || b === undefined) {
			return 0;
		}
		var angle = Math.round(Math.atan2(b, a) * (180/Math.PI));
		//console.debug('Current: rotate(' + angle + 'deg)');
		return angle;
	}

	function rotateImage(clockwise) {
		// console.debug('Inside rotation handler');
		var _elms = document.getElementsByClassName('swiper-slide-img');
		
		for (let i = 0; i < _elms.length; i++) {
			if (_elms[i].parentElement === undefined ||
					_elms[i].parentElement.parentElement === undefined) {
				continue;
			}
			if ( _elms[i].parentElement.parentElement.classList.contains('swiper-slide-active')) {
				let _rrot = getCurrentRotation(_elms[i]);
				if (_rrot === undefined) {
					return;
				}
				clockwise === true ? _rrot += 90 : _rrot -= 90;
				_rrot %= 360;
				// console.debug('New: rotate(' + _rrot + 'deg)');
				_elms[i].style.transform = 'rotate(' + _rrot + 'deg)';
				return;
			}
		}
	}

    /**
     * Handles OSD changes when the autoplay is started.
     */
    function onAutoplayStart() {
        const btnSlideshowPause = dialog.querySelector('.btnSlideshowPause .material-icons');
        if (btnSlideshowPause) {
            btnSlideshowPause.classList.replace('play_arrow', 'pause');
        }
    }

    /**
     * Handles OSD changes when the autoplay is stopped.
     */
    function onAutoplayStop() {
        const btnSlideshowPause = dialog.querySelector('.btnSlideshowPause .material-icons');
        if (btnSlideshowPause) {
            btnSlideshowPause.classList.replace('pause', 'play_arrow');
        }
    }

    /**
     * Handles zoom changes.
     */
    function onZoomChange(swiper, scale, imageEl, slideEl) {
        const zoomImage = slideEl.querySelector('.swiper-zoom-fakeimg');

        if (zoomImage) {
            zoomImage.style.width = zoomImage.style.height = scale * 100 + '%';

            if (scale > 1) {
                if (zoomImage.classList.contains('swiper-zoom-fakeimg-hidden')) {
                    // Await for Swiper style changes
                    setTimeout(() => {
                        const callback = () => {
                            imageEl.removeEventListener(transitionEndEventName, callback);
                            zoomImage.classList.remove('swiper-zoom-fakeimg-hidden');
                        };

                        // Swiper set 'transition-duration: 300ms' for auto zoom
                        // and 'transition-duration: 0s' for touch zoom
                        const transitionDuration = parseFloat(imageEl.style.transitionDuration.replace(/[a-z]/i, ''));

                        if (transitionDuration > 0) {
                            imageEl.addEventListener(transitionEndEventName, callback);
                        } else {
                            callback();
                        }
                    }, 0);
                }
            } else {
                zoomImage.classList.add('swiper-zoom-fakeimg-hidden');
            }
        }
    }

    /**
     * Initializes the Swiper instance and binds the relevant events.
     * @param {HTMLElement} dialog - Element containing the dialog.
     * @param {Object} options - Options used to initialize the Swiper instance.
     */
    function loadSwiper(dialog, options) {
        let slides;
		let autoplayDelay;
        if (currentOptions.slides) {
            slides = currentOptions.slides;
        } else {
            slides = currentOptions.items;
        }

		if (options["autoplayDelay"] != null) 
			autoplayDelay = options["autoplayDelay"] * 1000;
		else
			autoplayDelay = userSettings.swiperDelay() * 1000;
		
		let parameters = {
            // Loop is disabled due to the virtual slides option not supporting it.
            loop: false,
            zoom: {
                minRatio: 1,
                toggle: true
            },
            keyboard: {
                enabled: true
            },
            preloadImages: true,
            slidesPerView: 1,
            slidesPerColumn: 1,
            initialSlide: options.startIndex || 0,
            speed: 1000,
            navigation: {
                nextEl: '.btnSlideshowNext',
                prevEl: '.btnSlideshowPrevious'
            },
            // Virtual slides reduce memory consumption for large libraries while allowing preloading of images;
            virtual: {
                slides: slides,
                cache: true,
                renderSlide: getSwiperSlideHtml,
                addSlidesBefore: 1,
                addSlidesAfter: 1
            },
			autoplay: { delay: autoplayDelay }
		};
		
		let swiperFX;
		if (options["swiperFX"] != null) 
			swiperFX = options["swiperFX"];
		else
			swiperFX = userSettings.swiperFX() || 'horizontal';

		if (swiperFX === 'any') {
			const FX = ['fade', 'flip', 'cube', 'coverflow', 'horizontal', 'vertical'];
			let rand = Math.floor(Math.random() * (FX.length + 1));
			swiperFX = FX[rand];
		}
		
		switch(swiperFX) {	
		
			case 'none':
				parameters.speed = 0;
				parameters.direction = 'horizontal';
				parameters.effect = 'slide';
				break;
				
			case 'fade':
			case 'flip':
			case 'cube':
			case 'coverflow':
				parameters.effect = swiperFX;
				break;
				
			case 'horizontal':
			case 'vertical':
			default: 
				parameters.direction = swiperFX === 'vertical'? 'vertical': 'horizontal';
				parameters.effect = 'slide';
				break;	
		}
			
		if (options.interactive)
			parameters.autoplay = false;
			
        swiperInstance = new Swiper(dialog.querySelector('.slideshowSwiperContainer'), parameters);

        swiperInstance.on('autoplayStart', onAutoplayStart);
        swiperInstance.on('autoplayStop', onAutoplayStop);

        if (useFakeZoomImage) {
            swiperInstance.on('zoomChange', onZoomChange);
        }
    }

    /**
     * Renders the HTML markup of a slide for an item or a slide.
     * @param {Object} item - The item used to render the slide.
     * @returns {string} The HTML markup of the slide.
     */
    function getSwiperSlideHtml(item) {
        if (currentOptions.slides) {
            return getSwiperSlideHtmlFromSlide(item);
        } else {
            return getSwiperSlideHtmlFromItem(item);
        }
    }

    /**
     * Renders the HTML markup of a slide for an item.
     * @param {Object} item - Item used to generate the slide.
     * @returns {string} The HTML markup of the slide.
     */
    function getSwiperSlideHtmlFromItem(item) {
        return getSwiperSlideHtmlFromSlide({
            originalImage: getImgUrl(item, currentOptions.user),
            Id: item.Id,
            ServerId: item.ServerId
        });
    }
		
    /**
     * Renders the HTML markup of a slide for a slide object.
     * @param {Object} item - Slide object used to generate the slide.
     * @returns {string} The HTML markup of the slide.
     */
    function getSwiperSlideHtmlFromSlide(item) {
        let html = '';
        html += '<div class="swiper-slide" data-original="' + item.originalImage + '" data-itemid="' + item.Id + '" data-serverid="' + item.ServerId + '">';
        html += '<div class="swiper-zoom-container">';
        if (useFakeZoomImage) {
            html += '<div id="swiper-fake-img" class="swiper-zoom-fakeimg swiper-zoom-fakeimg-hidden" style="background-image: url("' + item.originalImage + '")"></div>';
        }
		html += '<img src="' + item.originalImage + '" class="swiper-slide-img">';
		
        html += '</div>';
        if (item.title || item.subtitle) {
            html += '<div class="slideText">';
            html += '<div class="slideTextInner">';
            if (item.title) {
                html += '<h1 class="slideTitle">';
                html += item.title;
                html += '</h1>';
            }
            if (item.description) {
                html += '<div class="slideSubtitle">';
                html += item.description;
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        return html;
    }

    /**
     * Fetches the information of the currently displayed slide.
     * @returns {null|{itemId: string, shareUrl: string, serverId: string, url: string}} Object containing the information of the currently displayed slide.
     */
    function getCurrentImageInfo() {
        if (swiperInstance) {
            const slide = document.querySelector('.swiper-slide-active');

            if (slide) {
                return {
                    url: slide.getAttribute('data-original'),
                    shareUrl: slide.getAttribute('data-original'),
                    itemId: slide.getAttribute('data-itemid'),
                    serverId: slide.getAttribute('data-serverid')
                };
            }
            return null;
        } else {
            return null;
        }
    }

    /**
     * Starts a download for the currently displayed slide.
     */
    function download() {
        const imageInfo = getCurrentImageInfo(); 

        import('../../scripts/fileDownloader').then((fileDownloader) => {
            fileDownloader.download([imageInfo]);
        });
    }

    /**
     * Shares the currently displayed slide using the browser's built-in sharing feature.
     */
    function share() {
        const imageInfo = getCurrentImageInfo();

        navigator.share({
            url: imageInfo.shareUrl
        });
    }

    /**
     * Goes to fullscreen using screenfull plugin
     */
    function fullscreen() {
        if (!screenfull.isFullscreen) screenfull.request();
        toggleFullscreenButtons(true);
    }

    /**
     * Exits fullscreen using screenfull plugin
     */
    function fullscreenExit() {
        if (screenfull.isFullscreen) screenfull.exit();
        toggleFullscreenButtons(false);
    }

    /**
     * Updates the display of fullscreen buttons
     * @param {boolean} isFullscreen - Whether the wanted state of buttons is fullscreen or not
     */
    function toggleFullscreenButtons(isFullscreen) {
        const btnFullscreen = dialog.querySelector('.btnFullscreen');
        const btnFullscreenExit = dialog.querySelector('.btnFullscreenExit');
        if (btnFullscreen)
            btnFullscreen.classList.toggle('hide', isFullscreen);
        if (btnFullscreenExit)
            btnFullscreenExit.classList.toggle('hide', !isFullscreen);
    }

    /**
     * Starts the autoplay feature of the Swiper instance.
     */
    function play() {
        if (swiperInstance.autoplay) {
			let obj = {};
			obj.delay = userSettings.swiperDelay() * 1000;
			swiperInstance.params.autoplay = obj;
            swiperInstance.autoplay.start();
        }
    }

    /**
     * Pauses the autoplay feature of the Swiper instance;
     */
    function pause() {
        if (swiperInstance.autoplay) {
            swiperInstance.autoplay.stop();
        }
    }

    /**
     * Toggles the autoplay feature of the Swiper instance.
     */
    function playPause() {
        const paused = !dialog.querySelector('.btnSlideshowPause .material-icons').classList.contains('pause');
        if (paused) {
            play();
        } else {
            pause();
        }
    }

    /**
     * Closes the dialog and destroys the Swiper instance.
     */
    function onDialogClosed() {
        // Exits fullscreen
        fullscreenExit();

        const swiper = swiperInstance;
        if (swiper) {
			if (swiperCount) {
				--swiperCount;
			}
            swiper.destroy(true, true);
            swiperInstance = null;
        }

        inputManager.off(window, onInputCommand);
        /* eslint-disable-next-line compat/compat */
        document.removeEventListener((window.PointerEvent ? 'pointermove' : 'mousemove'), onPointerMove);
		document.removeEventListener("keydown", onKeyDown);
    }

   /**
     * Constructs click event handler.
     * @param {function|null|undefined} callback - Click event handler.
     */
    function getClickHandler(callback) {
        return (e) => {
            showOsd();
            callback?.(e);
        };
    }
	
    /**
     * Shows the OSD.
     */
    function showOsd() {
        const bottom = dialog.querySelector('.slideshowBottomBar');
        if (bottom) {
            slideToShow(bottom, 'down');
        }

        const topActionButtons = dialog.querySelector('.topActionButtons');
        if (topActionButtons) slideToShow(topActionButtons, 'up');

        const left = dialog.querySelector('.btnSlideshowPrevious');
        if (left) slideToShow(left, 'left');

        const right = dialog.querySelector('.btnSlideshowNext');
        if (right) slideToShow(right, 'right');

        startHideTimer();
    }

    /**
     * Hides the OSD.
     */
    function hideOsd() {
        const bottom = dialog.querySelector('.slideshowBottomBar');
        if (bottom) {
            slideToHide(bottom, 'down');
        }

        const topActionButtons = dialog.querySelector('.topActionButtons');
        if (topActionButtons) slideToHide(topActionButtons, 'up');

        const left = dialog.querySelector('.btnSlideshowPrevious');
        if (left) slideToHide(left, 'left');

        const right = dialog.querySelector('.btnSlideshowNext');
        if (right) slideToHide(right, 'right');
    }

    /**
     * Starts the timer used to automatically hide the OSD.
     */
    function startHideTimer() {
        stopHideTimer();
        hideTimeout = setTimeout(hideOsd, 3000);
    }

    /**
     * Stops the timer used to automatically hide the OSD.
     */
    function stopHideTimer() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    }

    /**
     *
     * @param {string} hiddenPosition - Position of the hidden element compared to when it's visible ('down', 'up', 'left', 'right')
     * @param {*} fadingOut - Whether it is fading out or in
     * @param {HTMLElement} element - Element to fade.
     * @returns {Array} Array of keyframes
     */
    function keyframesSlide(hiddenPosition, fadingOut, element) {
        const visible = { transform: 'translate(0,0)', opacity: '1' };
        const invisible = { opacity: '.3' };

        if (hiddenPosition === 'up' || hiddenPosition === 'down') {
            invisible['transform'] = 'translate3d(0,' + element.offsetHeight * (hiddenPosition === 'down' ? 1 : -1) + 'px,0)';
        } else if (hiddenPosition === 'left' || hiddenPosition === 'right') {
            invisible['transform'] = 'translate3d(' + element.offsetWidth * (hiddenPosition === 'right' ? 1 : -1) + 'px,0,0)';
        }

        return fadingOut ? [visible, invisible] : [invisible, visible];
    }

    /**
     * Shows the element by sliding it into view.
     * @param {HTMLElement} element - Element to show.
     * @param {string} slideFrom - Direction to slide from ('down', 'up', 'left', 'right')
     */
    function slideToShow(element, slideFrom) {
        if (!element.classList.contains('hide')) {
            return;
        }

        element.classList.remove('hide');

        const onFinish = function () {
            const btnSlideshowPause = element.querySelector('.btnSlideshowPause');
            if (btnSlideshowPause) focusManager.focus(btnSlideshowPause);
        };

        if (!element.animate) {
            onFinish();
            return;
        }

        requestAnimationFrame(function () {
            const keyframes = keyframesSlide(slideFrom, false, element);
            const timing = { duration: 300, iterations: 1, easing: 'ease-out' };
            element.animate(keyframes, timing).onfinish = onFinish;
        });
    }

    /**
     * Hides the element by sliding it out of view.
     * @param {HTMLElement} element - Element to hide.
     * @param {string} slideInto - Direction to slide into ('down', 'up', 'left', 'right')
     */
    function slideToHide(element, slideInto) {
        if (element.classList.contains('hide')) {
            return;
        }

        const onFinish = function () {
            element.classList.add('hide');
        };

        if (!element.animate) {
            onFinish();
            return;
        }

        requestAnimationFrame(function () {
            const keyframes = keyframesSlide(slideInto, true, element);
            const timing = { duration: 300, iterations: 1, easing: 'ease-out' };
            element.animate(keyframes, timing).onfinish = onFinish;
        });
    }

    /**
     * Shows the OSD when moving the mouse pointer or touching the screen.
     * @param {Event} event - Pointer movement event.
     */
    function onPointerMove(event) {
        const pointerType = event.pointerType || (layoutManager.mobile ? 'touch' : 'mouse');

        if (pointerType === 'mouse') {
            const eventX = event.screenX || 0;
            const eventY = event.screenY || 0;

            const obj = lastMouseMoveData;
            if (!obj) {
                lastMouseMoveData = {
                    x: eventX,
                    y: eventY
                };
                return;
            }

            // if coord are same, it didn't move
            if (Math.abs(eventX - obj.x) < 10 && Math.abs(eventY - obj.y) < 10) {
                return;
            }

            obj.x = eventX;
            obj.y = eventY;

            showOsd();
        }
    }


	
    /**
     * Dispatches keyboard inputs to their proper handlers.
     * @param {Event} event - Keyboard input event.
     */
    function onInputCommand(event) {
        switch (event.detail.command) {
            case 'up':
            case 'down':
            case 'select':
            case 'menu':
            case 'info':
                showOsd();
                break;
            case 'play':
                play();
                break;
            case 'pause':
                pause();
                break;
            case 'playpause':
                playPause();
                break;
            default:
                break;
        }
    }

    /**
     * Shows the slideshow component.
     */
    self.show = function () {
		if (++swiperCount > 1) {
			--swiperCount;
			return;
		}
        createElements(options);
    };

    /**
     * Hides the slideshow element.
     */
    self.hide = function () {
        if (dialog) {
            dialogHelper.close(dialog);
        }
    };
}
