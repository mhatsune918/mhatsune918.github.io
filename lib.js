// @ts-check

const isMobile = () => { return window.matchMedia("(min-width: 549px)").matches; }

const setIntSetting = (key, value) => { if (typeof(Storage) !== "undefined") window.localStorage.setItem(key, value); return value; }
const getIntSetting = (key, def) => {
    if (typeof(Storage) == "undefined") return def;
    let ret = window.localStorage.getItem(key);
    if (!ret || isNaN(parseInt(ret))) return def;
    return parseInt(ret);
}

const DELAY_SECS_BETWEEN = 0.5;
const SEEK_DELTA_SECS = 5.0;
const ENGLISH_OPACITY = 0.25;

const SPEEDKEY = 'PB_SPEED';
const REPEATKEY = 'PB_REPEAT';
const SHOWENGLISH = 'SHOW_ENG';
const LOOPING = 'LOOPING';

let _pbSpeeds = [1.0, 0.8];
let pbSpeedCurrentIndex = getIntSetting(SPEEDKEY, 0);
const selectNextPlaybackSpeed = () => { pbSpeedCurrentIndex = setIntSetting(SPEEDKEY, (pbSpeedCurrentIndex + 1) % _pbSpeeds.length); }
const currentPlaybackSpeed = () => _pbSpeeds[pbSpeedCurrentIndex % _pbSpeeds.length];

let _pbRepeats = [1, 2];
let pbRepeatCurrentIndex = getIntSetting(REPEATKEY, 0);
const selectNextRepeat = () => { pbRepeatCurrentIndex = setIntSetting(REPEATKEY, (pbRepeatCurrentIndex + 1) % _pbRepeats.length); }
const currentRepeat = () => _pbRepeats[pbRepeatCurrentIndex % _pbRepeats.length];

let _showEnglish = getIntSetting(SHOWENGLISH, 0);
const toggleShowEnglish = () => { _showEnglish = setIntSetting(SHOWENGLISH, _showEnglish == 0 ? 1 : 0); }
const currentShowEnglish = () => { return _showEnglish > 0; }

let _looping = getIntSetting(LOOPING, 0);
const toggleLooping = () => { _looping = setIntSetting(LOOPING, _looping == 0 ? 1 : 0); }
const currentLooping = () => { return _looping > 0; }

const _timestamps = [];
let sectionhastimestamps = false;
let _control = undefined;

/** @param {number} secs @return {Promise<Void>} */
let sleep = secs => new Promise((res, rej) => setTimeout(() => { try { res(); } catch (e) { rej(e); } }, secs * 1000));

class PlayControl {
    /** @type {PlayControlInstance | undefined} */
    #instance = undefined;
    /** @type {HTMLMediaElement} */
    #audio;
    /** @type {Object[]} */
    #timestamps;
    /** @type {HTMLElement | null} */
    #middleoverlay = null;
    /** @type {number | undefined} */
    #currentIndex;
    /**
     * @param {HTMLMediaElement} audio
     * @param {number} unit
     * @param {number} section
     * @param {Object[]} timestamps
     */
    constructor(audio, unit, section, timestamps) {
        const audioSource = document.createElement("source");
        audioSource.setAttribute("src", `mp3-cb/${unit}-${section}.mp3`);
        audioSource.setAttribute("type", "audio/mpeg");
        audio && audio.appendChild(audioSource);
        this.#audio = audio;
        this.#timestamps = timestamps;
    }
    /** @return {Object[]} */
    timestamps = () => this.#timestamps;
    audio = () => this.#audio;
    /** @param {HTMLElement} overlay */
    setMiddleOverlay = overlay => {
        if (this.#middleoverlay)
            this.#middleoverlay.innerText = this.#audio.paused ? "▶" : "■";
        this.#middleoverlay = overlay;
    }
    reset = () => {
        if (this.#instance)
            this.#instance.destroy();
        this.#instance = new PlayControlInstance(this);
    }
    /** @param {number} segmentindex */
    playSegment = async (segmentindex) => {
        this.#instance && await this.#instance.playSegment(segmentindex);
    }
    /** @callback OnNextStep @return {void} */
    /** @param {number} segmentindex @param {number} times @param {OnNextStep} onPlaySegment */
    repeat = async (segmentindex, times, onPlaySegment) => {
        this.#instance && await this.#instance.repeat(segmentindex, times, onPlaySegment);
    }
    /** @param {HTMLElement[]} items @param {number|undefined} startsegmentindex */
    autoplay = async (items, startsegmentindex) => {
        let index = startsegmentindex ?? this.#currentIndex ?? 0;
        this.reset();
        await this.autoInc(index, async si => {
            items.forEach((item, i) =>
                item.style.opacity = i == si ? '100%' : '50%');
            if (si < items.length) {
                let padding = parseInt(getComputedStyle(document.documentElement)?.getPropertyValue('--menu-padding') || '0', 10);
                let offset = parseInt(getComputedStyle(document.documentElement)?.getPropertyValue('--menu-height') || '0', 10);
                scrollToTargetWithOffset(items[si], offset + padding * 2);
            }
            await this.repeat(si, currentRepeat(), async si => {
                await _control.playSegment(si);
                await sleep(DELAY_SECS_BETWEEN);
            });
        });
    }
    /** @callback OnExec @return {void} */
    /** @param {number} startIndex @param {OnNextStep} onExec */
    autoInc = async (startIndex, onExec) => {
        this.#currentIndex = startIndex;
        this.#instance && await this.#instance.autoInc(startIndex, onExec);
    }
    /** @param {boolean} show */
    showControls = show => {
        if (show)
            this.#audio.setAttribute("controls", "true");
        else
            this.#audio.removeAttribute("controls");
    }
    /** @param {number} rate */
    setAudioPlaybackRate = rate => { this.#audio.playbackRate = rate }
    audioPaused = () => {
        return this.#audio.paused;
    }
    /** @param {number} deltasecs */
    relativeBoundedSeek = deltasecs => {
        if (this.#currentIndex == undefined) return;
        const i = this.#currentIndex;
        if (i + 1 < this.#timestamps.length) {
            const si = this.#timestamps[i + i];
            const ei = this.#timestamps[i + i + 1];
            const secs = Math.min(Math.max(this.#audio.currentTime + deltasecs, si), ei);
            this.#audio.currentTime = secs;
        }
    }
    /** @param {number} secs */
    relativeSeek = secs => {
        this.#audio.currentTime += secs;
    }
    currentTime = () => { return this.#audio.currentTime; }
    /** @param {number} t */
    setCurrentTime = t => { this.#audio.currentTime = t; }
    playAudio = () => { 
        if (this.#middleoverlay)
            this.#middleoverlay.innerText = "■";
        this.#audio.play();
    }
    pauseAudio = async () => {
        if (this.#middleoverlay)
            this.#middleoverlay.innerText = "▶";
        this.#audio.pause();
    }
    stopAudio = async () => {
        if (this.#middleoverlay)
            this.#middleoverlay.innerText = "▶";
        this.reset();
    }
}

class PlayControlInstance {
    #cancelled = false;
    /** @type {PlayControl} #control */
    #control;
    /** @param {PlayControl} control */
    constructor(control) {
        this.#control = control;
    }
    /**
     * @param {number} segmentindex
     * @return {Promise<void>}
     */
    playSegment = async segmentindex => new Promise((res, rej) => {
        if (this.#cancelled) {
            console.log('cancelled', segmentindex);
            return;
        }
        //console.log('play', segmentindex);
        let startidx = segmentindex * 2;
        let endidx = startidx + 1;
        if (endidx < this.#control.timestamps().length) {
            const starttime = this.#control.timestamps()[startidx];
            const endtime = this.#control.timestamps()[endidx];// + 1.0;
            try {
                this.#control.setCurrentTime(starttime);
                this.#control.playAudio();
                this.#control.audio().onplay = async _ => {
                    while (this.#control.currentTime() < endtime && !this.#cancelled)
                        await sleep(0.1);
                    if (!this.#cancelled) {
                        this.#control.pauseAudio();
                        res();
                    }
                };
            } catch (e) {
                rej(e);
            }
        }
    });
    repeat = async (segmentindex, times, onPlaySegment) => {
        if (!this.#cancelled) {
            if (times > 0) {
                await onPlaySegment(segmentindex);
                await this.repeat(segmentindex, times-1, onPlaySegment);
            }
        }
    }
    autoInc = async (startIndex, onExec) => {
        if (!this.#cancelled) {
            await onExec(startIndex);
            await this.autoInc(startIndex + 1, onExec);
        }
    }
    destroy = () => {
        if (!this.#cancelled) {
            this.#control.pauseAudio();
            this.#cancelled = true;
            this.#control.setCurrentTime(0);
        }
    }
}


const syncElements = () => {
    if (!_control) return;
    if (isMobile()) {
        _control.showControls(true);
    } else {
        _control.showControls(false);
    }
}

window.addEventListener('resize', () => {
    syncElements();
});

const scrollToTargetWithOffset = (element, headerOffset) => {
    const elementPosition = element?.getBoundingClientRect().top || 0;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;
    window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
    });
}

/** @callback Next @return {void} */
/** @param {Next} next */
const init = async next => {
    const url = new URL(window.location.href);

    const unitstr = url.searchParams.get("u");
    const sectionstr = url.searchParams.get("s");
    if (!unitstr || !sectionstr) return;
    const unit = parseInt(unitstr);
    const section = parseInt(sectionstr);
    /** @return { Promise<{ jsonData?: { dialog: { original: string, translation: string }[] }[], timestamps?: Object }> } */
    const loadData = async () => {
        try {
            const { default: jsonData, timestamps } = await import(`./data/u${unit}s${section}.js`);
            return { jsonData, timestamps };
        } catch (e) {
            return {};
        }
    }
    const { jsonData, timestamps } = await loadData();
    if (!jsonData) {
        window.location.href = 'index.html';
        return;
    }

    sectionhastimestamps = !!timestamps;

    const audio = document.getElementById('audio_play');
    if (!(audio instanceof HTMLMediaElement)) return;
    _control = new PlayControl(audio, unit, section, timestamps);

    const controls = document.getElementById('mobilecontrols');
    if (controls) controls.style.visibility = 'hidden';
    if (timestamps) {
        _control.showControls(false);
    } else {
        _control.showControls(true);
    }

    const loopbutton = document.getElementById('loop');
    if (loopbutton instanceof HTMLInputElement) {
        loopbutton.onclick = _ => {
            toggleLooping();
        };
        loopbutton.checked = currentLooping();
    }

    let tmptimestamps = [];
    window.onkeydown = e => {
        if (e.key == 'p') {
            tmptimestamps.push(_control.currentTime().toFixed(1));
        } else if (e.key == 'Backspace') {
            if (tmptimestamps.length > 0)
                tmptimestamps.pop();
        }
        let ret = 'export const timestamps = [\n';
        for (let i=0; i<tmptimestamps.length; i+=2) {
            if (i + 1 < tmptimestamps.length)
                ret += `  ${tmptimestamps[i]}, ${tmptimestamps[i+1]}, // ${(i>>1)+1}\n`;
            else 
                ret += `  ${tmptimestamps[i]}..\n`;
        }
        ret += '];';
        console.log(ret);
    };

    const header = document.getElementById("header");
    if (header) header.innerHTML = `Unit ${unit} - Section ${section}`;

    const speedbutton = document.getElementById("speed");
    if (speedbutton) {
        speedbutton.onclick = _ => {
            selectNextPlaybackSpeed();
            speedbutton.innerText = `Speed ${currentPlaybackSpeed()}`;
            _control.setAudioPlaybackRate(currentPlaybackSpeed());
        };
        speedbutton.innerText = `Speed ${currentPlaybackSpeed()}`;
        _control.setAudioPlaybackRate(currentPlaybackSpeed());
    }

    const repeatbutton = document.getElementById('repeat');
    if (repeatbutton) {
        repeatbutton.onclick = _ => {
            selectNextRepeat();
            repeatbutton.innerText = `Repeat ${currentRepeat()}x`;
        };
        repeatbutton.innerText = `Repeat ${currentRepeat()}x`;
    }

    const langbutton = document.getElementById("lang");
    if (langbutton) {
        langbutton.onclick = _ => {
            toggleShowEnglish();
            const showeng = currentShowEnglish();
            langbutton.innerText = showeng ? "🇺🇸" : "🇯🇵";
            let elems = document.querySelectorAll('.engsentence');
            for (let e of elems) {
                if (e instanceof HTMLElement)
                    e.style.visibility = showeng ? 'unset' : 'hidden';
            }
        };
        langbutton.innerText = currentShowEnglish() ? "🇺🇸" : "🇯🇵";
    }

    const nextsectionbutton = document.getElementById("nextsectionbutton");
    if (nextsectionbutton) {
        nextsectionbutton.onclick = e => {
            e.preventDefault();
            if (window)
                window.location.href = `item.html?u=${unit}&s=${section + 1}`;
        };
    }

    const prevsectionbutton = document.getElementById("prevsectionbutton");
    if (prevsectionbutton) {
        if (section <= 1) {
            prevsectionbutton.style.visibility = 'hidden';
        } else {
            prevsectionbutton.onclick = e => {
                e.preventDefault();
                window.location.href = `item.html?u=${unit}&s=${section - 1}`;
            };
        }
    }

    const contentContainer = document.getElementById("content");
    const ol = document.createElement("ol");
    if (contentContainer) contentContainer.appendChild(ol);

    const items = jsonData.map(() => {
        const li = document.createElement('li');
        li.style.opacity = '40%';
        return li;
    });

    window.addEventListener('click', async () => {
        if (!_control.audioPaused()) {
            _control.relativeBoundedSeek(-SEEK_DELTA_SECS);
        //} else {
            //await _control.autoplay(items);
        }
    });

    jsonData.forEach((sentenceObj, i) => {
        const li = items[i];
        ol.appendChild(li);

        const horizontalContainer = document.createElement("div");
        horizontalContainer.classList.add("horizontal");
        li.appendChild(horizontalContainer);

        const itemContainer = document.createElement("div");
        horizontalContainer.appendChild(itemContainer);

        const rightContainer = document.createElement('div');
        rightContainer.style.display = 'flex';
        rightContainer.style.flexDirection = 'column';
        horizontalContainer.appendChild(rightContainer);

        if (timestamps) {
            li.onclick = async e => {
                hidecontrols(true);
                if (e.clientX > 100) {
                    await _control.autoplay(items, i);
                }
            };
        }

        const originalContainer = document.createElement("p");
        originalContainer.classList.add("orig");
        itemContainer.appendChild(originalContainer);
        for (const d of sentenceObj.dialog) {
            const sentenceElement = document.createElement("p");
            sentenceElement.innerHTML = d.original;
            sentenceElement.style.marginBottom = '0';
            originalContainer.appendChild(sentenceElement);

            const engSentenceElement = document.createElement("p");
            engSentenceElement.classList.add('engsentence');
            engSentenceElement.innerHTML = d.translation;
            engSentenceElement.style.marginBottom = '16px';
            engSentenceElement.style.opacity = `${ENGLISH_OPACITY * 100}%`;
            engSentenceElement.style.visibility = currentShowEnglish() ? 'unset' : 'hidden';
            originalContainer.appendChild(engSentenceElement);
        }

        const hrElement = document.createElement("hr");
        li.appendChild(hrElement);
    });

    next();
}

document.addEventListener("pause", () => {
    if (_control)
        _control.pauseAudio();
}, false);

window.addEventListener("blur", () => {
    if (!isMobile()) {
        if (_control)
            _control.pauseAudio();
    }
});

const initOverlays = () => {
    if (!_control) return;

    const leftoverlay = document.getElementById("leftoverlay");
    if (leftoverlay) {
        leftoverlay.addEventListener('click', e => {
            _control.relativeSeek(-5);
            e.stopPropagation();
        });
    }

    const middleoverlay = document.getElementById("middleoverlay");
    if (middleoverlay) {
        _control.setMiddleOverlay(middleoverlay);
        middleoverlay.addEventListener('click', e => {
            if (_control.audioPaused()) {
                _control.playAudio();
            } else {
                _control.pauseAudio();
            }
            e.stopPropagation();
        });
    }

    const rightoverlay = document.getElementById("rightoverlay");
    if (rightoverlay) {
        rightoverlay.addEventListener('click', e => {
            _control.relativeSeek(5);
            e.stopPropagation();
        });
    }

    const hiddentouch = document.getElementById("hiddentouch");
    if (hiddentouch) {
        hiddentouch.addEventListener('click', () => {
            togglecontrols();
        });
        hiddentouch.addEventListener('touchmove', () => {
            hidecontrols();
        });
    }

    syncElements();
}

const hidecontrols = isHidden => {
    const leftoverlay = document.getElementById("leftoverlay");
    if (leftoverlay) leftoverlay.style.visibility = isHidden ? "hidden": 'unset';
    const middleoverlay = document.getElementById("middleoverlay");
    if (middleoverlay) middleoverlay.style.visibility = isHidden ? "hidden": 'unset';
    const rightoverlay = document.getElementById("rightoverlay");
    if (rightoverlay) rightoverlay.style.visibility = isHidden ? "hidden": 'unset';
}
const togglecontrols = () => {
    const leftoverlay = document.getElementById("leftoverlay");
    if (leftoverlay) hidecontrols(leftoverlay.style.visibility != "hidden");
}