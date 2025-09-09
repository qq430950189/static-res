document.addEventListener('DOMContentLoaded', () => {
  const playlistUrl = 'https://od.lk/s/NV8yMDcxMTc3MzNf/playlist.json';
  let playlist = [];
  let currentIndex = 0;
  let playedIndices = [];
  let sound = null;       // Web Audio 模式
  let audioEl = null;     // HTML5 / Blob 模式
  let srcNode = null;     // HTML5 模式的 MediaElementSource
  let playing = false;
  let currentMode = null; // 'webaudio' | 'html5' | 'blob'

  const titleEl = document.getElementById('track-title');
  const btnPlay = document.getElementById('btn-play');
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const btnRandom = document.getElementById('btn-random');
  const btnClose = document.getElementById('btn-close');
  const btnToggle = document.getElementById('btn-toggle');
  const playerEl = document.getElementById('brsp-player');

  // 恢复折叠状态
  if (localStorage.getItem('brsp-collapsed') === 'false') {
    playerEl.classList.remove('collapsed');
  } else {
    playerEl.classList.add('collapsed');
  }

  // 初始化 AudioMotion
  const audioMotion = new AudioMotionAnalyzer(
    document.getElementById('brsp-visualizer'),
    {
      mode: 10,
      gradient: 'prism',
      overlay: true,
      showScaleX: false,
      showScaleY: false,
      bgAlpha: 0
    }
  );

  function cleanupAudio() {
    if (sound) {
      sound.stop();
      sound.unload();
      sound = null;
    }
    if (audioEl) {
      audioEl.pause();
      if (audioEl.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioEl.src);
      }
      audioEl.src = '';
    }
  }

  // Web Audio 模式
  function loadTrackWebAudio(index) {
    return new Promise((resolve, reject) => {
      try {
        sound = new Howl({
          src: [playlist[index].url],
          html5: false,
          onend: nextTrack,
          onloaderror: () => reject('webaudio-fail')
        });
        sound.once('play', () => {
          // 连接 Howler 内部 AudioNode
          const node = sound._sounds[0]?._node;
          if (node) audioMotion.connectInput(node);
          currentMode = 'webaudio';
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // HTML5 Audio 模式
  function prepareHTML5Audio() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      audioEl.addEventListener('ended', () => {
        if (audioEl.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioEl.src);
        }
        nextTrack();
      });
      const ctx = audioMotion.audioCtx;
      srcNode = ctx.createMediaElementSource(audioEl);
      srcNode.connect(audioMotion.analyzer);
      audioMotion.analyzer.connect(ctx.destination);
    }
  }

  function loadTrackHTML5(index) {
    return new Promise((resolve, reject) => {
      prepareHTML5Audio();
      audioEl.src = playlist[index].url;
      audioEl.onerror = () => reject('html5-fail');
      audioEl.oncanplay = () => {
        currentMode = 'html5';
        resolve();
      };
    });
  }

  // Blob 模式
  async function loadTrackBlob(index) {
    try {
      const res = await fetch(playlist[index].url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      prepareHTML5Audio();
      audioEl.src = blobUrl;
      await new Promise((resolve, reject) => {
        audioEl.onerror = () => reject('blob-fail');
        audioEl.oncanplay = () => {
          currentMode = 'blob';
          resolve();
        };
      });
      return true;
    } catch (e) {
      console.warn('Blob 播放失败');
      return false;
    }
  }

  // 智能加载
  async function loadTrack(index) {
    if (!playlist.length) return;
    cleanupAudio();
    currentIndex = index;
    titleEl.textContent = playlist[index].title;

    try {
      await loadTrackWebAudio(index);
      return;
    } catch {
      console.warn('Web Audio 播放失败，尝试 HTML5 Audio');
    }

    try {
      await loadTrackHTML5(index);
      return;
    } catch {
      console.warn('HTML5 Audio 播放失败，尝试 Blob');
    }

    const success = await loadTrackBlob(index);
    if (!success) {
      titleEl.textContent = '无法播放，已跳过';
      nextTrack();
    }
  }

  function playTrack() {
    // 必须用户手势后才能启动 AudioContext
    if (audioMotion.audioCtx.state === 'suspended') {
      audioMotion.audioCtx.resume();
    }

    // 确保可视化连接在播放时建立
    if (currentMode === 'html5' || currentMode === 'blob') {
      audioMotion.connectInput(audioEl);
    }

    if (sound) {
      sound.play();
    } else if (audioEl) {
      audioEl.play();
    } else {
      loadTrack(currentIndex).then(() => {
        if (sound) sound.play();
        if (audioEl) audioEl.play();
      });
    }
    playing = true;
    btnPlay.textContent = '⏸';
  }

  function pauseTrack() {
    if (sound) sound.pause();
    if (audioEl) audioEl.pause();
    playing = false;
    btnPlay.textContent = '▶';
  }

  function nextTrack() {
    currentIndex = (currentIndex + 1) % playlist.length;
    loadTrack(currentIndex).then(playTrack);
  }

  function prevTrack() {
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadTrack(currentIndex).then(playTrack);
  }

  function randomTrack() {
    if (playedIndices.length >= playlist.length) playedIndices = [];
    let next;
    do {
      next = Math.floor(Math.random() * playlist.length);
    } while (playedIndices.includes(next) && playedIndices.length < playlist.length);
    playedIndices.push(next);
    loadTrack(next).then(playTrack);
  }

  // 按钮事件
  btnPlay.addEventListener('click', () => {
    if (!playing) playTrack();
    else pauseTrack();
  });
  btnNext.addEventListener('click', nextTrack);
  btnPrev.addEventListener('click', prevTrack);
  btnRandom.addEventListener('click', randomTrack);
  btnClose.addEventListener('click', () => {
    cleanupAudio();
    playerEl.remove();
    localStorage.removeItem('brsp-collapsed');
  });
  btnToggle.addEventListener('click', () => {
    playerEl.classList.toggle('collapsed');
    localStorage.setItem('brsp-collapsed', playerEl.classList.contains('collapsed'));
  });

  // 获取播放列表
  fetch(playlistUrl)
    .then(res => res.json())
    .then(data => {
      playlist = data;
      if (playlist.length) {
        loadTrack(currentIndex);
      } else {
        titleEl.textContent = '播放列表为空';
      }
    })
    .catch(err => {
      console.error('获取播放列表失败:', err);
      titleEl.textContent = '加载失败';
    });
});
