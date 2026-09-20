let bubbleEl;
let bubbleImg;
let bubbleTitle;
let bubbleKind;
let bubbleStory;
let bubbleTransportEl;
let bubbleClip = null;

function hideClipBubble() {
    if (playback) {
        return;
    }
    bubbleClip = null;
    if (bubbleEl) {
        bubbleEl.hidden = true;
        bubbleEl.classList.remove("is-playing");
    }
    if (bubbleTransportEl) {
        bubbleTransportEl.hidden = true;
    }
    document.body.classList.remove("timeline-focus");
    document
        .querySelectorAll(".time-scene.is-active")
        .forEach(function (scene) {
            scene.classList.remove("is-active");
        });
}

function placeClipBubble(clip) {
    const rect = clip.getBoundingClientRect();
    const gap = 12;
    const width = bubbleEl.offsetWidth;
    const height = bubbleEl.offsetHeight;
    const center = rect.left + rect.width / 2;
    let left = center - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const fitsAbove = rect.top > height + gap + 8;
    bubbleEl.classList.toggle("below", !fitsAbove);
    const top = fitsAbove ? rect.top - height - gap : rect.bottom + gap;
    bubbleEl.style.left = left + "px";
    bubbleEl.style.top = top + "px";
    bubbleEl.style.setProperty("--tail-x", center - left + "px");
}

function showClipBubble(clip) {
    bubbleClip = clip;
    document.body.classList.add("timeline-focus");
    const scene = clip.closest(".time-scene");
    document.querySelectorAll(".time-scene.is-active").forEach(function (el) {
        el.classList.remove("is-active");
    });
    if (scene) {
        scene.classList.add("is-active");
    }
    bubbleTitle.textContent = clip.dataset.title;
    bubbleKind.textContent = clip.dataset.kind || "";
    bubbleKind.hidden = !clip.dataset.kind;
    bubbleStory.textContent = clip.dataset.story;
    if (clip.dataset.img) {
        bubbleImg.hidden = false;
        bubbleImg.src = clip.dataset.img;
        bubbleImg.alt = clip.dataset.alt || "";
    } else {
        bubbleImg.hidden = true;
        bubbleImg.removeAttribute("src");
    }
    bubbleEl.hidden = false;
    bubbleTransportEl.hidden = false;
    placeClipBubble(clip);
}

const MIN_DWELL_MS = 5500;
const MAX_DWELL_MS = 12000;
const MS_PER_WORD = 420;
const RECUT_MS = 900;
let playback = null;

function playbackLocksClip(clip) {
    return playback && playback.edit === clip.closest(".time-edit");
}

function dwellForClip(clip) {
    const text = [clip.dataset.title, clip.dataset.kind, clip.dataset.story]
        .filter(Boolean)
        .join(" ");
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.min(MAX_DWELL_MS, Math.max(MIN_DWELL_MS, words * MS_PER_WORD));
}

function clipQueue(clipsEl) {
    const lane = clipsEl.getBoundingClientRect();
    return Array.prototype.map.call(
        clipsEl.querySelectorAll(".clip"),
        function (clip) {
            const rect = clip.getBoundingClientRect();
            return {
                clip: clip,
                start: (rect.left - lane.left) / lane.width,
                end: (rect.right - lane.left) / lane.width,
                dwell: dwellForClip(clip),
            };
        },
    );
}

function setPlayheadAt(edit, playhead, clipsEl, progress) {
    const editRect = edit.getBoundingClientRect();
    const laneRect = clipsEl.getBoundingClientRect();
    playhead.style.left =
        laneRect.left - editRect.left + progress * laneRect.width + "px";
}

function isPlaybackUi(node) {
    if (!node || !node.closest) {
        return false;
    }
    if (node.closest(".clip-bubble, .time-edit .transport")) {
        return true;
    }
    if (!playback) {
        return false;
    }
    const scene = playback.edit.closest(".time-scene");
    return Boolean(scene && scene.contains(node));
}

function setTransportPlaying(playing) {
    const label = playing ? "Pause" : "Play this timeline";
    const buttons = [];
    if (playback && playback.button) {
        buttons.push(playback.button);
    }
    if (bubbleTransportEl) {
        buttons.push(bubbleTransportEl);
    }
    buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", playing ? "true" : "false");
        button.setAttribute("aria-label", label);
    });
    if (bubbleTransportEl && bubbleEl) {
        bubbleTransportEl.hidden = bubbleEl.hidden;
        bubbleEl.classList.toggle(
            "is-playing",
            Boolean(playback) && !playback.paused,
        );
    }
}

function stopPlayback() {
    if (!playback) {
        return;
    }
    cancelAnimationFrame(playback.raf);
    playback.edit.classList.remove("is-playing", "is-recut");
    playback.edit.querySelectorAll(".is-live, .is-on").forEach(function (el) {
        el.classList.remove("is-live", "is-on");
    });
    playback.playhead.hidden = true;
    const button = playback.button;
    playback = null;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Play this timeline");
    if (bubbleTransportEl && bubbleEl) {
        bubbleTransportEl.hidden = bubbleEl.hidden;
        bubbleTransportEl.setAttribute("aria-pressed", "false");
        bubbleTransportEl.setAttribute("aria-label", "Play this timeline");
        bubbleEl.classList.remove("is-playing");
    }
}

function pausePlayback() {
    if (!playback || playback.paused) {
        return;
    }
    cancelAnimationFrame(playback.raf);
    playback.paused = true;
    playback.elapsed = performance.now() - playback.started;
    setTransportPlaying(false);
}

function resumePlayback() {
    if (!playback || !playback.paused) {
        return;
    }
    playback.paused = false;
    playback.started = performance.now() - playback.elapsed;
    setTransportPlaying(true);
    playback.raf = requestAnimationFrame(tickPlayback);
}

function tickPlayback(now) {
    if (!playback) {
        return;
    }
    if (playback.phase === "recut") {
        const nowClips = playback.tracks[1].querySelector(".clips");
        setPlayheadAt(playback.edit, playback.playhead, nowClips, 0);
        if (now - playback.started >= RECUT_MS) {
            playback.phase = "play";
            playback.pass = 1;
            playback.started = now;
            playback.lastClip = null;
            playback.edit.classList.remove("is-recut");
            playback.raf = requestAnimationFrame(tickPlayback);
            return;
        }
        playback.raf = requestAnimationFrame(tickPlayback);
        return;
    }
    const track = playback.tracks[playback.pass];
    playback.tracks.forEach(function (el, index) {
        el.classList.toggle("is-live", index === playback.pass);
    });
    const clipsEl = track.querySelector(".clips");
    const queue = clipsEl ? clipQueue(clipsEl) : [];
    if (!queue.length) {
        stopPlayback();
        hideClipBubble();
        return;
    }
    const elapsed = now - playback.started;
    let acc = 0;
    let current = queue[queue.length - 1];
    let local = 1;
    let done = true;
    for (let i = 0; i < queue.length; i += 1) {
        if (elapsed < acc + queue[i].dwell) {
            current = queue[i];
            local = (elapsed - acc) / queue[i].dwell;
            done = false;
            break;
        }
        acc += queue[i].dwell;
    }
    const at = current.start + (current.end - current.start) * local;
    setPlayheadAt(playback.edit, playback.playhead, clipsEl, at);
    clipsEl.querySelectorAll(".clip").forEach(function (clip) {
        clip.classList.toggle("is-on", clip === current.clip);
    });
    if (current.clip !== playback.lastClip) {
        playback.lastClip = current.clip;
        showClipBubble(current.clip);
    } else {
        placeClipBubble(current.clip);
    }
    if (done) {
        if (playback.pass === 0) {
            playback.phase = "recut";
            playback.started = now;
            playback.lastClip = null;
            playback.tracks[0].classList.remove("is-live");
            playback.tracks[0]
                .querySelectorAll(".is-on")
                .forEach(function (clip) {
                    clip.classList.remove("is-on");
                });
            playback.tracks[1].classList.add("is-live");
            playback.edit.classList.add("is-recut");
            setPlayheadAt(
                playback.edit,
                playback.playhead,
                playback.tracks[1].querySelector(".clips"),
                0,
            );
            if (bubbleEl) {
                bubbleEl.hidden = true;
            }
            playback.raf = requestAnimationFrame(tickPlayback);
            return;
        }
        stopPlayback();
        return;
    }
    playback.raf = requestAnimationFrame(tickPlayback);
}

function elapsedBeforeClip(clipsEl, startClip) {
    const queue = clipQueue(clipsEl);
    let acc = 0;
    for (let i = 0; i < queue.length; i += 1) {
        if (queue[i].clip === startClip) {
            return acc;
        }
        acc += queue[i].dwell;
    }
    return 0;
}

function startPlayback(edit, fromClip) {
    const button = edit.querySelector(".transport");
    const playhead = edit.querySelector(".playhead");
    const tracks = edit.querySelectorAll(".track");
    let pass = 0;
    let elapsed = 0;
    if (fromClip && tracks[1] && tracks[1].contains(fromClip)) {
        pass = 1;
        elapsed = elapsedBeforeClip(
            tracks[1].querySelector(".clips"),
            fromClip,
        );
    } else if (fromClip && tracks[0] && tracks[0].contains(fromClip)) {
        elapsed = elapsedBeforeClip(
            tracks[0].querySelector(".clips"),
            fromClip,
        );
    }
    playback = {
        edit: edit,
        button: button,
        playhead: playhead,
        tracks: tracks,
        pass: pass,
        phase: "play",
        started: performance.now() - elapsed,
        elapsed: elapsed,
        paused: false,
        lastClip: null,
        raf: 0,
    };
    edit.classList.add("is-playing");
    playhead.hidden = false;
    setTransportPlaying(true);
    playback.raf = requestAnimationFrame(tickPlayback);
}

function togglePlayback(edit) {
    if (playback && playback.edit === edit) {
        if (playback.paused) {
            resumePlayback();
        } else {
            pausePlayback();
        }
        return;
    }
    if (playback) {
        stopPlayback();
    }
    const fromClip =
        bubbleClip && edit.contains(bubbleClip) ? bubbleClip : null;
    startPlayback(edit, fromClip);
}

function bindClips() {
    document.querySelectorAll(".clip").forEach(function (clip) {
        clip.addEventListener("click", function (event) {
            if (playbackLocksClip(clip)) {
                event.preventDefault();
                return;
            }
            showClipBubble(clip);
        });
    });
}

function bindTimelines() {
    document.querySelectorAll(".time-edit").forEach(function (edit) {
        const gutter = edit.querySelector(".ruler-gutter");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "transport";
        button.setAttribute("aria-label", "Play this timeline");
        button.innerHTML =
            '<span class="play-shape" aria-hidden="true"></span>' +
            '<span class="pause-shape" aria-hidden="true"></span>';
        gutter.appendChild(button);

        const playhead = document.createElement("div");
        playhead.className = "playhead";
        playhead.hidden = true;
        edit.appendChild(playhead);

        button.addEventListener("click", function (event) {
            event.stopPropagation();
            togglePlayback(edit);
        });

        edit.addEventListener("focusout", function (event) {
            if (!playback || playback.edit !== edit) {
                return;
            }
            if (isPlaybackUi(event.relatedTarget)) {
                return;
            }
            if (!event.relatedTarget) {
                return;
            }
            stopPlayback();
            hideClipBubble();
        });
    });
}

export function bindDifference() {
    bubbleEl = document.getElementById("clip-bubble");
    bubbleImg = document.getElementById("clip-bubble-image");
    bubbleTitle = document.getElementById("clip-bubble-title");
    bubbleKind = document.getElementById("clip-bubble-kind");
    bubbleStory = document.getElementById("clip-bubble-story");
    bubbleTransportEl = document.getElementById("bubble-transport");
    if (bubbleImg) {
        bubbleImg.addEventListener("load", function () {
            if (bubbleClip) {
                placeClipBubble(bubbleClip);
            }
        });
    }
    if (bubbleTransportEl) {
        bubbleTransportEl.addEventListener("click", function (event) {
            event.stopPropagation();
            if (playback) {
                togglePlayback(playback.edit);
                return;
            }
            const clip = bubbleClip;
            const edit = clip && clip.closest(".time-edit");
            if (edit) {
                startPlayback(edit, clip);
            }
        });
    }
    document.addEventListener("pointerdown", function (event) {
        if (isPlaybackUi(event.target)) {
            return;
        }
        if (playback) {
            stopPlayback();
            hideClipBubble();
            return;
        }
        if (!event.target.closest(".clip")) {
            hideClipBubble();
        }
    });
    window.addEventListener(
        "scroll",
        function () {
            if (bubbleClip) {
                placeClipBubble(bubbleClip);
            }
        },
        { passive: true },
    );
    window.addEventListener("resize", function () {
        if (bubbleClip) {
            placeClipBubble(bubbleClip);
        }
    });
    bindClips();
    bindTimelines();
}
