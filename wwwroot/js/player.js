let currentAudio = null;
let currentSong = null;
let playlist = [];
let currentIndex = -1;
let isLoading = false;

function playSong(songId, songTitle, filePath, buttonId = null) {
    if (currentAudio) {
        currentAudio.pause();
    }

    showLoadingSpinner(buttonId);

    // Use the Stream action instead of direct file path
    var streamUrl = '/Songs/Stream/' + songId;
    currentAudio = new Audio(streamUrl);
    currentSong = { id: songId, title: songTitle };

    // Update currentIndex if song is in playlist
    if (playlist.length > 0) {
        currentIndex = playlist.findIndex(s => s.id === songId);
    }

    currentAudio.addEventListener('loadedmetadata', function() {
        document.getElementById('player-song-title').textContent = songTitle;
        document.getElementById('player-progress').max = currentAudio.duration;
        document.getElementById('player-duration').textContent = formatTime(currentAudio.duration);
    });

    currentAudio.addEventListener('canplay', function() {
        hideLoadingSpinner(buttonId);
        if (!buttonId) {
            document.getElementById('play-icon').textContent = '⏸';
        }
    });

    currentAudio.addEventListener('timeupdate', function() {
        document.getElementById('player-progress').value = currentAudio.currentTime;
        document.getElementById('player-current-time').textContent = formatTime(currentAudio.currentTime);
    });

    currentAudio.addEventListener('ended', function() {
        // Track played song
        fetch('/Songs/TrackPlay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ songId: songId })
        });
        document.getElementById('play-icon').textContent = '▶';
        nextSong();
    });

    currentAudio.addEventListener('error', function() {
        hideLoadingSpinner(buttonId);
        if (!buttonId) {
            document.getElementById('play-icon').textContent = '▶';
        }
        alert('Error loading audio file');
    });

    currentAudio.play();

    // Track play immediately
    fetch('/Songs/TrackPlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ songId: songId })
    });
}

function togglePlayPause() {
    if (isLoading || !currentAudio) return;

    if (currentAudio.paused) {
        currentAudio.play();
        document.getElementById('play-icon').textContent = '⏸';
    } else {
        currentAudio.pause();
        document.getElementById('play-icon').textContent = '▶';
    }
}

function nextSong() {
    if (playlist.length > 0 && currentIndex < playlist.length - 1) {
        currentIndex++;
        const song = playlist[currentIndex];
        playSong(song.id, song.title, song.filePath);
    }
}

function prevSong() {
    if (playlist.length > 0 && currentIndex > 0) {
        currentIndex--;
        const song = playlist[currentIndex];
        playSong(song.id, song.title, song.filePath);
    }
}

function setVolume(value) {
    if (currentAudio) {
        currentAudio.volume = value / 100;
    }
}

function seekTo(value) {
    if (currentAudio) {
        currentAudio.currentTime = value;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showLoadingSpinner(buttonId = null) {
    isLoading = true;

    if (buttonId) {
        // Show spinner on individual button
        const playBtn = document.getElementById(buttonId);
        const spinner = playBtn.querySelector('.play-spinner-' + buttonId.split('-')[2]);
        const icon = playBtn.querySelector('.play-icon-' + buttonId.split('-')[2]);

        if (playBtn && spinner && icon) {
            playBtn.disabled = true;
            spinner.classList.remove('hidden');
            icon.classList.add('hidden');
        }
    } else {
        // Show spinner on main player button
        const playBtn = document.getElementById('play-pause-btn');
        const spinner = document.getElementById('play-spinner');
        const icon = document.getElementById('play-icon');

        if (playBtn && spinner && icon) {
            playBtn.disabled = true;
            spinner.classList.remove('hidden');
            icon.classList.add('hidden');
        }
    }
}

function hideLoadingSpinner(buttonId = null) {
    isLoading = false;

    if (buttonId) {
        // Hide spinner on individual button
        const playBtn = document.getElementById(buttonId);
        const spinner = playBtn.querySelector('.play-spinner-' + buttonId.split('-')[2]);
        const icon = playBtn.querySelector('.play-icon-' + buttonId.split('-')[2]);

        if (playBtn && spinner && icon) {
            playBtn.disabled = false;
            spinner.classList.add('hidden');
            icon.classList.remove('hidden');
        }
    } else {
        // Hide spinner on main player button
        const playBtn = document.getElementById('play-pause-btn');
        const spinner = document.getElementById('play-spinner');
        const icon = document.getElementById('play-icon');

        if (playBtn && spinner && icon) {
            playBtn.disabled = false;
            spinner.classList.add('hidden');
            icon.classList.remove('hidden');
        }
    }
}

function setPlaylist(songs) {
    playlist = songs;
    currentIndex = -1;
}

// Toggle favorite
function toggleFavorite(songId) {
    if (!songId || songId === 0) {
        alert('Invalid song ID. Please scan music first.');
        return;
    }

    fetch('/Songs/ToggleFavorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ songId: songId })
    }).then(response => {
        if (response.ok) {
            // Update button appearance or show notification
            console.log('Favorite toggled successfully');
            alert('Song added/removed from favorites!');
        } else {
            return response.text().then(errorText => {
                console.error('Favorite toggle failed:', errorText);
                alert('Error: ' + errorText);
            });
        }
    }).catch(error => {
        console.error('Network error:', error);
        alert('Network error occurred');
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
    } else if (e.code === 'ArrowRight') {
        nextSong();
    } else if (e.code === 'ArrowLeft') {
        prevSong();
    }
});