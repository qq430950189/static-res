document.addEventListener('DOMContentLoaded', () => {
  const playlistUrl = 'https://od.lk/s/NV8yMDcxMTc3MzNf/playlist.json';
  let playlist = [];
  let currentIndex = 0;
  let playedIndices = [];
  let sound = null;       // Web Audio 模式
  let audioEl = null;     // HTML5 模式
  let srcNode = null;     // HTML5 模式的 MediaElementSource
  let playing = false;

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

  // 检查 URL 是否可访问（403 跳过）
  async function checkUrl(url) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) throw new Error(res.status);
      return true;
    } catch (e) {
      console.warn(`音频无法访问 (${url})，状态码: ${e.message}`);
      return false;
    }
  }

  // 尝试 Web Audio 模式
  function loadTrackWebAudio(index) {
    return new Promise((resolve, reject) => {
      try {
        sound = new Howl({
          src: [ playlist[index].url ],
          html5: false,
          onend: nextTrack,
          onloaderror: () => reject('webaudio-fail')
        });
        sound.once('play', () => {
          audioMotion.connectInput(sound);
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  // HTML5 Audio 模式（避免重复 connect）
  function loadTrackHTML5(index) {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      audioEl.addEventListener('ended', nextTrack);

      const ctx = audioMotion.audioCtx;
      srcNode = ctx.createMediaElementSource(audioEl);
      srcNode.connect(audioMotion.analyzer);
      audioMotion.analyzer.connect(ctx.destination);
    }
    audioEl.src = playlist[index].url;
  }

  // 智能加载
  async function loadTrack(index) {
    if (!playlist.length) return;
    currentIndex = index;
    titleEl.textContent = playlist[index].title;

    // 检查 URL 可用性
    const ok = await checkUrl(playlist[index].url);
    if (!ok) {
      titleEl.textContent = '音频无法访问，已跳过';
      nextTrack();
      return;
    }

    // 先尝试 Web Audio
    try {
      await loadTrackWebAudio(index);
    } catch {
      console.warn('Web Audio 播放失败，切换 HTML5 Audio');
      loadTrackHTML5(index);
    }
  }

  function playTrack() {
    // 自动 resume AudioContext
    if (audioMotion.audioCtx.state === 'suspended') {
      audioMotion.audioCtx.resume();
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
    if (sound) sound.stop();
    if (audioEl) audioEl.pause();
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
