document.addEventListener('DOMContentLoaded', () => {
    
    // --- THEME TOGGLE ---
    const themeToggle = document.getElementById('theme-toggle');
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    const htmlEl = document.documentElement;

    function applyTheme(theme) {
        htmlEl.setAttribute('data-theme', theme);
        lightIcon.classList.toggle('hidden', theme === 'light');
        darkIcon.classList.toggle('hidden', theme === 'dark');
    }
    themeToggle.addEventListener('click', () => {
        const newTheme = htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    // --- INTERSECTION OBSERVER ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); });
    }, { threshold: 0.2 });
    document.querySelectorAll('.gallery-section').forEach(section => observer.observe(section));

    // --- MOUSE/TOUCH-MOVE ART PIECE ---
    const artPieces = document.querySelectorAll('.art-piece');
    function handleArtPieceMove(e) {
        const { clientX, clientY } = e.touches ? e.touches[0] : e;
        const centerX = window.innerWidth / 2, centerY = window.innerHeight / 2;
        const deltaX = clientX - centerX, deltaY = clientY - centerY;
        artPieces.forEach(piece => {
            const depth = parseFloat(piece.dataset.depth) || 0.01;
            const moveX = deltaX * depth, moveY = deltaY * depth;
            const rotateX = -deltaY * depth * 2, rotateY = deltaX * depth * 2;
            piece.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            const rect = piece.getBoundingClientRect();
            piece.style.setProperty('--mouse-x', `${clientX - rect.left}px`);
            piece.style.setProperty('--mouse-y', `${clientY - rect.top}px`);
        });
    }
    window.addEventListener('mousemove', handleArtPieceMove);
    window.addEventListener('touchmove', handleArtPieceMove, { passive: true });

    // --- UTILITY FUNCTIONS ---
    function getCanvasCoordinates(e, c) {
        const rect = c.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return [touch.clientX - rect.left, touch.clientY - rect.top];
    }
    function resizeAllCanvases() {
        resizeCanvas(canvas, true);
        initParticles(); // This will resize the particle canvas and restart the animation
        onWindowResizeThree();
    }
    function resizeCanvas(c, preserveContent = true) {
        const ctx = c.getContext('2d');
        const tempCanvas = document.createElement('canvas');
        if (preserveContent && c.width > 0 && c.height > 0) {
            tempCanvas.width = c.width; tempCanvas.height = c.height;
            tempCanvas.getContext('2d').drawImage(c, 0, 0);
        }
        if (c.offsetWidth > 0 && c.offsetHeight > 0) {
            c.width = c.offsetWidth; c.height = c.offsetHeight;
            if (preserveContent && tempCanvas.width > 0) ctx.drawImage(tempCanvas, 0, 0);
        }
    }

    // --- DIGITAL CANVAS ---
    const canvas = document.getElementById('drawingCanvas'), ctx = canvas.getContext('2d');
    const clearBtn = document.getElementById('clearCanvasBtn'), colorPicker = document.getElementById('colorPicker');
    const brushSizeSlider = document.getElementById('brushSize'), downloadBtn = document.getElementById('downloadBtn');
    let isDrawing = false, lastX = 0, lastY = 0;

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const [currentX, currentY] = getCanvasCoordinates(e, canvas);
        ctx.strokeStyle = colorPicker.value; ctx.lineWidth = brushSizeSlider.value;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(currentX, currentY); ctx.stroke();
        [lastX, lastY] = [currentX, currentY];
    }
    function startDrawing(e) { isDrawing = true; [lastX, lastY] = getCanvasCoordinates(e, canvas); }
    function stopDrawing() { if (isDrawing) saveCanvas(); isDrawing = false; }
    function saveCanvas() { try { localStorage.setItem('savedCanvasDrawing', canvas.toDataURL()); } catch (err) { console.error(err); } }
    function loadCanvas() {
        const dataURL = localStorage.getItem('savedCanvasDrawing');
        if (dataURL) { const img = new Image(); img.src = dataURL; img.onload = () => ctx.drawImage(img, 0, 0); }
    }
    canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    clearBtn.addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); localStorage.removeItem('savedCanvasDrawing'); });
    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a'); link.download = 'my-artwork.png';
        link.href = canvas.toDataURL('image/png'); link.click();
    });
    
    // --- WEB AUDIO THEREMIN (FIXED) ---
    const audioToggleBtn = document.getElementById('audioToggleBtn'), thereminBox = document.getElementById('theremin');
    const thereminIndicator = document.getElementById('theremin-indicator'), oscControls = document.getElementById('oscillator-controls');
    let audioContext, oscillator, gainNode, isAudioInitialized = false, currentOscType = 'sine';

    function createOscillator() {
        if (oscillator) oscillator.stop();
        oscillator = audioContext.createOscillator();
        oscillator.type = currentOscType;
        oscillator.connect(gainNode);
        oscillator.start();
    }
    function initAudio() {
        if (isAudioInitialized) return;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        createOscillator();
        isAudioInitialized = true;
    }
    function handleThereminInteraction(e) {
        if (!isAudioInitialized || audioContext.state !== 'running') return;
        const rect = thereminBox.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        const x = touch.clientX - rect.left, y = touch.clientY - rect.top;
        const freq = (x / rect.width) * 900 + 100;
        const vol = Math.max(0, 1 - (y / rect.height));
        if (freq > 100 && freq < 1000) oscillator.frequency.setTargetAtTime(freq, audioContext.currentTime, 0.01);
        gainNode.gain.setTargetAtTime(vol, audioContext.currentTime, 0.01);
        thereminIndicator.style.left = `${x}px`; thereminIndicator.style.top = `${y}px`;
    }
    audioToggleBtn.addEventListener('click', () => {
        if (!isAudioInitialized) initAudio();
        if (audioContext.state === 'suspended') audioContext.resume();
        audioToggleBtn.style.display = 'none'; oscControls.style.display = 'flex';
        document.getElementById('theremin-text').textContent = "X-axis: pitch, Y-axis: volume.";
    });
    thereminBox.addEventListener('mousemove', handleThereminInteraction);
    thereminBox.addEventListener('touchmove', handleThereminInteraction, { passive: true });
    thereminBox.addEventListener('mouseenter', () => { if (isAudioInitialized && audioContext.state === 'running') thereminIndicator.style.display = 'block'; });
    thereminBox.addEventListener('mouseleave', () => { if (isAudioInitialized) gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.02); thereminIndicator.style.display = 'none'; });
    oscControls.addEventListener('click', e => {
        if (e.target.classList.contains('osc-btn')) {
            currentOscType = e.target.dataset.type;
            createOscillator();
            document.querySelectorAll('.osc-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
        }
    });

    // --- PARTICLE NEXUS (FIXED & ENHANCED) ---
    const pCanvas = document.getElementById('particleCanvas'), pCtx = pCanvas.getContext('2d');
    let particles = [], pMouse = { x: null, y: null }, gravityWell = { x: null, y: null, life: 0, strength: 0 };
    let pAnimationId, tick = 0;

    class Particle {
        constructor() {
            this.x = Math.random() * pCanvas.width;
            this.y = Math.random() * pCanvas.height;
            this.size = Math.random() * 2 + 1;
            this.baseSize = this.size;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
            this.color = `rgba(var(--glow-color-rgb), 0.8)`;
        }
        update() {
            // Pulsing effect
            this.size = this.baseSize + Math.sin(tick * 0.05 + this.x) * 0.5;

            // Repulsion from mouse
            if (pMouse.x != null) {
                const dx = this.x - pMouse.x;
                const dy = this.y - pMouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = 100;
                if (distance < minDistance && distance > 0) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (minDistance - distance) / minDistance;
                    this.x += forceDirectionX * force * 5;
                    this.y += forceDirectionY * force * 5;
                }
            }

            // Attraction to gravity well
            if (gravityWell.life > 0) {
                const dx = gravityWell.x - this.x;
                const dy = gravityWell.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 1) {
                    this.x += dx / distance * gravityWell.strength;
                    this.y += dy / distance * gravityWell.strength;
                }
            }

            // Move particle
            this.x += this.speedX;
            this.y += this.speedY;

            // Boundary collision
            if (this.x - this.size < 0) { this.x = this.size; this.speedX *= -1; }
            if (this.x + this.size > pCanvas.width) { this.x = pCanvas.width - this.size; this.speedX *= -1; }
            if (this.y - this.size < 0) { this.y = this.size; this.speedY *= -1; }
            if (this.y + this.size > pCanvas.height) { this.y = pCanvas.height - this.size; this.speedY *= -1; }
        }
        draw() {
            pCtx.fillStyle = this.color;
            pCtx.beginPath();
            pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            pCtx.fill();
        }
    }
    function initParticles() {
        if (pAnimationId) cancelAnimationFrame(pAnimationId);
        resizeCanvas(pCanvas, false);
        particles = [];
        for (let i = 0; i < (window.innerWidth > 768 ? 100 : 40); i++) {
            particles.push(new Particle());
        }
        animateParticles();
    }
    function connectParticles() {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a; b < particles.length; b++) {
                const dx = particles[a].x - particles[b].x, dy = particles[a].y - particles[b].y, distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 120) {
                    pCtx.strokeStyle = `rgba(var(--glow-color-rgb), ${1 - distance / 120})`;
                    pCtx.lineWidth = 0.5; pCtx.beginPath(); pCtx.moveTo(particles[a].x, particles[a].y); pCtx.lineTo(particles[b].x, particles[b].y); pCtx.stroke();
                }
            }
        }
    }
    function animateParticles() {
        pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
        
        if (gravityWell.life > 0) {
            gravityWell.life--;
            pCtx.beginPath();
            pCtx.arc(gravityWell.x, gravityWell.y, gravityWell.life / 6, 0, 2 * Math.PI);
            pCtx.strokeStyle = `rgba(var(--glow-color-rgb), ${gravityWell.life / 180 * 0.5})`;
            pCtx.stroke();
        }

        particles.forEach(p => { p.update(); p.draw(); });
        connectParticles();
        tick++;
        pAnimationId = requestAnimationFrame(animateParticles);
    }
    function handleParticleInteraction(e) { [pMouse.x, pMouse.y] = getCanvasCoordinates(e, pCanvas); }
    function createGravityWell(e) {
        e.preventDefault();
        [gravityWell.x, gravityWell.y] = getCanvasCoordinates(e, pCanvas);
        gravityWell.life = 180;
        gravityWell.strength = 1.5;
    }
    pCanvas.addEventListener('mousemove', handleParticleInteraction);
    pCanvas.addEventListener('touchmove', handleParticleInteraction, { passive: true });
    pCanvas.addEventListener('mouseleave', () => { pMouse.x = null; pMouse.y = null; });
    pCanvas.addEventListener('touchend', () => { pMouse.x = null; pMouse.y = null; });
    pCanvas.addEventListener('click', createGravityWell);
    pCanvas.addEventListener('touchstart', createGravityWell, { passive: false });
    
    // --- THREE.JS KINETIC SCULPTURE ---
    const threeContainer = document.getElementById('three-container');
    let scene, camera, renderer, mesh, pointLight;
    function initThree() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        threeContainer.appendChild(renderer.domElement);
        const geometry = new THREE.TorusKnotGeometry(0.8, 0.25, 100, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ffff, roughness: 0.3, metalness: 0.8 });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);
        pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);
        camera.position.z = 3;
    }
    function animateThree() {
        requestAnimationFrame(animateThree);
        mesh.rotation.x += 0.005; mesh.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    function handleThreeInteraction(e) {
        if (pointLight) {
            const rect = threeContainer.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
            pointLight.position.x = x * 5;
            pointLight.position.y = y * 5;
        }
    }
    function onWindowResizeThree() {
        if(camera && renderer) {
            camera.aspect = threeContainer.clientWidth / threeContainer.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
        }
    }
    initThree();
    animateThree();
    threeContainer.addEventListener('mousemove', handleThreeInteraction);
    threeContainer.addEventListener('touchmove', handleThreeInteraction, { passive: true });

    // --- INITIAL LOAD AND RESIZE HANDLING ---
    window.addEventListener('resize', resizeAllCanvases);
    resizeCanvas(canvas, true);
    loadCanvas();
    initParticles();
});