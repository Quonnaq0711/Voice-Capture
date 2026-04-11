import { COMPANY_INFO } from './legalContent';

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

function linkifyEmails(text) {
  if (typeof text !== 'string') return text;
  const parts = text.split(EMAIL_REGEX);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    // split with capture group alternates: non-match, match, non-match, match...
    // odd indices are captured email matches
    if (i % 2 === 1) {
      return (
        <a key={i} href={`mailto:${part}`} className="text-blue-600 underline hover:text-blue-800">
          {part}
        </a>
      );
    }
    return part;
  });
}

function ItemList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="list-disc pl-6 mt-2 space-y-1">
      {items.map((item, i) => (
        <li key={i}>{linkifyEmails(item)}</li>
      ))}
    </ul>
  );
}

function SubsectionGroup({ group }) {
  return (
    <div className="mt-3">
      {group.title && <h5 className="font-medium">{group.title}</h5>}
      {group.description && <p className="mt-1">{linkifyEmails(group.description)}</p>}
      <ItemList items={group.items} />
    </div>
  );
}

function Subsection({ sub, listStyle }) {
  return (
    <li className={listStyle === 'alpha' ? '' : 'space-y-1'}>
      {sub.title && <h4 className="font-medium mt-2">{sub.title}</h4>}
      {sub.description && <p className="mt-1">{linkifyEmails(sub.description)}</p>}
      <ItemList items={sub.items} />
      {sub.groups && sub.groups.map((g, i) => <SubsectionGroup key={i} group={g} />)}
      {sub.note && <p className="mt-2 text-gray-600">{linkifyEmails(sub.note)}</p>}
    </li>
  );
}

function Section({ section }) {
  return (
    <li className="space-y-2">
      <h3 className="font-medium mt-3">{section.title}</h3>
      {section.description && <p>{linkifyEmails(section.description)}</p>}
      {section.paragraphs && section.paragraphs.map((p, i) => (
        <p key={i} className="mt-2">{linkifyEmails(p)}</p>
      ))}
      {section.subsections && (
        <ol className="list-[lower-alpha] pl-6 space-y-3">
          {section.subsections.map((sub, i) => (
            <Subsection key={i} sub={sub} listStyle="alpha" />
          ))}
        </ol>
      )}
      {section.note && <p className="mt-2 text-gray-600">{linkifyEmails(section.note)}</p>}
    </li>
  );
}

function CompanyFooter() {
  return (
    <address className="not-italic mt-4 space-y-0.5">
      <p>{COMPANY_INFO.name}</p>
      <p>{COMPANY_INFO.address}</p>
      <p>{COMPANY_INFO.city}, {COMPANY_INFO.state} {COMPANY_INFO.zip}</p>
      <p>
        <a href={`mailto:${COMPANY_INFO.email}`} className="text-blue-600 underline hover:text-blue-800">
          {COMPANY_INFO.email}
        </a>
      </p>
    </address>
  );
}

export default function LegalDocument({ document: doc }) {
  const { title, effectiveDate, lastUpdated, intro, consentNotice, sections } = doc;

  return (
    <section className="border border-gray-200 rounded-2xl shadow-md p-6 flex flex-col bg-white">
      <article aria-label={title}>
        <header className="text-center mb-6">
          <img
            src={COMPANY_INFO.logo}
            alt={`${COMPANY_INFO.name} logo`}
            className="h-28 w-auto object-contain mx-auto"
          />
          <p className="text-sm text-gray-500 mt-1">{COMPANY_INFO.name}</p>
          <h2 className="text-2xl font-semibold mt-3">{title}</h2>
          <p className="font-medium text-gray-600 mt-1">Effective Date: {effectiveDate}</p>
        </header>

        <div className="overflow-y-auto pr-2 max-h-[65vh] leading-relaxed">
          {intro && <p className="mb-4">{linkifyEmails(intro)}</p>}
          {consentNotice && <p className="font-medium mb-4">{consentNotice}</p>}

          <ol className="list-decimal pl-6 space-y-4">
            {sections.map((section, i) => (
              <Section key={i} section={section} />
            ))}
            <li className="space-y-2">
              <h3 className="font-medium mt-3">CONTACT INFORMATION</h3>
              <p>
                If you have any questions, concerns, or requests regarding this {title} or our practices, please contact us:
              </p>
              <CompanyFooter />
            </li>
          </ol>

          <hr className="border-t-2 mt-6" />
          <p className="font-medium mt-2">
            Last Updated: <time>{lastUpdated}</time>
          </p>
        </div>
      </article>
    </section>
  );
}
