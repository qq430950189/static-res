document.addEventListener('DOMContentLoaded', () => {
  const playlistUrl = 'https://app.box.com/index.php?rm=box_download_shared_file&shared_name=p0k2vzosqozfogxaqgwpt0rbrddg9c5r&file_id=f_1978827382881'; // 你的远程 JSON 地址
  let playlist = [];
  let currentIndex = 0;
  let playedIndices = [];
  let sound = null;
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

  function loadTrack(index) {
    if (!playlist.length) return;
    if (sound) sound.unload();
    currentIndex = index;
    titleEl.textContent = playlist[index].title;
    sound = new Howl({
      src: [ playlist[index].url ],
      html5: true,
      onend: () => {
        nextTrack();
      }
    });
    audioMotion.connectInput(sound._sounds[0]._node);
  }

  function playTrack() {
    if (!sound) loadTrack(currentIndex);
    sound.play();
    playing = true;
    btnPlay.textContent = '⏸';
  }

  function pauseTrack() {
    if (sound) sound.pause();
    playing = false;
    btnPlay.textContent = '▶';
  }

  function nextTrack() {
    currentIndex = (currentIndex + 1) % playlist.length;
    loadTrack(currentIndex);
    playTrack();
  }

  function prevTrack() {
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadTrack(currentIndex);
    playTrack();
  }

  function randomTrack() {
    if (playedIndices.length >= playlist.length) playedIndices = [];
    let next;
    do {
      next = Math.floor(Math.random() * playlist.length);
    } while (playedIndices.includes(next) && playedIndices.length < playlist.length);
    playedIndices.push(next);
    loadTrack(next);
    playTrack();
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
    playerEl.remove();
    localStorage.removeItem('brsp-collapsed');
  });
  btnToggle.addEventListener('click', () => {
    playerEl.classList.toggle('collapsed');
    localStorage.setItem('brsp-collapsed', playerEl.classList.contains('collapsed'));
  });

  // 从远程 JSON 获取播放列表
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
