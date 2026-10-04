// ============================================
// ASCEND · Legal Pages (Privacy, Terms, Contact)
// ============================================
import { renderNav, renderFooter } from './components.js';

(async () => {
  await renderNav({ auth: true });
  renderFooter();
})();
