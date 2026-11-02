import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('world');
  const chapters = [
    { name:'GLASS MERIDIAN', boss:'THE CHOIR', palette:['#78f3ff','#9670ff','#ff65cd'], location:'A city built from the last things we said.', intro:'The stars used to sing. Then one by one, they learned to be afraid.', middle:'That voice is not an echo. It is choosing the words it wants me to hear.', outro:'The Choir breaks apart. Every shard sings in her voice. “I am still here, Mara.”', line:'“You left me in the dark.”', mode:0 },
    { name:'CATHEDRAL OF TIDES', boss:'THE MOTHER', palette:['#74ffd2','#49aaff','#ff83d2'], location:'An ocean suspended inside a bell.', intro:'The Lark descends through a sea with no shore. Below it, a cathedral rings without sound.', middle:'I remember this place. Anya made me promise we would never be alone here.', outro:'The bell finally rings. A thousand lost memories move like fish through the water.', line:'“I kept your voice alive.”', mode:1 },
    { name:'THE WHITE STATIC', boss:'THE SILENCE', palette:['#ffebac','#ff966e','#f8f4ff'], location:'Beyond the edge of every remembered world.', intro:'Nothing remains ahead but the silence that ate the sky. The signal is strongest there.', middle:'It is not a monster. It is the last place where I put my grief.', outro:'Mara reaches for the voice inside the white. For once, the universe listens.', line:'“Now choose what the universe remembers.”', mode:2 }
  ];
  let chapterIndex=0,chapter=chapters[0],theme=paletteOf(chapter),modifier='standard',aiName='',aiOmen='';
  let renderer,composer,scene,camera,clock,ship,shipLight,bossRoot,bossCore,bossRing,starField,sparkField;
  let state='menu',storyBeat='intro',time=0,actTime=0,score=0,shards=0,hull=100,speed=30,phaseLeft=0,phaseCooldown=0,fireCooldown=0,bossTime=0,attackTime=0,shake=0,muted=false;
  let entities=[],shots=[],enemyShots=[],sparks=[],keys=Object.create(null),musicTimer=null,audio=null;
  let rings=[],city=[],eyes=[],cameraShake=new THREE.Vector3();
  const screens={menu:$('start-screen'),story:$('story-screen'),pause:$('pause-screen'),over:$('over-screen')};
  const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const paletteOf=(c)=>({a:c.palette[0],b:c.palette[1],c:c.palette[2]});
  const campaignSaved=()=>Number(localStorage.getItem('mv-campaign')||'1');

  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  } catch (err) {
    console.error('MEMORY//VOID requires WebGL 2.',err);
    $('story-title').textContent='A 3D graphics device is required.';
    $('story-copy').textContent='This build needs WebGL 2. Update your graphics driver or try a PC with 3D hardware acceleration enabled.';
    $('story-location').textContent='RENDERER UNAVAILABLE';$('story-button-label').textContent='RETURN';
    $('start-screen').classList.add('hidden');$('story-screen').classList.remove('hidden');$('story-screen').classList.add('active');
    document.body.classList.add('no-webgl');
  }
  if(!renderer)return;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.22;
  renderer.setClearColor(0x060710,1);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x060710);scene.fog=new THREE.FogExp2(0x070713,.0042);
  camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.1,260);
  camera.position.set(0,5.1,15.5);camera.lookAt(0,0,-32);
  const ambient=new THREE.HemisphereLight(0x9ab6ff,0x17111f,1.4);scene.add(ambient);
  const keyLight=new THREE.PointLight(0x78dfff,180,100,1.5);keyLight.position.set(-12,10,-10);scene.add(keyLight);
  const pinkLight=new THREE.PointLight(0xc05aff,150,95,1.5);pinkLight.position.set(14,-5,-32);scene.add(pinkLight);
  const shipLamp=new THREE.PointLight(0x7cfaff,36,32,2);scene.add(shipLamp);
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.92,.62,.17);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(bloom);
  clock=new THREE.Clock();

  function material(color,{metalness=.35,roughness=.35,emissive=0,intensity=.4,transparent=false,opacity=1,wireframe=false}={}) {
    const m=new THREE.MeshStandardMaterial({color,metalness,roughness,emissive:new THREE.Color(color),emissiveIntensity:intensity,transparent,opacity,wireframe,depthWrite:!transparent});
    m.userData.paletteColor=true;return m;
  }
  function applyPalette() {
    for(const o of scene.children)o.traverse?.(node=>{const mats=Array.isArray(node.material)?node.material:[node.material];for(const m of mats)if(m?.userData.paletteRole){const col=theme[m.userData.paletteRole];m.color.set(col);if(m.emissive)m.emissive.set(col);}});
    if(starField)starField.material.color.set(theme.a);
  }
  function pmat(role,opts={}) {const m=material(theme[role],opts);m.userData.paletteRole=role;return m;}
  function makeShip() {
    const g=new THREE.Group();
    const hullMat=new THREE.MeshPhysicalMaterial({color:0xdde5ff,metalness:.8,roughness:.22,clearcoat:1,clearcoatRoughness:.1,emissive:0x162b54,emissiveIntensity:.3});
    const wingMat=new THREE.MeshPhysicalMaterial({color:0xbcc8e8,metalness:.82,roughness:.25,clearcoat:1,emissive:new THREE.Color(theme.b),emissiveIntensity:.16});
    const body=new THREE.Mesh(new THREE.ConeGeometry(.58,2.7,7),hullMat);body.rotation.x=-Math.PI/2;g.add(body);
    const shape=new THREE.Shape();shape.moveTo(0,-1.55);shape.lineTo(-.48,-.3);shape.lineTo(-2.3,.62);shape.lineTo(-2.05,1.04);shape.lineTo(-.46,.62);shape.lineTo(0,.3);shape.lineTo(.46,.62);shape.lineTo(2.05,1.04);shape.lineTo(2.3,.62);shape.lineTo(.48,-.3);shape.closePath();
    const wingGeo=new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.04,bevelThickness:.04});wingGeo.translate(0,0,-.04);
    const wings=new THREE.Mesh(wingGeo,wingMat);g.add(wings);
    const canopy=new THREE.Mesh(new THREE.SphereGeometry(.35,16,12),new THREE.MeshPhysicalMaterial({color:0x6bdfff,metalness:.65,roughness:.08,transmission:.18,emissive:0x249cff,emissiveIntensity:1.25}));canopy.scale.set(.64,1.5,.85);canopy.position.set(0,-.08,-.45);g.add(canopy);
    const goldLine=new THREE.Mesh(new THREE.BoxGeometry(.045,.018,1.5),new THREE.MeshBasicMaterial({color:0xffe7a1}));goldLine.position.set(0,.34,.35);g.add(goldLine);
    for(const x of [-.48,.48]){
      const engine=new THREE.Mesh(new THREE.CylinderGeometry(.17,.24,.84,12,1,true),new THREE.MeshBasicMaterial({color:theme.a,side:THREE.DoubleSide,transparent:true,opacity:.87,blending:THREE.AdditiveBlending,depthWrite:false}));engine.rotation.x=Math.PI/2;engine.position.set(x,.2,1.25);g.add(engine);
      const plume=new THREE.Mesh(new THREE.ConeGeometry(.22,2.9,12,1,true),new THREE.MeshBasicMaterial({color:theme.a,transparent:true,opacity:.27,blending:THREE.AdditiveBlending,depthWrite:false}));plume.rotation.x=Math.PI/2;plume.position.set(x,.2,2.45);plume.userData.enginePlume=true;g.add(plume);
      const inner=new THREE.Mesh(new THREE.ConeGeometry(.105,1.9,10,1,true),new THREE.MeshBasicMaterial({color:0xfff6de,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false}));inner.rotation.x=Math.PI/2;inner.position.set(x,.2,1.95);inner.userData.engineInner=true;g.add(inner);
    }
    const shield=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),new THREE.MeshBasicMaterial({color:theme.a,wireframe:true,transparent:true,opacity:.17,blending:THREE.AdditiveBlending,depthWrite:false}));shield.scale.set(2.65,1.2,1.7);shield.visible=false;shield.userData.phaseShield=true;g.add(shield);
    g.position.set(0,-2.6,6.4);scene.add(g);return g;
  }
  function makeStars() {
    const count=2100,positions=new Float32Array(count*3),colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions[i*3]=rand(-85,85);positions[i*3+1]=rand(-48,48);positions[i*3+2]=rand(-205,14);const c=new THREE.Color(i%9===0?theme.a:'#c3c8ff');colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const points=new THREE.Points(geo,new THREE.PointsMaterial({size:.17,sizeAttenuation:true,transparent:true,opacity:.85,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(points);starField=points;
  }
  function makeSparkField(){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(5000*3),3));geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(5000*3),3));
    const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:.21,sizeAttenuation:true,transparent:true,opacity:1,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(pts);sparkField=pts;}
  function makeBackdrop() {
    new THREE.TextureLoader().load('assets/title-art.png',texture=>{texture.colorSpace=THREE.SRGBColorSpace;const plane=new THREE.Mesh(new THREE.PlaneGeometry(175,98),new THREE.MeshBasicMaterial({map:texture,color:0x77728d,transparent:true,opacity:.34,depthWrite:false}));plane.position.set(0,3,-118);scene.add(plane);});
    const planet=new THREE.Mesh(new THREE.SphereGeometry(10,48,40),new THREE.MeshStandardMaterial({color:0x20203e,metalness:.42,roughness:.75,emissive:0x391969,emissiveIntensity:.45}));planet.position.set(-34,22,-75);scene.add(planet);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(12,.09,10,96),new THREE.MeshBasicMaterial({color:0xe58aff,transparent:true,opacity:.7,blending:THREE.AdditiveBlending}));halo.scale.set(1.5,.36,1);halo.position.copy(planet.position);halo.rotation.x=.26;scene.add(halo);
  }
  function makeTunnelAndCity() {
    rings=[];city=[];
    for(let i=0;i<26;i++){const rg=new THREE.Group(),geo=new THREE.TorusGeometry(25,.045+(i%3)*.018,6,112),m=pmat(i%4===0?'b':'a',{metalness:.5,roughness:.28,emissive:0, intensity:.7,transparent:true,opacity:.32,wireframe:i%5===0});const torus=new THREE.Mesh(geo,m);torus.scale.y=.68;rg.add(torus);
      for(let k=0;k<8;k++){const a=k*Math.PI/4;const node=new THREE.Mesh(new THREE.SphereGeometry(.095,8,6),new THREE.MeshBasicMaterial({color:k%2?theme.a:theme.c}));node.position.set(Math.cos(a)*25,Math.sin(a)*17,0);rg.add(node);}
      rg.position.z=-12-i*9;rg.rotation.z=i*.025;scene.add(rg);rings.push(rg);
    }
    for(let i=0;i<78;i++){
      const g=new THREE.Group(),side=i%2?1:-1,depth=-rand(12,200),x=side*rand(15,37),h=rand(4,19),w=rand(1.3,5.2);
      let mesh;
      if(chapters[chapterIndex].mode===0){mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,w*rand(.55,1.3)),new THREE.MeshStandardMaterial({color:0x13132a,metalness:.8,roughness:.38,emissive:theme.b,emissiveIntensity:.12}));}
      else if(chapters[chapterIndex].mode===1){mesh=new THREE.Mesh(new THREE.CylinderGeometry(w*.2,w*.65,h,7,2),new THREE.MeshStandardMaterial({color:0x101b31,metalness:.55,roughness:.4,emissive:theme.a,emissiveIntensity:.1}));}
      else{mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(w,0),new THREE.MeshStandardMaterial({color:0x27212d,metalness:.55,roughness:.35,emissive:theme.c,emissiveIntensity:.16,wireframe:i%4===0}));}
      mesh.position.y=rand(-10,13);mesh.rotation.set(rand(0,6),rand(0,6),rand(0,6));g.add(mesh);
      if(i%3===0){const beam=new THREE.Mesh(new THREE.BoxGeometry(.045,h*.75,.045),new THREE.MeshBasicMaterial({color:i%2?theme.a:theme.b,transparent:true,opacity:.6}));beam.position.set(side*w*.25,-h*.05,0);g.add(beam);}
      g.position.set(x,0,depth);g.userData.drift=rand(.92,1.1);scene.add(g);city.push(g);
    }
  }
  function resetEnvironment(){for(const r of rings)scene.remove(r);for(const c of city)scene.remove(c);scene.remove(starField);scene.remove(sparkField);makeStars();makeSparkField();makeTunnelAndCity();applyPalette();}
  function paletteChange(){theme=window.aiDream?.theme||paletteOf(chapter);scene.fog.color.set(theme.b);ambient.color.set(theme.a);keyLight.color.set(theme.a);pinkLight.color.set(theme.b);resetEnvironment();buildShipTheme();}
  function buildShipTheme(){ship?.traverse(n=>{if(n.material?.userData.phaseShield)n.material.color.set(theme.a);if(n.userData.enginePlume||n.userData.engineInner){n.material.color.set(n.userData.engineInner?0xfff5d9:theme.a);}if(n.material?.emissive&&n.material.emissiveIntensity<.5)n.material.emissive.set(theme.b);});}
  ship=makeShip();makeStars();makeSparkField();makeBackdrop();makeTunnelAndCity();

  function createEntity(type,x,y,z) {
    const g=new THREE.Group();let radius;
    if(type==='memory'){
      radius=.75;const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.65,0),new THREE.MeshPhysicalMaterial({color:0xfff0c1,metalness:.5,roughness:.1,emissive:new THREE.Color(theme.a),emissiveIntensity:1.8,clearcoat:1}));gem.rotation.z=Math.PI/4;g.add(gem);
      const cage=new THREE.Mesh(new THREE.IcosahedronGeometry(.93,0),new THREE.MeshBasicMaterial({color:theme.a,wireframe:true,transparent:true,opacity:.72,blending:THREE.AdditiveBlending}));g.add(cage);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(1.15,.025,6,48),new THREE.MeshBasicMaterial({color:theme.b,transparent:true,opacity:.86,blending:THREE.AdditiveBlending}));halo.rotation.x=Math.PI/2;g.add(halo);
      const light=new THREE.PointLight(theme.a,12,10,2);g.add(light);
    }else{
      radius=1.55;const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0x11111e,metalness:.85,roughness:.28,emissive:new THREE.Color(theme.c),emissiveIntensity:.35}));g.add(core);
      for(let i=0;i<7;i++){const shard=new THREE.Mesh(new THREE.OctahedronGeometry(rand(.35,.8),0),new THREE.MeshStandardMaterial({color:0x252039,metalness:.78,roughness:.22,emissive:new THREE.Color(theme.c),emissiveIntensity:.46}));const a=i*Math.PI*2/7;shard.position.set(Math.cos(a)*rand(.9,1.7),Math.sin(a)*rand(.65,1.3),rand(-.55,.55));shard.rotation.set(rand(0,6),rand(0,6),rand(0,6));g.add(shard);}
      const halo=new THREE.Mesh(new THREE.TorusGeometry(1.85,.04,7,56),new THREE.MeshBasicMaterial({color:theme.c,transparent:true,opacity:.76,blending:THREE.AdditiveBlending}));halo.rotation.x=Math.PI/2;g.add(halo);
    }
    g.position.set(x,y,z);g.userData.baseY=y;g.userData.spin=rand(.5,1.8);g.userData.radius=radius;scene.add(g);entities.push({type,mesh:g,radius});
  }
  function spawnEntity(){const z=-rand(82,112),x=rand(-13.5,13.5),y=rand(-7,7);const type=Math.random()<.34?'memory':'hazard';createEntity(type,x,y,z);if(type==='memory'&&Math.random()<.22)createEntity('memory',x+rand(-1.8,1.8),y+rand(-.9,.9),z-rand(1.2,3));}
  function makeBoss(){
    clearBoss();bossRoot=new THREE.Group();const bodyMat=new THREE.MeshPhysicalMaterial({color:0xcac6d8,metalness:.68,roughness:.26,clearcoat:1,emissive:new THREE.Color(theme.b),emissiveIntensity:.42});
    const face=new THREE.Mesh(new THREE.IcosahedronGeometry(5.6,2),bodyMat);face.scale.set(1,.98,.58);bossRoot.add(face);
    const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(4.4,1),new THREE.MeshStandardMaterial({color:0x120e20,metalness:.55,roughness:.28,emissive:new THREE.Color(theme.b),emissiveIntensity:.35}));inner.scale.set(1,.95,.52);inner.position.z=.45;bossRoot.add(inner);
    for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.TorusGeometry(1.05,.19,10,40),new THREE.MeshBasicMaterial({color:theme.a,blending:THREE.AdditiveBlending}));eye.position.set(side*1.82,.82,3.08);eye.scale.set(1.25,.47,1);bossRoot.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.27,14,10),new THREE.MeshBasicMaterial({color:0xfff8e7}));pupil.position.set(side*1.82,.82,3.13);bossRoot.add(pupil);eyes.push(pupil);}
    bossCore=new THREE.Mesh(new THREE.SphereGeometry(1.08,28,22),new THREE.MeshPhysicalMaterial({color:0xffedbb,metalness:.15,roughness:.08,emissive:0xffb5dd,emissiveIntensity:2.2,transmission:.28}));bossCore.position.set(0,-1.36,3.2);bossRoot.add(bossCore);
    bossRing=new THREE.Group();for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(7.4+i*.62,.045+i*.012,8,96),new THREE.MeshBasicMaterial({color:i%2?theme.a:theme.b,transparent:true,opacity:.78,blending:THREE.AdditiveBlending}));ring.rotation.set(rand(0,2),rand(0,2),rand(0,2));bossRing.add(ring);}bossRoot.add(bossRing);
    for(let i=0;i<12;i++){const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(rand(.45,1.15),0),new THREE.MeshStandardMaterial({color:0x211b34,metalness:.78,roughness:.2,emissive:new THREE.Color(i%2?theme.a:theme.c),emissiveIntensity:.65}));const a=i*Math.PI/6;crystal.position.set(Math.cos(a)*rand(6.4,8.4),Math.sin(a)*rand(4,6),rand(-1.4,1.2));crystal.rotation.set(rand(0,6),rand(0,6),rand(0,6));bossRoot.add(crystal);}
    const aura=new THREE.PointLight(theme.b,130,48,1.7);aura.position.z=2;bossRoot.add(aura);
    bossRoot.position.set(0,0,-27);scene.add(bossRoot);bossRoot.userData.hp=100;bossRoot.userData.maxHp=100;bossRoot.userData.phase=1;
  }
  function clearBoss(){if(bossRoot){scene.remove(bossRoot);bossRoot.traverse(n=>{if(n.geometry)n.geometry.dispose();});bossRoot=null;}bossCore=null;bossRing=null;eyes=[];}
  function makeShot(x,y,z,foe=false){const g=new THREE.Group();const color=foe?theme.c:theme.a;const orb=new THREE.Mesh(new THREE.SphereGeometry(foe?.26:.18,12,10),new THREE.MeshBasicMaterial({color:foe?0xffa7e7:0xfff7db,blending:THREE.AdditiveBlending}));g.add(orb);const trail=new THREE.Mesh(new THREE.CylinderGeometry(foe?.07:.045,foe?.02:.018,foe?2.3:1.55,8,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.74,blending:THREE.AdditiveBlending,depthWrite:false}));trail.rotation.x=Math.PI/2;trail.position.z=foe?1.12:.78;g.add(trail);g.position.set(x,y,z);scene.add(g);return g;}
  function firePulse(){if(state!=='playing'||fireCooldown>0)return;fireCooldown=.24;const mesh=makeShot(ship.position.x,ship.position.y,ship.position.z-1.15);shots.push({mesh,velocity:115});sfx('pulse');}
  function fireEnemyVolley(){if(!bossRoot)return;const phase=bossRoot.userData.phase,count=phase===3?7:phase===2?5:1,playerPos=ship.position.clone(),origin=bossRoot.position.clone().add(new THREE.Vector3(0,-1,4));
    const direction=playerPos.clone().sub(origin).normalize();
    for(let i=0;i<count;i++){let dir=direction.clone();if(count>1){const offset=(i-(count-1)/2)*.16;dir.x+=offset;dir.y-=offset*.43;dir.normalize();}const mesh=makeShot(origin.x,origin.y,origin.z,true);enemyShots.push({mesh,velocity:dir.multiplyScalar(38+phase*7)});}
  }
  function burst(position,color,count=34,force=16){for(let i=0;i<count;i++){const d=new THREE.Vector3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(force*.25,force)),life=rand(.36,1.25);sparks.push({p:position.clone(),v:d,life,max:life,c:new THREE.Color(color),size:rand(.4,2.4)});}}
  function syncSparks(){const p=sparkField.geometry.attributes.position.array,c=sparkField.geometry.attributes.color.array,n=Math.min(sparks.length,5000);for(let i=0;i<n;i++){const s=sparks[i],k=i*3;p[k]=s.p.x;p[k+1]=s.p.y;p[k+2]=s.p.z;c[k]=s.c.r;c[k+1]=s.c.g;c[k+2]=s.c.b;}sparkField.geometry.attributes.position.needsUpdate=true;sparkField.geometry.attributes.color.needsUpdate=true;sparkField.geometry.setDrawRange(0,n);}
  function startBoss(){if(bossRoot||state!=='playing')return;entities.forEach(e=>scene.remove(e.mesh));entities=[];makeBoss();bossTime=0;attackTime=.8;$('boss-name').textContent=chapter.boss;$('boss-bar').style.width='100%';$('boss-status').textContent='CORE EXPOSED';$('boss-hud').classList.remove('hidden');$('mission-label').textContent='DESTROY THE MEMORY';$('story-line').textContent=chapter.middle;$('game-shell').classList.add('distortion');setTimeout(()=>$('game-shell').classList.remove('distortion'),700);sfx('arrival');}
  function damageBoss(amount){if(!bossRoot)return;const open=Math.sin(bossTime*1.1)>-.27||bossRoot.userData.hp<30;if(!open)return;bossRoot.userData.hp-=amount;bossCore.material.emissiveIntensity=3.8;setTimeout(()=>{if(bossCore)bossCore.material.emissiveIntensity=2.2;},80);burst(bossRoot.position.clone().add(new THREE.Vector3(rand(-3,3),rand(-2,2),4)),theme.a,14,9);sfx('boss-hit');if(bossRoot.userData.hp<=0)defeatBoss();}
  function takeDamage(amount,position){if(phaseLeft>0||state!=='playing')return;hull-=amount;shake=.32;burst(position||ship.position,theme.c,38,19);sfx('impact');if(hull<=0){hull=0;gameOver();}}
  function phaseShift(){if(state!=='playing'||phaseLeft>0||phaseCooldown>0)return;phaseLeft=modifier==='long-phase'?1.1:.68;phaseCooldown=modifier==='long-phase'?1.35:2.2;ship.children.find(n=>n.userData.phaseShield).visible=true;sfx('phase');}

  function update3D(dt){time+=dt;const moving=state==='playing'?1:state==='story'?.12:.025,drive=(modifier==='overdrive'?1.22:1)*speed*moving;
    rings.forEach((r,i)=>{r.position.z+=drive*dt*.78;if(r.position.z>20)r.position.z-=234;r.rotation.z+=dt*(i%2?-.012:.009);});
    city.forEach((c,i)=>{c.position.z+=drive*dt*c.userData.drift;if(c.position.z>22){c.position.z=-207-rand(0,16);c.position.x=Math.sign(c.position.x)*rand(15,38);}});
    const positions=starField.geometry.attributes.position.array;for(let i=0;i<positions.length;i+=3){positions[i+2]+=drive*dt*1.65;if(positions[i+2]>17){positions[i+2]=-208;positions[i]=rand(-85,85);positions[i+1]=rand(-48,48);}}starField.geometry.attributes.position.needsUpdate=true;
    if(state==='playing'){
      actTime+=dt;score+=dt*(75+chapterIndex*8);fireCooldown=Math.max(0,fireCooldown-dt);phaseCooldown=Math.max(0,phaseCooldown-dt);phaseLeft=Math.max(0,phaseLeft-dt);
      if(phaseLeft<=0)ship.children.find(n=>n.userData.phaseShield).visible=false;
      let x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),y=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);if(modifier==='inversion')y=-y;
      const steer=modifier==='heavy-drift'?3.1:7.2;ship.userData.vx=mix(ship.userData.vx||0,x*19,Math.min(1,dt*steer));ship.userData.vy=mix(ship.userData.vy||0,y*13,Math.min(1,dt*steer));
      if(modifier==='magnetism')for(const e of entities)if(e.type==='memory'&&Math.abs(e.mesh.position.z-ship.position.z)<34&&e.mesh.position.distanceTo(ship.position)<21)e.mesh.position.lerp(ship.position,dt*.8);
      ship.position.x=clamp(ship.position.x+ship.userData.vx*dt,-14,14);ship.position.y=clamp(ship.position.y+ship.userData.vy*dt,-8,7);
      ship.rotation.z=mix(ship.rotation.z,-ship.userData.vx*.018,Math.min(1,dt*5));ship.rotation.x=mix(ship.rotation.x,ship.userData.vy*.012,Math.min(1,dt*4));ship.position.y+=Math.sin(time*6)*dt*.16;
      ship.children.forEach(n=>{if(n.userData.enginePlume)n.scale.y=.78+Math.sin(time*31)*.13;if(n.userData.engineInner)n.scale.y=.78+Math.cos(time*27)*.12;});shipLight.position.copy(ship.position).add(new THREE.Vector3(0,0,2));
      if(!bossRoot){if(Math.random()<dt*(.76+speed/55))spawnEntity();if(shards>=5||actTime>42)startBoss();}
      for(const e of entities){e.mesh.position.z+=drive*dt*1.35;e.mesh.rotation.x+=dt*e.mesh.userData.spin;e.mesh.rotation.y+=dt*e.mesh.userData.spin*.73;e.mesh.position.y=e.mesh.userData.baseY+Math.sin(time*2+e.mesh.position.x)*.22;
        if(e.mesh.position.z>ship.position.z-1.4&&e.mesh.position.z<ship.position.z+1.4&&Math.abs(e.mesh.position.x-ship.position.x)<e.radius+1.35&&Math.abs(e.mesh.position.y-ship.position.y)<e.radius+1){if(e.type==='memory'){e.mesh.visible=false;e.mesh.position.z=1000;shards++;score+=250;burst(e.mesh.position,theme.a,24,11);sfx('memory');if(shards>=5)$('mission-label').textContent='MEMORY COMPLETE';}else{e.mesh.position.z=ship.position.z+5;takeDamage(20,ship.position.clone());}}
      }
      entities=entities.filter(e=>{if(e.mesh.position.z>18){scene.remove(e.mesh);return false;}return e.mesh.position.z<900;});
      for(const s of shots){s.mesh.position.z-=s.velocity*dt;s.mesh.rotation.z+=dt*4;if(bossRoot&&s.mesh.position.z<bossRoot.position.z+4.2){damageBoss(12);s.mesh.position.z=-400;}}
      shots=shots.filter(s=>{if(s.mesh.position.z<-125||s.mesh.position.z>50){scene.remove(s.mesh);return false;}return true;});
      if(bossRoot){bossTime+=dt;bossRoot.position.x=Math.sin(bossTime*.47)*7;bossRoot.position.y=Math.sin(bossTime*.81)*2.7;bossRoot.rotation.y=Math.sin(bossTime*.31)*.16;bossRoot.rotation.z=Math.sin(bossTime*.71)*.09;bossRing.rotation.x+=dt*.16;bossRing.rotation.y-=dt*.25;bossCore.scale.setScalar(.9+.18*Math.sin(bossTime*3.1));
        const hp=bossRoot.userData.hp;bossRoot.userData.phase=hp<31?3:hp<67?2:1;attackTime-=dt;if(attackTime<=0){fireEnemyVolley();attackTime=hp<31?.83:hp<67?1.1:1.65;}
        for(const s of enemyShots){s.mesh.position.addScaledVector(s.velocity,dt);s.mesh.rotation.z+=dt*4;if(s.mesh.position.distanceTo(ship.position)<1.65){takeDamage(14,ship.position.clone());s.mesh.position.z=1000;}}
        enemyShots=enemyShots.filter(s=>{if(s.mesh.position.z>17||s.mesh.position.z<-120||s.mesh.position.z===1000){scene.remove(s.mesh);return false;}return true;});
        $('boss-bar').style.width=clamp(hp,0,100)+'%';$('boss-status').textContent=Math.sin(bossTime*1.1)>-.27||hp<30?'CORE EXPOSED':'SHIELD CLOSED';
      }
      $('distance').textContent=`${String(Math.floor(actTime/60)).padStart(2,'0')}:${String(Math.floor(actTime%60)).padStart(2,'0')}`;$('shards').textContent=shards;$('integrity-value').textContent=Math.ceil(hull)+'%';$('integrity-bar').style.width=clamp(hull,0,100)+'%';$('ability-meter').style.opacity=phaseCooldown>0?.25:1;
    }
    for(const s of sparks){s.p.addScaledVector(s.v,dt);s.v.multiplyScalar(Math.pow(.955,dt*60));s.life-=dt;}sparks=sparks.filter(s=>s.life>0);if(sparks.length>5000)sparks.splice(0,sparks.length-5000);syncSparks();
    const j=shake>0?shake:0;if(j){camera.position.x=rand(-j,j);camera.position.y=5.1+rand(-j,j);}else{camera.position.x=mix(camera.position.x,0,Math.min(1,dt*5));camera.position.y=mix(camera.position.y,5.1,Math.min(1,dt*5));}camera.lookAt(0,0,-32);shake=Math.max(0,shake-dt*.9);
    composer.render();
  }
  function frame(){requestAnimationFrame(frame);const dt=Math.min(.04,clock.getDelta());update3D(dt);}
  function show(which){for(const [key,el] of Object.entries(screens)){el.classList.toggle('hidden',key!==which);el.classList.toggle('active',key===which);} $('hud').classList.toggle('hidden',which!=='play');}
  function title(){state='menu';$('game-shell').classList.remove('playing');show('menu');$('continue-button').classList.toggle('hidden',campaignSaved()<=1||campaignSaved()>3);}
  function story(index,beat='intro'){chapterIndex=clamp(index-1,0,2);chapter=chapters[chapterIndex];storyBeat=beat;state='story';
    $('story-index').textContent=beat==='intro'?`SIGNAL / 0${index}`:`MEMORY RECOVERED / 0${index}`;$('story-location').textContent=chapter.name;$('story-title').textContent=beat==='intro'?chapter.location:(chapterIndex===2?'The silence remembers you.':'A voice stitched through the static.');
    $('story-copy').textContent=beat==='intro'?`${chapter.intro}\n\n${chapter.line}${aiOmen?`\n\nDREAMWRIGHT: ${aiOmen}`:''}`:chapter.outro;
    $('story-speaker').textContent=beat==='intro'?'MARA VENN · PILOT OF THE LARK':'THE LARK · FLIGHT RECORDER';$('story-button-label').textContent=beat==='intro'?'ENTER THE MEMORY':chapterIndex===2?'HEAR THE LAST NOTE':'FOLLOW THE SIGNAL';
    $('game-shell').classList.remove('playing');theme=window.aiDream?.theme||paletteOf(chapter);if(scene){scene.fog.color.set(theme.b);applyPalette();}show('story');sfx('story');
  }
  function launchAct(){state='playing';actTime=0;score=0;shards=0;hull=100;speed=30;phaseLeft=0;phaseCooldown=0;fireCooldown=0;entities.forEach(e=>scene.remove(e.mesh));shots.forEach(e=>scene.remove(e.mesh));enemyShots.forEach(e=>scene.remove(e.mesh));entities=[];shots=[];enemyShots=[];sparks=[];clearBoss();ship.position.set(0,-2.6,6.4);ship.userData.vx=ship.userData.vy=0;
    theme=window.aiDream?.theme||paletteOf(chapter);modifier=window.aiDream?.modifier||'standard';aiName=window.aiDream?.name||'';aiOmen=window.aiDream?.omen||'';chapter=chapters[chapterIndex];paletteChange();
    $('act-label').textContent=`CHAPTER 0${chapterIndex+1} / 03 — ${chapter.name}`;$('story-line').textContent=chapter.line;$('mission-label').textContent='RECOVER 5 ECHOES';$('boss-hud').classList.add('hidden');$('boss-bar').style.width='100%';$('game-shell').classList.add('playing');show('play');initAudio();sfx('launch');
  }
  function defeatBoss(){if(!bossRoot)return;const epic=bossRoot.position.clone();burst(epic,theme.c,260,47);sfx('collapse');clearBoss();enemyShots.forEach(s=>scene.remove(s.mesh));enemyShots=[];$('boss-hud').classList.add('hidden');localStorage.setItem('mv-campaign',String(Math.min(chapterIndex+2,4)));
    if(chapterIndex===2){state='story';storyBeat='ending';$('story-index').textContent='SIGNAL RESTORED / END';$('story-location').textContent='THE QUIET AFTER';$('story-title').textContent='The universe remembers her name.';$('story-copy').textContent='Mara opens the cockpit. The stars begin again, one by one.\n\n“Anya,” she says.\n\nThis time, the whole sky answers.';$('story-speaker').textContent='MARA VENN · LAST PILOT';$('story-button-label').textContent='RETURN TO THE STARS';show('story');}
    else story(chapterIndex+1,'interlude');
  }
  function gameOver(){if(state!=='playing')return;state='over';enemyShots.forEach(s=>scene.remove(s.mesh));enemyShots=[];localStorage.setItem('mv-campaign',String(chapterIndex+1));$('death-copy').textContent=`The ${chapter.name.toLowerCase()} keeps your signal. The Lark can find it again.`;show('over');sfx('death');}
  function enterJourney(index=1){initAudio();story(index,'intro');}

  function initAudio(){if(!audio){const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;audio=new Ctx();audio.master=audio.createGain();audio.master.gain.value=muted?0:.7;audio.master.connect(audio.destination);audio.music=audio.createGain();audio.music.gain.value=.26;audio.music.connect(audio.master);audio.fx=audio.createGain();audio.fx.gain.value=.7;audio.fx.connect(audio.master);
      const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=470;filter.Q.value=.8;filter.connect(audio.music);
      for(const [freq,type,detune,vol] of [[55,'sawtooth',-8,.13],[55,'triangle',8,.12],[82.4,'sine',0,.08],[110,'triangle',0,.035]]){const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;o.detune.value=detune;g.gain.value=vol;o.connect(g);g.connect(filter);o.start();}
      const lfo=audio.createOscillator(),lg=audio.createGain();lfo.frequency.value=.09;lg.gain.value=210;lfo.connect(lg);lg.connect(filter.frequency);lfo.start();}
    if(audio.state==='suspended')audio.resume();if(!musicTimer)musicTimer=setInterval(musicStep,440);
  }
  function musicNote(freq,dur=.48,vol=.1,type='triangle'){if(!audio||muted)return;const o=audio.createOscillator(),g=audio.createGain(),f=audio.createBiquadFilter(),now=audio.currentTime;o.type=type;o.frequency.setValueAtTime(freq,now);f.type='lowpass';f.frequency.value=1800;g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.025);g.gain.exponentialRampToValueAtTime(.0001,now+dur);o.connect(f);f.connect(g);g.connect(audio.music);o.start();o.stop(now+dur+.03);}
  function musicStep(){if(!audio||state!=='playing')return;const scale=[[146.83,174.61,196,220,261.63,293.66,349.23],[130.81,146.83,174.61,196,220,261.63,311.13],[164.81,196,220,246.94,293.66,329.63,392]][chapterIndex],idx=Math.floor(time*2.25)%scale.length,root=[146.83,130.81,164.81][chapterIndex];musicNote(root*(idx%4===2?1.5:1),.58,.065,'triangle');if(idx%2===0)musicNote(scale[(idx+chapterIndex*2)%scale.length],.36,.045,'sine');if(bossRoot&&idx%3===0)musicNote(73.4,.2,.055,'sawtooth');}
  function sfx(kind){initAudio();if(!audio||muted)return;const now=audio.currentTime;const voice=(from,to,dur,vol,type='sine',delay=0)=>{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(25,from),now+delay);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(25,to),now+delay+dur);g.gain.setValueAtTime(.0001,now+delay);g.gain.exponentialRampToValueAtTime(vol,now+delay+.012);g.gain.exponentialRampToValueAtTime(.0001,now+delay+dur);o.connect(g);g.connect(audio.fx);o.start(now+delay);o.stop(now+delay+dur+.03);};
    if(kind==='memory'){voice(620,1080,.25,.13);voice(930,1420,.32,.07,'triangle',.04);}else if(kind==='pulse'){voice(510,120,.14,.09,'sawtooth');voice(1050,240,.09,.045,'square');}else if(kind==='phase'){voice(230,1450,.4,.11);voice(480,1200,.34,.05,'triangle',.05);}else if(kind==='impact'){voice(145,39,.38,.18,'sawtooth');voice(75,28,.4,.14,'square');voice(820,110,.11,.05,'triangle');}else if(kind==='boss-hit'){voice(390,82,.24,.13,'square');voice(780,220,.18,.06,'sine',.02);}else if(kind==='arrival'){voice(88,46,1.1,.22,'sawtooth');voice(165,62,.9,.12,'triangle',.11);voice(523,1046,1,.1,'sine',.3);}else if(kind==='collapse'){voice(300,37,1.2,.22,'sawtooth');voice(620,50,.85,.16,'triangle',.08);voice(930,62,.7,.1,'sine',.17);}else if(kind==='launch'){voice(110,180,.52,.1,'triangle');voice(220,440,.48,.07,'sine',.04);}else if(kind==='story'){voice(392,392,.42,.055);voice(523,523,.55,.042,'triangle',.13);voice(659,659,.7,.032,'sine',.28);}else if(kind==='death'){voice(220,41,1.1,.14,'triangle');voice(164,55,1.35,.12,'sine',.2);}}

  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);composer.setSize(innerWidth,innerHeight);});
  addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyJ'||e.code==='KeyK')firePulse();if(e.code==='Space'&&state==='playing')phaseShift();if(e.code==='Escape'){if(state==='playing'){state='pause';show('pause');}else if(state==='pause'){state='playing';show('play');initAudio();}}});
  addEventListener('keyup',e=>{keys[e.code]=false;});
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&state==='playing')firePulse();});
  $('play-button').onclick=()=>enterJourney(1);$('continue-button').onclick=()=>enterJourney(clamp(campaignSaved(),1,3));$('again-button').onclick=()=>story(chapterIndex+1,'intro');$('resume-button').onclick=()=>{state='playing';show('play');initAudio();};
  $('story-button').onclick=()=>{initAudio();if(storyBeat==='intro')launchAct();else if(storyBeat==='interlude')story(chapterIndex+2,'intro');else{localStorage.setItem('mv-campaign','1');window.aiDream=null;title();}};
  $('sound-toggle').onclick=()=>{muted=!muted;$('sound-toggle').textContent=muted?'♩':'♫';if(audio)audio.master.gain.setTargetAtTime(muted?0:.7,audio.currentTime,.04);if(!muted)initAudio();};
  const existingKey=localStorage.getItem('afterimage-gemini-key');if(existingKey)$('api-key').value=existingKey;
  $('save-key').onclick=()=>{const key=$('api-key').value.trim();if(!key){$('ai-status').textContent='PASTE A GEMINI KEY FIRST';return;}localStorage.setItem('afterimage-gemini-key',key);$('ai-status').textContent='KEY SAVED LOCALLY ON THIS DEVICE';};
  $('dream-button').onclick=async()=>{const key=$('api-key').value.trim()||localStorage.getItem('afterimage-gemini-key'),prompt=$('dream-prompt').value.trim()||'a city orbiting a dying star';if(!key){$('ai-status').textContent='ADD A GEMINI KEY TO AWAKEN THE DREAMWRIGHT';return;}$('dream-button').disabled=true;$('ai-status').textContent='DREAMWRIGHT IS LISTENING…';localStorage.setItem('afterimage-gemini-key',key);
    try{const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({system_instruction:{parts:[{text:'Return only JSON with name (short evocative name), palette (blue, green, pink, violet, or gold), modifier (standard, inversion, overdrive, magnetism, long-phase, heavy-drift), and omen (one short poetic sentence). Create a beautiful 3D science-fantasy flight world for MEMORY//VOID.'}]},contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:1.05,maxOutputTokens:130}})});if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error?.message||`Gemini ${res.status}`);}const data=await res.json(),raw=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}',dream=JSON.parse(raw.replace(/^```(?:json)?|```$/g,'').trim()),pal={blue:['#80edff','#8f72ff','#ff54b7'],green:['#c5ff77','#51efbd','#e7ff8b'],pink:['#ff8e83','#ff53b5','#ffce76'],violet:['#b7a5ff','#64aaff','#8cf0ff'],gold:['#ffe59a','#ffad5d','#fff3c7']}[dream.palette?.toLowerCase()]||chapters[0].palette;window.aiDream={theme:{a:pal[0],b:pal[1],c:pal[2]},modifier:['standard','inversion','overdrive','magnetism','long-phase','heavy-drift'].includes(dream.modifier)?dream.modifier:'standard',name:(dream.name||'A NEW MEMORY').toUpperCase(),omen:dream.omen||'Something is listening.'};$('ai-status').textContent=`REALITY FORMED · ${window.aiDream.name}`;theme=window.aiDream.theme;scene.fog.color.set(theme.b);applyPalette();sfx('story');}catch(err){$('ai-status').textContent='DREAM INTERRUPTED · '+(err.message||'CHECK THE KEY').slice(0,65);}finally{$('dream-button').disabled=false;}};

  title();requestAnimationFrame(frame);
})();
