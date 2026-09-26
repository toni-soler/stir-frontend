import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export async function verifyCommunityBuild() {
  const contract = await import(new URL('../dist/community/stir-catalog.mjs', import.meta.url));
  if (contract.CATALOG_CONTRACT_VERSION !== 1 || typeof contract.createCatalogClient !== 'function' || typeof contract.offerPayload !== 'function') {
    throw new Error('Community catalog contract is missing public exports');
  }
  const registered = [];
  const resources = [];
  const window = {
    __IDAX_MODULE_SDK__: {
      React: { useEffect() {}, useMemo() {}, useState() {} },
      i18n: { addResourceBundle: (...args) => resources.push(args) },
    },
    dispatchEvent: (event) => registered.push(event.detail.module),
  };
  const script = await readFile(new URL('../dist/examples/extensions/community-catalog/index.js', import.meta.url), 'utf8');
  vm.runInNewContext(script, { window, CustomEvent: class { constructor(_name, options) { this.detail = options.detail; } } });
  if (typeof window.__IDAX_MODULE_EXTENSIONS__?.['community-catalog']?.component !== 'function'
      || registered.join() !== 'community-catalog' || resources.length !== 12) {
    throw new Error('Community catalog Shell registration or locales are incomplete');
  }
}
