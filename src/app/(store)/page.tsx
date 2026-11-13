import { connection } from "next/server";
import { getHomeSections } from "@/modules/home/queries";
import { HomeSection } from "@/modules/home/sections";
import { getStoreSettings } from "@/modules/theme/server";
import { JsonLd } from "@/components/store/json-ld";
import { getBaseUrl } from "@/lib/url";

export default async function HomePage() {
  await connection();
  const [sections, settings, baseUrl] = await Promise.all([getHomeSections(), getStoreSettings(), getBaseUrl()]);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: settings.storeName,
          url: baseUrl,
          potentialAction: { "@type": "SearchAction", target: `${baseUrl}/buscar?q={search_term_string}`, "query-input": "required name=search_term_string" },
        }}
      />
      {sections.map((s) => (
        <HomeSection key={s.id} section={s} />
      ))}
    </>
  );
}
