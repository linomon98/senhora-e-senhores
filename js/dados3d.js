/* Dados 3D com física: são arremessados sobre a mesa, quicam e o resultado
   é a face que fica virada para cima. Usa Three.js (3D) e Cannon.js (física).
   Sem internet (bibliotecas não carregadas), cai num dado simples em 2D. */
window.SS = window.SS || {};
(function (SS) {
  'use strict';

  const CORES = { vermelho: { corpo: '#b3121c', pip: '#ffffff' }, azul: { corpo: '#1f49a6', pip: '#ffffff' } };
  // Ordem dos materiais do BoxGeometry: +x, -x, +y, -y, +z, -z (faces opostas somam 7).
  const VALORES_FACE = [1, 6, 2, 5, 3, 4];
  const NORMAIS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const TAM = 2.1;
  const PIPS = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
  };

  let pronto = false, falhou = false;
  let renderer, cena, camera, mundo, matDado, matMesa, limites;
  let paredes = [], dados = [], estado = null, animando = false, ultimo = 0;
  const materiaisCache = {};

  function texturaFace(valor, cor) {
    const t = 128, cv = document.createElement('canvas');
    cv.width = cv.height = t;
    const g = cv.getContext('2d');
    g.fillStyle = cor.corpo;
    g.fillRect(0, 0, t, t);
    const grad = g.createRadialGradient(t / 2, t / 2, t * 0.15, t / 2, t / 2, t * 0.78);
    grad.addColorStop(0, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = grad;
    g.fillRect(0, 0, t, t);
    g.fillStyle = cor.pip;
    for (const [x, y] of PIPS[valor]) {
      g.beginPath();
      g.arc(x * t, y * t, valor === 1 ? 16 : 11, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  function materiais(nome) {
    if (!materiaisCache[nome]) {
      const cor = CORES[nome] || CORES.vermelho;
      materiaisCache[nome] = VALORES_FACE.map(v => new THREE.MeshStandardMaterial({ map: texturaFace(v, cor), roughness: 0.32, metalness: 0.05, transparent: true }));
    }
    return materiaisCache[nome];
  }

  function iniciar() {
    if (pronto) return true;
    if (falhou || !window.THREE || !window.CANNON) return false;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.id = 'dados3d';
      document.body.appendChild(renderer.domElement);

      cena = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 1, 400);
      camera.position.set(0, 62, 14);
      camera.lookAt(0, 0, 0);
      cena.add(new THREE.AmbientLight(0xffffff, 0.55));
      const luz = new THREE.DirectionalLight(0xffffff, 0.9);
      luz.position.set(-12, 40, 18);
      luz.castShadow = true;
      luz.shadow.mapSize.set(1024, 1024);
      Object.assign(luz.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
      cena.add(luz);
      const chao = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.38 }));
      chao.rotation.x = -Math.PI / 2;
      chao.receiveShadow = true;
      cena.add(chao);

      mundo = new CANNON.World();
      mundo.gravity.set(0, -75, 0);
      mundo.broadphase = new CANNON.NaiveBroadphase();
      mundo.solver.iterations = 14;
      mundo.allowSleep = true;
      matDado = new CANNON.Material('dado');
      matMesa = new CANNON.Material('mesa');
      // Feltro: bastante atrito e pouco quique.
      mundo.addContactMaterial(new CANNON.ContactMaterial(matMesa, matDado, { friction: 0.4, restitution: 0.28 }));
      mundo.addContactMaterial(new CANNON.ContactMaterial(matDado, matDado, { friction: 0.15, restitution: 0.4 }));
      const corpoChao = new CANNON.Body({ mass: 0, material: matMesa });
      corpoChao.addShape(new CANNON.Plane());
      corpoChao.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
      mundo.addBody(corpoChao);
      montarParedes();
      addEventListener('resize', aoRedimensionar);
      pronto = true;
    } catch (err) {
      console.warn('Dados 3D indisponíveis:', err);
      falhou = true;
    }
    return pronto;
  }

  function pontoNoChao(x, y) {
    camera.updateMatrixWorld();
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(x, y), camera);
    const p = new THREE.Vector3();
    rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    return p;
  }

  // Paredes invisíveis nas bordas da tela, para os dados não saírem da mesa.
  function montarParedes() {
    paredes.forEach(b => mundo.removeBody(b));
    paredes = [];
    const a = pontoNoChao(-0.88, 0.85), b = pontoNoChao(0.88, 0.85), c = pontoNoChao(-0.88, -0.85), d = pontoNoChao(0.88, -0.85);
    limites = { minX: Math.max(a.x, c.x), maxX: Math.min(b.x, d.x), minZ: Math.max(a.z, b.z), maxZ: Math.min(c.z, d.z) };
    const Y = new CANNON.Vec3(0, 1, 0);
    const plano = (x, z, ang) => {
      const corpo = new CANNON.Body({ mass: 0, material: matMesa });
      corpo.addShape(new CANNON.Plane());
      corpo.quaternion.setFromAxisAngle(Y, ang);
      corpo.position.set(x, 0, z);
      mundo.addBody(corpo);
      paredes.push(corpo);
    };
    plano(limites.minX, 0, Math.PI / 2);
    plano(limites.maxX, 0, -Math.PI / 2);
    plano(0, limites.minZ, 0);
    plano(0, limites.maxZ, Math.PI);
  }

  function aoRedimensionar() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    montarParedes();
    renderer.render(cena, camera);
  }

  function limpar() {
    for (const d of dados) {
      if (d.corpo) mundo.removeBody(d.corpo);
      cena.remove(d.malha);
      d.malha.geometry.dispose();
    }
    dados = [];
  }

  function faceDeCima(corpo) {
    let melhor = 0, maxY = -2;
    NORMAIS.forEach((n, k) => {
      const w = corpo.quaternion.vmult(new CANNON.Vec3(n[0], n[1], n[2]));
      if (w.y > maxY) {
        maxY = w.y;
        melhor = k;
      }
    });
    return VALORES_FACE[melhor];
  }

  function quadro(t) {
    const dt = Math.min(0.25, (t - ultimo) / 1000);
    ultimo = t;
    if (estado && estado.fase === 'segurando') {
      // Dados girando rápido, em eixos que mudam o tempo todo: não dá para "mirar" uma face.
      dados.forEach((d, k) => {
        if (!d.giro || Math.random() < dt * 2.5) d.giro = { x: 9 + Math.random() * 9, y: 9 + Math.random() * 9, z: 6 + Math.random() * 8 };
        const g = estado.arrastando ? 1.5 : 1;
        d.malha.rotation.x += dt * d.giro.x * g;
        d.malha.rotation.y += dt * d.giro.y * g;
        d.malha.rotation.z += dt * d.giro.z * g;
        if (!estado.arrastando) d.malha.position.y = ALTURA_MAO + Math.sin(t / 300 + k) * 0.4;
      });
      renderer.render(cena, camera);
      requestAnimationFrame(quadro);
      return;
    }
    if (estado && estado.fase === 'rolando') {
      mundo.step(1 / 120, dt, 30);
      estado.tempo += dt;
      const parados = dados.every(d => d.corpo.sleepState === CANNON.Body.SLEEPING ||
        (d.corpo.velocity.norm() < 0.06 && d.corpo.angularVelocity.norm() < 0.06));
      estado.quieto = parados ? estado.quieto + 1 : 0;
      if (estado.quieto > 10 || estado.tempo > 6) {
        const resultado = dados.map(d => faceDeCima(d.corpo));
        const resolver = estado.resolver;
        estado = { fase: 'mostrando', inicio: t };
        resolver(resultado);
      }
    } else if (estado && estado.fase === 'mostrando') {
      const passou = t - estado.inicio;
      if (passou > 1800) {
        const op = Math.max(0, 1 - (passou - 1800) / 500);
        for (const d of dados) d.malha.material.forEach(m => { m.opacity = op; });
        if (op <= 0) {
          limpar();
          estado = null;
        }
      }
    }
    for (const d of dados) {
      if (!d.corpo) continue;
      d.malha.position.copy(d.corpo.position);
      d.malha.quaternion.copy(d.corpo.quaternion);
    }
    renderer.render(cena, camera);
    if (estado) requestAnimationFrame(quadro);
    else animando = false;
  }

  function rolar3D(n, cor, deCima) {
    limpar();
    const mats = materiais(cor);
    mats.forEach(m => { m.opacity = 1; });
    const L = limites;
    for (let k = 0; k < n; k++) {
      const corpo = new CANNON.Body({ mass: 1, material: matDado, shape: new CANNON.Box(new CANNON.Vec3(TAM / 2, TAM / 2, TAM / 2)) });
      corpo.sleepSpeedLimit = 0.2;
      corpo.sleepTimeLimit = 0.3;
      corpo.linearDamping = 0.2;
      corpo.angularDamping = 0.2;
      // Arremesso a partir do canto inferior direito (o seu lado da mesa) ou superior (oponente).
      const z0 = deCima ? L.minZ + 3 + k * 2.6 : L.maxZ - 3 - k * 2.6;
      corpo.position.set(L.maxX - 3 - k * 0.8, 5 + k * 2.4, z0);
      corpo.quaternion.setFromEuler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      const vz = (12 + Math.random() * 5) * (deCima ? 1 : -1);
      corpo.velocity.set(-(22 + Math.random() * 6), 3 + Math.random() * 4, vz);
      corpo.angularVelocity.set((Math.random() - 0.5) * 32, (Math.random() - 0.5) * 32, (Math.random() - 0.5) * 32);
      mundo.addBody(corpo);
      const malha = new THREE.Mesh(new THREE.BoxGeometry(TAM, TAM, TAM), mats);
      malha.castShadow = true;
      cena.add(malha);
      dados.push({ corpo, malha });
    }
    return new Promise(resolver => {
      estado = { fase: 'rolando', tempo: 0, quieto: 0, resolver };
      if (!animando) {
        animando = true;
        ultimo = performance.now();
        requestAnimationFrame(quadro);
      }
    });
  }

  function novoCorpo(x, y, z) {
    const corpo = new CANNON.Body({ mass: 1, material: matDado, shape: new CANNON.Box(new CANNON.Vec3(TAM / 2, TAM / 2, TAM / 2)) });
    corpo.sleepSpeedLimit = 0.2;
    corpo.sleepTimeLimit = 0.3;
    corpo.linearDamping = 0.2;
    corpo.angularDamping = 0.2;
    corpo.position.set(x, y, z);
    return corpo;
  }

  // ---------- Jogar o dado com o mouse (pegar, arrastar e soltar) ----------

  const ALTURA_MAO = 6;
  let removerEventos = null;

  // Abandona qualquer dado na mesa ou na mão (ex.: o jogador desistiu da partida).
  function cancelar() {
    if (removerEventos) removerEventos();
    if (pronto) {
      limpar();
      estado = null;
      renderer.render(cena, camera);
    }
    document.querySelectorAll('.dados2d').forEach(d => d.remove());
  }

  function pontoNaAltura(clientX, clientY, altura) {
    camera.updateMatrixWorld();
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), camera);
    const p = new THREE.Vector3();
    rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -altura), p);
    const m = 2;
    p.x = Math.max(limites.minX + m, Math.min(limites.maxX - m, p.x));
    p.z = Math.max(limites.minZ + m, Math.min(limites.maxZ - m, p.z));
    return p;
  }

  function mostrarAviso(texto) {
    let el = document.getElementById('aviso-dado');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aviso-dado';
      document.body.appendChild(el);
    }
    el.textContent = texto;
    el.hidden = !texto;
  }

  function rolarArrastando(n, cor) {
    limpar();
    const mats = materiais(cor);
    mats.forEach(m => { m.opacity = 1; });
    for (let k = 0; k < n; k++) {
      const malha = new THREE.Mesh(new THREE.BoxGeometry(TAM, TAM, TAM), mats);
      malha.castShadow = true;
      malha.position.set((k - (n - 1) / 2) * 2.8, ALTURA_MAO, 0);
      malha.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      cena.add(malha);
      dados.push({ corpo: null, malha, deslocamento: (k - (n - 1) / 2) * 2.8 });
    }
    const cv = renderer.domElement;
    cv.style.pointerEvents = 'auto';
    cv.style.cursor = 'grab';
    mostrarAviso(n > 1 ? `Pegue os ${n} dados e jogue na mesa` : 'Pegue o dado e jogue na mesa');
    return new Promise(resolver => {
      estado = { fase: 'segurando', arrastando: false, trilha: [], resolver };
      const mover = ev => {
        if (!estado || !estado.arrastando) return;
        const p = pontoNaAltura(ev.clientX, ev.clientY, ALTURA_MAO);
        for (const d of dados) d.malha.position.set(p.x + d.deslocamento, ALTURA_MAO, p.z);
        estado.trilha.push({ x: p.x, z: p.z, t: performance.now() });
        if (estado.trilha.length > 8) estado.trilha.shift();
      };
      const pegar = ev => {
        estado.arrastando = true;
        estado.trilha = [];
        cv.style.cursor = 'grabbing';
        mover(ev);
      };
      const soltar = () => {
        if (!estado || !estado.arrastando) return;
        if (removerEventos) removerEventos();
        // Velocidade do arremesso = velocidade do mouse nos últimos instantes.
        const tr = estado.trilha.filter(q => performance.now() - q.t < 150);
        let vx = 0, vz = 0;
        if (tr.length >= 2) {
          const a = tr[0], b = tr[tr.length - 1], dtl = Math.max(0.016, (b.t - a.t) / 1000);
          vx = (b.x - a.x) / dtl;
          vz = (b.z - a.z) / dtl;
        }
        let v = Math.hypot(vx, vz);
        if (v < 22) {
          // Toquinho ou só soltou: vira um arremesso de verdade, numa direção sorteada.
          const ang = v < 4 ? Math.random() * Math.PI * 2 : Math.atan2(vz, vx) + (Math.random() - 0.5) * 1.2;
          v = 22 + Math.random() * 10;
          vx = Math.cos(ang) * v;
          vz = Math.sin(ang) * v;
        }
        if (v > 55) {
          vx *= 55 / v;
          vz *= 55 / v;
        }
        for (const d of dados) {
          const pos = d.malha.position;
          d.corpo = novoCorpo(pos.x, pos.y, pos.z);
          // Orientação sorteada na hora de soltar: a face de cima não dá para prever pelo giro.
          d.corpo.quaternion.setFromEuler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
          d.corpo.velocity.set(vx * (0.85 + Math.random() * 0.3), 3 + Math.random() * 3, vz * (0.85 + Math.random() * 0.3));
          const giro = 40 + Math.random() * 20;
          d.corpo.angularVelocity.set((Math.random() - 0.5) * giro, (Math.random() - 0.5) * giro, (Math.random() - 0.5) * giro);
          mundo.addBody(d.corpo);
        }
        estado = { fase: 'rolando', tempo: 0, quieto: 0, resolver };
      };
      cv.addEventListener('pointerdown', pegar);
      addEventListener('pointermove', mover);
      addEventListener('pointerup', soltar);
      removerEventos = () => {
        cv.removeEventListener('pointerdown', pegar);
        removeEventListener('pointermove', mover);
        removeEventListener('pointerup', soltar);
        cv.style.pointerEvents = 'none';
        cv.style.cursor = '';
        mostrarAviso('');
        removerEventos = null;
      };
      if (!animando) {
        animando = true;
        ultimo = performance.now();
        requestAnimationFrame(quadro);
      }
    });
  }

  // Alternativa sem 3D: dados 2D sorteando números por um instante.
  function rolar2D(n, cor) {
    const caixa = document.createElement('div');
    caixa.className = 'dados2d ' + cor;
    caixa.innerHTML = Array.from({ length: n }, () => '<span>?</span>').join('');
    document.body.appendChild(caixa);
    const faces = [...caixa.children];
    return new Promise(resolver => {
      const fim = performance.now() + 900;
      const tique = () => {
        const valores = faces.map(f => {
          const v = 1 + Math.floor(Math.random() * 6);
          f.textContent = '⚀⚁⚂⚃⚄⚅'[v - 1];
          return v;
        });
        if (performance.now() < fim) setTimeout(tique, 70);
        else {
          resolver(valores);
          setTimeout(() => caixa.remove(), 1500);
        }
      };
      tique();
    });
  }

  // deCima: o dado sai do lado de cima da mesa (jogador de cima).
  function rolar(n, cor, deCima) {
    return iniciar() ? rolar3D(n, cor, !!deCima) : rolar2D(n, cor);
  }

  // Começa a apagar os dados parados agora, sem esperar o tempo normal na mesa.
  function sumir() {
    if (estado && estado.fase === 'mostrando') estado.inicio = performance.now() - 1800;
    document.querySelectorAll('.dados2d').forEach(d => d.remove());
  }

  SS.Dados = {
    iniciar, rolar, sumir, cancelar, temFisica: () => pronto,
    // O jogador pega o dado no centro da tela e arremessa na mesa.
    jogar: (n, cor) => (iniciar() ? rolarArrastando(n, cor) : rolar2D(n, cor)),
    depurar: () => ({ limites, estado: estado && estado.fase, dados: dados.map(d => ({ p: d.corpo.position.toString(), v: d.corpo.velocity.norm().toFixed(2), sono: d.corpo.sleepState })) }),
  };
})(window.SS);
