const isMobile = () => { return window.matchMedia("(min-width: 450px)").matches; }

const syncElements = () => {
    const audio = document.getElementById("audio_play");
    const mobilecontrols = document.getElementById("mobilecontrols");
    if (isMobile()) {
        audio.setAttribute("controls", "true");
        document.body.style.paddingBottom = "64px";
        mobilecontrols.style.visibility = "hidden";
    } else {
        audio.removeAttribute("controls");
        document.body.style.paddingBottom = "16px";
        mobilecontrols.style.visibility = "unset";
    }
}

window.addEventListener('resize', () => {
    syncElements();
});

const initData = (rootdata) => {
    var url = new URL(window.location.href);

    let unit = parseInt(url.searchParams.get("u"));
    let section = parseInt(url.searchParams.get("s"))
    var jsonData = rootdata[`u${unit}s${section}`];
    if (!jsonData) {
        window.location = 'index.html';
        return;
    }

    const header = document.getElementById("header");
    header.innerHTML = `Unit ${unit} - Section ${section}`;

    const audio = document.getElementById("audio_play");
    const audioSource = document.createElement("source");
    audioSource.setAttribute("src", `audio/${unit}-${section}.mp3`);
    audioSource.setAttribute("type", "audio/mpeg");
    audio.appendChild(audioSource);

    let nextsectionbutton = document.getElementById("nextsectionbutton");
    nextsectionbutton.onclick = e => {
        e.preventDefault();
        window.location = `item.html?u=${unit}&s=${section + 1}`;
    };
    let prevsectionbutton = document.getElementById("prevsectionbutton");
    if (section <= 1) {
        prevsectionbutton.classList.add("hidden");
    } else {
        prevsectionbutton.onclick = e => {
            e.preventDefault();
            window.location = `item.html?u=${unit}&s=${section - 1}`;
        };
    }

    const contentContainer = document.getElementById("content");
    const ol = document.createElement("ol");
    contentContainer.appendChild(ol);

    let resetItems = (exceptToggle, exceptOrig, exceptTrans) => {
        //document.querySelectorAll(".langToggle").forEach(e => { if (e != exceptToggle) e.innerText = "[JP]"; });
        //document.querySelectorAll(".orig").forEach(e => { if (e != exceptOrig) e.classList.remove("hidden"); });
        //document.querySelectorAll(".trans").forEach(e => { if (e != exceptTrans) e.classList.add("hidden"); });
    };

    jsonData.forEach(sentenceObj => {
        let li = document.createElement("li");
        ol.appendChild(li);

        let horizontalContainer = document.createElement("div");
        horizontalContainer.classList.add("horizontal");
        li.appendChild(horizontalContainer);

        let itemContainer = document.createElement("div");
        horizontalContainer.appendChild(itemContainer);

        let langToggle = document.createElement("a");
        langToggle.classList.add("langToggle");
        langToggle.innerText = "[JP]";
        langToggle.addEventListener("click", () => {
            resetItems(langToggle, originalContainer, translationContainer);
            originalContainer.classList.toggle("hidden");
            translationContainer.classList.toggle("hidden");
            langToggle.innerText = langToggle.innerText == "[EN]" ? "[JP]" : "[EN]";
        });
        horizontalContainer.appendChild(langToggle);

        let originalContainer = document.createElement("p");
        originalContainer.classList.add("orig");
        itemContainer.appendChild(originalContainer);
        for (const d of sentenceObj.dialog) {
            const sentenceElement = document.createElement("p");
            sentenceElement.innerHTML = d.original;
            originalContainer.appendChild(sentenceElement);
        }

        let translationContainer = document.createElement("p");
        translationContainer.classList.add("trans");
        itemContainer.appendChild(translationContainer);
        for (const d of sentenceObj.dialog) {
            const sentenceElement = document.createElement("p");
            sentenceElement.innerHTML = d.translation;
            translationContainer.appendChild(sentenceElement);
        }
        translationContainer.classList.add("hidden");

        const hrElement = document.createElement("hr");
        li.appendChild(hrElement);
    });
}

document.addEventListener("pause", () => {
    const audio = document.getElementById("audio_play");
    audio.pause();
    middleoverlay.innerText = "▶";
}, false);

window.addEventListener("blur", () => {
    const audio = document.getElementById("audio_play");
    audio.pause();
    middleoverlay.innerText = "▶";
});

var initOverlays = () => {
    const audio = document.getElementById("audio_play");
    const mobilecontrols = document.getElementById("mobilecontrols");

    const leftoverlay = document.getElementById("leftoverlay");
    leftoverlay.addEventListener('click', e => {
        const audio = document.getElementById("audio_play");
        audio.currentTime -= 3;
        e.stopPropagation();
    });
    const middleoverlay = document.getElementById("middleoverlay");
    if (audio.paused) {
        middleoverlay.innerText = "▶";
    }
    middleoverlay.addEventListener('click', e => {
        const audio = document.getElementById("audio_play");
        if (audio.paused) {
            audio.play();
            middleoverlay.innerText = "■";
        } else {
            audio.pause();
            middleoverlay.innerText = "▶";
        }
        e.stopPropagation();
    });
    const rightoverlay = document.getElementById("rightoverlay");
    rightoverlay.addEventListener('click', e => {
        const audio = document.getElementById("audio_play");
        audio.currentTime += 3;
        e.stopPropagation();
    });
    const hiddentouch = document.getElementById("hiddentouch");
    hiddentouch.addEventListener('click', () => {
        togglecontrols();
    });
    hiddentouch.addEventListener('touchmove', () => {
        hidecontrols();
    });

    const hidecontrols = () => {
        leftoverlay.style.visibility = "hidden";
        middleoverlay.style.visibility = "hidden";
        rightoverlay.style.visibility = "hidden";
    }
    const togglecontrols = () => {
        if (leftoverlay.style.visibility == "hidden") {
            leftoverlay.style.visibility = "unset";
            middleoverlay.style.visibility = "unset";
            rightoverlay.style.visibility = "unset";
        } else {
            hidecontrols();
        }
    }

    syncElements();
}