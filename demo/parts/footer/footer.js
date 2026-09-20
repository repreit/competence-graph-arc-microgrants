export function bindFooter() {
    const timeEl = document.getElementById("last-modified");
    if (!timeEl) {
        return;
    }

    function showModified(date) {
        timeEl.dateTime = date.toISOString();
        timeEl.textContent = date.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        });
    }

    function showModifiedError() {
        timeEl.removeAttribute("datetime");
        timeEl.textContent = "could not load from GitHub";
    }

    fetch(
        "https://api.github.com/repos/repreit/competence-graph-arc-microgrants/commits?per_page=1",
    )
        .then(function (response) {
            if (!response.ok) {
                throw new Error("github");
            }
            return response.json();
        })
        .then(function (commits) {
            if (
                !Array.isArray(commits) ||
                !commits[0] ||
                !commits[0].commit ||
                !commits[0].commit.committer
            ) {
                throw new Error("github");
            }
            showModified(new Date(commits[0].commit.committer.date));
        })
        .catch(function () {
            showModifiedError();
        });
}
