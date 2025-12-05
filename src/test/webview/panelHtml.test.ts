// Tests for panelHtml.ts
import { describe, it, expect } from 'vitest';
import {
  generateFlashcardHtml,
  FLASHCARD_STYLES,
  FLASHCARD_HTML_BODY,
  FLASHCARD_SCRIPT,
} from '../../webview/panelHtml';

describe('panelHtml', () => {
  describe('FLASHCARD_STYLES', () => {
    it('should contain CSS root variables', () => {
      expect(FLASHCARD_STYLES).toContain(':root');
      expect(FLASHCARD_STYLES).toContain('--vscode-font-family');
      expect(FLASHCARD_STYLES).toContain('--card-shadow');
      expect(FLASHCARD_STYLES).toContain('--accent-gradient');
    });

    it('should contain card styles', () => {
      expect(FLASHCARD_STYLES).toContain('.card');
      expect(FLASHCARD_STYLES).toContain('.card-front');
      expect(FLASHCARD_STYLES).toContain('.card-back');
    });

    it('should contain button styles', () => {
      expect(FLASHCARD_STYLES).toContain('.btn-again');
      expect(FLASHCARD_STYLES).toContain('.btn-hard');
      expect(FLASHCARD_STYLES).toContain('.btn-good');
      expect(FLASHCARD_STYLES).toContain('.btn-easy');
      expect(FLASHCARD_STYLES).toContain('.btn-reveal');
    });

    it('should contain animation keyframes', () => {
      expect(FLASHCARD_STYLES).toContain('@keyframes slideIn');
      expect(FLASHCARD_STYLES).toContain('@keyframes slideUp');
      expect(FLASHCARD_STYLES).toContain('@keyframes bounce');
    });

    it('should contain toolbar styles', () => {
      expect(FLASHCARD_STYLES).toContain('.toolbar');
      expect(FLASHCARD_STYLES).toContain('.btn-toolbar');
      expect(FLASHCARD_STYLES).toContain('.mode-select');
    });

    it('should contain session complete styles', () => {
      expect(FLASHCARD_STYLES).toContain('.session-complete');
      expect(FLASHCARD_STYLES).toContain('.stats-grid');
      expect(FLASHCARD_STYLES).toContain('.stat-item');
    });

    it('should contain empty state styles', () => {
      expect(FLASHCARD_STYLES).toContain('.empty-state');
    });
  });

  describe('FLASHCARD_HTML_BODY', () => {
    it('should contain toolbar with mode selector', () => {
      expect(FLASHCARD_HTML_BODY).toContain('id="mode-select"');
      expect(FLASHCARD_HTML_BODY).toContain('value="loop"');
      expect(FLASHCARD_HTML_BODY).toContain('value="studyUntilEmpty"');
      expect(FLASHCARD_HTML_BODY).toContain('value="dueOnly"');
    });

    it('should contain card view structure', () => {
      expect(FLASHCARD_HTML_BODY).toContain('id="card-view"');
      expect(FLASHCARD_HTML_BODY).toContain('id="card-front"');
      expect(FLASHCARD_HTML_BODY).toContain('id="card-back"');
    });

    it('should contain term elements', () => {
      expect(FLASHCARD_HTML_BODY).toContain('id="term"');
      expect(FLASHCARD_HTML_BODY).toContain('id="term-back"');
    });

    it('should contain phonetic elements', () => {
      expect(FLASHCARD_HTML_BODY).toContain('id="phonetic"');
      expect(FLASHCARD_HTML_BODY).toContain('id="phonetic-back"');
    });

    it('should contain rating buttons', () => {
      expect(FLASHCARD_HTML_BODY).toContain("onclick=\"rate('again')\"");
      expect(FLASHCARD_HTML_BODY).toContain("onclick=\"rate('hard')\"");
      expect(FLASHCARD_HTML_BODY).toContain("onclick=\"rate('good')\"");
      expect(FLASHCARD_HTML_BODY).toContain("onclick=\"rate('easy')\"");
    });

    it('should contain reveal button', () => {
      expect(FLASHCARD_HTML_BODY).toContain('onclick="revealBack()"');
      expect(FLASHCARD_HTML_BODY).toContain('Show Answer');
    });

    it('should contain empty view', () => {
      expect(FLASHCARD_HTML_BODY).toContain('id="empty-view"');
      expect(FLASHCARD_HTML_BODY).toContain('id="empty-message"');
    });

    it('should contain session complete view', () => {
      expect(FLASHCARD_HTML_BODY).toContain('id="session-complete-view"');
      expect(FLASHCARD_HTML_BODY).toContain('id="stat-reviewed"');
      expect(FLASHCARD_HTML_BODY).toContain('id="stat-new"');
      expect(FLASHCARD_HTML_BODY).toContain('id="stat-correct"');
      expect(FLASHCARD_HTML_BODY).toContain('id="stat-duration"');
    });

    it('should contain speak buttons', () => {
      expect(FLASHCARD_HTML_BODY).toContain('onclick="speakTerm()"');
      expect(FLASHCARD_HTML_BODY).toContain('onclick="speakExample()"');
    });
  });

  describe('FLASHCARD_SCRIPT', () => {
    it('should acquire VS Code API', () => {
      expect(FLASHCARD_SCRIPT).toContain('acquireVsCodeApi()');
    });

    it('should send ui_ready message', () => {
      expect(FLASHCARD_SCRIPT).toContain("type: 'ui_ready'");
    });

    it('should handle message types', () => {
      expect(FLASHCARD_SCRIPT).toContain("case 'tts_settings':");
      expect(FLASHCARD_SCRIPT).toContain("case 'study_mode':");
      expect(FLASHCARD_SCRIPT).toContain("case 'card':");
      expect(FLASHCARD_SCRIPT).toContain("case 'empty':");
      expect(FLASHCARD_SCRIPT).toContain("case 'session_complete':");
      expect(FLASHCARD_SCRIPT).toContain("case 'error':");
    });

    it('should define TTS functions', () => {
      expect(FLASHCARD_SCRIPT).toContain('function speakText(text)');
      expect(FLASHCARD_SCRIPT).toContain('function speakTerm()');
      expect(FLASHCARD_SCRIPT).toContain('function speakExample()');
      expect(FLASHCARD_SCRIPT).toContain('function speakWithTTS(text)');
    });

    it('should define card display functions', () => {
      expect(FLASHCARD_SCRIPT).toContain('function showCard(card, srs)');
      expect(FLASHCARD_SCRIPT).toContain('function showEmpty(message)');
      expect(FLASHCARD_SCRIPT).toContain('function showSessionComplete(stats)');
    });

    it('should define rating function', () => {
      expect(FLASHCARD_SCRIPT).toContain('function rate(rating)');
    });

    it('should define reveal function', () => {
      expect(FLASHCARD_SCRIPT).toContain('function revealBack()');
    });

    it('should define study mode function', () => {
      expect(FLASHCARD_SCRIPT).toContain('function setStudyMode(mode)');
    });

    it('should contain IndexedDB cache functions', () => {
      expect(FLASHCARD_SCRIPT).toContain('function openDB()');
      expect(FLASHCARD_SCRIPT).toContain('function getFromCache(key)');
      expect(FLASHCARD_SCRIPT).toContain('function saveToCache(key, audioBlob)');
      expect(FLASHCARD_SCRIPT).toContain('function cleanExpiredCache()');
    });

    it('should contain TTS engine handling', () => {
      expect(FLASHCARD_SCRIPT).toContain("engine === 'browser'");
      expect(FLASHCARD_SCRIPT).toContain("engine === 'youdao'");
      expect(FLASHCARD_SCRIPT).toContain("engine === 'google'");
      expect(FLASHCARD_SCRIPT).toContain("engine === 'azure'");
    });
  });

  describe('generateFlashcardHtml', () => {
    it('should generate valid HTML document', () => {
      const html = generateFlashcardHtml();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include head section with meta tags', () => {
      const html = generateFlashcardHtml();

      expect(html).toContain('<head>');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('Content-Security-Policy');
    });

    it('should include styles in style tag', () => {
      const html = generateFlashcardHtml();

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).toContain(':root');
    });

    it('should include body content', () => {
      const html = generateFlashcardHtml();

      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('id="card-view"');
    });

    it('should include script tag', () => {
      const html = generateFlashcardHtml();

      expect(html).toContain('<script>');
      expect(html).toContain('</script>');
      expect(html).toContain('acquireVsCodeApi()');
    });

    it('should have correct Content-Security-Policy', () => {
      const html = generateFlashcardHtml();

      expect(html).toContain("default-src 'none'");
      expect(html).toContain("style-src 'unsafe-inline'");
      expect(html).toContain("script-src 'unsafe-inline'");
      expect(html).toContain('media-src blob:');
      expect(html).toContain('connect-src https://*.tts.speech.microsoft.com');
    });

    it('should have correct title', () => {
      const html = generateFlashcardHtml();

      expect(html).toContain('<title>WordSlash Flashcards</title>');
    });
  });
});
