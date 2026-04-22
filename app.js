// 全域變數與 DOM 元素
let globalZhDict = {};
let currentCards = [];
const drawBtn = document.getElementById('draw-btn');
const statusText = document.getElementById('status-text');
const carousel = document.getElementById('carousel');
const phase1 = document.getElementById('phase1-container');
const phase2 = document.getElementById('phase2-container');
const battleLog = document.getElementById('battle-log');

// ==================== 1. 核心資料與 GraphQL 預載入 ====================
window.onload = initGame;

async function initGame() {
    try {
        // 使用 PokeAPI 最新版 GraphQL 端點 (v1beta2)
        const endpoint = 'https://graphql.pokeapi.co/v1beta2';
        
        // v1beta2 移除了 pokemon_v2_ 前綴，寫法更加簡潔
        const query = `
        query {
            pokemonname(where: {language_id: {_in: [4, 12]}}) {
                pokemon_species_id
                name
                language_id
            }
        }
        `;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const { data } = await response.json();
        
        // 建立字典：若為繁體 (4) 則優先覆蓋
        if (data && data.pokemonname) {
            data.pokemonname.forEach(item => {
                const id = item.pokemon_species_id;
                // 若字典還沒這個 ID，或是當前語言是繁體中文(4)，則寫入字典
                if (!globalZhDict[id] || item.language_id === 4) {
                    globalZhDict[id] = item.name;
                }
            });
        }

        statusText.textContent = "資料載入完成！請點擊按鈕抽取卡牌。";
        statusText.style.color = "#2ecc71";
        
        // 解鎖按鈕與綁定事件
        drawBtn.disabled = false;
        drawBtn.addEventListener('click', drawCards);
        setupDragEvents(); // 初始化 3D 拖曳監聽

    } catch (error) {
        // 【降級容錯 Fallback 機制】
        // 即使中文圖鑑下載失敗，依然解鎖按鈕，讓玩家以英文版繼續遊玩
        statusText.innerHTML = "中文圖鑑載入失敗，已自動切換為英文版。<br>您可以繼續抽取卡牌！";
        statusText.style.color = "#f39c12"; 
        console.error("GraphQL 圖鑑載入錯誤:", error);
        
        drawBtn.disabled = false;
        drawBtn.addEventListener('click', drawCards);
        setupDragEvents();
    }
}

// 輔助函式：取得寶可夢單體詳細數值
async function fetchPokemon(id) {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    return await res.json();
}

// 格式化寶可夢資料
function formatPokeData(data) {
    const hpStat = data.stats.find(s => s.stat.name === 'hp').base_stat;
    const atkStat = data.stats.find(s => s.stat.name === 'attack').base_stat;
    const types = data.types.map(t => t.type.name);
    // 優先使用官方高畫質插圖
    const imgUrl = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
    
    return {
        id: data.id,
        nameEn: data.name.toUpperCase(),
        // 如果 globalZhDict 抓不到中文名 (或發生錯誤時)，自動 fallback 回英文名
        nameZh: globalZhDict[data.id] || data.name.toUpperCase(),
        types: types,
        hp: hpStat * 3,      // 規格要求：HP 為 API 數值 * 3
        maxHp: hpStat * 3,
        attack: atkStat,     // 規格要求：攻擊力為 API 數值
        img: imgUrl
    };
}

// ==================== 2. 第一階段：3D 旋轉選卡畫面 ====================
async function drawCards() {
    drawBtn.disabled = true;
    statusText.textContent = "正在捕捉寶可夢並檢查屬性不重複...";
    statusText.style.color = "#f39c12";
    carousel.innerHTML = '';
    phase2.style.display = 'none';
    phase1.style.display = 'flex';
    
    currentCards = [];
    const usedTypes = new Set();
    
    // 抽取 5 隻，且確保屬性絕對不重複
    while (currentCards.length < 5) {
        const randomId = Math.floor(Math.random() * 1025) + 1; // 支援全國圖鑑 1~1025
        try {
            const data = await fetchPokemon(randomId);
            const pData = formatPokeData(data);
            
            // 檢查此隻寶可夢的屬性是否已存在於 Set 中
            const hasTypeOverlap = pData.types.some(t => usedTypes.has(t));
            if (!hasTypeOverlap) {
                currentCards.push(pData);
                pData.types.forEach(t => usedTypes.add(t)); // 將新屬性加入 Set
            }
        } catch (e) {
            console.error(`Fetch ID ${randomId} 失敗`, e);
        }
    }
    
    renderCarousel();
    statusText.textContent = "左右滑動旋轉 3D 卡牌，選擇你的夥伴！";
    statusText.style.color = "#ecf0f1";
}

function renderCarousel() {
    const theta = 360 / 5; // 5 張卡，每張間隔 72 度
    const radius = 280;    // 視角推移半徑
    
    currentCards.forEach((poke, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.style.transform = `rotateY(${index * theta}deg) translateZ(${radius}px)`;
        
        cardEl.innerHTML = `
            <img src="${poke.img}" draggable="false" alt="${poke.nameZh}">
            <div class="name-zh">${poke.nameZh}</div>
            <div class="name-en">${poke.nameEn}</div>
            <div class="types">
                ${poke.types.map(t => `<span class="type-badge">${t}</span>`).join('')}
            </div>
            <div class="stats">
                <span>HP: ${poke.hp}</span>
                <span>ATK: ${poke.attack}</span>
            </div>
            <button class="select-btn" onclick="selectCard(${index})">選擇上陣</button>
        `;
        carousel.appendChild(cardEl);
    });
    
    // 重置選轉角度面向第一張卡
    currentRotation = 0;
    updateCarouselTransform();
}

// --- 跨裝置滑動支援 ---
let isDragging = false;
let startX = 0;
let currentRotation = 0;
let previousRotation = 0;
const scene = document.querySelector('.scene');

function setupDragEvents() {
    // 綁定電腦滑鼠事件
    scene.addEventListener('mousedown', dragStart);
    window.addEventListener('mousemove', dragMove);
    window.addEventListener('mouseup', dragEnd);
    
    // 綁定手機觸控事件
    scene.addEventListener('touchstart', e => dragStart(e.touches[0]), {passive: true});
    window.addEventListener('touchmove', e => dragMove(e.touches[0]), {passive: false});
    window.addEventListener('touchend', dragEnd);
}

function dragStart(e) {
    isDragging = true;
    startX = e.clientX || e.pageX;
    carousel.style.transition = 'none'; // 拖曳時取消動畫，使跟隨滑鼠更即時
}

function dragMove(e) {
    if (!isDragging) return;
    const x = e.clientX || e.pageX;
    const deltaX = x - startX;
    currentRotation = previousRotation + (deltaX * 0.4); // 調整拖曳靈敏度
    updateCarouselTransform();
}

function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    previousRotation = currentRotation;
    carousel.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    // 磁吸效果：自動對齊到最接近的卡牌 (72 度的倍數)
    const snapRotation = Math.round(currentRotation / 72) * 72;
    currentRotation = snapRotation;
    previousRotation = snapRotation;
    updateCarouselTransform();
}

function updateCarouselTransform() {
    carousel.style.transform = `translateZ(-280px) rotateY(${currentRotation}deg)`;
}

// ==================== 3. 第二階段：戰鬥畫面與文字紀錄 ====================

// 產生停頓感的延遲函式
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function printLog(text, color = "#fff") {
    const p = document.createElement('div');
    p.style.color = color;
    p.textContent = text;
    battleLog.appendChild(p);
    battleLog.scrollTop = battleLog.scrollHeight; // 自動向下捲動
}

function createBattleCardHTML(poke, type) {
    return `
        <div class="battle-card" id="${type}-card">
            <img src="${poke.img}">
            <h3 style="margin:10px 0 5px">${poke.nameZh}</h3>
            <div style="font-weight:bold; width:100%; text-align:center;">
                HP: <span id="${type}-hp-text">${poke.hp}</span> / ${poke.maxHp}
            </div>
            <div class="hp-bar">
                <div class="hp-fill" id="${type}-hp-fill" style="width:100%"></div>
            </div>
            <div style="margin-top:10px; font-size:14px; color:#7f8c8d;">ATK: ${poke.attack}</div>
        </div>
    `;
}

function updateHpUI(type, current, max) {
    const hpText = document.getElementById(`${type}-hp-text`);
    const hpFill = document.getElementById(`${type}-hp-fill`);
    const percentage = Math.max(0, (current / max) * 100);
    
    if (hpText) hpText.textContent = current;
    if (hpFill) {
        hpFill.style.width = `${percentage}%`;
        if (percentage <= 20) hpFill.style.backgroundColor = '#e74c3c'; // 紅血
        else if (percentage <= 50) hpFill.style.backgroundColor = '#f1c40f'; // 黃血
    }
}

async function selectCard(index) {
    const playerPoke = currentCards[index];
    
    // 畫面切換
    phase1.style.display = 'none';
    phase2.style.display = 'block';
    statusText.textContent = "戰鬥進行中！";
    battleLog.innerHTML = ''; 
    document.getElementById('player-card-slot').innerHTML = createBattleCardHTML(playerPoke, 'player');
    
    // 隨機抽選對手
    printLog("正在尋找野生對手...", "#bdc3c7");
    const oppId = Math.floor(Math.random() * 1025) + 1;
    const oppRaw = await fetchPokemon(oppId);
    const oppPoke = formatPokeData(oppRaw);
    
    document.getElementById('opp-card-slot').innerHTML = createBattleCardHTML(oppPoke, 'opp');
    
    await sleep(800);
    startBattle(playerPoke, oppPoke);
}

// 核心回合制戰鬥迴圈
async function startBattle(player, opp) {
    printLog(`======================`, "#3498db");
    printLog(`⚔️ 戰鬥開始！`, "#f1c40f");
    printLog(`去吧，${player.nameZh}！`);
    printLog(`野生的 ${opp.nameZh} 出現了！`, "#e74c3c");
    printLog(`======================\n`, "#3498db");
    
    let turn = 1;
    
    while (player.hp > 0 && opp.hp > 0) {
        await sleep(800);
        printLog(`【 第 ${turn} 回合 】`, "#2ecc71");
        await sleep(800);
        
        // --- 玩家攻擊 ---
        // 傷害加入亂數浮動 (80% ~ 120%)
        const pDmg = Math.floor(player.attack * (0.8 + Math.random() * 0.4));
        opp.hp = Math.max(0, opp.hp - pDmg);
        
        printLog(`▶ ${player.nameZh} 使出了攻擊！`);
        await sleep(400);
        printLog(`造成了 ${pDmg} 點傷害。${opp.nameZh} 剩下 ${opp.hp} HP。`);
        updateHpUI('opp', opp.hp, opp.maxHp);
        
        if (opp.hp <= 0) {
            await sleep(800);
            printLog(`\n🏆 ${opp.nameZh} 倒下了！你獲得了勝利！`, "#f1c40f");
            break;
        }

        await sleep(1000);
        
        // --- 對手攻擊 ---
        const oDmg = Math.floor(opp.attack * (0.8 + Math.random() * 0.4));
        player.hp = Math.max(0, player.hp - oDmg);
        
        printLog(`▶ ${opp.nameZh} 展開反擊！`, "#e74c3c");
        await sleep(400);
        printLog(`造成了 ${oDmg} 點傷害。${player.nameZh} 剩下 ${player.hp} HP。`);
        updateHpUI('player', player.hp, player.maxHp);
        
        if (player.hp <= 0) {
            await sleep(800);
            printLog(`\n💀 你的 ${player.nameZh} 失去戰鬥能力...你輸了。`, "#7f8c8d");
            break;
        }
        
        turn++;
        printLog(`----------------------`, "#555");
    }
    
    // 結算與重置狀態
    statusText.textContent = "戰鬥結束！點擊按鈕重新開始。";
    drawBtn.disabled = false;
    drawBtn.textContent = "重新抽取 5 張卡牌";
}