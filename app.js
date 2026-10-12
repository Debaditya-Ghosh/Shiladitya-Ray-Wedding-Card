(() => {
  const cfg = window.WEDDING_CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const petalField = $('#petalField');
  const petalCount = matchMedia('(max-width: 640px)').matches ? 12 : 20;
  for (let i = 0; i < petalCount; i += 1) {
    const petal = document.createElement('img');
    petal.className = 'petal';
    petal.src = './assets/petal.webp';
    petal.alt = '';
    petal.style.setProperty('--left', `${Math.random() * 108 - 4}%`);
    petal.style.setProperty('--size', `${18 + Math.random() * 34}px`);
    petal.style.setProperty('--duration', `${9 + Math.random() * 10}s`);
    petal.style.setProperty('--delay', `${-Math.random() * 18}s`);
    petal.style.setProperty('--sway', `${-65 + Math.random() * 130}px`);
    petal.style.setProperty('--drift', `${-110 + Math.random() * 220}px`);
    petal.style.setProperty('--rotate', `${Math.random() * 320}deg`);
    petalField.appendChild(petal);
  }

  let audioContext;
  let synthTimer;
  let isPlaying = false;
  let noteIndex = 0;
  let shanaiWave;
  let shanaiBus;
  let droneStarted = false;
  const customAudio = $('#customAudio');
  const melody = [293.66, 311.13, 349.23, 392, 440, 466.16, 440, 392, 349.23, 311.13, 293.66, 261.63, 293.66, 349.23, 392, 349.23];

  const initialiseShanai = () => {
    if (shanaiBus) return;
    shanaiBus = audioContext.createGain();
    shanaiBus.gain.value = .78;

    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    const reverb = audioContext.createConvolver();
    dry.gain.value = .82;
    wet.gain.value = .22;
    const impulse = audioContext.createBuffer(2, audioContext.sampleRate * 1.7, audioContext.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
      }
    }
    reverb.buffer = impulse;
    shanaiBus.connect(dry).connect(audioContext.destination);
    shanaiBus.connect(reverb).connect(wet).connect(audioContext.destination);

    const real = new Float32Array(8);
    const imag = new Float32Array([0, 1, .62, .39, .24, .15, .09, .05]);
    shanaiWave = audioContext.createPeriodicWave(real, imag);

    if (!droneStarted) {
      [[146.83, 'sawtooth', .012], [220, 'triangle', .016]].forEach(([frequency, type, level]) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const lowpass = audioContext.createBiquadFilter();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.value = level * cfg.musicVolume;
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 900;
        oscillator.connect(lowpass).connect(gain).connect(shanaiBus);
        oscillator.start();
      });
      droneStarted = true;
    }
  };

  const playShanaiNote = () => {
    if (!audioContext || !isPlaying) return;
    initialiseShanai();
    const now = audioContext.currentTime;
    const target = melody[noteIndex++ % melody.length];
    const osc = audioContext.createOscillator();
    const vibrato = audioContext.createOscillator();
    const vibratoDepth = audioContext.createGain();
    const resonance = audioContext.createBiquadFilter();
    const lowpass = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    osc.setPeriodicWave(shanaiWave);
    osc.frequency.setValueAtTime(target * (noteIndex % 3 === 0 ? 1.045 : .965), now);
    osc.frequency.exponentialRampToValueAtTime(target, now + .16);
    vibrato.frequency.value = 5.35;
    vibratoDepth.gain.setValueAtTime(.4, now);
    vibratoDepth.gain.linearRampToValueAtTime(3.2, now + .45);
    vibrato.connect(vibratoDepth).connect(osc.frequency);
    resonance.type = 'peaking';
    resonance.frequency.value = 1180;
    resonance.Q.value = 1.2;
    resonance.gain.value = 7;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3900;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(cfg.musicVolume * .16, now + .1);
    gain.gain.setValueAtTime(cfg.musicVolume * .13, now + .88);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 1.75);
    osc.connect(resonance).connect(lowpass).connect(gain).connect(shanaiBus);
    osc.start(now);
    vibrato.start(now);
    osc.stop(now + 1.82);
    vibrato.stop(now + 1.82);
  };

  const updateMusicButton = () => {
    const button = $('#musicToggle');
    button.setAttribute('aria-pressed', String(isPlaying));
    button.setAttribute('aria-label', isPlaying ? 'Pause music' : 'Play music');
  };

  const showToast = message => {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  const startMusic = async () => {
    try {
      isPlaying = true;
      if (cfg.musicUrl) {
        if (!customAudio.getAttribute('src')) customAudio.src = cfg.musicUrl;
        customAudio.volume = cfg.musicVolume;
        await customAudio.play();
      } else {
        const AudioEngine = window.AudioContext || window.webkitAudioContext;
        if (!AudioEngine) throw new Error('Audio unavailable');
        if (!audioContext) audioContext = new AudioEngine();
        await audioContext.resume();
        initialiseShanai();
        playShanaiNote();
        clearInterval(synthTimer);
        synthTimer = setInterval(playShanaiNote, 1180);
      }
    } catch (_) {
      isPlaying = false;
      showToast('Tap the music button to begin the music.');
    }
    updateMusicButton();
  };

  const pauseMusic = () => {
    isPlaying = false;
    customAudio.pause();
    clearInterval(synthTimer);
    if (audioContext && audioContext.state === 'running') audioContext.suspend();
    updateMusicButton();
  };

  $('#openInvitation').addEventListener('click', () => {
    $('#opening').classList.add('is-open');
    document.body.classList.remove('locked');
    $('#musicToggle').classList.add('visible');
    startMusic();
    setTimeout(() => $('#opening').setAttribute('aria-hidden', 'true'), 1200);
  });
  $('#musicToggle').addEventListener('click', () => isPlaying ? pauseMusic() : startMusic());

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    }), { threshold: .12, rootMargin: '0px 0px -40px' });
    $$('.reveal').forEach(el => observer.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in-view'));
  }

  let frame = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const updateScenes = () => {
    frame = 0;
    const hero = $('#home');
    const heroTravel = Math.max(1, hero.offsetHeight - innerHeight);
    hero.style.setProperty('--p', clamp(scrollY / heroTravel).toFixed(4));

    const procession = $('#procession');
    const rect = procession.getBoundingClientRect();
    const travel = Math.max(1, procession.offsetHeight - innerHeight);
    const p = clamp(-rect.top / travel);
    let x;
    if (p < .28) x = -118 + (p / .28) * 118;
    else if (p < .52) x = 0;
    else x = ((p - .52) / .48) * 132;
    const waddle = p > .04 && p < .96 ? Math.sin(p * 54) : 0;
    procession.style.setProperty('--palki-x', `${x}vw`);
    procession.style.setProperty('--palki-y', `${waddle * 6}px`);
    procession.style.setProperty('--palki-r', `${waddle * .75}deg`);
    procession.style.setProperty('--pair-opacity', String(clamp(1 - (p - .43) / .1)));
    procession.style.setProperty('--solo-opacity', String(clamp((p - .45) / .1)));
    const ghostIn = clamp((p - .44) / .08);
    const ghostOut = clamp(1 - (p - .66) / .22);
    procession.style.setProperty('--ghost-opacity', String(ghostIn * ghostOut));
    procession.style.setProperty('--ghost-blur', `${clamp((p - .63) / .25) * 14}px`);
    procession.style.setProperty('--heading-opacity', String(clamp(1 - (p - .72) / .18)));
  };
  const requestSceneUpdate = () => { if (!frame) frame = requestAnimationFrame(updateScenes); };
  addEventListener('scroll', requestSceneUpdate, { passive: true });
  addEventListener('resize', requestSceneUpdate, { passive: true });
  updateScenes();

  const eventTime = new Date(cfg.receptionDate).getTime();
  const updateCountdown = () => {
    const remaining = Math.max(0, eventTime - Date.now());
    $('#days').textContent = String(Math.floor(remaining / 86400000)).padStart(3, '0');
    $('#hours').textContent = String(Math.floor((remaining % 86400000) / 3600000)).padStart(2, '0');
    $('#minutes').textContent = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
    $('#seconds').textContent = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  };
  updateCountdown();
  setInterval(updateCountdown, 1000);
})();
