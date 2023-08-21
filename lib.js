// @ts-check

const isMobile = () => { return window.matchMedia("(min-width: 549px)").matches; }

const setIntSetting = (key, value) => { if (typeof(Storage) !== "undefined") window.localStorage.setItem(key, value); return value; }
const getIntSetting = (key, def) => {
    if (typeof(Storage) == "undefined") return def;
    let ret = window.localStorage.getItem(key);
    if (!ret || isNaN(parseInt(ret))) return def;
    return parseInt(ret);
}

const SPEEDKEY = 'PB_SPEED';
const REPEATKEY = 'PB_REPEAT';
const SHOWENGLISH = 'SHOW_ENG';

let _pbSpeeds = [1.0, 0.8, 0.5];
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
    /**
     * @param {HTMLMediaElement} audio
     * @param {number} unit
     * @param {number} section
     * @param {Object[]} timestamps
     */
    constructor(audio, unit, section, timestamps) {
        const audioSource = document.createElement("source");
        audioSource.setAttribute("src", `audio/${unit}-${section}.mp3`);
        audioSource.setAttribute("type", "audio/mpeg");
        audio && audio.appendChild(audioSource);
        this.#audio = audio;
        this.#timestamps = timestamps;
    }
    /** @return {Object[]} */
    timestamps = () => this.#timestamps;
    audio = () => this.#audio;
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
    playSegment = async (segmentindex) => {
        this.#instance && await this.#instance.playSegment(segmentindex);
    }
    repeat = async (segmentindex, times, onPlaySegment) => {
        this.#instance && await this.#instance.repeat(segmentindex, times, onPlaySegment);
    }
    autoInc = async (startIndex, onExec) => {
        this.#instance && await this.#instance.autoInc(startIndex, onExec);
    }
    showControls = show => {
        if (show)
            this.#audio.setAttribute("controls", "true");
        else
            this.#audio.removeAttribute("controls");
    }
    setAudioPlaybackRate = rate => { this.#audio.playbackRate = rate }
    audioPaused = () => {
        return this.#audio.paused;
    }
    relativeSeek = secs => { this.#audio.currentTime += secs; }
    currentTime = () => { return this.#audio.currentTime; }
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
    /**
     * @param {PlayControl} control
     */
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
            const endtime = this.#control.timestamps()[endidx] + 1.0;
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
            //console.log('destroy');
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

const init = async next => {
    const url = new URL(window.location.href);

    const unitstr = url.searchParams.get("u");
    const sectionstr = url.searchParams.get("s");
    if (!unitstr || !sectionstr) return;
    const unit = parseInt(unitstr);
    const section = parseInt(sectionstr);

    /** @return { Promise<{ jsonData?: Object, timestamps?: Object }> } */
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
    if (timestamps) {
        _control.showControls(false);
    } else {
        _control.showControls(true);
    }

    let tmptimestamps = [];
    window.onkeydown = e => {
        if (e.key == 'p') {
            tmptimestamps.push(_control.currentTime());
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
            prevsectionbutton.classList.add("hidden");
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

    let items = jsonData.map((_, i) => {
        let li = document.createElement('li');
        li.style.opacity = '40%';
        return li;

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
            const playButton = document.createElement("a");
            playButton.innerText = "▶️";
            playButton.onclick = async _ => {
                hidecontrols(true);
                _control.reset();
                await _control.autoInc(i, async si => {
                    items.forEach((item, i) =>
                        item.style.opacity = i == si ? '100%' : '50%');
                    if (si < items.length)
                        items[si].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await _control.repeat(si, currentRepeat(), async si => {
                        await _control.playSegment(si);
                    });
                });
            }
            rightContainer.appendChild(playButton);
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
            engSentenceElement.style.opacity = '10%';
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