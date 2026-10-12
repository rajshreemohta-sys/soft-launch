// LinkedIn links for a named person. LinkedIn's people search requires every keyword to
// match, so "Name + full company name" often returns nothing (words like "Services" or
// "Limited" rarely appear on profiles). We search LinkedIn by name only (always returns
// results, each showing the person's company), and offer a web search restricted to
// LinkedIn profiles with the company's core name as a precise fallback. Never scraped.

const GENERIC = /\b(limited|ltd|pvt|private|services|solutions|technologies|enterprises|international|corp|corporation|group|india|co)\b\.?/gi;

export function companyCore(company: string): string {
  return company.replace(GENERIC, "").replace(/\s+/g, " ").trim() || company;
}

export function linkedInPeopleSearch(name: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name.trim())}`;
}

export function linkedInWebSearch(name: string, company: string): string {
  const q = `site:linkedin.com/in "${name.trim()}" ${companyCore(company)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
