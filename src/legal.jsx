import { instanceApi } from './api.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState } = React;

/**
 * Placeholder legal pages (section 21 of the 0.5 brief): configurable routes to exist, content
 * explicitly marked DRAFT and left in English only - it is meant to be replaced by real,
 * human-approved text before any real public launch, not translated into 12 locales as if it were
 * final. STIR never invents legal/privacy policy text of its own.
 */
const CONTENT = {
  privacy: { title: 'Privacy', body: 'This instance has not yet published a reviewed privacy policy. Contact the operator below with any questions about your data.' },
  terms: { title: 'Terms', body: 'This instance has not yet published reviewed terms of service. Contact the operator below with any questions.' },
};

export function LegalPage({ sdk, kind }) {
  const [contact, setContact] = useState('');
  useEffect(() => { instanceApi(sdk).get().then((i) => setContact(i.supportContact || '')).catch(() => {}); }, []);
  const { title, body } = CONTENT[kind];
  return <section className="stir-panel">
    <p role="alert" style={{ marginBottom: '1em' }}>DRAFT - this page has not been reviewed by the instance operator. It is not final.</p>
    <h2>{title}</h2>
    <p>{body}</p>
    {contact && <p>Contact: <a href={`mailto:${contact}`}>{contact}</a></p>}
  </section>;
}
