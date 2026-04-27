import { redirect } from "next/navigation";

const nonArticleNamespaces = new Set([
  "File",
  "Category",
  "Help",
  "Special",
  "Template",
  "Talk",
  "User",
  "Wikipedia",
  "Portal",
  "Draft",
  "Module",
  "MediaWiki",
  "TimedText",
]);

export default async function WikiRedirectPage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title: titleParts } = await params;
  const title = titleParts.join("/").replace(/_/g, " ");
  const namespace = title.split(":", 1)[0];

  if (nonArticleNamespaces.has(namespace)) {
    redirect(`https://en.wikipedia.org/wiki/${titleParts.join("/")}`);
  }

  redirect(`/results/${encodeURIComponent(title)}`);
}
