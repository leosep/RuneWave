let currentAudio = null;
let currentSong = null;
let playlist = [];
let currentIndex = -1;
let isLoading = false;
let loopMode = 'none';
let shuffleOn = false;
let volume = 50;
let lastSave = 0;
let isMuted = false;
let prevVolume = 50;

const STORAGE_KEY = 'rw_player_state';

function savePlayerState() {
    try {
        const state = {
            song: currentSong,
            index: currentIndex,
            playlist: playlist.map(s => ({ id: s.id, title: s.title, artist: s.artist, albumArtUrl: s.albumArtUrl, filePath: s.filePath })),
            time: currentAudio ? currentAudio.currentTime : 0,
            playing: currentAudio ? !currentAudio.paused : false,
            loop: loopMode,
            shuffle: shuffleOn,
            volume: volume
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
}

function loadPlayerState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function clearPlayerState() {
    localStorage.removeItem(STORAGE_KEY);
}

function destroyAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio.load();
    }
}

function playSong(songId, songTitle, filePath, buttonId) {
    destroyAudio();

    const existingIdx = playlist.findIndex(s => s.id === songId);
    if (existingIdx >= 0) {
        currentIndex = existingIdx;
    } else {
        playlist = [{ id: songId, title: songTitle, filePath: filePath }];
        currentIndex = 0;
    }

    showLoadingSpinner(buttonId);
    currentSong = { id: songId, title: songTitle };
    const artistEl = buttonId ? document.querySelector('#' + buttonId + ' ~ .song-artist, #' + buttonId + ' + .song-artist, #' + buttonId).closest('.song-card')?.querySelector('.song-artist') : null;
    if (artistEl) currentSong.artist = artistEl.textContent;

    const streamUrl = filePath && filePath !== '' ? filePath : '/Songs/Stream/' + songId;
    currentAudio = new Audio(streamUrl);

    currentAudio.addEventListener('loadedmetadata', function() {
        updatePlayerArt(currentSong.albumArtUrl || '');
        document.getElementById('player-song-title').textContent = songTitle || 'Unknown';
        document.getElementById('player-progress').max = currentAudio.duration;
        document.getElementById('player-duration').textContent = formatTime(currentAudio.duration);
        updatePlayerUI();
    });

    currentAudio.addEventListener('canplay', function() {
        hideLoadingSpinner(buttonId);
        if (!buttonId) document.getElementById('play-icon').textContent = '⏸';
        updatePlayerUI();
    });

    currentAudio.addEventListener('timeupdate', function() {
        const t = currentAudio.currentTime;
        const d = currentAudio.duration || 1;
        document.getElementById('player-progress').value = t;
        document.getElementById('player-current-time').textContent = formatTime(t);
        updateProgressFill(t, d);
        const now = Date.now();
        if (now - lastSave > 5000) { savePlayerState(); lastSave = now; }
    });

    currentAudio.addEventListener('ended', function() {
        document.getElementById('play-icon').textContent = '▶';
        fetch('/Songs/TrackPlay', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ songId: songId }) });
        nextSong();
    });

    currentAudio.addEventListener('error', function() {
        hideLoadingSpinner(buttonId);
        if (!buttonId) document.getElementById('play-icon').textContent = '▶';
    });

    currentAudio.volume = volume / 100;
    currentAudio.play();

    fetch('/Songs/TrackPlay', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ songId: songId }) });
    updatePlayerUI();
    savePlayerState();
}

function playStreamUrl(id, name, country, streamUrl, buttonId) {
    destroyAudio();

    updatePlayerArt('');
    document.getElementById('player-song-title').textContent = name || 'Unknown';
    document.getElementById('player-artist').textContent = country || '';
    document.getElementById('player-progress').value = 0;
    document.getElementById('player-current-time').textContent = '0:00';
    document.getElementById('player-duration').textContent = '∞';
    document.getElementById('play-icon').textContent = '⏸';

    const songId = 'stream-' + id;
    playlist = [{ id: songId, title: name, artist: country, filePath: '/Emissors/Stream/' + id }];
    currentIndex = 0;
    currentSong = { id: songId, title: name, artist: country, albumArtUrl: '' };
    showLoadingSpinner(buttonId);
    currentAudio = new Audio('/Emissors/Stream/' + id);

    var loadTimer = setTimeout(function() {
        hideLoadingSpinner(buttonId);
        document.getElementById('play-icon').textContent = '▶';
        destroyAudio();
        alert('Could not connect to the radio station. The stream may be offline or the server is unreachable.');
    }, 15000);

    currentAudio.addEventListener('loadedmetadata', function() {
        clearTimeout(loadTimer);
        hideLoadingSpinner(buttonId);
        updatePlayerUI();
    });

    currentAudio.addEventListener('canplay', function() {
        clearTimeout(loadTimer);
        hideLoadingSpinner(buttonId);
        updatePlayerUI();
    });

    currentAudio.addEventListener('error', function() {
        clearTimeout(loadTimer);
        hideLoadingSpinner(buttonId);
        if (!buttonId) document.getElementById('play-icon').textContent = '▶';
        alert('Could not play the radio station. The stream may be offline.');
    });

    currentAudio.volume = volume / 100;
    currentAudio.play().catch(function() {
        clearTimeout(loadTimer);
        hideLoadingSpinner(buttonId);
        alert('Could not play the radio station. The stream may be offline.');
    });

    updatePlayerUI();
    savePlayerState();
}

function playSongExt(songId, songTitle, songArtist, songArtUrl, buttonId) {
    destroyAudio();

    const existingIdx = playlist.findIndex(s => s.id === songId);
    if (existingIdx >= 0) {
        currentIndex = existingIdx;
    } else if (playlist.length === 0 || (playlist.length === 1 && playlist[0].id === songId)) {
        playlist = [{ id: songId, title: songTitle, artist: songArtist, albumArtUrl: songArtUrl, filePath: '/Songs/Stream/' + songId }];
        currentIndex = 0;
    } else {
        currentIndex = playlist.length;
        playlist.push({ id: songId, title: songTitle, artist: songArtist, albumArtUrl: songArtUrl, filePath: '/Songs/Stream/' + songId });
    }

    currentSong = { id: songId, title: songTitle, artist: songArtist, albumArtUrl: songArtUrl };
    showLoadingSpinner(buttonId);

    const streamUrl = '/Songs/Stream/' + songId;
    currentAudio = new Audio(streamUrl);

    currentAudio.addEventListener('loadedmetadata', function() {
        updatePlayerArt(songArtUrl);
        document.getElementById('player-song-title').textContent = songTitle || 'Unknown';
        document.getElementById('player-artist').textContent = songArtist || '';
        document.getElementById('player-progress').max = currentAudio.duration;
        document.getElementById('player-duration').textContent = formatTime(currentAudio.duration);
    });

    currentAudio.addEventListener('canplay', function() {
        hideLoadingSpinner(buttonId);
        if (!buttonId) document.getElementById('play-icon').textContent = '⏸';
        updatePlayerUI();
    });

    currentAudio.addEventListener('timeupdate', function() {
        const t = currentAudio.currentTime;
        const d = currentAudio.duration || 1;
        document.getElementById('player-progress').value = t;
        document.getElementById('player-current-time').textContent = formatTime(t);
        updateProgressFill(t, d);
        const now = Date.now();
        if (now - lastSave > 5000) { savePlayerState(); lastSave = now; }
    });

    currentAudio.addEventListener('ended', function() {
        document.getElementById('play-icon').textContent = '▶';
        fetch('/Songs/TrackPlay', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ songId: songId }) });
        nextSong();
    });

    currentAudio.addEventListener('error', function() {
        hideLoadingSpinner(buttonId);
        if (!buttonId) document.getElementById('play-icon').textContent = '▶';
    });

    currentAudio.volume = volume / 100;
    currentAudio.play();

    fetch('/Songs/TrackPlay', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ songId: songId }) });
    updatePlayerUI();
    savePlayerState();
}

function updatePlayerArt(artUrl) {
    const artEl = document.getElementById('player-art');
    if (!artEl) return;
    if (artUrl && !artUrl.includes('via.placeholder.com')) {
        artEl.innerHTML = '<img src="' + artUrl + '" alt="">';
    } else {
        artEl.innerHTML = '<div class="player-art-placeholder">♪</div>';
    }
}

function updateProgressFill(t, d) {
    const pct = Math.min((t / d) * 100, 100);
    const fill = document.getElementById('progress-fill');
    const thumb = document.getElementById('progress-thumb');
    if (fill) fill.style.width = pct + '%';
    if (thumb) thumb.style.left = pct + '%';
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
    savePlayerState();
}

function nextSong() {
    if (playlist.length === 0) return;
    let nextIdx;

    if (loopMode === 'one') {
        nextIdx = currentIndex;
    } else if (shuffleOn) {
        if (playlist.length <= 1) { nextIdx = 0; }
        else { do { nextIdx = Math.floor(Math.random() * playlist.length); } while (nextIdx === currentIndex); }
    } else {
        if (currentIndex < playlist.length - 1) {
            nextIdx = currentIndex + 1;
        } else if (loopMode === 'all') {
            nextIdx = 0;
        } else {
            currentAudio = null;
            currentSong = null;
            updatePlayerUI();
            savePlayerState();
            return;
        }
    }

    currentIndex = nextIdx;
    const song = playlist[currentIndex];
    playSong(song.id, song.title, song.filePath);
}

function prevSong() {
    if (playlist.length === 0) return;
    let prevIdx;

    if (loopMode === 'one') {
        prevIdx = currentIndex;
    } else if (shuffleOn) {
        if (playlist.length <= 1) { prevIdx = 0; }
        else { do { prevIdx = Math.floor(Math.random() * playlist.length); } while (prevIdx === currentIndex); }
    } else {
        if (currentIndex > 0) {
            prevIdx = currentIndex - 1;
        } else if (loopMode === 'all') {
            prevIdx = playlist.length - 1;
        } else { return; }
    }

    currentIndex = prevIdx;
    const song = playlist[currentIndex];
    playSong(song.id, song.title, song.filePath);
}

function toggleLoop() {
    const modes = ['none', 'one', 'all'];
    const idx = modes.indexOf(loopMode);
    loopMode = modes[(idx + 1) % modes.length];

    const btn = document.getElementById('loop-btn');
    const badge = document.getElementById('loop-badge');
    const icon = document.getElementById('loop-icon');
    if (btn) {
        const titles = { 'none': 'Repeat off', 'one': 'Repeat one', 'all': 'Repeat all' };
        btn.title = titles[loopMode];
        btn.classList.toggle('active', loopMode !== 'none');
    }
    if (badge) badge.classList.toggle('hidden', loopMode !== 'one');
    savePlayerState();
}

function toggleShuffle() {
    shuffleOn = !shuffleOn;
    const btn = document.getElementById('shuffle-btn');
    if (btn) {
        btn.classList.toggle('active', shuffleOn);
        btn.title = shuffleOn ? 'Shuffle on' : 'Shuffle off';
    }
    savePlayerState();
}

function toggleMute() {
    if (!currentAudio) return;
    isMuted = !isMuted;
    if (isMuted) {
        prevVolume = volume;
        volume = 0;
        currentAudio.volume = 0;
    } else {
        volume = prevVolume || 50;
        currentAudio.volume = volume / 100;
    }
    const slider = document.getElementById('volume-slider');
    const fill = document.getElementById('volume-fill');
    if (slider) slider.value = volume;
    if (fill) fill.style.width = volume + '%';
}

function setVolume(value) {
    volume = parseInt(value);
    isMuted = false;
    if (currentAudio) currentAudio.volume = volume / 100;
    const fill = document.getElementById('volume-fill');
    if (fill) fill.style.width = volume + '%';
}

function seekTo(value) {
    if (currentAudio) {
        currentAudio.currentTime = value;
        updateProgressFill(value, currentAudio.duration || 1);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showLoadingSpinner(buttonId) {
    isLoading = true;
    if (buttonId) {
        const playBtn = document.getElementById(buttonId);
        if (!playBtn) return;
        const spinner = playBtn.querySelector('.play-spinner-' + buttonId.split('-').pop());
        const icon = playBtn.querySelector('.play-icon-' + buttonId.split('-').pop());
        if (playBtn && spinner && icon) { playBtn.disabled = true; spinner.classList.remove('hidden'); icon.classList.add('hidden'); }
    } else {
        const playBtn = document.getElementById('play-pause-btn');
        const spinner = document.getElementById('play-spinner');
        const icon = document.getElementById('play-icon');
        if (playBtn && spinner && icon) { playBtn.disabled = true; spinner.classList.remove('hidden'); icon.classList.add('hidden'); }
    }
}

function hideLoadingSpinner(buttonId) {
    isLoading = false;
    if (buttonId) {
        const playBtn = document.getElementById(buttonId);
        if (!playBtn) return;
        const spinner = playBtn.querySelector('.play-spinner-' + buttonId.split('-').pop());
        const icon = playBtn.querySelector('.play-icon-' + buttonId.split('-').pop());
        if (playBtn && spinner && icon) { playBtn.disabled = false; spinner.classList.add('hidden'); icon.classList.remove('hidden'); }
    } else {
        const playBtn = document.getElementById('play-pause-btn');
        const spinner = document.getElementById('play-spinner');
        const icon = document.getElementById('play-icon');
        if (playBtn && spinner && icon) { playBtn.disabled = false; spinner.classList.add('hidden'); icon.classList.remove('hidden'); }
    }
}

function setPlaylist(songs) {
    playlist = songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist || '',
        albumArtUrl: s.albumArtUrl || '',
        filePath: s.filePath || '/Songs/Stream/' + s.id
    }));
    currentIndex = -1;
    savePlayerState();
}

function updatePlayerUI() {
    const titleEl = document.getElementById('player-song-title');
    const artistEl = document.getElementById('player-artist');
    const playIcon = document.getElementById('play-icon');

    if (currentSong) {
        if (titleEl) titleEl.textContent = currentSong.title || 'Unknown';
        if (artistEl) artistEl.textContent = currentSong.artist || '';
        if (playIcon) playIcon.textContent = currentAudio && !currentAudio.paused ? '⏸' : '▶';
    } else {
        if (titleEl) titleEl.textContent = 'No song playing';
        if (artistEl) artistEl.textContent = '';
        if (playIcon) playIcon.textContent = '▶';
    }

    const loopBtn = document.getElementById('loop-btn');
    const badge = document.getElementById('loop-badge');
    if (loopBtn) {
        const titles = { 'none': 'Repeat off', 'one': 'Repeat one', 'all': 'Repeat all' };
        loopBtn.title = titles[loopMode];
        loopBtn.classList.toggle('active', loopMode !== 'none');
    }
    if (badge) badge.classList.toggle('hidden', loopMode !== 'one');

    const shuffleBtn = document.getElementById('shuffle-btn');
    if (shuffleBtn) {
        shuffleBtn.classList.toggle('active', shuffleOn);
        shuffleBtn.title = shuffleOn ? 'Shuffle on' : 'Shuffle off';
    }
}

function toggleFavorite(songId) {
    if (!songId || songId === 0) { alert('Invalid song ID.'); return; }
    fetch('/Songs/ToggleFavorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ songId: songId })
    }).then(r => {
        if (r.ok) alert('Favorite toggled!');
        else return r.text().then(t => alert('Error: ' + t));
    }).catch(() => alert('Network error'));
}

let currentAddSongId = null;

function showPlayerPlaylistMenu() {
    const menu = document.getElementById('player-playlist-menu');
    if (menu) { menu.classList.toggle('hidden'); return; }
    if (!currentSong) { alert('No song playing'); return; }
    currentAddSongId = currentSong.id;

    const container = document.createElement('div');
    container.id = 'player-playlist-menu';
    container.className = 'absolute bottom-full right-0 mb-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50 max-h-64 overflow-y-auto';

    const header = document.createElement('div');
    header.className = 'p-3 border-b border-gray-700 font-semibold text-sm text-gray-300';
    header.textContent = 'Add to playlist';
    container.appendChild(header);

    const list = document.createElement('div');
    list.id = 'playlist-menu-list';
    list.className = 'p-2';
    const spinner = document.createElement('div');
    spinner.className = 'text-center text-gray-400 py-4 text-sm';
    spinner.textContent = 'Loading...';
    list.appendChild(spinner);
    container.appendChild(list);

    const createBtn = document.createElement('button');
    createBtn.className = 'w-full p-3 border-t border-gray-700 text-green-400 hover:text-green-300 text-sm flex items-center justify-center hover:bg-gray-700 transition-colors';
    createBtn.textContent = '+ New Playlist';
    createBtn.onclick = function() {
        const name = prompt('Playlist name:');
        if (name && name.trim()) {
            fetch('/Playlists/Create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
                body: new URLSearchParams({ name: name.trim() })
            }).then(r => r.json()).then(result => {
                if (result.success) { addToPlayerPlaylist(result.id); container.remove(); }
            });
        }
    };
    container.appendChild(createBtn);

    const playerBar = document.querySelector('.fixed.bottom-0');
    if (playerBar) playerBar.appendChild(container);

    fetch('/Playlists/ListJson', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(r => r.json()).then(playlists => {
            list.innerHTML = '';
            if (playlists.length === 0) { list.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm">No playlists yet</div>'; return; }
            playlists.forEach(p => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-200 transition-colors';
                btn.textContent = p.name;
                btn.onclick = function() { addToPlayerPlaylist(p.id); container.remove(); };
                list.appendChild(btn);
            });
        }).catch(() => { list.innerHTML = '<div class="text-center text-red-400 py-4 text-sm">Failed to load</div>'; });
}

function addToPlayerPlaylist(playlistId) {
    if (!currentAddSongId) return;
    fetch('/Playlists/AddSong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ playlistId: playlistId, songId: currentAddSongId })
    }).then(r => r.json()).then(result => {
        if (result.success) alert('Song added to playlist!');
        else alert(result.message || 'Failed to add');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const state = loadPlayerState();
    if (state && state.song && state.playlist && state.playlist.length > 0) {
        playlist = state.playlist;
        currentIndex = state.index;
        currentSong = state.song;
        loopMode = state.loop || 'none';
        shuffleOn = state.shuffle || false;
        volume = state.volume || 50;

        const volumeSlider = document.getElementById('volume-slider');
        const volumeFill = document.getElementById('volume-fill');
        if (volumeSlider) volumeSlider.value = volume;
        if (volumeFill) volumeFill.style.width = volume + '%';

        var restoreUrl = '';
        if (playlist[currentIndex] && playlist[currentIndex].filePath) {
            restoreUrl = playlist[currentIndex].filePath;
        } else {
            restoreUrl = '/Songs/Stream/' + currentSong.id;
        }
        if (!restoreUrl) { clearPlayerState(); currentAudio = null; currentSong = null; updatePlayerUI(); return; }

        currentAudio = new Audio(restoreUrl);

        currentAudio.addEventListener('loadedmetadata', function() {
            updatePlayerArt(currentSong.albumArtUrl || '');
            document.getElementById('player-song-title').textContent = currentSong.title || 'Unknown';
            document.getElementById('player-artist').textContent = currentSong.artist || '';
            document.getElementById('player-progress').max = currentAudio.duration;
            document.getElementById('player-duration').textContent = formatTime(currentAudio.duration);
            const seekTime = Math.min(state.time || 0, currentAudio.duration);
            currentAudio.currentTime = seekTime;
            updateProgressFill(seekTime, currentAudio.duration);
            updatePlayerUI();
            if (state.playing) currentAudio.play().catch(function() {});
        });

        currentAudio.addEventListener('canplay', function() { hideLoadingSpinner(); updatePlayerUI(); });

        currentAudio.addEventListener('timeupdate', function() {
            if (!currentAudio) return;
            const t = currentAudio.currentTime;
            const d = currentAudio.duration || 1;
            document.getElementById('player-progress').value = t;
            document.getElementById('player-current-time').textContent = formatTime(t);
            updateProgressFill(t, d);
            const now = Date.now();
            if (now - lastSave > 5000) { savePlayerState(); lastSave = now; }
        });

        currentAudio.addEventListener('ended', function() {
            document.getElementById('play-icon').textContent = '▶';
            if (currentSong.id && !currentSong.id.toString().startsWith('stream-')) {
                fetch('/Songs/TrackPlay', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ songId: currentSong.id }) });
            }
            nextSong();
        });

        currentAudio.addEventListener('error', function() {
            hideLoadingSpinner();
            document.getElementById('play-icon').textContent = '▶';
            clearPlayerState();
            currentAudio = null;
            currentSong = null;
            updatePlayerUI();
        });

        currentAudio.volume = volume / 100;
        updatePlayerUI();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
    else if (e.code === 'ArrowRight') { nextSong(); }
    else if (e.code === 'ArrowLeft') { prevSong(); }
});

window.addEventListener('beforeunload', function() {
    if (currentSong) savePlayerState();
    else clearPlayerState();
});

document.addEventListener('click', function(e) {
    const menu = document.getElementById('player-playlist-menu');
    if (menu && !menu.contains(e.target) && e.target.id !== 'add-to-playlist-btn') {
        menu.classList.add('hidden');
    }
});
