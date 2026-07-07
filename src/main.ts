




import './style.css';

import { Application, Graphics } from 'pixi.js';
import gsap from 'gsap';


async function init() {
    const app = new Application();

    await app.init({
        background: '#1a1a2e',
        resizeTo: window,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    });

    const container = document.getElementById('app');
    if (container) container.appendChild(app.canvas);


    // const rect = new Graphics().rect(0, 0, 100, 100).fill(0xffffff);
    // rect.x = app.screen.width / 2 - 50;
    // rect.y = app.screen.height / 2 - 50;
    // rect.pivot.set(50, 50); // Центрируем якорную точку
    
    // app.stage.addChild(rect);
  
    // // Простая GSAP анимация
    // gsap.to(rect, { 
    //   rotation: Math.PI * 2, 
    //   duration: 2, 
    //   repeat: -1, 
    //   ease: 'linear' 
    // });

}

init().catch((err) => console.error(err));
