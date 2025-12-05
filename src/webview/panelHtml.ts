// Webview panel - HTML template generation
// PURE MODULE: No vscode imports allowed - fully testable

/**
 * CSS styles for the flashcard panel
 */
export const FLASHCARD_STYLES = `
    :root {
      --vscode-font-family: var(--vscode-editor-font-family, 'Segoe UI', sans-serif);
      --card-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 2px 10px rgba(0, 0, 0, 0.2);
      --card-shadow-hover: 0 14px 50px rgba(0, 0, 0, 0.35), 0 4px 15px rgba(0, 0, 0, 0.25);
      --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --accent-blue: #4fc3f7;
      --accent-purple: #b388ff;
      --accent-green: #69f0ae;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      background-image: 
        radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.05) 0%, transparent 50%);
    }
    
    .card {
      background: linear-gradient(145deg, 
        var(--vscode-input-background) 0%, 
        color-mix(in srgb, var(--vscode-input-background) 95%, #667eea) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 48px 64px;
      max-width: 900px;
      width: 100%;
      text-align: center;
      position: relative;
      transition: transform 0.4s ease-out, opacity 0.3s ease-out, box-shadow 0.3s ease;
      box-shadow: var(--card-shadow);
      overflow: hidden;
    }
    
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--accent-gradient);
      border-radius: 20px 20px 0 0;
    }
    
    .card::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(102, 126, 234, 0.03) 0%, transparent 70%);
      pointer-events: none;
    }
    
    .card:hover {
      box-shadow: var(--card-shadow-hover);
    }
    
    .card.slide-out {
      transform: translateX(-100%);
      opacity: 0;
      transition: transform 0.25s ease-in, opacity 0.2s ease-out;
      will-change: transform, opacity;
    }
    
    .card.slide-in {
      animation: slideIn 0.3s ease-out forwards;
      will-change: transform, opacity;
    }
    
    @keyframes slideIn {
      0% {
        transform: translateX(60%);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .card-side {
      width: 100%;
    }
    
    .card-front {
      display: block;
    }
    
    .card-front.hidden {
      display: none;
    }
    
    .card-back {
      display: none;
    }
    
    .card-back:not(.hidden) {
      display: block;
      animation: slideUp 0.35s ease-out;
    }
    
    @keyframes slideUp {
      0% {
        transform: translateY(30px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .term-container {
      margin-bottom: 20px;
    }
    
    .term {
      font-size: 2.8em;
      font-weight: 600;
      background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 0.03em;
      font-family: var(--vscode-editor-font-family), Monaco, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      text-shadow: 0 0 40px rgba(79, 195, 247, 0.2);
    }
    
    .btn-speak {
      background: linear-gradient(135deg, rgba(79, 195, 247, 0.1) 0%, rgba(179, 136, 255, 0.1) 100%);
      border: 2px solid var(--accent-blue);
      color: var(--accent-blue);
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      padding: 0;
      flex-shrink: 0;
    }
    
    .btn-speak:hover {
      background: linear-gradient(135deg, rgba(79, 195, 247, 0.2) 0%, rgba(179, 136, 255, 0.2) 100%);
      transform: scale(1.15);
      box-shadow: 0 0 20px rgba(79, 195, 247, 0.3);
    }
    
    .btn-speak:active {
      transform: scale(0.95);
    }
    
    .btn-speak-small {
      width: 36px;
      height: 36px;
      font-size: 15px;
    }
    
    .phonetic-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      margin-bottom: 24px;
    }
    
    .phonetic {
      font-size: 1.25em;
      color: var(--vscode-descriptionForeground);
      font-family: 'Lucida Sans Unicode', 'Arial Unicode MS', sans-serif;
      opacity: 0.85;
      letter-spacing: 0.02em;
    }
    
    .morphemes {
      font-size: 1.9em;
      background: linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-green) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-family: var(--vscode-editor-font-family), 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      margin-top: 8px;
      margin-bottom: 20px;
      letter-spacing: 0.04em;
    }
    
    .morphemes .separator {
      color: var(--vscode-descriptionForeground);
      -webkit-text-fill-color: var(--vscode-descriptionForeground);
      margin: 0 8px;
      font-weight: normal;
      opacity: 0.6;
    }
    
    .morphemes .morpheme {
      font-weight: 600;
    }
    
    .example-container {
      margin-top: 16px;
      margin-bottom: 20px;
      padding: 24px 28px;
      background: linear-gradient(135deg, 
        rgba(102, 126, 234, 0.08) 0%, 
        rgba(118, 75, 162, 0.08) 100%);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      position: relative;
    }
    
    .example-container::before {
      content: '"';
      position: absolute;
      top: 8px;
      left: 16px;
      font-size: 3em;
      color: var(--accent-purple);
      opacity: 0.2;
      font-family: Georgia, serif;
      line-height: 1;
    }
    
    .example-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }
    
    .example {
      font-size: 1.5em;
      line-height: 1.8;
      color: var(--vscode-editor-foreground);
      font-style: italic;
      opacity: 0.95;
    }
    
    .example-cn {
      font-size: 1.05em;
      line-height: 1.6;
      color: var(--vscode-descriptionForeground);
      margin-top: 12px;
      text-align: center;
      opacity: 0.8;
    }
    
    .back-content {
      margin-top: 28px;
    }
    
    .translation {
      font-size: 2em;
      margin-bottom: 12px;
      font-family: var(--vscode-editor-font-family), 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-weight: 600;
      color: var(--accent-green);
    }
    
    .explanation {
      font-size: 1.25em;
      line-height: 1.7;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
      opacity: 0.9;
    }
    
    .explanation-cn {
      font-size: 1.15em;
      line-height: 1.6;
      color: var(--vscode-descriptionForeground);
      opacity: 0.75;
      margin-bottom: 20px;
    }
    
    .synonyms, .antonyms {
      font-size: 0.95em;
      color: var(--vscode-descriptionForeground);
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .synonyms span, .antonyms span {
      display: inline-block;
      background: linear-gradient(135deg, rgba(105, 240, 174, 0.15) 0%, rgba(79, 195, 247, 0.15) 100%);
      color: var(--accent-green);
      padding: 4px 12px;
      border-radius: 20px;
      margin: 2px 4px;
      font-size: 0.9em;
      border: 1px solid rgba(105, 240, 174, 0.2);
      transition: all 0.2s ease;
    }
    
    .synonyms span:hover, .antonyms span:hover {
      background: linear-gradient(135deg, rgba(105, 240, 174, 0.25) 0%, rgba(79, 195, 247, 0.25) 100%);
      transform: translateY(-2px);
    }
    
    .antonyms span {
      background: linear-gradient(135deg, rgba(255, 138, 128, 0.15) 0%, rgba(255, 183, 77, 0.15) 100%);
      color: #ffab91;
      border: 1px solid rgba(255, 138, 128, 0.2);
    }
    
    .antonyms span:hover {
      background: linear-gradient(135deg, rgba(255, 138, 128, 0.25) 0%, rgba(255, 183, 77, 0.25) 100%);
    }
    
    .buttons {
      display: flex;
      gap: 14px;
      justify-content: center;
      margin-top: 28px;
      flex-wrap: wrap;
    }
    
    button {
      padding: 12px 28px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    button:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }
    
    button:active {
      transform: translateY(-1px);
    }
    
    .btn-again {
      background: linear-gradient(135deg, #ff5252 0%, #d32f2f 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(211, 47, 47, 0.3);
    }
    
    .btn-hard {
      background: linear-gradient(135deg, #ffb74d 0%, #f57c00 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(245, 124, 0, 0.3);
    }
    
    .btn-good {
      background: linear-gradient(135deg, #69f0ae 0%, #388e3c 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(56, 142, 60, 0.3);
    }
    
    .btn-easy {
      background: linear-gradient(135deg, #4fc3f7 0%, #1976d2 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3);
    }
    
    .btn-reveal {
      background: var(--accent-gradient);
      color: white;
      padding: 14px 48px;
      font-size: 16px;
      border-radius: 14px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    }
    
    .btn-reveal:hover {
      box-shadow: 0 8px 30px rgba(102, 126, 234, 0.5);
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 40px;
      background: linear-gradient(145deg, 
        var(--vscode-input-background) 0%, 
        color-mix(in srgb, var(--vscode-input-background) 95%, #667eea) 100%);
      border-radius: 20px;
      box-shadow: var(--card-shadow);
    }
    
    .empty-state h2 {
      font-size: 4em;
      margin-bottom: 20px;
      animation: bounce 1s ease infinite;
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    .empty-state p {
      font-size: 1.3em;
      opacity: 0.8;
    }
    
    .toolbar {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
    }
    
    .btn-toolbar {
      background: rgba(255, 255, 255, 0.1);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      backdrop-filter: blur(10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .btn-toolbar:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .mode-select {
      background: rgba(255, 255, 255, 0.1);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 8px 12px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      backdrop-filter: blur(10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: 28px;
    }
    
    .mode-select:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    
    .mode-select:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    
    .session-complete {
      text-align: center;
      padding: 60px 40px;
      background: linear-gradient(145deg, 
        var(--vscode-input-background) 0%, 
        color-mix(in srgb, var(--vscode-input-background) 95%, #69f0ae) 100%);
      border-radius: 20px;
      box-shadow: var(--card-shadow);
      max-width: 600px;
      width: 100%;
    }
    
    .session-complete h2 {
      font-size: 4em;
      margin-bottom: 20px;
    }
    
    .session-complete h3 {
      font-size: 1.8em;
      margin-bottom: 30px;
      background: linear-gradient(135deg, var(--accent-green) 0%, var(--accent-blue) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-item {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .stat-value {
      font-size: 2.5em;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .stat-label {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }
    
    .btn-continue {
      background: var(--accent-gradient);
      color: white;
      padding: 14px 48px;
      font-size: 16px;
      border-radius: 14px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      border: none;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .btn-continue:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px rgba(102, 126, 234, 0.5);
    }
    
    .hidden {
      display: none;
    }
    
    .context-info {
      font-size: 1.2em;
      color: var(--vscode-descriptionForeground);
      margin-top: 16px;
    }
`;

/**
 * HTML template for the flashcard panel body
 */
export const FLASHCARD_HTML_BODY = `
  <div class="toolbar">
    <select id="mode-select" class="mode-select" onchange="setStudyMode(this.value)" title="Study Mode">
      <option value="loop">🔄 Loop</option>
      <option value="studyUntilEmpty">📚 Until Done</option>
      <option value="dueOnly">⏰ Due Only</option>
    </select>
    <button class="btn-toolbar" onclick="refresh()" title="Refresh data">🔄 Refresh</button>
    <button class="btn-toolbar" onclick="openSettings()" title="Settings">⚙️</button>
  </div>
  
  <div id="app">
    <div class="card" id="card-view">
      <!-- Card Front -->
      <div class="card-side card-front" id="card-front">
        <div class="term-container">
          <div class="term" id="term"></div>
        </div>
        <div class="phonetic-container" id="phonetic-container">
          <div class="phonetic" id="phonetic"></div>
          <button class="btn-speak btn-speak-small" onclick="speakTerm()" title="Pronounce term">🔊</button>
        </div>
        <div class="morphemes" id="morphemes"></div>
        
        <div class="example-container" id="example-container-front">
          <div class="example-header">
            <div class="example" id="example-front"></div>
            <button class="btn-speak btn-speak-small" onclick="speakExample()" title="Pronounce example">🔊</button>
          </div>
        </div>
        
        <div class="buttons">
          <button class="btn-reveal" onclick="revealBack()">Show Answer</button>
        </div>
      </div>
      
      <!-- Card Back -->
      <div class="card-side card-back hidden" id="card-back">
        <div class="term-container">
          <div class="term" id="term-back"></div>
        </div>
        <div class="phonetic-container">
          <div class="phonetic" id="phonetic-back"></div>
          <button class="btn-speak btn-speak-small" onclick="speakTerm()" title="Pronounce term">🔊</button>
        </div>
        <div class="morphemes" id="morphemes-back"></div>
        
        <div class="translation" id="translation"></div>
        <div class="explanation" id="explanation"></div>
        <div class="explanation-cn" id="explanation-cn"></div>
        
        <div class="example-container" id="example-container">
          <div class="example-header">
            <div class="example" id="example"></div>
            <button class="btn-speak btn-speak-small" onclick="speakExample()" title="Pronounce example">🔊</button>
          </div>
          <div class="example-cn" id="example-cn"></div>
        </div>
        
        <div class="synonyms" id="synonyms"></div>
        <div class="antonyms" id="antonyms"></div>
        
        <div class="buttons">
          <button class="btn-again" onclick="rate('again')">Again</button>
          <button class="btn-hard" onclick="rate('hard')">Hard</button>
          <button class="btn-good" onclick="rate('good')">Good</button>
          <button class="btn-easy" onclick="rate('easy')">Easy</button>
        </div>
      </div>
    </div>
    
    <div id="empty-view" class="empty-state hidden">
      <h2>🎉</h2>
      <p id="empty-message">All done for today!</p>
    </div>
    
    <div id="session-complete-view" class="session-complete hidden">
      <h2>🎉</h2>
      <h3>Today's Session Complete!</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value" id="stat-reviewed">0</div>
          <div class="stat-label">Cards Reviewed</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="stat-new">0</div>
          <div class="stat-label">New Cards Learned</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="stat-correct">0%</div>
          <div class="stat-label">Correct Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="stat-duration">0m</div>
          <div class="stat-label">Study Time</div>
        </div>
      </div>
      <button class="btn-continue" onclick="continueStudy()">Continue Studying</button>
    </div>
  </div>
`;

/**
 * JavaScript code for the flashcard panel (runs in webview)
 */
export const FLASHCARD_SCRIPT = `
    const vscode = acquireVsCodeApi();
    let currentCard = null;
    
    // TTS settings
    let ttsSettings = {
      engine: 'youdao',
      rate: 1.0,
      autoPlay: true
    };
    
    // ========== IndexedDB Audio Cache ==========
    const DB_NAME = 'wordslash-tts-cache';
    const DB_VERSION = 1;
    const STORE_NAME = 'audio';
    const CACHE_EXPIRY_DAYS = 30;
    let dbInstance = null;
    
    async function openDB() {
      if (dbInstance) return dbInstance;
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
          dbInstance = request.result;
          resolve(dbInstance);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            store.createIndex('timestamp', 'timestamp');
          }
        };
      });
    }
    
    function getCacheKey(text, engine, voice) {
      return \`\${engine}:\${voice || 'default'}:\${text}\`;
    }
    
    async function getFromCache(key) {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const request = store.get(key);
          
          request.onsuccess = () => {
            const result = request.result;
            if (result) {
              const age = Date.now() - result.timestamp;
              const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
              if (age < maxAge) {
                console.log('[WordSlash] Cache hit for:', key.substring(0, 50));
                resolve(result.audioBlob);
              } else {
                console.log('[WordSlash] Cache expired for:', key.substring(0, 50));
                resolve(null);
              }
            } else {
              resolve(null);
            }
          };
          
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('[WordSlash] Cache read error:', error);
        return null;
      }
    }
    
    async function saveToCache(key, audioBlob) {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          
          store.put({
            key: key,
            audioBlob: audioBlob,
            timestamp: Date.now()
          });
          
          tx.oncomplete = () => {
            console.log('[WordSlash] Cached audio for:', key.substring(0, 50));
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        });
      } catch (error) {
        console.error('[WordSlash] Cache write error:', error);
      }
    }
    
    async function cleanExpiredCache() {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const expireTime = Date.now() - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        
        const range = IDBKeyRange.upperBound(expireTime);
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      } catch (error) {
        console.error('[WordSlash] Cache cleanup error:', error);
      }
    }
    
    cleanExpiredCache();
    // ========== End IndexedDB Cache ==========
    
    vscode.postMessage({ type: 'ui_ready' });
    
    window.addEventListener('message', event => {
      const message = event.data;
      console.log('[WordSlash UI] Received message:', message.type);
      
      switch (message.type) {
        case 'tts_settings':
          ttsSettings = message.settings;
          console.log('[WordSlash] TTS settings:', ttsSettings);
          break;
        case 'study_mode':
          updateModeSelector(message.mode);
          break;
        case 'card':
          console.log('[WordSlash UI] Displaying card:', message.card.front.term);
          showCard(message.card, message.srs);
          break;
        case 'empty':
          showEmpty(message.message);
          break;
        case 'session_complete':
          showSessionComplete(message.stats);
          break;
        case 'error':
          showError(message.message);
          break;
      }
    });
    
    function updateModeSelector(mode) {
      const selector = document.getElementById('mode-select');
      if (selector) {
        selector.value = mode;
      }
    }
    
    function setStudyMode(mode) {
      vscode.postMessage({ type: 'set_study_mode', mode: mode });
    }
    
    function showSessionComplete(stats) {
      document.getElementById('card-view').classList.add('hidden');
      document.getElementById('empty-view').classList.add('hidden');
      document.getElementById('session-complete-view').classList.remove('hidden');
      
      document.getElementById('stat-reviewed').textContent = stats.reviewed;
      document.getElementById('stat-new').textContent = stats.newLearned;
      document.getElementById('stat-correct').textContent = Math.round(stats.correctRate * 100) + '%';
      
      const minutes = Math.floor(stats.duration / 60000);
      const seconds = Math.floor((stats.duration % 60000) / 1000);
      document.getElementById('stat-duration').textContent = 
        minutes > 0 ? minutes + 'm ' + seconds + 's' : seconds + 's';
    }
    
    function continueStudy() {
      vscode.postMessage({ type: 'set_study_mode', mode: 'loop' });
    }
    
    let isTransitioning = false;
    
    function showCard(card, srs) {
      currentCard = card;
      
      const cardView = document.getElementById('card-view');
      
      if (isTransitioning) {
        cardView.classList.remove('slide-out');
        cardView.classList.add('slide-in');
        setTimeout(() => {
          cardView.classList.remove('slide-in');
        }, 300);
        isTransitioning = false;
      }
      
      cardView.classList.remove('hidden');
      cardView.classList.remove('flipped');
      document.getElementById('card-front').classList.remove('hidden');
      document.getElementById('card-back').classList.add('hidden');
      document.getElementById('empty-view').classList.add('hidden');
      document.getElementById('session-complete-view').classList.add('hidden');
      
      // === FRONT SIDE ===
      document.getElementById('term').textContent = card.front.term;
      
      const phoneticContainer = document.getElementById('phonetic-container');
      const phoneticEl = document.getElementById('phonetic');
      if (card.front.phonetic) {
        phoneticEl.textContent = card.front.phonetic;
        phoneticContainer.classList.remove('hidden');
      } else {
        phoneticContainer.classList.add('hidden');
      }
      
      const morphemesEl = document.getElementById('morphemes');
      if (card.front.morphemes && card.front.morphemes.length > 0) {
        morphemesEl.innerHTML = card.front.morphemes
          .map(m => '<span class="morpheme">' + m + '</span>')
          .join('<span class="separator">+</span>');
        morphemesEl.classList.remove('hidden');
      } else {
        morphemesEl.classList.add('hidden');
      }
      
      const exampleContainerFront = document.getElementById('example-container-front');
      const exampleFrontEl = document.getElementById('example-front');
      if (card.front.example) {
        exampleFrontEl.textContent = card.front.example;
        exampleContainerFront.classList.remove('hidden');
      } else {
        exampleContainerFront.classList.add('hidden');
      }
      
      // === BACK SIDE ===
      const back = card.back || {};
      
      document.getElementById('term-back').textContent = card.front.term;
      document.getElementById('phonetic-back').textContent = card.front.phonetic || '';
      
      const morphemesBackEl = document.getElementById('morphemes-back');
      if (card.front.morphemes && card.front.morphemes.length > 0) {
        morphemesBackEl.innerHTML = card.front.morphemes
          .map(m => '<span class="morpheme">' + m + '</span>')
          .join('<span class="separator">+</span>');
        morphemesBackEl.classList.remove('hidden');
      } else {
        morphemesBackEl.classList.add('hidden');
      }
      
      document.getElementById('translation').textContent = back.translation || '(no translation)';
      
      document.getElementById('explanation').textContent = back.explanation || '';
      document.getElementById('explanation').classList.toggle('hidden', !back.explanation);
      document.getElementById('explanation-cn').textContent = back.explanationCn || '';
      document.getElementById('explanation-cn').classList.toggle('hidden', !back.explanationCn);
      
      const exampleContainer = document.getElementById('example-container');
      const exampleEl = document.getElementById('example');
      const exampleCnEl = document.getElementById('example-cn');
      if (card.front.example) {
        exampleEl.textContent = card.front.example;
        exampleCnEl.textContent = card.front.exampleCn || '';
        exampleContainer.classList.remove('hidden');
      } else {
        exampleContainer.classList.add('hidden');
      }
      
      const synonymsEl = document.getElementById('synonyms');
      if (back.synonyms && back.synonyms.length > 0) {
        synonymsEl.innerHTML = '同义词: ' + back.synonyms.map(s => '<span>' + s + '</span>').join('');
        synonymsEl.classList.remove('hidden');
      } else {
        synonymsEl.classList.add('hidden');
      }
      
      const antonymsEl = document.getElementById('antonyms');
      if (back.antonyms && back.antonyms.length > 0) {
        antonymsEl.innerHTML = '反义词: ' + back.antonyms.map(s => '<span>' + s + '</span>').join('');
        antonymsEl.classList.remove('hidden');
      } else {
        antonymsEl.classList.add('hidden');
      }
      
      if (ttsSettings.autoPlay) {
        speak();
      }
    }
    
    function showEmpty(message) {
      document.getElementById('card-view').classList.add('hidden');
      document.getElementById('empty-view').classList.remove('hidden');
      document.getElementById('session-complete-view').classList.add('hidden');
      document.getElementById('empty-message').textContent = message;
    }
    
    function showError(message) {
      alert('Error: ' + message);
    }
    
    let englishVoice = null;
    
    function findBestEnglishVoice() {
      const voices = speechSynthesis.getVoices();
      
      const preferredVoices = [
        'Samantha',
        'Alex',
        'Daniel',
        'Karen',
        'Google US English',
        'Google UK English Female',
        'Microsoft Zira',
        'Microsoft David',
      ];
      
      for (const name of preferredVoices) {
        const voice = voices.find(v => v.name.includes(name));
        if (voice) return voice;
      }
      
      const enVoice = voices.find(v => 
        v.lang.startsWith('en-') && !v.name.includes('Compact')
      );
      if (enVoice) return enVoice;
      
      return voices.find(v => v.lang.startsWith('en'));
    }
    
    speechSynthesis.onvoiceschanged = () => {
      englishVoice = findBestEnglishVoice();
      console.log('[WordSlash] Selected voice:', englishVoice?.name);
    };
    
    englishVoice = findBestEnglishVoice();
    
    let audioPlayer = null;
    
    function getAudioUrl(word, engine) {
      const cleanWord = word.trim().toLowerCase();
      
      switch (engine) {
        case 'youdao':
          return \`https://dict.youdao.com/dictvoice?audio=\${encodeURIComponent(cleanWord)}&type=2\`;
        
        case 'google':
          return \`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=\${encodeURIComponent(cleanWord)}\`;
        
        default:
          return null;
      }
    }
    
    async function speakText(text) {
      if (!text) return;
      
      const engine = ttsSettings.engine;
      
      console.log('[WordSlash] Speaking with engine:', engine, 'text:', text);
      
      if (engine === 'browser') {
        speakWithTTS(text);
        return;
      }
      
      if (engine === 'youdao' || engine === 'google') {
        try {
          const audioUrl = getAudioUrl(text, engine);
          
          if (!audioPlayer) {
            audioPlayer = new Audio();
          }
          
          audioPlayer.src = audioUrl;
          audioPlayer.playbackRate = ttsSettings.rate;
          
          await audioPlayer.play();
          console.log('[WordSlash] Playing', engine, 'audio for:', text);
          return;
        } catch (error) {
          console.log('[WordSlash]', engine, 'audio failed, falling back to browser TTS:', error.message);
          speakWithTTS(text);
        }
        return;
      }
      
      if (engine === 'azure') {
        const azureKey = ttsSettings.azureKey;
        const azureRegion = ttsSettings.azureRegion || 'eastus';
        const voiceName = 'en-US-JennyNeural';
        
        if (!azureKey) {
          console.log('[WordSlash] Azure key not configured, falling back to browser TTS');
          speakWithTTS(text);
          return;
        }
        
        const rateValue = ttsSettings.rate || 0.85;
        const azureRate = Math.round((rateValue - 1.0) * 100);
        const rateStr = azureRate >= 0 ? \`+\${azureRate}%\` : \`\${azureRate}%\`;
        
        const cacheKey = getCacheKey(text, \`azure-\${azureRegion}-\${rateStr}\`, voiceName);
        
        let audioUrl = null;
        try {
          let audioBlob = await getFromCache(cacheKey);
          
          if (!audioBlob) {
            console.log('[WordSlash] Fetching from Azure TTS...');
            
            const ssml = \`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
              <voice name="\${voiceName}">
                <prosody rate="\${rateStr}">
                  \${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </prosody>
              </voice>
            </speak>\`;
            
            const response = await fetch(\`https://\${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1\`, {
              method: 'POST',
              headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
              },
              body: ssml
            });
            
            if (!response.ok) {
              throw new Error(\`Azure TTS failed: \${response.status} \${response.statusText}\`);
            }
            
            audioBlob = await response.blob();
            
            saveToCache(cacheKey, audioBlob);
          }
          
          audioUrl = URL.createObjectURL(audioBlob);
          
          if (!audioPlayer) {
            audioPlayer = new Audio();
          }
          
          audioPlayer.src = audioUrl;
          audioPlayer.playbackRate = 1.0;
          
          audioPlayer.onended = () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
          };
          
          await audioPlayer.play();
          console.log('[WordSlash] Playing Azure TTS for:', text);
          return;
        } catch (error) {
          if (error.name === 'NotAllowedError') {
            console.log('[WordSlash] Azure TTS autoplay blocked (user gesture required)');
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            return;
          }
          console.error('[WordSlash] Azure TTS error:', error);
          speakWithTTS(text);
          return;
        }
      }
      
      if (engine === 'openai') {
        console.log('[WordSlash] OpenAI TTS not yet implemented, using browser TTS');
        speakWithTTS(text);
        return;
      }
      
      speakWithTTS(text);
    }
    
    function speak() {
      if (!currentCard) return;
      speakText(currentCard.front.term);
    }
    
    function speakTerm() {
      if (!currentCard) return;
      speakText(currentCard.front.term);
    }
    
    function speakExample() {
      if (!currentCard || !currentCard.front.example) return;
      speakText(currentCard.front.example);
    }
    
    function speakWithTTS(text) {
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      utterance.lang = 'en-US';
      utterance.rate = ttsSettings.rate || 0.85;
      utterance.pitch = 1.0;
      
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
    
    function revealBack() {
      if (!currentCard) return;
      
      const cardFront = document.getElementById('card-front');
      const cardBack = document.getElementById('card-back');
      
      cardFront.classList.add('hidden');
      cardBack.classList.remove('hidden');
      
      if (ttsSettings.autoPlay) {
        setTimeout(() => speak(), 200);
      }
      
      vscode.postMessage({ type: 'reveal_back', cardId: currentCard.id });
    }
    
    function rate(rating) {
      if (!currentCard) return;
      
      const cardView = document.getElementById('card-view');
      cardView.classList.add('slide-out');
      isTransitioning = true;
      
      setTimeout(() => {
        vscode.postMessage({
          type: 'rate_card',
          cardId: currentCard.id,
          rating: rating,
          mode: 'flashcard'
        });
      }, 150);
    }
    
    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }
    
    function openSettings() {
      vscode.postMessage({ type: 'open_settings' });
    }
`;

/**
 * Generate the complete HTML content for the flashcard webview panel
 */
export function generateFlashcardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src blob: https://dict.youdao.com https://translate.google.com; connect-src https://*.tts.speech.microsoft.com;">
  <title>WordSlash Flashcards</title>
  <style>${FLASHCARD_STYLES}</style>
</head>
<body>
${FLASHCARD_HTML_BODY}
  <script>${FLASHCARD_SCRIPT}</script>
</body>
</html>`;
}
